import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import CitizenPortalLayout from '../../components/common/CitizenPortalLayout';
import { StatusBadge, TypeBadge } from '../../components/common/StatusBadge';

// Every rule on this page mirrors real system behavior: the Submit form's fields
// and validation (pages/citizen/Submit.jsx), the upload limits
// (server/src/middleware/upload.js), the tracking code format, the Track page's
// status messages, and the emails sent by server/src/utils/mailer.js.
// If any of those change, update this page too.

const css = `
@keyframes gl-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.gl-rise { animation: gl-rise .45s cubic-bezier(.2,.8,.2,1) both; }
.gl-badge { box-shadow: 0 6px 14px -6px rgba(37,99,235,.6), inset 0 1px 0 rgba(255,255,255,.3); }
.gl-ring { transition: stroke-dashoffset .5s cubic-bezier(.2,.8,.2,1), stroke .3s ease; }
.gl-faq summary::-webkit-details-marker { display: none; }
.gl-faq[open] .gl-plus { transform: rotate(45deg); }
.gl-plus { transition: transform .2s ease; }
.gl-strip::-webkit-scrollbar { display: none; }
html { scroll-behavior: smooth; }
@media (prefers-reduced-motion: reduce) {
  .gl-rise { animation: none; }
  html { scroll-behavior: auto; }
}
`;

