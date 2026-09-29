import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Skel, useSkeletonGate } from '../../components/common/Skeleton';
import Icon from '../../components/common/Icons';
import { RequestStatusBadge, RequestTypeBadge, formatRequestDate, timeAgo } from '../../components/common/AccessRequestBadges';
import api from '../../utils/api';

const VIEWS = [
  { id: 'pending', label: 'Pending' },
  { id: 'reviewed', label: 'History' },
];

function announceChange() {
  window.dispatchEvent(new Event('civix:access-requests-changed'));
}

// What approving or rejecting does, shown before the administrator confirms.
function consequence(request, decision) {
  const first = request.fullName.split(' ')[0];
  if (request.type === 'ADMIN_ACCESS') {
    return decision === 'approve'
      ? { tone: 'warn', text: `${request.fullName} will get full administrator access: every report, all staff accounts and the system settings. Their admin role is activated right away, and they can continue to the Admin Portal from the staff portal.` }
      : { tone: 'info', text: `${first} stays a staff member and will see your note in the staff portal.` };
  }
  return decision === 'approve'
    ? { tone: 'info', text: `${first} will be able to sign in to the staff portal for ${request.department}. An email will let them know.` }
    : { tone: 'info', text: `The sign-up is removed and ${first} can't sign in. An email will let them know.` };
}

