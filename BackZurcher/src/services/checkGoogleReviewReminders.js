const cron = require('node-cron');
const { Op } = require('sequelize');
const { WorkNote, Work, Budget, Permit } = require('../data');
const { sendEmail } = require('../utils/notifications/emailService');
const { DEFAULT_GOOGLE_REVIEW_LINK, buildTrackedGoogleReviewLink } = require('../utils/googleReviewTracking');

const ORLANDO_TZ = 'America/New_York';
const GOOGLE_REVIEW_LINK = process.env.GOOGLE_REVIEW_LINK || DEFAULT_GOOGLE_REVIEW_LINK;
const DEFAULT_REMINDER_DAYS = Number(process.env.GOOGLE_REVIEW_REMINDER_DAYS || 5);
const DEFAULT_LOOKBACK_DAYS = Number(process.env.GOOGLE_REVIEW_LOOKBACK_DAYS || 45);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const buildReviewReminderEmailHtml = ({ clientName, propertyAddress, reviewLink }) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:30px 0;">
    <tr>
      <td align="center">
        <table width="620" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
          <tr>
            <td style="background:linear-gradient(135deg,#1a3a5c 0%,#2563a8 100%);padding:28px 40px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:26px;font-weight:700;letter-spacing:1px;">Zurcher Septic</h1>
              <p style="color:#a8c8f0;margin:8px 0 0;font-size:14px;letter-spacing:1.2px;text-transform:uppercase;">Friendly Review Reminder</p>
            </td>
          </tr>

          <tr>
            <td style="padding:30px 40px 10px;">
              <p style="font-size:18px;color:#1a3a5c;font-weight:600;margin:0 0 12px;">Hi ${clientName || 'Customer'},</p>
              <p style="font-size:15px;color:#4a5568;line-height:1.7;margin:0 0 10px;">
                Thank you again for trusting us with your project at <strong>${propertyAddress || 'your property'}</strong>.
              </p>
              <p style="font-size:15px;color:#4a5568;line-height:1.7;margin:0;">
                If you have a moment, we'd really appreciate your feedback on Google.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 40px 14px;text-align:center;">
              <div style="font-size:36px;line-height:1;margin-bottom:10px;letter-spacing:4px;color:#fde047;">⭐⭐⭐⭐⭐</div>
              <p style="font-size:14px;color:#475569;margin:0 0 18px;">Your review helps other homeowners and helps us keep improving.</p>
              <a href="${reviewLink}" target="_blank"
                 style="display:inline-block;background:#f6d02c;color:#000000;text-decoration:none;padding:14px 34px;border-radius:28px;font-size:16px;font-weight:700;box-shadow:0 6px 20px rgba(246,208,44,0.35);">
                Leave Your Review
              </a>
            </td>
          </tr>

          <tr>
            <td style="padding:10px 40px 24px;">
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;">
                <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.5;">
                  If the button does not open, copy and paste this link in your browser:<br />
                  <a href="${reviewLink}" style="color:#2563a8;text-decoration:none;word-break:break-all;">${reviewLink}</a>
                </p>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:0 40px;">
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:0;" />
            </td>
          </tr>

          <tr>
            <td style="padding:20px 40px;text-align:center;">
              <p style="font-size:14px;color:#4a5568;margin:0 0 8px;font-weight:600;">Thank you for supporting local business!</p>
              <p style="font-size:13px;color:#a0aec0;margin:0;">Zurcher Septic Team • <a href="${FRONTEND_URL}" style="color:#2563a8;text-decoration:none;">Customer Portal</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