function Ico({ d, className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {[].concat(d).map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

const ICONS = {
  book: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  steps: 'M13 5l7 7-7 7M5 5l7 7-7 7',
  form: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
  tag: 'M7 7h.01M7 3h5a1.99 1.99 0 011.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
  pen: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  camera: ['M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z', 'M15 13a3 3 0 11-6 0 3 3 0 016 0z'],
  ticket: 'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z',
  checkCircle: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  inbox: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  sparkle: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
  shield: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  lock: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  heart: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
  split: 'M4 6h16M4 12h16M4 18h7',
  phone: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
  question: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  check: 'M5 13l4 4L19 7',
  x: 'M6 18L18 6M6 6l12 12',
  plus: 'M12 4v16m8-8H4',
  arrow: 'M13 7l5 5m0 0l-5 5m5-5H6',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
};

const SECTIONS = [
  { id: 'how',       label: 'How it works' },
  { id: 'form',      label: 'The form at a glance' },
  { id: 'types',     label: 'Report types' },
  { id: 'write',     label: 'Writing a good report' },
  { id: 'after',     label: 'After you submit' },
  { id: 'checklist', label: 'Ready checklist' },
  { id: 'policies',  label: 'Policies' },
  { id: 'faq',       label: 'FAQ' },
];
const SECTION_IDS = SECTIONS.map(s => s.id);

const STEPS = [
  { icon: ICONS.tag,    title: 'Choose the type',          text: 'Complaint, Suggestion, or Feedback.' },
  { icon: ICONS.pen,    title: 'Describe the concern',     text: 'What happened, where, and when. At least 20 characters.' },
  { icon: ICONS.camera, title: 'Add photos',               text: 'Optional. Up to 5 JPG or PNG photos, 5 MB each.' },
  { icon: ICONS.ticket, title: 'Save your tracking code',  text: 'Use it on Track My Report to follow your report.' },
];

// Mirrors the Submit form, in the same order and with the same placeholders.
const FORM_FIELDS = [
  { label: 'Type of Concern',      required: true,  sample: 'Complaint',                                 note: 'Complaint, Suggestion, or Feedback.' },
  { label: 'Department Concerned', required: true,  sample: 'Select department / office…',               note: 'CIVIX suggests an office from your description. You can change it. Not asked for Feedback.' },
  { label: 'Location',             required: false, sample: 'Choose or type your barangay',              note: 'Pick your barangay from the list, then add a purok, street or landmark if you can.' },
  { label: 'Contact Number',       required: true,  sample: 'e.g. 09XX XXX XXXX',                        note: 'Your mobile number. We text you your tracking code and each status update.' },
  { label: 'Email Address',        required: true,  sample: 'e.g. juandelacruz@gmail.com',               note: 'We email you when your report is received and whenever its status changes.' },
  { label: 'Description',          required: true,  sample: 'There is a broken streetlight in front of…', note: 'At least 20 characters. Include what happened, where, when, and any other helpful details.' },
  { label: 'File Attachment',      required: false, sample: 'Click to upload or drag and drop',          note: 'Up to 5 photos, JPG or PNG, each up to 5 MB. Not asked for Feedback.' },
];

const REPORT_TYPES = [
  {
    type: 'COMPLAINT', accent: '#dc2626',
    when: 'Something is wrong and needs action.',
    examples: ['A broken streetlight or damaged road', 'Garbage that was not collected', 'Clogged drainage or flooding'],
  },
  {
    type: 'SUGGESTION', accent: '#2563eb',
    when: 'You have an idea to improve a service or place.',
    examples: ['More recycling bins in the park', 'Clearer signs at the public market', 'A better schedule for a service'],
  },
  {
    type: 'FEEDBACK', accent: '#16a34a',
    when: "You want to rate the municipality's service as a whole.",
    examples: ['Rate it from 1 to 5 stars (required)', 'Pick how you felt about it (required)', 'No office to choose and no photos; we email you a thank-you note'],
  },
];

const HIGHLIGHT = {
  what:   { label: 'What',           color: '#1d4ed8', bg: '#dbeafe' },
  where:  { label: 'Where',          color: '#6d28d9', bg: '#ede9fe' },
  when:   { label: 'When',           color: '#b45309', bg: '#fef3c7' },
  impact: { label: 'Why it matters', color: '#be123c', bg: '#ffe4e6' },
};

const STRONG_EXAMPLE = [
  { text: 'The streetlight', tag: 'what' },
  { text: ' in front of ' },
  { text: 'Brgy. Hall, Parang, Cantilan', tag: 'where' },
  { text: ' has been broken ' },
  { text: 'for 2 weeks', tag: 'when' },
  { text: '. ' },
  { text: 'The road is completely dark at night and dangerous for pedestrians.', tag: 'impact' },
];

// Same wording as the status messages on the Track page.
const STATUSES = [
  { status: 'PENDING',     text: 'Your submission has been received and is awaiting review.' },
  { status: 'REVIEWING',   text: 'Your submission is currently being reviewed by the concerned office.' },
  { status: 'IN_PROGRESS', text: 'The concerned office is actively working on your submission.' },
  { status: 'RESOLVED',    text: 'Your submission has been resolved. Thank you for your feedback!' },
];

const CHECKS = [
  'I picked the right type: Complaint, Suggestion, or Feedback',
  'I selected the concerned office, or kept the suggested one if it fits',
  'I described what happened, where, and when',
  'I entered a working contact number and email address',
  'I attached photos if I have them',
  'I will save my tracking code after submitting',
];

const POLICIES = [
  {
    icon: ICONS.lock, accent: '#2563eb', bg: '#eff6ff', title: 'Your data is protected',
    text: 'In compliance with the Data Privacy Act of 2012 (Republic Act No. 10173), the information you provide, such as your contact number and email, is used only to process and follow up on your report and is not shared with unauthorized third parties.',
  },
  {
    icon: ICONS.heart, accent: '#e11d48', bg: '#fff1f2', title: 'Be respectful and truthful',
    text: 'Use respectful language and report only information you believe is true. Clear, honest reports are resolved faster.',
  },
  {
    icon: ICONS.split, accent: '#7c3aed', bg: '#f5f3ff', title: 'One concern per report',
    text: 'Submit a separate report for each issue so each one can be routed to the right office.',
  },
  {
    icon: ICONS.phone, accent: '#dc2626', bg: '#fef2f2', title: 'Not for emergencies',
    text: 'CIVIX is not an emergency service. If someone is in danger, call the national emergency hotline 911 right away.',
  },
];

const FAQS = [
  { q: 'Do I need an account to submit a report?', a: 'No. You do not need to register. You only provide a contact number and email so the concerned office can reach you about your report.' },
  { q: 'How do I check the status of my report?', a: 'Open Track My Report and enter your tracking code. It looks like DEPT-YYYYMMDD-XXXX, for example ENG-20240527-0001.' },
  { q: 'What if I lose my tracking code?', a: 'Check your text messages or email. The tracking code is in the confirmation we send after you submit, and in every status update.' },
  { q: 'Who can see my report?', a: 'The office your report is routed to and the CIVIX administrators. Feedback goes to the administrators only. Your information is handled according to the Data Privacy Act.' },
  { q: 'Can I attach videos or documents?', a: 'Not at the moment. You can attach up to 5 photos in JPG or PNG format, each up to 5 MB.' },
];

const QUICK_FACTS = [
  { label: 'Account',        value: 'Not needed' },
  { label: 'Description',    value: 'At least 20 characters' },
  { label: 'Photos',         value: 'Up to 5 · JPG/PNG · 5 MB each' },
  { label: 'Tracking code',  value: 'DEPT-YYYYMMDD-XXXX' },
  { label: 'Updates',        value: 'By text and email' },
];

/* ─── Page-level hooks ─────────────────────────────────────────────────────── */

// Highlights the section currently in the upper part of the viewport. The last
// sections can't scroll that high, so at the bottom of the page the last one wins.
function useActiveSection(ids) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const atBottom = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    const observer = new IntersectionObserver(entries => {
      if (atBottom()) return;
      const visible = entries.filter(e => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    }, { rootMargin: '-15% 0px -70% 0px' });
    ids.forEach(id => { const el = document.getElementById(id); if (el) observer.observe(el); });
    const onScroll = () => { if (atBottom()) setActive(ids[ids.length - 1]); };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, [ids]);
  return active;
}

function useReadingProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(100, Math.round((window.scrollY / max) * 100)) : 100);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return progress;
}

