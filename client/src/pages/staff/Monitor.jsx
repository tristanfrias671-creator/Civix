import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { StatusBadge, TypeBadge } from '../../components/common/StatusBadge';
import { SkeletonTable } from '../../components/common/Skeleton';
import api from '../../utils/api';
import { mediaUrl } from '../../utils/mediaUrl';

const lightboxCss = `
@keyframes mnLbOverlayIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes mnLbImageIn { 0% { opacity: 0; transform: scale(0.9); } 60% { opacity: 1; transform: scale(1.02); } 100% { opacity: 1; transform: scale(1); } }
.mn-lb-overlay { animation: mnLbOverlayIn .2s ease both; }
.mn-lb-image { animation: mnLbImageIn .3s cubic-bezier(.22,1,.36,1) both; }
.mn-photo { transition: transform .2s ease, box-shadow .2s ease; }
.mn-photo:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.15); }
`;

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
    <div className="mn-lb-overlay fixed inset-0 z-[70] flex items-center justify-center p-6"
      style={{ background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <style>{lightboxCss}</style>
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
        className="mn-lb-image max-w-full max-h-[80vh] rounded-xl shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
      {media.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold text-white" style={{ background: 'rgba(255,255,255,0.15)' }}>
          {index + 1} / {media.length}
        </div>
      )}
    </div>
  );
}

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

const STATUS_OPTIONS = ['PENDING', 'REVIEWING', 'IN_PROGRESS', 'RESOLVED'];
const STATUS_LABELS  = { PENDING: 'Pending', REVIEWING: 'Reviewing', IN_PROGRESS: 'In Progress', RESOLVED: 'Resolved' };

