const { Op } = require('sequelize');
const { StaffActivityLog, Staff } = require('../data');

const SESSION_GAP_MS = 30 * 60 * 1000; // 30 minutos sin actividad = nueva sesión
const SESSION_BUFFER_MS = 5 * 60 * 1000; // 5 min buffer por lectura al final de cada sesión
const EXPECTED_DAILY_MINUTES = 8 * 60; // Jornada esperada: 8hs, lunes a viernes
const BUSINESS_TZ = 'America/New_York'; // Florida / Orlando timezone

const WEB_ROLES = ['owner', 'admin', 'recept', 'finance', 'finance-viewer', 'sales_rep', 'follow-up', 'capataz'];

// Retorna la fecha como "YYYY-MM-DD" en la timezone del negocio (New York / Orlando)
function toNYDateKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ }).format(d);
}

// Retorna un Date que representa la medianoche en New York del día actual
function getNYStartOfDay(referenceDate = new Date()) {
  const d = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const dateKey = toNYDateKey(d); // "2026-08-28"
  // Truco: obtener la hora NY como string, crear Date "naive" y calcular offset
  const nyNow = new Date(d.toLocaleString('en-US', { timeZone: BUSINESS_TZ }));
  const offsetMs = d.getTime() - nyNow.getTime();
  const nyMidnightNaive = new Date(dateKey + 'T00:00:00');
  return new Date(nyMidnightNaive.getTime() + offsetMs);
}

function isWeekendDate(dateOrKey) {
  if (typeof dateOrKey === 'string') {
    // Use noon in NY to avoid DST edge cases
    const d = new Date(dateOrKey + 'T12:00:00');
    const dayOfWeek = new Intl.DateTimeFormat('en-US', { timeZone: BUSINESS_TZ, weekday: 'short' }).format(d);
    return dayOfWeek === 'Sat' || dayOfWeek === 'Sun';
  }
  const dayOfWeek = new Intl.DateTimeFormat('en-US', { timeZone: BUSINESS_TZ, weekday: 'short' }).format(dateOrKey);
  return dayOfWeek === 'Sat' || dayOfWeek === 'Sun';
}

// Clasifica cómo se distribuyeron las horas en el día según la cantidad de sesiones detectadas
function classifyPattern(sessionsCount) {
  if (sessionsCount <= 0) return 'sin_actividad';
  if (sessionsCount === 1) return 'continuo';
  if (sessionsCount === 2) return 'partido';
  return 'disperso';
}

function calculateActiveMinutes(logs) {
  if (!logs.length) return 0;
  if (logs.length === 1) return 5;

  let total = 0;
  let sessionStart = new Date(logs[0].createdAt).getTime();
  let prev = sessionStart;

  for (let i = 1; i < logs.length; i++) {
    const curr = new Date(logs[i].createdAt).getTime();
    if (curr - prev > SESSION_GAP_MS) {
      total += (prev - sessionStart) + SESSION_BUFFER_MS;
      sessionStart = curr;
    }
    prev = curr;
  }
  total += (prev - sessionStart) + SESSION_BUFFER_MS;

  return Math.round(total / 60000);
}

// Cuenta cuántas sesiones (bloques de actividad separados por 30+ min de pausa) hubo en un set de logs
function countSessions(logs) {
  if (!logs.length) return 0;
  let count = 1;
  let prev = new Date(logs[0].createdAt).getTime();
  for (let i = 1; i < logs.length; i++) {
    const curr = new Date(logs[i].createdAt).getTime();
    if (curr - prev > SESSION_GAP_MS) count++;
    prev = curr;
  }
  return count;
}

