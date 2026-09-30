import React from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BrandImg } from '../context/BrandingContext';

const FEATURE_CARDS = [
  {
    key: 'report',
    title: 'Report a Concern',
    description: 'File a complaint, suggestion, or concern quickly and easily.',
    color: '#2563eb',
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
    action: (nav) => nav('/guidelines'),
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

// Fixed, high-contrast text colors (not Tailwind gray classes, which the dark theme
// turns near-white) so this page stays readable whatever theme was last used.
const INK = '#0f172a';
const INK_SOFT = '#1e293b';
// Frosted glass: a stronger blur softens the photo behind the text.
const GLASS_BLUR = 'blur(14px) saturate(140%)';
// The four cards are clear, borderless smoky glass: a light blur so the photo stays
// visible, a faint sheen, and white text with a soft dark shadow so it reads on
// both the bright walls and the dark doorway.
const CARD_BLUR = 'blur(3px) saturate(150%)';
const CARD_GLASS = 'linear-gradient(135deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 55%, rgba(255,255,255,0) 100%), rgba(10,18,36,0.4)';
const CARD_SHADOW = '0 8px 32px rgba(15,23,42,0.25)';
const CARD_TEXT_SHADOW = '0 1px 3px rgba(0,0,0,0.55)';

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
      <BrandImg kind="hero" className="fixed inset-0 w-full h-full object-cover" />
      {/* Light blue wash over the photo (about half its former strength, so the building stays clear). */}
      <div className="fixed inset-0" style={{ background: 'linear-gradient(180deg, rgba(6,16,42,0.06) 0%, rgba(70,100,150,0.13) 30%, rgba(160,185,220,0.2) 48%, rgba(160,185,220,0.25) 100%)' }} />
      {/* Extra shade behind the hero text so white text stays readable on a bright photo:
          from the left on wide screens, from the top on phones. */}
      <div className="fixed inset-0 hidden md:block" style={{
        background: 'linear-gradient(90deg, rgba(6,16,42,0.64) 0%, rgba(6,16,42,0.44) 38%, rgba(6,16,42,0) 60%)',
        WebkitMaskImage: 'linear-gradient(180deg, #000 0%, #000 58%, transparent 80%)',
        maskImage: 'linear-gradient(180deg, #000 0%, #000 58%, transparent 80%)',
      }} />
      <div className="fixed inset-0 md:hidden" style={{ background: 'linear-gradient(180deg, rgba(6,16,42,0.5) 0%, rgba(6,16,42,0.56) 55%, rgba(6,16,42,0) 78%)' }} />

      {/* ── Top Navbar ── */}
      <header className="relative z-20" style={{ background: 'linear-gradient(90deg, rgba(11,47,102,0.88), rgba(18,58,122,0.8))', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center gap-4">
          <BrandImg kind="seal" alt="Municipality of Cantilan" className="w-12 h-12 object-contain flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-white/85 text-xs font-semibold leading-none">Municipality of Cantilan</p>
            <h1 className="text-white text-sm sm:text-base font-extrabold leading-tight truncate">Surigao Del Sur - Philippines</h1>
          </div>

          <nav className="hidden md:flex items-center gap-1 ml-8">
            <span className="flex items-center gap-1.5 px-3 py-2 text-[15px] font-semibold text-white border-b-2 border-blue-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4a1 1 0 001-1v-5h2v5a1 1 0 001 1h4a1 1 0 001-1V10" />
              </svg>
              Home
            </span>
            <button onClick={() => navigate('/submit')}
              className="rs-navlink flex items-center gap-1.5 px-3 py-2 text-[15px] font-semibold text-white/90 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Submit a Report
            </button>
            <button onClick={() => navigate('/track')}
              className="rs-navlink flex items-center gap-1.5 px-3 py-2 text-[15px] font-semibold text-white/90 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
              </svg>
              Track My Report
            </button>
            <button onClick={() => navigate('/guidelines')}
              className="rs-navlink flex items-center gap-1.5 px-3 py-2 text-[15px] font-semibold text-white/90 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Guidelines
            </button>
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <div className="relative z-10 overflow-hidden" style={{ height: 520 }}>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(100deg, rgba(6,16,42,0.4) 10%, rgba(10,30,70,0.15) 50%, rgba(20,50,100,0.03) 100%)' }} />

        <div className="relative z-10 max-w-7xl mx-auto px-6 h-full flex items-center">
          <div className="max-w-2xl" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.35)' }}>
            <span className="rs-fade-0 rs-pulse-dot inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold mb-5"
              style={{ background: 'rgba(16,185,129,0.18)', color: '#6ee7b7', border: '1px solid rgba(110,231,183,0.35)' }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Cantilan, Surigao del Sur
            </span>
            <p className="rs-fade-0 text-white/90 text-lg font-medium mb-1">Welcome to</p>
            <h1 className="rs-fade-1 text-white font-extrabold leading-[0.95] tracking-tight mb-3" style={{ fontSize: 'clamp(2.2rem, 5vw, 3.5rem)' }}>
              Municipality of Cantilan
            </h1>
            <p className="rs-fade-2 text-white text-xl font-semibold mb-4">Citizen Complaint and Service Management System</p>
            <p className="rs-fade-2 text-white/95 text-base leading-relaxed mb-8 max-w-lg">
              Your voice matters! Report your concerns, track your submissions, and help make Cantilan a cleaner, safer, and more progressive community.
            </p>
            <div className="rs-fade-3 flex flex-wrap gap-3">
              <button onClick={() => navigate('/submit')}
                className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-base text-white transition-transform hover:-translate-y-0.5"
                style={{ background: '#2563eb', boxShadow: '0 8px 24px rgba(37,99,235,0.4)' }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Submit a Report
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
              <button onClick={() => navigate('/track')}
                className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-base text-white border transition-colors"
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

          <p className="hidden xl:block ml-auto text-white italic font-medium text-xl leading-snug text-right" style={{ fontFamily: 'Georgia, serif', maxWidth: 280, textShadow: '0 2px 8px rgba(0,0,0,0.75), 0 1px 2px rgba(0,0,0,0.6)' }}>
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
              style={{ background: CARD_GLASS, boxShadow: CARD_SHADOW, backdropFilter: CARD_BLUR, WebkitBackdropFilter: CARD_BLUR }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white transition-transform duration-300 group-hover:scale-110"
                style={{ background: card.color }}>
                <span style={{ width: 18, height: 18, display: 'flex' }}>{card.icon}</span>
              </div>
              <div className="min-w-0 flex-1" style={{ textShadow: CARD_TEXT_SHADOW }}>
                <p className="font-bold text-base leading-snug" style={{ color: '#ffffff' }}>{card.title}</p>
                <p className="text-[15px] font-medium mt-1 leading-relaxed" style={{ color: '#f1f5f9' }}>{card.description}</p>
              </div>
              <svg className="w-4 h-4 flex-shrink-0 mt-1 transition-transform group-hover:translate-x-1" style={{ color: '#ffffff', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}
                fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* ── Benefits strip ── */}
      <div className="rs-fade-4 relative z-10 mt-10" style={{ background: 'rgba(214,226,242,0.62)', backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR }}>
        <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {BENEFITS.map((b, i) => (
            <div key={i} className="group flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-md"
                style={{ background: '#ffffff', color: '#2563eb' }}>
                <span style={{ width: 20, height: 20, display: 'flex' }}>{b.icon}</span>
              </div>
              <div>
                <p className="font-bold text-base leading-snug" style={{ color: INK }}>{b.title}</p>
                <p className="text-[15px] font-medium mt-1 leading-relaxed" style={{ color: INK_SOFT }}>{b.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="relative z-10" style={{ background: '#0b2f66' }}>
        <div className="max-w-7xl mx-auto px-6 py-4 text-center text-white/85 text-sm">
          © {new Date().getFullYear()} Municipality of Cantilan. All rights reserved.  |  Cantilan, Surigao del Sur
        </div>
        <div className="max-w-7xl mx-auto px-6 pb-4 text-center text-white/70 text-xs">
          Developed by BS Information Technology 4D students, North Eastern Mindanao State University – Cantilan Campus
        </div>
      </div>
    </div>
  );
}
