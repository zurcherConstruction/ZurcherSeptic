import React, { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { fetchSimpleWorks } from '../../Redux/Actions/simpleWorkActions';
import { ArrowPathIcon, ListBulletIcon } from '@heroicons/react/24/outline';

// Progress bar shows stages from Approved onward — pre-approval is "pending"
const STAGES = [
  { key: 'approved',    label: 'Approved' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'invoiced',    label: 'Invoiced' },
  { key: 'paid',        label: 'Paid' },
  { key: 'completed',   label: 'Completed' },
];
const STAGE_IDX_MAP = { approved: 0, in_progress: 1, invoiced: 2, paid: 3, completed: 4 };
const PAID_IDX = 3;

const TYPE_LABELS = {
  culvert: 'Culvert', drainfield: 'Drainfield', repair: 'Repair',
  abandonment: 'Abandonment', modification: 'Modification', pumping: 'Pumping',
  replacement: 'Replacement', plumbing: 'Plumbing', inspection: 'Inspection',
  installation: 'Installation', maintenance: 'Maintenance', other: 'Other',
  concrete_work: 'Concrete', excavation: 'Excavation', electrical: 'Electrical',
  landscaping: 'Landscaping',
};

const getClientName = (w) => {
  if (w.clientData?.firstName) return `${w.clientData.firstName} ${w.clientData.lastName || ''}`.trim();
  if (w.clientData?.name) return w.clientData.name;
  return '';
};

const fmt = (n) => parseFloat(n || 0).toLocaleString('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0,
});

const getStageIndex = (rawStatus) => STAGE_IDX_MAP[rawStatus] ?? -1;

