import React, { useEffect, useState } from 'react';

const ROLE_COLORS = {
  ADMIN:   '#2563eb',
  STAFF:   '#059669',
  CITIZEN: '#2563eb',
};

const css = `
@keyframes sl-fadeIn   { from { opacity:0 } to { opacity:1 } }
@keyframes sl-fadeOut  { from { opacity:1 } to { opacity:0 } }
@keyframes sl-spin     { to { transform: rotate(360deg) } }
.sl-wrap     { animation: sl-fadeIn 0.3s ease both; }
.sl-wrap.out { animation: sl-fadeOut 0.35s ease both; }
.sl-spinner  { animation: sl-spin 0.85s linear infinite; }
`;

export default function SystemLoader({ userName, role, onDone }) {
  const color = ROLE_COLORS[role] || ROLE_COLORS.CITIZEN;
  const firstName = userName?.split(' ')[0] || 'User';
  const [out, setOut] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setOut(true), 1100);
    const doneTimer = setTimeout(() => onDone?.(), 1450);
    return () => { clearTimeout(fadeTimer); clearTimeout(doneTimer); };
  }, []);

  return (
    <>
      <style>{css}</style>
      <div
        className={`sl-wrap fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4${out ? ' out' : ''}`}
        style={{
          background: 'rgba(15,23,42,0.45)',
          backdropFilter: 'blur(14px) saturate(150%)',
          WebkitBackdropFilter: 'blur(14px) saturate(150%)',
        }}
      >
        <span
          className="sl-spinner"
          style={{
            width: 40, height: 40, borderRadius: '50%',
            background: `conic-gradient(from 0deg, transparent, ${color})`,
            WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px))',
            mask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px))',
          }}
        />
        <p className="text-white text-sm font-medium">Signing in, {firstName}...</p>
      </div>
    </>
  );
}
