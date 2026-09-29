import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useLocation } from 'react-router-dom';
import CitizenPortalLayout from '../../components/common/CitizenPortalLayout';
import { StatusBadge, TypeBadge, PriorityBadge } from '../../components/common/StatusBadge';
import FeedbackRatingDisplay from '../../components/common/FeedbackRatingDisplay';
import { Skel } from '../../components/common/Skeleton';
import Icon from '../../components/common/Icons';
import { useTheme } from '../../context/ThemeContext';
import api from '../../utils/api';
import { mediaUrl } from '../../utils/mediaUrl';

const fadeCss = `
@keyframes trackFadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
.track-fade-0 { animation: trackFadeUp .45s .02s cubic-bezier(.22,1,.36,1) both; }
.track-fade-1 { animation: trackFadeUp .45s .08s cubic-bezier(.22,1,.36,1) both; }
.track-fade-2 { animation: trackFadeUp .45s .14s cubic-bezier(.22,1,.36,1) both; }

@keyframes lbOverlayIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes lbImageIn {
  0%   { opacity: 0; transform: scale(0.9); }
  60%  { opacity: 1; transform: scale(1.02); }
  100% { opacity: 1; transform: scale(1); }
}
.lb-overlay { animation: lbOverlayIn .2s ease both; }
.lb-image { animation: lbImageIn .32s cubic-bezier(.22,1,.36,1) both; }
.lb-btn { transition: background .2s ease, transform .2s ease; }
.lb-btn:hover { background: rgba(255,255,255,0.2); }
.lb-nav:hover { background: rgba(255,255,255,0.2); transform: translateY(-50%) scale(1.08); }

@keyframes trkPulse { 0% { box-shadow: 0 0 0 0 rgba(37,99,235,.45); } 100% { box-shadow: 0 0 0 10px rgba(37,99,235,0); } }
.trk-pulse { animation: trkPulse 1.6s ease-out infinite; }
/* Checkerboard behind photos so transparent or blank images still read as images */
.trk-checker {
  background-color: #fff;
  background-image: linear-gradient(45deg,#eef2f7 25%,transparent 25%), linear-gradient(-45deg,#eef2f7 25%,transparent 25%),
    linear-gradient(45deg,transparent 75%,#eef2f7 75%), linear-gradient(-45deg,transparent 75%,#eef2f7 75%);
  background-size: 14px 14px; background-position: 0 0, 0 7px, 7px -7px, -7px 0;
}
@media (prefers-reduced-motion: reduce) { .trk-pulse { animation: none; } }

/* Check Status button: label slides out, a white spinner slides in, a light sweep
   crosses the button. Same motion as the Sign In button. */
.tk-btn { position: relative; overflow: hidden; isolation: isolate; }
.tk-btn::after {
  content: ''; position: absolute; inset: 0; z-index: -1; opacity: 0; transform: translateX(-100%);
  background: linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.28) 50%, transparent 75%);
}
.tk-btn.is-loading { cursor: progress; }
.tk-btn.is-loading::after { opacity: 1; animation: tk-sweep 1.4s ease-in-out infinite; }
.tk-labels { display: grid; place-items: center; }
.tk-label { grid-area: 1 / 1; display: inline-flex; align-items: center; gap: .5rem; transition: transform .35s cubic-bezier(.2,.8,.2,1), opacity .25s ease; }
.tk-label-loading { transform: translateY(130%); opacity: 0; }
.tk-btn.is-loading .tk-label-idle { transform: translateY(-130%); opacity: 0; }
.tk-btn.is-loading .tk-label-loading { transform: none; opacity: 1; }
.tk-spinner { width: 18px; height: 18px; }
.tk-spinner-arc { stroke-dasharray: 1, 150; stroke-dashoffset: 0; }
.tk-btn.is-loading .tk-spinner { animation: tk-rotate .9s linear infinite; }
.tk-btn.is-loading .tk-spinner-arc { animation: tk-dash 1.4s ease-in-out infinite; }
@keyframes tk-sweep { 0% { transform: translateX(-100%); } 60%, 100% { transform: translateX(100%); } }
@keyframes tk-rotate { to { transform: rotate(360deg); } }
@keyframes tk-dash {
  0%   { stroke-dasharray: 1, 150;  stroke-dashoffset: 0; }
  50%  { stroke-dasharray: 90, 150; stroke-dashoffset: -35; }
  100% { stroke-dasharray: 90, 150; stroke-dashoffset: -124; }
}
@media (prefers-reduced-motion: reduce) {
  .tk-btn.is-loading::after, .tk-btn.is-loading .tk-spinner-arc { animation: none; }
  .tk-spinner-arc { stroke-dasharray: 60, 150; }
  .tk-btn.is-loading .tk-spinner { animation-duration: 1.6s; }
}
`;