// ── Track panel (slide-in detail view) ──────────────────────────────────────
function TrackPanel({ submission, onClose, onUpdated }) {
  const [dept,     setDept]     = useState(submission?.department || '');
  const [status,   setStatus]   = useState(submission?.status    || '');
  const [note,     setNote]     = useState('');
  const [saving,   setSaving]   = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  useEffect(() => {
    if (submission) { setDept(submission.department || ''); setStatus(submission.status); setNote(''); }
  }, [submission]);

  if (!submission) return null;

  async function handleSave() {
    setSaving(true);
    try {
      const res = await api.patch(`/staff/portal/assign/${submission.id}`, { department: dept, status, note: note.trim() || undefined });
      toast.success('Submission updated successfully');
      onUpdated(res.data);
      setNote('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update');
    } finally { setSaving(false); }
  }

  const timeline = [
    { label: 'Submitted',    done: true,                          color: '#6B7280' },
    { label: 'Reviewing',    done: ['REVIEWING','IN_PROGRESS','RESOLVED'].includes(submission.status), color: '#1D4ED8' },
    { label: 'In Progress',  done: ['IN_PROGRESS','RESOLVED'].includes(submission.status), color: '#CA8A04' },
    { label: 'Resolved',     done: submission.status === 'RESOLVED', color: '#16A34A' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(15,23,42,0.45)' }}
      onClick={onClose}>
      <div className="bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50 flex-shrink-0">
          <div>
            <p className="font-mono text-xs text-gray-400">{submission.trackingId}</p>
            <h2 className="font-bold text-gray-800 mt-0.5">{submission.department}</h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 px-6 py-5 space-y-5">

          {/* Citizen info */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Citizen Information</p>
            <p className={submission.user?.fullName ? 'font-semibold text-gray-800' : 'font-semibold text-gray-400 italic'}>
              {submission.user?.fullName || 'Anonymous'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {submission.user?.email || submission.contactNumber || (submission.user?.fullName ? '' : 'No contact provided')}
            </p>
          </div>

          {/* Type + current status */}
          <div className="flex gap-2">
            <TypeBadge type={submission.type} />
            <StatusBadge status={submission.status} />
          </div>

          {/* Description */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description</p>
            <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-xl p-3">
              {submission.description}
            </p>
          </div>

          {/* Attached photos */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Attached Photos {submission.media?.length > 0 && `(${submission.media.length})`}
            </p>
            {submission.media?.length > 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {submission.media.map((m, i) => (
                  <button key={m.id} type="button" onClick={() => setLightboxIndex(i)}
                    className="mn-photo relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                    <img src={mediaUrl(m.filePath)} alt="attachment" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">No photos were attached to this report.</p>
            )}
          </div>

          {/* Timeline tracker */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Progress Timeline</p>
            <div className="relative">
              <div className="absolute left-3 top-3 bottom-3 w-0.5 bg-gray-200" />
              <div className="space-y-4">
                {timeline.map(({ label, done, color }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center z-10 flex-shrink-0 border-2 ${done ? 'border-transparent' : 'border-gray-300 bg-white'}`}
                      style={done ? { background: color } : {}}>
                      {done
                        ? <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                        : <span className="w-2 h-2 rounded-full bg-gray-300" />}
                    </div>
                    <span className={`text-sm font-medium ${done ? 'text-gray-800' : 'text-gray-400'}`}>{label}</span>
                    {done && label === STATUS_LABELS[submission.status] && (
                      <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: color + '20', color }}>Current</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Date info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400">Date Submitted</p>
              <p className="text-sm font-semibold text-gray-700 mt-0.5">
                {new Date(submission.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400">Last Updated</p>
              <p className="text-sm font-semibold text-gray-700 mt-0.5">
                {new Date(submission.updatedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* ── Assign / Update section ── */}
          <div className="border border-blue-100 bg-blue-50 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Assign &amp; Update</p>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Assign Department</label>
              <select value={dept} onChange={e => setDept(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white">
                <option value="">— Keep current —</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Update Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white">
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>

            {status !== submission.status && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Note (optional)</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                  placeholder="Add a note for this update — the citizen and your team will see it..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary bg-white resize-none" />
              </div>
            )}

            <button onClick={handleSave} disabled={saving}
              className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {saving
                ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>Saving...</>
                : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {lightboxIndex !== null && submission.media?.length > 0 && (
        <PhotoLightbox
          media={submission.media}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={delta => setLightboxIndex(i => (i + delta + submission.media.length) % submission.media.length)}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
export default function Monitor() {
  const [submissions, setSubmissions] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [draftSearch, setDraftSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter,   setTypeFilter]   = useState('');
  const [deptFilter,   setDeptFilter]   = useState('');
  const [page,         setPage]         = useState(1);
  const [totalPages,   setTotalPages]   = useState(1);
  const [total,        setTotal]        = useState(0);
  const [selected,     setSelected]     = useState(null);

  // Track-by-ID input
  const [trackId,     setTrackId]     = useState('');
  const [tracking,    setTracking]    = useState(false);

  function fetchData(p = 1, s = search) {
    setLoading(true);
    const params = new URLSearchParams({ page: p, limit: 15 });
    if (statusFilter) params.append('status',     statusFilter);
    if (typeFilter)   params.append('type',       typeFilter);
    if (deptFilter)   params.append('department', deptFilter);
    if (s)            params.append('search',     s);
    api.get(`/staff/portal/monitor?${params}`)
      .then(r => {
        setSubmissions(r.data.submissions);
        setTotal(r.data.total);
        setTotalPages(r.data.pages);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => { fetchData(1); setPage(1); }, [statusFilter, typeFilter, deptFilter]);

  function handleSearch(e) {
    e.preventDefault();
    setSearch(draftSearch);
    fetchData(1, draftSearch);
    setPage(1);
  }

  async function handleTrack(e) {
    e.preventDefault();
    if (!trackId.trim()) return;
    setTracking(true);
    try {
      const res = await api.get(`/staff/portal/track/${trackId.trim()}`);
      setSelected(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Tracking ID not found');
    } finally { setTracking(false); }
  }

  function handleUpdated(updated) {
    setSubmissions(prev => prev.map(s => s.id === updated.id ? updated : s));
    setSelected(updated);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Track &amp; Monitor</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          View, track, and assign all citizen submissions across departments.
        </p>
      </div>

      {/* Track by ID bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Track Submission by ID</p>
        <form onSubmit={handleTrack} className="flex gap-2">
          <input value={trackId} onChange={e => setTrackId(e.target.value)}
            placeholder="Enter Tracking ID — e.g. CIVIX-20260523-ABC123"
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <button type="submit" disabled={tracking || !trackId.trim()}
            className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2">
            {tracking
              ? <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
              : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>}
            Track
          </button>
        </form>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">

        {/* Filters */}
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap gap-3">
          {/* Search */}
          <form onSubmit={handleSearch} className="relative flex-1 min-w-52">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={draftSearch} onChange={e => setDraftSearch(e.target.value)}
              placeholder="Search by ID, citizen, or description..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </form>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">All Types</option>
            <option value="COMPLAINT">Complaint</option>
            <option value="SUGGESTION">Suggestion</option>
            <option value="FEEDBACK">Feedback</option>
          </select>
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary max-w-xs">
            <option value="">All Departments</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <span className="ml-auto text-xs text-gray-400 self-center">{total} submissions</span>
        </div>

        {/* Table */}
        {loading ? (
          <div className="overflow-x-auto"><SkeletonTable cols={7} rows={10} /></div>
        ) : submissions.length === 0 ? (
          <div className="py-14 text-center">
            <svg className="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            <p className="text-gray-400 font-medium">No submissions found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    {['Tracking ID', 'Citizen', 'Type', 'Department', 'Status', 'Date', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {submissions.map((s, i) => (
                    <tr key={s.id} className={`hover:bg-gray-50 transition-colors ${i % 2 !== 0 ? 'bg-gray-50 bg-opacity-40' : ''}`}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{s.trackingId}</td>
                      <td className={`px-4 py-3 font-medium whitespace-nowrap ${s.user?.fullName ? 'text-gray-800' : 'text-gray-400 italic'}`}>{s.user?.fullName || 'Anonymous'}</td>
                      <td className="px-4 py-3 whitespace-nowrap"><TypeBadge type={s.type} /></td>
                      <td className="px-4 py-3 text-xs">
                        {s.department && s.department !== 'UNASSIGNED'
                          ? <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium truncate block" style={{ maxWidth: 180 }}>{s.department}</span>
                          : <span className="px-2 py-0.5 bg-gray-100 text-gray-400 rounded-full font-medium">Unassigned</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={s.status} /></td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {new Date(s.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => setSelected(s)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary bg-opacity-10 text-primary text-xs font-semibold rounded-lg hover:bg-opacity-20 transition-colors whitespace-nowrap">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                          </svg>
                          Assign / Track
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-5 py-4 border-t border-gray-100 flex justify-between items-center">
              <p className="text-sm text-gray-500">Page {page} of {totalPages} · {total} total</p>
              <div className="flex gap-2">
                <button disabled={page <= 1}
                  onClick={() => { const p = page - 1; setPage(p); fetchData(p); }}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50 transition-colors">
                  ← Prev
                </button>
                <button disabled={page >= totalPages}
                  onClick={() => { const p = page + 1; setPage(p); fetchData(p); }}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50 transition-colors">
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Slide-in detail/assign panel */}
      {selected && (
        <TrackPanel
          submission={selected}
          onClose={() => setSelected(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
