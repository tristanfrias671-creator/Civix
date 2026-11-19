import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BrandImg } from '../context/BrandingContext';
import { useLang, useText } from '../i18n/LanguageContext';
import LanguageSwitcher from '../components/citizen/LanguageSwitcher';
import Tour, { markTour, shouldAutoStart } from '../components/common/Tour';
import TOUR_TEXT, { tourSteps } from '../i18n/tourText';

// The page's wording in English, Filipino and Bisaya (official names stay as they are).
const TEXT = {
  en: {
    home: 'Home', submit: 'Submit a Report', track: 'Track My Report', guidelines: 'Guidelines', charter: "Citizen's Charter",
    welcome: 'Welcome to',
    intro: 'Your voice matters! Report your concerns, track your submissions, and help make Cantilan a cleaner, safer, and more progressive community.',
    tagline: 'A Cleaner, Safer, Stronger Cantilan for Everyone',
    cards: {
      report: ['Report a Concern', "Rate an office's service, or send a complaint or suggestion, with the code from the office."],
      track: ['Track Your Report', 'Check the status of your submitted concern.'],
      guidelines: ['View Guidelines', 'Learn about our policies and what to include in your report.'],
      help: ['Need Help?', 'Get assistance from our support team.'],
      charter: ["Citizen's Charter", "See each office's services and how long they may take, then rate a service or file a complaint."],
    },
    benefits: [
      ['Transparent Process', 'Your report is handled with care and transparency.'],
      ['Better Community', 'Together we build a safer, cleaner and progressive Cantilan.'],
      ['Fast & Reliable', 'We value your time and respond to your concerns.'],
      ['Citizen-Focused', 'Your feedback helps us serve you better.'],
    ],
    help: 'For assistance, visit or call Cantilan Town Hall during office hours.',
    rights: 'All rights reserved.',
    developedBy: 'Developed by BS Information Technology 4D students, North Eastern Mindanao State University – Cantilan Campus',
  },
  fil: {
    home: 'Home', submit: 'Magpadala ng Ulat', track: 'Subaybayan ang Ulat', guidelines: 'Mga Gabay', charter: "Citizen's Charter",
    welcome: 'Maligayang pagdating sa',
    intro: 'Mahalaga ang boses mo! Iulat ang iyong mga hinaing, subaybayan ang iyong mga ipinadala, at tumulong na gawing mas malinis, mas ligtas, at mas maunlad na komunidad ang Cantilan.',
    tagline: 'Mas Malinis, Mas Ligtas, Mas Matatag na Cantilan para sa Lahat',
    cards: {
      report: ['Mag-ulat ng Problema', 'I-rate ang serbisyo ng opisina, o magpadala ng reklamo o mungkahi, gamit ang code mula sa opisina.'],
      track: ['Subaybayan ang Iyong Ulat', 'Tingnan ang kalagayan ng iyong ipinadalang ulat.'],
      guidelines: ['Tingnan ang mga Gabay', 'Alamin ang aming mga patakaran at kung ano ang dapat isama sa iyong ulat.'],
      help: ['Kailangan ng Tulong?', 'Humingi ng tulong sa aming mga kawani.'],
      charter: ["Citizen's Charter", 'Tingnan ang mga serbisyo ng bawat opisina at gaano katagal ang mga ito, saka i-rate ang serbisyo o magreklamo.'],
    },
    benefits: [
      ['Malinaw na Proseso', 'Inaasikaso ang iyong ulat nang may malasakit at katapatan.'],
      ['Mas Mabuting Komunidad', 'Sama-sama nating itaguyod ang mas ligtas, mas malinis, at maunlad na Cantilan.'],
      ['Mabilis at Maaasahan', 'Pinahahalagahan namin ang iyong oras at tinutugunan ang iyong mga hinaing.'],
      ['Para sa Mamamayan', 'Ang iyong puna ay tumutulong sa amin na mas mapagsilbihan ka.'],
    ],
    help: 'Para sa tulong, bumisita o tumawag sa Munisipyo ng Cantilan sa oras ng opisina.',
    rights: 'Lahat ng karapatan ay nakalaan.',
    developedBy: 'Binuo ng mga mag-aaral ng BS Information Technology 4D, North Eastern Mindanao State University – Cantilan Campus',
  },
  ceb: {
    home: 'Home', submit: 'Ipadala ang Report', track: 'Sundan ang Report', guidelines: 'Mga Giya', charter: "Citizen's Charter",
    welcome: 'Malipayong pag-abot sa',
    intro: 'Importante ang imong tingog! I-report ang imong mga reklamo, sundan ang imong mga gipadala, ug tabangi nga mahimong mas limpyo, mas luwas, ug mas uswag nga komunidad ang Cantilan.',
    tagline: 'Mas Limpyo, Mas Luwas, Mas Lig-on nga Cantilan alang sa Tanan',
    cards: {
      report: ['Pag-report og Problema', 'I-rate ang serbisyo sa opisina, o ipadala ang reklamo o sugyot, gamit ang code gikan sa opisina.'],
      track: ['Sundan ang Imong Report', 'Tan-awa ang kahimtang sa imong gipadala nga report.'],
      guidelines: ['Tan-awa ang mga Giya', 'Hibal-i ang among mga lagda ug unsa ang ilakip sa imong report.'],
      help: ['Nanginahanglan og Tabang?', 'Pangayo og tabang sa among mga kawani.'],
      charter: ["Citizen's Charter", 'Tan-awa ang mga serbisyo sa matag opisina ug unsa kini kadugay, dayon i-rate ang serbisyo o pagreklamo.'],
    },
    benefits: [
      ['Klaro nga Proseso', 'Ang imong report atimanon pag-ayo ug klaro ang matag lakang.'],
      ['Mas Maayong Komunidad', 'Magkauban nato tukoron ang mas luwas, mas limpyo, ug uswag nga Cantilan.'],
      ['Paspas ug Kasaligan', 'Gipabilhan namo ang imong panahon ug among tubagon ang imong mga kabalaka.'],
      ['Alang sa Katawhan', 'Ang imong feedback motabang kanamo nga mas maayong makaserbisyo kanimo.'],
    ],
    help: 'Para sa tabang, bisitaha o tawagi ang Munisipyo sa Cantilan sa oras sa opisina.',
    rights: 'Tanang katungod gitagana.',
    developedBy: 'Gihimo sa mga estudyante sa BS Information Technology 4D, North Eastern Mindanao State University – Cantilan Campus',
  },
};