// The account details an administrator checks before approving.
function VerifyDetails({ request }) {
  const u = request.user;
  const rows = request.type === 'ADMIN_ACCESS'
    ? [
        ['Staff ID', u?.citizenId || '—'],
        ['Department', request.department || '—'],
        ['Staff since', u ? formatRequestDate(u.createdAt) : '—'],
        ['Report updates made', String(request.reportUpdates ?? 0)],
      ]
    : [
        ['Email', request.email],
        ['Department', request.department || '—'],
        ['Signed up', formatRequestDate(request.createdAt)],
        ['Account', 'New — cannot sign in until approved'],
      ];
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between sm:block gap-3">
          <dt className="text-xs text-gray-500 dark:text-slate-400">{k}</dt>
          <dd className="font-medium text-gray-800 dark:text-slate-100 text-right sm:text-left break-all">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function RequestCard({ request, onReviewed }) {
  const [decision, setDecision] = useState(null); // 'approve' | 'reject' while confirming
  const [note, setNote] = useState('');
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const first = request.fullName.split(' ')[0];

  async function confirm() {
    setBusy(true);
    try {
      const res = await api.post(`/access-requests/${request.id}/${decision}`, { note: note.trim(), verified: decision === 'approve' && verified });
      toast.success(decision === 'approve' ? `${request.fullName} approved` : 'Request rejected');
      onReviewed(request, res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to review the request');
      if (err.response?.status === 409) onReviewed(request, null);
    } finally {
      setBusy(false);
    }
  }

  const c = decision && consequence(request, decision);

  return (
    <li className="rounded-2xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-5" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg,#2563eb,#4f46e5)' }}>
          {request.fullName[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-gray-800 dark:text-slate-100">{request.fullName}</p>
            <RequestTypeBadge type={request.type} />
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 break-all">
            {request.email}{request.department ? ` · ${request.department}` : ''} · sent {timeAgo(request.createdAt)}
          </p>
          {request.reason && (
            <p className="mt-3 text-sm text-gray-600 dark:text-slate-300 border-l-2 border-gray-200 dark:border-slate-600 pl-3">{request.reason}</p>
          )}
        </div>
      </div>

      {decision ? (
        <div className="mt-4 rounded-xl border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 p-4">
          {decision === 'approve' && (
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-slate-400 mb-2">Verify before approving</p>
              <VerifyDetails request={request} />
            </div>
          )}
          <p className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2.5 ${c.tone === 'warn' ? 'bg-amber-50 text-amber-800 dark:text-amber-200' : 'bg-blue-50 text-blue-800 dark:text-blue-200'}`}>
            <Icon name={c.tone === 'warn' ? 'complaint' : 'check'} className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {c.text}
          </p>
          {decision === 'approve' && (
            <label className="mt-3 flex items-start gap-2.5 text-sm text-gray-700 dark:text-slate-200 cursor-pointer">
              <input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary flex-shrink-0" />
              <span>
                {request.type === 'ADMIN_ACCESS'
                  ? `I verified ${first}'s identity and that their work requires administrator access.`
                  : `I verified that ${first} works at ${request.department}.`}
              </span>
            </label>
          )}
          <label htmlFor={`note-${request.id}`} className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mt-3 mb-1">
            Note to {first} (optional)
          </label>
          <textarea id={`note-${request.id}`} rows={2} maxLength={1000} value={note} onChange={e => setNote(e.target.value)}
            placeholder={decision === 'approve' ? 'e.g., Approved by the Mayor\'s Office.' : 'e.g., Please ask your department head to confirm your position.'}
            className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary" />
          <div className="flex flex-wrap gap-2 mt-3">
            <button type="button" onClick={confirm} disabled={busy || (decision === 'approve' && !verified)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${decision === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
              {busy ? 'Saving...' : decision === 'approve' ? 'Confirm approval' : 'Confirm rejection'}
            </button>
            <button type="button" onClick={() => { setDecision(null); setNote(''); setVerified(false); }} disabled={busy}
              className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 mt-4 sm:pl-[52px]">
          <button type="button" onClick={() => setDecision('approve')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors">
            <Icon name="check" className="w-4 h-4" /> Approve
          </button>
          <button type="button" onClick={() => setDecision('reject')}
            className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-slate-600 text-red-600 hover:bg-red-50 transition-colors">
            Reject
          </button>
        </div>
      )}
    </li>
  );
}

function HistoryRow({ request }) {
  return (
    <li className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-sm text-gray-800 dark:text-slate-100">{request.fullName}</p>
          <RequestTypeBadge type={request.type} />
          <RequestStatusBadge status={request.status} />
        </div>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 break-all">
          {request.email}{request.department ? ` · ${request.department}` : ''}
        </p>
        {request.reviewNote && <p className="text-xs text-gray-600 dark:text-slate-300 mt-1">Note: {request.reviewNote}</p>}
      </div>
      <p className="text-xs text-gray-500 dark:text-slate-400 sm:text-right flex-shrink-0">
        by {request.reviewedByName || '—'}<br className="hidden sm:block" />
        <span className="sm:hidden"> · </span>{request.reviewedAt ? formatRequestDate(request.reviewedAt) : ''}
      </p>
    </li>
  );
}

export default function AccessRequests() {
  const [view, setView] = useState('pending');
  const [requests, setRequests] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [shareLink, setShareLink] = useState(null); // { name, url } after approving administrator access
  const gate = useSkeletonGate();

  const load = useCallback((which, useGate) => {
    setRequests(null);
    const request = api.get(`/access-requests?view=${which}`);
    (useGate ? gate(request) : request)
      .then(res => { setRequests(res.data.requests); setPendingCount(res.data.pendingCount); })
      .catch(() => { setRequests([]); toast.error('Failed to load access requests'); });
  }, [gate]);

  useEffect(() => { load('pending', true); }, [load]);

  function switchView(id) {
    if (id === view) return;
    setView(id);
    load(id, false);
  }

  function onReviewed(request, result) {
    setRequests(p => p.filter(r => r.id !== request.id));
    setPendingCount(n => Math.max(0, n - 1));
    announceChange();
    if (result?.adminLoginPath) {
      setShareLink({ name: request.fullName, url: `${window.location.origin}/${result.adminLoginPath}` });
    }
  }

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(shareLink.url);
      toast.success('Link copied');
    } catch {
      toast.error('Copy failed. Select the link and copy it manually.');
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Access Requests</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          Staff sign-ups and requests for administrator access. Nothing is granted until an administrator approves it here.
        </p>
      </div>

      {shareLink && (
        <div className="mb-6 rounded-2xl border border-green-200 dark:border-green-900 bg-green-50 p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="font-semibold text-green-800 dark:text-green-200">{shareLink.name} is now an administrator</p>
            <button type="button" onClick={() => setShareLink(null)} className="text-green-700 dark:text-green-300 text-sm font-semibold hover:underline">Dismiss</button>
          </div>
          <p className="text-sm text-green-800 dark:text-green-200 mt-1">
            Their admin role is active. They can continue to the Admin Portal from their Admin Access page, and the private sign-in link is emailed to them.
            If they need it in person, here it is. Don't post it publicly.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 mt-3">
            <input readOnly value={shareLink.url} onFocus={e => e.target.select()}
              className="flex-1 min-w-0 px-3 py-2 rounded-lg text-sm font-mono border border-green-200 dark:border-green-900 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-100" />
            <button type="button" onClick={copyShareLink}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors">
              Copy link
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-5 border-b border-gray-200 dark:border-slate-700" role="tablist">
        {VIEWS.map(v => (
          <button key={v.id} type="button" role="tab" aria-selected={view === v.id} onClick={() => switchView(v.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              view === v.id ? 'border-primary text-primary' : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-100'
            }`}>
            {v.label}
            {v.id === 'pending' && pendingCount > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center text-[11px] font-bold text-white bg-red-500">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {requests === null ? (
        <div className="space-y-3">
          {[0, 1].map(i => (
            <div key={i} className="rounded-2xl border border-gray-100 bg-white p-5">
              <div className="flex gap-3"><Skel className="w-10 h-10 rounded-full" /><div className="flex-1"><Skel className="h-4 w-48 mb-2" /><Skel className="h-3 w-72" /></div></div>
              <Skel className="h-9 w-40 mt-4" />
            </div>
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center text-center py-14 rounded-2xl border border-dashed border-gray-200 dark:border-slate-700">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-green-50 text-green-600 mb-3">
            <Icon name="shield" className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-gray-700 dark:text-slate-300">
            {view === 'pending' ? 'No requests waiting' : 'No reviewed requests yet'}
          </p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 max-w-sm">
            {view === 'pending'
              ? 'New staff sign-ups and requests for administrator access will appear here.'
              : 'Approved and rejected requests will be listed here.'}
          </p>
        </div>
      ) : view === 'pending' ? (
        <ul className="space-y-3">
          {requests.map(r => <RequestCard key={r.id} request={r} onReviewed={onReviewed} />)}
        </ul>
      ) : (
        <ul className="rounded-2xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 divide-y divide-gray-100 dark:divide-slate-700">
          {requests.map(r => <HistoryRow key={r.id} request={r} />)}
        </ul>
      )}
    </div>
  );
}
