import React, { useEffect, useId, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList,
  ResponsiveContainer, Line, Area, ComposedChart, ReferenceLine, Customized,
} from 'recharts';
import { Skel, SkeletonStatCards, useSkeletonGate } from '../../components/common/Skeleton';
import Icon from '../../components/common/Icons';
import { useTheme } from '../../context/ThemeContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';

// Series colors, checked with the dataviz palette validator (all pairs; light on
// #ffffff, dark on #1e293b). Red vs green sits in the colorblind "floor" band, so
// every chart also carries a legend with names and values as secondary encoding.
const PALETTE = {
  light: {
    COMPLAINT: '#e34948', SUGGESTION: '#2a78d6', FEEDBACK: '#008300',
    single: '#2a78d6', total: '#898781',
    Positive: '#2a78d6', Neutral: '#898781', Negative: '#e34948',
  },
  dark: {
    COMPLAINT: '#e66767', SUGGESTION: '#3987e5', FEEDBACK: '#008300',
    single: '#3987e5', total: '#898781',
    Positive: '#3987e5', Neutral: '#898781', Negative: '#e66767',
  },
};

const TYPES = [
  { key: 'COMPLAINT',  name: 'Complaints' },
  { key: 'SUGGESTION', name: 'Suggestions' },
  { key: 'FEEDBACK',   name: 'Feedback' },
];
const TYPE_KEY = { Complaint: 'COMPLAINT', Suggestion: 'SUGGESTION', Feedback: 'FEEDBACK' };

const analyticsCss = `
/* Raised card surface: layered shadow + a light top edge */
.an-card {
  position: relative;
  border-radius: 16px;
  border: 1px solid rgba(15,23,42,0.06);
  background: linear-gradient(180deg, #ffffff 0%, #fcfdff 100%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(15,23,42,0.04), 0 12px 28px -12px rgba(15,23,42,0.18);
}
.dark .an-card {
  border-color: rgba(255,255,255,0.06);
  background: linear-gradient(180deg, #202c40 0%, #1e293b 100%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 1px 2px rgba(0,0,0,0.3), 0 14px 30px -12px rgba(0,0,0,0.55);
}

/* KPI tiles tilt toward the cursor; the icon floats above the card plane */
.an-tilt {
  transform: perspective(900px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
  transition: transform .2s ease-out, box-shadow .3s ease;
  will-change: transform;
}
.an-tilt, .an-tilt > * { transform-style: preserve-3d; }
.an-tilt:hover { box-shadow: inset 0 1px 0 rgba(255,255,255,0.9), 0 22px 40px -14px rgba(37,99,235,0.30); }
.dark .an-tilt:hover { box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 22px 40px -14px rgba(0,0,0,0.75); }
.an-glare {
  position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  background: radial-gradient(circle at var(--gx, 50%) var(--gy, 0%), rgba(255,255,255,0.55), rgba(255,255,255,0) 60%);
  opacity: 0; transition: opacity .3s ease;
}
.dark .an-glare { background: radial-gradient(circle at var(--gx, 50%) var(--gy, 0%), rgba(255,255,255,0.10), rgba(255,255,255,0) 60%); }
.an-tilt:hover .an-glare { opacity: 1; }
.an-pop { transform: translateZ(28px); }
.an-icon { box-shadow: 0 8px 16px -6px var(--accent-shadow), inset 0 1px 0 rgba(255,255,255,0.35); }

/* 3D bars brighten under the cursor; donut slices lift out */
.an-3d-bar { transition: filter .2s ease; }
.an-3d-bar:hover { filter: brightness(1.08); }
.an-3d-slice { transition: transform .3s cubic-bezier(.2,.8,.2,1); cursor: pointer; }
.an-tip {
  position: absolute; z-index: 10; pointer-events: none; white-space: nowrap;
  transform: translate(12px, calc(-100% - 8px));
  background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 6px 10px;
  font-size: 12px; color: #111827; box-shadow: 0 10px 24px -8px rgba(15,23,42,0.25);
}
.dark .an-tip { background: #1e293b; border-color: #334155; color: #e2e8f0; }

/* Progress meters: recessed track, lit fill */
.an-track { box-shadow: inset 0 1px 2px rgba(15,23,42,0.12); }
.dark .an-track { box-shadow: inset 0 1px 2px rgba(0,0,0,0.5); }
.an-fill {
  background-image: linear-gradient(180deg, rgba(255,255,255,0.35), rgba(255,255,255,0) 60%, rgba(0,0,0,0.12));
  box-shadow: 0 2px 4px -1px rgba(15,23,42,0.25);
}
.an-dot { box-shadow: inset 0 -1px 1px rgba(0,0,0,0.25), 0 1px 2px rgba(15,23,42,0.25); }

@media (prefers-reduced-motion: reduce) {
  .an-tilt { transform: none !important; transition: none; }
  .an-glare { display: none; }
  .an-3d-slice { transition: none; }
}
`;

