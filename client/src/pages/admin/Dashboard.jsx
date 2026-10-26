import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge, TypeBadge, PriorityBadge } from '../../components/common/StatusBadge';
import { Skel, SkeletonStatCards, SkeletonQuickLinks, SkeletonTable, useSkeletonGate } from '../../components/common/Skeleton';
import Icon from '../../components/common/Icons';
import StatCard from '../../components/common/StatCard';
import PhotoViewer from '../../components/common/PhotoViewer';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../utils/api';
import { mediaUrl } from '../../utils/mediaUrl';
import useMobileTable from '../../utils/useMobileTable';

// "5 min ago", "3 h ago", "Oct 12"
function timeAgo(date) {
  const minutes = Math.floor((Date.now() - new Date(date)) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h ago`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// The offices' latest status updates, with the photos staff attached as proof of
// the work. A photo opens full size; the tracking code opens the report.
function OfficeUpdatesCard({ dark }) {
  const [updates, setUpdates] = useState(null);
  const [viewer, setViewer] = useState(null);
  useEffect(() => {
    api.get('/analytics/office-updates?limit=6').then(r => setUpdates(r.data)).catch(() => setUpdates([]));
  }, []);
  const ink = dark ? '#f1f5f9' : '#0f172a';
  const muted = dark ? '#94a3b8' : '#4b5563';
  const line = dark ? 'rgba(255,255,255,0.06)' : '#f3f4f6';
  return (
    <div className="rounded-2xl border mt-7" style={{ background: dark ? '#1e293b' : 'white', borderColor: line, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
      <div className="px-6 py-4 border-b" style={{ borderColor: line }}>
        <h2 className="text-[17px] font-bold tracking-tight" style={{ color: ink }}>Latest Office Updates</h2>
        <p className="text-[13px] mt-0.5" style={{ color: muted }}>What the offices' staff did on their reports, with photos of the work</p>
      </div>
      {updates === null ? (
        <div className="p-6 space-y-3"><Skel className="h-14 w-full" /><Skel className="h-14 w-full" /></div>
      ) : updates.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm font-medium" style={{ color: muted }}>No updates from the offices yet.</p>
      ) : (
        <ul>
          {updates.map((u, i) => (
            <li key={u.id} className="px-6 py-4" style={{ borderTop: i ? `1px solid ${line}` : 'none' }}>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <StatusBadge status={u.status} />
                <Link to={`/admin/submissions/${u.submissionId}`} className="font-mono text-xs font-semibold hover:underline" style={{ color: dark ? '#93c5fd' : '#1d4ed8' }}>
                  {u.trackingId}
                </Link>
                <span className="text-xs" style={{ color: muted }}>{timeAgo(u.createdAt)}</span>
              </div>
              <p className="text-sm mt-1.5" style={{ color: ink }}>
                <span className="font-semibold">{u.updatedByName}</span>
                <span style={{ color: muted }}> · {u.submission?.department}</span>
              </p>
              {u.note && <p className="text-sm mt-1 line-clamp-2" style={{ color: muted }}>“{u.note}”</p>}
              {u.photos.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {u.photos.map((p, k) => (
                    <button key={p.id} type="button" aria-label={`Open photo ${k + 1} of ${u.photos.length} for ${u.trackingId}`}
                      onClick={() => setViewer({ photos: u.photos, index: k, caption: `${u.trackingId} · ${u.updatedByName}` })}
                      className="w-14 h-14 rounded-lg overflow-hidden border hover:opacity-85 transition-opacity" style={{ borderColor: line }}>
                      <img src={mediaUrl(p.filePath)} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {viewer && (
        <PhotoViewer photos={viewer.photos} index={viewer.index} caption={viewer.caption} alt="Photo of the work from the office"
          onIndex={index => setViewer(v => ({ ...v, index }))} onClose={() => setViewer(null)} />
      )}
    </div>
  );
}

const QUICK_LINKS = [
  { to: '/admin/complaints', label: 'Complaints', icon: 'complaint', color: '#dc2626', bg: '#fef2f2', darkBg: 'rgba(220,38,38,0.12)' },
  { to: '/admin/suggestions', label: 'Suggestions', icon: 'suggestion', color: '#2563eb', bg: '#eff6ff', darkBg: 'rgba(37,99,235,0.12)' },
  { to: '/admin/feedback', label: 'Feedback', icon: 'feedback', color: '#16a34a', bg: '#f0fdf4', darkBg: 'rgba(22,163,74,0.12)' },
  { to: '/admin/analytics', label: 'Analytics', icon: 'analytics', color: '#7c3aed', bg: '#f5f3ff', darkBg: 'rgba(124,58,237,0.12)' },
];

export default function AdminDashboard() {
  const { user } = useAuth();
  const { dark } = useTheme();
  const [stats, setStats] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const gate = useSkeletonGate();
  const tableRef = useMobileTable();

  useEffect(() => {
    gate(Promise.all([
      api.get('/analytics/summary'),
      api.get('/submissions?limit=8'),
    ])).then(([s, sub]) => {
      setStats(s.data);
      setSubmissions(sub.data.submissions);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [gate]);

  if (loading) return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-7"><Skel className="h-3 w-32 mb-2" /><Skel className="h-6 w-64" /></div>
      <SkeletonStatCards count={4} className="mb-4" />
      <SkeletonStatCards count={4} className="mb-7" />
      <SkeletonQuickLinks count={QUICK_LINKS.length} className="grid-cols-2 lg:grid-cols-4 mb-7" />
      <div className="rounded-2xl border bg-white border-gray-100" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
        <div className="px-6 py-4 border-b border-gray-100"><Skel className="h-4 w-44" /></div>
        <SkeletonTable cols={6} rows={8} />
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="mb-7 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight leading-tight" style={{ color: dark ? '#f1f5f9' : '#0f172a' }}>
            Welcome back{user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}
          </h1>
          <p className="text-sm sm:text-[15px] mt-1" style={{ color: dark ? '#94a3b8' : '#4b5563' }}>
            {new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
          </p>
        </div>
        <Link to="/admin/submissions"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
          style={{ background:'linear-gradient(135deg,#1d4ed8,#2563eb)', boxShadow:'0 4px 14px rgba(37,99,235,0.3)' }}>
          View All Submissions
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
          </svg>
        </Link>
      </div>

      {/* KPI row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard stack label="Total Submissions" value={stats?.total ?? 0}                tone="purple" icon="submissions" />
        <StatCard stack label="Pending"           value={stats?.pending ?? 0}              tone="orange" icon="clock"       sub="Needs attention" />
        <StatCard stack label="Resolved"          value={stats?.resolved ?? 0}             tone="green" icon="check" />
        <StatCard stack label="Response Rate"     value={`${stats?.responseRate ?? 0}%`}   tone="blue" icon="analytics"   sub={`${stats?.avgResolutionTime} days avg`} />
      </div>

      {/* KPI row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        <StatCard stack label="In Review"      value={stats?.reviewing  ?? 0} tone="violet" icon="search" />
        <StatCard stack label="In Progress"    value={stats?.inProgress ?? 0} tone="yellow" icon="activity" />
        <StatCard stack label="Overdue"        value={stats?.overdue    ?? 0} tone="red" icon="complaint" sub="Past their deadline" />
        <StatCard stack label="Total Citizens" value={stats?.citizens   ?? 0} tone="sky" icon="citizens" />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        {QUICK_LINKS.map(q => (
          <Link key={q.to} to={q.to}
            className="group flex items-center gap-3.5 rounded-2xl p-4 border transition-all hover:-translate-y-0.5 hover:shadow-md"
            style={{ background: dark ? q.darkBg : q.bg, borderColor: dark ? 'rgba(255,255,255,0.06)' : 'transparent' }}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-white" style={{ background: q.color }}>
              <Icon name={q.icon} className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[15px] sm:text-base font-semibold leading-tight truncate" style={{ color: dark ? '#f1f5f9' : '#0f172a' }}>{q.label}</p>
              <p className="flex items-center gap-1 text-[13px] font-medium mt-1" style={{ color: dark ? '#94a3b8' : '#4b5563' }}>
                View all
                <svg className="w-3 h-3 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                </svg>
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent submissions table */}
      <div className="rounded-2xl border" style={{ background: dark ? '#1e293b' : 'white', borderColor: dark ? 'rgba(255,255,255,0.06)' : '#f3f4f6', boxShadow:'0 1px 8px rgba(0,0,0,0.06)' }}>
        <div className="flex justify-between items-center px-6 py-4 border-b" style={{ borderColor: dark ? 'rgba(255,255,255,0.06)' : '#f3f4f6' }}>
          <div>
            <h2 className="text-[17px] font-bold tracking-tight" style={{ color: dark ? '#f1f5f9' : '#0f172a' }}>Recent Submissions</h2>
            <p className="text-[13px] mt-0.5" style={{ color: dark ? '#94a3b8' : '#4b5563' }}>Latest activity across all departments</p>
          </div>
          <Link to="/admin/submissions" className="text-sm font-bold flex items-center gap-1 transition-colors" style={{ color: dark ? '#60a5fa' : '#2563eb' }}>
            View All
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
            </svg>
          </Link>
        </div>
        {submissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: dark ? 'rgba(255,255,255,0.05)' : '#f3f4f6' }}>
              <span style={{ color: dark ? '#94a3b8' : '#6b7280' }}><Icon name="submissions" className="w-7 h-7" /></span>
            </div>
            <p className="text-sm font-medium" style={{ color: dark ? '#94a3b8' : '#4b5563' }}>No submissions yet.</p>
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table ref={tableRef} className="mobile-cards w-full text-sm">
            <thead>
              <tr style={{ background: dark ? 'rgba(255,255,255,0.03)' : '#f9fafb', borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : '#f3f4f6'}` }}>
                {['Transaction Code','Citizen','Type','Department','Status','Date'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide" style={{ color: dark ? '#94a3b8' : '#4b5563' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {submissions.map((s, i) => (
                <tr key={s.id}
                  className="transition-colors"
                  style={{ borderBottom: i < submissions.length - 1 ? `1px solid ${dark ? 'rgba(255,255,255,0.04)' : '#f9fafb'}` : 'none' }}
                  onMouseEnter={e => e.currentTarget.style.background = dark ? 'rgba(37,99,235,0.08)' : 'rgba(37,99,235,0.04)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td className="px-4 py-3.5 font-mono text-xs" style={{ color: dark ? '#94a3b8' : '#4b5563' }}>{s.trackingId}</td>
                  <td className="px-4 py-3.5 font-semibold" style={s.user?.fullName ? { color: dark ? '#e2e8f0' : '#1f2937' } : { color: dark ? '#94a3b8' : '#4b5563', fontStyle: 'italic' }}>{s.user?.fullName || 'Anonymous'}</td>
                  <td className="px-4 py-3.5">
                    {/* How urgent, when it isn't Normal */}
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      <TypeBadge type={s.type} />
                      {s.type !== 'FEEDBACK' && s.priority !== 'STANDARD' && <PriorityBadge priority={s.priority} />}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 max-w-40 truncate" style={{ color: dark ? '#94a3b8' : '#4b5563' }}>{s.department}</td>
                  <td className="px-4 py-3.5"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-3.5 text-xs whitespace-nowrap" style={{ color: dark ? '#94a3b8' : '#4b5563' }}>{new Date(s.createdAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>

      <OfficeUpdatesCard dark={dark} />
    </div>
  );
}