// Keep the button's loading animation visible briefly even when the lookup is
// instant; failures (not found) still show immediately.
const MIN_LOOKUP_MS = 700;
function withMinDuration(promise) {
  const wait = new Promise(resolve => setTimeout(resolve, MIN_LOOKUP_MS));
  return Promise.all([promise, wait]).then(([result]) => result);
}

// Per-status look for the banner, strip and history dots. Messages match the
// wording shown to staff and on the Guidelines page.
const STATUS_TONE = {
  PENDING: {
    color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb', darkBg: 'rgba(148,163,184,0.10)', darkBorder: 'rgba(148,163,184,0.25)',
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', title: 'Received',
    message: 'Your submission has been received and is awaiting review.',
  },
  REVIEWING: {
    color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', darkBg: 'rgba(37,99,235,0.10)', darkBorder: 'rgba(37,99,235,0.35)',
    icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z', title: 'Under review',
    message: 'Your submission is currently being reviewed by the concerned office.',
  },
  IN_PROGRESS: {
    color: '#d97706', bg: '#fffbeb', border: '#fde68a', darkBg: 'rgba(245,158,11,0.10)', darkBorder: 'rgba(245,158,11,0.35)',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z', title: 'Being worked on',
    message: 'The concerned office is actively working on your submission.',
  },
  RESOLVED: {
    color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', darkBg: 'rgba(22,163,74,0.10)', darkBorder: 'rgba(22,163,74,0.35)',
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', title: 'Resolved',
    message: 'Your submission has been resolved. Thank you for your feedback!',
  },
};

const fmtDate = d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const fmtDateTime = d => new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

function PhotoTile({ src, index, onOpen }) {
  const [failed, setFailed] = useState(false);
  return (
    <button type="button" onClick={onOpen} disabled={failed}
      className="group relative aspect-square overflow-hidden rounded-xl border border-gray-200 hover:shadow-md transition-shadow trk-checker disabled:cursor-default">
      {failed ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-gray-50 text-gray-400">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-[10px] font-medium">Image unavailable</span>
        </div>
      ) : (
        <>
          <img src={src} alt={`Attached photo ${index + 1}`} onError={() => setFailed(true)}
            className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
            <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /><path d="M10 7v6M7 10h6" />
            </svg>
          </div>
        </>
      )}
      <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-black/55 text-white">Photo {index + 1}</span>
    </button>
  );
}

function Lightbox({ media, index, onClose, onNavigate }) {
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
    <div className="lb-overlay fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <button type="button" onClick={onClose} aria-label="Close"
        className="lb-btn absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-white">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {media.length > 1 && (
        <>
          <button type="button" onClick={e => { e.stopPropagation(); onNavigate(-1); }} aria-label="Previous"
            className="lb-nav absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button type="button" onClick={e => { e.stopPropagation(); onNavigate(1); }} aria-label="Next"
            className="lb-nav absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      <img key={item.id} src={mediaUrl(item.filePath)} alt="attachment"
        className="lb-image max-w-full max-h-[80vh] rounded-xl shadow-2xl object-contain"
        onClick={e => e.stopPropagation()} />

      {media.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold text-white"
          style={{ background: 'rgba(255,255,255,0.15)' }}>
          {index + 1} / {media.length}
        </div>
      )}
    </div>
  );
}

const STATUS_STEPS = [
  { key: 'PENDING',     label: 'Submitted' },
  { key: 'REVIEWING',   label: 'Reviewing' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'RESOLVED',    label: 'Resolved' },
];