function useChartTheme() {
  const { dark } = useTheme();
  return {
    dark,
    pal: dark ? PALETTE.dark : PALETTE.light,
    surface: dark ? '#1e293b' : '#ffffff',
    ink: dark ? '#e2e8f0' : '#1f2937',
    inkMuted: dark ? '#94a3b8' : '#6b7280',
    grid: dark ? '#334155' : '#eef0f3',
    axisTick: dark ? '#94a3b8' : '#6b7280',
    tooltip: {
      contentStyle: {
        backgroundColor: dark ? '#1e293b' : '#fff',
        border: `1px solid ${dark ? '#334155' : '#e5e7eb'}`,
        borderRadius: '10px',
        fontSize: '12px',
        color: dark ? '#e2e8f0' : '#111827',
        boxShadow: '0 10px 24px -8px rgba(15,23,42,0.25)',
      },
      labelStyle: { color: dark ? '#e2e8f0' : '#111827' },
      itemStyle: { color: dark ? '#cbd5e1' : '#374151' },
    },
  };
}

// SVG ids can't contain the colons React's useId produces.
function useSvgId(prefix) {
  return `${prefix}${useId().replace(/:/g, '')}`;
}

// Mix a hex color toward white (amt > 0) or black (amt < 0).
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const target = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  const mix = c => Math.round((target - c) * p + c);
  return `#${[n >> 16, (n >> 8) & 255, n & 255].map(c => mix(c).toString(16).padStart(2, '0')).join('')}`;
}

/* ─── 3D bars ───────────────────────────────────────────────────────────────
   Oblique cuboids: the FRONT face spans exactly baseline→value, so its top edge
   lines up with the gridline for the value; top and side faces recede up-right.
   Light comes from the upper left: bright top, lit front, shaded side. */
const DEPTH = 10;
const barDepth = size => Math.min(DEPTH, size * 0.5);

