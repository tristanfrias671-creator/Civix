import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import CitizenPortalLayout from '../../components/common/CitizenPortalLayout';
import { GUIDE_CSS, Ico, Section, SectionStrip, OnThisPage, useActiveSection, useReadingProgress } from '../../components/citizen/GuidePage';
import { StatusBadge, TypeBadge } from '../../components/common/StatusBadge';
import { useText } from '../../i18n/LanguageContext';
import GUIDELINES_TEXT from '../../i18n/guidelinesText';
import SUBMIT_TEXT from '../../i18n/submitText';
import TRACK_TEXT from '../../i18n/trackText';

// Every rule on this page mirrors real system behavior: the Submit form's fields
// and validation (pages/citizen/Submit.jsx), the upload limits
// (server/src/middleware/upload.js), the tracking code format, the Track page's
// status messages, and the emails sent by server/src/utils/mailer.js.
// If any of those change, update this page too. The wording is in
// i18n/guidelinesText.js (English, Filipino, Bisaya); this file keeps the icons
// and colors, paired with the wording by position.

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

const SECTION_IDS = ['how', 'form', 'types', 'write', 'after', 'checklist', 'policies', 'faq'];

const STEP_ICONS = [ICONS.tag, ICONS.pen, ICONS.camera, ICONS.ticket];

// The Submit form's fields, in its order. Names and sample text come from the
// form's own wording (SUBMIT_TEXT); the notes from GUIDELINES_TEXT.fieldNotes.
const noStar = label => label.replace(/\s*\*$/, '');
const formFields = st => [
  { key: 'type',        required: true,  label: noStar(st.typeLabel),   sample: st.types.COMPLAINT },
  { key: 'office',      required: true,  label: noStar(st.officeLabel), sample: st.officePlaceholder },
  { key: 'location',    required: false, label: st.locationLabel,       sample: st.locationPlaceholder },
  { key: 'phone',       required: true,  label: noStar(st.phoneLabel),  sample: st.phonePlaceholder },
  { key: 'email',       required: true,  label: noStar(st.emailLabel),  sample: st.emailPlaceholder },
  { key: 'description', required: true,  label: noStar(st.descLabel),   sample: null }, // GUIDELINES_TEXT.descSample
  // Set automatically from the description: nothing to fill in.
  { key: 'urgency',     auto: true,      label: st.urgencyName,
    sample: ['URGENT', 'STANDARD', 'LOW'].map(level => st.urgencyLevels[level].name).join(' · ') },
  { key: 'photos',      required: false, label: st.photosLabel.replace(/\s*\(.*\)$/, ''), sample: st.photosClick + st.photosDrag },
];

const REPORT_TYPES = [
  { type: 'COMPLAINT',  accent: '#dc2626' },
  { type: 'SUGGESTION', accent: '#2563eb' },
  { type: 'FEEDBACK',   accent: '#16a34a' },
];

const HIGHLIGHT = {
  what:   { color: '#1d4ed8', bg: '#dbeafe' },
  where:  { color: '#6d28d9', bg: '#ede9fe' },
  when:   { color: '#b45309', bg: '#fef3c7' },
  impact: { color: '#be123c', bg: '#ffe4e6' },
};

// Same wording as the status messages on the Track page (TRACK_TEXT.tones).
const STATUSES = ['PENDING', 'REVIEWING', 'IN_PROGRESS', 'RESOLVED'];

const CHECK_COUNT = 6; // GUIDELINES_TEXT.checks

const POLICY_LOOK = [
  { icon: ICONS.lock,  accent: '#2563eb', bg: '#eff6ff' },
  { icon: ICONS.heart, accent: '#e11d48', bg: '#fff1f2' },
  { icon: ICONS.split, accent: '#7c3aed', bg: '#f5f3ff' },
  { icon: ICONS.phone, accent: '#dc2626', bg: '#fef2f2' },
];

/* ─── Building blocks ──────────────────────────────────────────────────────── */

function RequiredPill({ required, auto }) {
  const g = useText(GUIDELINES_TEXT);
  if (auto) return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700">{g.automatic}</span>;
  return required
    ? <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700">{g.required}</span>
    : <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-600">{g.optional}</span>;
}

