import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { TypeBadge, PriorityBadge, StatusBadge } from '../../components/common/StatusBadge';
import { SkeletonTable, Skel, useSkeletonGate } from '../../components/common/Skeleton';
import DeadlineBadge, { formatDueDate } from '../../components/common/DeadlineBadge';
import FeedbackRatingDisplay from '../../components/common/FeedbackRatingDisplay';
import ReportMiniMap from '../../components/common/ReportMiniMap';
import { useTheme } from '../../context/ThemeContext';
import { mediaUrl } from '../../utils/mediaUrl';
import { formatDate, formatDateTime, plural } from '../../utils/format';
import api from '../../utils/api';

const STEPS = [
  { key: 'PENDING',     label: 'Pending',     hint: 'Not started yet' },
  { key: 'REVIEWING',   label: 'Reviewing',   hint: 'Checking the report' },
  { key: 'IN_PROGRESS', label: 'In Progress', hint: 'Work has started' },
  { key: 'RESOLVED',    label: 'Resolved',    hint: 'Fixed or answered' },
];
const STEP_INDEX = Object.fromEntries(STEPS.map((s, i) => [s.key, i]));
const STATUS_LABEL = Object.fromEntries(STEPS.map(s => [s.key, s.label]));
const STATUS_DOT = { PENDING: '#6B7280', REVIEWING: '#1D4ED8', IN_PROGRESS: '#CA8A04', RESOLVED: '#16A34A' };
const TYPE_LABEL = { COMPLAINT: 'Complaint', SUGGESTION: 'Suggestion', FEEDBACK: 'Feedback' };

// Ready-made notes for each step. Staff can change them before saving.
const QUICK_REPLIES = {
  PENDING:     ['We need more details before we can continue.'],
  REVIEWING:   ['We received your report and are checking it now.', 'We will visit the place to see the problem.'],
  IN_PROGRESS: ['Our team is working on this now.', 'The work is scheduled. We will update you when it is done.'],
  RESOLVED:    ['This has been fixed. Thank you for reporting it.', 'We have acted on your concern. Thank you for your feedback.'],
};

const TABS = [
  { key: '',            label: 'All',         count: c => c.total },
  { key: 'PENDING',     label: 'Pending',     count: c => c.pending },
  { key: 'REVIEWING',   label: 'Reviewing',   count: c => c.reviewing },
  { key: 'IN_PROGRESS', label: 'In Progress', count: c => c.inProgress },
  { key: 'OVERDUE',     label: 'Overdue',     count: c => c.overdue, alert: true },
  { key: 'RESOLVED',    label: 'Resolved',    count: c => c.resolved },
  { key: 'UNASSIGNED',  label: 'No office yet', count: c => c.unassigned, alert: true, receivingOnly: true },
];
const SORTS = [
  { key: '',         label: 'Newest first' },
  { key: 'due',      label: 'Deadline first' },
  { key: 'priority', label: 'Urgent first' },
];
const PAGE_SIZE = 15;
const SECTION = 'text-xs font-bold text-gray-500 uppercase tracking-wide mb-2';

const pageCss = `
@keyframes ssOverlayIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes ssCardIn { 0% { opacity: 0; transform: translateY(16px) scale(0.96); } 60% { opacity: 1; transform: translateY(-2px) scale(1.005); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes ssLbIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
@keyframes ssNewRow { from { background-color: rgba(37,99,235,0.18); } to { background-color: transparent; } }
.ss-overlay { animation: ssOverlayIn .2s ease both; }
.ss-card { animation: ssCardIn .35s cubic-bezier(.22,1,.36,1) both; }
.ss-lb { animation: ssLbIn .25s cubic-bezier(.22,1,.36,1) both; }
.ss-photo { transition: transform .2s ease, box-shadow .2s ease; }
.ss-photo:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.15); }
.ss-new { animation: ssNewRow 4s ease-out both; }
@media (prefers-reduced-motion: reduce) {
  .ss-overlay, .ss-card, .ss-lb { animation: none; }
  .ss-new { animation: none; box-shadow: inset 4px 0 0 #2563eb; }
}
`;