function cuboidDefs(id, color, horizontal) {
  return [
    <linearGradient key={`${id}-front`} id={`${id}-front`} x1="0" y1="0" x2={horizontal ? 0 : 1} y2={horizontal ? 1 : 0}>
      <stop offset="0%" stopColor={shade(color, 0.22)} />
      <stop offset="55%" stopColor={color} />
      <stop offset="100%" stopColor={shade(color, -0.12)} />
    </linearGradient>,
    <linearGradient key={`${id}-top`} id={`${id}-top`} x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stopColor={shade(color, 0.35)} />
      <stop offset="100%" stopColor={shade(color, 0.55)} />
    </linearGradient>,
    <linearGradient key={`${id}-side`} id={`${id}-side`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={shade(color, -0.25)} />
      <stop offset="100%" stopColor={shade(color, -0.45)} />
    </linearGradient>,
  ];
}

// Shared per chart: the contact-shadow blur and the dark band where a bar meets the floor.
function sceneDefs(id) {
  return [
    <filter key={`${id}-blur`} id={`${id}-blur`} x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" />
    </filter>,
    <linearGradient key={`${id}-ao`} id={`${id}-ao`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#000" stopOpacity="0" />
      <stop offset="100%" stopColor="#000" stopOpacity="0.22" />
    </linearGradient>,
  ];
}

function Bar3D({ x, y, width, height, gid, scene }) {
  if (!(width > 0) || !(height > 0)) return null;
  const dx = barDepth(width), dy = dx * 0.75, base = y + height, ao = Math.min(14, height);
  return (
    <g className="an-3d-bar">
      <ellipse cx={x + width / 2 + dx / 2} cy={base - dy / 2 + 2} rx={width / 2 + dx} ry={dy + 3}
        fill="#0f172a" opacity="0.28" filter={`url(#${scene}-blur)`} />
      <path d={`M${x + width},${y} l${dx},${-dy} v${height} l${-dx},${dy} Z`} fill={`url(#${gid}-side)`} />
      <rect x={x} y={y} width={width} height={height} fill={`url(#${gid}-front)`} />
      <rect x={x} y={base - ao} width={width} height={ao} fill={`url(#${scene}-ao)`} />
      <path d={`M${x},${y} l${dx},${-dy} h${width} l${-dx},${dy} Z`} fill={`url(#${gid}-top)`} />
      <rect x={x + width * 0.16} y={y + 3} width={Math.max(1.5, width * 0.1)} height={Math.max(0, height - 6)} fill="#fff" opacity="0.18" />
    </g>
  );
}

function BarTopLabel({ x, y, width, value, fill }) {
  if (!value) return null;
  const dx = barDepth(width);
  return (
    <text x={x + width / 2 + dx / 2} y={y - dx * 0.75 - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill={fill}>
      {value}
    </text>
  );
}

function BarH3D({ x, y, width, height, gid, scene }) {
  if (!(width > 0) || !(height > 0)) return null;
  const dx = Math.min(DEPTH * 0.8, height * 0.55), dy = dx * 0.75;
  return (
    <g className="an-3d-bar">
      <rect x={x + 4} y={y + height} width={width} height={5} rx={2.5} fill="#0f172a" opacity="0.22" filter={`url(#${scene}-blur)`} />
      <path d={`M${x},${y} l${dx},${-dy} h${width} l${-dx},${dy} Z`} fill={`url(#${gid}-top)`} />
      <path d={`M${x + width},${y} l${dx},${-dy} v${height} l${-dx},${dy} Z`} fill={`url(#${gid}-side)`} />
      <rect x={x} y={y} width={width} height={height} fill={`url(#${gid}-front)`} />
      <rect x={x + 2} y={y + height * 0.22} width={Math.max(0, width - 4)} height={Math.max(1, height * 0.12)} fill="#fff" opacity="0.2" />
    </g>
  );
}

function BarEndLabel({ x, y, width, height, value, fill }) {
  const dx = Math.min(DEPTH * 0.8, height * 0.55);
  return (
    <text x={x + width + dx + 6} y={y + height / 2} dominantBaseline="central" fontSize={11} fontWeight={600} fill={fill}>
      {value}
    </text>
  );
}

// The floor slab the vertical bars stand on (drawn via recharts <Customized>).
function Floor3D({ offset, fill, edge }) {
  if (!offset) return null;
  const L = offset.left, R = L + offset.width, B = offset.top + offset.height;
  const dx = DEPTH, dy = DEPTH * 0.75;
  return (
    <g>
      <path d={`M${L},${B} L${R},${B} L${R + dx},${B - dy} L${L + dx},${B - dy} Z`} fill={fill} />
      <path d={`M${L},${B} L${R},${B}`} stroke={edge} strokeWidth={1} />
    </g>
  );
}

const legendText = ink => value => <span style={{ color: ink }}>{value}</span>;

function TiltCard({ className = '', children }) {
  const ref = useRef(null);
  function onMove(e) {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--rx', `${(0.5 - py) * 10}deg`);
    el.style.setProperty('--ry', `${(px - 0.5) * 12}deg`);
    el.style.setProperty('--gx', `${px * 100}%`);
    el.style.setProperty('--gy', `${py * 100}%`);
  }
  function onLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  }
  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} className={`an-card an-tilt ${className}`}>
      {children}
      <span className="an-glare" aria-hidden="true" />
    </div>
  );
}

function KPICard({ label, value, sub, accent, icon }) {
  const { ink, inkMuted } = useChartTheme();
  return (
    <TiltCard className="p-5">
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: inkMuted }}>{label}</p>
          <p className="text-2xl font-bold mt-1.5" style={{ color: ink }}>{value ?? '—'}</p>
          {sub && <p className="text-xs mt-0.5" style={{ color: inkMuted }}>{sub}</p>}
        </div>
        <div className="an-pop an-icon p-2.5 rounded-xl text-white flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${shade(accent, 0.2)}, ${shade(accent, -0.15)})`, '--accent-shadow': `${accent}99` }}>
          <Icon name={icon} className="w-5 h-5" />
        </div>
      </div>
    </TiltCard>
  );
}

