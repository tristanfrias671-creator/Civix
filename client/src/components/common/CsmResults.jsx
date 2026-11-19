import React, { useEffect, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { SQD_KEYS, SQD_DIMENSIONS } from '../../data/csm';
import { SQD_ACTIONS, lowParts } from '../../data/csmActions';
import api from '../../utils/api';
import LabelRule, { RuleDetails } from './LabelRule';
import RemarkRule, { REMARKS, REMARK_PLURAL } from './RemarkRule';

// The satisfaction form's results (ARTA CSM) on the staff dashboard and the admin
// Analytics page: the overall score and its rating, each part of the service, the
// Citizen's Charter, the respondents and the services rated. The server works the
// numbers out (server/src/utils/csmResults.js), as ARTA's CSM reports do.

export const pctText = value => (value == null ? '—' : `${value.toFixed(1)}%`);

// ARTA's rating for each score (server/src/utils/csmResults.js, RATINGS).
const RATING_SCALE = [
  ['Outstanding', '95% and above'],
  ['Very Satisfactory', '90% to 94.9%'],
  ['Satisfactory', '80% to 89.9%'],
  ['Fair', '60% to 79.9%'],
  ['Poor', 'below 60%'],
];

// How the scores and ratings are computed, in a few lines that open on demand.
export function ScoreRule({ className = '' }) {
  return (
    <RuleDetails question="How are the scores and ratings computed?" data="score-rule" className={className}>
      <p>
        <strong className="text-gray-900">Score:</strong> the percentage of Agree and Strongly agree answers, not
        counting N/A. The overall score covers SQD1–SQD8; SQD0 (satisfaction with the service) is shown separately.
      </p>
      <p><strong className="text-gray-900">ARTA rating:</strong></p>
      <ul className="list-disc pl-5 space-y-0.5">
        {RATING_SCALE.map(([name, range]) => (
          <li key={name}><strong className="text-gray-900">{name}:</strong> {range}</li>
        ))}
      </ul>
    </RuleDetails>
  );
}

// Each rating as text on a tint (light page / dark page).
const RATING_TONES = {
  Outstanding:         { light: ['#dcfce7', '#166534'], dark: ['rgba(22,163,74,0.22)', '#86efac'] },
  'Very Satisfactory': { light: ['#ccfbf1', '#115e59'], dark: ['rgba(20,184,166,0.22)', '#5eead4'] },
  Satisfactory:        { light: ['#dbeafe', '#1e40af'], dark: ['rgba(37,99,235,0.24)', '#93c5fd'] },
  Fair:                { light: ['#fef3c7', '#92400e'], dark: ['rgba(217,119,6,0.22)', '#fcd34d'] },
  Poor:                { light: ['#fee2e2', '#991b1b'], dark: ['rgba(220,38,38,0.22)', '#fca5a5'] },
};

// Positive / Neutral / Negative: the same colors as the Analytics sentiment chart.
const LABELS = [
  { key: 'POSITIVE', name: 'Positive', light: '#2a78d6', dark: '#3987e5' },
  { key: 'NEUTRAL',  name: 'Neutral',  light: '#898781', dark: '#898781' },
  { key: 'NEGATIVE', name: 'Negative', light: '#e34948', dark: '#e66767' },
];

export function useInk() {
  const { dark } = useTheme();
  return {
    dark,
    strong: dark ? '#f1f5f9' : '#111827',
    body: dark ? '#cbd5e1' : '#374151',
    muted: dark ? '#94a3b8' : '#4b5563',
    line: dark ? 'rgba(255,255,255,0.08)' : '#e5e7eb',
    track: dark ? 'rgba(255,255,255,0.08)' : '#eef2f7',
    tile: dark ? 'rgba(255,255,255,0.04)' : '#f8fafc',
    bar: dark ? '#60a5fa' : '#2563eb',
  };
}

// The results for `url` (?range=month|year|all), reloaded when the range changes.
// While the next range loads, the last results stay on screen (`loading`).
export function useSatisfaction(url) {
  const [range, setRange] = useState('all');
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setFailed(false);
    api.get(url, { params: { range } })
      .then(res => { if (active) setData(res.data); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [url, range]);
  return { range, setRange, data, failed, loading: !failed && (!data || data.range !== range) };
}

const RANGES = [['month', 'This month'], ['year', 'This year'], ['all', 'All time']];
// For "No answers{…} yet".
export const RANGE_WORDS = { month: ' this month', year: ' this year', all: '' };

export function RangeSwitch({ value, onChange }) {
  const { dark, strong, body, muted, track } = useInk();
  return (
    <div role="group" aria-label="Show the answers from" className="inline-flex rounded-xl p-1 gap-1 flex-shrink-0" style={{ background: track }}>
      {RANGES.map(([key, label]) => {
        const on = value === key;
        return (
          <button key={key} type="button" aria-pressed={on} onClick={() => onChange(key)}
            className="px-3 min-h-[40px] text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
            style={on
              ? { background: dark ? '#334155' : '#ffffff', color: strong, boxShadow: '0 1px 3px rgba(15,23,42,0.15)' }
              : { color: dark ? body : muted }}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function RatingBadge({ rating, large = false }) {
  const { dark, muted } = useInk();
  const tone = RATING_TONES[rating];
  if (!tone) return <span className="text-sm font-semibold" style={{ color: muted }}>{rating || '—'}</span>;
  const [bg, color] = dark ? tone.dark : tone.light;
  return (
    <span className={`inline-flex items-center rounded-full font-bold whitespace-nowrap ${large ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs'}`}
      style={{ background: bg, color }}>
      {rating}
    </span>
  );
}

// Positive, Neutral and Negative counts: a colored dot, the name and the number.
export function LabelCounts({ sentiment }) {
  const { dark, body } = useInk();
  return (
    <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      {LABELS.map(l => (
        <span key={l.key} className="inline-flex items-center gap-1.5 whitespace-nowrap" style={{ color: body }}>
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: dark ? l.dark : l.light }} aria-hidden="true" />
          {l.name} <span className="font-bold tabular-nums">{sentiment[l.key]}</span>
        </span>
      ))}
    </span>
  );
}

// The overall score with its rating, the number of answers, SQD0 and the labels.
export function ScoreHeadline({ result }) {
  const { strong, muted, line } = useInk();
  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-8" data-csm-headline>
      <div className="flex items-center gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: muted }}>Overall score</p>
          <p className="text-4xl font-bold tabular-nums leading-tight" style={{ color: strong }}>{pctText(result.overall)}</p>
          <p className="text-xs" style={{ color: muted }}>SQD1–SQD8</p>
        </div>
        <RatingBadge rating={result.rating} large />
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 lg:border-l lg:pl-8" style={{ borderColor: line }}>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide" style={{ color: muted }}>Answers</dt>
          <dd className="text-xl font-bold tabular-nums" style={{ color: strong }}>{result.responses}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide" style={{ color: muted }}>Satisfied (SQD0)</dt>
          <dd className="text-xl font-bold tabular-nums" style={{ color: strong }}>{pctText(result.sqd.sqd0.score)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs font-bold uppercase tracking-wide mb-0.5" style={{ color: muted }}>Forms by sentiment</dt>
          <dd><LabelCounts sentiment={result.sentiment} /></dd>
          <dd className="mt-1.5"><LabelRule type="FEEDBACK" /></dd>
        </div>
      </dl>
    </div>
  );
}

// One bar per part of the service (SQD1–SQD8): its score, rating and answers.
export function SqdBars({ result }) {
  const { strong, body, muted, track, bar } = useInk();
  return (
    <ul className="space-y-3.5" aria-label="Score of each part of the service">
      {SQD_KEYS.slice(1).map(key => {
        const s = result.sqd[key];
        return (
          <li key={key} data-sqd={key}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 mb-1">
              <span className="text-sm font-semibold" style={{ color: body }}>
                {SQD_DIMENSIONS[key]} <span className="text-xs font-medium" style={{ color: muted }}>{key.toUpperCase()}</span>
              </span>
              <span className="text-sm whitespace-nowrap" style={{ color: muted }}>
                {s.answered
                  ? <><span className="font-bold tabular-nums" style={{ color: strong }}>{pctText(s.score)}</span> {s.rating} · {s.answered} {s.answered === 1 ? 'answer' : 'answers'}</>
                  : 'All N/A'}
              </span>
            </div>
            <div className="an-track w-full rounded-full h-2.5" style={{ background: track }}>
              <div className="h-2.5 rounded-full" style={{ width: `${s.score || 0}%`, background: bar }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// The parts of the service under 80% (below Satisfactory), the lowest first, each
// with what the office can do about it (data/csmActions.js).
export function ImproveList({ result }) {
  const { strong, body, muted, tile } = useInk();
  const low = lowParts(result);
  return (
    <section aria-label="Areas for improvement" data-csm-improve className="mt-6">
      <h3 className="text-sm font-bold mb-1" style={{ color: strong }}>Areas for improvement</h3>
      {low.length === 0 ? (
        <p className="text-sm" style={{ color: body }} data-csm-improve-none>
          All parts of the service are rated Satisfactory (80%) or higher.
        </p>
      ) : (
        <>
          <p className="text-sm mb-2.5" style={{ color: muted }}>
            Parts of the service below 80%, lowest first, with suggested actions.
          </p>
          <ul className="space-y-2.5">
            {low.map(key => {
              const s = result.sqd[key];
              return (
                <li key={key} data-csm-improve-part={key} className="rounded-xl px-3.5 py-3" style={{ background: tile }}>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold" style={{ color: strong }}>
                    {SQD_DIMENSIONS[key]} <span className="text-xs font-medium" style={{ color: muted }}>{key.toUpperCase()}</span>
                    <span className="tabular-nums">{pctText(s.score)}</span>
                    <RatingBadge rating={s.rating} />
                  </p>
                  <ul className="mt-1.5 list-disc pl-5 space-y-0.5 text-sm" style={{ color: body }}>
                    {SQD_ACTIONS[key].map(action => <li key={action}>{action}</li>)}
                  </ul>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

function Tile({ value, label, note }) {
  const { strong, muted, tile } = useInk();
  return (
    <div className="rounded-xl px-3.5 py-3" style={{ background: tile }}>
      <p className="text-xl font-bold tabular-nums" style={{ color: strong }}>{pctText(value)}</p>
      <p className="text-sm font-medium leading-snug" style={{ color: muted }}>{label}</p>
      {note && <p className="text-xs mt-0.5" style={{ color: muted }}>{note}</p>}
    </div>
  );
}

// What the clients wrote in the last box of the form, sorted as comments, complaints
// and suggestions (server/src/utils/remarks.js), by the form's label: a table, or
// on a phone a list with the labels under each kind.
export function RemarkTable({ result }) {
  const { dark, strong, body, muted, line } = useInk();
  const r = result.remarks;
  if (!r) return null;
  const head = 'text-xs font-bold uppercase tracking-wide py-1.5';
  return (
    <section aria-label="Clients' remarks" data-remarks>
      <h3 className="text-sm font-bold mb-1" style={{ color: strong }}>Clients' remarks</h3>
      <p className="text-sm mb-2" style={{ color: muted }}>
        Remarks written on the form, classified as comments, complaints or suggestions.
      </p>
      <ul className="sm:hidden" data-remark-list>
        {REMARKS.map(key => (
          <li key={key} data-remark-item={key} className="py-2" style={{ borderTop: `1px solid ${line}` }}>
            <p className="flex justify-between gap-3 text-sm font-semibold" style={{ color: body }}>
              {REMARK_PLURAL[key]} <span className="font-bold tabular-nums" style={{ color: strong }}>{r[key].total}</span>
            </p>
            <LabelCounts sentiment={r[key]} />
          </li>
        ))}
      </ul>
      <table className="hidden sm:table w-full text-sm">
        <thead>
          <tr style={{ color: muted }}>
            <th scope="col" className={`${head} text-left pr-2`}>Remark</th>
            {LABELS.map(l => (
              <th key={l.key} scope="col" className={`${head} text-right px-1.5`}>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dark ? l.dark : l.light }} aria-hidden="true" />
                  {l.name}
                </span>
              </th>
            ))}
            <th scope="col" className={`${head} text-right pl-1.5`}>Total</th>
          </tr>
        </thead>
        <tbody>
          {REMARKS.map(key => (
            <tr key={key} data-remark-row={key} style={{ borderTop: `1px solid ${line}`, color: body }}>
              <th scope="row" className="text-left font-semibold py-1.5 pr-2">{REMARK_PLURAL[key]}</th>
              {LABELS.map(l => <td key={l.key} className="text-right tabular-nums py-1.5 px-1.5">{r[key][l.key]}</td>)}
              <td className="text-right font-bold tabular-nums py-1.5 pl-1.5" style={{ color: strong }}>{r[key].total}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-sm mt-1.5 pt-1.5" style={{ color: muted, borderTop: `1px solid ${line}` }} data-remarks-none>
        No remark written: <span className="font-semibold tabular-nums" style={{ color: body }}>{r.none.total}</span>
      </p>
      <RemarkRule className="mt-2" />
    </section>
  );
}

// The Citizen's Charter questions (CC1–CC3), in four numbers.
export function CharterFacts({ result }) {
  const { strong } = useInk();
  const c = result.charter;
  return (
    <section aria-label="Citizen's Charter">
      <h3 className="text-sm font-bold mb-2" style={{ color: strong }}>Citizen's Charter</h3>
      <div className="grid grid-cols-2 gap-2">
        <Tile value={c.aware} label="Aware of the Citizen's Charter" />
        <Tile value={c.sawCharter} label="Saw this office's Charter" />
        <Tile value={c.easyToSee} label="Found it easy to see" note="Excluding N/A" />
        <Tile value={c.helped} label="Found it helpful" note="Excluding N/A" />
      </div>
    </section>
  );
}

// Client type, sex and age group of the respondents (the clients who answered).
export function ClientFacts({ result }) {
  const { strong, body, muted, line } = useInk();
  const groups = [
    ['Client type', result.clients.types.map(t => ({ ...t, label: t.key === 'GOVERNMENT' ? 'Government' : t.label }))],
    ['Sex', result.clients.sexes],
    ['Age', result.clients.ages],
  ];
  return (
    <section aria-label="Respondents">
      <h3 className="text-sm font-bold mb-2" style={{ color: strong }}>Respondents</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-5 gap-y-3">
        {groups.map(([title, rows]) => (
          <div key={title}>
            <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: muted }}>{title}</p>
            <ul className="text-sm">
              {rows.map(row => (
                <li key={row.label} className="flex justify-between gap-3 py-0.5 border-b last:border-b-0" style={{ borderColor: line, color: body }}>
                  <span>{row.label}</span><span className="font-semibold tabular-nums">{row.count}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// The services the slips named (or "Complaint handling" for a resolved report),
// with each one's office when several offices are shown.
export function ServiceList({ services, showOffice = false }) {
  const { strong, body, muted, line } = useInk();
  if (!services?.length) return null;
  return (
    <section aria-label="Services rated">
      <h3 className="text-sm font-bold mb-2" style={{ color: strong }}>Services rated</h3>
      <ul className="rounded-xl border" style={{ borderColor: line }}>
        {services.map((s, i) => (
          <li key={`${s.department}:${s.service}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3.5 py-2.5"
            style={{ borderTop: i ? `1px solid ${line}` : 'none' }}>
            <span className="text-sm font-semibold min-w-0 break-words" style={{ color: body }}>
              {s.service}
              {showOffice && <span className="block text-xs font-medium" style={{ color: muted }}>{s.department}</span>}
            </span>
            <span className="flex items-center gap-3 text-sm whitespace-nowrap" style={{ color: muted }}>
              {s.responses} {s.responses === 1 ? 'answer' : 'answers'}
              <span className="font-bold tabular-nums" style={{ color: strong }}>{pctText(s.overall)}</span>
              <RatingBadge rating={s.rating} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// The codes the office gave its clients (New client) in the time. Each slip is one
// transaction, so these are the clients served; the response rate is the share of
// the codes used to answer the form (server/src/utils/csmResults.js, codeSummary).
export function CodeFacts({ codes }) {
  const { strong, muted, tile } = useInk();
  if (!codes) return null;
  const items = [
    ['given', codes.given, 'Codes given'],
    ['answered', codes.answered, 'Forms answered'],
    ['waiting', codes.waiting, 'Not used yet'],
    ['rate', pctText(codes.rate), 'Response rate'],
  ];
  return (
    <section aria-label="Codes given to clients" data-code-facts>
      <h3 className="text-sm font-bold mb-2" style={{ color: strong }}>Codes given to clients</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {items.map(([key, value, label]) => (
          <div key={key} data-code-fact={key} className="rounded-xl px-3.5 py-3" style={{ background: tile }}>
            <p className="text-xl font-bold tabular-nums" style={{ color: strong }}>{value}</p>
            <p className="text-sm font-medium leading-snug" style={{ color: muted }}>{label}</p>
          </div>
        ))}
      </div>
      <p className="text-xs mt-2" style={{ color: muted }}>
        Each code is valid for one form within 7 days.
        {codes.expired > 0 && ` ${codes.expired} ${codes.expired === 1 ? 'code' : 'codes'} expired unused.`}
      </p>
    </section>
  );
}

// The details of one office (or of all offices): each part of the service and what
// to improve, the clients' remarks, the Citizen's Charter, who answered and the
// services rated.
export default function CsmResultsDetails({ result, services, showOffice = false }) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <section aria-label="Each part of the service">
        <SqdBars result={result} />
        <ImproveList result={result} />
      </section>
      <div className="space-y-6">
        <RemarkTable result={result} />
        <CharterFacts result={result} />
        <ClientFacts result={result} />
      </div>
      {services?.length > 0 && <div className="xl:col-span-2"><ServiceList services={services} showOffice={showOffice} /></div>}
    </div>
  );
}
