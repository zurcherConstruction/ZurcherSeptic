const crypto = require('crypto');

const DEFAULT_GOOGLE_REVIEW_LINK = 'https://g.page/r/CVtNkk-2-u5GEAI/review';
const DEFAULT_TTL_DAYS = Number(process.env.GOOGLE_REVIEW_TRACKING_TTL_DAYS || 120);

const getSecret = () =>
  process.env.GOOGLE_REVIEW_TRACKING_SECRET ||
  process.env.JWT_SECRET_KEY ||
  'zurcher-google-review-secret';

const b64urlEncode = (value) => Buffer.from(value, 'utf8').toString('base64url');
const b64urlDecode = (value) => Buffer.from(value, 'base64url').toString('utf8');

const sign = (payloadEncoded) => {
  return crypto
    .createHmac('sha256', getSecret())
    .update(payloadEncoded)
    .digest('base64url');
};

const createGoogleReviewTrackingToken = ({ workId, email = null, ttlDays = DEFAULT_TTL_DAYS }) => {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    w: String(workId),
    e: email ? String(email).toLowerCase() : null,
    iat: now,
    exp: now + Math.max(1, Number(ttlDays || DEFAULT_TTL_DAYS)) * 24 * 60 * 60,
  };

  const payloadEncoded = b64urlEncode(JSON.stringify(payload));
  const signature = sign(payloadEncoded);
  return `${payloadEncoded}.${signature}`;
};

const verifyGoogleReviewTrackingToken = (token) => {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return { valid: false, reason: 'invalid_format' };
  }

  const [payloadEncoded, signature] = token.split('.');
  const expected = sign(payloadEncoded);

  if (signature !== expected) {
    return { valid: false, reason: 'invalid_signature' };
  }

  try {
    const payload = JSON.parse(b64urlDecode(payloadEncoded));
    const now = Math.floor(Date.now() / 1000);
    if (!payload?.w) return { valid: false, reason: 'missing_work' };
    if (payload?.exp && now > payload.exp) return { valid: false, reason: 'expired' };

    return { valid: true, payload };
  } catch (error) {
    return { valid: false, reason: 'invalid_payload' };
  }
};

const buildTrackedGoogleReviewLink = ({ workId, email = null, req = null }) => {
  const token = createGoogleReviewTrackingToken({ workId, email });
  const explicitBaseUrl = process.env.GOOGLE_REVIEW_TRACKING_BASE_URL;
  const requestBaseUrl = req ? `${req.protocol}://${req.get('host')}` : null;
  const isProduction = process.env.NODE_ENV === 'production';
  const baseUrl =
    explicitBaseUrl ||
    requestBaseUrl ||
    (isProduction ? process.env.API_URL : null) ||
    'http://localhost:3001';
  return `${baseUrl}/final-invoice/review/${token}`;
};

module.exports = {
  DEFAULT_GOOGLE_REVIEW_LINK,
  buildTrackedGoogleReviewLink,
  verifyGoogleReviewTrackingToken,
};
