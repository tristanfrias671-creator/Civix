import React from 'react';
import CSM_TEXT from '../../i18n/csmText';
import { SQD_KEYS, SQD_DIMENSIONS, scaleMeta } from '../../data/csm';
import { SQD_ACTIONS, lowAnswers } from '../../data/csmActions';
import { useTheme } from '../../context/ThemeContext';
import CsmFace from './CsmFace';

// A client's answers to the satisfaction form (ARTA CSM), on the staff and admin
// pages (English, ARTA's wording). Which code the answers came from is never
// shown, so no one can tell which client gave them.
const T = CSM_TEXT.en;

const answerLabel = value => (value == null ? 'N/A' : T.scale[value]);

// One answer on the 5-point scale: its face and words, tinted by the answer.
export function AnswerPill({ value, compact = false }) {
  const { dark } = useTheme();
  const meta = scaleMeta(value);
  const style = meta
    ? { color: dark ? '#f1f5f9' : meta.text, background: `${meta.color}${dark ? '33' : '1f'}` }
    : { color: dark ? '#e2e8f0' : '#374151', background: dark ? 'rgba(148,163,184,0.18)' : 'rgba(100,116,139,0.14)' };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap ${compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs sm:text-sm'}`}
      style={style}>
      {meta ? <CsmFace value={value} className={compact ? 'w-3.5 h-3.5 flex-shrink-0' : 'w-4 h-4 flex-shrink-0'} strokeWidth={2} /> : null}
      {answerLabel(value)}
    </span>
  );
}

// For lists: the overall answer (SQD0) of a feedback.
export function OverallAnswer({ csm }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap" title="Overall: I am satisfied with the service that I availed.">
      <AnswerPill value={csm.sqd0} compact />
    </span>
  );
}

function Fact({ label, children }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-gray-600">{label}</dt>
      <dd className="text-sm font-medium text-gray-800 mt-0.5 break-words">{children || <span className="text-gray-600 font-normal">Not given</span>}</dd>
    </div>
  );
}

// The parts this client rated Disagree or Strongly disagree, the lowest first, each
// with what the office can do about it (data/csmActions.js).
function LowPartActions({ csm }) {
  const low = lowAnswers(csm);
  if (!low.length) return null;
  return (
    <section data-csm-actions aria-label="What the office can do" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <h4 className="text-sm font-bold text-gray-900">What the office can do</h4>
      <p className="text-xs text-gray-700 mt-0.5">
        The client disagreed with {low.length === 1 ? 'this part' : 'these parts'} of the service. Suggested actions for the office's action plan:
      </p>
      <ul className="mt-2.5 space-y-3">
        {low.map(key => (
          <li key={key} data-csm-action={key}>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-gray-900">
              {SQD_DIMENSIONS[key]} <span className="text-xs font-medium text-gray-700">{key.toUpperCase()}</span>
              <AnswerPill value={csm[key]} compact />
            </p>
            <ul className="mt-1 list-disc pl-5 space-y-0.5 text-sm text-gray-800">
              {SQD_ACTIONS[key].map(action => <li key={action}>{action}</li>)}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function CsmAnswers({ csm }) {
  const { dark } = useTheme();
  if (!csm) return null;
  const overall = scaleMeta(csm.sqd0);
  const option = (key, n) => T.cc[key].options[n - 1] || '—';
  return (
    <div className="space-y-4" data-csm-answers>
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3">
        {overall
          ? <CsmFace value={csm.sqd0} className="w-9 h-9 flex-shrink-0" style={{ color: dark ? '#f1f5f9' : overall.text }} />
          : <span className="text-sm font-bold text-gray-700 w-9 text-center flex-shrink-0" aria-hidden="true">N/A</span>}
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-600">Overall (SQD0)</p>
          <p className="text-base font-bold text-gray-900">{answerLabel(csm.sqd0)}</p>
          <p className="text-xs text-gray-600">{T.statements.sqd0}</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div className="col-span-2 sm:col-span-3"><Fact label="Service availed">{csm.service}</Fact></div>
        <Fact label="Client type">{T.clientTypes[csm.clientType] || csm.clientType}</Fact>
        <Fact label="Sex">{T.sexes[csm.sex]}</Fact>
        <Fact label="Age">{csm.age}</Fact>
        <div className="col-span-2 sm:col-span-3"><Fact label="Region of residence">{csm.region}</Fact></div>
      </dl>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-600 mb-1.5">Citizen's Charter</p>
        <ul className="space-y-1.5 text-sm text-gray-800">
          {['cc1', 'cc2', 'cc3'].map(key => (
            <li key={key} className="flex gap-2">
              <span className="font-bold text-gray-600 w-9 flex-shrink-0">{key.toUpperCase()}</span>
              <span>{option(key, csm[key])}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-600 mb-1.5">Service quality</p>
        <ul className="rounded-xl border border-gray-200 divide-y divide-gray-100">
          {SQD_KEYS.slice(1).map(key => (
            <li key={key} className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-800">
                  {SQD_DIMENSIONS[key]} <span className="text-xs font-medium text-gray-600">{key.toUpperCase()}</span>
                </p>
                <p className="text-xs text-gray-600">{T.statements[key]}</p>
              </div>
              <span className="flex-shrink-0"><AnswerPill value={csm[key]} /></span>
            </li>
          ))}
        </ul>
      </div>

      <LowPartActions csm={csm} />
    </div>
  );
}
