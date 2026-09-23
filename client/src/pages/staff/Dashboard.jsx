import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { StatusBadge, TypeBadge } from '../../components/common/StatusBadge';
import { Skel, SkeletonStatCards, SkeletonTable } from '../../components/common/Skeleton';
import Icon from '../../components/common/Icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../utils/api';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const QUICK_LINKS = [
  { to: '/staff/submissions', label: 'Assigned Complaints', desc: 'Cases in your department', icon: 'complaint', color: '#dc2626', bg: '#fef2f2', darkBg: 'rgba(220,38,38,0.12)' },
  { to: '/staff/monitor',     label: 'Service Requests',    desc: 'Monitor all departments', icon: 'search',    color: '#2563eb', bg: '#eff6ff', darkBg: 'rgba(37,99,235,0.12)' },
  { to: '/staff/notifications', label: 'Notifications',     desc: 'Recent activity',         icon: 'bell',      color: '#7c3aed', bg: '#f5f3ff', darkBg: 'rgba(124,58,237,0.12)' },
];

const CARD_STYLES_LIGHT = [
  { bg:'#f5f3ff', iconBg:'#ede9fe', iconColor:'#7c3aed' },
  { bg:'#fff7ed', iconBg:'#ffedd5', iconColor:'#ea580c' },
  { bg:'#eff6ff', iconBg:'#dbeafe', iconColor:'#2563eb' },
  { bg:'#f0fdf4', iconBg:'#dcfce7', iconColor:'#16a34a' },
  { bg:'#faf5ff', iconBg:'#f3e8ff', iconColor:'#9333ea' },
  { bg:'#fefce8', iconBg:'#fef9c3', iconColor:'#ca8a04' },
  { bg:'#f0f9ff', iconBg:'#e0f2fe', iconColor:'#0284c7' },
];
const CARD_STYLES_DARK = [
  { bg:'rgba(124,58,237,0.12)',  iconBg:'rgba(124,58,237,0.2)',  iconColor:'#a78bfa' },
  { bg:'rgba(234,88,12,0.12)',   iconBg:'rgba(234,88,12,0.2)',   iconColor:'#fb923c' },
  { bg:'rgba(37,99,235,0.12)',   iconBg:'rgba(37,99,235,0.2)',   iconColor:'#60a5fa' },
  { bg:'rgba(22,163,74,0.12)',   iconBg:'rgba(22,163,74,0.2)',   iconColor:'#4ade80' },
  { bg:'rgba(147,51,234,0.12)',  iconBg:'rgba(147,51,234,0.2)',  iconColor:'#c084fc' },
  { bg:'rgba(202,138,4,0.12)',   iconBg:'rgba(202,138,4,0.2)',   iconColor:'#facc15' },
  { bg:'rgba(2,132,199,0.12)',   iconBg:'rgba(2,132,199,0.2)',   iconColor:'#38bdf8' },
];

