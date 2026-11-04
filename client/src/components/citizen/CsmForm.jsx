import React, { useLayoutEffect, useRef, useState } from 'react';
import { useText } from '../../i18n/LanguageContext';
import CSM_TEXT from '../../i18n/csmText';
import { CLIENT_TYPES, SEXES, REGIONS, SQD_KEYS, SCALE, NA } from '../../data/csm';
import CsmFace from '../common/CsmFace';
import { Req, RequiredNote, Starred } from '../common/RequiredMark';
import { BrandImg } from '../../context/BrandingContext';

const formCss = `
.csm-radio { width: 1.15rem; height: 1.15rem; accent-color: #1d4ed8; flex-shrink: 0; cursor: pointer; }
.dark .csm-radio { accent-color: #60a5fa; color-scheme: dark; }
.csm-band { background: #f1f5f9; border-left: 4px solid #1d4ed8; }
.dark .csm-band { background: #334155; border-left-color: #60a5fa; }
.csm-head { background: #f1f5f9; }
.dark .csm-head { background: #334155; }
.csm-rule { border-color: #334155; }
.dark .csm-rule { border-color: #94a3b8; }
`;

// The heading of the Municipality's printed forms (official names, the same in
// every language).
const LETTERHEAD = ['Republic of the Philippines', 'Province of Surigao del Sur', 'Municipality of Cantilan'];

// From this width (px) the statements and their answers sit in a table, as on the
// printed form; narrower (phones), the faces head the box and each statement has its
// own row of circles under them.
const TABLE_MIN = 600;
// The table's answer columns: the five faces, then N/A.
const ANSWER_COLS = 'repeat(5, 4.5rem) 4rem';
const ANSWERS_WIDTH = '26.5rem';

// Today on the Philippine calendar, e.g. "October 30, 2026".
const today = () => new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'long', day: 'numeric', year: 'numeric' });

// True while the element is at least `min` pixels wide. The check waits for the
// next frame, so changing the layout can't set off the observer again in the same one.
function useWiderThan(ref, min) {
  const [wide, setWide] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => setWide(el.clientWidth >= min);
    update();
    let frame = 0;
    const later = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', later);
      return () => {
        cancelAnimationFrame(frame);
        window.removeEventListener('resize', later);
      };
    }
    const observer = new ResizeObserver(later);
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [ref, min]);
  return wide;
}

function SectionTitle({ n, children }) {
  return (
    <h3 className="csm-band rounded-r-md px-3 py-2 text-sm font-bold uppercase tracking-wide text-gray-800">
      {n}. {children}
    </h3>
  );
}

// What to do in a section, after "Instructions:", as on the printed form.
function Instructions({ t, children }) {
  return (
    <p className="text-sm text-gray-700 leading-relaxed">
      <strong className="font-bold uppercase text-gray-900">{t.instructions}</strong> {children}
    </p>
  );
}

// One question; red when it still needs an answer after the citizen pressed Send.
function Question({ id, missing, needText, children }) {
  return (
    <div id={`csm-q-${id}`} className={`scroll-mt-24 rounded-xl p-3 -mx-3 ${missing ? 'bg-red-50 ring-2 ring-red-300 dark:ring-red-500/50' : ''}`}>
      {children}
      {missing && <p className="text-sm font-semibold text-red-700 mt-2">{needText}</p>}
    </div>
  );
}

// A choice with a radio button; the whole line can be tapped.
function Choice({ name, checked, onChange, children, top = false }) {
  return (
    <label className={`flex ${top ? 'items-start' : 'items-center'} gap-2.5 rounded-lg px-2.5 py-2 cursor-pointer text-sm transition-colors ${checked
      ? 'bg-blue-50 text-gray-900 font-semibold'
      : 'text-gray-800 hover:bg-gray-50'}`}>
      <input type="radio" name={name} checked={checked} onChange={onChange} className={`csm-radio ${top ? 'mt-0.5' : ''}`} />
      <span>{children}</span>
    </label>
  );
}

