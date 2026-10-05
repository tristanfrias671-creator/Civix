import React, { useEffect, useRef } from 'react';
import Icon from './Icons';
import Avatar from './Avatar';

const dialogCss = `
@keyframes sodFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes sodPop { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 1; transform: none; } }
.sod-overlay { animation: sodFade .15s ease-out both; }
.sod-card { animation: sodPop .2s cubic-bezier(.22,1,.36,1) both; }
@media (prefers-reduced-motion: reduce) { .sod-overlay, .sod-card { animation: none; } }
`;

const FOCUS_RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800';

// Asks before signing out (staff and admin), so a stray click or tap doesn't end
// the session, and shows which account is signed in. "Cancel" has the focus; Esc
// or the X also closes it; the keyboard stays inside the window.
export default function SignOutDialog({ open, user, roleLabel, message, onCancel, onConfirm }) {
  const cardRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = e => {
      if (e.key === 'Escape') { onCancel(); return; }
      if (e.key !== 'Tab' || !cardRef.current) return;
      const buttons = [...cardRef.current.querySelectorAll('button')];
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="sod-overlay fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
      onClick={onCancel}>
      <style>{dialogCss}</style>
      <div ref={cardRef} role="dialog" aria-modal="true" aria-labelledby="sign-out-title" aria-describedby="sign-out-text"
        className="sod-card relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:ring-white/10"
        onClick={e => e.stopPropagation()}>

        {/* Heading */}
        <div className="flex items-start gap-4 px-6 pt-6">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0">
            <Icon name="logout" className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1 pr-8">
            <h2 id="sign-out-title" className="text-lg font-semibold text-gray-900 leading-7">Sign out of CIVIX?</h2>
            <p id="sign-out-text" className="mt-1 text-sm leading-6 text-gray-600">{message}</p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close"
            className={`absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors ${FOCUS_RING}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* The account being signed out */}
        {user && (
          <div className="mx-6 mt-5 flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3">
            <Avatar user={user} className="w-10 h-10" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 truncate">{user.fullName}</p>
              {user.email && <p className="text-xs text-gray-600 truncate">{user.email}</p>}
            </div>
            {roleLabel && (
              <span className="flex-shrink-0 max-w-[45%] truncate rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                {roleLabel}
              </span>
            )}
          </div>
        )}

        {/* Actions: side by side on wider screens, full width (Sign out on top) on phones */}
        <div className="mt-6 flex flex-col-reverse gap-2.5 border-t border-gray-100 bg-gray-50 px-6 py-4 sm:flex-row sm:justify-end sm:gap-3">
          <button type="button" autoFocus onClick={onCancel}
            className={`w-full sm:w-auto px-5 py-3 sm:py-2.5 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors ${FOCUS_RING}`}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm}
            className={`w-full sm:w-auto px-5 py-3 sm:py-2.5 rounded-lg bg-blue-700 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 transition-colors inline-flex items-center justify-center gap-2 ${FOCUS_RING}`}>
            <Icon name="logout" className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
