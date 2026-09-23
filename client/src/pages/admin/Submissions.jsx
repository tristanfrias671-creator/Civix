import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { StatusBadge, TypeBadge } from '../../components/common/StatusBadge';
import { SkeletonTable } from '../../components/common/Skeleton';
import { useTheme } from '../../context/ThemeContext';
import api from '../../utils/api';

const STATUS_OPTS = ['', 'PENDING', 'REVIEWING', 'IN_PROGRESS', 'RESOLVED'];
const STATUS_LABELS = { '':'All Statuses', PENDING:'Pending', REVIEWING:'Reviewing', IN_PROGRESS:'In Progress', RESOLVED:'Resolved' };

export default function AdminSubmissions({ type: typeFilter }) {
  const { dark } = useTheme();
  const location = useLocation();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState(location.state?.search || '');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 15 });
    if (typeFilter) params.append('type', typeFilter);
    if (statusFilter) params.append('status', statusFilter);
    api.get(`/submissions?${params}`).then(r => {
      setSubmissions(r.data.submissions);
      setTotalPages(r.data.pages);
      setTotal(r.data.total ?? r.data.submissions.length);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [typeFilter, statusFilter, page]);

  const filtered = search
    ? submissions.filter(s =>
        s.trackingId.toLowerCase().includes(search.toLowerCase()) ||
        s.user?.fullName?.toLowerCase().includes(search.toLowerCase()) ||
        s.department.toLowerCase().includes(search.toLowerCase())
      )
    : submissions;

  const title = typeFilter
    ? typeFilter.charAt(0) + typeFilter.slice(1).toLowerCase() + 's'
    : 'All Submissions';

  const textPrimary = dark ? '#f1f5f9' : '#111827';
  const textMuted = dark ? '#64748b' : '#9ca3af';
  const border = dark ? 'rgba(255,255,255,0.06)' : '#f3f4f6';

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: textPrimary }}>{title}</h1>
          <p className="text-sm mt-0.5" style={{ color: textMuted }}>{total} submission{total !== 1 ? 's' : ''} total</p>
        </div>
      </div>

      <div className="rounded-2xl border" style={{ background: dark ? '#1e293b' : 'white', borderColor: border, boxShadow:'0 1px 8px rgba(0,0,0,0.06)' }}>

        {/* Toolbar */}
        <div className="px-5 py-4 border-b flex flex-wrap gap-3 items-center" style={{ borderColor: border }}>
          {/* Search */}
          <div className="relative flex-1 min-w-52">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: textMuted }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/>
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by ID, citizen, or department..."
              className="w-full pl-10 pr-4 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all"
              style={{
                border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`,
                background: dark ? '#0f172a' : '#f9fafb',
                color: textPrimary,
                '--tw-ring-color': '#2563eb',
              }} />
          </div>

          {/* Status filter pills */}
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_OPTS.map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={statusFilter === s
                  ? { background:'#2563eb', color:'white', boxShadow:'0 2px 8px rgba(37,99,235,0.3)' }
                  : { background: dark ? 'rgba(255,255,255,0.06)' : '#f3f4f6', color: dark ? '#94a3b8' : '#6b7280' }}>
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="overflow-x-auto"><SkeletonTable cols={7} rows={10} /></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: dark ? 'rgba(255,255,255,0.03)' : '#f9fafb', borderBottom: `1px solid ${border}` }}>
                    {['Tracking ID','Citizen','Type','Status','Department','Date',''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: dark ? '#64748b' : '#6b7280' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-14 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: dark ? 'rgba(255,255,255,0.05)' : '#f9fafb' }}>
                            <svg className="w-6 h-6" style={{ color: dark ? '#475569' : '#d1d5db' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
                            </svg>
                          </div>
                          <p className="text-sm font-semibold" style={{ color: dark ? '#64748b' : '#9ca3af' }}>No submissions found</p>
                          <p className="text-xs" style={{ color: dark ? '#475569' : '#d1d5db' }}>Try adjusting your search or filter</p>
                        </div>
                      </td>
                    </tr>
                  ) : filtered.map((s, i) => (
                    <tr key={s.id}
                      className="transition-colors"
                      style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${dark ? 'rgba(255,255,255,0.04)' : '#f9fafb'}` : 'none' }}
                      onMouseEnter={e => e.currentTarget.style.background = dark ? 'rgba(37,99,235,0.08)' : 'rgba(37,99,235,0.04)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td className="px-4 py-3.5 font-mono text-xs whitespace-nowrap" style={{ color: textMuted }}>{s.trackingId}</td>
                      <td className="px-4 py-3.5 font-semibold whitespace-nowrap" style={s.user?.fullName ? { color: dark ? '#e2e8f0' : '#1f2937' } : { color: dark ? '#64748b' : '#9ca3af', fontStyle: 'italic' }}>{s.user?.fullName || 'Anonymous'}</td>
                      <td className="px-4 py-3.5"><TypeBadge type={s.type} /></td>
                      <td className="px-4 py-3.5"><StatusBadge status={s.status} /></td>
                      <td className="px-4 py-3.5 text-xs font-medium max-w-36 truncate" style={{ color: dark ? '#94a3b8' : '#6b7280' }}>{s.department}</td>
                      <td className="px-4 py-3.5 text-xs whitespace-nowrap" style={{ color: textMuted }}>{new Date(s.createdAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}</td>
                      <td className="px-4 py-3.5">
                        <Link to={`/admin/submissions/${s.id}`}
                          className="inline-flex items-center gap-1 text-xs font-bold transition-colors" style={{ color: '#2563eb' }}>
                          View
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                          </svg>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-5 py-4 border-t flex justify-between items-center" style={{ borderColor: border }}>
              <p className="text-xs font-medium" style={{ color: textMuted }}>
                Page <span className="font-bold" style={{ color: dark ? '#cbd5e1' : '#374151' }}>{page}</span> of <span className="font-bold" style={{ color: dark ? '#cbd5e1' : '#374151' }}>{totalPages}</span>
              </p>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40 transition-colors"
                  style={{ border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'}`, color: dark ? '#cbd5e1' : '#374151' }}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
                  </svg>
                  Previous
                </button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40 transition-colors"
                  style={{ border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'}`, color: dark ? '#cbd5e1' : '#374151' }}>
                  Next
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                  </svg>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