function KPICard({ label, value, sub, icon, styleIdx = 0 }) {
  const { dark } = useTheme();
  const styles = dark ? CARD_STYLES_DARK : CARD_STYLES_LIGHT;
  const s = styles[styleIdx % styles.length];
  return (
    <div className="rounded-2xl p-5 border hover:shadow-md transition-all hover:-translate-y-0.5"
      style={{ background: s.bg, borderColor: dark ? 'rgba(255,255,255,0.06)' : 'transparent', boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: dark ? '#94a3b8' : '#6b7280' }}>{label}</p>
          <p className="text-3xl font-extrabold mt-1.5" style={{ color: dark ? '#f1f5f9' : '#111827' }}>{value}</p>
          {sub && <p className="text-xs mt-0.5" style={{ color: dark ? '#64748b' : '#9ca3af' }}>{sub}</p>}
        </div>
        <div className="p-2.5 rounded-xl" style={{ background: s.iconBg, color: s.iconColor }}>
          <Icon name={icon} className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

export default function StaffDashboard() {
  const { user } = useAuth();
  const { dark } = useTheme();
  const navigate = useNavigate();
  const [stats,   setStats]   = useState(null);
  const [recent,  setRecent]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/staff/portal/stats'),
      api.get('/staff/portal/submissions?limit=8'),
    ]).then(([s, r]) => {
      setStats(s.data);
      setRecent(r.data.submissions);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-7 flex items-center gap-3.5">
        <Skel className="w-14 h-14 rounded-xl flex-shrink-0" />
        <div>
          <Skel className="h-3 w-40 mb-2" />
          <Skel className="h-6 w-56" />
        </div>
      </div>
      <SkeletonStatCards count={4} className="mb-4" />
      <SkeletonStatCards count={3} className="mb-7" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-7">
        {QUICK_LINKS.map(q => (
          <Link key={q.to} to={q.to}
            className="flex items-center gap-3 rounded-2xl p-4 border transition-all hover:-translate-y-0.5 hover:shadow-md"
            style={{ background: q.bg, borderColor: 'transparent' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white" style={{ background: q.color }}>
              <Icon name={q.icon} className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate text-gray-900">{q.label}</p>
              <p className="text-xs text-gray-400">{q.desc}</p>
            </div>
          </Link>
        ))}
      </div>
      <div className="rounded-2xl border bg-white border-gray-100" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
        <div className="px-6 py-4 border-b border-gray-100"><Skel className="h-4 w-48" /></div>
        <SkeletonTable cols={6} rows={8} />
      </div>
    </div>
  );

  const total       = Number(stats?.total      ?? 0);
  const pending     = Number(stats?.pending    ?? 0);
  const reviewing   = Number(stats?.reviewing  ?? 0);
  const inProgress  = Number(stats?.inProgress ?? 0);
  const resolved    = Number(stats?.resolved   ?? 0);
  const todayCount  = Number(stats?.todayCount ?? 0);
  const resolveRate = total > 0 ? ((resolved / total) * 100).toFixed(1) : '0.0';

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="mb-7 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3.5">
          <img src="/cantilan-seal.png" alt="Municipality of Cantilan" className="w-14 h-14 object-contain flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: dark ? '#64748b' : '#9ca3af' }}>Municipality of Cantilan</p>
            <h1 className="text-2xl font-extrabold leading-tight" style={{ color: dark ? '#f1f5f9' : '#111827' }}>
              {greeting()}{user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}
            </h1>
            <p className="text-sm mt-0.5 flex items-center gap-2" style={{ color: dark ? '#64748b' : '#9ca3af' }}>
              {new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
              {stats?.department && (
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full" style={{ background: dark ? 'rgba(37,99,235,0.18)' : '#eff6ff', color: dark ? '#93c5fd' : '#2563eb' }}>
                  {stats.department}
                </span>
              )}
            </p>
          </div>
        </div>
        <Link to="/staff/submissions"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
          style={{ background:'linear-gradient(135deg,#2563eb,#3b82f6)', boxShadow:'0 4px 14px rgba(37,99,235,0.3)' }}>
          View All Cases
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
          </svg>
        </Link>
      </div>

      {/* KPI row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <KPICard label="Assigned Complaints" value={total}      styleIdx={0} icon="submissions" sub={stats?.department} />
        <KPICard label="Pending"             value={pending}    styleIdx={1} icon="clock"       sub="Needs attention" />
        <KPICard label="In Progress"         value={inProgress} styleIdx={2} icon="activity" />
        <KPICard label="Resolved"            value={resolved}   styleIdx={3} icon="check" />
      </div>

      {/* KPI row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-7">
        <KPICard label="In Review"    value={reviewing}       styleIdx={4} icon="search" />
        <KPICard label="Resolve Rate" value={`${resolveRate}%`} styleIdx={5} icon="analytics" />
        <KPICard label="New Today"    value={todayCount}      styleIdx={6} icon="clock" />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-7">
        {QUICK_LINKS.map(q => (
          <Link key={q.to} to={q.to}
            className="flex items-center gap-3 rounded-2xl p-4 border transition-all hover:-translate-y-0.5 hover:shadow-md"
            style={{ background: dark ? q.darkBg : q.bg, borderColor: dark ? 'rgba(255,255,255,0.06)' : 'transparent' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white" style={{ background: q.color }}>
              <Icon name={q.icon} className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: dark ? '#f1f5f9' : '#111827' }}>{q.label}</p>
              <p className="text-xs" style={{ color: dark ? '#64748b' : '#9ca3af' }}>{q.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent submissions table */}
      <div className="rounded-2xl border" style={{ background: dark ? '#1e293b' : 'white', borderColor: dark ? 'rgba(255,255,255,0.06)' : '#f3f4f6', boxShadow:'0 1px 8px rgba(0,0,0,0.06)' }}>
        <div className="flex justify-between items-center px-6 py-4 border-b" style={{ borderColor: dark ? 'rgba(255,255,255,0.06)' : '#f3f4f6' }}>
          <div>
            <h2 className="font-bold" style={{ color: dark ? '#f1f5f9' : '#111827' }}>Complaint Management</h2>
            <p className="text-xs mt-0.5" style={{ color: dark ? '#64748b' : '#9ca3af' }}>Recent cases assigned to your department</p>
          </div>
          <Link to="/staff/submissions" className="text-sm font-bold flex items-center gap-1 transition-colors" style={{ color: '#2563eb' }}>
            View All
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
            </svg>
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: dark ? 'rgba(255,255,255,0.05)' : '#f3f4f6' }}>
              <Icon name="submissions" className="w-7 h-7" style={{ color: dark ? '#475569' : '#d1d5db' }} />
            </div>
            <p className="text-sm font-medium" style={{ color: dark ? '#64748b' : '#9ca3af' }}>No cases assigned yet.</p>
            <p className="text-xs mt-1" style={{ color: dark ? '#475569' : '#d1d5db' }}>Cases routed to your department will appear here.</p>
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: dark ? 'rgba(255,255,255,0.03)' : '#f9fafb', borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : '#f3f4f6'}` }}>
                {['Tracking ID','Citizen','Type','Status','Date','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide" style={{ color: dark ? '#64748b' : '#6b7280' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.map((s, i) => {
                const isAnon = !s.user?.fullName;
                return (
                <tr key={s.id}
                  className="transition-colors"
                  style={{ borderBottom: i < recent.length - 1 ? `1px solid ${dark ? 'rgba(255,255,255,0.04)' : '#f9fafb'}` : 'none' }}
                  onMouseEnter={e => e.currentTarget.style.background = dark ? 'rgba(37,99,235,0.08)' : 'rgba(37,99,235,0.04)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td className="px-4 py-3.5 font-mono text-xs" style={{ color: dark ? '#64748b' : '#9ca3af' }}>{s.trackingId}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={isAnon
                          ? { background: dark ? '#334155' : '#f3f4f6', color: dark ? '#64748b' : '#9ca3af' }
                          : { background: dark ? 'rgba(37,99,235,0.2)' : '#dbeafe', color: dark ? '#60a5fa' : '#2563eb' }}>
                        {isAnon ? <Icon name="citizens" className="w-3.5 h-3.5" /> : s.user.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-xs truncate" style={{ color: isAnon ? (dark ? '#64748b' : '#9ca3af') : (dark ? '#e2e8f0' : '#1f2937'), fontStyle: isAnon ? 'italic' : 'normal' }}>
                          {isAnon ? 'Anonymous' : s.user.fullName}
                        </p>
                        <p className="text-xs truncate" style={{ color: dark ? '#64748b' : '#9ca3af' }}>
                          {isAnon ? (s.contactNumber || 'No contact provided') : s.user.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5"><TypeBadge type={s.type} /></td>
                  <td className="px-4 py-3.5"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-3.5 text-xs whitespace-nowrap" style={{ color: dark ? '#64748b' : '#9ca3af' }}>
                    {new Date(s.createdAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
                  </td>
                  <td className="px-4 py-3.5">
                    <button onClick={() => navigate('/staff/monitor')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap"
                      style={{ background: dark ? 'rgba(37,99,235,0.15)' : 'rgba(37,99,235,0.08)', color: '#2563eb' }}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                      </svg>
                      View
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </div>
  );
}
