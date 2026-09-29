import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { Skel, useSkeletonGate } from '../../components/common/Skeleton';
import { RequestStatusBadge, formatRequestDate } from '../../components/common/AccessRequestBadges';
import api from '../../utils/api';

const MIN_REASON = 10;
const MAX_REASON = 1000;

// Request sent -> Pending verification -> Decision
function Stepper({ status }) {
  const decided = status === 'APPROVED' || status === 'REJECTED';
  const steps = [
    { label: 'Request sent', state: 'done' },
    { label: 'Pending verification', state: decided ? 'done' : 'current' },
    {
      label: status === 'APPROVED' ? 'Approved' : status === 'REJECTED' ? 'Not approved' : 'Decision',
      state: status === 'APPROVED' ? 'done' : status === 'REJECTED' ? 'failed' : 'upcoming',
    },
  ];
  const dot = {
    done: 'bg-green-600 text-white',
    current: 'bg-amber-500 text-white',
    failed: 'bg-red-600 text-white',
    upcoming: 'bg-gray-200 text-gray-500 dark:bg-slate-700 dark:text-slate-400',
  };
  return (
    <ol className="flex items-start">
      {steps.map((s, i) => (
        <li key={s.label} className="flex-1 flex flex-col items-center text-center relative">
          {i > 0 && (
            <span className={`absolute top-4 right-1/2 w-full h-0.5 -z-0 ${s.state === 'upcoming' ? 'bg-gray-200 dark:bg-slate-700' : 'bg-green-500'}`} aria-hidden="true" />
          )}
          <span className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${dot[s.state]}`}>
            {s.state === 'done' ? '✓' : s.state === 'failed' ? '✕' : i + 1}
          </span>
          <span className={`mt-2 text-xs font-semibold px-1 ${s.state === 'upcoming' ? 'text-gray-400' : 'text-gray-700 dark:text-slate-200'}`}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

export default function StaffAdminAccess() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState(null);
  const [adminLoginPath, setAdminLoginPath] = useState(null);
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const gate = useSkeletonGate();

  useEffect(() => {
    gate(api.get('/access-requests/mine'))
      .then(res => { setRequests(res.data.requests); setAdminLoginPath(res.data.adminLoginPath || null); })
      .catch(() => { setRequests([]); toast.error('Failed to load your requests'); });
  }, [gate]);

  async function send(e) {
    e.preventDefault();
    setSending(true);
    try {
      const res = await api.post('/access-requests/admin', { reason: reason.trim() });
      setRequests(p => [res.data.request, ...(p || [])]);
      setReason('');
      toast.success('Request sent to the administrators');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send the request');
    } finally {
      setSending(false);
    }
  }

  // Ends the staff session and opens the private admin sign-in page.
  function continueToAdminPortal() {
    logout();
    navigate(adminLoginPath ? `/${adminLoginPath}` : '/', { replace: true });
  }

  if (requests === null) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Skel className="h-7 w-64 mb-2" />
        <Skel className="h-4 w-full max-w-lg mb-6" />
        <div className="rounded-2xl border border-gray-100 bg-white p-6">
          <Skel className="h-5 w-48 mb-4" />
          <Skel className="h-28 w-full mb-4" />
          <Skel className="h-10 w-36" />
        </div>
      </div>
    );
  }

  const latest = requests[0];
  const canRequest = !latest || latest.status === 'REJECTED';
  const earlier = requests.slice(1);
  const trimmed = reason.trim();

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Administrator Access</h1>
        <p className="text-sm text-gray-500 mt-1">
          Staff accounts don't include administrator access. If your work needs it, send a request. An existing administrator will verify it, then approve or reject it.
        </p>
      </div>

      {latest && (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 mb-6" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
            <h2 className="font-bold text-gray-800">Your latest request</h2>
            <RequestStatusBadge status={latest.status} />
          </div>
          <Stepper status={latest.status} />

          <div className="mt-6 text-sm text-gray-600 space-y-3">
            {latest.status === 'PENDING' && (
              <p>Sent {formatRequestDate(latest.createdAt)}. An administrator will review it, and the decision will show here.</p>
            )}
            {latest.status === 'APPROVED' && (
              <>
                <p>Approved by <strong className="text-gray-800">{latest.reviewedByName}</strong> on {formatRequestDate(latest.reviewedAt)}.</p>
                <div className="rounded-xl bg-green-50 px-4 py-3 text-green-800 dark:text-green-200">
                  <p className="font-semibold mb-1">Your admin role is active</p>
                  <p>
                    Continue to the Admin Portal: you'll be signed out here and taken to the private admin sign-in page.
                    Sign in with your usual email and password, and bookmark that page. The link was also sent to your email.
                  </p>
                </div>
              </>
            )}
            {latest.status === 'REJECTED' && (
              <p>Reviewed by <strong className="text-gray-800">{latest.reviewedByName}</strong> on {formatRequestDate(latest.reviewedAt)}. You can send a new request below if something has changed.</p>
            )}
            {latest.reviewNote && (
              <p className="rounded-xl bg-gray-50 px-4 py-3"><span className="font-semibold text-gray-700">Note from the administrator: </span>{latest.reviewNote}</p>
            )}
            <p className="text-xs text-gray-400">Your reason: “{latest.reason}”</p>
          </div>

          {latest.status === 'APPROVED' && adminLoginPath && (
            <button type="button" onClick={continueToAdminPortal}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-blue-700 transition-colors">
              Continue to Admin Portal
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          )}
        </div>
      )}

      {canRequest && (
        <form onSubmit={send} className="rounded-2xl border border-gray-100 bg-white p-6" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}>
          <h2 className="font-bold text-gray-800">{latest ? 'Send a new request' : 'Request administrator access'}</h2>
          <p className="text-sm text-gray-500 mt-1 mb-4">
            Administrators can see and manage every report, all staff accounts and the system settings, so explain why your work needs this.
          </p>
          <label htmlFor="admin-reason" className="block text-sm font-medium text-gray-700 mb-1.5">Why do you need administrator access? *</label>
          <textarea id="admin-reason" rows={4} maxLength={MAX_REASON} value={reason} onChange={e => setReason(e.target.value)}
            placeholder="e.g., I was assigned by the Mayor's Office to manage staff accounts and review reports for all offices."
            className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary" />
          <div className="flex items-center justify-between mt-1 text-xs text-gray-400">
            <span>{trimmed.length < MIN_REASON ? `At least ${MIN_REASON} characters` : 'Looks good'}</span>
            <span>{reason.length} / {MAX_REASON}</span>
          </div>
          <button type="submit" disabled={sending || trimmed.length < MIN_REASON}
            className="mt-4 px-6 py-2.5 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-blue-700 transition-colors disabled:opacity-50">
            {sending ? 'Sending...' : 'Send request'}
          </button>
        </form>
      )}

      {earlier.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">Earlier requests</h2>
          <ul className="space-y-2">
            {earlier.map(r => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 bg-white px-4 py-3 text-sm">
                <span className="text-gray-600">Sent {formatRequestDate(r.createdAt)}</span>
                <RequestStatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
