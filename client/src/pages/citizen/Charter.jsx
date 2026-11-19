import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import CitizenPortalLayout from '../../components/common/CitizenPortalLayout';
import { GUIDE_CSS, Ico, Section, SectionStrip, OnThisPage, useActiveSection, useReadingProgress } from '../../components/citizen/GuidePage';
import { useText } from '../../i18n/LanguageContext';
import CHARTER_TEXT from '../../i18n/charterText';
import { CHARTER_HOME, PROCESSING_DAYS, charterFor } from '../../data/charter';
import { officeLabel, DEFAULT_OFFICES } from '../../data/officeNames';
import { DEFAULT_DEADLINES } from '../../data/urgency';
import api from '../../utils/api';

// How the Citizen's Charter fits into CIVIX: each office's services (data/charter.js)
// with the time the law allows, and for each one the two ways to answer it, the
// satisfaction form (Feedback, opened with the code on the office's slip) and the
// complaint form. The offices are the ones in Settings → Departments, as on the
// report form, and the complaint deadlines come from Settings too. Wording in
// i18n/charterText.js.

const ICONS = {
  charter: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  steps: 'M13 5l7 7-7 7M5 5l7 7-7 7',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  ticket: 'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z',
  star: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
  alert: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  idea: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
  offices: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  chat: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
  chart: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  pen: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  checkCircle: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  external: 'M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14',
  info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  question: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
};

const SECTION_IDS = ['how', 'services', 'limits', 'mechanism'];

const STEP_ICONS = [ICONS.search, ICONS.ticket, ICONS.star, ICONS.alert];

const LIMIT_ACCENT = { SIMPLE: '#16a34a', COMPLEX: '#d97706', HIGHLY_TECHNICAL: '#dc2626' };

// The four parts of "Feedback and complaints", paired with the wording by position.
const MECHANISM_LOOK = [
  { icon: ICONS.chat,        accent: '#16a34a', bg: '#f0fdf4' },
  { icon: ICONS.chart,       accent: '#2563eb', bg: '#eff6ff' },
  { icon: ICONS.pen,         accent: '#dc2626', bg: '#fef2f2' },
  { icon: ICONS.checkCircle, accent: '#7c3aed', bg: '#f5f3ff' },
];

const SMALL_BUTTON = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors';

