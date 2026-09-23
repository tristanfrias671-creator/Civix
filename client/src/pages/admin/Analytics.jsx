import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer, Line, Area, ComposedChart,
  ReferenceLine,
} from 'recharts';
import { Skel, SkeletonStatCards } from '../../components/common/Skeleton';
import Icon from '../../components/common/Icons';
import { useTheme } from '../../context/ThemeContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';

function useChartTheme() {
  const { dark } = useTheme();
  return {
    dark,
    grid: dark ? '#334155' : '#f0f0f0',
    axisTick: dark ? '#94a3b8' : '#6b7280',
    tooltip: {
      contentStyle: {
        backgroundColor: dark ? '#1e293b' : '#fff',
        border: `1px solid ${dark ? '#334155' : '#e5e7eb'}`,
        borderRadius: '8px',
        fontSize: '12px',
        color: dark ? '#e2e8f0' : '#111827',
      },
      labelStyle: { color: dark ? '#e2e8f0' : '#111827' },
      itemStyle: { color: dark ? '#cbd5e1' : '#374151' },
    },
  };
}

/* ─── 3D Bar — vertical ──────────────────────────────────────────────────── */
function ThreeDBar({ x, y, width, height, fill }) {
  if (!height || height <= 0 || !width || width <= 0) return null;
  const d = Math.min(10, Math.max(5, width * 0.28));
  return (
    <g>
      {/* front face */}
      <rect x={x} y={y} width={width} height={height} fill={fill} rx={2} />
      {/* top face — white overlay makes it lighter */}
      <path d={`M${x},${y} L${x+d},${y-d} L${x+width+d},${y-d} L${x+width},${y} Z`} fill={fill} />
      <path d={`M${x},${y} L${x+d},${y-d} L${x+width+d},${y-d} L${x+width},${y} Z`} fill="rgba(255,255,255,0.40)" />
      {/* right side — dark overlay makes it darker */}
      <path d={`M${x+width},${y} L${x+width+d},${y-d} L${x+width+d},${y+height-d} L${x+width},${y+height} Z`} fill={fill} />
      <path d={`M${x+width},${y} L${x+width+d},${y-d} L${x+width+d},${y+height-d} L${x+width},${y+height} Z`} fill="rgba(0,0,0,0.22)" />
    </g>
  );
}

/* ─── 3D Bar — horizontal ────────────────────────────────────────────────── */
function ThreeDBarH({ x, y, width, height, fill }) {
  if (!width || width <= 0 || !height || height <= 0) return null;
  const d = Math.min(7, Math.max(3, height * 0.45));
  return (
    <g>
      {/* front face */}
      <rect x={x} y={y} width={width} height={height} fill={fill} rx={2} />
      {/* top face */}
      <path d={`M${x},${y} L${x+d},${y-d} L${x+width+d},${y-d} L${x+width},${y} Z`} fill={fill} />
      <path d={`M${x},${y} L${x+d},${y-d} L${x+width+d},${y-d} L${x+width},${y} Z`} fill="rgba(255,255,255,0.36)" />
      {/* right end cap */}
      <path d={`M${x+width},${y} L${x+width+d},${y-d} L${x+width+d},${y+height-d} L${x+width},${y+height} Z`} fill={fill} />
      <path d={`M${x+width},${y} L${x+width+d},${y-d} L${x+width+d},${y+height-d} L${x+width},${y+height} Z`} fill="rgba(0,0,0,0.20)" />
    </g>
  );
}