const FEATURE_CARDS = [
  {
    key: 'report',
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
    color: '#d97706',
    action: (nav, t) => toast(t.help, { icon: '📞' }),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M12 16v-4m0-4h.01" />
      </svg>
    ),
  },
  // The whole row under the other four.
  {
    key: 'charter',
    color: '#0891b2',
    wide: true,
    action: (nav) => nav('/charter'),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
];

const BENEFITS = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
      </svg>
    ),
  },
  {
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

/* Phones and tablets: each card pops up as it scrolls into view (see useScrollPop).
   "backwards" keeps the hover lift working once the pop has played. */
@keyframes rsPopIn {
  0%   { opacity: 0; transform: translateY(32px) scale(.94); }
  60%  { opacity: 1; transform: translateY(-4px) scale(1.02); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@media (max-width: 1023px) {
  .rs-pop-armed .rs-pop:not(.rs-in) { opacity: 0; transform: translateY(32px) scale(.94); }
  .rs-pop-armed .rs-pop.rs-in { animation: rsPopIn .7s cubic-bezier(.22,1,.36,1) backwards; }
}
`;

// Phones and tablets: the feature cards and the benefits pop up one by one the first
// time they scroll into view (desktop keeps the fade-in on load; the CSS above only
// hides them below 1024px). Without IntersectionObserver, or with reduced motion,
// nothing is hidden. Armed before the first paint, so nothing flashes.
function useScrollPop(rootRef) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    root.classList.add('rs-pop-armed');
    const observer = new IntersectionObserver(entries => {
      entries.filter(e => e.isIntersecting).forEach((e, i) => {
        e.target.style.animationDelay = `${i * 90}ms`; // several at once: one after another
        e.target.classList.add('rs-in');
        observer.unobserve(e.target);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
    root.querySelectorAll('.rs-pop').forEach(el => observer.observe(el));
    return () => { observer.disconnect(); root.classList.remove('rs-pop-armed'); };
  }, [rootRef]);
}

export default function RoleSelect() {
  const navigate = useNavigate();
  const t = useText(TEXT);
  const { lang } = useLang();
  const pageRef = useRef(null);
  useScrollPop(pageRef);

  // The guided tour: by itself on the first visit (after the page has faded in), and
  // from the link under the two buttons.
  const tt = useText(TOUR_TEXT);
  const tourStepsHome = useMemo(() => tourSteps('home', tt), [tt]);
  const [tourOpen, setTourOpen] = useState(false);
  const closeTour = useCallback(how => {
    setTourOpen(false);
    markTour('home', how);
  }, []);
  useEffect(() => {
    if (!shouldAutoStart('home')) return undefined;
    const timer = setTimeout(() => setTourOpen(true), 900);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div ref={pageRef} className="min-h-screen relative" style={{ background: '#eef2f9' }} lang={lang}>
      <style>{popCss}</style>

      {/* ── Full-page fixed photo background (shows through below the hero too). Its box
          keeps one size, so phones don't zoom the photo while scrolling (see index.css). ── */}
      <div className="cvx-photo-backdrop" aria-hidden="true">
        <BrandImg kind="hero" className="absolute inset-0 w-full h-full object-cover" />
        {/* Light blue wash over the photo (about half its former strength, so the building stays clear). */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(6,16,42,0.06) 0%, rgba(70,100,150,0.13) 30%, rgba(160,185,220,0.2) 48%, rgba(160,185,220,0.25) 100%)' }} />
        {/* Extra shade behind the hero text so white text stays readable on a bright photo:
            from the left on wide screens, from the top on phones. */}
        <div className="absolute inset-0 hidden md:block" style={{
          background: 'linear-gradient(90deg, rgba(6,16,42,0.64) 0%, rgba(6,16,42,0.44) 38%, rgba(6,16,42,0) 60%)',
          WebkitMaskImage: 'linear-gradient(180deg, #000 0%, #000 58%, transparent 80%)',
          maskImage: 'linear-gradient(180deg, #000 0%, #000 58%, transparent 80%)',
        }} />
        <div className="absolute inset-0 md:hidden" style={{ background: 'linear-gradient(180deg, rgba(6,16,42,0.5) 0%, rgba(6,16,42,0.56) 55%, rgba(6,16,42,0) 78%)' }} />
      </div>

      {/* ── Top Navbar ── */}
      <header className="relative z-20" style={{ background: 'linear-gradient(90deg, rgba(11,47,102,0.88), rgba(18,58,122,0.8))', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center gap-3 sm:gap-4">
          <BrandImg kind="seal" alt="Municipality of Cantilan" className="w-12 h-12 object-contain flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-white/85 text-xs font-semibold leading-none">Municipality of Cantilan</p>
            <h1 className="text-white text-sm sm:text-base font-extrabold leading-tight sm:truncate">Surigao Del Sur - Philippines</h1>
          </div>

          {/* The five links fit on one line from 1280px (Filipino and Bisaya are the
              longest); narrower screens reach the same pages through the buttons and
              cards below, as on phones. */}
          <nav className="hidden xl:flex items-center gap-1 ml-8">
            <span className="flex items-center gap-1.5 px-3 py-2 text-[15px] font-semibold text-white border-b-2 border-blue-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4a1 1 0 001-1v-5h2v5a1 1 0 001 1h4a1 1 0 001-1V10" />
              </svg>
              {t.home}
            </span>
            <button onClick={() => navigate('/submit')}
              className="rs-navlink flex items-center gap-1.5 px-3 py-2 text-[15px] font-semibold text-white/90 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {t.submit}
            </button>
            <button onClick={() => navigate('/track')}
              className="rs-navlink flex items-center gap-1.5 px-3 py-2 text-[15px] font-semibold text-white/90 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
              </svg>
              {t.track}
            </button>
            <button onClick={() => navigate('/guidelines')}
              className="rs-navlink flex items-center gap-1.5 px-3 py-2 text-[15px] font-semibold text-white/90 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              {t.guidelines}
            </button>
            <button onClick={() => navigate('/charter')}
              className="rs-navlink flex items-center gap-1.5 px-3 py-2 text-[15px] font-semibold text-white/90 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              {t.charter}
            </button>
          </nav>
          <LanguageSwitcher className="ml-auto flex-shrink-0" />
        </div>
      </header>

      {/* ── Hero: 520px tall on wide screens; on phones as tall as its text (longer in
          Filipino and Bisaya), with room above and below ── */}
      <div className="relative z-10 overflow-hidden md:h-[520px]">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(100deg, rgba(6,16,42,0.4) 10%, rgba(10,30,70,0.15) 50%, rgba(20,50,100,0.03) 100%)' }} />

        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-10 pb-10 md:py-0 md:h-full flex items-center">
          <div className="max-w-2xl" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.35)' }}>
            <span className="rs-fade-0 rs-pulse-dot inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold mb-5"
              style={{ background: 'rgba(16,185,129,0.18)', color: '#6ee7b7', border: '1px solid rgba(110,231,183,0.35)' }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Cantilan, Surigao del Sur
            </span>
            <p className="rs-fade-0 text-white/90 text-lg font-medium mb-1">{t.welcome}</p>
            <h1 className="rs-fade-1 text-white font-extrabold leading-[0.95] tracking-tight mb-3" style={{ fontSize: 'clamp(2.2rem, 5vw, 3.5rem)' }}>
              Municipality of Cantilan
            </h1>
            <p className="rs-fade-2 text-white text-xl font-semibold mb-4">Citizen Complaint and Service Management System</p>
            <p className="rs-fade-2 text-white/95 text-base leading-relaxed mb-8 max-w-lg">
              {t.intro}
            </p>
            {/* Phones: the two buttons stack at the same full width */}
            <div className="rs-fade-3 flex flex-col sm:flex-row sm:flex-wrap gap-3">
              <button onClick={() => navigate('/submit')} data-tour="home-submit"
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-base text-white transition-transform hover:-translate-y-0.5"
                style={{ background: '#2563eb', boxShadow: '0 8px 24px rgba(37,99,235,0.4)' }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                {t.submit}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
              <button onClick={() => navigate('/track')} data-tour="home-track"
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-base text-white border transition-colors"
                style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.35)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.16)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
                </svg>
                {t.track}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
            <button type="button" onClick={() => setTourOpen(true)} data-tour-replay
              className="rs-fade-3 mt-4 inline-flex items-center gap-2 min-h-[44px] text-[15px] font-semibold text-white underline underline-offset-4 decoration-white/60 hover:decoration-white rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" /><path d="M10 8.5v7l5.5-3.5z" />
              </svg>
              {tt.ui.takeTour}
            </button>
          </div>

          <p className="hidden xl:block ml-auto text-white italic font-medium text-xl leading-snug text-right" style={{ fontFamily: 'Georgia, serif', maxWidth: 280, textShadow: '0 2px 8px rgba(0,0,0,0.75), 0 1px 2px rgba(0,0,0,0.6)' }}>
            {t.tagline}
          </p>
        </div>
      </div>

      {/* ── Feature cards: on wide screens they overlap the hero's bottom edge; on phones
          they start below the buttons and line up with the hero text ── */}
      <div className="rs-fade-3 max-w-7xl mx-auto px-6 md:-mt-8 relative z-10">
        <div className="rounded-2xl sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {FEATURE_CARDS.map(card => (
            <button key={card.key} onClick={() => card.action(navigate, t)} data-tour={`home-${card.key}`}
              className={`rs-feature-card rs-pop group flex items-start gap-3 text-left rounded-xl p-4 ${card.wide ? 'sm:col-span-2 lg:col-span-4' : ''}`}
              style={{ background: CARD_GLASS, boxShadow: CARD_SHADOW, backdropFilter: CARD_BLUR, WebkitBackdropFilter: CARD_BLUR }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white transition-transform duration-300 group-hover:scale-110"
                style={{ background: card.color }}>
                <span style={{ width: 18, height: 18, display: 'flex' }}>{card.icon}</span>
              </div>
              <div className="min-w-0 flex-1" style={{ textShadow: CARD_TEXT_SHADOW }}>
                <p className="font-bold text-base leading-snug" style={{ color: '#ffffff' }}>{t.cards[card.key][0]}</p>
                <p className="text-[15px] font-medium mt-1 leading-relaxed" style={{ color: '#f1f5f9' }}>{t.cards[card.key][1]}</p>
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
            <div key={i} className="rs-pop group flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-md"
                style={{ background: '#ffffff', color: '#2563eb' }}>
                <span style={{ width: 20, height: 20, display: 'flex' }}>{b.icon}</span>
              </div>
              <div>
                <p className="font-bold text-base leading-snug" style={{ color: INK }}>{t.benefits[i][0]}</p>
                <p className="text-[15px] font-medium mt-1 leading-relaxed" style={{ color: INK_SOFT }}>{t.benefits[i][1]}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="relative z-10" style={{ background: '#0b2f66' }}>
        <div className="max-w-7xl mx-auto px-6 py-4 text-center text-white/85 text-sm">
          © {new Date().getFullYear()} Municipality of Cantilan. {t.rights}  |  Cantilan, Surigao del Sur
        </div>
        <div className="max-w-7xl mx-auto px-6 pb-4 text-center text-white/70 text-xs">
          {t.developedBy}
        </div>
      </div>

      <Tour open={tourOpen} steps={tourStepsHome} labels={tt.ui} lang={lang} onClose={closeTour} />
    </div>
  );
}