const SimpleWorkTracker = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { simpleWorks, loading, error } = useSelector(s => s.simpleWork);
  const hasFetched = useRef(false);

  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      dispatch(fetchSimpleWorks({ status: 'all', limit: 200 }));
    }
  }, []);

  const filtered = (simpleWorks || []).filter(w => {
    if (w.status === 'cancelled') return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      getClientName(w).toLowerCase().includes(q) ||
      (w.propertyAddress || '').toLowerCase().includes(q) ||
      String(w.workNumber || '').includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => getStageIndex(a.status) - getStageIndex(b.status));

  return (
    <div className="max-w-7xl p-2 mx-auto">
      {/* Header bar */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          placeholder="Search client, address, work #..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 border border-gray-300 p-2 md:p-3 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => dispatch(fetchSimpleWorks({ status: 'all', limit: 200 }))}
          className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-500 hover:text-blue-600 transition-colors"
          title="Refresh"
        >
          <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <button
          onClick={() => navigate('/simple-works')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <ListBulletIcon className="h-4 w-4" />
          <span className="hidden md:inline">List View</span>
        </button>
      </div>

      {loading && <p className="text-blue-500 text-center">Loading simple works...</p>}
      {error && <p className="text-red-500 text-center">Error: {error}</p>}

      {!loading && !error && sorted.map(work => {
        const stageIdx  = getStageIndex(work.status);
        const amount    = parseFloat(work.totalCost || work.finalAmount || work.estimatedAmount || 0);
        const paid      = parseFloat(work.totalPaid || 0);
        const isPaid    = amount > 0 && paid >= amount;
        const isCompleted = work.status === 'completed';
        const fillIdx   = Math.max(stageIdx, isPaid ? PAID_IDX : -1);
        const pctPaid   = amount > 0 ? Math.min(100, Math.round((paid / amount) * 100)) : 0;

        const cardBg = isCompleted
          ? 'bg-green-50 border-green-200'
          : 'bg-white border-gray-200';

        return (
          <Link
            to={`/simple-works/${work.id}`}
            key={work.id}
            className={`block ${cardBg} p-4 mb-4 shadow-lg rounded-lg border hover:shadow-xl transition-shadow duration-300`}
          >
            {/* Title row */}
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <h3 className="font-varela uppercase text-lg md:text-xl text-gray-700 text-center">
                {work.propertyAddress || getClientName(work) || `#${work.workNumber || work.id?.slice(0,6)}`}
              </h3>
              {work.workType && (
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
                  {TYPE_LABELS[work.workType] || work.workType}
                </span>
              )}
              {isCompleted && (
                <span className="px-3 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700 border border-green-300">
                  Completed
                </span>
              )}
              {work.workNumber && (
                <span className="text-xs text-gray-400">#{work.workNumber}</span>
              )}
            </div>

            {/* Client name (secondary) */}
            {getClientName(work) && work.propertyAddress && (
              <p className="text-sm text-gray-500 text-center mt-0.5">{getClientName(work)}</p>
            )}

            {/* Inspection alerts */}
            {(work.needsInitialInspection || work.needsFinalInspection) && (() => {
              const alerts = [];
              if (work.needsInitialInspection) {
                if (work.initialInspectionResult === 'failed')
                  alerts.push({ label: 'Initial Insp. Failed', cls: 'text-red-600 bg-red-50 border-red-200' });
                else if (work.initialInspectionResult === 'passed')
                  alerts.push({ label: 'Initial Insp. ✓', cls: 'text-green-700 bg-green-50 border-green-200' });
                else
                  alerts.push({ label: 'Initial Insp. Pending', cls: 'text-yellow-700 bg-yellow-50 border-yellow-200' });
              }
              if (work.needsFinalInspection) {
                if (work.finalInspectionResult === 'failed')
                  alerts.push({ label: 'Final Insp. Failed', cls: 'text-red-600 bg-red-50 border-red-200' });
                else if (work.finalInspectionResult === 'passed')
                  alerts.push({ label: 'Final Insp. ✓', cls: 'text-green-700 bg-green-50 border-green-200' });
                else
                  alerts.push({ label: 'Final Insp. Pending', cls: 'text-yellow-700 bg-yellow-50 border-yellow-200' });
              }
              return (
                <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                  {alerts.map((a, i) => (
                    <span key={i} className={`text-xs font-semibold px-2 py-0.5 rounded border ${a.cls}`}>{a.label}</span>
                  ))}
                </div>
              );
            })()}

            {/* Payment progress (shown above bar when amount > 0) */}
            {amount > 0 && (
              <div className="mt-3 flex items-center justify-center gap-2 text-sm text-gray-600">
                <span>{fmt(paid)} / {fmt(amount)}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 font-medium">{pctPaid}%</span>
              </div>
            )}

            {/* Progress bar + stage dots (desktop) */}
            <div className="hidden sm:flex relative items-center justify-between mt-4">
              <div className="absolute w-full h-2 bg-gray-200 rounded-full" />
              <div
                className="absolute h-2 bg-green-500 rounded-full transition-all duration-500"
                style={{ width: fillIdx >= 0 ? `${(fillIdx / (STAGES.length - 1)) * 100}%` : '0%' }}
              />
              {STAGES.map((stage, idx) => {
                const isCurrent   = idx === stageIdx;
                const isDone      = idx < stageIdx || (isPaid && idx === PAID_IDX);
                const isOrange    = idx === PAID_IDX && isCompleted && !isPaid;
                const circleClass = isOrange
                  ? 'bg-orange-400 animate-pulse'
                  : isDone || isCurrent ? 'bg-green-500' : 'bg-gray-300';

                return (
                  <div key={stage.key} className="relative flex flex-col items-center" style={{ width: `${100 / STAGES.length}%` }}>
                    <div
                      className={`w-8 h-8 flex items-center justify-center rounded-full text-white text-sm font-bold shadow-md ${circleClass} ${isCurrent && !isOrange ? 'animate-pulse' : ''}`}
                      style={{ position: 'absolute', top: '50%', transform: 'translate(-50%, -50%)', left: '50%' }}
                    >
                      {idx + 1}
                    </div>
                    <div className="flex flex-col items-center text-center mt-16">
                      <p className={`text-xs font-varela p-1 ${isOrange ? 'text-orange-500 font-bold animate-pulse' : isCurrent ? 'text-green-600 font-bold animate-pulse' : isDone ? 'text-green-500' : 'text-gray-400'}`}>
                        {stage.label}{isOrange ? ' ⚠' : ''}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile */}
            <div className="block sm:hidden mt-2">
              <p className="text-sm text-gray-600 text-center">
                Stage:{' '}
                <span className={`font-semibold ${isCompleted && !isPaid ? 'text-orange-500' : 'text-green-600'}`}>
                  {STAGES[stageIdx]?.label || work.status}
                  {isCompleted && !isPaid ? ' ⚠ Pago pendiente' : ''}
                </span>
              </p>
            </div>
          </Link>
        );
      })}

      {!loading && !error && sorted.length === 0 && (
        <p className="text-gray-400 text-center py-12">No simple works found.</p>
      )}
    </div>
  );
};

export default SimpleWorkTracker;
