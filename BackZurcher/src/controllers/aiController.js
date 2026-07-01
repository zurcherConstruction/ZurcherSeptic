const Anthropic = require('@anthropic-ai/sdk');
const { Work, Permit, Inspection, Income, WorkChecklist } = require('../data/index');
const { Op, fn, col, literal, QueryTypes } = require('sequelize');
const { sequelize } = require('../data/index');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are ZurcherAI, a helpful business assistant for Zurcher Septic, a septic system installation and maintenance company in Florida.

You have access to tools that query the company's real-time database. Use them to answer questions about:
- Works (septic system jobs): their status, location, count, backlog
- Installations: how many were completed, when, where
- Inspections: initial and final inspection results
- Revenue/income
- Maintenance jobs

Work status lifecycle (in order):
pending → assigned → inProgress → installed → firstInspectionPending → approvedInspection / rejectedInspection → coverPending → covered → invoiceFinal → paymentReceived → finalInspectionPending → finalApproved / finalRejected → maintenance

Respond in the same language the user writes in (English or Spanish). Be concise and professional.
When presenting data, use clear formatting with numbers and relevant context.
Today's date is ${new Date().toISOString().split('T')[0]}.`;

const TOOLS = [
  {
    name: 'get_works_summary',
    description: 'Count works grouped by status. Use when asked about total works, work counts, or breakdown by status. Optionally filter by date range.',
    input_schema: {
      type: 'object',
      properties: {
        dateFrom: {
          type: 'string',
          description: 'Filter start date (YYYY-MM-DD). Applies to createdAt unless dateField is specified.'
        },
        dateTo: {
          type: 'string',
          description: 'Filter end date (YYYY-MM-DD).'
        },
        dateField: {
          type: 'string',
          enum: ['createdAt', 'installationStartDate'],
          description: 'Which date field to filter on. Default: createdAt.'
        }
      }
    }
  },
  {
    name: 'get_works_by_location',
    description: 'Find works matching a city, street, or address substring. Returns matching works with their status and dates. Use when asked about works "in" or "at" a specific location.',
    input_schema: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'City name, street name, or any part of the property address (case-insensitive search).'
        },
        status: {
          type: 'string',
          description: 'Optional: filter by work status (e.g., installed, maintenance, pending).'
        }
      },
      required: ['location']
    }
  },
  {
    name: 'get_installed_works',
    description: 'Get works that were installed in a specific date range (installationStartDate). Use when asked how many/which works were installed in a given period.',
    input_schema: {
      type: 'object',
      properties: {
        dateFrom: {
          type: 'string',
          description: 'Start date (YYYY-MM-DD).'
        },
        dateTo: {
          type: 'string',
          description: 'End date (YYYY-MM-DD).'
        }
      }
    }
  },
  {
    name: 'get_backlog',
    description: 'Get works in backlog — those still pending, assigned, or in early active stages (not yet installed). Use when asked about backlog, pending jobs, or upcoming work.',
    input_schema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_revenue_summary',
    description: 'Get total income/revenue in a date range, grouped by income type. Use when asked about revenue, income, or payments received.',
    input_schema: {
      type: 'object',
      properties: {
        dateFrom: {
          type: 'string',
          description: 'Start date (YYYY-MM-DD).'
        },
        dateTo: {
          type: 'string',
          description: 'End date (YYYY-MM-DD).'
        }
      }
    }
  },
  {
    name: 'get_maintenance_summary',
    description: 'Get count and list of works currently in maintenance status, including their last visit dates.',
    input_schema: {
      type: 'object',
      properties: {}
    }
  }
];

// --- Tool implementations ---

async function getWorksSummary({ dateFrom, dateTo, dateField = 'createdAt' } = {}) {
  const where = {};

  if (dateFrom || dateTo) {
    where[dateField] = {};
    if (dateFrom) where[dateField][Op.gte] = new Date(dateFrom);
    if (dateTo) where[dateField][Op.lte] = new Date(dateTo + 'T23:59:59');
  }

  const rows = await Work.findAll({
    where,
    attributes: ['status', [fn('COUNT', col('idWork')), 'count']],
    group: ['status'],
    raw: true
  });

  const total = rows.reduce((sum, r) => sum + parseInt(r.count, 10), 0);

  return {
    total,
    byStatus: rows
      .map(r => ({ status: r.status, count: parseInt(r.count, 10) }))
      .sort((a, b) => b.count - a.count)
  };
}

async function getWorksByLocation({ location, status } = {}) {
  const where = {
    propertyAddress: { [Op.iLike]: `%${location}%` }
  };
  if (status) where.status = status;

  const works = await Work.findAll({
    where,
    attributes: ['idWork', 'propertyAddress', 'status', 'installationStartDate', 'createdAt'],
    order: [['createdAt', 'DESC']],
    limit: 50,
    raw: true
  });

  return {
    count: works.length,
    location,
    works: works.map(w => ({
      address: w.propertyAddress,
      status: w.status,
      installationDate: w.installationStartDate,
      created: w.createdAt ? w.createdAt.toString().split('T')[0] : null
    }))
  };
}

