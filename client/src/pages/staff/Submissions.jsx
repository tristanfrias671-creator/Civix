import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { TypeBadge, PriorityBadge } from '../../components/common/StatusBadge';
import { Skel, SkeletonTable } from '../../components/common/Skeleton';
import { mediaUrl } from '../../utils/mediaUrl';
import api from '../../utils/api';

const STATUS_OPTIONS = ['PENDING', 'REVIEWING', 'IN_PROGRESS', 'RESOLVED'];
const STATUS_CONFIG = {
  PENDING:     { label: 'Pending',     color: 'text-gray-600',  bg: 'bg-gray-100',   dot: '#6B7280' },
  REVIEWING:   { label: 'Reviewing',   color: 'text-blue-600',  bg: 'bg-blue-100',   dot: '#1D4ED8' },
  IN_PROGRESS: { label: 'In Progress', color: 'text-amber-600', bg: 'bg-amber-100',  dot: '#CA8A04' },
  RESOLVED:    { label: 'Resolved',    color: 'text-green-600', bg: 'bg-green-100',  dot: '#16A34A' },
};
const TYPE_CONFIG = {
  COMPLAINT:  { color: 'text-red-700',  bg: 'bg-red-100'   },
  SUGGESTION: { color: 'text-blue-700', bg: 'bg-blue-100'  },
  FEEDBACK:   { color: 'text-green-700',bg: 'bg-green-100' },
};

const DEPARTMENTS = [
  "Mayor's Office – CRMO", 'HR', 'Tourism', 'Motorpool', 'Traffic',
  'CSDO', 'OSCA', 'MDRRMO',
  'Municipal Budget Office', 'Municipal Accountant Office',
  'Municipal Agriculture Office', 'Municipal Health Office',
  'Municipal Civil Registry Office',
  'Municipal Social Welfare & Development Office',
  'Municipal Economic & Natural Resource Office',
  'Municipal Treasurer Office', 'Municipal Engineering Office',
  'Municipal Planning & Development Office',
  'Sangguniang Bayan Office', 'Office of the Vice Mayor',
];

const modalCss = `
@keyframes ssOverlayIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes ssCardIn { 0% { opacity: 0; transform: translateY(16px) scale(0.96); } 60% { opacity: 1; transform: translateY(-2px) scale(1.005); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes ssLbIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
.ss-overlay { animation: ssOverlayIn .2s ease both; }
.ss-card { animation: ssCardIn .35s cubic-bezier(.22,1,.36,1) both; }
.ss-lb { animation: ssLbIn .25s cubic-bezier(.22,1,.36,1) both; }
.ss-photo { transition: transform .2s ease, box-shadow .2s ease; }
.ss-photo:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.15); }
`;

