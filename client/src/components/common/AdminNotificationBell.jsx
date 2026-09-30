import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlertSections } from './alerts';

// Opens every bell on the page (the pop-up alert's "View" button uses this).
export function openAlerts() {
  window.dispatchEvent(new Event('civix:open-alerts'));
}

// Bell in the admin top bar: reports that need attention and pending access requests.
export default function AdminNotificationBell({ alerts, dark }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const count = alerts?.total || 0;

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('civix:open-alerts', onOpen);
    return () => window.removeEventListener('civix:open-alerts', onOpen);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    // The dropdown shows the same items as the pop-up alert, which would cover it.
    toast.dismiss('civix-alert');
    const onPointer = e => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    const onKey = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function go(path) {
    setOpen(false);
    navigate(path);
  }

  const muted = dark ? '#94a3b8' : '#6b7280';
  const border = dark ? 'rgba(255,255,255,0.08)' : '#e5e7eb';

  return (
    <div ref={boxRef} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg transition-colors"
        style={{ color: muted, background: open ? (dark ? 'rgba(255,255,255,0.06)' : '#f3f4f6') : 'transparent' }}
        onMouseEnter={e => { e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.06)' : '#f3f4f6'; }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'transparent'; }}
        aria-label={count > 0 ? `Notifications, ${count} need attention` : 'Notifications'}
        aria-expanded={open} title="Notifications">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {count > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-xl overflow-hidden z-50"
          style={{ background: dark ? '#1e293b' : '#ffffff', border: `1px solid ${border}`, boxShadow: '0 16px 40px -8px rgba(15,23,42,0.3)' }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${border}` }}>
            <p className="text-sm font-bold" style={{ color: dark ? '#f1f5f9' : '#111827' }}>Notifications</p>
            {count > 0 && <span className="text-xs font-semibold" style={{ color: muted }}>{count} need attention</span>}
          </div>

          {!alerts ? (
            <p className="px-4 py-6 text-center text-sm" style={{ color: muted }}>Loading...</p>
          ) : count === 0 ? (
            <div className="px-4 py-7 text-center">
              <p className="text-sm font-medium" style={{ color: dark ? '#e2e8f0' : '#1f2937' }}>You're all caught up</p>
              <p className="text-xs mt-0.5" style={{ color: muted }}>No urgent or overdue reports, and no pending requests.</p>
            </div>
          ) : (
            <div className="max-h-[65vh] overflow-y-auto">
              <AlertSections alerts={alerts} dark={dark}
                onSelect={(item, key) => go(key === 'accessRequests' ? '/admin/access-requests' : `/admin/submissions/${item.id}`)} />
            </div>
          )}

          <div className="px-4 py-2.5 flex items-center justify-between text-xs font-semibold" style={{ borderTop: `1px solid ${border}` }}>
            <button type="button" onClick={() => go('/admin/submissions')} style={{ color: '#2563eb' }}>All reports</button>
            <button type="button" onClick={() => go('/admin/audit-log')} style={{ color: muted }}>Audit log</button>
          </div>
        </div>
      )}
    </div>
  );
}