async function getInstalledWorks({ dateFrom, dateTo } = {}) {
  const where = {
    status: {
      [Op.notIn]: ['pending', 'assigned', 'inProgress', 'cancelled']
    }
  };

  if (dateFrom || dateTo) {
    where.installationStartDate = {};
    if (dateFrom) where.installationStartDate[Op.gte] = dateFrom;
    if (dateTo) where.installationStartDate[Op.lte] = dateTo;
  }

  const works = await Work.findAll({
    where,
    attributes: ['propertyAddress', 'status', 'installationStartDate'],
    include: [{
      model: Permit,
      attributes: ['systemType', 'isPBTS'],
      required: false
    }],
    order: [['installationStartDate', 'DESC']],
    limit: 100
  });

  const byCity = {};
  works.forEach(w => {
    const addr = w.propertyAddress || '';
    const parts = addr.split(',');
    const city = parts.length > 1 ? parts[parts.length - 2].trim() : addr;
    byCity[city] = (byCity[city] || 0) + 1;
  });

  return {
    total: works.length,
    dateRange: { from: dateFrom || null, to: dateTo || null },
    byCity: Object.entries(byCity)
      .sort((a, b) => b[1] - a[1])
      .map(([city, count]) => ({ city, count })),
    works: works.map(w => ({
      address: w.propertyAddress,
      status: w.status,
      installationDate: w.installationStartDate,
      systemType: w.Permit?.systemType || null,
      isPBTS: w.Permit?.isPBTS || false
    }))
  };
}

async function getBacklog() {
  const backlogStatuses = ['pending', 'assigned', 'inProgress'];

  const works = await Work.findAll({
    where: { status: { [Op.in]: backlogStatuses } },
    attributes: ['propertyAddress', 'status', 'createdAt', 'installationStartDate'],
    order: [['createdAt', 'ASC']],
    raw: true
  });

  const byStatus = {};
  works.forEach(w => {
    byStatus[w.status] = (byStatus[w.status] || 0) + 1;
  });

  return {
    total: works.length,
    byStatus,
    works: works.map(w => ({
      address: w.propertyAddress,
      status: w.status,
      scheduledDate: w.installationStartDate || null,
      addedOn: w.createdAt ? w.createdAt.toString().split('T')[0] : null
    }))
  };
}

async function getRevenueSummary({ dateFrom, dateTo } = {}) {
  const where = {};

  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date[Op.gte] = new Date(dateFrom);
    if (dateTo) where.date[Op.lte] = new Date(dateTo + 'T23:59:59');
  }

  const rows = await Income.findAll({
    where,
    attributes: [
      'typeIncome',
      [fn('COUNT', col('id')), 'transactions'],
      [fn('SUM', col('amount')), 'total']
    ],
    group: ['typeIncome'],
    raw: true
  });

  const grandTotal = rows.reduce((sum, r) => sum + parseFloat(r.total || 0), 0);

  return {
    grandTotal: Math.round(grandTotal * 100) / 100,
    dateRange: { from: dateFrom || null, to: dateTo || null },
    byType: rows.map(r => ({
      type: r.typeIncome,
      transactions: parseInt(r.transactions, 10),
      total: Math.round(parseFloat(r.total || 0) * 100) / 100
    })).sort((a, b) => b.total - a.total)
  };
}

async function getMaintenanceSummary() {
  const works = await Work.findAll({
    where: { status: 'maintenance' },
    attributes: ['propertyAddress', 'maintenanceStartDate', 'createdAt'],
    order: [['maintenanceStartDate', 'DESC']],
    raw: true
  });

  return {
    total: works.length,
    works: works.map(w => ({
      address: w.propertyAddress,
      maintenanceSince: w.maintenanceStartDate || null
    }))
  };
}

async function executeTool(name, input) {
  switch (name) {
    case 'get_works_summary':     return getWorksSummary(input);
    case 'get_works_by_location': return getWorksByLocation(input);
    case 'get_installed_works':   return getInstalledWorks(input);
    case 'get_backlog':           return getBacklog(input);
    case 'get_revenue_summary':   return getRevenueSummary(input);
    case 'get_maintenance_summary': return getMaintenanceSummary(input);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

// --- Main handler ---

const queryAI = async (req, res) => {
  try {
    const { question, history = [] } = req.body;

    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ error: 'question is required' });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'AI service not configured (ANTHROPIC_API_KEY missing)' });
    }

    console.log(`🤖 [AI] Query from ${req.staff?.email}: "${question.slice(0, 80)}"`);

    // Build messages from history + current question
    const messages = [
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: question.trim() }
    ];

    // Agentic tool-use loop
    let loopMessages = [...messages];
    let finalText = '';
    const MAX_ITERATIONS = 8;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const stream = client.messages.stream({
        model: 'claude-opus-4-8',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages: loopMessages
      });

      const response = await stream.finalMessage();

      if (response.stop_reason === 'end_turn' || response.stop_reason !== 'tool_use') {
        finalText = response.content
          .filter(b => b.type === 'text')
          .map(b => b.text)
          .join('\n')
          .trim();
        break;
      }

      // Execute all requested tools
      const toolResults = [];
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        console.log(`  🔧 Tool: ${block.name}`, block.input);
        try {
          const result = await executeTool(block.name, block.input);
          console.log(`  ✅ ${block.name} returned ${JSON.stringify(result).slice(0, 120)}`);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result)
          });
        } catch (err) {
          console.error(`  ❌ ${block.name} error:`, err.message);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: `Error executing tool: ${err.message}`,
            is_error: true
          });
        }
      }

      loopMessages = [
        ...loopMessages,
        { role: 'assistant', content: response.content },
        { role: 'user', content: toolResults }
      ];
    }

    if (!finalText) {
      finalText = 'Lo siento, no pude generar una respuesta. Por favor intenta de nuevo.';
    }

    res.json({ answer: finalText });
  } catch (error) {
    console.error('❌ [AI] Error:', error);
    res.status(500).json({
      error: 'Error processing AI query',
      details: error.message
    });
  }
};

module.exports = { queryAI };