function buildDailyBreakdown(logs, numDays) {
  const byDay = {};
  logs.forEach((log) => {
    const day = toNYDateKey(log.createdAt); // fecha en Orlando, no UTC
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(log);
  });

  const days = [];
  const todayNY = getNYStartOfDay();
  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date(todayNY.getTime() - i * 24 * 60 * 60 * 1000);
    const key = toNYDateKey(d); // fecha en Orlando
    const dayLogs = byDay[key] || [];
    const weekend = isWeekendDate(key);
    const sessionsCount = countSessions(dayLogs);
    days.push({
      date: key,
      minutes: calculateActiveMinutes(dayLogs),
      actions: dayLogs.length,
      isWeekend: weekend,
      sessionsCount,
      pattern: classifyPattern(sessionsCount),
      expectedMinutes: weekend ? 0 : EXPECTED_DAILY_MINUTES,
    });
  }
  return days;
}

function buildSessions(logs) {
  if (!logs.length) return [];
  const sessions = [];
  let start = new Date(logs[0].createdAt);
  let end = start;
  let actions = 1;
  const sections = new Set([logs[0].section].filter(Boolean));

  for (let i = 1; i < logs.length; i++) {
    const curr = new Date(logs[i].createdAt);
    if (curr - end > SESSION_GAP_MS) {
      sessions.push({ start, end, minutes: Math.round((end - start) / 60000) + 5, actions, sections: [...sections] });
      start = curr;
      end = curr;
      actions = 1;
      sections.clear();
    } else {
      end = curr;
      actions++;
    }
    if (logs[i].section) sections.add(logs[i].section);
  }
  sessions.push({ start, end, minutes: Math.round((end - start) / 60000) + 5, actions, sections: [...sections] });
  return sessions;
}

const getActivitySummary = async (req, res) => {
  try {
    const now = new Date();
    const todayStart = getNYStartOfDay(now); // medianoche en Orlando, no en UTC
    const weekStart = getNYStartOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));

    // Presencia real (Socket.IO): staffId -> Set de socket.id de quienes tienen la app/web abierta ahora mismo
    const connectedUsers = req.app.get('connectedUsers') || {};

    const staffList = await Staff.findAll({
      where: { role: { [Op.in]: WEB_ROLES }, isActive: true },
      attributes: ['id', 'name', 'role', 'email'],
      order: [['name', 'ASC']],
    });

    // Una sola query por usuario (rango de 7 días, cubre "hoy" y "semana"), en vez de 3.
    // Con índice compuesto (staffId, createdAt) esto es una lectura indexada muy liviana
    // incluso con 10+ usuarios y semanas con cientos de acciones registradas.
    const results = await Promise.all(staffList.map(async (s) => {
      const weekLogs = await StaffActivityLog.findAll({
        where: { staffId: s.id, createdAt: { [Op.gte]: weekStart } },
        order: [['createdAt', 'ASC']],
        attributes: ['createdAt', 'section'],
      });

      const todayLogs = weekLogs.filter((log) => new Date(log.createdAt) >= todayStart);

      // lastLog: si hubo actividad en los últimos 7 días ya lo tenemos (evita una query extra);
      // solo si el usuario no tuvo ninguna actividad reciente se consulta el histórico completo.
      const lastLog = weekLogs.length
        ? weekLogs[weekLogs.length - 1]
        : await StaffActivityLog.findOne({
            where: { staffId: s.id },
            order: [['createdAt', 'DESC']],
            attributes: ['createdAt', 'section'],
          });

      const todayIsWeekend = isWeekendDate(todayStart);
      const last7Days = buildDailyBreakdown(weekLogs, 7);
      const weekExpectedMinutes = last7Days.reduce((a, d) => a + d.expectedMinutes, 0);
      const weekendMinutes = last7Days.filter((d) => d.isWeekend).reduce((a, d) => a + d.minutes, 0);
      const weekMinutes = calculateActiveMinutes(weekLogs);

      return {
        id: s.id,
        name: s.name,
        role: s.role,
        email: s.email,
        lastSeen: lastLog?.createdAt || null,
        lastSection: lastLog?.section || null,
        isOnline: !!connectedUsers[s.id] && connectedUsers[s.id].size > 0, // Conexión real vía Socket.IO
        todayMinutes: calculateActiveMinutes(todayLogs),
        weekMinutes,
        todayActions: todayLogs.length,
        weekActions: weekLogs.length,
        todayPattern: classifyPattern(countSessions(todayLogs)),
        todayExpectedMinutes: todayIsWeekend ? 0 : EXPECTED_DAILY_MINUTES,
        last7Days,
        weekExpectedMinutes,
        weekComplianceRatio: weekExpectedMinutes > 0 ? +(weekMinutes / weekExpectedMinutes).toFixed(2) : null,
        weekendMinutes,
        workedWeekend: weekendMinutes > 0,
      };
    }));

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('❌ [getActivitySummary]', error);
    res.status(500).json({ success: false, message: 'Error obteniendo actividad' });
  }
};