function StatusBadge({ status }) {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${c.bg} ${c.color}`}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
      {c.label}
    </span>
  );
}

// Inline status updater dropdown
function StatusUpdater({ submission, onUpdated }) {
  const [updating, setUpdating] = useState(false);

  async function handleChange(e) {
    const newStatus = e.target.value;
    if (newStatus === submission.status) return;
    setUpdating(true);
    try {
      const res = await api.patch(`/staff/portal/submission/${submission.id}`, { status: newStatus });
      onUpdated(res.data);
      toast.success('Status updated & citizen notified');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    } finally { setUpdating(false); }
  }

  const c = STATUS_CONFIG[submission.status] || STATUS_CONFIG.PENDING;
  return (
    <div className="relative">
      <select value={submission.status} onChange={handleChange} disabled={updating}
        className={`pr-7 pl-2.5 py-1 rounded-full text-xs font-semibold border-0 outline-none cursor-pointer ${c.bg} ${c.color} disabled:opacity-60`}
        style={{ appearance: 'none' }}>
        {STATUS_OPTIONS.map(s => (
          <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
        ))}
      </select>
      {updating
        ? <svg className="absolute right-1.5 top-1/2 -translate-y-1/2 animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
        : <svg className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
      }
    </div>
  );
}

function PhotoLightbox({ media, index, onClose, onNavigate }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onNavigate(1);
      if (e.key === 'ArrowLeft') onNavigate(-1);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, onNavigate]);

  const item = media[index];
  return (
    <div className="ss-overlay fixed inset-0 z-[60] flex items-center justify-center p-6"
      style={{ background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <button type="button" onClick={onClose} aria-label="Close"
        className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
      {media.length > 1 && (
        <>
          <button type="button" onClick={e => { e.stopPropagation(); onNavigate(-1); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 19l-7-7 7-7"/></svg>
          </button>
          <button type="button" onClick={e => { e.stopPropagation(); onNavigate(1); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7"/></svg>
          </button>
        </>
      )}
      <img key={item.id} src={mediaUrl(item.filePath)} alt="attachment"
        className="ss-lb max-w-full max-h-[80vh] rounded-xl shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
      {media.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold text-white" style={{ background: 'rgba(255,255,255,0.15)' }}>
          {index + 1} / {media.length}
        </div>
      )}
    </div>
  );
}

function DetailModal({ id, onClose, onUpdated, onReassigned }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [reassignDept, setReassignDept] = useState('');
  const [reassigning, setReassigning] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    api.get(`/staff/portal/submission/${id}`)
      .then(r => { setDetail(r.data); setReassignDept(r.data.department); setNewStatus(r.data.status); })
      .catch(() => toast.error('Failed to load submission details'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleStatusUpdate() {
    if (newStatus === detail.status) return;
    setUpdatingStatus(true);
    try {
      const res = await api.patch(`/staff/portal/submission/${detail.id}`, { status: newStatus, note: statusNote.trim() || undefined });
      setDetail(res.data);
      onUpdated(res.data);
      setStatusNote('');
      toast.success('Status updated & citizen notified');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleReassign() {
    if (reassignDept === detail.department) return;
    setReassigning(true);
    try {
      await api.patch(`/staff/portal/assign/${detail.id}`, { department: reassignDept });
      toast.success(`Reassigned to ${reassignDept} — moved out of your queue`);
      onReassigned(detail.id);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reassign');
    } finally {
      setReassigning(false);
    }
  }

  const isAnon = detail && !detail.user?.fullName;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <style>{modalCss}</style>
      <div className="ss-card bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {loading ? (
          <div className="p-6">
            <div className="flex items-start justify-between mb-5">
              <div className="flex-1">
                <Skel className="h-3 w-40 mb-2" />
                <Skel className="h-5 w-56" />
              </div>
              <Skel className="h-6 w-16" />
            </div>
            <Skel className="h-10 w-full mb-4" />
            <Skel className="h-24 w-full mb-4" />
            <Skel className="h-16 w-full mb-4" />
            <Skel className="h-16 w-full" />
          </div>
        ) : !detail ? (
          <div className="py-24 text-center text-gray-400">Could not load this submission.</div>
        ) : (
          <>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-start justify-between z-10">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className="font-mono text-xs text-gray-400">{detail.trackingId}</span>
                  <TypeBadge type={detail.type} />
                  <PriorityBadge priority={detail.priority} />
                </div>
                <h2 className="text-lg font-bold text-gray-800">{detail.department}</h2>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors flex-shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Status control with optional note */}
              <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Update Status</span>
                  <div className="relative">
                    <select value={newStatus} onChange={e => setNewStatus(e.target.value)} disabled={updatingStatus}
                      className={`pr-7 pl-2.5 py-1 rounded-full text-xs font-semibold border-0 outline-none cursor-pointer ${STATUS_CONFIG[newStatus]?.bg} ${STATUS_CONFIG[newStatus]?.color} disabled:opacity-60`}
                      style={{ appearance: 'none' }}>
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                    </select>
                    <svg className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                  </div>
                </div>
                {newStatus !== detail.status && (
                  <>
                    <textarea value={statusNote} onChange={e => setStatusNote(e.target.value)} rows={2}
                      placeholder="Add a note for this update (optional) — the citizen and your team will see it..."
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white resize-none" />
                    <button type="button" onClick={handleStatusUpdate} disabled={updatingStatus}
                      className="w-full py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                      {updatingStatus ? 'Updating...' : `Update to ${STATUS_CONFIG[newStatus]?.label}`}
                    </button>
                  </>
                )}
              </div>

              {/* Update history */}
              {detail.statusLogs?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Update History</p>
                  <div className="space-y-2.5 max-h-40 overflow-y-auto pr-1">
                    {detail.statusLogs.map(log => (
                      <div key={log.id} className="flex items-start gap-2.5 text-xs">
                        <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: STATUS_CONFIG[log.status]?.dot }} />
                        <div className="min-w-0">
                          <p className="text-gray-700">
                            <span className="font-semibold">{log.updatedByName}</span> set status to{' '}
                            <span className="font-semibold">{STATUS_CONFIG[log.status]?.label}</span>
                            <span className="text-gray-400"> · {new Date(log.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                          </p>
                          {log.note && <p className="text-gray-500 mt-0.5 italic">"{log.note}"</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reassign department */}
              <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4M16 17H4m0 0l4 4m-4-4l4-4"/>
                    </svg>
                    <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">Wrong Department?</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select value={reassignDept} onChange={e => setReassignDept(e.target.value)}
                      className="px-2.5 py-1.5 border border-amber-200 rounded-lg text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <button type="button" onClick={handleReassign}
                      disabled={reassignDept === detail.department || reassigning}
                      className="px-3 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap">
                      {reassigning ? 'Moving...' : 'Reassign'}
                    </button>
                  </div>
                </div>
                {reassignDept !== detail.department && (
                  <p className="text-xs text-amber-700 mt-2">
                    This will move the case out of your ({detail.department}) queue into <strong>{reassignDept}</strong>.
                  </p>
                )}
              </div>

              {/* Citizen info */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Citizen</p>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${isAnon ? 'bg-gray-100 text-gray-400' : 'bg-indigo-100 text-indigo-700'}`}>
                    {isAnon
                      ? <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M12.5 7a4 4 0 11-8 0 4 4 0 018 0zM20 8v6M23 11h-6"/></svg>
                      : detail.user.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${isAnon ? 'text-gray-400 italic' : 'text-gray-800'}`}>{isAnon ? 'Anonymous' : detail.user.fullName}</p>
                    <p className="text-xs text-gray-400">{isAnon ? (detail.contactNumber || 'No contact provided') : detail.user.email}</p>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Description</p>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{detail.description}</p>
              </div>

              {/* Location */}
              {(detail.address || detail.location) && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Location</p>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                    {detail.address || `${detail.location.latitude.toFixed(5)}, ${detail.location.longitude.toFixed(5)}`}
                  </div>
                </div>
              )}

              {/* Photos */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                  Attached Photos {detail.media?.length > 0 && `(${detail.media.length})`}
                </p>
                {detail.media?.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2">
                    {detail.media.map((m, i) => (
                      <button key={m.id} type="button" onClick={() => setLightboxIndex(i)}
                        className="ss-photo relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                        <img src={mediaUrl(m.filePath)} alt="attachment" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">No photos were attached to this report.</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {lightboxIndex !== null && detail?.media?.length > 0 && (
        <PhotoLightbox
          media={detail.media}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={delta => setLightboxIndex(i => (i + delta + detail.media.length) % detail.media.length)}
        />
      )}
    </div>
  );
}

export default function StaffSubmissions() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter,   setTypeFilter]   = useState('');
  const [search, setSearch]             = useState('');
  const [page, setPage]                 = useState(1);
  const [totalPages, setTotalPages]     = useState(1);
  const [total, setTotal]               = useState(0);
  const [department, setDepartment]     = useState('');
  const [detailId, setDetailId]         = useState(null);
  const [sortByPriority, setSortByPriority] = useState(false);

  function fetchSubmissions(p = 1) {
    setLoading(true);
    const params = new URLSearchParams({ page: p, limit: 15 });
    if (statusFilter) params.append('status', statusFilter);
    if (typeFilter)   params.append('type',   typeFilter);
    if (sortByPriority) params.append('sortBy', 'priority');
    api.get(`/staff/portal/submissions?${params}`)
      .then(r => {
        setSubmissions(r.data.submissions);
        setTotal(r.data.total);
        setTotalPages(r.data.pages);
        setDepartment(r.data.department || '');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => { fetchSubmissions(1); setPage(1); }, [statusFilter, typeFilter, sortByPriority]);

  function handleUpdated(updated) {
    setSubmissions(prev => prev.map(s => s.id === updated.id ? updated : s));
  }

  function handleReassigned(id) {
    setSubmissions(prev => prev.filter(s => s.id !== id));
    setTotal(prev => Math.max(0, prev - 1));
  }

  const filtered = search
    ? submissions.filter(s =>
        s.trackingId.toLowerCase().includes(search.toLowerCase()) ||
        s.user?.fullName?.toLowerCase().includes(search.toLowerCase())
      )
    : submissions;

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">My Department Submissions</h1>
          {department && (
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full">
                {department}
              </span>
              <span className="text-sm text-gray-400">{total} total</span>
            </div>
          )}
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

        {/* Filters */}
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by ID or citizen name..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
          </select>
          <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">All Types</option>
            <option value="COMPLAINT">Complaint</option>
            <option value="SUGGESTION">Suggestion</option>
            <option value="FEEDBACK">Feedback</option>
          </select>
          <button type="button" onClick={() => { setSortByPriority(v => !v); setPage(1); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
              sortByPriority ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9M3 12h5m6-4l4-4m0 0l4 4m-4-4v16"/>
            </svg>
            Sort by Priority
          </button>
        </div>

        {loading ? (
          <div className="overflow-x-auto"><SkeletonTable cols={8} rows={10} /></div>
        ) : filtered.length === 0 ? (
          <div className="py-14 text-center text-gray-400">
            <svg className="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            <p className="font-medium text-gray-500">No submissions found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    {['Tracking ID', 'Citizen', 'Type', 'Priority', 'Description', 'Update Status', 'Date', 'Actions'].map(h => (
                      <th key={h} className={`px-4 py-3 text-left font-semibold whitespace-nowrap ${h === 'Priority' && sortByPriority ? 'text-indigo-600' : ''}`}>
                        {h}{h === 'Priority' && sortByPriority && ' ↓'}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((s, i) => {
                    const isAnon = !s.user?.fullName;
                    return (
                      <tr key={s.id} className={`hover:bg-gray-50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50 bg-opacity-50'}`}>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{s.trackingId}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isAnon ? 'bg-gray-100 text-gray-400' : 'bg-indigo-100 text-indigo-700'}`}>
                              {isAnon
                                ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M12.5 7a4 4 0 11-8 0 4 4 0 018 0zM20 8v6M23 11h-6"/></svg>
                                : s.user.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className={`font-semibold text-xs truncate ${isAnon ? 'text-gray-400 italic' : 'text-gray-800'}`}>{isAnon ? 'Anonymous' : s.user.fullName}</p>
                              <p className="text-gray-400 text-xs truncate">{isAnon ? (s.contactNumber || 'No contact') : s.user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${(TYPE_CONFIG[s.type] || TYPE_CONFIG.COMPLAINT).bg} ${(TYPE_CONFIG[s.type] || TYPE_CONFIG.COMPLAINT).color}`}>
                            {s.type.charAt(0) + s.type.slice(1).toLowerCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3"><PriorityBadge priority={s.priority} /></td>
                        <td className="px-4 py-3 text-gray-600 text-xs max-w-xs">
                          <p className="truncate" style={{ maxWidth: 200 }}>
                            {s.description}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <StatusUpdater submission={s} onUpdated={handleUpdated} />
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                          {new Date(s.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => setDetailId(s.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-lg hover:bg-indigo-100 transition-colors whitespace-nowrap">
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

            {/* Pagination */}
            <div className="px-5 py-4 border-t border-gray-100 flex justify-between items-center">
              <p className="text-sm text-gray-500">Page {page} of {totalPages} · {total} submissions</p>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => { setPage(p => p - 1); fetchSubmissions(page - 1); }}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50 transition-colors">
                  ← Prev
                </button>
                <button disabled={page >= totalPages} onClick={() => { setPage(p => p + 1); fetchSubmissions(page + 1); }}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50 transition-colors">
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {detailId && (
        <DetailModal id={detailId} onClose={() => setDetailId(null)} onUpdated={handleUpdated} onReassigned={handleReassigned} />
      )}
    </div>
  );
}