// A Citizen's Charter question, with its number in front as on the printed form.
function CcQuestion({ code, children }) {
  return (
    <p className="flex gap-3 text-[15px] font-medium text-gray-900 mb-1.5">
      <span className="w-9 flex-shrink-0 font-bold">{code}</span>
      <span>{children}<Req /></span>
    </p>
  );
}

// Phones: what each face means, above the statements.
function Legend({ t }) {
  return (
    <div className="rounded-lg border border-gray-200 px-3 py-2.5">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">{t.legend}</p>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-gray-800">
        {SCALE.map(s => (
          <li key={s.value} className="flex items-center gap-2">
            <CsmFace value={s.value} className="w-6 h-6 flex-shrink-0" />
            {t.scale[s.value]}
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span className="w-6 text-center text-xs font-bold flex-shrink-0" aria-hidden="true">N/A</span>
          {t.notApplicable}
        </li>
      </ul>
    </div>
  );
}

// Wider screens: the table's header, each answer's face and words, as on the
// printed form. It stays in view while the statements scroll under it.
function ScaleHead({ t }) {
  const cell = 'flex flex-col items-center gap-1 border-l border-gray-300 px-1 py-2';
  const words = 'text-xs font-semibold leading-tight text-center break-words';
  return (
    <div className="csm-head sticky top-0 z-10 grid rounded-t-[7px] border-b border-gray-300 text-gray-800" aria-hidden="true"
      style={{ gridTemplateColumns: `minmax(0,1fr) ${ANSWER_COLS}` }}>
      <div />
      {SCALE.map(s => (
        <div key={s.value} data-col className={cell}>
          <CsmFace value={s.value} className="w-8 h-8" />
          <span className={words}>{t.scale[s.value]}</span>
        </div>
      ))}
      <div data-col className={cell}>
        <span className="h-8 flex items-center text-base font-bold">N/A</span>
        <span className={words}>{t.notApplicable}</span>
      </div>
    </div>
  );
}

// Phones: the same header with the faces only (the box above it says what they
// mean), over the columns of circles. It also stays in view while scrolling.
function PhoneHead() {
  return (
    <div className="csm-head sticky top-0 z-10 grid grid-cols-6 rounded-t-[7px] border-b border-gray-300 px-3 py-2 text-gray-800" aria-hidden="true">
      {SCALE.map(s => (
        <div key={s.value} data-col className="flex justify-center">
          <CsmFace value={s.value} className="w-7 h-7" />
        </div>
      ))}
      <div data-col className="flex items-center justify-center text-sm font-bold">N/A</div>
    </div>
  );
}

// One service quality statement (SQD0–SQD8) and its answers: the five faces,
// Strongly Disagree to Strongly Agree (as on ARTA's form), and N/A. On wider screens
// it is a row of the table, under the faces of its header. On phones the statement
// has its own row of circles under the header's faces, with the words of both ends
// under them until an answer is chosen. The chosen answer is then written out.
function ScaleRow({ id, n, statement, hint, value, onPick, missing, wide, first, last, t }) {
  const textId = `csm-${id}-text`;
  const choices = [...SCALE.map(s => s.value), NA];
  const label = v => (v === NA ? t.scale.NA : t.scale[v]);

  // On phones the line takes no room until it has something to say: the end words
  // stand in its place, at the same height.
  const said = value != null || missing;
  const answer = (
    <p className={`text-sm font-semibold ${wide || said ? 'mt-1.5 min-h-[1.25rem]' : ''}`} aria-live="polite">
      {missing && value == null ? <span className="text-red-700">{t.needAnswer}</span>
        : value != null ? <span className={value === NA ? 'text-gray-700' : 'text-blue-700'}>{t.yourAnswer} {label(value)}</span>
        : null}
    </p>
  );

  return (
    <div id={`csm-q-${id}`} data-question={id}
      className={`scroll-mt-24 ${wide ? 'grid' : 'px-3 py-3'} ${first ? '' : 'border-t border-gray-200'} ${last ? 'rounded-b-[7px]' : ''} ${missing
        ? 'bg-red-50 ring-2 ring-inset ring-red-300 dark:ring-red-500/50' : ''}`}
      style={wide ? { gridTemplateColumns: `minmax(0,1fr) ${ANSWERS_WIDTH}` } : undefined}>
      <div className={wide ? 'min-w-0 px-3 py-2.5' : ''}>
        {n === 0 && <p className="text-xs font-bold uppercase tracking-wide text-blue-700">{t.overall}</p>}
        <p id={textId} className="text-[15px] text-gray-800 leading-snug">
          <span className="font-bold text-gray-900">SQD{n}.</span> {statement}<Req />
        </p>
        {hint && <p className="text-sm text-gray-600 mt-0.5">{hint}</p>}
        {wide && answer}
      </div>

      {wide ? (
        <div role="radiogroup" aria-labelledby={textId} className="grid" style={{ gridTemplateColumns: ANSWER_COLS }}>
          {choices.map(v => (
            <label key={v} title={label(v)}
              className={`flex items-center justify-center border-l border-gray-200 cursor-pointer transition-colors ${value === v ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
              <input type="radio" name={`csm-${id}`} checked={value === v} onChange={() => onPick(v)}
                className="csm-radio" aria-label={label(v)} />
            </label>
          ))}
        </div>
      ) : (
        <>
          <div role="radiogroup" aria-labelledby={textId} className="grid grid-cols-6 mt-2.5 rounded-md border border-gray-300 overflow-hidden">
            {choices.map((v, i) => (
              <label key={v} title={label(v)}
                className={`flex items-center justify-center h-11 cursor-pointer transition-colors ${i ? 'border-l border-gray-200' : ''} ${value === v ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                <input type="radio" name={`csm-${id}`} checked={value === v} onChange={() => onPick(v)}
                  className="csm-radio" aria-label={label(v)} />
              </label>
            ))}
          </div>
          {value == null && (
            <div data-end-words className="grid grid-cols-6 mt-1.5" aria-hidden="true">
              <div className="col-span-5 min-h-[1.25rem] flex items-center justify-between gap-3 text-xs font-medium text-gray-600">
                <span>← {t.scale[1]}</span>
                <span className="text-right">{t.scale[5]} →</span>
              </div>
            </div>
          )}
          {answer}
        </>
      )}
    </div>
  );
}

// The ARTA Client Satisfaction Measurement form (data/csm.js, i18n/csmText.js),
// laid out like the printed form: the Municipality's heading, who the client is
// (only the client type is required; no name), the Citizen's Charter questions
// (CC1–CC3) and the service quality statements (SQD0–SQD8). `value` holds the
// answers; `onChange(key, answer)` sets one. `missing` lists the questions to point
// out in red. `office` is the office being rated, for the heading. `lockedService`
// is the service named on the client's slip (or the report being rated), shown
// instead of the box to type it in; otherwise the box suggests `serviceOptions`
// (the office's services in the Citizen's Charter). The form ends with the client's
// suggestions and email, both optional.
export default function CsmForm({ value, onChange, missing = [], office, lockedService, serviceOptions = [], suggestions, onSuggestions, email, onEmail }) {
  const t = useText(CSM_TEXT);
  const rootRef = useRef(null);
  const wide = useWiderThan(rootRef, TABLE_MIN);
  const isMissing = key => missing.includes(key);
  const knowsCharter = value.cc1 !== 4;

  return (
    <div ref={rootRef} className="space-y-6">
      <style>{formCss}</style>

      {/* The heading, as on the printed form */}
      <header className="text-center">
        <div className="flex items-center justify-center gap-3 sm:gap-4">
          <BrandImg kind="seal" className="w-12 h-12 sm:w-16 sm:h-16 object-contain flex-shrink-0" />
          <div className="min-w-0 leading-snug">
            <p className="text-xs sm:text-sm text-gray-700">{LETTERHEAD[0]}</p>
            <p className="text-xs sm:text-sm text-gray-700">{LETTERHEAD[1]}</p>
            <p className="text-sm sm:text-lg font-bold uppercase tracking-wide text-gray-900">{LETTERHEAD[2]}</p>
            {office && <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-gray-800">{office}</p>}
          </div>
          {/* As wide as the seal, so the names stay in the middle */}
          <span className="hidden sm:block w-16 flex-shrink-0" aria-hidden="true" />
        </div>
        <div className="csm-rule mt-4 border-t-2 border-b pt-[2px]" aria-hidden="true" />
        <p className="mt-4 text-lg sm:text-xl font-extrabold uppercase tracking-wide text-gray-900">{t.helpUs}</p>
        <p className="mt-0.5 text-xs font-bold uppercase tracking-widest text-blue-700">{t.title}</p>
      </header>

      <div className="space-y-2">
        <p className="text-sm text-gray-700 leading-relaxed">{t.intro}</p>
        <p className="text-sm font-medium text-gray-800 flex items-start gap-2">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          {t.anonymous}
        </p>
        <RequiredNote>{t.required}</RequiredNote>
      </div>

      {/* 1. About the client */}
      <section className="space-y-2">
        <SectionTitle n={1}>{t.aboutTitle}</SectionTitle>
        <Question id="clientType" missing={isMissing('clientType')} needText={t.needAnswer}>
          <p className="text-sm font-semibold text-gray-800 mb-1"><Starred>{t.clientType}</Starred></p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {CLIENT_TYPES.map(type => (
              <Choice key={type} name="csm-clientType" checked={value.clientType === type} onChange={() => onChange('clientType', type)}>
                {t.clientTypes[type]}
              </Choice>
            ))}
          </div>
        </Question>
        <div className={`grid gap-x-4 gap-y-1 ${wide ? 'grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
          <div className="p-3 -mx-3">
            <p className="text-sm font-semibold text-gray-800 mb-1">{t.date}</p>
            <p className="px-2.5 py-2 text-sm text-gray-900">{today()}</p>
          </div>
          <Question id="sex">
            <p className="text-sm font-semibold text-gray-800 mb-1">
              {t.sex} <span className="font-normal text-gray-600">{t.optional}</span>
              {value.sex && (
                <button type="button" onClick={() => onChange('sex', '')} className="ml-2 text-sm font-semibold text-blue-700 underline underline-offset-2">
                  {t.clear}
                </button>
              )}
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
              {SEXES.map(sex => (
                <Choice key={sex} name="csm-sex" checked={value.sex === sex} onChange={() => onChange('sex', sex)}>
                  {t.sexes[sex]}
                </Choice>
              ))}
            </div>
          </Question>
          <Question id="age" missing={isMissing('age')} needText={t.ageInvalid}>
            <label htmlFor="csm-age" className="block text-sm font-semibold text-gray-800 mb-1">
              {t.age} <span className="font-normal text-gray-600">{t.optional}</span>
            </label>
            <input id="csm-age" type="text" inputMode="numeric" autoComplete="off" maxLength={3}
              value={value.age} onChange={e => onChange('age', e.target.value.replace(/\D/g, ''))}
              placeholder={t.agePlaceholder}
              className="w-full sm:w-32 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
          </Question>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
          <Question id="region">
            <label htmlFor="csm-region" className="block text-sm font-semibold text-gray-800 mb-1">
              {t.region} <span className="font-normal text-gray-600">{t.optional}</span>
            </label>
            <select id="csm-region" value={value.region} onChange={e => onChange('region', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm bg-white">
              <option value="">{t.regionPlaceholder}</option>
              {REGIONS.map(region => <option key={region} value={region}>{t.regionNames[region] || region}</option>)}
            </select>
          </Question>
          <Question id="service">
            <label htmlFor="csm-service" className="block text-sm font-semibold text-gray-800 mb-1">
              {t.service} {!lockedService && <span className="font-normal text-gray-600">{t.optional}</span>}
            </label>
            {lockedService ? (
              <p id="csm-service" className="px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-800">
                <span className="font-semibold">{lockedService}</span> <span className="text-gray-600">{t.serviceFromSlip}</span>
              </p>
            ) : (
              <>
                <input id="csm-service" type="text" maxLength={120} autoComplete="off"
                  list={serviceOptions.length ? 'csm-service-options' : undefined}
                  value={value.service} onChange={e => onChange('service', e.target.value)}
                  placeholder={t.servicePlaceholder}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
                {serviceOptions.length > 0 && (
                  <datalist id="csm-service-options">
                    {serviceOptions.map(name => <option key={name} value={name} />)}
                  </datalist>
                )}
              </>
            )}
          </Question>
        </div>
      </section>

      {/* 2. Citizen's Charter */}
      <section className="space-y-3">
        <SectionTitle n={2}>{t.ccTitle}</SectionTitle>
        <Instructions t={t}>{t.ccIntro}</Instructions>
        <Question id="cc1" missing={isMissing('cc1')} needText={t.needAnswer}>
          <CcQuestion code="CC1">{t.cc.cc1.q}</CcQuestion>
          <div className="grid gap-0.5 sm:pl-12">
            {t.cc.cc1.options.map((option, i) => (
              <Choice key={option} top name="csm-cc1" checked={value.cc1 === i + 1} onChange={() => onChange('cc1', i + 1)}>
                {i + 1}. {option}
                {i === 3 && <span className="block text-gray-600 font-normal mt-0.5">{t.cc1NaNote}</span>}
              </Choice>
            ))}
          </div>
        </Question>
        {knowsCharter ? ['cc2', 'cc3'].map(key => (
          <Question key={key} id={key} missing={isMissing(key)} needText={t.needAnswer}>
            <CcQuestion code={key.toUpperCase()}>{t.cc[key].q}</CcQuestion>
            <div className="grid sm:grid-cols-2 gap-0.5 sm:pl-12">
              {t.cc[key].options.map((option, i) => (
                <Choice key={option} name={`csm-${key}`} checked={value[key] === i + 1} onChange={() => onChange(key, i + 1)}>
                  {i + 1}. {option}
                </Choice>
              ))}
            </div>
          </Question>
        )) : (
          <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">{t.ccSkipped}</p>
        )}
      </section>

      {/* 3. Service quality */}
      <section className="space-y-3">
        <SectionTitle n={3}>{t.sqdTitle}</SectionTitle>
        <Instructions t={t}>{t.sqdIntro}</Instructions>
        {!wide && <Legend t={t} />}
        <div className="rounded-lg border border-gray-300" data-layout={wide ? 'table' : 'phone'}>
          {wide ? <ScaleHead t={t} /> : <PhoneHead />}
          {SQD_KEYS.map((key, i) => (
            <ScaleRow key={key} id={key} n={i} t={t} wide={wide} first={i === 0} last={i === SQD_KEYS.length - 1}
              statement={t.statements[key]} hint={key === 'sqd5' ? t.freeHint : null}
              value={value[key]} onPick={answer => onChange(key, answer)} missing={isMissing(key)} />
          ))}
        </div>
      </section>

      {/* 4. Suggestions and email (both optional) */}
      <section className="space-y-4">
        <SectionTitle n={4}>{t.suggestionsTitle}</SectionTitle>
        <div>
          <label htmlFor="csm-suggestions" className="block text-sm font-semibold text-gray-800 mb-1">{t.suggestions}</label>
          <textarea id="csm-suggestions" value={suggestions} onChange={e => onSuggestions(e.target.value)} rows={4} maxLength={2000}
            placeholder={t.suggestionsPlaceholder}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm resize-none" />
          {suggestions.length > 1500 && (
            <p className="text-xs text-gray-500 mt-1 text-right">{suggestions.length.toLocaleString('en-US')} / 2,000</p>
          )}
        </div>
        <div>
          <label htmlFor="csm-email" className="block text-sm font-semibold text-gray-800 mb-1">{t.email}</label>
          <input id="csm-email" type="email" value={email} maxLength={191} autoComplete="email"
            onChange={e => onEmail(e.target.value)}
            placeholder={t.emailPlaceholder}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
          <p className="text-xs text-gray-500 mt-1">{t.emailHint}</p>
        </div>
      </section>
    </div>
  );
}
