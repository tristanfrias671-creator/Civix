import React from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const FEATURE_CARDS = [
  {
    key: 'report',
    title: 'Report a Concern',
    description: 'File a complaint, suggestion, or concern quickly and easily.',
    color: '#2563eb',
    bg: 'rgba(239,246,255,0.55)',
    border: 'rgba(191,219,254,0.7)',
    action: (nav) => nav('/submit'),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    key: 'track',
    title: 'Track Your Report',
    description: 'Check the status of your submitted concern.',
    color: '#0d9488',
    bg: 'rgba(240,253,250,0.55)',
    border: 'rgba(153,246,228,0.7)',
    action: (nav) => nav('/track'),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
      </svg>
    ),
  },
  {
    key: 'guidelines',
    title: 'View Guidelines',
    description: 'Learn about our policies and what to include in your report.',
    color: '#7c3aed',
    bg: 'rgba(245,243,255,0.55)',
    border: 'rgba(221,214,254,0.7)',
    action: (nav) => nav('/submit'),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    key: 'help',
    title: 'Need Help?',
    description: 'Get assistance from our support team.',
    color: '#d97706',
    bg: 'rgba(255,251,235,0.55)',
    border: 'rgba(253,230,138,0.7)',
    action: () => toast('For assistance, visit or call Cantilan Town Hall during office hours.', { icon: '📞' }),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M12 16v-4m0-4h.01" />
      </svg>
    ),
  },
];

const BENEFITS = [
  {
    title: 'Transparent Process',
    description: 'Your report is handled with care and transparency.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    title: 'Better Community',
    description: 'Together we build a safer, cleaner and progressive Cantilan.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    title: 'Fast & Reliable',
    description: 'We value your time and respond to your concerns.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
      </svg>
    ),
  },
  {
    title: 'Citizen-Focused',
    description: 'Your feedback helps us serve you better.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8.5 14.5A2.5 2.5 0 0011 12a2.5 2.5 0 00-2.5-2.5m0 5A2.5 2.5 0 016 12a2.5 2.5 0 012.5-2.5m0 5v-5m6.5 0L21 7m-6 5l6 5" />
      </svg>
    ),
  },
];

const popCss = `
@keyframes rsFadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
.rs-fade-0 { animation: rsFadeUp .6s .04s cubic-bezier(.22,1,.36,1) both; }
.rs-fade-1 { animation: rsFadeUp .6s .12s cubic-bezier(.22,1,.36,1) both; }
.rs-fade-2 { animation: rsFadeUp .6s .20s cubic-bezier(.22,1,.36,1) both; }
.rs-fade-3 { animation: rsFadeUp .6s .28s cubic-bezier(.22,1,.36,1) both; }
.rs-fade-4 { animation: rsFadeUp .6s .36s cubic-bezier(.22,1,.36,1) both; }

@keyframes rsPulse { 0%,100%{box-shadow:0 0 0 0 rgba(110,231,183,0.45)} 50%{box-shadow:0 0 0 6px rgba(110,231,183,0)} }
.rs-pulse-dot { animation: rsPulse 2.4s ease-in-out infinite; }

.rs-navlink { position: relative; }
.rs-navlink::after {
  content: ''; position: absolute; left: 12px; right: 12px; bottom: 2px; height: 2px;
  background: #60a5fa; border-radius: 2px; transform: scaleX(0); transform-origin: left;
  transition: transform .25s cubic-bezier(.22,1,.36,1);
}
.rs-navlink:hover::after { transform: scaleX(1); }

.rs-feature-card { transition: transform .3s cubic-bezier(.22,1,.36,1), box-shadow .3s ease, background .3s ease; }
.rs-feature-card:hover { transform: translateY(-4px); }

`;

