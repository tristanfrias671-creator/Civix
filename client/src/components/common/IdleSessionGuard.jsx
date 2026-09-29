import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth, ACTIVITY_KEY } from '../../context/AuthContext';
import api from '../../utils/api';
import formatMinutes from '../../utils/formatMinutes';

const WARN_SECONDS = 60;
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'wheel', 'touchstart'];
const RING_R = 28;
const RING_C = 2 * Math.PI * RING_R;

// Activity time is kept in localStorage so every open tab shares one clock:
// working in one tab keeps the others signed in, and a sign-out ends them all.
function readActivity() {
  return Number(localStorage.getItem(ACTIVITY_KEY)) || 0;
}
function markActivity() {
  localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
}

// Signs the admin/staff user out after the inactivity limit set in
// Settings > Security, with a warning and countdown in the last minute.
export default function IdleSessionGuard({ loginPath }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [minutes, setMinutes] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(null);

  useEffect(() => {
    api.get('/settings/session')
      .then(res => setMinutes(res.data.idleTimeoutMinutes || 0))
      .catch(() => {});
    // Settings dispatches this after saving, so the new limit applies right away.
    const onPolicy = e => setMinutes(e.detail || 0);
    window.addEventListener('civix:session-policy', onPolicy);
    return () => window.removeEventListener('civix:session-policy', onPolicy);
  }, []);

  const signOut = useCallback(message => {
    setSecondsLeft(null);
    logout();
    navigate(loginPath, { replace: true });
    if (message) toast(message, { id: 'idle-signout', duration: 8000 });
  }, [logout, navigate, loginPath]);

  useEffect(() => {
    if (!minutes) { setSecondsLeft(null); return undefined; }
    const limitMs = minutes * 60000;
    if (!readActivity()) markActivity();

    let lastWrite = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - lastWrite < 1000) return;
      lastWrite = now;
      markActivity();
    };
    const tick = () => {
      // Signed out in another tab.
      if (!localStorage.getItem('civix_token')) { signOut(null); return; }
      const leftMs = limitMs - (Date.now() - readActivity());
      if (leftMs <= 0) {
        signOut(`You were signed out after ${formatMinutes(minutes)} of inactivity.`);
        return;
      }
      setSecondsLeft(leftMs <= WARN_SECONDS * 1000 ? Math.ceil(leftMs / 1000) : null);
    };

    ACTIVITY_EVENTS.forEach(ev => window.addEventListener(ev, onActivity, { passive: true }));
    tick();
    const timer = setInterval(tick, 1000);
    return () => {
      clearInterval(timer);
      ACTIVITY_EVENTS.forEach(ev => window.removeEventListener(ev, onActivity));
    };
  }, [minutes, signOut]);

  if (secondsLeft == null) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      role="alertdialog" aria-modal="true" aria-labelledby="idle-title" aria-describedby="idle-desc">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 p-6 text-center"
        style={{ boxShadow: '0 24px 60px -12px rgba(15,23,42,0.45)' }}>
        <div className="relative w-20 h-20 mx-auto">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r={RING_R} fill="none" strokeWidth="5" className="stroke-amber-100 dark:stroke-amber-500/20" />
            <circle cx="32" cy="32" r={RING_R} fill="none" strokeWidth="5" strokeLinecap="round"
              className="stroke-amber-500" style={{ strokeDasharray: RING_C, strokeDashoffset: RING_C * (1 - secondsLeft / WARN_SECONDS), transition: 'stroke-dashoffset 1s linear' }} />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold tabular-nums text-gray-900 dark:text-slate-100">
            {secondsLeft}
          </span>
        </div>
        <h2 id="idle-title" className="mt-4 text-lg font-bold text-gray-900 dark:text-slate-100">Are you still there?</h2>
        <p id="idle-desc" className="mt-1.5 text-sm text-gray-500 dark:text-slate-400">
          For security, you'll be signed out in {secondsLeft} second{secondsLeft === 1 ? '' : 's'} because there has been no activity.
        </p>
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={() => signOut(null)}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
            Sign out
          </button>
          <button type="button" autoFocus onClick={() => { markActivity(); setSecondsLeft(null); }}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-blue-700 transition-colors">
            Stay signed in
          </button>
        </div>
      </div>
    </div>
  );
}