function ChartCard({ title, subtitle, children, className = '' }) {
  const { ink, inkMuted } = useChartTheme();
  return (
    <div className={`an-card p-6 ${className}`}>
      <h2 className="font-semibold" style={{ color: ink }}>{title}</h2>
      {subtitle && <p className="text-xs mt-0.5 mb-4" style={{ color: inkMuted }}>{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </div>
  );
}

function EmptyChart({ height = 'h-56' }) {
  const { inkMuted } = useChartTheme();
  return <div className={`flex items-center justify-center ${height} text-sm`} style={{ color: inkMuted }}>No data yet</div>;
}

/* ─── 3D donut ──────────────────────────────────────────────────────────────
   A ring tilted toward the viewer with real thickness. Angles run clockwise from
   12 o'clock; on screen, angles 0..π are the front half (outer wall visible) and
   the rest is the back half (inner wall visible through the hole). Slices are
   painted back-to-front so nearer ones overlap farther ones. Tilting makes front
   slices look a little larger, so the legend below always carries exact values. */
const TAU = Math.PI * 2;

function arcPoints(cx, cy, rx, ry, a0, a1) {
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 90)));
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  });
}
const pathOf = pts => `${pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(2)},${py.toFixed(2)}`).join(' ')} Z`;
const clipRange = (a0, a1, w0, w1) => {
  const s = Math.max(a0, w0), e = Math.min(a1, w1);
  return e > s ? [s, e] : null;
};

// legend="rows" stacks the legend for narrow cards so names never get cut off.
function Donut({ data, colorFor, centerLabel, legend = 'tiles' }) {
  const { ink, inkMuted, dark } = useChartTheme();
  const gid = useSvgId('dn');
  const boxRef = useRef(null);
  const [tip, setTip] = useState(null);
  const total = data.reduce((n, d) => n + d.value, 0);

  const W = 300, H = 200, cx = 150, cy = 82, R = 118, r = 66, T = 0.5, h = 24;
  let angle = -Math.PI / 2;
  const slices = data.filter(d => d.value > 0).map((d, i) => {
    const sweep = (d.value / total) * TAU;
    const s = { ...d, i, color: colorFor(d.name), a0: angle, a1: angle + sweep, mid: angle + sweep / 2 };
    angle += sweep;
    return s;
  });
  const backToFront = [...slices].sort((p, q) => Math.sin(p.mid) - Math.sin(q.mid));
  const wall = (rx, ry, [s, e]) => pathOf([...arcPoints(cx, cy, rx, ry, s, e), ...arcPoints(cx, cy + h, rx, ry, e, s)]);
  const topFace = s => pathOf([...arcPoints(cx, cy, R, R * T, s.a0, s.a1), ...arcPoints(cx, cy, r, r * T, s.a1, s.a0)]);

  function showTip(e, s) {
    const box = boxRef.current.getBoundingClientRect();
    setTip({ x: e.clientX - box.left, y: e.clientY - box.top, s });
  }

  return (
    <>
      <div ref={boxRef} className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full block mx-auto" style={{ maxWidth: 340 }}
          role="img" aria-label={slices.map(s => `${s.name} ${s.value}`).join(', ')}>
          <defs>
            <filter id={`${gid}-soft`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7" /></filter>
            <linearGradient id={`${gid}-gloss`} gradientUnits="userSpaceOnUse" x1={cx - R} y1={cy - R * T} x2={cx} y2={cy + R * T}>
              <stop offset="0%" stopColor="#fff" stopOpacity="0.38" />
              <stop offset="60%" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            {slices.map(s => [
              <linearGradient key={`t${s.i}`} id={`${gid}-top-${s.i}`} gradientUnits="userSpaceOnUse" x1={cx - R} y1={cy - R * T} x2={cx + R} y2={cy + R * T}>
                <stop offset="0%" stopColor={shade(s.color, 0.25)} />
                <stop offset="100%" stopColor={shade(s.color, -0.05)} />
              </linearGradient>,
              <linearGradient key={`o${s.i}`} id={`${gid}-out-${s.i}`} gradientUnits="userSpaceOnUse" x1={cx - R} y1="0" x2={cx + R} y2="0">
                <stop offset="0%" stopColor={shade(s.color, -0.5)} />
                <stop offset="38%" stopColor={shade(s.color, -0.12)} />
                <stop offset="62%" stopColor={shade(s.color, -0.2)} />
                <stop offset="100%" stopColor={shade(s.color, -0.55)} />
              </linearGradient>,
              <linearGradient key={`n${s.i}`} id={`${gid}-in-${s.i}`} gradientUnits="userSpaceOnUse" x1={cx - r} y1="0" x2={cx + r} y2="0">
                <stop offset="0%" stopColor={shade(s.color, -0.3)} />
                <stop offset="100%" stopColor={shade(s.color, -0.6)} />
              </linearGradient>,
            ])}
          </defs>

          <ellipse cx={cx} cy={cy + h + 10} rx={R * 0.95} ry={R * T * 0.8}
            fill="#0f172a" opacity={dark ? 0.6 : 0.22} filter={`url(#${gid}-soft)`} />

          {backToFront.map(s => {
            const lift = tip?.s.name === s.name ? 10 : 0;
            const outer = clipRange(s.a0, s.a1, 0, Math.PI);
            const inner = [clipRange(s.a0, s.a1, -Math.PI / 2, 0), clipRange(s.a0, s.a1, Math.PI, 1.5 * Math.PI)].filter(Boolean);
            return (
              <g key={s.name} className="an-3d-slice"
                style={{ transform: `translate(${Math.cos(s.mid) * lift}px, ${Math.sin(s.mid) * lift * T}px)` }}
                onMouseMove={e => showTip(e, s)} onMouseLeave={() => setTip(null)}>
                {inner.map((rng, k) => <path key={k} d={wall(r, r * T, rng)} fill={`url(#${gid}-in-${s.i})`} />)}
                {outer && <path d={wall(R, R * T, outer)} fill={`url(#${gid}-out-${s.i})`} />}
                <path d={topFace(s)} fill={`url(#${gid}-top-${s.i})`}
                  stroke="rgba(255,255,255,0.6)" strokeWidth={slices.length > 1 ? 1 : 0} strokeLinejoin="round" />
                <path d={topFace(s)} fill={`url(#${gid}-gloss)`} pointerEvents="none" />
              </g>
            );
          })}
        </svg>
        {tip && (
          <div className="an-tip" style={{ left: tip.x, top: tip.y }}>
            <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: tip.s.color }} />
            <b>{tip.s.name}</b>: {tip.s.value} ({total > 0 ? Math.round((tip.s.value / total) * 100) : 0}%)
          </div>
        )}
        <p className="text-center text-xs -mt-1" style={{ color: inkMuted }}>
          <span className="text-base font-bold mr-1" style={{ color: ink }}>{total}</span>{centerLabel.toLowerCase()} in total
        </p>
      </div>
      {legend === 'rows' ? (
        <div className="mt-3 space-y-1.5">
          {data.map(d => {
            const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
            return (
              <div key={d.name} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: dark ? 'rgba(255,255,255,0.04)' : '#f8fafc' }}>
                <span className="an-dot w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colorFor(d.name) }} />
                <span className="text-sm flex-1" style={{ color: inkMuted }}>{d.name}</span>
                <span className="text-sm font-bold" style={{ color: ink }}>{d.value}</span>
                <span className="text-xs w-9 text-right" style={{ color: inkMuted }}>{pct}%</span>
              </div>
            );
          })}
        </div>
      ) : (
      <div className="grid gap-2 mt-3" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
        {data.map(d => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
          return (
            <div key={d.name} className="rounded-lg px-2.5 py-2 min-w-0" style={{ background: dark ? 'rgba(255,255,255,0.04)' : '#f8fafc' }}>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="an-dot w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colorFor(d.name) }} />
                <span className="text-xs truncate" style={{ color: inkMuted }}>{d.name}</span>
              </div>
              <p className="text-lg font-bold mt-0.5" style={{ color: ink }}>
                {d.value} <span className="text-xs font-normal" style={{ color: inkMuted }}>{pct}%</span>
              </p>
            </div>
          );
        })}
      </div>
      )}
    </>
  );
}

