import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Skel, SkeletonStatCards, SkeletonTable } from '../../components/common/Skeleton';
import { useTheme } from '../../context/ThemeContext';
import api from '../../utils/api';

/* ─── Confidence Badge ───────────────────────────────────────────────────── */
function ConfidenceBadge({ confidence, dark }) {
  const high   = confidence >= 70;
  const medium = confidence >= 40;
  const cfg = high
    ? { color: dark ? '#4ade80' : '#16a34a', bg: dark ? 'rgba(34,197,94,0.15)'  : '#dcfce7', border: dark ? 'rgba(34,197,94,0.3)'  : '#bbf7d0' }
    : medium
    ? { color: dark ? '#fbbf24' : '#d97706', bg: dark ? 'rgba(245,158,11,0.15)' : '#fef3c7', border: dark ? 'rgba(245,158,11,0.3)' : '#fde68a' }
    : { color: dark ? '#f87171' : '#dc2626', bg: dark ? 'rgba(220,38,38,0.15)'  : '#fee2e2', border: dark ? 'rgba(220,38,38,0.3)'  : '#fecaca' };
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border"
      style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
      {confidence}%
    </span>
  );
}

/* ─── Status Pill ────────────────────────────────────────────────────────── */
function StatusPill({ predicted, final, adminCorrected, dark }) {
  if (adminCorrected) return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border"
      style={{
        background: dark ? 'rgba(220,38,38,0.15)' : '#fee2e2',
        color: dark ? '#f87171' : '#dc2626',
        borderColor: dark ? 'rgba(220,38,38,0.3)' : '#fecaca',
      }}>
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
      </svg>
      Corrected
    </span>
  );
  if (predicted === final) return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border"
      style={{
        background: dark ? 'rgba(34,197,94,0.15)' : '#dcfce7',
        color: dark ? '#4ade80' : '#16a34a',
        borderColor: dark ? 'rgba(34,197,94,0.3)' : '#bbf7d0',
      }}>
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
      </svg>
      Correct
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border"
      style={{
        background: dark ? 'rgba(245,158,11,0.15)' : '#fef3c7',
        color: dark ? '#fbbf24' : '#d97706',
        borderColor: dark ? 'rgba(245,158,11,0.3)' : '#fde68a',
      }}>
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      </svg>
      Unreviewed
    </span>
  );
}

/* ─── Circular Accuracy Gauge ────────────────────────────────────────────── */
function AccuracyGauge({ accuracy, dark }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ - (accuracy / 100) * circ;
  const color = accuracy >= 70 ? '#22c55e' : accuracy >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="140" height="140" viewBox="0 0 140 140">
        {/* track */}
        <circle cx="70" cy="70" r={r} fill="none"
          stroke={dark ? 'rgba(255,255,255,0.07)' : '#f1f5f9'}
          strokeWidth="12" />
        {/* progress */}
        <circle cx="70" cy="70" r={r} fill="none"
          stroke={color} strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform="rotate(-90 70 70)"
          style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black" style={{ color }}>{accuracy}%</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide"
          style={{ color: dark ? '#64748b' : '#94a3b8' }}>Accuracy</span>
      </div>
    </div>
  );
}