// One office's part of the charter: its services, each with the time the law allows
// and a button to the one form (feedback, complaint or suggestion; the office's code
// still decides the office), or a note that the charter doesn't have it yet.
function OfficeServices({ office, t }) {
  const part = charterFor(office);
  const name = officeLabel(office);
  if (!part) {
    return (
      <div data-not-in-charter className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-4">
        <p className="text-sm font-semibold text-gray-900">{t.notInCharter(name)}</p>
        <p className="text-sm text-gray-700 mt-1">{t.notInCharterText}</p>
        <div className="flex flex-wrap gap-2 mt-3">
          <Link to="/submit" state={{ department: office }} className={SMALL_BUTTON}><Ico d={ICONS.pen} className="w-4 h-4" /> {t.openForm}</Link>
        </div>
        <a href={CHARTER_HOME} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-3 text-sm font-semibold text-blue-700 hover:underline">
          {t.charterHome} <Ico d={ICONS.external} className="w-4 h-4" /><span className="sr-only"> {t.newTab}</span>
        </a>
      </div>
    );
  }
  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-3 mb-1 border-b border-gray-100">
        <div className="min-w-0">
          <h3 className="font-bold text-gray-900 text-base leading-snug">{name}</h3>
          <p className="text-xs text-gray-600 mt-0.5">{t.fromCharter} · {t.serviceCount(part.services.length)}</p>
        </div>
        <a href={part.pdf} target="_blank" rel="noopener noreferrer" data-charter-pdf
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline flex-shrink-0">
          {t.officialCopy} <Ico d={ICONS.external} className="w-4 h-4" /><span className="sr-only"> {t.newTab}</span>
        </a>
      </div>
      <ul className="divide-y divide-gray-100">
        {part.services.map(s => (
          <li key={s.name} data-service={s.name} className="py-3.5 flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{s.name}</p>
              {s.parts && <p className="text-xs text-gray-600 mt-0.5">{t.includes} {s.parts.join(' · ')}</p>}
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                {s.type && <span className="px-2 py-0.5 rounded-full font-bold bg-green-50 text-green-700">{t.typeName[s.type]}</span>}
                <span className="text-gray-600">{s.type ? t.atMost(PROCESSING_DAYS[s.type]) : t.noType}</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2 lg:flex-shrink-0">
              <Link to="/submit" state={{ service: s.name, department: office }} aria-label={t.rateOrComplainLabel(s.name)} className={SMALL_BUTTON}>
                <Ico d={ICONS.star} className="w-4 h-4" /> {t.rateOrComplain}
              </Link>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-2 pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-sm text-gray-700">
          <p>{t.ideaTitle}</p>
          {part.employeeServicesLeftOut && <p className="text-xs text-gray-600 mt-1">{t.othersInCopy}</p>}
        </div>
        <Link to="/submit" state={{ department: office }} className={`${SMALL_BUTTON} self-start sm:self-auto flex-shrink-0`}>
          <Ico d={ICONS.idea} className="w-4 h-4" /> {t.suggest}
        </Link>
      </div>
    </div>
  );
}

export default function Charter() {
  const t = useText(CHARTER_TEXT);
  const active = useActiveSection(SECTION_IDS);
  const progress = useReadingProgress();
  // The offices (Settings → Departments; null while loading) and the complaint
  // deadlines (Settings → Resolution Deadlines).
  const [offices, setOffices] = useState(null);
  const [deadlines, setDeadlines] = useState(DEFAULT_DEADLINES);
  const [chosen, setChosen] = useState(null);
  useEffect(() => {
    api.get('/settings/public').then(r => {
      if (r.data.deadlines) setDeadlines(d => ({ ...d, ...r.data.deadlines }));
      setOffices(Array.isArray(r.data.departments) && r.data.departments.length ? r.data.departments : DEFAULT_OFFICES);
    }).catch(() => setOffices(DEFAULT_OFFICES));
  }, []);
  // The office shown: the one chosen, else the first one the charter has.
  const office = offices && (offices.includes(chosen) ? chosen : offices.find(o => charterFor(o)) || offices[0]);

  return (
    <CitizenPortalLayout>
      <style>{GUIDE_CSS}</style>
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6 items-start">
        <div className="min-w-0">

          {/* Header — same style as the Submit and Guidelines page headers */}
          <div className="gl-rise mb-5 bg-blue-50 border border-blue-100 rounded-2xl px-6 py-5 flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-blue-600 text-white flex-shrink-0"><Ico d={ICONS.charter} className="w-6 h-6" /></div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-800">{t.title}</h1>
              <p className="text-gray-600 text-sm mt-0.5">{t.lead}</p>
              <p className="text-gray-600 text-xs mt-0.5">{t.note}</p>
            </div>
          </div>

          <SectionStrip ids={SECTION_IDS} names={t.sections} active={active} label={t.sectionsLabel} />

          <Section id="how" icon={ICONS.steps} title={t.howTitle} subtitle={t.howSubtitle}>
            <ol className="relative grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-4">
              <span className="hidden md:block absolute top-5 left-[12.5%] right-[12.5%] h-0.5 bg-blue-100" aria-hidden="true" />
              <span className="md:hidden absolute left-5 top-5 bottom-5 w-0.5 bg-blue-100" aria-hidden="true" />
              {t.steps.map((s, i) => (
                <li key={i} className="relative flex md:flex-col md:items-center md:text-center gap-4 md:gap-3">
                  <div className="gl-badge relative z-10 w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>
                    <Ico d={STEP_ICONS[i]} className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-primary">{t.step(i + 1)}</p>
                    <h3 className="font-bold text-gray-900 text-sm mt-0.5">{s.title}</h3>
                    <p className="text-sm text-gray-600 mt-1 leading-relaxed">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          <Section id="services" icon={ICONS.offices} title={t.servicesTitle} subtitle={t.servicesSubtitle}>
            {!offices ? (
              <p className="text-sm text-gray-600">{t.loadingOffices}</p>
            ) : (
              <>
                <div role="group" aria-label={t.officesLabel} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mb-5">
                  {offices.map(o => {
                    const part = charterFor(o);
                    const on = o === office;
                    return (
                      <button key={o} type="button" aria-pressed={on} onClick={() => setChosen(o)} data-office={o}
                        className={`text-left rounded-xl border-2 px-4 py-3 transition-colors ${on ? 'border-primary bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                        <span className="block text-sm font-semibold text-gray-900">{officeLabel(o)}</span>
                        <span className="block text-xs text-gray-600 mt-0.5">{part ? t.serviceCount(part.services.length) : t.notListed}</span>
                      </button>
                    );
                  })}
                </div>
                <div data-charter-office={office}>
                  <OfficeServices office={office} t={t} />
                </div>
              </>
            )}
          </Section>

          <Section id="limits" icon={ICONS.clock} title={t.limitsTitle} subtitle={t.limitsSubtitle}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {t.limits.map(l => (
                <div key={l.type} data-limit={l.type} className="rounded-xl border border-gray-100 bg-gray-50/60 dark:bg-slate-900/40 p-4"
                  style={{ borderTop: `3px solid ${LIMIT_ACCENT[l.type]}` }}>
                  <p className="text-sm font-bold text-gray-900">{t.typeName[l.type]}</p>
                  <p className="mt-1 text-gray-900">
                    <span className="text-2xl font-extrabold">{PROCESSING_DAYS[l.type]}</span>{' '}
                    <span className="text-sm font-semibold text-gray-700">{t.workingDays}</span>
                  </p>
                  <p className="text-sm text-gray-600 mt-2 leading-relaxed">{l.text}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 flex items-start gap-2 text-sm text-gray-700">
              <span className="mt-0.5 text-blue-700 flex-shrink-0"><Ico d={ICONS.info} className="w-4 h-4" /></span>
              {t.limitsNote}
            </p>
          </Section>

          <Section id="mechanism" icon={ICONS.chat} title={t.mechanismTitle} subtitle={t.mechanismSubtitle}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {t.mechanism(deadlines).map((m, i) => ({ ...MECHANISM_LOOK[i], ...m })).map((m, i) => (
                <div key={i} data-mechanism={i} className="rounded-xl border border-gray-100 p-4 flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: m.bg, color: m.accent }}>
                    <Ico d={m.icon} className="w-[18px] h-[18px]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">{m.title}</h3>
                    <p className="text-sm text-gray-600 mt-1 leading-relaxed">{m.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-gray-700"><strong className="text-gray-900">{t.contactTitle}</strong> {t.contactText}</p>
          </Section>

          {/* Call to action */}
          <div className="rounded-2xl px-6 sm:px-8 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5"
            style={{ background: 'linear-gradient(135deg, #0b2f66, #1e40af)', boxShadow: '0 16px 36px -18px rgba(11,47,102,.7)' }}>
            <div>
              <h2 className="text-lg font-bold text-white">{t.ctaTitle}</h2>
              <p className="text-white/75 text-sm mt-1">{t.ctaText}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/submit" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-blue-800 text-sm font-bold hover:bg-blue-50 transition-colors">
                <Ico d={ICONS.pen} className="w-4 h-4" /> {t.openForm}
              </Link>
            </div>
          </div>
        </div>

        {/* Sidebar — mirrors the Guidelines page */}
        <aside className="hidden xl:block sticky top-6 space-y-4">
          <OnThisPage ids={SECTION_IDS} names={t.sections} active={active} progress={progress}
            title={t.onThisPage} progressLabel={t.readingProgress} label={t.sectionsLabel} />
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-1.5 text-primary">
              <Ico d={ICONS.question} className="w-4 h-4" />
              <p className="text-sm font-bold">{t.needHelp}</p>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">{t.helpText}</p>
          </div>
        </aside>
      </div>
    </CitizenPortalLayout>
  );
}