function KPICard({ label, value, sub, color, icon }) {
  const { dark } = useTheme();
  return (
    <div className="rounded-xl p-5 shadow-sm border" style={{ background: dark ? '#1e293b' : 'white', borderColor: dark ? 'rgba(255,255,255,0.06)' : '#f3f4f6' }}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: dark ? '#94a3b8' : '#6b7280' }}>{label}</p>
          <p className={`text-2xl font-bold mt-1.5 ${color}`}>{value ?? '—'}</p>
          {sub && <p className="text-xs mt-0.5" style={{ color: dark ? '#64748b' : '#9ca3af' }}>{sub}</p>}
        </div>
        <div className="p-2 rounded-lg" style={{ background: dark ? 'rgba(255,255,255,0.05)' : '#f9fafb', color: dark ? '#94a3b8' : '#6b7280' }}>
          <Icon name={icon} className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children, className = '' }) {
  const { dark } = useTheme();
  return (
    <div className={`rounded-xl shadow-sm border p-6 ${className}`} style={{ background: dark ? '#1e293b' : 'white', borderColor: dark ? 'rgba(255,255,255,0.06)' : '#f3f4f6' }}>
      <h2 className="font-semibold" style={{ color: dark ? '#f1f5f9' : '#1f2937' }}>{title}</h2>
      {subtitle && <p className="text-xs mt-0.5 mb-4" style={{ color: dark ? '#64748b' : '#6b7280' }}>{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </div>
  );
}

const QUARTER_TYPES = [
  { key: 'COMPLAINT',  name: 'Complaints',  color: '#DC2626', light: '#FEE2E2' },
  { key: 'SUGGESTION', name: 'Suggestions', color: '#1D4ED8', light: '#DBEAFE' },
  { key: 'FEEDBACK',   name: 'Feedback',    color: '#16A34A', light: '#DCFCE7' },
];

function sortQuarters(data) {
  return [...data].sort((a, b) => {
    const [yA, qA] = a.label.split(' Q').map(Number);
    const [yB, qB] = b.label.split(' Q').map(Number);
    return yA !== yB ? yA - yB : qA - qB;
  });
}

function QuarterlyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((sum, p) => sum + (p.value || 0), 0);
  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-lg px-4 py-3 min-w-[180px]">
      <p className="text-sm font-semibold text-gray-800 dark:text-slate-100 border-b border-gray-100 dark:border-slate-700 pb-2 mb-2">{label}</p>
      <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">{total} total submission{total !== 1 ? 's' : ''}</p>
      <div className="space-y-1.5">
        {payload.map(entry => {
          const meta = QUARTER_TYPES.find(t => t.key === entry.dataKey);
          const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
          return (
            <div key={entry.dataKey} className="flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: entry.color }} />
                <span className="text-gray-600 dark:text-slate-300">{meta?.name || entry.name}</span>
              </div>
              <span className="font-semibold text-gray-800 dark:text-slate-100">{entry.value} <span className="text-gray-400 dark:text-slate-500 font-normal">({pct}%)</span></span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuarterlyChart({ data }) {
  const { dark, grid, axisTick } = useChartTheme();
  const sorted = sortQuarters(data);
  const grandTotal = sorted.reduce((s, q) => s + (q.total ?? 0), 0);
  const avgPerQuarter = sorted.length ? (grandTotal / sorted.length).toFixed(1) : 0;
  const peak = sorted.reduce((best, q) => ((q.total ?? 0) > (best?.total ?? 0) ? q : best), sorted[0]);
  const latest = sorted[sorted.length - 1];

  return (
    <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
      <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h2 className="font-semibold text-gray-800 dark:text-slate-100 text-lg">Submissions by Quarter</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Complaints, suggestions, and feedback grouped by fiscal quarter</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {QUARTER_TYPES.map(t => (
              <span key={t.key} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
                style={dark
                  ? { background: `${t.color}22`, color: t.color, borderColor: `${t.color}55` }
                  : { background: t.light, color: t.color, borderColor: `${t.color}33` }}>
                <span className="w-2 h-2 rounded-full" style={{ background: t.color }} />
                {t.name}
              </span>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="rounded-lg bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 px-3 py-2.5 shadow-sm">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-slate-500 font-semibold">All quarters</p>
            <p className="text-xl font-bold text-primary mt-0.5">{grandTotal}</p>
          </div>
          <div className="rounded-lg bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 px-3 py-2.5 shadow-sm">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-slate-500 font-semibold">Peak quarter</p>
            <p className="text-xl font-bold text-gray-800 dark:text-slate-100 mt-0.5">{peak?.total ?? 0}</p>
            <p className="text-[10px] text-gray-400 dark:text-slate-500 truncate">{peak?.label ?? '—'}</p>
          </div>
          <div className="rounded-lg bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 px-3 py-2.5 shadow-sm">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-slate-500 font-semibold">Latest ({latest?.label})</p>
            <p className="text-xl font-bold text-gray-800 dark:text-slate-100 mt-0.5">{latest?.total ?? 0}</p>
            <p className="text-[10px] text-gray-400 dark:text-slate-500">Avg {avgPerQuarter} / quarter</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 sm:px-6">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={sorted} margin={{ top: 16, right: 20, left: -8, bottom: 4 }} barGap={4} barCategoryGap="22%">
            <CartesianGrid strokeDasharray="4 4" stroke={grid} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: axisTick, fontWeight: 500 }} axisLine={{ stroke: grid }} tickLine={false} dy={8} />
            <YAxis tick={{ fontSize: 11, fill: axisTick }} axisLine={false} tickLine={false} allowDecimals={false} width={36} />
            <Tooltip content={<QuarterlyTooltip />} cursor={{ fill: dark ? 'rgba(148,163,184,0.08)' : 'rgba(29,78,216,0.04)' }} />
            <ReferenceLine y={Number(avgPerQuarter)} stroke="#94A3B8" strokeDasharray="6 4"
              label={{ value: `Avg ${avgPerQuarter}`, position: 'insideTopRight', fill: '#94A3B8', fontSize: 11 }} />
            {QUARTER_TYPES.map(t => (
              <Bar key={t.key} dataKey={t.key} name={t.name} fill={t.color}
                maxBarSize={36} shape={<ThreeDBar />} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ─── Main ───────────────────────────────────────────────────────────────── */
export default function Analytics() {
  const location = useLocation();
  const { dark, grid, axisTick, tooltip } = useChartTheme();
  const [summary, setSummary]     = useState(null);
  const [quarterly, setQuarterly] = useState([]);
  const [monthly, setMonthly]     = useState([]);
  const [sentiment, setSentiment] = useState([]);
  const [breakdown, setBreakdown] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/analytics/summary'),
      api.get('/analytics/quarterly'),
      api.get('/analytics/monthly'),
      api.get('/analytics/sentiment'),
      api.get('/analytics/breakdown'),
    ]).then(([s, q, m, sent, b]) => {
      setSummary(s.data); setQuarterly(q.data); setMonthly(m.data);
      setSentiment(sent.data); setBreakdown(b.data); setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function exportPDF() {
    setExporting(true);
    try {
      const res = await api.get('/reports/pdf', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url;
      a.download = `civix-report-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click(); URL.revokeObjectURL(url);
      toast.success('Report downloaded!');
    } catch { toast.error('Failed to generate report'); }
    setExporting(false);
  }

  async function exportExcel() {
    setExportingExcel(true);
    try {
      const res = await api.get('/reports/excel', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const a = document.createElement('a'); a.href = url;
      a.download = `civix-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click(); URL.revokeObjectURL(url);
      toast.success('Excel workbook downloaded!');
    } catch { toast.error('Failed to generate Excel report'); }
    setExportingExcel(false);
  }

  const sentimentTotal = sentiment.reduce((n, s) => n + s.value, 0);

  if (loading) return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div><Skel className="h-6 w-32 mb-2" /><Skel className="h-3 w-56" /></div>
        <div className="flex gap-2.5"><Skel className="h-10 w-32" /><Skel className="h-10 w-32" /></div>
      </div>
      <SkeletonStatCards count={4} className="mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="rounded-xl border border-gray-100 bg-white p-6"><Skel className="h-4 w-32 mb-4" /><Skel className="h-56 w-full" /></div>
        <div className="rounded-xl border border-gray-100 bg-white p-6"><Skel className="h-4 w-40 mb-4" /><Skel className="h-56 w-full" /></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 rounded-xl border border-gray-100 bg-white p-6"><Skel className="h-4 w-44 mb-4" /><Skel className="h-48 w-full" /></div>
        <div className="rounded-xl border border-gray-100 bg-white p-6"><Skel className="h-4 w-24 mb-4" /><Skel className="h-48 w-full" /></div>
      </div>
      <div className="rounded-xl border border-gray-100 bg-white p-6 mb-6"><Skel className="h-4 w-36 mb-4" /><Skel className="h-64 w-full" /></div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-xl border border-gray-100 bg-white p-6"><Skel className="h-4 w-36 mb-4" /><Skel className="h-40 w-full" /></div>
        <div className="lg:col-span-2 rounded-xl border border-gray-100 bg-white p-6"><Skel className="h-4 w-52 mb-4" /><Skel className="h-40 w-full" /></div>
      </div>
    </div>
  );

  return (
    <div key={location.key} className="p-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: dark ? '#f1f5f9' : '#1f2937' }}>Analytics</h1>
          <p className="text-sm mt-0.5" style={{ color: dark ? '#64748b' : '#6b7280' }}>Performance metrics and submission insights</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button onClick={exportExcel} disabled={exportingExcel}
            className="flex items-center justify-center gap-2 px-5 py-2.5 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
            style={{ background: '#16a34a' }}
            onMouseEnter={e => { if (!exportingExcel) e.currentTarget.style.background = '#15803d'; }}
            onMouseLeave={e => e.currentTarget.style.background = '#16a34a'}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6h6v6M9 17H7a2 2 0 01-2-2V5a2 2 0 012-2h6.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2" />
            </svg>
            {exportingExcel ? 'Generating...' : 'Export Excel'}
          </button>
          <button onClick={exportPDF} disabled={exporting}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {exporting ? 'Generating...' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard label="Total Submissions" value={summary?.total} color="text-primary" icon="submissions" />
        <KPICard label="Response Rate" value={`${summary?.responseRate ?? 0}%`} color="text-primary" icon="analytics" sub="Non-pending share" />
        <KPICard label="Avg Resolution" value={`${summary?.avgResolutionTime ?? 0}d`} color="text-success" icon="clock" />
        <KPICard label="Registered Citizens" value={summary?.citizens} color="text-slate-700" icon="citizens" />
      </div>

      {/* Monthly Trend + Sentiment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        {/* Monthly Trend — 3D glow lines */}
        <ChartCard title="Monthly Trend" subtitle="Submissions over the last 12 months">
          {monthly.every(m => m.total === 0) ? (
            <div className="flex items-center justify-center h-56 text-sm" style={{ color: dark ? '#64748b' : '#9ca3af' }}>No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={monthly} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1D4ED8" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#1D4ED8" stopOpacity={0} />
                  </linearGradient>
                  <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: axisTick }} />
                <YAxis tick={{ fontSize: 11, fill: axisTick }} allowDecimals={false} />
                <Tooltip {...tooltip} />
                <Legend wrapperStyle={{ fontSize: '12px', color: dark ? '#cbd5e1' : undefined }} />
                <Area type="monotone" dataKey="total" name="Total" stroke="#1D4ED8" fill="url(#totalGrad)" strokeWidth={2.5} />
                <Line type="monotone" dataKey="COMPLAINT"  name="Complaints"  stroke="#DC2626" strokeWidth={2.5} dot={false} style={{ filter: 'url(#lineGlow)' }} />
                <Line type="monotone" dataKey="SUGGESTION" name="Suggestions" stroke="#2563EB" strokeWidth={2.5} dot={false} style={{ filter: 'url(#lineGlow)' }} />
                <Line type="monotone" dataKey="FEEDBACK"   name="Feedback"    stroke="#16A34A" strokeWidth={2.5} dot={false} style={{ filter: 'url(#lineGlow)' }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Sentiment — 3D shadow-depth pie */}
        <ChartCard title="Sentiment Distribution" subtitle="Tone analysis of submission descriptions">
          {sentimentTotal === 0 ? (
            <div className="flex items-center justify-center h-56 text-sm" style={{ color: dark ? '#64748b' : '#9ca3af' }}>No data yet</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <defs>
                    <filter id="pieShadow" x="-10%" y="-10%" width="120%" height="130%">
                      <feDropShadow dx="0" dy="6" stdDeviation="4" floodOpacity="0.20" />
                    </filter>
                  </defs>
                  {/* Shadow layer — offset downward to fake 3D depth */}
                  <Pie data={sentiment} cx="50%" cy="54%" innerRadius={46} outerRadius={76}
                    dataKey="value" paddingAngle={2} isAnimationActive={false}>
                    {sentiment.map((_, i) => <Cell key={i} fill="rgba(0,0,0,0.12)" />)}
                  </Pie>
                  {/* Main pie on top */}
                  <Pie data={sentiment} cx="50%" cy="50%" innerRadius={48} outerRadius={78}
                    dataKey="value" paddingAngle={2}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    style={{ filter: 'url(#pieShadow)' }}>
                    {sentiment.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip {...tooltip} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {sentiment.map(s => (
                  <div key={s.name} className="text-center p-2 rounded-lg" style={{ background: dark ? 'rgba(255,255,255,0.05)' : '#f9fafb' }}>
                    <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-xs" style={{ color: dark ? '#94a3b8' : '#6b7280' }}>{s.name}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </ChartCard>
      </div>

      {/* Quarterly + By Type */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {quarterly.length === 0 ? (
          <ChartCard title="Submissions by Quarter" className="lg:col-span-2">
            <div className="flex items-center justify-center h-56 text-sm" style={{ color: dark ? '#64748b' : '#9ca3af' }}>No data yet</div>
          </ChartCard>
        ) : (
          <QuarterlyChart data={quarterly} />
        )}

        {/* By Type — 3D shadow-depth pie */}
        <ChartCard title="By Type">
          {!breakdown?.type?.length ? (
            <div className="flex items-center justify-center h-56 text-sm" style={{ color: dark ? '#64748b' : '#9ca3af' }}>No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <defs>
                  <filter id="pieShadow2" x="-10%" y="-10%" width="120%" height="130%">
                    <feDropShadow dx="0" dy="6" stdDeviation="4" floodOpacity="0.18" />
                  </filter>
                </defs>
                {/* Shadow layer */}
                <Pie data={breakdown.type} cx="50%" cy="54%" outerRadius={88} innerRadius={36}
                  dataKey="value" paddingAngle={2} isAnimationActive={false}>
                  {breakdown.type.map((_, i) => <Cell key={i} fill="rgba(0,0,0,0.12)" />)}
                </Pie>
                {/* Main pie */}
                <Pie data={breakdown.type} cx="50%" cy="50%" outerRadius={90} innerRadius={36}
                  dataKey="value" paddingAngle={2}
                  label={({ name, value }) => `${name}: ${value}`}
                  style={{ filter: 'url(#pieShadow2)' }}>
                  {breakdown.type.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip {...tooltip} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* By Department — full width */}
      <div className="mb-6">
        <ChartCard title="By Department" subtitle="Workload distribution across departments">
          {!breakdown?.department?.length ? (
            <div className="flex items-center justify-center h-48 text-sm" style={{ color: dark ? '#64748b' : '#9ca3af' }}>No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={breakdown.department} layout="vertical" margin={{ top: 10, right: 24, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: axisTick }} allowDecimals={false} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: axisTick }} width={110} axisLine={false} tickLine={false} />
                <Tooltip {...tooltip} />
                <Bar dataKey="value" name="Submissions" maxBarSize={20} shape={<ThreeDBarH />}>
                  {breakdown.department.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Status Breakdown + Top Departments */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title="Status Breakdown" className="lg:col-span-1">
          <div className="space-y-3">
            {[
              { label: 'Pending',     value: summary?.pending,    color: '#6B7280' },
              { label: 'Reviewing',   value: summary?.reviewing,  color: '#1D4ED8' },
              { label: 'In Progress', value: summary?.inProgress, color: '#CA8A04' },
              { label: 'Resolved',    value: summary?.resolved,   color: '#16A34A' },
            ].map(s => {
              const pct = summary?.total > 0 ? Math.round((s.value / summary.total) * 100) : 0;
              return (
                <div key={s.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium" style={{ color: dark ? '#cbd5e1' : '#374151' }}>{s.label}</span>
                    <span style={{ color: dark ? '#94a3b8' : '#6b7280' }}>{s.value} ({pct}%)</span>
                  </div>
                  <div className="w-full rounded-full h-2" style={{ background: dark ? 'rgba(255,255,255,0.08)' : '#f3f4f6' }}>
                    <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: s.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>

        <ChartCard title="Top Departments" subtitle="Departments most cited by citizen submissions" className="lg:col-span-2">
          {!breakdown?.departmentSelections?.length ? (
            <div className="flex items-center justify-center h-40 text-sm" style={{ color: dark ? '#64748b' : '#9ca3af' }}>No data yet</div>
          ) : (
            <div className="space-y-3">
              {breakdown.departmentSelections.map((c, i) => {
                const max = breakdown.departmentSelections[0]?.value || 1;
                const pct = Math.round((c.value / max) * 100);
                return (
                  <div key={c.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium truncate pr-4" style={{ color: dark ? '#cbd5e1' : '#374151' }}>
                        <span style={{ color: dark ? '#64748b' : '#9ca3af' }} className="mr-2">{i + 1}.</span>{c.name}
                      </span>
                      <span className="flex-shrink-0" style={{ color: dark ? '#94a3b8' : '#6b7280' }}>{c.value}</span>
                    </div>
                    <div className="w-full rounded-full h-2" style={{ background: dark ? 'rgba(255,255,255,0.08)' : '#f3f4f6' }}>
                      <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
