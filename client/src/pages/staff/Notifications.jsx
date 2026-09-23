import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { StatusBadge, TypeBadge } from '../../components/common/StatusBadge';
import { SkeletonStatCards, SkeletonTable } from '../../components/common/Skeleton';
import api from '../../utils/api';

const STATUS_OPTIONS = ['', 'PENDING', 'REVIEWING', 'IN_PROGRESS', 'RESOLVED'];
const STATUS_LABELS  = { PENDING: 'Pending', REVIEWING: 'Reviewing', IN_PROGRESS: 'In Progress', RESOLVED: 'Resolved' };

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)     return 'Just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function StaffNotifications() {
  const navigate = useNavigate();
  const { dark } = useTheme();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter,   setTypeFilter]   = useState('');
  const [search, setSearch]             = useState('');

  useEffect(() => {
    api.get('/staff/portal/submissions?limit=30')
      .then(r => { setSubmissions(r.data.submissions || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const pending    = submissions.filter(s => s.status === 'PENDING').length;
  const reviewing  = submissions.filter(s => s.status === 'REVIEWING').length;
  const inProgress = submissions.filter(s => s.status === 'IN_PROGRESS').length;
  const resolved   = submissions.filter(s => s.status === 'RESOLVED').length;
  const unread     = pending + reviewing;

  const filtered = submissions.filter(s => {
    if (statusFilter && s.status !== statusFilter) return false;
    if (typeFilter   && s.type   !== typeFilter)   return false;
    if (search) {
      const q = search.toLowerCase();
      if (!s.trackingId.toLowerCase().includes(q) &&
          !s.user?.fullName?.toLowerCase().includes(q) &&
          !s.description?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* ── Page Header ── */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-800">Notifications</h1>
          {unread > 0 && (
            <span className="px-2.5 py-0.5 bg-red-100 text-red-600 text-xs font-bold rounded-full">
              {unread} unread
            </span>
          )}
        </div>
        <p className="text-gray-500 text-sm mt-0.5">
          Stay updated on your assigned cases and citizen submissions.
        </p>
      </div>

      {/* ── Summary row ── */}
      {loading ? <SkeletonStatCards count={4} className="mb-5" /> : (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        {(dark ? [
          { label: 'Pending',     count: pending,    color: '#fbbf24', bg: 'rgba(217,119,6,0.15)',  border: 'rgba(217,119,6,0.3)' },
          { label: 'Reviewing',   count: reviewing,  color: '#60a5fa', bg: 'rgba(37,99,235,0.15)',  border: 'rgba(37,99,235,0.3)' },
          { label: 'In Progress', count: inProgress, color: '#a78bfa', bg: 'rgba(124,58,237,0.15)', border: 'rgba(124,58,237,0.3)' },
          { label: 'Resolved',    count: resolved,   color: '#4ade80', bg: 'rgba(22,163,74,0.15)',  border: 'rgba(22,163,74,0.3)' },
        ] : [
          { label: 'Pending',     count: pending,    color: '#d97706', bg: '#fef3c7', border: '#fde68a' },
          { label: 'Reviewing',   count: reviewing,  color: '#2563eb', bg: '#dbeafe', border: '#bfdbfe' },
          { label: 'In Progress', count: inProgress, color: '#7c3aed', bg: '#ede9fe', border: '#c4b5fd' },
          { label: 'Resolved',    count: resolved,   color: '#16a34a', bg: '#dcfce7', border: '#bbf7d0' },
        ]).map(c => (
          <div key={c.label}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setStatusFilter(prev => prev === c.label.toUpperCase().replace(' ', '_') ? '' : c.label.toUpperCase().replace(' ', '_'))}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold flex-shrink-0"
              style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
              {c.count}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">{c.label}</p>
              <p className="text-xs text-gray-400">cases</p>
            </div>
          </div>
        ))}
      </div>
      )}

      {/* ── List card ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">

        {/* Filters */}
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-52">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by ID, citizen name, or description..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.filter(Boolean).map(s => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">All Types</option>
            <option value="COMPLAINT">Complaint</option>
            <option value="SUGGESTION">Suggestion</option>
            <option value="FEEDBACK">Feedback</option>
          </select>
          <span className="ml-auto text-xs text-gray-400 self-center">{filtered.length} notifications</span>
        </div>

        {/* List */}
        {loading ? (
          <div className="overflow-x-auto"><SkeletonTable cols={8} rows={10} /></div>
        ) : filtered.length === 0 ? (
          <div className="py-14 text-center">
            <svg className="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
            </svg>
            <p className="text-gray-400 font-medium">No notifications found</p>
            <p className="text-xs text-gray-300 mt-1">
              {search || statusFilter || typeFilter ? 'Try adjusting your filters.' : "You're all caught up!"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  {['', 'Tracking ID', 'Citizen', 'Type', 'Description', 'Status', 'Received', 'Action'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((s, i) => {
                  const needsAction = s.status === 'PENDING' || s.status === 'REVIEWING';
                  return (
                    <tr key={s.id}
                      className={`hover:bg-gray-50 transition-colors ${i % 2 !== 0 ? 'bg-gray-50 bg-opacity-40' : ''}`}>

                      {/* Unread dot */}
                      <td className="px-3 py-3 w-6">
                        {needsAction && (
                          <span className="block w-2 h-2 rounded-full bg-red-500 mx-auto" />
                        )}
                      </td>

                      {/* Tracking ID */}
                      <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">
                        {s.trackingId}
                      </td>

                      {/* Citizen */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${s.user?.fullName ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                            {s.user?.fullName?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <p className={`font-medium text-xs whitespace-nowrap ${s.user?.fullName ? 'text-gray-800' : 'text-gray-400 italic'}`}>{s.user?.fullName || 'Anonymous'}</p>
                            <p className="text-gray-400 text-xs">{s.user?.email || s.contactNumber || 'No contact provided'}</p>
                          </div>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <TypeBadge type={s.type} />
                      </td>

                      {/* Description */}
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-xs">
                        <p className="truncate" style={{ maxWidth: 200 }}>{s.description || '—'}</p>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={s.status} />
                      </td>

                      {/* Time */}
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {timeAgo(s.createdAt)}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3">
                        <button onClick={() => navigate('/staff/monitor')}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary bg-opacity-10 text-primary text-xs font-semibold rounded-lg hover:bg-opacity-20 transition-colors whitespace-nowrap">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                          </svg>
                          Handle
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
