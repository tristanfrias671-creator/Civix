import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useLocation } from 'react-router-dom';
import CitizenPortalLayout from '../../components/common/CitizenPortalLayout';
import { StatusBadge, TypeBadge, PriorityBadge } from '../../components/common/StatusBadge';
import FeedbackRatingDisplay from '../../components/common/FeedbackRatingDisplay';
import Spinner from '../../components/common/Spinner';
import { Skel } from '../../components/common/Skeleton';
import Icon from '../../components/common/Icons';
import { useTheme } from '../../context/ThemeContext';
import api from '../../utils/api';
import { mediaUrl } from '../../utils/mediaUrl';

const TYPE_SOLID = {
  COMPLAINT: '#dc2626',
  SUGGESTION: '#2563eb',
  FEEDBACK: '#16a34a',
};

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
`;

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

function ProgressTimeline({ status }) {
  const { dark } = useTheme();
  const idx = STATUS_STEPS.findIndex(s => s.key === status);
  const inactiveBg     = dark ? '#1e293b' : 'white';
  const inactiveBorder = dark ? '#334155' : '#e5e7eb';
  const inactiveText   = dark ? '#475569' : '#d1d5db';
  const inactiveLine   = dark ? '#334155' : '#e5e7eb';

  return (
    <div className="flex items-center gap-0 mt-4">
      {STATUS_STEPS.map((s, i) => (
        <React.Fragment key={s.key}>
          <div className="flex flex-col items-center">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all"
              style={i <= idx
                ? { background: '#2563eb', borderColor: '#2563eb', color: 'white' }
                : { background: inactiveBg, borderColor: inactiveBorder, color: inactiveText }}>
              {i < idx ? '✓' : i + 1}
            </div>
            <p className="text-xs mt-1 font-medium hidden sm:block"
              style={{ color: i <= idx ? '#2563eb' : (dark ? '#475569' : '#9ca3af') }}>
              {s.label}
            </p>
          </div>
          {i < STATUS_STEPS.length - 1 && (
            <div className="flex-1 h-0.5 mx-1 mb-5 rounded-full transition-all"
              style={{ background: i < idx ? '#2563eb' : inactiveLine }} />
          )}
        </React.Fragment>
      ))}
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
    api.get(`/submissions/track/${prefill.trim().toUpperCase()}`)
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
      const res = await api.get(`/submissions/track/${target}`);
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

  const TYPE_ACCENT = {
    COMPLAINT:  { border: '#fecaca', bg: '#fef2f2', darkBorder: 'rgba(220,38,38,0.35)', darkBg: 'rgba(220,38,38,0.08)' },
    SUGGESTION: { border: '#bfdbfe', bg: '#eff6ff', darkBorder: 'rgba(37,99,235,0.35)', darkBg: 'rgba(37,99,235,0.08)' },
    FEEDBACK:   { border: '#bbf7d0', bg: '#f0fdf4', darkBorder: 'rgba(22,163,74,0.35)', darkBg: 'rgba(22,163,74,0.08)' },
  };

  return (
    <CitizenPortalLayout>
      <style>{fadeCss}</style>
      <div className="max-w-2xl mx-auto">

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
            <button type="submit" disabled={loading || !code.trim()}
              className="px-6 py-2.5 rounded-xl font-semibold text-sm text-white disabled:opacity-50 transition-all bg-primary hover:bg-blue-700 flex items-center gap-2">
              {loading ? <Spinner /> : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
                  </svg>
                  Check Status
                </>
              )}
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
            <div className="h-1.5 w-full bg-gray-200 animate-pulse" />
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
          const accent = (dark ? {
            border: TYPE_ACCENT[result.type]?.darkBorder || 'rgba(255,255,255,0.08)',
            bg: TYPE_ACCENT[result.type]?.darkBg || 'rgba(255,255,255,0.03)',
          } : {
            border: TYPE_ACCENT[result.type]?.border || '#e5e7eb',
            bg: TYPE_ACCENT[result.type]?.bg || '#f9fafb',
          });
          return (
            <div className="track-fade-2 bg-white rounded-2xl border overflow-hidden"
              style={{ borderColor: accent.border, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
              <div className="h-1.5 w-full" style={{ background: TYPE_SOLID[result.type] || '#2563eb' }} />
              <div className="p-6">
                {/* Top row */}
                <div className="flex justify-between items-start gap-3 flex-wrap mb-1">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <button type="button" onClick={() => copyTrackingId(result.trackingId)}
                        className="group flex items-center gap-1.5 font-mono text-xs text-gray-400 bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded transition-colors"
                        title="Copy tracking code">
                        {result.trackingId}
                        <svg className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                        </svg>
                      </button>
                      <TypeBadge type={result.type} />
                      <PriorityBadge priority={result.priority} />
                    </div>
                    <h3 className="font-bold text-gray-900 text-lg">{result.department}</h3>
                  </div>
                  <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                    <StatusBadge status={result.status} />
                    <p className="text-xs text-gray-400">{new Date(result.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                  </div>
                </div>

                {/* Status timeline */}
                <ProgressTimeline status={result.status} />

                {/* Status message */}
                <div className="mt-4 px-4 py-3 rounded-xl text-sm font-medium"
                  style={{ background: accent.bg, color: dark ? '#e2e8f0' : '#374151', border: `1px solid ${accent.border}` }}>
                  {result.status === 'PENDING' && 'Your submission has been received and is awaiting review.'}
                  {result.status === 'REVIEWING' && 'Your submission is currently being reviewed by the concerned office.'}
                  {result.status === 'IN_PROGRESS' && 'The concerned office is actively working on your submission.'}
                  {result.status === 'RESOLVED' && 'Your submission has been resolved. Thank you for your feedback!'}
                </div>

                {/* Staff note, if one was left with the latest status change */}
                {result.statusLogs?.find(l => l.status === result.status && l.note) && (
                  <div className="mt-3 px-4 py-3 rounded-xl border-l-4 text-sm"
                    style={{
                      background: dark ? 'rgba(37,99,235,0.08)' : '#eff6ff',
                      borderColor: '#2563eb',
                      color: dark ? '#dbeafe' : '#1e3a8a',
                    }}>
                    <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: dark ? '#93c5fd' : '#2563eb' }}>
                      Note from the concerned office
                    </p>
                    {result.statusLogs.find(l => l.status === result.status && l.note).note}
                  </div>
                )}

                {/* Description */}
                <div className="mt-5">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Description</h4>
                  <p className="text-sm text-gray-700 leading-relaxed">{result.description}</p>
                </div>

                {/* Feedback panel */}
                {result.type === 'FEEDBACK' && (result.rating || result.reaction) && (
                  <div className="mt-4 p-3 bg-green-50 rounded-xl border border-green-100">
                    <FeedbackRatingDisplay rating={result.rating} reaction={result.reaction} feedbackTags={result.feedbackTags} />
                  </div>
                )}

                {/* Attachments */}
                {result.media?.length > 0 && (
                  <div className="mt-5">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Attached Files</h4>
                    <div className="flex gap-2 flex-wrap">
                      {result.media.map((m, i) => (
                        <button key={m.id} type="button" onClick={() => setLightboxIndex(i)}
                          className="group relative overflow-hidden rounded-xl border border-gray-200 hover:shadow-md transition-shadow">
                          <img src={mediaUrl(m.filePath)} alt="attachment" className="w-20 h-20 object-cover" />
                          <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-20 transition-opacity flex items-center justify-center">
                            <svg className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10 7v6M7 10h6" />
                            </svg>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Date info */}
                <div className="mt-5 pt-4 border-t border-gray-100 flex gap-6 text-xs text-gray-400 flex-wrap">
                  <span>Filed: {new Date(result.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  <span>Last updated: {new Date(result.updatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Empty state */}
        {!result && !error && !loading && (
          <div className="track-fade-2 text-center py-12 text-gray-400">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 mb-4">
              <Icon name="inbox" className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-sm font-medium">Enter your Transaction Code above to check the status of your submission.</p>
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
