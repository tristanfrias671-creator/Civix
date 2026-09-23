import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SkeletonStatCards, SkeletonTable } from '../../components/common/Skeleton';
import { useTheme } from '../../context/ThemeContext';
import api from '../../utils/api';

function RoleBadge({ role }) {
  const styles = {
    ADMIN: 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300',
    STAFF: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300',
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${styles[role] || 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300'}`}>
      {role}
    </span>
  );
}

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AuditLog() {
  const { dark } = useTheme();
  const [logs,    setLogs]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const LIMIT = 20;

  useEffect(() => {
    setLoading(true);
    api.get(`/classify/audit-log?page=${page}&limit=${LIMIT}`)
      .then(r => {
        setLogs(r.data.logs || []);
        setTotal(r.data.total || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page]);

  const filtered = logs.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.trackingId?.toLowerCase().includes(q) ||
      l.changedByName?.toLowerCase().includes(q) ||
      l.fromDepartment?.toLowerCase().includes(q) ||
      l.toDepartment?.toLowerCase().includes(q) ||
      l.reason?.toLowerCase().includes(q)
    );
  });

  const pages = Math.ceil(total / LIMIT);

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Department Change Audit Log</h1>
        <p className="text-gray-500 dark:text-slate-400 text-sm mt-0.5">
          Full history of all manual department reassignments by admins and staff.
        </p>
      </div>

      {/* Summary strip */}
      {loading ? <SkeletonStatCards count={4} className="mb-5" /> : (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Total Changes', value: total, color: dark ? '#60a5fa' : '#2563eb', bg: dark ? 'rgba(37,99,235,0.15)' : '#dbeafe' },
          { label: 'This Page',     value: filtered.length, color: dark ? '#60a5fa' : '#2563eb', bg: dark ? 'rgba(37,99,235,0.15)' : '#dbeafe' },
          { label: 'With Reason',   value: logs.filter(l => l.reason).length, color: dark ? '#4ade80' : '#16a34a', bg: dark ? 'rgba(22,163,74,0.15)' : '#dcfce7' },
          { label: 'No Reason',     value: logs.filter(l => !l.reason).length, color: dark ? '#fbbf24' : '#d97706', bg: dark ? 'rgba(217,119,6,0.15)' : '#fef3c7' },
        ].map(c => (
          <div key={c.label} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-base font-bold flex-shrink-0"
              style={{ background: c.bg, color: c.color }}>
              {c.value}
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-slate-300 leading-tight">{c.label}</p>
          </div>
        ))}
      </div>
      )}

      {/* Table card */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
        {/* Filter bar */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-52">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by tracking ID, staff name, department, or reason..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <span className="text-xs text-gray-400 dark:text-slate-500 self-center">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="overflow-x-auto"><SkeletonTable cols={9} rows={10} /></div>
        ) : filtered.length === 0 ? (
          <div className="py-14 text-center">
            <svg className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
            <p className="text-gray-400 dark:text-slate-500 font-medium">No audit records found</p>
            <p className="text-xs text-gray-300 dark:text-slate-600 mt-1">
              {search ? 'Try adjusting your search.' : 'Department changes will appear here.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-900/40 text-xs text-gray-500 dark:text-slate-400 uppercase">
                <tr>
                  {['Date', 'Tracking ID', 'Changed By', 'Role', 'From Department', '', 'To Department', 'Reason', 'Action'].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-left font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
                {filtered.map((log, i) => (
                  <tr key={log.id} className={`hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors ${i % 2 !== 0 ? 'bg-gray-50 dark:bg-slate-900/20 bg-opacity-40' : ''}`}>
                    <td className="px-4 py-3 text-xs text-gray-400 dark:text-slate-500 whitespace-nowrap">
                      <p>{new Date(log.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      <p className="text-gray-300 dark:text-slate-600">{timeAgo(log.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">{log.trackingId}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {log.changedByName?.[0]?.toUpperCase() || '?'}
                        </div>
                        <span className="text-xs font-medium text-gray-700 dark:text-slate-300 whitespace-nowrap">{log.changedByName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap"><RoleBadge role={log.changedByRole} /></td>
                    <td className="px-4 py-3 max-w-xs">
                      <span className="px-2 py-0.5 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs rounded font-medium truncate block" style={{ maxWidth: 160 }}>
                        {log.fromDepartment}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-gray-400 dark:text-slate-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                      </svg>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <span className="px-2 py-0.5 bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 text-xs rounded font-medium truncate block" style={{ maxWidth: 160 }}>
                        {log.toDepartment}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400 max-w-xs">
                      {log.reason ? (
                        <span className="italic truncate block" style={{ maxWidth: 180 }}>"{log.reason}"</span>
                      ) : (
                        <span className="text-gray-300 dark:text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link to={`/admin/submissions/${log.submissionId}`}
                        className="flex items-center gap-1 px-3 py-1.5 bg-primary bg-opacity-10 dark:bg-opacity-20 text-primary text-xs font-semibold rounded-lg hover:bg-opacity-20 dark:hover:bg-opacity-30 transition-colors whitespace-nowrap">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                        </svg>
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="px-5 py-4 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between">
            <p className="text-xs text-gray-400 dark:text-slate-500">Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 text-xs font-semibold border border-gray-200 dark:border-slate-600 dark:text-slate-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-slate-700">
                Previous
              </button>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                className="px-3 py-1.5 text-xs font-semibold border border-gray-200 dark:border-slate-600 dark:text-slate-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-slate-700">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
