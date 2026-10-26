import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { StatusBadge, TypeBadge, PriorityBadge, SentimentBadge } from '../../components/common/StatusBadge';
import FeedbackRatingDisplay from '../../components/common/FeedbackRatingDisplay';
import DeadlineBadge, { formatDueDate } from '../../components/common/DeadlineBadge';
import { SkeletonDetail } from '../../components/common/Skeleton';
import Icon from '../../components/common/Icons';
import PhotoViewer from '../../components/common/PhotoViewer';
import api from '../../utils/api';
import { mediaUrl } from '../../utils/mediaUrl';
import { PRIORITY_LABEL, URGENCY_REASON_LABEL, urgencyWords, quoteWords } from '../../data/urgency';

const STEP_ORDER = ['PENDING', 'REVIEWING', 'IN_PROGRESS', 'RESOLVED'];
const STATUS_LABEL = { PENDING: 'Pending', REVIEWING: 'Reviewing', IN_PROGRESS: 'In Progress', RESOLVED: 'Resolved', SPAM: 'Spam / Invalid' };
const STATUS_DOT = { PENDING: '#6B7280', REVIEWING: '#1D4ED8', IN_PROGRESS: '#a16207', RESOLVED: '#15803d', SPAM: '#475569' }; // white text on each ≥ 4.5:1
const whenText = d => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// The office's updates to this report, newest first, with the photos staff added as
// proof of the work. Moving a report forward to In Progress or Resolved needs a
// photo; one without (from before that rule) is pointed out.
function OfficeUpdates({ logs, onOpen }) {
  const photoCount = logs.reduce((n, l) => n + (l.photos?.length || 0), 0);
  return (
    <div className="mt-5 pt-5 border-t border-gray-100 dark:border-slate-700">
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-gray-800 dark:text-slate-100">Updates from the office</h4>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{count(logs.length, 'update')} · {count(photoCount, 'photo')}</p>
      </div>
      {logs.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-slate-400">No updates yet. The office hasn't changed this report's status.</p>
      ) : (
        <ol className="border-l-2 border-gray-200 dark:border-slate-600 ml-1.5 space-y-4">
          {logs.map((log, i) => {
            // Logs are newest first: logs[i + 1] is the update before this one.
            const before = logs[i + 1]?.status || 'PENDING';
            const progress = i < logs.length - 1 && before === log.status;
            const forward = STEP_ORDER.indexOf(log.status) > STEP_ORDER.indexOf(before);
            const caption = `${log.updatedByName} · ${whenText(log.createdAt)}`;
            return (
              <li key={log.id} className="relative pl-4">
                <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full ring-2 ring-white dark:ring-slate-800" style={{ background: STATUS_DOT[log.status] }} aria-hidden="true" />
                <p className="text-xs text-gray-800 dark:text-slate-100">
                  <span className="font-semibold">{log.updatedByName}</span>{' '}
                  {progress ? 'added progress photos' : <>set it to <span className="font-semibold">{STATUS_LABEL[log.status] || log.status}</span></>}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-slate-400">{whenText(log.createdAt)}</p>
                {log.note && <p className="mt-1 text-xs text-gray-700 dark:text-slate-300 bg-gray-50 dark:bg-slate-900/40 rounded-lg px-2.5 py-1.5">“{log.note}”</p>}
                {log.photos?.length > 0 && (
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {log.photos.map((p, k) => (
                      <button key={p.id} type="button" onClick={() => onOpen({ photos: log.photos, index: k, caption })}
                        aria-label={`Open photo ${k + 1} of ${log.photos.length} from ${log.updatedByName}`}
                        className="aspect-square rounded-md overflow-hidden border border-gray-200 dark:border-slate-600 hover:opacity-85 transition-opacity">
                        <img src={mediaUrl(p.filePath)} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
                {forward && ['IN_PROGRESS', 'RESOLVED'].includes(log.status) && !log.photos?.length && (
                  <p className="mt-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">No photo attached</p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

// Changes the office's staff made to how urgent the report is, newest first, with the
// reason the citizen was given and the finish-by date before and after.
const URGENCY_DOT = { URGENT: '#b91c1c', STANDARD: '#1D4ED8', LOW: '#475569' };
const shortDate = d => new Date(d).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' });
function UrgencyChanges({ changes }) {
  if (!changes.length) return null;
  return (
    <div className="mt-5 pt-5 border-t border-gray-100 dark:border-slate-700">
      <h4 className="text-sm font-semibold text-gray-800 dark:text-slate-100 mb-3">Urgency changes</h4>
      <ol className="border-l-2 border-gray-200 dark:border-slate-600 ml-1.5 space-y-4">
        {changes.map(c => (
          <li key={c.id} className="relative pl-4">
            <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full ring-2 ring-white dark:ring-slate-800" style={{ background: URGENCY_DOT[c.toPriority] }} aria-hidden="true" />
            <p className="text-xs text-gray-800 dark:text-slate-100">
              <span className="font-semibold">{c.changedByName}</span> changed it from{' '}
              <span className="font-semibold">{PRIORITY_LABEL[c.fromPriority]}</span> to <span className="font-semibold">{PRIORITY_LABEL[c.toPriority]}</span>
            </p>
            <p className="text-[11px] text-gray-600 dark:text-slate-300">
              {whenText(c.createdAt)}
              {c.toDueAt && <> · finish by {shortDate(c.toDueAt)}{c.fromDueAt && shortDate(c.fromDueAt) !== shortDate(c.toDueAt) ? ` (was ${shortDate(c.fromDueAt)})` : ''}</>}
            </p>
            <p className="mt-1 text-xs text-gray-700 dark:text-slate-300 bg-gray-50 dark:bg-slate-900/40 rounded-lg px-2.5 py-1.5">“{c.reason}”</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ConfidenceBadge({ confidence }) {
  const color = confidence >= 70 ? '#15803d' : confidence >= 40 ? '#b45309' : '#b91c1c';
  const bg    = confidence >= 70 ? '#dcfce7' : confidence >= 40 ? '#fef3c7' : '#fee2e2';
  return (
    <span className="text-xs font-bold px-2.5 py-1 rounded-full"
      style={{ color, background: bg }}>
      {confidence}% confidence
    </span>
  );
}

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SubmissionDetail() {
  const { id } = useParams();
  const [submission,  setSubmission]  = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [changeLogs,  setChangeLogs]  = useState([]);
  const [viewer,      setViewer]      = useState(null); // { photos, index, caption }
  const mapRef         = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    Promise.all([
      api.get(`/submissions/${id}`),
      api.get(`/classify/audit-log?limit=100`),
    ]).then(([sub, logs]) => {
      setSubmission(sub.data);
      // Filter logs for this submission
      const filtered = (logs.data.logs || []).filter(l => l.submissionId === id);
      setChangeLogs(filtered);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!submission?.location || !mapRef.current) return;
    let cancelled = false;
    const { latitude, longitude } = submission.location;

    import('leaflet').then(L => {
      if (cancelled || !mapRef.current) return;
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
      if (mapRef.current._leaflet_id) mapRef.current._leaflet_id = null;
      delete L.default.Icon.Default.prototype._getIconUrl;
      L.default.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
      const map = L.default.map(mapRef.current).setView([latitude, longitude], 15);
      L.default.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(map);
      L.default.marker([latitude, longitude]).addTo(map)
        .bindPopup(`<b>${submission.trackingId}</b><br>${submission.department}`).openPopup();
      mapInstanceRef.current = map;
      setTimeout(() => map.invalidateSize(), 100);
    });

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
    };
  }, [submission]);

  if (loading) return <div className="p-6 max-w-5xl mx-auto"><SkeletonDetail /></div>;
  if (!submission) return <div className="p-6 text-gray-500 dark:text-slate-400">Submission not found.</div>;

  // Feedback rates the municipality's service as a whole: no office, status steps or deadline.
  const isFeedback = submission.type === 'FEEDBACK';
  const ai = submission.aiClassification;
  const aiKeywords = ai?.matchedKeywords ? (() => { try { return JSON.parse(ai.matchedKeywords); } catch { return []; } })() : [];
  const aiMatchesFinal = ai && ai.predictedDepartment === submission.department;
  const citizenOverrode = ai && ai.citizenSelected && ai.citizenSelected !== ai.predictedDepartment;
  // How urgent the AI found a complaint, and the words that decided it.
  const aiUrgencyWords = urgencyWords(ai?.urgencyKeywords);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm text-gray-600 dark:text-slate-400">
        <Link to="/admin/submissions" className="hover:text-primary">Submissions</Link>
        <span>/</span>
        <span className="font-mono">{submission.trackingId}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left column ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Main info */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
            <div className="flex flex-wrap gap-2 mb-4">
              <TypeBadge type={submission.type} />
              {(!isFeedback || submission.status === 'SPAM') && <StatusBadge status={submission.status} />}
              {!isFeedback && <PriorityBadge priority={submission.priority} />}
              <SentimentBadge sentiment={submission.sentiment} />
            </div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100 mb-1">{isFeedback ? 'Feedback on our services' : submission.department}</h1>
            <p className="font-mono text-xs text-gray-500 dark:text-slate-400 mb-4">{submission.trackingId}</p>
            {submission.type === 'FEEDBACK' && (submission.rating || submission.reaction) && (
              <div className="mb-4">
                <FeedbackRatingDisplay rating={submission.rating} reaction={submission.reaction} feedbackTags={submission.feedbackTags} />
              </div>
            )}
            {submission.address && (
              <div className="bg-gray-50 dark:bg-slate-900/40 rounded-xl p-4 mb-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Complaint Address</h3>
                <p className="text-sm text-gray-600 dark:text-slate-400">{submission.address}</p>
              </div>
            )}
            <div className="bg-gray-50 dark:bg-slate-900/40 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Description</h3>
              <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed">{submission.description}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-slate-400">Submitted:</span>
                <span className="ml-2 font-medium">{new Date(submission.createdAt).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-slate-400">Updated:</span>
                <span className="ml-2 font-medium">{new Date(submission.updatedAt).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* ── AI Classification Panel ── */}
          {ai && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100 dark:border-slate-700 bg-gradient-to-r from-blue-50 to-sky-50 dark:from-blue-950/40 dark:to-slate-800">
                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                </svg>
                <h3 className="text-sm font-bold text-blue-800 dark:text-blue-300">AI Classification</h3>
                <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ background: aiMatchesFinal ? '#dcfce7' : '#fee2e2', color: aiMatchesFinal ? '#15803d' : '#b91c1c' }}>
                  {aiMatchesFinal ? '✓ Correct' : ai.adminCorrected ? '✗ Admin Corrected' : '⚠ Pending Review'}
                </span>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3">
                    <p className="text-xs text-blue-700 dark:text-blue-400 font-medium mb-1">AI Predicted</p>
                    <p className="text-xs font-bold text-gray-800 dark:text-slate-100 leading-snug">{ai.predictedDepartment}</p>
                    <div className="mt-1.5">
                      <ConfidenceBadge confidence={ai.confidence} />
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-900/40 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-1">
                      Citizen Selected
                      {citizenOverrode && (
                        <span className="ml-1 text-amber-700 dark:text-amber-400">(overrode AI)</span>
                      )}
                    </p>
                    <p className="text-xs font-bold text-gray-800 dark:text-slate-100 leading-snug">
                      {ai.citizenSelected || ai.predictedDepartment}
                    </p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3">
                    <p className="text-xs text-green-700 dark:text-green-400 font-medium mb-1">Final Assigned</p>
                    <p className="text-xs font-bold text-gray-800 dark:text-slate-100 leading-snug">{submission.department}</p>
                  </div>
                </div>

                {aiKeywords.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-1.5">Detected Keywords</p>
                    <div className="flex flex-wrap gap-1.5">
                      {aiKeywords.map(kw => (
                        <span key={kw} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs rounded-full">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* How urgent the AI found the complaint, from its description */}
                {ai.predictedPriority && (
                  <div className="pt-4 border-t border-gray-100 dark:border-slate-700" data-ai-urgency={ai.predictedPriority}>
                    <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-1.5">How urgent (set by AI)</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <PriorityBadge priority={ai.predictedPriority} />
                      {submission.priority !== ai.predictedPriority && (
                        <span className="text-xs font-medium text-amber-800 dark:text-amber-300">
                          The office changed it to {PRIORITY_LABEL[submission.priority]}
                        </span>
                      )}
                    </div>
                    {aiUrgencyWords.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {aiUrgencyWords.map(w => (
                          <span key={w} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs rounded-full">
                            {w}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Department Change History ── */}
          {changeLogs.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100 dark:border-slate-700 flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                </svg>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">Department Change History</h3>
                <span className="ml-auto text-xs text-gray-500 dark:text-slate-400">{changeLogs.length} change{changeLogs.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-slate-700">
                {changeLogs.map(log => (
                  <div key={log.id} className="px-5 py-3 flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                      {log.changedByName?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                        <span className="font-semibold text-gray-800 dark:text-slate-100">{log.changedByName}</span>
                        <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 rounded font-medium">{log.changedByRole}</span>
                        <span className="text-gray-500 dark:text-slate-400">{timeAgo(log.createdAt)}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-600 dark:text-slate-400">
                        <span className="px-2 py-0.5 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded">{log.fromDepartment}</span>
                        <svg className="w-3 h-3 text-gray-400 dark:text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                        </svg>
                        <span className="px-2 py-0.5 bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 rounded">{log.toDepartment}</span>
                      </div>
                      {log.reason && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-slate-400 italic">"{log.reason}"</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {submission.media?.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
              <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-3">Attached Photos</h3>
              <div className="grid grid-cols-3 gap-3">
                {submission.media.map(m => (
                  <a key={m.id} href={mediaUrl(m.filePath)} target="_blank" rel="noopener noreferrer">
                    <img src={mediaUrl(m.filePath)} alt="attachment"
                      className="w-full h-32 object-cover rounded-lg border border-gray-200 dark:border-slate-600 hover:opacity-80 transition-opacity" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {submission.location && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
              <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-3">Location</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-3 flex items-center gap-1">
                <Icon name="location" className="w-3.5 h-3.5 flex-shrink-0" />
                {submission.location.latitude.toFixed(5)}, {submission.location.longitude.toFixed(5)}
              </p>
              <div ref={mapRef} className="h-56 rounded-xl border border-gray-200 dark:border-slate-600 overflow-hidden" />
            </div>
          )}
        </div>

        {/* ── Right column ── */}
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
            <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-4">Citizen Information</h3>
            {submission.user ? (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-500 dark:text-slate-400 text-xs">Full Name</p>
                  <p className="font-medium mt-0.5">{submission.user.fullName}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-slate-400 text-xs">Citizen ID</p>
                  <p className="font-mono font-medium mt-0.5">{submission.user.citizenId}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-slate-400 text-xs">Email</p>
                  <p className="font-medium mt-0.5">{submission.user.email}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-500 dark:text-slate-400 text-xs">Full Name</p>
                  <p className="font-medium mt-0.5 italic text-gray-500 dark:text-slate-400">Anonymous submission</p>
                </div>
                {(submission.contactNumber || submission.email) && (
                  <div>
                    <p className="text-gray-500 dark:text-slate-400 text-xs">Contact Provided</p>
                    <p className="font-medium mt-0.5">{submission.contactNumber || submission.email}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Case status (view only: the assigned office's staff update reports) */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
            <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-4">Case Status</h3>
            <dl className="space-y-3.5 text-sm">
              {!isFeedback && <div className="flex items-center justify-between gap-3">
                <dt className="text-gray-500 dark:text-slate-400 text-xs">Status</dt>
                <dd><StatusBadge status={submission.status} /></dd>
              </div>}
              {!isFeedback && <div className="flex items-start justify-between gap-3">
                <dt className="text-gray-500 dark:text-slate-400 text-xs pt-1">Urgency</dt>
                <dd className="text-right">
                  <PriorityBadge priority={submission.priority} />
                  {/* How it was set: by the AI from the description (and why), or, for
                      complaints sent before Oct 16, 2026, by the citizen */}
                  {submission.type === 'COMPLAINT' && (() => {
                    if (ai?.predictedPriority) {
                      return (
                        <span className="block text-[11px] text-gray-600 dark:text-slate-300 mt-1">
                          Set by AI: {PRIORITY_LABEL[ai.predictedPriority]}{aiUrgencyWords.length ? ` (${quoteWords(aiUrgencyWords)})` : ''}
                        </span>
                      );
                    }
                    const changes = submission.urgencyChanges || [];
                    const chosen = changes.length ? changes[changes.length - 1].fromPriority : submission.priority;
                    const why = URGENCY_REASON_LABEL[submission.urgencyReason];
                    return (
                      <span className="block text-[11px] text-gray-600 dark:text-slate-300 mt-1">
                        Citizen chose {PRIORITY_LABEL[chosen]}{why ? `: ${why}` : ''}
                      </span>
                    );
                  })()}
                </dd>
              </div>}
              <div className="flex items-start justify-between gap-3">
                <dt className="text-gray-500 dark:text-slate-400 text-xs pt-0.5">Assigned office</dt>
                <dd className="font-medium text-right text-gray-800 dark:text-slate-100">
                  {submission.department === 'General' ? 'None (general feedback)' : submission.department}
                  {ai && ai.predictedDepartment !== submission.department && (
                    <span className="block text-[11px] font-normal text-blue-600 dark:text-blue-400 mt-0.5">AI suggested: {ai.predictedDepartment}</span>
                  )}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-gray-500 dark:text-slate-400 text-xs pt-0.5">Resolve by</dt>
                <dd className="text-right">
                  {submission.dueAt ? (
                    <>
                      <DeadlineBadge submission={submission} />
                      <span className="block text-xs text-gray-500 dark:text-slate-400 mt-1">{formatDueDate(submission.dueAt, true)}</span>
                    </>
                  ) : <span className="text-xs text-gray-500">No deadline</span>}
                </dd>
              </div>
            </dl>
            {!isFeedback && <OfficeUpdates logs={submission.statusLogs || []} onOpen={setViewer} />}
            {!isFeedback && <UrgencyChanges changes={submission.urgencyChanges || []} />}
            <p className="mt-5 flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-900/40 text-gray-500 dark:text-slate-400">
              <Icon name="citizens" className="w-4 h-4 mt-px flex-shrink-0" />
              {isFeedback
                ? "View only. Feedback rates the municipality's service as a whole, so no office acts on it."
                : "View only. The assigned office's staff update this report's status, urgency and office."}
            </p>
          </div>

          <SpamPanel submission={submission}
            onChanged={() => api.get(`/submissions/${id}`).then(r => setSubmission(r.data)).catch(() => {})} />
        </div>
      </div>
      {viewer && (
        <PhotoViewer photos={viewer.photos} index={viewer.index} caption={viewer.caption} alt="Photo of the work from the office"
          onIndex={index => setViewer(v => ({ ...v, index }))} onClose={() => setViewer(null)} />
      )}
    </div>
  );
}

// Spam / Invalid, for administrators: delete a report the office's staff marked as
// spam (only those can be deleted; the Audit Log keeps a record). Feedback goes to
// no office, so for feedback the administrator also marks it, or puts it back.
function SpamPanel({ submission, onChanged }) {
  const navigate = useNavigate();
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const isFeedback = submission.type === 'FEEDBACK';
  const isSpam = submission.status === 'SPAM';
  if (!isSpam && !isFeedback) return null;
  const spamLog = (submission.statusLogs || []).find(l => l.status === 'SPAM');
  const when = d => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

  async function setSpam(spam) {
    if (spam && !reason.trim()) return toast.error('Please say why this feedback is spam or invalid.');
    setBusy(true);
    try {
      await api.patch(`/submissions/${submission.id}/spam`, { spam, reason: reason.trim() });
      toast.success(spam ? 'Marked as spam / invalid. It left every list and count.' : 'Put back as feedback.');
      setReason('');
      onChanged();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not save the change');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api.delete(`/submissions/${submission.id}`);
      toast.success(`${submission.trackingId} was deleted. The Audit Log keeps a record.`);
      navigate(isFeedback ? '/admin/feedback' : '/admin/submissions');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not delete the report');
      setBusy(false);
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-5" aria-labelledby="spam-panel-title">
      {isSpam ? (
        <>
          <h3 id="spam-panel-title" className="text-sm font-bold text-gray-800 dark:text-slate-100">Marked as spam / invalid</h3>
          {spamLog && (
            <p className="text-sm text-gray-600 dark:text-slate-300 mt-1">
              By <strong className="text-gray-800 dark:text-slate-100">{spamLog.updatedByName}</strong>, {when(spamLog.createdAt)}.
            </p>
          )}
          {spamLog?.note && <p className="text-sm italic text-gray-700 dark:text-slate-200 mt-2 bg-slate-50 dark:bg-slate-900/40 rounded-lg px-3 py-2">“{spamLog.note}”</p>}
          {!confirming ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => setConfirming(true)}
                className="px-4 py-2 rounded-lg bg-red-700 text-white text-sm font-semibold hover:bg-red-800 transition-colors">
                Delete permanently
              </button>
              {isFeedback && (
                <button type="button" onClick={() => setSpam(false)} disabled={busy}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-sm font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors">
                  Not spam — put it back
                </button>
              )}
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-red-200 dark:border-red-500/40 bg-red-50 p-3" role="alert">
              <p className="text-sm font-semibold text-red-700">Delete {submission.trackingId} for good?</p>
              <p className="text-sm text-gray-700 dark:text-slate-200 mt-1">
                The report, its photos and its history are removed and can't be brought back. The Audit Log keeps a record of this deletion.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => setConfirming(false)} disabled={busy}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button type="button" onClick={remove} disabled={busy}
                  className="px-4 py-2 rounded-lg bg-red-700 text-white text-sm font-semibold hover:bg-red-800 disabled:opacity-50 transition-colors">
                  {busy ? 'Deleting...' : 'Yes, delete it'}
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <h3 id="spam-panel-title" className="text-sm font-bold text-gray-800 dark:text-slate-100">Spam or not real feedback?</h3>
          <p className="text-sm text-gray-600 dark:text-slate-300 mt-1">
            Feedback goes to no office, so administrators mark it. Marked feedback leaves every list and count, and can then be deleted.
          </p>
          <input type="text" value={reason} onChange={e => setReason(e.target.value)} maxLength={500}
            aria-label="Reason" placeholder="Reason (required), e.g. a test message"
            className="mt-3 w-full px-3 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
          <button type="button" onClick={() => setSpam(true)} disabled={!reason.trim() || busy}
            className="mt-2 w-full px-4 py-2 rounded-lg border border-red-300 dark:border-red-500/50 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {busy ? 'Saving...' : 'Mark as spam / invalid'}
          </button>
        </>
      )}
    </div>
  );
}