const STAT_CARDS = [
  { key: 'total',          label: 'Total Submissions', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', light: { color:'#6366f1', bg:'#eef2ff', iconBg:'rgba(99,102,241,0.15)' }, dark: { color:'#a5b4fc', bg:'rgba(99,102,241,0.1)', iconBg:'rgba(99,102,241,0.2)' } },
  { key: 'classified',     label: 'AI Classified',     icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z', light: { color:'#2563eb', bg:'#dbeafe', iconBg:'rgba(37,99,235,0.15)' }, dark: { color:'#60a5fa', bg:'rgba(37,99,235,0.1)', iconBg:'rgba(37,99,235,0.2)' } },
  { key: 'correct',        label: 'Correct Predictions', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', light: { color:'#16a34a', bg:'#dcfce7', iconBg:'rgba(22,163,74,0.15)' }, dark: { color:'#4ade80', bg:'rgba(22,163,74,0.1)', iconBg:'rgba(22,163,74,0.2)' } },
  { key: 'manualOverrides', label: 'Manual Overrides', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z', light: { color:'#dc2626', bg:'#fee2e2', iconBg:'rgba(220,38,38,0.15)' }, dark: { color:'#f87171', bg:'rgba(220,38,38,0.1)', iconBg:'rgba(220,38,38,0.2)' } },
];

const FILTERS = [
  { key: '', label: 'All Records', icon: 'M4 6h16M4 12h16M4 18h16' },
  { key: 'correct',    label: 'Correct',    icon: 'M5 13l4 4L19 7' },
  { key: 'corrected',  label: 'Corrected',  icon: 'M6 18L18 6M6 6l12 12' },
  { key: 'unreviewed', label: 'Unreviewed', icon: 'M12 9v4m0 4h.01' },
];

export default function AIClassification() {
  const { dark } = useTheme();
  const location = useLocation();
  const [stats,   setStats]   = useState(null);
  const [records, setRecords] = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('');
  const LIMIT = 15;

  useEffect(() => {
    api.get('/classify/stats').then(r => setStats(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    api.get(`/classify/review?page=${page}&limit=${LIMIT}`)
      .then(r => { setRecords(r.data.records || []); setTotal(r.data.total || 0); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page]);

  const filtered = records.filter(r => {
    if (!filter) return true;
    const correct = r.predictedDepartment === r.submission?.department;
    if (filter === 'correct')    return correct && !r.adminCorrected;
    if (filter === 'corrected')  return r.adminCorrected;
    if (filter === 'unreviewed') return !correct && !r.adminCorrected;
    return true;
  });

  const pages = Math.ceil(total / LIMIT);

  const card  = dark ? { bg: '#1e293b', border: '#334155' } : { bg: '#fff', border: '#e5e7eb' };
  const text  = dark ? { primary: '#f1f5f9', secondary: '#94a3b8', muted: '#475569' } : { primary: '#111827', secondary: '#6b7280', muted: '#9ca3af' };
  const table = dark ? { head: '#162032', headText: '#64748b', row: '#1e293b', alt: 'rgba(255,255,255,0.02)', hover: 'rgba(255,255,255,0.04)', divide: '#1e293b' }
                     : { head: '#f8fafc', headText: '#64748b', row: '#fff', alt: 'rgba(0,0,0,0.015)', hover: 'rgba(0,0,0,0.02)', divide: '#f1f5f9' };

  return (
    <div key={location.key} className="p-6 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-7">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', boxShadow: '0 4px 16px rgba(37,99,235,0.35)' }}>
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: text.primary }}>AI Classification Review</h1>
            <p className="text-sm mt-0.5" style={{ color: text.secondary }}>Monitor and validate the AI's department prediction accuracy</p>
          </div>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      {!stats && <SkeletonStatCards count={4} className="mb-6" />}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {STAT_CARDS.map(c => {
            const cfg = dark ? c.dark : c.light;
            return (
              <div key={c.key} className="rounded-2xl p-5 border"
                style={{ background: card.bg, borderColor: card.border }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: cfg.iconBg }}>
                    <svg className="w-5 h-5" fill="none" stroke={cfg.color} viewBox="0 0 24 24" strokeWidth="1.8">
                      <path strokeLinecap="round" strokeLinejoin="round" d={c.icon}/>
                    </svg>
                  </div>
                </div>
                <p className="text-2xl font-black" style={{ color: cfg.color }}>{stats[c.key]}</p>
                <p className="text-xs font-medium mt-1" style={{ color: text.secondary }}>{c.label}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Accuracy + Confidence Panel ── */}
      {!stats && (
        <div className="rounded-2xl border mb-6 overflow-hidden" style={{ background: card.bg, borderColor: card.border }}>
          <div className="flex flex-col lg:flex-row">
            <div className="lg:w-56 flex flex-col items-center justify-center p-6 border-b lg:border-b-0 lg:border-r" style={{ borderColor: card.border }}>
              <Skel className="w-32 h-32 rounded-full" />
            </div>
            <div className="flex-1 p-6 space-y-4">
              <Skel className="h-4 w-48 mb-2" />
              <Skel className="h-2 w-full" />
              <Skel className="h-2 w-full" />
              <Skel className="h-2 w-full" />
            </div>
            <div className="lg:w-44 flex flex-col items-center justify-center p-6 border-t lg:border-t-0 lg:border-l" style={{ borderColor: card.border }}>
              <Skel className="h-10 w-20" />
            </div>
          </div>
        </div>
      )}
      {stats && (
        <div className="rounded-2xl border mb-6 overflow-hidden"
          style={{ background: card.bg, borderColor: card.border }}>
          <div className="flex flex-col lg:flex-row">

            {/* Gauge */}
            <div className="lg:w-56 flex flex-col items-center justify-center p-6 border-b lg:border-b-0 lg:border-r"
              style={{ borderColor: card.border }}>
              <AccuracyGauge accuracy={stats.accuracy} dark={dark} />
              <p className="text-xs font-semibold mt-2" style={{ color: text.secondary }}>
                {stats.correct} of {stats.classified} correct
              </p>
            </div>

            {/* Stats breakdown */}
            <div className="flex-1 p-6">
              <h3 className="text-sm font-bold mb-4" style={{ color: text.primary }}>Classification Breakdown</h3>
              <div className="space-y-3.5">
                {[
                  { label: 'Correct Predictions', value: stats.correct,        total: stats.classified, color: '#22c55e' },
                  { label: 'Admin Corrected',      value: stats.manualOverrides, total: stats.classified, color: '#f87171' },
                  { label: 'Avg Confidence',       value: stats.avgConfidence,   total: 100,              color: '#60a5fa', suffix: '%' },
                ].map(row => {
                  const pct = row.total > 0 ? Math.round((row.value / row.total) * 100) : 0;
                  return (
                    <div key={row.label}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-medium" style={{ color: text.secondary }}>{row.label}</span>
                        <span className="font-bold" style={{ color: text.primary }}>
                          {row.suffix ? `${row.value}${row.suffix}` : row.value}
                          <span className="font-normal ml-1" style={{ color: text.muted }}>({pct}%)</span>
                        </span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: dark ? 'rgba(255,255,255,0.07)' : '#f1f5f9' }}>
                        <div className="h-2 rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: row.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Avg confidence big number */}
            <div className="lg:w-44 flex flex-col items-center justify-center p-6 border-t lg:border-t-0 lg:border-l"
              style={{ borderColor: card.border, background: dark ? 'rgba(37,99,235,0.07)' : 'rgba(37,99,235,0.04)' }}>
              <p className="text-[10px] uppercase tracking-widest font-semibold mb-1" style={{ color: '#60a5fa' }}>Avg Confidence</p>
              <p className="text-4xl font-black" style={{ color: '#2563eb' }}>{stats.avgConfidence}%</p>
              <p className="text-xs mt-2 text-center" style={{ color: text.muted }}>across {stats.classified} AI-processed records</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Table Card ── */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: card.bg, borderColor: card.border }}>

        {/* Table header */}
        <div className="px-6 py-4 border-b flex flex-wrap items-center gap-3" style={{ borderColor: card.border }}>
          <div>
            <h3 className="text-sm font-bold" style={{ color: text.primary }}>Classification Records</h3>
            <p className="text-xs mt-0.5" style={{ color: text.muted }}>{total} total record{total !== 1 ? 's' : ''}</p>
          </div>
          <div className="ml-auto flex gap-1.5 flex-wrap">
            {FILTERS.map(f => {
              const active = filter === f.key;
              return (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                  style={active
                    ? { background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: '#fff', boxShadow: '0 2px 10px rgba(37,99,235,0.35)' }
                    : { background: dark ? 'rgba(255,255,255,0.06)' : '#f1f5f9', color: text.secondary }}>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d={f.icon}/>
                  </svg>
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="overflow-x-auto"><SkeletonTable cols={7} rows={10} /></div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: dark ? 'rgba(255,255,255,0.05)' : '#f8fafc' }}>
              <svg className="w-8 h-8" style={{ color: text.muted }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
              </svg>
            </div>
            <p className="font-semibold" style={{ color: text.secondary }}>No records found</p>
            <p className="text-xs mt-1" style={{ color: text.muted }}>Try changing the filter above</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: table.head }}>
                  {['Tracking ID', 'Citizen', 'AI Prediction', 'Confidence', 'Final Department', 'Status', ''].map((h, i) => (
                    <th key={i} className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap"
                      style={{ color: table.headText }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const sub = r.submission;
                  const mismatch = r.predictedDepartment !== sub?.department;
                  return (
                    <tr key={r.id}
                      style={{ background: i % 2 !== 0 ? table.alt : table.row, borderTop: `1px solid ${table.divide}` }}>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="font-mono text-xs px-2 py-1 rounded-lg"
                          style={{ background: dark ? 'rgba(255,255,255,0.06)' : '#f1f5f9', color: text.secondary }}>
                          {sub?.trackingId}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: '#fff' }}>
                            {(sub?.user?.fullName || '?')[0].toUpperCase()}
                          </div>
                          <span className="text-xs font-medium" style={{ color: text.primary }}>{sub?.user?.fullName || '—'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 max-w-[160px]">
                        <span className="text-xs block truncate" style={{ color: text.secondary }}>{r.predictedDepartment}</span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <ConfidenceBadge confidence={r.confidence} dark={dark} />
                      </td>
                      <td className="px-5 py-3.5 max-w-[160px]">
                        <span className={`text-xs block truncate font-${mismatch ? 'semibold' : 'normal'}`}
                          style={{ color: mismatch ? (dark ? '#f87171' : '#dc2626') : text.secondary }}>
                          {sub?.department}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <StatusPill predicted={r.predictedDepartment} final={sub?.department} adminCorrected={r.adminCorrected} dark={dark} />
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <Link to={`/admin/submissions/${sub?.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                          style={{ background: dark ? 'rgba(37,99,235,0.15)' : 'rgba(37,99,235,0.1)', color: '#2563eb' }}
                          onMouseEnter={e => e.currentTarget.style.background = dark ? 'rgba(37,99,235,0.25)' : 'rgba(37,99,235,0.18)'}
                          onMouseLeave={e => e.currentTarget.style.background = dark ? 'rgba(37,99,235,0.15)' : 'rgba(37,99,235,0.1)'}>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                          </svg>
                          Review
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="px-6 py-4 border-t flex items-center justify-between" style={{ borderColor: card.border }}>
            <p className="text-xs" style={{ color: text.muted }}>
              Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors disabled:opacity-40"
                style={{ borderColor: card.border, color: text.secondary, background: 'transparent' }}>
                ← Previous
              </button>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors disabled:opacity-40"
                style={{ borderColor: card.border, color: text.secondary, background: 'transparent' }}>
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
