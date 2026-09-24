import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';

const TEAM = [
  'Tristan M. Frias',
  'Novie Joy Mondido Dulpina',
  'Arjay G. Melloria',
  'Nicole A. Baldovino',
];

const aboutCss = `
@keyframes aboutOverlayIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes aboutCardIn {
  0%   { opacity: 0; transform: translateY(18px) scale(0.94); }
  60%  { opacity: 1; transform: translateY(-2px) scale(1.01); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes aboutRowIn { from { opacity: 0; transform: translateX(-6px); } to { opacity: 1; transform: translateX(0); } }
.about-overlay { animation: aboutOverlayIn .2s ease both; }
.about-card { animation: aboutCardIn .38s cubic-bezier(.22,1,.36,1) both; }
.about-row { animation: aboutRowIn .35s cubic-bezier(.22,1,.36,1) both; }
.about-close-x { transition: background .2s ease, transform .2s ease; }
.about-close-x:hover { background: rgba(255,255,255,0.22); transform: rotate(90deg); }
.about-seal { transition: transform .6s cubic-bezier(.22,1,.36,1); }
.about-card:hover .about-seal { transform: rotate(8deg) scale(1.05); }
`;

function AboutModal({ onClose }) {
  return (
    <div className="about-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      onClick={onClose}>
      <style>{aboutCss}</style>
      <div className="about-card bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden relative" onClick={e => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Close"
          className="about-close-x absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-white/90 z-10">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="px-6 py-6 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0b2f66, #2563eb)' }}>
          <img src="/cantilan-seal.png" alt="" className="about-seal absolute -right-4 -bottom-4 w-24 h-24 object-contain opacity-15" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/70">About</p>
            <h2 className="text-xl font-bold">CIVIX</h2>
            <p className="text-sm text-white/85 mt-0.5">Citizen Complaint and Feedback Management System</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <p className="about-row text-sm text-gray-600 leading-relaxed" style={{ animationDelay: '.06s' }}>
            CIVIX helps citizens of Cantilan, Surigao del Sur report concerns, track their status, and
            share feedback with the local government — using AI to automatically route each report to the
            correct municipal office.
          </p>
          <div className="about-row" style={{ animationDelay: '.12s' }}>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Developed by</p>
            <ul className="space-y-1">
              {TEAM.map((name, i) => (
                <li key={name} className="about-row text-sm font-medium text-gray-800 flex items-center gap-2"
                  style={{ animationDelay: `${0.16 + i * 0.05}s` }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                  {name}
                </li>
              ))}
            </ul>
          </div>
          <div className="about-row pt-3 border-t border-gray-100 text-xs text-gray-400 leading-relaxed" style={{ animationDelay: '.36s' }}>
            BS Information Technology 4D<br />
            North Eastern Mindanao State University – Cantilan Campus<br />
            S.Y. 2026-2027
          </div>
        </div>
        <div className="px-6 pb-6">
          <button type="button" onClick={onClose}
            className="w-full py-2.5 rounded-lg font-semibold text-sm text-white bg-primary hover:bg-blue-700 transition-all hover:shadow-[0_6px_18px_rgba(37,99,235,0.35)]">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

const NAV_ITEMS = [
  { to: '/submit', label: 'Home', icon: 'M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4a1 1 0 001-1v-5h2v5a1 1 0 001 1h4a1 1 0 001-1V10' },
  { to: '/submit', label: 'Submit a Report', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
  { to: '/track', label: 'Track My Report', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
];

export default function CitizenPortalLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [aboutOpen, setAboutOpen] = useState(false);
  const isActive = (to) => location.pathname === to;

  const FOOTER_ITEMS = [
    { label: 'About', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', onClick: () => setAboutOpen(true) },
    { label: 'Help', icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      onClick: () => toast('For assistance, visit or call Cantilan Town Hall during office hours.', { icon: '📞' }) },
  ];

  return (
    <div className="min-h-screen" style={{ background: '#eef2f9' }}>
      {/* Header banner */}
      <div className="relative overflow-hidden" style={{ height: 130 }}>
        <img src="/town-hall.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(15,45,110,0.94) 0%, rgba(20,60,140,0.75) 45%, rgba(30,80,170,0.35) 100%)' }} />
        <div className="relative z-10 h-full flex items-center px-8 gap-4">
          <img src="/cantilan-seal.png" alt="Municipality of Cantilan" className="w-16 h-16 object-contain flex-shrink-0" />
          <div>
            <p className="text-white/70 text-xs font-semibold tracking-wide">Municipality of Cantilan</p>
            <h1 className="text-white text-lg sm:text-xl font-extrabold tracking-tight leading-tight">Surigao Del Sur - Philippines</h1>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <div className="hidden lg:block text-right text-white/85 text-sm italic font-medium max-w-xs">
              A Cleaner, Safer, Stronger<br />Cantilan for Everyone
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col w-56 flex-shrink-0" style={{ background: '#0b2f66', minHeight: 'calc(100vh - 130px)' }}>
          <nav className="flex-1 px-3 py-5 space-y-1">
            {NAV_ITEMS.map((item, i) => (
              <Link key={i} to={item.to}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-colors"
                style={isActive(item.to) ? { background: '#2563eb', color: '#fff' } : { color: 'rgba(255,255,255,0.75)' }}
                onMouseEnter={e => { if (!isActive(item.to)) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                onMouseLeave={e => { if (!isActive(item.to)) e.currentTarget.style.background = 'transparent'; }}>
                <svg className="w-4.5 h-4.5 flex-shrink-0" width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={item.icon} />
                </svg>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="px-3 pb-5 pt-3 space-y-1" style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
            {FOOTER_ITEMS.map((item, i) => (
              <button key={i} type="button" onClick={item.onClick}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                style={{ color: 'rgba(255,255,255,0.55)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <svg className="flex-shrink-0" width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={item.icon} />
                </svg>
                {item.label}
              </button>
            ))}
            <button type="button" onClick={() => navigate('/portal-login')}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{ color: 'rgba(255,255,255,0.55)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <svg className="flex-shrink-0" width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Staff / Admin Login
            </button>
          </div>
        </aside>

        {/* Page content */}
        <main className="flex-1 px-4 sm:px-8 py-8">
          {children}
        </main>
      </div>

      <div className="border-t bg-white px-8 py-3 flex items-center justify-between text-xs text-gray-400">
        <span>© {new Date().getFullYear()} Municipality of Cantilan. All rights reserved.</span>
        <span>Cantilan Town Hall &nbsp;|&nbsp; Citizen Report and Concerns System</span>
      </div>

      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
    </div>
  );
}