const getStaffDetail = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { from, to } = req.query;

    const fromDate = from ? new Date(from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();

    const [staff, logs] = await Promise.all([
      Staff.findByPk(staffId, { attributes: ['id', 'name', 'role', 'email'] }),
      StaffActivityLog.findAll({
        where: { staffId, createdAt: { [Op.between]: [fromDate, toDate] } },
        order: [['createdAt', 'ASC']],
        attributes: ['endpoint', 'method', 'section', 'createdAt'],
      }),
    ]);

    if (!staff) return res.status(404).json({ success: false, message: 'Staff no encontrado' });

    // Agrupar por día (usando timezone de Orlando)
    const byDay = {};
    logs.forEach((log) => {
      const day = toNYDateKey(log.createdAt);
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(log);
    });

    const days = Object.entries(byDay)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, dayLogs]) => {
        const weekend = isWeekendDate(date);
        const minutes = calculateActiveMinutes(dayLogs);
        const expectedMinutes = weekend ? 0 : EXPECTED_DAILY_MINUTES;
        const sessions = buildSessions(dayLogs);
        return {
          date,
          minutes,
          actions: dayLogs.length,
          sections: [...new Set(dayLogs.map((l) => l.section).filter(Boolean))],
          sessions,
          isWeekend: weekend,
          expectedMinutes,
          complianceRatio: expectedMinutes > 0 ? +(minutes / expectedMinutes).toFixed(2) : null,
          pattern: classifyPattern(sessions.length),
        };
      });

    res.json({ success: true, staff, days });
  } catch (error) {
    console.error('❌ [getStaffDetail]', error);
    res.status(500).json({ success: false, message: 'Error obteniendo detalle' });
  }
};

const getActivityReport = async (req, res) => {
  try {
    const { from, to } = req.query;
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();

    const staffList = await Staff.findAll({
      where: { role: { [Op.in]: WEB_ROLES }, isActive: true },
      attributes: ['id', 'name', 'role', 'email'],
      order: [['name', 'ASC']],
    });

    const results = await Promise.all(staffList.map(async (s) => {
      const logs = await StaffActivityLog.findAll({
        where: { staffId: s.id, createdAt: { [Op.between]: [fromDate, toDate] } },
        order: [['createdAt', 'ASC']],
        attributes: ['endpoint', 'method', 'section', 'createdAt'],
      });

      const byDay = {};
      logs.forEach((log) => {
        const day = toNYDateKey(log.createdAt); // timezone Orlando
        if (!byDay[day]) byDay[day] = [];
        byDay[day].push(log);
      });

      const days = Object.entries(byDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, dayLogs]) => {
          const weekend = isWeekendDate(date);
          const minutes = calculateActiveMinutes(dayLogs);
          const sessions = buildSessions(dayLogs);
          return {
            date,
            minutes,
            actions: dayLogs.length,
            sections: [...new Set(dayLogs.map((l) => l.section).filter(Boolean))],
            sessions,
            isWeekend: weekend,
          };
        });

      return {
        id: s.id,
        name: s.name,
        role: s.role,
        totalMinutes: calculateActiveMinutes(logs),
        totalActions: logs.length,
        days,
      };
    }));

    res.json({ success: true, data: results, from: fromDate, to: toDate });
  } catch (error) {
    console.error('❌ [getActivityReport]', error);
    res.status(500).json({ success: false, message: 'Error generando reporte' });
  }
};

module.exports = { getActivitySummary, getStaffDetail, getActivityReport };