/* ─── Quarterly ──────────────────────────────────────────────────────────── */
function sortQuarters(data) {
  return [...data].sort((a, b) => {
    const [yA, qA] = a.label.split(' Q').map(Number);
    const [yB, qB] = b.label.split(' Q').map(Number);
    return yA !== yB ? yA - yB : qA - qB;
  });
}

function QuarterlyTooltip({ active, payload, label }) {
  const { pal } = useChartTheme();
  if (!active || !payload?.length) return null;
  const total = payload.reduce((sum, p) => sum + (p.value || 0), 0);
  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-lg px-4 py-3 min-w-[180px]">
      <p className="text-sm font-semibold text-gray-800 dark:text-slate-100 border-b border-gray-100 dark:border-slate-700 pb-2 mb-2">{label}</p>
      <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">{total} total submission{total !== 1 ? 's' : ''}</p>
      <div className="space-y-1.5">
        {payload.map(entry => {
          const meta = TYPES.find(t => t.key === entry.dataKey);
          const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
          return (
            <div key={entry.dataKey} className="flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: pal[entry.dataKey] }} />
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

// Lists only the real series; the tube shadow/shine copies are left out.
// Month keys come from the server as "2026-10".
function monthDate(key) {
  const [year, month] = String(key).split('-').map(Number);
  return new Date(year, month - 1, 1);
}
const monthShort = key => monthDate(key).toLocaleString('en-US', { month: 'short' });
const monthLong = key => (/^\d{4}-\d{2}$/.test(key) ? monthDate(key).toLocaleString('en-US', { month: 'long', year: 'numeric' }) : key);

// The month under each point, with the full year under the first month and each
// January, so "Oct 26" can't be read as the 26th.
function MonthTick({ x, y, payload, index, color }) {
  const key = payload.value;
  const showYear = index === 0 || key.endsWith('-01');
  return (
    <g transform={`translate(${x},${y})`}>
      <text dy={12} textAnchor="middle" fontSize={11} fill={color}>{monthShort(key)}</text>
      {showYear && <text dy={25} textAnchor="middle" fontSize={10} fontWeight={700} fill={color}>{key.slice(0, 4)}</text>}
    </g>
  );
}

function MonthlyTooltip({ active, payload, label }) {
  const { pal } = useChartTheme();
  if (!active || !payload?.length) return null;
  const byKey = Object.fromEntries(payload.map(p => [p.dataKey, p.value]));
  const rows = [{ key: 'total', name: 'Total', color: pal.total }, ...TYPES.map(t => ({ ...t, color: pal[t.key] }))];
  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-lg px-4 py-3 min-w-[160px]">
      <p className="text-sm font-semibold text-gray-800 dark:text-slate-100 border-b border-gray-100 dark:border-slate-700 pb-2 mb-2">{monthLong(label)}</p>
      <div className="space-y-1.5">
        {rows.map(r => (
          <div key={r.key} className="flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: r.color }} />
              <span className="text-gray-600 dark:text-slate-300">{r.name}</span>
            </div>
            <span className="font-semibold text-gray-800 dark:text-slate-100">{byKey[r.key] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuarterlyChart({ data }) {
  const { dark, pal, grid, axisTick, ink, inkMuted } = useChartTheme();
  const gid = useSvgId('q');
  const sorted = sortQuarters(data);
  const grandTotal = sorted.reduce((s, q) => s + (q.total ?? 0), 0);
  const avgPerQuarter = sorted.length ? (grandTotal / sorted.length).toFixed(1) : 0;
  const peak = sorted.reduce((best, q) => ((q.total ?? 0) > (best?.total ?? 0) ? q : best), sorted[0]);
  const latest = sorted[sorted.length - 1];
  const tile = 'rounded-lg px-3 py-2.5';
  const tileStyle = { background: dark ? 'rgba(255,255,255,0.04)' : '#f8fafc' };

  return (
    <div className="an-card lg:col-span-2 overflow-hidden">
      <div className="px-6 pt-6 pb-4 border-b" style={{ borderColor: dark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }}>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h2 className="font-semibold text-lg" style={{ color: ink }}>Submissions by Quarter</h2>
            <p className="text-xs mt-1" style={{ color: inkMuted }}>Complaints, suggestions, and feedback grouped by fiscal quarter</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {TYPES.map(t => (
              <span key={t.key} className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: ink }}>
                <span className="an-dot w-2.5 h-2.5 rounded-full" style={{ background: pal[t.key] }} />
                {t.name}
              </span>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className={tile} style={tileStyle}>
            <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: inkMuted }}>All quarters</p>
            <p className="text-xl font-bold mt-0.5" style={{ color: ink }}>{grandTotal}</p>
          </div>
          <div className={tile} style={tileStyle}>
            <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: inkMuted }}>Peak quarter</p>
            <p className="text-xl font-bold mt-0.5" style={{ color: ink }}>{peak?.total ?? 0}</p>
            <p className="text-[10px] truncate" style={{ color: inkMuted }}>{peak?.label ?? '—'}</p>
          </div>
          <div className={tile} style={tileStyle}>
            <p className="text-[10px] uppercase tracking-wide font-semibold truncate" style={{ color: inkMuted }}>Latest ({latest?.label})</p>
            <p className="text-xl font-bold mt-0.5" style={{ color: ink }}>{latest?.total ?? 0}</p>
            <p className="text-[10px]" style={{ color: inkMuted }}>Avg {avgPerQuarter} / quarter</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 sm:px-6">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={sorted} margin={{ top: 28, right: 24, left: -8, bottom: 4 }} barGap={10} barCategoryGap="26%">
            <defs>
              {sceneDefs(gid)}
              {TYPES.map(t => cuboidDefs(`${gid}-${t.key}`, pal[t.key], false))}
            </defs>
            <CartesianGrid stroke={grid} vertical={false} />
            <Customized component={<Floor3D fill={dark ? 'rgba(255,255,255,0.05)' : '#eef2f7'} edge={dark ? '#475569' : '#cbd5e1'} />} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: axisTick, fontWeight: 500 }} axisLine={false} tickLine={false} dy={8} />
            <YAxis tick={{ fontSize: 11, fill: axisTick }} axisLine={false} tickLine={false} allowDecimals={false} width={36} />
            <Tooltip content={<QuarterlyTooltip />} cursor={{ fill: dark ? 'rgba(148,163,184,0.06)' : 'rgba(29,78,216,0.03)' }} />
            <ReferenceLine y={Number(avgPerQuarter)} stroke={inkMuted} strokeDasharray="6 4"
              label={{ value: `Avg ${avgPerQuarter}`, position: 'insideTopRight', fill: inkMuted, fontSize: 11 }} />
            {TYPES.map(t => (
              <Bar key={t.key} dataKey={t.key} name={t.name} maxBarSize={28} fill={pal[t.key]}
                shape={<Bar3D gid={`${gid}-${t.key}`} scene={gid} />}>
                <LabelList dataKey={t.key} content={<BarTopLabel fill={ink} />} />
              </Bar>
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
  const { dark, pal, surface, grid, axisTick, ink, inkMuted, tooltip } = useChartTheme();
  const monthlyId = useSvgId('m');
  const deptId = useSvgId('d');
  const [summary, setSummary]     = useState(null);
  const [quarterly, setQuarterly] = useState([]);
  const [monthly, setMonthly]     = useState([]);
  const [sentiment, setSentiment] = useState([]);
  const [breakdown, setBreakdown] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const gate = useSkeletonGate();

  useEffect(() => {
    gate(Promise.all([
      api.get('/analytics/summary'),
      api.get('/analytics/quarterly'),
      api.get('/analytics/monthly'),
      api.get('/analytics/sentiment'),
      api.get('/analytics/breakdown'),
    ])).then(([s, q, m, sent, b]) => {
      setSummary(s.data); setQuarterly(q.data); setMonthly(m.data);
      setSentiment(sent.data); setBreakdown(b.data); setLoading(false);
    }).catch(() => setLoading(false));
  }, [gate]);

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

  const departments = breakdown?.department || [];

  return (
    <div key={location.key} className="p-6 max-w-7xl mx-auto">
      <style>{analyticsCss}</style>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: dark ? '#f1f5f9' : '#1f2937' }}>Analytics</h1>
          <p className="text-sm mt-0.5" style={{ color: inkMuted }}>Performance metrics and submission insights</p>
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
        <KPICard label="Total Submissions" value={summary?.total} accent="#2563eb" icon="submissions" />
        <KPICard label="Response Rate" value={`${summary?.responseRate ?? 0}%`} accent="#7c3aed" icon="analytics" sub="Non-pending share" />
        <KPICard label="Avg Resolution" value={`${summary?.avgResolutionTime ?? 0}d`} accent="#0891b2" icon="clock" />
        <KPICard label="Registered Citizens" value={summary?.citizens} accent="#475569" icon="citizens" />
      </div>

      {/* Monthly Trend + Sentiment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        <ChartCard title="Monthly Trend" subtitle="Submissions over the last 12 months">
          {monthly.every(m => m.total === 0) ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={monthly} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id={`${monthlyId}-total`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={pal.total} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={pal.total} stopOpacity={0.02} />
                  </linearGradient>
                  <filter id={`${monthlyId}-tubeblur`} x="-10%" y="-40%" width="120%" height="180%">
                    <feGaussianBlur stdDeviation="3" />
                  </filter>
                </defs>
                <CartesianGrid stroke={grid} vertical={false} />
                <XAxis dataKey="key" interval={0} height={36} tick={<MonthTick color={axisTick} />}
                  axisLine={{ stroke: grid }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: axisTick }} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
                <Tooltip content={<MonthlyTooltip />} />
                {/* Explicit entries: the tube shadow/shine copies must not show up here */}
                <Legend iconSize={8} wrapperStyle={{ fontSize: '12px', paddingTop: 8 }} formatter={legendText(ink)}
                  payload={[
                    { id: 'total', value: 'Total', type: 'circle', color: pal.total },
                    ...TYPES.map(t => ({ id: t.key, value: t.name, type: 'circle', color: pal[t.key] })),
                  ]} />
                <Area type="monotone" dataKey="total" name="Total" stroke={pal.total} strokeWidth={2} fill={`url(#${monthlyId}-total)`}
                  activeDot={{ r: 4, fill: pal.total, stroke: surface, strokeWidth: 2 }} />
                {/* Glossy 3D tubes: a blurred shadow below, the colored tube, and a thin
                    highlight along its top. Only the tube shows in the legend/tooltip. */}
                {TYPES.flatMap(t => [
                  <Line key={`${t.key}-shadow`} type="monotone" dataKey={t.key} stroke="#0f172a"
                    strokeOpacity={dark ? 0.55 : 0.2} strokeWidth={6} dot={false} activeDot={false}
                    legendType="none" tooltipType="none"
                    style={{ filter: `url(#${monthlyId}-tubeblur)`, transform: 'translateY(5px)' }} />,
                  <Line key={t.key} type="monotone" dataKey={t.key} name={t.name} stroke={pal[t.key]}
                    strokeWidth={4} strokeLinecap="round" dot={false}
                    activeDot={{ r: 6, fill: pal[t.key], stroke: surface, strokeWidth: 2 }} />,
                  <Line key={`${t.key}-shine`} type="monotone" dataKey={t.key} stroke="#ffffff"
                    strokeOpacity={0.55} strokeWidth={1.2} strokeLinecap="round" dot={false} activeDot={false}
                    legendType="none" tooltipType="none" style={{ transform: 'translateY(-1px)' }} />,
                ])}
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Sentiment Distribution" subtitle="Tone analysis of submission descriptions">
          {sentimentTotal === 0 ? <EmptyChart /> : (
            <Donut data={sentiment} colorFor={name => pal[name] || pal.total} centerLabel="Submissions" />
          )}
        </ChartCard>
      </div>

      {/* Quarterly + By Type */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {quarterly.length === 0 ? (
          <ChartCard title="Submissions by Quarter" className="lg:col-span-2"><EmptyChart /></ChartCard>
        ) : (
          <QuarterlyChart data={quarterly} />
        )}

        <ChartCard title="By Type" subtitle="Share of all submissions">
          {!breakdown?.type?.length ? <EmptyChart /> : (
            <Donut data={breakdown.type} colorFor={name => pal[TYPE_KEY[name]] || pal.total} centerLabel="Submissions" legend="rows" />
          )}
        </ChartCard>
      </div>

      {/* By Department — one series, so one color for every bar */}
      <div className="mb-6">
        <ChartCard title="By Department" subtitle="Workload distribution across departments">
          {!departments.length ? <EmptyChart height="h-48" /> : (
            <ResponsiveContainer width="100%" height={Math.max(200, departments.length * 42 + 30)}>
              <BarChart data={departments} layout="vertical" margin={{ top: 12, right: 40, left: 10, bottom: 6 }} barCategoryGap="34%">
                <defs>
                  {sceneDefs(deptId)}
                  {cuboidDefs(`${deptId}-bar`, pal.single, true)}
                </defs>
                <CartesianGrid stroke={grid} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: axisTick }} allowDecimals={false} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: axisTick }} width={150} axisLine={false} tickLine={false} />
                <Tooltip {...tooltip} cursor={{ fill: dark ? 'rgba(148,163,184,0.06)' : 'rgba(29,78,216,0.03)' }} />
                <Bar dataKey="value" name="Submissions" fill={pal.single} maxBarSize={18}
                  shape={<BarH3D gid={`${deptId}-bar`} scene={deptId} />}>
                  <LabelList dataKey="value" content={<BarEndLabel fill={ink} />} />
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
                    <span style={{ color: inkMuted }}>{s.value} ({pct}%)</span>
                  </div>
                  <div className="an-track w-full rounded-full h-2.5" style={{ background: dark ? 'rgba(255,255,255,0.08)' : '#f1f5f9' }}>
                    <div className="an-fill h-2.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: s.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>

        <ChartCard title="Top Departments" subtitle="Departments most cited by citizen submissions" className="lg:col-span-2">
          {!breakdown?.departmentSelections?.length ? <EmptyChart height="h-40" /> : (
            <div className="space-y-3">
              {breakdown.departmentSelections.map((c, i) => {
                const max = breakdown.departmentSelections[0]?.value || 1;
                const pct = Math.round((c.value / max) * 100);
                return (
                  <div key={c.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium truncate pr-4" style={{ color: dark ? '#cbd5e1' : '#374151' }}>
                        <span style={{ color: inkMuted }} className="mr-2">{i + 1}.</span>{c.name}
                      </span>
                      <span className="flex-shrink-0" style={{ color: inkMuted }}>{c.value}</span>
                    </div>
                    <div className="an-track w-full rounded-full h-2.5" style={{ background: dark ? 'rgba(255,255,255,0.08)' : '#f1f5f9' }}>
                      <div className="an-fill h-2.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: pal.single }} />
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