function WritingExample() {
  const g = useText(GUIDELINES_TEXT);
  const [strong, setStrong] = useState(true);
  return (
    <div>
      <div className="inline-flex p-1 rounded-xl bg-gray-100 mb-4" role="tablist" aria-label={g.exampleLabel}>
        {[[g.weak, false], [g.strong, true]].map(([label, value]) => (
          <button key={label} type="button" role="tab" aria-selected={strong === value} onClick={() => setStrong(value)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${strong === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{g.descriptionLabel}</p>
        {strong ? (
          <p key="strong" className="gl-rise text-[15px] leading-loose text-gray-800">
            {g.strongExample.map((part, i) => part.tag ? (
              <span key={i} className="rounded-md px-1 py-0.5 font-medium" style={{ background: HIGHLIGHT[part.tag].bg, color: HIGHLIGHT[part.tag].color }}>
                {part.text}
              </span>
            ) : <span key={i}>{part.text}</span>)}
          </p>
        ) : (
          <p key="weak" className="gl-rise text-[15px] leading-loose text-gray-800">
            <span className="rounded-md px-1 py-0.5 font-medium" style={{ background: HIGHLIGHT.what.bg, color: HIGHLIGHT.what.color }}>{g.weakExample[0]}</span>{g.weakExample[1]}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        {Object.entries(HIGHLIGHT).map(([key, h]) => {
          const has = strong || key === 'what';
          return (
            <span key={key} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${has ? '' : 'bg-gray-100 text-gray-400 line-through'}`}
              style={has ? { background: h.bg, color: h.color } : undefined}>
              <Ico d={has ? ICONS.check : ICONS.x} className="w-3.5 h-3.5" /> {g.highlight[key]}
            </span>
          );
        })}
      </div>
      <p className={`text-sm mt-3 font-medium ${strong ? 'text-green-700' : 'text-red-600'}`}>
        {strong ? g.strongVerdict : g.weakVerdict}
      </p>
    </div>
  );
}

function ReadyChecklist() {
  const g = useText(GUIDELINES_TEXT);
  const [done, setDone] = useState(() => Array(CHECK_COUNT).fill(false));
  const count = done.filter(Boolean).length;
  const ready = count === CHECK_COUNT;
  const R = 34, C = 2 * Math.PI * R;
  return (
    <div className="grid grid-cols-1 md:grid-cols-[170px_1fr] gap-6 items-center">
      <div className="flex flex-col items-center">
        <svg width="116" height="116" viewBox="0 0 90 90" role="img" aria-label={g.doneOf(count, CHECK_COUNT)}>
          <circle cx="45" cy="45" r={R} fill="none" stroke="#eef2f7" strokeWidth="9" />
          <circle className="gl-ring" cx="45" cy="45" r={R} fill="none" stroke={ready ? '#16a34a' : '#2563eb'} strokeWidth="9"
            strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - count / CHECK_COUNT)} transform="rotate(-90 45 45)" />
          <text x="45" y="43" textAnchor="middle" fontSize="18" fontWeight="700" fill="#111827">{count}/{CHECK_COUNT}</text>
          <text x="45" y="57" textAnchor="middle" fontSize="8" fontWeight="600" fill="#6b7280">{g.done}</text>
        </svg>
        <p className={`text-sm font-semibold mt-2 text-center ${ready ? 'text-green-600' : 'text-gray-500'}`}>
          {ready ? g.ready : g.tickEach}
        </p>
        {ready && (
          <Link to="/submit" className="gl-rise mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors">
            {g.submitReport} <Ico d={ICONS.arrow} className="w-4 h-4" />
          </Link>
        )}
      </div>
      <ul className="space-y-2">
        {g.checks.map((label, i) => (
          <li key={i}>
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
  const g = useText(GUIDELINES_TEXT);
  const st = useText(SUBMIT_TEXT);
  const tt = useText(TRACK_TEXT);

  return (
    <CitizenPortalLayout>
      <style>{GUIDE_CSS}</style>
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6 items-start">
        <div className="min-w-0">

          {/* Header — same style as the Submit page header */}
          <div className="gl-rise mb-5 bg-blue-50 border border-blue-100 rounded-2xl px-6 py-5 flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-blue-600 text-white flex-shrink-0"><Ico d={ICONS.book} className="w-6 h-6" /></div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-800">{g.title}</h1>
              <p className="text-gray-600 text-sm mt-0.5">{g.lead}</p>
              <p className="text-gray-600 text-xs mt-0.5">{g.note}</p>
            </div>
          </div>

          {/* Emergency notice — same shape as the Submit page's privacy notice */}
          <div className="mb-6 flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm leading-relaxed">
            <span className="mt-0.5 text-red-600 flex-shrink-0"><Ico d={ICONS.phone} className="w-4 h-4" /></span>
            <span className="text-red-800">
              <strong>{g.emergency[0]}</strong> {g.emergency[1]}
            </span>
          </div>

          {/* Sticky section strip for screens without the sidebar */}
          <SectionStrip ids={SECTION_IDS} names={g.sections} active={active} label={g.sectionsLabel} />

          <Section id="how" icon={ICONS.steps} title={g.howTitle} subtitle={g.howSubtitle}>
            <ol className="relative grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-4">
              <span className="hidden md:block absolute top-5 left-[12.5%] right-[12.5%] h-0.5 bg-blue-100" aria-hidden="true" />
              <span className="md:hidden absolute left-5 top-5 bottom-5 w-0.5 bg-blue-100" aria-hidden="true" />
              {g.steps.map((s, i) => (
                <li key={i} className="relative flex md:flex-col md:items-center md:text-center gap-4 md:gap-3">
                  <div className="gl-badge relative z-10 w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>
                    <Ico d={STEP_ICONS[i]} className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-primary">{g.step(i + 1)}</p>
                    <h3 className="font-bold text-gray-900 text-sm mt-0.5">{s.title}</h3>
                    <p className="text-sm text-gray-500 mt-1 leading-relaxed">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          <Section id="form" icon={ICONS.form} title={g.formTitle} subtitle={g.formSubtitle}>
            <div className="divide-y divide-gray-100">
              {formFields(st).map(f => (
                <div key={f.key} className="py-3.5 first:pt-0 last:pb-0 grid grid-cols-1 sm:grid-cols-[190px_1fr] gap-2 sm:gap-5">
                  <div className="flex items-center gap-2 sm:flex-col sm:items-start sm:gap-1.5">
                    <p className="text-sm font-semibold text-gray-800">{f.label}{f.required && <span className="text-red-600"> *</span>}</p>
                    <RequiredPill required={f.required} auto={f.auto} />
                  </div>
                  <div>
                    <div className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-500 truncate">{f.sample || g.descSample}</div>
                    <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{g.fieldNotes[f.key]}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-start gap-2.5 px-4 py-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-800 leading-relaxed">
              <span className="mt-0.5 flex-shrink-0"><Ico d={ICONS.info} className="w-4 h-4" /></span>
              <span>{g.feedbackInfo[0]}<strong>{g.feedbackInfo[1]}</strong>{g.feedbackInfo[2]}</span>
            </div>
          </Section>

          <Section id="types" icon={ICONS.tag} title={g.typesTitle}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {REPORT_TYPES.map(t => (
                <div key={t.type} className="rounded-xl border border-gray-100 bg-gray-50/60 dark:bg-slate-900/40 p-4" style={{ borderTop: `3px solid ${t.accent}` }}>
                  <TypeBadge type={t.type} label={tt.types[t.type]} />
                  <p className="text-sm font-semibold text-gray-800 mt-3">{g.typeInfo[t.type].when}</p>
                  <ul className="mt-2.5 space-y-1.5">
                    {g.typeInfo[t.type].examples.map((ex, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-500">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: t.accent }} />
                        {ex}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-gray-600">
              {g.charterNote[0]}<Link to="/charter" className="font-semibold text-blue-700 hover:underline">{g.charterNote[1]}</Link>{g.charterNote[2]}
            </p>
          </Section>

          <Section id="write" icon={ICONS.pen} title={g.writeTitle} subtitle={g.writeSubtitle}>
            <WritingExample />
          </Section>

          <Section id="after" icon={ICONS.checkCircle} title={g.afterTitle} subtitle={g.afterSubtitle}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center mb-6">
              {/* Preview of the real "Submission Received!" screen */}
              <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm">
                <div className="inline-flex p-3 rounded-full bg-green-50 text-green-600 mb-3"><Ico d={ICONS.checkCircle} className="w-9 h-9" /></div>
                <p className="text-lg font-bold text-gray-800">{st.receivedTitle}</p>
                <p className="text-sm text-gray-500 mt-1 mb-2">{st.yourCode}</p>
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 font-mono text-lg font-bold text-primary">MHO-20261029-K7Q3</div>
                <p className="text-[11px] text-gray-500 mt-2">{g.exampleOnly}</p>
              </div>
              <ul className="space-y-3">
                {[ICONS.ticket, ICONS.inbox, ICONS.search].map((icon, i) => ({ icon, text: g.afterTips[i] })).map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="p-2 rounded-lg bg-blue-50 text-primary flex-shrink-0"><Ico d={item.icon} className="w-4 h-4" /></span>
                    <span className="text-sm text-gray-600 leading-relaxed pt-1">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-sm font-semibold text-gray-800 mb-3">{g.statusTitle}</p>
            <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {STATUSES.map((status, i) => (
                <li key={status} className="relative rounded-xl border border-gray-100 bg-gray-50/60 dark:bg-slate-900/40 p-4">
                  <div className="flex items-center justify-between mb-2.5">
                    <StatusBadge status={status} label={tt.status[status]} />
                    <span className="text-xs font-bold text-gray-500">{i + 1}/4</span>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{tt.tones[status].message}</p>
                </li>
              ))}
            </ol>
            <p className="text-xs text-gray-500 mt-3">{g.statusUpdates}</p>
          </Section>

          <Section id="checklist" icon={ICONS.shield} title={g.checklistTitle} subtitle={g.checklistSubtitle}>
            <ReadyChecklist />
          </Section>

          <Section id="policies" icon={ICONS.lock} title={g.policiesTitle}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {g.policies.map((words, i) => ({ ...POLICY_LOOK[i], ...words })).map((p, i) => (
                <div key={i} className="rounded-xl border border-gray-100 p-4 flex items-start gap-3.5">
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

          <Section id="faq" icon={ICONS.question} title={g.faqTitle}>
            <div className="space-y-2.5">
              {g.faqs.map((f, i) => (
                <details key={i} className="gl-faq rounded-xl border border-gray-100 bg-gray-50/60 dark:bg-slate-900/40 px-4 py-3.5 open:bg-white dark:open:bg-slate-800 open:shadow-sm transition-colors">
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
              <h2 className="text-lg font-bold text-white">{g.ctaTitle}</h2>
              <p className="text-white/75 text-sm mt-1">{g.ctaText}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/submit" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-blue-800 text-sm font-bold hover:bg-blue-50 transition-colors">
                <Ico d={ICONS.pen} className="w-4 h-4" /> {g.submitReport}
              </Link>
              <Link to="/track" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-white/30 text-white text-sm font-bold hover:bg-white/10 transition-colors">
                <Ico d={ICONS.search} className="w-4 h-4" /> {g.trackReport}
              </Link>
            </div>
          </div>
        </div>

        {/* Sidebar — mirrors the Submit page's right column */}
        <aside className="hidden xl:block sticky top-6 space-y-4">
          <OnThisPage ids={SECTION_IDS} names={g.sections} active={active} progress={progress}
            title={g.onThisPage} progressLabel={g.readingProgress} label={g.sectionsLabel} />

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">{g.quickFactsTitle}</p>
            <dl className="space-y-2.5">
              {g.quickFacts.map((f, i) => (
                <div key={i}>
                  <dt className="text-xs text-gray-500">{f.label}</dt>
                  <dd className="text-sm font-semibold text-gray-800">{f.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-1.5 text-primary">
              <Ico d={ICONS.question} className="w-4 h-4" />
              <p className="text-sm font-bold">{g.needHelp}</p>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">{g.helpText}</p>
          </div>
        </aside>
      </div>
    </CitizenPortalLayout>
  );
}