// Four-stage stepper. Each stage shows when it was reached (from the status log);
// stages the office skipped have no date. Resolved turns the whole track green.
function ProgressTimeline({ result }) {
  const { dark } = useTheme();
  const idx = STATUS_STEPS.findIndex(s => s.key === result.status);
  const resolved = result.status === 'RESOLVED';
  const accent = resolved ? '#16a34a' : '#2563eb';
  const inactiveLine = dark ? '#334155' : '#e5e7eb';
  // statusLogs arrive newest-first; the oldest matching entry is when the stage was first reached.
  const reachedAt = key => key === 'PENDING'
    ? result.createdAt
    : [...(result.statusLogs || [])].reverse().find(l => l.status === key)?.createdAt;

  return (
    <div className="flex items-start">
      {STATUS_STEPS.map((s, i) => {
        const complete = i < idx || resolved;
        const current = i === idx && !resolved;
        const at = i <= idx ? reachedAt(s.key) : null;
        return (
          <React.Fragment key={s.key}>
            <div className="flex flex-col items-center w-16 sm:w-20 flex-shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${current ? 'trk-pulse' : ''}`}
                style={complete || current
                  ? { background: accent, borderColor: accent, color: 'white' }
                  : { background: dark ? '#1e293b' : 'white', borderColor: inactiveLine, color: dark ? '#475569' : '#9ca3af' }}>
                {complete ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                ) : i + 1}
              </div>
              <p className="text-[11px] sm:text-xs mt-1.5 font-semibold text-center leading-tight"
                style={{ color: complete || current ? accent : (dark ? '#64748b' : '#9ca3af') }}>
                {s.label}
              </p>
              <p className="text-[10px] mt-0.5 text-gray-400 h-3">{at ? fmtDate(at).replace(/, \d{4}$/, '') : ''}</p>
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <div className="flex-1 h-1 mt-3.5 rounded-full transition-all"
                style={{ background: i < idx || resolved ? accent : inactiveLine }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function Track() {
  const { dark } = useTheme();
  const routerLocation = useLocation();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [lightboxIndex, setLightboxIndex] = useState(null);

  useEffect(() => {
    const prefill = routerLocation.state?.prefill;
    if (!prefill) return;
    setCode(prefill);
    setLoading(true);
    setError('');
    withMinDuration(api.get(`/submissions/track/${prefill.trim().toUpperCase()}`))
      .then(res => setResult(res.data))
      .catch(err => {
        if (err.response?.status === 404) {
          setError('No submission found with that Transaction Code. Please double-check and try again.');
        } else {
          setError('Could not reach the server. Please try again later.');
        }
      })
      .finally(() => setLoading(false));
  }, []); // runs once on mount to handle prefill from Submit page

  async function lookupCode(overrideCode) {
    const target = (overrideCode || code).trim().toUpperCase();
    if (!target) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await withMinDuration(api.get(`/submissions/track/${target}`));
      setResult(res.data);
    } catch (err) {
      if (err.response?.status === 404) {
        setError('No submission found with that Transaction Code. Please double-check and try again.');
      } else {
        setError('Could not reach the server. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    lookupCode();
  }

  function copyTrackingId(id) {
    navigator.clipboard.writeText(id)
      .then(() => toast.success('Tracking code copied!'))
      .catch(() => toast.error('Could not copy to clipboard'));
  }

  return (
    <CitizenPortalLayout>
      <style>{fadeCss}</style>
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="track-fade-0 mb-5 bg-blue-50 border border-blue-100 rounded-2xl px-6 py-5 flex items-start gap-4">
          <div className="p-2.5 rounded-xl bg-blue-600 text-white flex-shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-800">Track Your Report</h1>
            <p className="text-gray-500 text-sm mt-0.5">Enter the Transaction Code you received after submission to view the real-time status.</p>
          </div>
        </div>

        {/* Search box */}
        <form onSubmit={handleSubmit} className="track-fade-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6 transition-shadow hover:shadow-md">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Transaction Code</label>
          <div className="flex gap-3">
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. ENG-20240527-0001"
              className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono tracking-wider outline-none transition-all focus:ring-2 focus:bg-white hover:border-primary"
              style={{ '--tw-ring-color': '#2563eb' }}
              spellCheck={false}
            />
            <button type="submit" disabled={loading || !code.trim()} aria-busy={loading}
              className={`tk-btn px-6 py-2.5 rounded-xl font-semibold text-sm text-white transition-colors bg-primary flex items-center justify-center ${loading ? 'is-loading' : 'hover:bg-blue-700'} ${!loading && !code.trim() ? 'opacity-50' : ''}`}>
              <span className="tk-labels">
                <span className="tk-label tk-label-idle" aria-hidden={loading}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
                  </svg>
                  Check Status
                </span>
                <span className="tk-label tk-label-loading" aria-hidden={!loading}>
                  <svg className="tk-spinner" viewBox="0 0 50 50" aria-hidden="true">
                    <circle cx="25" cy="25" r="20" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="5" />
                    <circle className="tk-spinner-arc" cx="25" cy="25" r="20" fill="none" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" />
                  </svg>
                  <span className="sr-only">Checking status</span>
                </span>
              </span>
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">Format: DEPT-YYYYMMDD-XXXX (e.g. ENG-20240527-0001)</p>
        </form>

        {/* Error */}
        {error && (
          <div className="track-fade-1 flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-6">
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="track-fade-2 bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
            <Skel className="h-1.5 w-full" />
            <div className="p-6">
              <div className="flex justify-between items-start gap-3 flex-wrap mb-3">
                <div className="flex-1 min-w-0">
                  <Skel className="h-4 w-40 mb-3" />
                  <Skel className="h-5 w-56" />
                </div>
                <Skel className="h-6 w-20" />
              </div>
              <Skel className="h-10 w-full mb-4" />
              <Skel className="h-12 w-full mb-5" />
              <Skel className="h-3 w-full mb-2" />
              <Skel className="h-3 w-full mb-2" />
              <Skel className="h-3 w-2/3" />
            </div>
          </div>
        )}

        {/* Result */}
        {result && (() => {
          const tone = STATUS_TONE[result.status] || STATUS_TONE.PENDING;
          const latestNote = result.statusLogs?.find(l => l.status === result.status && l.note)?.note;
          // statusLogs are newest-first; the submission itself is the oldest event.
          const history = [
            ...(result.statusLogs || []).map(l => ({ key: `${l.status}-${l.createdAt}`, status: l.status, at: l.createdAt, note: l.note })),
            { key: 'submitted', status: null, at: result.createdAt, note: null },
          ];
          const office = result.department && result.department !== 'UNASSIGNED' ? result.department : 'Not yet assigned';
          const sectionTitle = 'text-xs font-bold text-gray-500 uppercase tracking-wide mb-3';
          return (
            <div className="track-fade-2 bg-white rounded-2xl border border-gray-100 overflow-hidden"
              style={{ boxShadow: '0 2px 4px rgba(15,23,42,0.03), 0 12px 32px -12px rgba(15,23,42,0.16)' }}>
              <div className="h-1.5 w-full" style={{ background: tone.color }} />

              {/* Header */}
              <div className="px-5 sm:px-6 pt-5 pb-5 border-b border-gray-100">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Transaction code</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-lg sm:text-xl font-bold text-gray-900 tracking-wide break-all">{result.trackingId}</span>
                      <button type="button" onClick={() => copyTrackingId(result.trackingId)} title="Copy tracking code" aria-label="Copy tracking code"
                        className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 hover:text-gray-700 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                        </svg>
                        Copy
                      </button>
                    </div>
                  </div>
                  <StatusBadge status={result.status} />
                </div>
                <h3 className="font-bold text-gray-900 text-lg mt-3">{office}</h3>
                <div className="flex items-center gap-2 flex-wrap mt-2">
                  <TypeBadge type={result.type} />
                  <PriorityBadge priority={result.priority} />
                </div>
              </div>

              <div className="px-5 sm:px-6 py-5 space-y-6">
                {/* Progress */}
                <ProgressTimeline result={result} />

                {/* Status banner, with the office's latest note */}
                <div className="flex items-start gap-3 rounded-xl px-4 py-3.5 border"
                  style={{ background: dark ? tone.darkBg : tone.bg, borderColor: dark ? tone.darkBorder : tone.border }}>
                  <span className="w-9 h-9 rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: tone.color }}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={tone.icon} /></svg>
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-sm" style={{ color: tone.color }}>{tone.title}</p>
                    <p className="text-sm text-gray-700 mt-0.5">{tone.message}</p>
                    {latestNote && (
                      <div className="mt-2.5 rounded-lg bg-white/80 border border-white px-3 py-2">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Note from the concerned office</p>
                        <p className="text-sm text-gray-800 mt-0.5">{latestNote}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Details */}
                <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'Location', value: result.address || 'Not specified', icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z' },
                    { label: 'Filed', value: fmtDateTime(result.createdAt), icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
                    { label: 'Last updated', value: fmtDateTime(result.updatedAt), icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
                  ].map(d => (
                    <div key={d.label} className="rounded-xl bg-gray-50 px-3.5 py-3">
                      <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d.icon} /></svg>
                        {d.label}
                      </dt>
                      <dd className="text-sm font-semibold text-gray-800 mt-1 break-words">{d.value}</dd>
                    </div>
                  ))}
                </dl>

                {/* Description */}
                <div>
                  <h4 className={sectionTitle}>Description</h4>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line break-words rounded-xl border-l-4 border-gray-200 bg-gray-50/70 px-4 py-3">
                    {result.description}
                  </p>
                </div>

                {/* Feedback panel */}
                {result.type === 'FEEDBACK' && (result.rating || result.reaction) && (
                  <div className="p-3 bg-green-50 rounded-xl border border-green-100">
                    <FeedbackRatingDisplay rating={result.rating} reaction={result.reaction} feedbackTags={result.feedbackTags} />
                  </div>
                )}

                {/* Photos */}
                {result.media?.length > 0 && (
                  <div>
                    <h4 className={sectionTitle}>Attached photos ({result.media.length})</h4>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
                      {result.media.map((m, i) => (
                        <PhotoTile key={m.id} src={mediaUrl(m.filePath)} index={i} onOpen={() => setLightboxIndex(i)} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Activity history */}
                <div>
                  <h4 className={sectionTitle}>Activity history</h4>
                  <ol className="relative">
                    {history.map((h, i) => {
                      const t = h.status ? STATUS_TONE[h.status] : null;
                      const last = i === history.length - 1;
                      return (
                        <li key={h.key} className="relative flex gap-3 pb-4 last:pb-0">
                          {!last && <span className="absolute left-[7px] top-4 bottom-0 w-0.5 bg-gray-100" aria-hidden="true" />}
                          <span className="relative mt-1 w-4 h-4 rounded-full border-[3px] border-white flex-shrink-0"
                            style={{ background: t ? t.color : '#9ca3af', boxShadow: '0 0 0 1px #e5e7eb' }} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {h.status ? <StatusBadge status={h.status} /> : <span className="text-sm font-semibold text-gray-800">Report submitted</span>}
                              <span className="text-xs text-gray-400">{fmtDateTime(h.at)}</span>
                            </div>
                            {h.note && <p className="text-sm text-gray-700 mt-1.5 rounded-lg bg-gray-50 px-3 py-2">{h.note}</p>}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Empty state */}
        {!result && !error && !loading && (
          <div className="track-fade-2 text-center py-12 px-4 text-gray-400">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 mb-4">
              <Icon name="inbox" className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-500">Enter your Transaction Code above to check the status of your submission.</p>
            <p className="text-xs mt-1.5">Your code is shown right after you submit, and it is in the confirmation email we send you.</p>
          </div>
        )}
      </div>

      {lightboxIndex !== null && result?.media?.length > 0 && (
        <Lightbox
          media={result.media}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={delta => setLightboxIndex(i => (i + delta + result.media.length) % result.media.length)}
        />
      )}
    </CitizenPortalLayout>
  );
}
