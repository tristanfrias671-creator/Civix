import React from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icons';
import { useTheme } from '../../context/ThemeContext';

// The number cards on the admin and staff dashboards, so both portals match.
// `stack` puts the icon above the text on phones (cards sit two per row there);
// `to` makes the whole card a link.
const TONES_LIGHT = {
  purple: { bg: '#f5f3ff', iconBg: '#ede9fe', iconColor: '#7c3aed' },
  orange: { bg: '#fff7ed', iconBg: '#ffedd5', iconColor: '#ea580c' },
  green:  { bg: '#f0fdf4', iconBg: '#dcfce7', iconColor: '#16a34a' },
  blue:   { bg: '#eff6ff', iconBg: '#dbeafe', iconColor: '#2563eb' },
  violet: { bg: '#faf5ff', iconBg: '#f3e8ff', iconColor: '#9333ea' },
  yellow: { bg: '#fefce8', iconBg: '#fef9c3', iconColor: '#ca8a04' },
  sky:    { bg: '#f0f9ff', iconBg: '#e0f2fe', iconColor: '#0284c7' },
  red:    { bg: '#fef2f2', iconBg: '#fee2e2', iconColor: '#dc2626' },
};
const TONES_DARK = {
  purple: { bg: 'rgba(124,58,237,0.12)', iconBg: 'rgba(124,58,237,0.2)', iconColor: '#a78bfa' },
  orange: { bg: 'rgba(234,88,12,0.12)',  iconBg: 'rgba(234,88,12,0.2)',  iconColor: '#fb923c' },
  green:  { bg: 'rgba(22,163,74,0.12)',  iconBg: 'rgba(22,163,74,0.2)',  iconColor: '#4ade80' },
  blue:   { bg: 'rgba(37,99,235,0.12)',  iconBg: 'rgba(37,99,235,0.2)',  iconColor: '#60a5fa' },
  violet: { bg: 'rgba(147,51,234,0.12)', iconBg: 'rgba(147,51,234,0.2)', iconColor: '#c084fc' },
  yellow: { bg: 'rgba(202,138,4,0.12)',  iconBg: 'rgba(202,138,4,0.2)',  iconColor: '#facc15' },
  sky:    { bg: 'rgba(2,132,199,0.12)',  iconBg: 'rgba(2,132,199,0.2)',  iconColor: '#38bdf8' },
  red:    { bg: 'rgba(220,38,38,0.12)',  iconBg: 'rgba(220,38,38,0.2)',  iconColor: '#f87171' },
};

export default function StatCard({ label, value, sub, icon, tone = 'blue', stack = false, to }) {
  const { dark } = useTheme();
  const s = (dark ? TONES_DARK : TONES_LIGHT)[tone] || TONES_LIGHT.blue;
  const className = 'block rounded-2xl p-4 sm:p-5 border hover:shadow-md transition-all hover:-translate-y-0.5';
  const style = { background: s.bg, borderColor: dark ? 'rgba(255,255,255,0.06)' : 'transparent', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' };
  const body = (
    <div className={`flex justify-between gap-3 ${stack ? 'flex-col-reverse items-start sm:flex-row' : 'items-start'}`}>
      <div className="min-w-0">
        <p className="text-[13px] sm:text-sm font-semibold leading-snug" style={{ color: dark ? '#cbd5e1' : '#4b5563' }}>{label}</p>
        <p className="text-[28px] sm:text-[38px] font-bold leading-none tracking-tight tabular-nums mt-2.5" style={{ color: dark ? '#f1f5f9' : '#0f172a' }}>{value}</p>
        {sub && <p className="text-[12.5px] sm:text-[13px] font-medium mt-2" style={{ color: dark ? '#94a3b8' : '#4b5563' }}>{sub}</p>}
      </div>
      <div className="p-2.5 rounded-xl flex-shrink-0" style={{ background: s.iconBg, color: s.iconColor }}>
        <Icon name={icon} className="w-6 h-6" />
      </div>
    </div>
  );
  return to
    ? <Link to={to} className={className} style={style}>{body}</Link>
    : <div className={className} style={style}>{body}</div>;
}