function PhotoLightbox({ media, index, onClose, onNavigate }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onNavigate(1);
      if (e.key === 'ArrowLeft') onNavigate(-1);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, onNavigate]);

  const item = media[index];
  return (
    <div className="ss-overlay fixed inset-0 z-[60] flex items-center justify-center p-6"
      style={{ background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <button type="button" onClick={onClose} aria-label="Close"
        className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
      {media.length > 1 && (
        <>
          <button type="button" onClick={e => { e.stopPropagation(); onNavigate(-1); }} aria-label="Previous photo"
            className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 19l-7-7 7-7"/></svg>
          </button>
          <button type="button" onClick={e => { e.stopPropagation(); onNavigate(1); }} aria-label="Next photo"
            className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7"/></svg>
          </button>
        </>
      )}
      <img key={item.id} src={mediaUrl(item.filePath)} alt="Attached by the citizen"
        className="ss-lb max-w-full max-h-[80vh] rounded-xl shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
      {media.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold text-white" style={{ background: 'rgba(255,255,255,0.15)' }}>
          {index + 1} / {media.length}
        </div>
      )}
    </div>
  );
}

function CitizenAvatar({ name, size = 'w-10 h-10' }) {
  return (
    <div className={`${size} rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${name ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
      {name
        ? name.charAt(0).toUpperCase()
        : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M12.5 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>}
    </div>
  );
}

// One report: what the citizen sent first, then the status steps, the history,
// and (tucked away) moving it to another office.
function ReportWindow({ id, departments, onClose, onUpdated, onMoved }) {
  const { dark } = useTheme();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [nextStatus, setNextStatus] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTo, setMoveTo] = useState('');
  const [moveReason, setMoveReason] = useState('');
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    api.get(`/staff/portal/submission/${id}`)
      .then(r => { setDetail(r.data); setNextStatus(r.data.status); })
      .catch(err => setLoadError(err.response?.data?.error || 'Could not load this report.'))
      .finally(() => setLoading(false));
  }, [id]);

  // Escape closes the window (the photo viewer handles its own Escape first).
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape' && lightboxIndex === null) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, lightboxIndex]);

  function addReply(text) {
    setNote(prev => {
      const current = prev.trim();
      if (!current) return text;
      return current.includes(text) ? current : `${current} ${text}`;
    });
  }

  async function saveStatus() {
    if (!detail || nextStatus === detail.status) return;
    setSaving(true);
    try {
      const res = await api.patch(`/staff/portal/submission/${detail.id}`, { status: nextStatus, note: note.trim() || undefined });
      setDetail(res.data);
      setNextStatus(res.data.status);
      setNote('');
      onUpdated(res.data);
      toast.success(`Saved as ${STATUS_LABEL[res.data.status]}. The citizen will see this update when they track the report.`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not save the update');
    } finally {
      setSaving(false);
    }
  }

  async function moveReport() {
    if (!moveTo || moveTo === detail.department) return;
    setMoving(true);
    try {
      await api.patch(`/staff/portal/assign/${detail.id}`, { department: moveTo, reason: moveReason.trim() || undefined });
      toast.success(`${noOffice ? 'Sent' : 'Moved'} to ${moveTo}`);
      onMoved(detail.id);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not move the report');
    } finally {
      setMoving(false);
    }
  }

  const citizenName = detail?.user?.fullName || '';
  const email = detail?.user?.email || detail?.email || '';
  const phone = detail?.contactNumber || '';
  const currentIndex = detail ? STEP_INDEX[detail.status] : 0;
  const changing = detail && nextStatus !== detail.status;
  const noOffice = detail?.department === 'UNASSIGNED';

  // Moving the report to another office (for a report with no office: sending it to one).
  function moveForm({ heading, onCancel }) {
    return (
      <div className="rounded-2xl border border-amber-200 dark:border-amber-500/40 bg-amber-50 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">{heading}</h3>
          {onCancel && (
            <button type="button" onClick={onCancel} className="text-sm font-semibold text-amber-900 dark:text-amber-200 hover:underline">
              Cancel
            </button>
          )}
        </div>
        {noOffice && (
          <p className="text-sm text-amber-900 dark:text-amber-200">
            The citizen didn't choose an office and the system couldn't tell which one it is for. Read it, then send it to the right office.
          </p>
        )}
        <select value={moveTo} onChange={e => setMoveTo(e.target.value)} aria-label={noOffice ? 'Office to send the report to' : 'Office to move the report to'}
          className="w-full px-3 py-2.5 border border-amber-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
          <option value="">Choose an office...</option>
          {departments.filter(d => d !== detail.department).map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <input type="text" value={moveReason} onChange={e => setMoveReason(e.target.value)} maxLength={500}
          aria-label="Reason (optional)"
          placeholder={noOffice ? 'Note (optional), e.g. this is about road repair' : 'Reason (optional), e.g. this is about road repair'}
          className="w-full px-3 py-2.5 border border-amber-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400" />
        {moveTo && (
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {noOffice ? <>It will go to <strong>{moveTo}</strong>.</> : <>It will leave your list and go to <strong>{moveTo}</strong>.</>} The move is saved in the audit log.
          </p>
        )}
        <button type="button" onClick={moveReport} disabled={!moveTo || moving}
          className="w-full py-2.5 bg-amber-600 text-white rounded-xl text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {moving ? 'Sending...' : noOffice ? 'Send report' : 'Move report'}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4" style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="report-window-title"
        className="ss-card bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {loading ? (
          <div className="p-6">
            <Skel className="h-3 w-40 mb-2" />
            <Skel className="h-6 w-64 mb-6" />
            <Skel className="h-12 w-full mb-4" />
            <Skel className="h-24 w-full mb-4" />
            <Skel className="h-40 w-full" />
          </div>
        ) : !detail ? (
          <div className="py-20 px-6 text-center">
            <h2 id="report-window-title" className="font-semibold text-gray-800">{loadError}</h2>
            <button type="button" onClick={onClose} className="mt-4 px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">Close</button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 sm:px-6 py-4 flex items-start justify-between gap-3 z-10">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className="font-mono text-xs font-semibold text-gray-600">{detail.trackingId}</span>
                  <TypeBadge type={detail.type} />
                  {detail.priority !== 'STANDARD' && <PriorityBadge priority={detail.priority} />}
                  <DeadlineBadge submission={detail} />
                </div>
                <h2 id="report-window-title" className="text-lg font-bold text-gray-900 line-clamp-2">
                  {TYPE_LABEL[detail.type] || 'Report'}{detail.address ? ` · ${detail.address}` : ''}
                </h2>
                <p className="text-xs text-gray-600 mt-0.5">
                  Received {formatDate(detail.createdAt)}{detail.dueAt ? ` · Resolve by ${formatDueDate(detail.dueAt, true)}` : ''}
                </p>
              </div>
              <button type="button" onClick={onClose} aria-label="Close"
                className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors flex-shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-6">
              {/* No office yet: sending it on is the first job */}
              {noOffice && <section>{moveForm({ heading: 'Send to the right office' })}</section>}

              {/* Who sent it */}
              <section>
                <h3 className={SECTION}>Citizen</h3>
                <div className="flex items-center gap-3">
                  <CitizenAvatar name={citizenName} />
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${citizenName ? 'text-gray-800' : 'text-gray-600 italic'}`}>{citizenName || 'Anonymous'}</p>
                    <p className="text-sm text-gray-600 flex flex-wrap gap-x-3 gap-y-0.5">
                      {email && <a href={`mailto:${email}`} className="text-blue-700 hover:underline break-all">{email}</a>}
                      {phone && <a href={`tel:${phone}`} className="text-blue-700 hover:underline">{phone}</a>}
                      {!email && !phone && 'No contact details given'}
                    </p>
                  </div>
                </div>
              </section>

              {/* What they reported */}
              <section>
                <h3 className={SECTION}>What they reported</h3>
                <p className="text-base text-gray-800 leading-relaxed whitespace-pre-wrap">{detail.description}</p>
                {detail.type === 'FEEDBACK' && (
                  <div className="mt-3">
                    <FeedbackRatingDisplay rating={detail.rating} reaction={detail.reaction} feedbackTags={detail.feedbackTags} />
                  </div>
                )}
              </section>

              {/* Photos */}
              <section>
                <h3 className={SECTION}>Photos {detail.media?.length > 0 && `(${detail.media.length})`}</h3>
                {detail.media?.length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {detail.media.map((m, i) => (
                      <button key={m.id} type="button" onClick={() => setLightboxIndex(i)} aria-label={`Open photo ${i + 1}`}
                        className="ss-photo relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                        <img src={mediaUrl(m.filePath)} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">No photos were attached.</p>
                )}
              </section>

              {/* Where */}
              {(detail.address || detail.location) && (
                <section>
                  <h3 className={SECTION}>Where</h3>
                  {detail.address && (
                    <p className="flex items-start gap-2 text-sm text-gray-800 mb-2">
                      <svg className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                      </svg>
                      {detail.address}
                    </p>
                  )}
                  {detail.location && (
                    <>
                      <ReportMiniMap latitude={detail.location.latitude} longitude={detail.location.longitude} type={detail.type} />
                      <a href={`https://www.google.com/maps?q=${detail.location.latitude},${detail.location.longitude}`} target="_blank" rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-blue-700 hover:bg-blue-50 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 20l-6-3V4l6 3 6-3 6 3v13l-6-3-6 3z" /><path d="M9 7v13M15 4v13" />
                        </svg>
                        Open in Google Maps
                      </a>
                    </>
                  )}
                </section>
              )}

              {/* Status steps */}
              <section className="rounded-2xl border border-gray-200 p-4 sm:p-5">
                <h3 className="text-base font-bold text-gray-900">Update the status</h3>
                <p className="text-sm text-gray-600 mt-0.5">Choose the step this report is at now.</p>
                <ol className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {STEPS.map((step, i) => {
                    const isCurrent = detail.status === step.key;
                    const isChosen = nextStatus === step.key;
                    const isDone = i < currentIndex;
                    const reached = isDone || isCurrent;
                    return (
                      <li key={step.key}>
                        <button type="button" onClick={() => setNextStatus(step.key)} aria-pressed={isChosen}
                          className={`w-full h-full text-left rounded-xl border-2 px-3 py-2.5 transition-colors ${
                            isChosen ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                          }`}>
                          <span className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                              style={reached
                                ? { background: STATUS_DOT[step.key], color: '#fff' }
                                : { background: dark ? '#334155' : '#e5e7eb', color: dark ? '#cbd5e1' : '#374151' }}>
                              {isDone
                                ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                                : i + 1}
                            </span>
                            <span className="text-sm font-semibold text-gray-800">{step.label}</span>
                          </span>
                          <span className={`block text-xs mt-1 ${isCurrent ? 'font-bold text-blue-700' : 'text-gray-600'}`}>
                            {isCurrent ? 'Now' : isDone ? 'Done' : step.hint}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>

                {changing ? (
                  <div className="mt-4 space-y-3">
                    <p className="text-sm text-gray-700">
                      Change from <strong>{STATUS_LABEL[detail.status]}</strong> to <strong>{STATUS_LABEL[nextStatus]}</strong>.
                      Add a note for the citizen (optional) — tap one to use it:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {QUICK_REPLIES[nextStatus].map(text => (
                        <button key={text} type="button" onClick={() => addReply(text)}
                          className="px-3 py-1.5 rounded-full border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 text-left transition-colors">
                          + {text}
                        </button>
                      ))}
                    </div>
                    <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} maxLength={1000}
                      aria-label="Note for the citizen"
                      placeholder="Write a short note, or tap a ready-made one above"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none" />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setNextStatus(detail.status); setNote(''); }} disabled={saving}
                        className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                        Cancel
                      </button>
                      <button type="button" onClick={saveStatus} disabled={saving}
                        className="flex-1 py-2.5 bg-blue-700 text-white text-sm font-semibold rounded-xl hover:bg-blue-800 disabled:opacity-50 transition-colors">
                        {saving ? 'Saving...' : `Save as ${STATUS_LABEL[nextStatus]}`}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-gray-600">
                    {detail.status === 'RESOLVED'
                      ? 'This report is resolved. Choose another step only if more work is needed.'
                      : 'When the work moves forward, choose the next step.'}
                  </p>
                )}
              </section>

              {/* History */}
              <section>
                <h3 className={SECTION}>History</h3>
                <ol className="border-l-2 border-gray-200 ml-1.5 space-y-4">
                  {(detail.statusLogs || []).map(log => (
                    <li key={log.id} className="relative pl-5">
                      <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full ring-2 ring-white dark:ring-slate-800" style={{ background: STATUS_DOT[log.status] }} aria-hidden="true" />
                      <p className="text-sm text-gray-800">
                        <span className="font-semibold">{log.updatedByName}</span> set it to <span className="font-semibold">{STATUS_LABEL[log.status]}</span>
                      </p>
                      <p className="text-xs text-gray-600">{formatDateTime(log.createdAt)}</p>
                      {log.note && <p className="text-sm text-gray-700 mt-1.5 bg-gray-50 rounded-lg px-3 py-2">“{log.note}”</p>}
                    </li>
                  ))}
                  <li className="relative pl-5">
                    <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full ring-2 ring-white dark:ring-slate-800 bg-gray-400" aria-hidden="true" />
                    <p className="text-sm text-gray-800">Report received</p>
                    <p className="text-xs text-gray-600">{formatDateTime(detail.createdAt)}</p>
                  </li>
                </ol>
              </section>

              {/* Move to another office */}
              {!noOffice && (
              <section>
                {!moveOpen ? (
                  <button type="button" onClick={() => setMoveOpen(true)}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300 hover:underline">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4M16 17H4m0 0l4 4m-4-4l4-4"/>
                    </svg>
                    Wrong office? Move this report
                  </button>
                ) : moveForm({ heading: 'Move to another office', onCancel: () => { setMoveOpen(false); setMoveTo(''); setMoveReason(''); } })}
              </section>
              )}
            </div>
          </>
        )}
      </div>

      {lightboxIndex !== null && detail?.media?.length > 0 && (
        <PhotoLightbox
          media={detail.media}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={delta => setLightboxIndex(i => (i + delta + detail.media.length) % detail.media.length)}
        />
      )}
    </div>
  );
}

function citizenLine(s) {
  return s.user?.fullName || 'Anonymous';
}

export default function StaffSubmissions() {
  const location = useLocation();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState('');
  const [typeFilter, setTypeFilter]   = useState('');
  const [sortBy, setSortBy]           = useState('');
  // Search words can come from the search box in the top bar.
  const [searchDraft, setSearchDraft] = useState(() => location.state?.search || '');
  const [search, setSearch]           = useState(() => location.state?.search || '');
  const [page, setPage]               = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const [total, setTotal]             = useState(0);
  const [counts, setCounts]           = useState(null);
  const [department, setDepartment]   = useState('');
  const [departments, setDepartments] = useState([]);
  // Opened from the dashboard, the To-do list or a notification.
  const [detailId, setDetailId]       = useState(() => location.state?.openId || null);
  const [freshIds, setFreshIds]       = useState(() => new Set());
  const known = useRef({ ids: null, at: 0 });
  const pageRef = useRef(1);
  const windowOpen = useRef(false);
  const gate = useSkeletonGate();
  pageRef.current = page;
  windowOpen.current = !!detailId;

  // Don't reopen the same report or repeat the search if the page is refreshed later.
  useEffect(() => {
    const passed = window.history.state?.usr;
    if (passed?.openId || passed?.search) window.history.replaceState({ ...window.history.state, usr: null }, '');
  }, []);

  useEffect(() => {
    api.get('/settings/public').then(r => setDepartments(r.data.departments || [])).catch(() => {});
  }, []);

  // Search runs on the server, a moment after typing stops.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchDraft.trim()), 350);
    return () => clearTimeout(t);
  }, [searchDraft]);

  // `quiet` refreshes keep the list on screen (no loading skeleton) and briefly
  // highlight reports that arrived since the last look.
  const fetchList = useCallback((p, { quiet = false } = {}) => {
    const params = new URLSearchParams({ page: p, limit: PAGE_SIZE });
    if (tab === 'OVERDUE') params.append('overdue', '1');
    else if (tab === 'UNASSIGNED') params.append('unassigned', '1');
    else if (tab) params.append('status', tab);
    if (typeFilter) params.append('type', typeFilter);
    if (sortBy) params.append('sortBy', sortBy);
    if (search) params.append('search', search);
    if (!quiet) setLoading(true);
    const request = Promise.all([
      api.get(`/staff/portal/submissions?${params}`),
      api.get(`/staff/portal/stats${typeFilter ? `?type=${typeFilter}` : ''}`),
    ]);
    return (quiet ? request : gate(request))
      .then(([list, stats]) => {
        const rows = list.data.submissions;
        if (quiet && known.current.ids) {
          const since = known.current.at - 60 * 1000;
          const fresh = rows.filter(r => !known.current.ids.has(r.id) && new Date(r.createdAt).getTime() > since).map(r => r.id);
          if (fresh.length) setFreshIds(new Set(fresh));
        }
        known.current = { ids: new Set(rows.map(r => r.id)), at: Date.now() };
        setSubmissions(rows);
        setTotal(list.data.total);
        setTotalPages(list.data.pages);
        setDepartment(list.data.department || '');
        setCounts(stats.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tab, typeFilter, sortBy, search, gate]);

  useEffect(() => { setPage(1); fetchList(1); }, [fetchList]);

  // New reports appear on their own: a quiet refresh every 30 seconds while the
  // page is on screen and no report is open.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && !windowOpen.current) fetchList(pageRef.current, { quiet: true });
    }, 30000);
    return () => clearInterval(timer);
  }, [fetchList]);

  useEffect(() => {
    if (!freshIds.size) return undefined;
    const t = setTimeout(() => setFreshIds(new Set()), 4500);
    return () => clearTimeout(t);
  }, [freshIds]);

  // The sidebar counts refresh when a report is updated or moved.
  const alertsChanged = () => window.dispatchEvent(new Event('civix:alerts-changed'));

  function handleUpdated(updated) {
    setSubmissions(prev => prev.map(s => (s.id === updated.id ? { ...s, ...updated } : s)));
    fetchList(page, { quiet: true });
    alertsChanged();
  }

  function handleMoved(id) {
    setSubmissions(prev => prev.filter(s => s.id !== id));
    fetchList(page, { quiet: true });
    alertsChanged();
  }

  function goToPage(p) {
    setPage(p);
    fetchList(p);
  }

  const closeWindow = useCallback(() => setDetailId(null), []);
  const filtering = !!(search || tab || typeFilter);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <style>{pageCss}</style>

      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Our Reports</h1>
        <p className="text-sm text-gray-600 mt-1">
          Reports sent to <strong className="text-gray-800">{department || 'your office'}</strong>. Open one to read it and update its status.
        </p>
      </div>

      {/* Status tabs with counts */}
      <div role="tablist" aria-label="Show reports by status" className="flex flex-wrap gap-2 mb-4">
        {TABS.filter(t => !t.receivingOnly || counts?.receivingOffice).map(t => {
          const active = tab === t.key;
          const n = counts ? t.count(counts) : null;
          return (
            <button key={t.key || 'ALL'} type="button" role="tab" aria-selected={active} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap border transition-colors ${
                active ? 'bg-blue-700 border-blue-700 text-white' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}>
              {t.label}
              {n !== null && (
                <span className={`min-w-[22px] px-1.5 py-0.5 rounded-full text-xs font-bold text-center ${
                  active ? '' : t.alert && n > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                }`} style={active ? { background: '#ffffff', color: '#1d4ed8' } : undefined}>
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Search, type and order */}
        <div className="px-4 sm:px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3">
          <label className="relative flex-1 min-w-0">
            <span className="sr-only">Search reports</span>
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="search" value={searchDraft} onChange={e => setSearchDraft(e.target.value)}
              placeholder="Search by ID, words, name or place"
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </label>
          <div className="flex gap-3">
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} aria-label="Type of report"
              className="flex-1 sm:flex-none min-w-0 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All types</option>
              <option value="COMPLAINT">Complaints</option>
              <option value="SUGGESTION">Suggestions</option>
              <option value="FEEDBACK">Feedback</option>
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} aria-label="Order"
              className="flex-1 sm:flex-none min-w-0 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="overflow-x-auto"><SkeletonTable cols={5} rows={8} /></div>
        ) : submissions.length === 0 ? (
          <div className="py-14 px-6 text-center">
            <svg className="w-10 h-10 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
            </svg>
            <p className="font-semibold text-gray-800">{filtering ? 'No reports match' : 'No reports yet'}</p>
            <p className="text-sm text-gray-600 mt-1">
              {filtering ? 'Try another tab, or clear the search.' : 'Reports sent to your office will appear here.'}
            </p>
          </div>
        ) : (
          <>
            {/* Computer: a table, any part of a row opens the report */}
            <table className="hidden lg:table w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-600 uppercase">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold">Report</th>
                  <th className="px-4 py-3 text-left font-semibold">Citizen</th>
                  <th className="px-4 py-3 text-left font-semibold">Deadline</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Received</th>
                  <th className="w-10"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {submissions.map(s => (
                  <tr key={s.id} onClick={() => setDetailId(s.id)}
                    className={`cursor-pointer hover:bg-gray-50 transition-colors ${freshIds.has(s.id) ? 'ss-new' : ''}`}>
                    <td className="px-5 py-3.5 w-full max-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button type="button" onClick={e => { e.stopPropagation(); setDetailId(s.id); }}
                          aria-label={`Open report ${s.trackingId}`}
                          className="font-mono text-xs font-semibold text-gray-700 hover:text-blue-700 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                          {s.trackingId}
                        </button>
                        <TypeBadge type={s.type} />
                        {s.priority === 'URGENT' && <PriorityBadge priority="URGENT" />}
                      {s.department === 'UNASSIGNED' && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 dark:text-amber-200">No office yet</span>}
                        {s.department === 'UNASSIGNED' && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 dark:text-amber-200">No office yet</span>}
                        {freshIds.has(s.id) && <span className="text-xs font-bold text-blue-700">New</span>}
                      </div>
                      <p className="text-sm text-gray-800 mt-1 truncate">{s.description}</p>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <p className={`text-sm font-semibold ${s.user?.fullName ? 'text-gray-800' : 'text-gray-600 italic'}`}>{citizenLine(s)}</p>
                      <p className="text-xs text-gray-600">{s.user?.email || s.contactNumber || 'No contact'}</p>
                    </td>
                    <td className="px-4 py-3.5"><DeadlineBadge submission={s} showDate /></td>
                    <td className="px-4 py-3.5 whitespace-nowrap"><StatusBadge status={s.status} /></td>
                    <td className="px-4 py-3.5 text-xs text-gray-600 whitespace-nowrap">{formatDate(s.createdAt)}</td>
                    <td className="pr-4 text-gray-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Phone and tablet: one card per report */}
            <ul className="lg:hidden divide-y divide-gray-100">
              {submissions.map(s => (
                <li key={s.id} className={freshIds.has(s.id) ? 'ss-new' : ''}>
                  <button type="button" onClick={() => setDetailId(s.id)} className="w-full text-left px-4 py-4 hover:bg-gray-50 transition-colors">
                    <span className="flex items-start justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-gray-700 pt-1">{s.trackingId}</span>
                      <StatusBadge status={s.status} />
                    </span>
                    <span className="flex items-center gap-2 flex-wrap mt-2">
                      <TypeBadge type={s.type} />
                      {s.priority === 'URGENT' && <PriorityBadge priority="URGENT" />}
                      <DeadlineBadge submission={s} />
                    </span>
                    <span className="block text-[15px] text-gray-800 mt-2 line-clamp-2">{s.description}</span>
                    <span className="block text-xs text-gray-600 mt-1.5">{citizenLine(s)} · Received {formatDate(s.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>

            {/* Pages */}
            <div className="px-4 sm:px-5 py-4 border-t border-gray-100 flex justify-between items-center gap-3">
              <p className="text-sm text-gray-600">Page {page} of {totalPages} · {plural(total, 'report')}</p>
              <div className="flex gap-2">
                <button type="button" disabled={page <= 1} onClick={() => goToPage(page - 1)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 disabled:opacity-40 hover:bg-gray-50 transition-colors">
                  ← Prev
                </button>
                <button type="button" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 disabled:opacity-40 hover:bg-gray-50 transition-colors">
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {detailId && (
        <ReportWindow id={detailId} departments={departments} onClose={closeWindow} onUpdated={handleUpdated} onMoved={handleMoved} />
      )}
    </div>
  );
}