/* ─── Building blocks ──────────────────────────────────────────────────────── */

// Same card + icon-heading style as the Submit page's form card.
function Section({ id, icon, title, subtitle, children }) {
  return (
    <section id={id} className="scroll-mt-20 xl:scroll-mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6 mb-6">
      <div className="flex items-start gap-3 mb-5">
        <div className="p-2 rounded-xl bg-blue-50 text-primary flex-shrink-0"><Ico d={icon} /></div>
        <div>
          <h2 className="font-bold text-gray-900 text-base sm:text-lg leading-tight">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function RequiredPill({ required }) {
  return required
    ? <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-600">Required</span>
    : <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-500">Optional</span>;
}

function WritingExample() {
  const [strong, setStrong] = useState(true);
  return (
    <div>
      <div className="inline-flex p-1 rounded-xl bg-gray-100 mb-4" role="tablist" aria-label="Report example">
        {[['Weak report', false], ['Strong report', true]].map(([label, value]) => (
          <button key={label} type="button" role="tab" aria-selected={strong === value} onClick={() => setStrong(value)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${strong === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Description</p>
        {strong ? (
          <p key="strong" className="gl-rise text-[15px] leading-loose text-gray-800">
            {STRONG_EXAMPLE.map((part, i) => part.tag ? (
              <span key={i} className="rounded-md px-1 py-0.5 font-medium" style={{ background: HIGHLIGHT[part.tag].bg, color: HIGHLIGHT[part.tag].color }}>
                {part.text}
              </span>
            ) : <span key={i}>{part.text}</span>)}
          </p>
        ) : (
          <p key="weak" className="gl-rise text-[15px] leading-loose text-gray-800">
            <span className="rounded-md px-1 py-0.5 font-medium" style={{ background: HIGHLIGHT.what.bg, color: HIGHLIGHT.what.color }}>Broken light.</span> Please fix.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        {Object.entries(HIGHLIGHT).map(([key, h]) => {
          const has = strong || key === 'what';
          return (
            <span key={key} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${has ? '' : 'bg-gray-100 text-gray-400 line-through'}`}
              style={has ? { background: h.bg, color: h.color } : undefined}>
              <Ico d={has ? ICONS.check : ICONS.x} className="w-3.5 h-3.5" /> {h.label}
            </span>
          );
        })}
      </div>
      <p className={`text-sm mt-3 font-medium ${strong ? 'text-green-700' : 'text-red-600'}`}>
        {strong
          ? 'The office knows what to fix, where to go, and how urgent it is.'
          : 'Too short to act on: which light, where, and since when? It would also fail the 20-character minimum.'}
      </p>
    </div>
  );
}

function ReadyChecklist() {
  const [done, setDone] = useState(() => CHECKS.map(() => false));
  const count = done.filter(Boolean).length;
  const ready = count === CHECKS.length;
  const R = 34, C = 2 * Math.PI * R;
  return (
    <div className="grid grid-cols-1 md:grid-cols-[170px_1fr] gap-6 items-center">
      <div className="flex flex-col items-center">
        <svg width="116" height="116" viewBox="0 0 90 90" role="img" aria-label={`${count} of ${CHECKS.length} done`}>
          <circle cx="45" cy="45" r={R} fill="none" stroke="#eef2f7" strokeWidth="9" />
          <circle className="gl-ring" cx="45" cy="45" r={R} fill="none" stroke={ready ? '#16a34a' : '#2563eb'} strokeWidth="9"
            strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - count / CHECKS.length)} transform="rotate(-90 45 45)" />
          <text x="45" y="43" textAnchor="middle" fontSize="18" fontWeight="700" fill="#111827">{count}/{CHECKS.length}</text>
          <text x="45" y="57" textAnchor="middle" fontSize="8" fontWeight="600" fill="#6b7280">DONE</text>
        </svg>
        <p className={`text-sm font-semibold mt-2 text-center ${ready ? 'text-green-600' : 'text-gray-500'}`}>
          {ready ? "You're ready to submit!" : 'Tick each item as you go'}
        </p>
        {ready && (
          <Link to="/submit" className="gl-rise mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors">
            Submit a Report <Ico d={ICONS.arrow} className="w-4 h-4" />
          </Link>
        )}
      </div>
      <ul className="space-y-2">
        {CHECKS.map((label, i) => (
          <li key={label}>
            <label className={`flex items-start gap-3 rounded-xl px-3.5 py-3 cursor-pointer border transition-colors ${done[i] ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-transparent hover:border-gray-200'}`}>
              <input type="checkbox" className="sr-only peer" checked={done[i]}
                onChange={() => setDone(prev => prev.map((v, j) => (j === i ? !v : v)))} />
              <span className={`mt-0.5 w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-blue-400 ${done[i] ? 'bg-green-600 border-green-600 text-white' : 'border-gray-300 bg-white'}`}>
                {done[i] && <Ico d={ICONS.check} className="w-3.5 h-3.5" />}
              </span>
              <span className={`text-sm ${done[i] ? 'text-green-800' : 'text-gray-700'}`}>{label}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */

export default function Guidelines() {
  const active = useActiveSection(SECTION_IDS);
  const progress = useReadingProgress();

  return (
    <CitizenPortalLayout>
      <style>{css}</style>
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6 items-start">
        <div className="min-w-0">

          {/* Header — same style as the Submit page header */}
          <div className="gl-rise mb-5 bg-blue-50 border border-blue-100 rounded-2xl px-6 py-5 flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-blue-600 text-white flex-shrink-0"><Ico d={ICONS.book} className="w-6 h-6" /></div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-800">Reporting Guidelines</h1>
              <p className="text-gray-500 text-sm mt-0.5">How to file a clear report that the concerned office can act on quickly.</p>
              <p className="text-gray-400 text-xs mt-0.5">No registration needed. Read this before you submit.</p>
            </div>
          </div>

          {/* Emergency notice — same shape as the Submit page's privacy notice */}
          <div className="mb-6 flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm leading-relaxed">
            <span className="mt-0.5 text-red-600 flex-shrink-0"><Ico d={ICONS.phone} className="w-4 h-4" /></span>
            <span className="text-red-800">
              <strong>For emergencies, call 911.</strong> CIVIX is for non-urgent concerns. If someone is in danger, call the national emergency hotline right away.
            </span>
          </div>

          {/* Sticky section strip for screens without the sidebar */}
          <nav className="xl:hidden sticky top-0 z-20 -mx-4 sm:-mx-8 px-4 sm:px-8 py-2.5 mb-5 backdrop-blur-md"
            style={{ background: 'rgba(238,242,249,0.9)' }} aria-label="Guideline sections">
            <div className="gl-strip flex gap-2 overflow-x-auto">
              {SECTIONS.map(s => (
                <a key={s.id} href={`#${s.id}`}
                  className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-sm font-semibold border transition-colors ${active === s.id ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200'}`}>
                  {s.label}
                </a>
              ))}
            </div>
          </nav>

          <Section id="how" icon={ICONS.steps} title="How it works" subtitle="Four steps from concern to tracking code.">
            <ol className="relative grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-4">
              <span className="hidden md:block absolute top-5 left-[12.5%] right-[12.5%] h-0.5 bg-blue-100" aria-hidden="true" />
              <span className="md:hidden absolute left-5 top-5 bottom-5 w-0.5 bg-blue-100" aria-hidden="true" />
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative flex md:flex-col md:items-center md:text-center gap-4 md:gap-3">
                  <div className="gl-badge relative z-10 w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>
                    <Ico d={s.icon} className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Step {i + 1}</p>
                    <h3 className="font-bold text-gray-900 text-sm mt-0.5">{s.title}</h3>
                    <p className="text-sm text-gray-500 mt-1 leading-relaxed">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          <Section id="form" icon={ICONS.form} title="The form at a glance"
            subtitle="Every field on the Submit a Report form, in the same order.">
            <div className="divide-y divide-gray-100">
              {FORM_FIELDS.map(f => (
                <div key={f.label} className="py-3.5 first:pt-0 last:pb-0 grid grid-cols-1 sm:grid-cols-[190px_1fr] gap-2 sm:gap-5">
                  <div className="flex items-center gap-2 sm:flex-col sm:items-start sm:gap-1.5">
                    <p className="text-sm font-semibold text-gray-800">{f.label}{f.required && <span className="text-red-500"> *</span>}</p>
                    <RequiredPill required={f.required} />
                  </div>
                  <div>
                    <div className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-400 truncate">{f.sample}</div>
                    <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{f.note}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-start gap-2.5 px-4 py-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-800 leading-relaxed">
              <span className="mt-0.5 flex-shrink-0"><Ico d={ICONS.info} className="w-4 h-4" /></span>
              <span>If you choose <strong>Feedback</strong>, the form also asks you to rate the service from 1 to 5 stars and pick how you felt. Both are required. Tags are optional.</span>
            </div>
          </Section>

          <Section id="types" icon={ICONS.tag} title="Which report type should I use?">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {REPORT_TYPES.map(t => (
                <div key={t.type} className="rounded-xl border border-gray-100 bg-gray-50/60 dark:bg-slate-900/40 p-4" style={{ borderTop: `3px solid ${t.accent}` }}>
                  <TypeBadge type={t.type} />
                  <p className="text-sm font-semibold text-gray-800 mt-3">{t.when}</p>
                  <ul className="mt-2.5 space-y-1.5">
                    {t.examples.map(ex => (
                      <li key={ex} className="flex items-start gap-2 text-sm text-gray-500">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: t.accent }} />
                        {ex}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Section>

          <Section id="write" icon={ICONS.pen} title="Write a report that gets action"
            subtitle="Switch between the two examples to see the difference.">
            <WritingExample />
          </Section>

          <Section id="after" icon={ICONS.checkCircle} title="After you submit"
            subtitle="This is the screen you will see, and what each status means.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center mb-6">
              {/* Preview of the real "Submission Received!" screen */}
              <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm">
                <div className="inline-flex p-3 rounded-full bg-green-50 text-green-600 mb-3"><Ico d={ICONS.checkCircle} className="w-9 h-9" /></div>
                <p className="text-lg font-bold text-gray-800">Submission Received!</p>
                <p className="text-sm text-gray-500 mt-1 mb-2">Your Transaction Code is:</p>
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 font-mono text-lg font-bold text-primary">ENG-20240527-0001</div>
                <p className="text-[11px] text-gray-400 mt-2">Example only. Your code will be different.</p>
              </div>
              <ul className="space-y-3">
                {[
                  { icon: ICONS.ticket, text: 'Write down or copy your code. You need it to check your report.' },
                  { icon: ICONS.inbox, text: 'The same code is in the confirmation text and email we send you.' },
                  { icon: ICONS.search, text: 'Enter it on Track My Report any time to see the latest status.' },
                ].map(item => (
                  <li key={item.text} className="flex items-start gap-3">
                    <span className="p-2 rounded-lg bg-blue-50 text-primary flex-shrink-0"><Ico d={item.icon} className="w-4 h-4" /></span>
                    <span className="text-sm text-gray-600 leading-relaxed pt-1">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-sm font-semibold text-gray-800 mb-3">What your status means</p>
            <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {STATUSES.map((s, i) => (
                <li key={s.status} className="relative rounded-xl border border-gray-100 bg-gray-50/60 dark:bg-slate-900/40 p-4">
                  <div className="flex items-center justify-between mb-2.5">
                    <StatusBadge status={s.status} />
                    <span className="text-xs font-bold text-gray-300">{i + 1}/4</span>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{s.text}</p>
                </li>
              ))}
            </ol>
            <p className="text-xs text-gray-400 mt-3">We text and email you each time your report moves to a new status.</p>
          </Section>

          <Section id="checklist" icon={ICONS.shield} title="Are you ready?"
            subtitle="Go through this quick checklist before you file your report.">
            <ReadyChecklist />
          </Section>

          <Section id="policies" icon={ICONS.lock} title="Our policies">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {POLICIES.map(p => (
                <div key={p.title} className="rounded-xl border border-gray-100 p-4 flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: p.bg, color: p.accent }}>
                    <Ico d={p.icon} className="w-[18px] h-[18px]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">{p.title}</h3>
                    <p className="text-sm text-gray-500 mt-1 leading-relaxed">{p.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section id="faq" icon={ICONS.question} title="Frequently asked questions">
            <div className="space-y-2.5">
              {FAQS.map(f => (
                <details key={f.q} className="gl-faq rounded-xl border border-gray-100 bg-gray-50/60 dark:bg-slate-900/40 px-4 py-3.5 open:bg-white dark:open:bg-slate-800 open:shadow-sm transition-colors">
                  <summary className="flex items-center justify-between gap-4 cursor-pointer list-none text-sm font-semibold text-gray-900">
                    {f.q}
                    <span className="gl-plus w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 flex-shrink-0">
                      <Ico d={ICONS.plus} className="w-3.5 h-3.5" />
                    </span>
                  </summary>
                  <p className="text-sm text-gray-600 mt-2.5 leading-relaxed pr-8">{f.a}</p>
                </details>
              ))}
            </div>
          </Section>

          {/* Call to action */}
          <div className="rounded-2xl px-6 sm:px-8 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5"
            style={{ background: 'linear-gradient(135deg, #0b2f66, #1e40af)', boxShadow: '0 16px 36px -18px rgba(11,47,102,.7)' }}>
            <div>
              <h2 className="text-lg font-bold text-white">Ready to make Cantilan better?</h2>
              <p className="text-white/75 text-sm mt-1">File a report or check on one you already sent.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/submit" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-blue-800 text-sm font-bold hover:bg-blue-50 transition-colors">
                <Ico d={ICONS.pen} className="w-4 h-4" /> Submit a Report
              </Link>
              <Link to="/track" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-white/30 text-white text-sm font-bold hover:bg-white/10 transition-colors">
                <Ico d={ICONS.search} className="w-4 h-4" /> Track My Report
              </Link>
            </div>
          </div>
        </div>

        {/* Sidebar — mirrors the Submit page's right column */}
        <aside className="hidden xl:block sticky top-6 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">On this page</p>
              <span className="text-xs font-semibold text-gray-400">{progress}%</span>
            </div>
            <div className="h-1 rounded-full bg-gray-100 overflow-hidden mb-3" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Reading progress">
              <div className="h-full rounded-full bg-primary transition-[width] duration-150" style={{ width: `${progress}%` }} />
            </div>
            <nav className="space-y-0.5" aria-label="Guideline sections">
              {SECTIONS.map(s => (
                <a key={s.id} href={`#${s.id}`} aria-current={active === s.id ? 'true' : undefined}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${active === s.id ? 'bg-blue-50 text-primary font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${active === s.id ? 'bg-primary' : 'bg-gray-300'}`} />
                  {s.label}
                </a>
              ))}
            </nav>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Quick facts</p>
            <dl className="space-y-2.5">
              {QUICK_FACTS.map(f => (
                <div key={f.label}>
                  <dt className="text-xs text-gray-400">{f.label}</dt>
                  <dd className="text-sm font-semibold text-gray-800">{f.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-1.5 text-primary">
              <Ico d={ICONS.question} className="w-4 h-4" />
              <p className="text-sm font-bold">Need help?</p>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">For assistance, visit or call Cantilan Town Hall during office hours.</p>
          </div>
        </aside>
      </div>
    </CitizenPortalLayout>
  );
}
