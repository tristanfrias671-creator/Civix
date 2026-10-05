import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { StatusBadge, TypeBadge, PriorityBadge, SentimentBadge } from '../../components/common/StatusBadge';
import FeedbackRatingDisplay from '../../components/common/FeedbackRatingDisplay';
import DeadlineBadge, { formatDueDate } from '../../components/common/DeadlineBadge';
import { SkeletonDetail } from '../../components/common/Skeleton';
import Icon from '../../components/common/Icons';
import api from '../../utils/api';
import { mediaUrl } from '../../utils/mediaUrl';

function ConfidenceBadge({ confidence }) {
  const color = confidence >= 70 ? '#16a34a' : confidence >= 40 ? '#d97706' : '#dc2626';
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

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm text-gray-500 dark:text-slate-400">
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
              {!isFeedback && <StatusBadge status={submission.status} />}
              {!isFeedback && <PriorityBadge priority={submission.priority} />}
              <SentimentBadge sentiment={submission.sentiment} />
            </div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100 mb-1">{isFeedback ? 'Feedback on our services' : submission.department}</h1>
            <p className="font-mono text-xs text-gray-400 dark:text-slate-500 mb-4">{submission.trackingId}</p>
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
                <h3 className="text-sm font-bold text-blue-800 dark:text-blue-300">AI Department Classification</h3>
                <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ background: aiMatchesFinal ? '#dcfce7' : '#fee2e2', color: aiMatchesFinal ? '#16a34a' : '#dc2626' }}>
                  {aiMatchesFinal ? '✓ Correct' : ai.adminCorrected ? '✗ Admin Corrected' : '⚠ Pending Review'}
                </span>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3">
                    <p className="text-xs text-blue-500 dark:text-blue-400 font-medium mb-1">AI Predicted</p>
                    <p className="text-xs font-bold text-gray-800 dark:text-slate-100 leading-snug">{ai.predictedDepartment}</p>
                    <div className="mt-1.5">
                      <ConfidenceBadge confidence={ai.confidence} />
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-900/40 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-1">
                      Citizen Selected
                      {citizenOverrode && (
                        <span className="ml-1 text-amber-600">(overrode AI)</span>
                      )}
                    </p>
                    <p className="text-xs font-bold text-gray-800 dark:text-slate-100 leading-snug">
                      {ai.citizenSelected || ai.predictedDepartment}
                    </p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3">
                    <p className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">Final Assigned</p>
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
                <span className="ml-auto text-xs text-gray-400 dark:text-slate-500">{changeLogs.length} change{changeLogs.length !== 1 ? 's' : ''}</span>
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
                        <span className="text-gray-400 dark:text-slate-500">{timeAgo(log.createdAt)}</span>
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
              <p className="text-xs text-gray-400 dark:text-slate-500 mb-3 flex items-center gap-1">
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
                  <p className="font-medium mt-0.5 italic text-gray-400 dark:text-slate-500">Anonymous submission</p>
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
              {!isFeedback && <div className="flex items-center justify-between gap-3">
                <dt className="text-gray-500 dark:text-slate-400 text-xs">Priority</dt>
                <dd><PriorityBadge priority={submission.priority} /></dd>
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
                  ) : <span className="text-xs text-gray-400">No deadline</span>}
                </dd>
              </div>
            </dl>
            <p className="mt-5 flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-900/40 text-gray-500 dark:text-slate-400">
              <Icon name="citizens" className="w-4 h-4 mt-px flex-shrink-0" />
              {isFeedback
                ? "View only. Feedback rates the municipality's service as a whole, so no office acts on it."
                : "View only. The assigned office's staff update this report's status, priority and department."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
