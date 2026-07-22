const parseDateValue = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }

  const stringValue = String(value).trim();
  if (!stringValue) return null;

  const dateOnlyMatch = stringValue.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const date = new Date(stringValue);
  return Number.isNaN(date.getTime()) ? null : date;
};

const addDays = (date, days) => {
  if (!date) return null;
  const copy = new Date(date.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
};

const formatDateShort = (value, options = {}) => {
  const date = parseDateValue(value);
  if (!date) return 'Not defined';

  const { includeYear = true } = options;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' } : {})
  });
};

const extractInspectorContact = (notes = '') => {
  if (!notes) return null;

  const noteString = String(notes);
  const emailMatch = noteString.match(/Email inspector:\s*([^\s,.;]+)/i);
  if (emailMatch?.[1]) return emailMatch[1];

  const inspectorMatch = noteString.match(/Inspector:\s*([^\n.]+)/i);
  if (inspectorMatch?.[1]) return inspectorMatch[1].trim();

  return null;
};

const getInspectionFollowUp = (work, inspections = [], inspectionType = 'initial') => {
  const inspectionList = Array.isArray(inspections) && inspections.length > 0
    ? inspections
    : Array.isArray(work?.inspections)
      ? work.inspections
      : [];

  const typeInspections = inspectionList
    .filter((inspection) => inspection?.type === inspectionType)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  const latestInspection = typeInspections[0] || null;
  const latestOpenInspection = typeInspections.find((inspection) => !['approved', 'rejected'].includes(inspection?.finalStatus || 'pending')) || null;
  const resultStatus = latestInspection?.finalStatus || null;
  const isResultCompleted = resultStatus === 'approved';
  const activeInspection = latestOpenInspection || (isResultCompleted ? latestInspection : null);

  const requestedDate = parseDateValue(
    activeInspection?.dateRequestedToInspectors || null
  );
  const scheduledDate = parseDateValue(activeInspection?.inspectorScheduledDate);
  const trackingReferenceDate = scheduledDate || requestedDate;

  // Si ya hay fecha programada, el seguimiento vence ese mismo dia para cargar resultado o llamar.
  // Si no existe, se mantiene SLA de 3 dias incluyendo el dia solicitado: 6 -> vence 8.
  const dueDate = scheduledDate || (requestedDate ? addDays(requestedDate, 2) : null);
  const now = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  const todayStart = new Date(now.getTime());
  todayStart.setHours(0, 0, 0, 0);
  const referenceStart = trackingReferenceDate ? new Date(trackingReferenceDate.getTime()) : null;
  if (referenceStart) referenceStart.setHours(0, 0, 0, 0);
  const daysSinceRequest = trackingReferenceDate
    ? Math.max(0, Math.floor((todayStart - referenceStart) / msPerDay))
    : null;
  const relevantStatuses = inspectionType === 'final'
    ? new Set([
        'paymentReceived',
        'finalInspectionPending',
        'finalRejected',
        'finalApproved',
        'maintenance',
      ])
    : new Set([
        'installed',
        'firstInspectionPending',
        'approvedInspection',
        'rejectedInspection',
        'coverPending',
        'covered',
        'invoiceFinal',
        'paymentReceived',
        'finalInspectionPending',
        'finalRejected',
        'finalApproved',
        'maintenance',
      ]);
  const isRelevantStatus = relevantStatuses.has(work?.status);
  const dueStart = dueDate ? new Date(dueDate.getTime()) : null;
  if (dueStart) dueStart.setHours(0, 0, 0, 0);
  const isOverdue = Boolean(
    isRelevantStatus &&
    trackingReferenceDate &&
    dueStart &&
    !isResultCompleted &&
    todayStart > dueStart
  );

  let state = 'idle';
  if (isResultCompleted) {
    state = 'completed';
  } else if (isOverdue) {
    state = 'overdue';
  } else if (isRelevantStatus && trackingReferenceDate) {
    state = 'requested';
  } else if (isRelevantStatus) {
    state = 'pending_request';
  }

  const inspectorContact = extractInspectorContact((activeInspection || latestInspection)?.notes);

  return {
    state,
    requestedDate,
    dueDate,
    scheduledDate,
    inspectorContact,
    inspectorEmail: inspectorContact,
    daysSinceRequest,
    resultStatus,
    resultDate: latestInspection?.dateResultReceived || null,
    latestInspection,
    latestActiveInspection: activeInspection,
    latestInitialInspection: inspectionType === 'initial' ? latestInspection : null,
    latestFinalInspection: inspectionType === 'final' ? latestInspection : null,
    hasInspection: inspectionList.some((inspection) => inspection?.type === inspectionType),
    isResultCompleted,
    isOverdue
  };
};

export {
  getInspectionFollowUp,
  formatDateShort,
};