const checkGoogleReviewReminders = async (options = {}) => {
  const olderThanDays = Number(options.olderThanDays ?? DEFAULT_REMINDER_DAYS);
  const lookbackDays = Number(options.lookbackDays ?? DEFAULT_LOOKBACK_DAYS);
  const dryRun = options.dryRun === true;

  const now = new Date();
  const reminderThreshold = new Date(now.getTime() - olderThanDays * 24 * 60 * 60 * 1000);
  const lookbackThreshold = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);

  const summary = {
    scanned: 0,
    eligible: 0,
    sent: 0,
    skippedNoEmail: 0,
    skippedAlreadySent: 0,
    errors: 0,
    dryRun,
    olderThanDays,
    lookbackDays,
  };

  try {
    console.log(`\n🔍 [CRON - GOOGLE REVIEW] Checking reminders older than ${olderThanDays} days...`);

    const reviewRequestNotes = await WorkNote.findAll({
      where: {
        noteType: 'payment',
        relatedStatus: 'invoiceFinal',
        message: { [Op.iLike]: '%Review Request%' },
        createdAt: {
          [Op.lte]: reminderThreshold,
          [Op.gte]: lookbackThreshold,
        },
      },
      include: [
        {
          model: Work,
          as: 'work',
          include: [
            {
              model: Budget,
              as: 'budget',
              include: [{ model: Permit }],
            },
          ],
        },
      ],
      order: [['createdAt', 'ASC']],
    });

    summary.scanned = reviewRequestNotes.length;

    for (const note of reviewRequestNotes) {
      const work = note.work;
      const budget = work?.budget;
      const permit = budget?.Permit;
      const workId = note.workId;

      if (!workId) continue;

      // Dedupe: if reminder note already exists for this work, skip.
      const existingReminderNote = await WorkNote.findOne({
        where: {
          workId,
          noteType: 'client_contact',
          relatedStatus: 'invoiceFinal',
          message: { [Op.iLike]: '[AUTO] Google Review reminder sent%' },
        },
      });

      // Si ya hubo click o confirmación manual, NO enviar recordatorio extra.
      const reviewCompletedSignal = await WorkNote.findOne({
        where: {
          workId,
          noteType: 'client_contact',
          relatedStatus: 'invoiceFinal',
          [Op.or]: [
            { message: { [Op.iLike]: '[AUTO] Google Review link clicked%' } },
            { message: { [Op.iLike]: '[MANUAL] Google Review confirmed%' } },
          ],
        },
      });

      if (reviewCompletedSignal) {
        summary.skippedAlreadySent += 1;
        continue;
      }

      if (existingReminderNote) {
        summary.skippedAlreadySent += 1;
        continue;
      }

      const recipientEmail = permit?.applicantEmail || budget?.applicantEmail;
      const clientName = budget?.applicantName || permit?.applicantName || 'Customer';
      const propertyAddress = work?.propertyAddress || budget?.propertyAddress || 'your property';
      const trackedReviewLink = buildTrackedGoogleReviewLink({ workId, email: recipientEmail || null });

      if (!recipientEmail) {
        summary.skippedNoEmail += 1;
        continue;
      }

      summary.eligible += 1;

      if (!dryRun) {
        try {
          await sendEmail({
            to: recipientEmail,
            subject: `Quick favor - Share your feedback about your project at ${propertyAddress}`,
            text: `Hi ${clientName},\n\nThank you for trusting us with your project at ${propertyAddress}.\n\nIf you have a moment, please leave us a quick Google review:\n${trackedReviewLink}\n\nThank you!\nZurcher Septic Team`,
            html: buildReviewReminderEmailHtml({
              clientName,
              propertyAddress,
              reviewLink: trackedReviewLink,
            }),
          });

          await WorkNote.create({
            workId,
            staffId: null,
            noteType: 'client_contact',
            priority: 'medium',
            relatedStatus: 'invoiceFinal',
            isResolved: false,
            mentionedStaffIds: [],
            message: `[AUTO] Google Review reminder sent to ${recipientEmail} (${new Date().toLocaleString('en-US', { timeZone: ORLANDO_TZ })})`,
          });

          summary.sent += 1;
          console.log(`✅ [CRON - GOOGLE REVIEW] Reminder sent for work ${String(workId).slice(0, 8)} to ${recipientEmail}`);
        } catch (sendError) {
          summary.errors += 1;
          console.error(`❌ [CRON - GOOGLE REVIEW] Error sending reminder for work ${String(workId).slice(0, 8)}:`, sendError.message);
        }
      }
    }

    console.log('✅ [CRON - GOOGLE REVIEW] Completed:', summary);
    return summary;
  } catch (error) {
    console.error('❌ [CRON - GOOGLE REVIEW] Fatal error:', error);
    throw error;
  }
};

const startGoogleReviewRemindersCron = () => {
  const cronExpression = process.env.GOOGLE_REVIEW_CRON || '0 18 * * *';
  console.log(`✅ Google Review reminders cron scheduled: ${cronExpression} (${ORLANDO_TZ})`);

  cron.schedule(cronExpression, async () => {
    try {
      await checkGoogleReviewReminders();
    } catch (error) {
      console.error('❌ [CRON - GOOGLE REVIEW] Scheduled run failed:', error.message);
    }
  }, {
    scheduled: true,
    timezone: ORLANDO_TZ,
  });
};

module.exports = {
  checkGoogleReviewReminders,
  startGoogleReviewRemindersCron,
};