export default function RoleSelect() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen relative" style={{ background: '#eef2f9' }}>
      <style>{popCss}</style>

      {/* ── Full-page fixed photo background (shows through below the hero too) ── */}
      <img src="/town-hall.jpg" alt="" className="fixed inset-0 w-full h-full object-cover" />
      <div className="fixed inset-0" style={{ background: 'linear-gradient(180deg, rgba(6,16,42,0.1) 0%, rgba(70,100,150,0.25) 30%, rgba(160,185,220,0.4) 48%, rgba(160,185,220,0.5) 100%)' }} />

      {/* ── Top Navbar ── */}
      <header className="relative z-20" style={{ background: 'linear-gradient(90deg, rgba(11,47,102,0.88), rgba(18,58,122,0.8))', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center gap-4">
          <img src="/cantilan-seal.png" alt="Municipality of Cantilan" className="w-12 h-12 object-contain flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-white/60 text-[11px] font-semibold leading-none">Municipality of Cantilan</p>
            <h1 className="text-white text-sm sm:text-base font-extrabold leading-tight truncate">Surigao Del Sur - Philippines</h1>
          </div>

          <nav className="hidden md:flex items-center gap-1 ml-8">
            <span className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white border-b-2 border-blue-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4a1 1 0 001-1v-5h2v5a1 1 0 001 1h4a1 1 0 001-1V10" />
              </svg>
              Home
            </span>
            <button onClick={() => navigate('/submit')}
              className="rs-navlink flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white/75 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Submit a Report
            </button>
            <button onClick={() => navigate('/track')}
              className="rs-navlink flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white/75 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
              </svg>
              Track My Report
            </button>
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <div className="relative z-10 overflow-hidden" style={{ height: 520 }}>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(100deg, rgba(6,16,42,0.7) 10%, rgba(10,30,70,0.3) 50%, rgba(20,50,100,0.05) 100%)' }} />

        <div className="relative z-10 max-w-7xl mx-auto px-6 h-full flex items-center">
          <div className="max-w-2xl">
            <span className="rs-fade-0 rs-pulse-dot inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold mb-5"
              style={{ background: 'rgba(16,185,129,0.18)', color: '#6ee7b7', border: '1px solid rgba(110,231,183,0.35)' }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Cantilan, Surigao del Sur
            </span>
            <p className="rs-fade-0 text-white/70 text-lg font-medium mb-1">Welcome to</p>
            <h1 className="rs-fade-1 text-white font-extrabold leading-[0.95] tracking-tight mb-3" style={{ fontSize: 'clamp(2.2rem, 5vw, 3.5rem)' }}>
              Municipality of Cantilan
            </h1>
            <p className="rs-fade-2 text-white/85 text-xl font-semibold mb-4">Citizen Complaint and Service Management System</p>
            <p className="rs-fade-2 text-white/70 text-sm leading-relaxed mb-8 max-w-lg">
              Your voice matters! Report your concerns, track your submissions, and help make Cantilan a cleaner, safer, and more progressive community.
            </p>
            <div className="rs-fade-3 flex flex-wrap gap-3">
              <button onClick={() => navigate('/submit')}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white transition-transform hover:-translate-y-0.5"
                style={{ background: '#2563eb', boxShadow: '0 8px 24px rgba(37,99,235,0.4)' }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Submit a Report
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
              <button onClick={() => navigate('/track')}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white border transition-colors"
                style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.35)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.16)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
                </svg>
                Track My Report
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>

          <p className="hidden xl:block ml-auto text-white/90 italic font-medium text-xl leading-snug text-right" style={{ fontFamily: 'Georgia, serif', maxWidth: 280 }}>
            A Cleaner, Safer, Stronger Cantilan for Everyone
          </p>
        </div>
      </div>

      {/* ── Feature cards ── */}
      <div className="rs-fade-3 max-w-7xl mx-auto px-6 -mt-8 relative z-10">
        <div className="rounded-2xl p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURE_CARDS.map(card => (
            <button key={card.key} onClick={() => card.action(navigate)}
              className="rs-feature-card group flex items-start gap-3 text-left rounded-xl p-4"
              style={{ background: card.bg, border: `1px solid ${card.border}`, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = `0 12px 28px -8px ${card.color}55`}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white transition-transform duration-300 group-hover:scale-110"
                style={{ background: card.color }}>
                <span style={{ width: 18, height: 18, display: 'flex' }}>{card.icon}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-gray-800 text-sm">{card.title}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{card.description}</p>
              </div>
              <svg className="w-4 h-4 flex-shrink-0 mt-1 transition-transform group-hover:translate-x-1" style={{ color: card.color }}
                fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* ── Benefits strip ── */}
      <div className="rs-fade-4 relative z-10 mt-10" style={{ background: 'rgba(200,215,235,0.35)', backdropFilter: 'blur(2px)' }}>
        <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {BENEFITS.map((b, i) => (
            <div key={i} className="group flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-blue-600 bg-white transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-md">
                <span style={{ width: 20, height: 20, display: 'flex' }}>{b.icon}</span>
              </div>
              <div>
                <p className="font-bold text-gray-800 text-sm">{b.title}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{b.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="relative z-10" style={{ background: '#0b2f66' }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-white/60 text-xs">
          <span>© {new Date().getFullYear()} Municipality of Cantilan. All rights reserved.  |  Cantilan, Surigao del Sur</span>
          <button type="button" onClick={() => navigate('/portal-login')}
            className="font-semibold text-white/80 hover:text-white underline underline-offset-4">
            Staff &amp; Admin Login
          </button>
        </div>
        <div className="max-w-7xl mx-auto px-6 pb-3 text-center text-white/30 text-[10px]">
          Developed by BS Information Technology 4D students, North Eastern Mindanao State University – Cantilan Campus
        </div>
      </div>
    </div>
  );
}
