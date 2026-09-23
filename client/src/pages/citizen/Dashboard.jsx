import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import CitizenNav from '../../components/common/CitizenNav';
import { StatusBadge, TypeBadge } from '../../components/common/StatusBadge';
import { SkeletonStatCards, SkeletonList } from '../../components/common/Skeleton';
import Icon from '../../components/common/Icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../utils/api';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function StatCard({ label, value, color, icon, bg, bgDark }) {
  const { dark } = useTheme();
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 hover:shadow-md transition-shadow"
      style={{ boxShadow:'0 1px 6px rgba(0,0,0,0.06)' }}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
          <p className={`text-3xl font-bold mt-1.5 ${color}`}>{value}</p>
        </div>
        <div className="p-2.5 rounded-xl" style={{ background: dark ? (bgDark || 'rgba(255,255,255,0.08)') : bg }}>
          <Icon name={icon} className="w-6 h-6" style={{ color }} />
        </div>
      </div>
    </div>
  );
}

export default function CitizenDashboard() {
  const { user } = useAuth();
  const { dark } = useTheme();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/submissions?limit=5').then(r => {
      setSubmissions(r.data.submissions);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const total   = submissions.length;
  const pending = submissions.filter(s => s.status === 'PENDING').length;
  const resolved= submissions.filter(s => s.status === 'RESOLVED').length;

  const quickActions = dark
    ? [
        { to: '/submit', label: 'File a Complaint',  desc: 'Report an issue to the LGU',     icon: 'complaint',  accent: 'rgba(220,38,38,0.12)',  border: 'rgba(220,38,38,0.25)',  iconColor: '#f87171' },
        { to: '/submit', label: 'Give a Suggestion', desc: 'Share an idea for improvement',  icon: 'suggestion', accent: 'rgba(37,99,235,0.12)',  border: 'rgba(37,99,235,0.25)',  iconColor: '#60a5fa' },
        { to: '/submit', label: 'Submit Feedback',   desc: 'Rate your government experience', icon: 'feedback',   accent: 'rgba(22,163,74,0.12)',  border: 'rgba(22,163,74,0.25)',  iconColor: '#4ade80', type: 'FEEDBACK' },
      ]
    : [
        { to: '/submit', label: 'File a Complaint',  desc: 'Report an issue to the LGU',     icon: 'complaint',  accent: '#fef2f2', border: '#fecaca', iconColor: '#dc2626' },
        { to: '/submit', label: 'Give a Suggestion', desc: 'Share an idea for improvement',  icon: 'suggestion', accent: '#eff6ff', border: '#bfdbfe', iconColor: '#2563eb' },
        { to: '/submit', label: 'Submit Feedback',   desc: 'Rate your government experience', icon: 'feedback',   accent: '#f0fdf4', border: '#bbf7d0', iconColor: '#16a34a', type: 'FEEDBACK' },
      ];

  return (
    <div className="min-h-screen bg-gray-50">
      <CitizenNav />
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {greeting()}, {user?.fullName?.split(' ')[0]}!
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Citizen ID: <span className="font-mono font-medium text-gray-500">{user?.citizenId}</span>
            </p>
          </div>
          <Link to="/submit"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
            style={{ background:'linear-gradient(135deg,#6d28d9,#7c3aed)', boxShadow:'0 4px 14px rgba(109,40,217,0.35)' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            New Submission
          </Link>
        </div>

        {/* Stat cards */}
        {loading ? (
          <SkeletonStatCards count={3} className="mb-8" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <StatCard label="Total Submissions" value={total}    color="text-violet-600" icon="submissions" bg="#f5f3ff" bgDark="rgba(124,58,237,0.15)" />
            <StatCard label="Pending"           value={pending}  color="text-gray-600"   icon="clock"       bg="#f3f4f6" bgDark="rgba(255,255,255,0.06)" />
            <StatCard label="Resolved"          value={resolved} color="text-green-600"  icon="check"       bg="#f0fdf4" bgDark="rgba(22,163,74,0.15)" />
          </div>
        )}

        {/* Quick actions */}
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">What would you like to do?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {quickActions.map(b => (
            <Link key={b.label} to={b.to} state={b.type ? { type: b.type } : undefined}
              className="group rounded-2xl p-5 border transition-all hover:shadow-md hover:-translate-y-0.5"
              style={{ background: b.accent, borderColor: b.border }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
                style={{ background: dark ? 'rgba(255,255,255,0.08)' : 'white', boxShadow:`0 2px 8px ${b.border}` }}>
                <Icon name={b.icon} className="w-5 h-5" style={{ color: b.iconColor }} />
              </div>
              <p className="font-bold text-gray-800 text-sm">{b.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{b.desc}</p>
            </Link>
          ))}
        </div>

        {/* Recent submissions */}
        <div className="bg-white rounded-2xl border border-gray-100" style={{ boxShadow:'0 1px 6px rgba(0,0,0,0.06)' }}>
          <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="font-bold text-gray-900">Recent Submissions</h2>
              <p className="text-xs text-gray-400 mt-0.5">Your last {submissions.length} submissions</p>
            </div>
            <Link to="/track"
              className="text-sm font-semibold text-violet-600 hover:text-violet-700 flex items-center gap-1 transition-colors">
              View All
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
              </svg>
            </Link>
          </div>
          {loading ? (
            <div className="p-4"><SkeletonList rows={5} avatar={false} /></div>
          ) : submissions.length === 0 ? (
            <div className="py-14 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
                <Icon name="inbox" className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-sm font-semibold text-gray-400">No submissions yet</p>
              <p className="text-xs text-gray-300 mt-0.5">Start by filing a complaint or suggestion above</p>
            </div>
          ) : (
            <div>
              {submissions.map((s, i) => (
                <div key={s.id}
                  className="px-6 py-4 flex justify-between items-center hover:bg-gray-50 transition-colors cursor-default"
                  style={{ borderBottom: i < submissions.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                  <div className="min-w-0 mr-4">
                    <p className="font-mono text-xs text-gray-400">{s.trackingId}</p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5 truncate">{s.department}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(s.createdAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}</p>
                  </div>
                  <div className="flex gap-2 items-center flex-shrink-0">
                    <TypeBadge type={s.type} />
                    <StatusBadge status={s.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
