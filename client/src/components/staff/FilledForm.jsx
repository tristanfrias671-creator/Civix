import React, { useRef } from 'react';
import CSM_TEXT from '../../i18n/csmText';
import { CLIENT_TYPES, SEXES, SQD_KEYS, SQD_DIMENSIONS, SCALE } from '../../data/csm';
import { STAFF_CHANNELS, typedIn } from '../../data/channels';
import { officeLabel } from '../../data/officeNames';
import { BrandImg } from '../../context/BrandingContext';
import { mediaUrl } from '../../utils/mediaUrl';
import CsmFace from '../common/CsmFace';
import { AnswerPill } from '../common/CsmAnswers';
import FeedbackRatingDisplay from '../common/FeedbackRatingDisplay';
import { formCss, LETTERHEAD, SectionTitle, Instructions, useWiderThan } from '../citizen/CsmForm';

// The citizen's form, as the staff's report window shows it (pages/staff/Submissions.jsx):
// all of the form the citizen sees on the Submit page (components/citizen/CsmForm.jsx),
// with its text and instructions, the answers marked and nothing to change. English,
// ARTA's wording. Since Nov 18, 2026 (the user: "showing all of this form in staff")
// every complaint or suggestion shows this form:
//  - sent on the one form (since Nov 10, 2026), or feedback on the satisfaction form:
//    the client's answers (a complaint or suggestion gets them from the server,
//    `formAnswers`, server/src/utils/csm.js formAnswersOf);
//  - typed in by staff (a walk-in report), or sent before the one form: parts 1 to 3
//    are left unanswered (staff never answer them for a citizen), and the service and
//    the citizen's words are filled in;
//  - only feedback sent before the satisfaction form (Oct 30, 2026) shows its own form
//    (stars and a comment).
// `answers` holds the client's answers (or null); `onOpenPhoto(i)` opens a photo the
// report came with; `children` go at the end of part 4 (feedback: the kind of remark).

const T = CSM_TEXT.en;

// From this width (px) the statements and their answers sit in a table, as on the
// printed form; narrower (phones), each statement has its answer under it.
const TABLE_MIN = 520;
// The table's answer columns: the five faces, then N/A.
const COLS = 'repeat(5, 3.25rem) 3rem';
const COLS_WIDTH = '19.25rem';

const TYPE_WORD = { COMPLAINT: 'complaint', SUGGESTION: 'suggestion' };
const ANSWER_COLUMNS = [...SCALE.map(s => s.value), null]; // null: N/A
// The one form went live on the evening of Nov 10, 2026 (Philippine time).
const ONE_FORM_FROM = new Date('2026-11-11T00:00:00+08:00');

// The circle of a choice; filled in for the client's answer. 4.5:1 or more on the
// page in light and dark mode.
const markCss = `
.ff-mark { width: 1.1rem; height: 1.1rem; border-radius: 9999px; border: 2px solid #6b7280; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.ff-mark-on { border-color: #1d4ed8; }
.ff-mark-on::after { content: ''; width: 0.5rem; height: 0.5rem; border-radius: 9999px; background: #1d4ed8; }
.dark .ff-mark { border-color: #94a3b8; }
.dark .ff-mark-on { border-color: #93c5fd; }
.dark .ff-mark-on::after { background: #93c5fd; }
@media (forced-colors: active) { .ff-mark, .ff-mark-on { border-color: CanvasText; } .ff-mark-on::after { background: CanvasText; } }
`;

// The day the form was sent, on the Philippine calendar ("November 10, 2026").
const formDate = at => new Date(at).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'long', day: 'numeric', year: 'numeric' });

// A report starts with the service when its form named one ("Service: ...").
export function splitService(description) {
  const text = description || '';
  const found = /^Service: (.+)\n\n/.exec(text);
  return found ? { service: found[1], text: text.slice(found[0].length) } : { service: null, text };
}

function Mark({ on, className = '' }) {
  return <span className={`ff-mark ${on ? 'ff-mark-on' : ''} ${className}`} aria-hidden="true" />;
}

// One choice of a question, its circle filled in when the client chose it.
function Picked({ on, top = false, children }) {
  return (
    <p data-picked={on ? '' : undefined}
      className={`flex ${top ? 'items-start' : 'items-center'} gap-2.5 rounded-lg px-2.5 py-1.5 text-sm ${on
        ? 'bg-blue-50 text-gray-900 font-semibold' : 'text-gray-700'}`}>
      <Mark on={on} className={top ? 'mt-0.5' : ''} />
      <span>{children}{on && <span className="sr-only"> (chosen)</span>}</span>
    </p>
  );
}

function Field({ label, className = '', children }) {
  return (
    <div className={className}>
      <p className="text-sm font-semibold text-gray-800 mb-1">{label}</p>
      {children}
    </div>
  );
}

// What was written in a box, as filled in; `empty` when nothing was.
function Value({ long = false, empty = 'Not answered', data, children }) {
  if (children == null || children === '') {
    return <p data-filled-value={data} className="px-3 py-2 text-sm italic text-gray-600">{empty}</p>;
  }
  return (
    <p data-filled-value={data}
      className={`rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-gray-900 break-words ${long ? 'text-base leading-relaxed whitespace-pre-wrap' : 'text-sm'}`}>
      {children}
    </p>
  );
}

// A part of the form the citizen did not answer (typed in by staff, or an older report).
function NotAnswered() {
  return <p data-not-answered className="text-sm italic text-gray-600">Not answered by the citizen.</p>;
}

function Photos({ media, onOpen }) {
  if (!media?.length) return null;
  return (
    <Field label={`Photos (${media.length})`}>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {media.map((m, i) => (
          <button key={m.id} type="button" onClick={() => onOpen?.(i)} aria-label={`Open photo ${i + 1}`}
            className="ss-photo relative aspect-square rounded-lg overflow-hidden border border-gray-200">
            <img src={mediaUrl(m.filePath)} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    </Field>
  );
}

// The Municipality's heading, as on the printed forms.
function Letterhead({ office, title, subtitle }) {
  return (
    <header className="text-center">
      <div className="flex items-center justify-center gap-3 sm:gap-4">
        <BrandImg kind="seal" className="w-12 h-12 sm:w-14 sm:h-14 object-contain flex-shrink-0" />
        <div className="min-w-0 leading-snug">
          <p className="text-xs sm:text-sm text-gray-700">{LETTERHEAD[0]}</p>
          <p className="text-xs sm:text-sm text-gray-700">{LETTERHEAD[1]}</p>
          <p className="text-sm sm:text-base font-bold uppercase tracking-wide text-gray-900">{LETTERHEAD[2]}</p>
          {office && <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-gray-800">{office}</p>}
        </div>
        {/* As wide as the seal, so the names stay in the middle */}
        <span className="hidden sm:block w-14 flex-shrink-0" aria-hidden="true" />
      </div>
      <div className="csm-rule mt-3 border-t-2 border-b pt-[2px]" aria-hidden="true" />
      <p className="mt-3 text-base sm:text-lg font-extrabold uppercase tracking-wide text-gray-900">{title}</p>
      {subtitle && <p className="mt-0.5 text-xs font-bold uppercase tracking-widest text-blue-700">{subtitle}</p>}
    </header>
  );
}

// The form's opening words, as the citizen read them, then (in a box) how this one came in.
function FormIntro({ note }) {
  return (
    <div className="space-y-2" data-form-intro>
      <p className="text-sm text-gray-700 leading-relaxed">{T.intro}</p>
      <p className="text-sm font-medium text-gray-800 flex items-start gap-2">
        <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        {T.anonymous}
      </p>
      <p data-form-note className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">{note}</p>
    </div>
  );
}

// 1. About you. `a` is null when the citizen answered none of the questions; the
// service then comes from the report.
function AboutPart({ a, date, service }) {
  const choices = (keys, labels, chosen) => (
    <div className="flex flex-wrap gap-x-2 gap-y-1">
      {keys.map(key => <Picked key={key} on={chosen === key}>{labels[key]}</Picked>)}
    </div>
  );
  return (
    <section className="space-y-3">
      <SectionTitle n={1}>{T.aboutTitle}</SectionTitle>
      {!a && <NotAnswered />}
      <Field label="Client type">{choices(CLIENT_TYPES, T.clientTypes, a?.clientType)}</Field>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label={T.date}><Value>{date}</Value></Field>
        <Field label={T.sex}>{!a || a.sex ? choices(SEXES, T.sexes, a?.sex) : <Value />}</Field>
        <Field label={T.age}><Value>{a?.age}</Value></Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label={T.region}><Value>{a?.region}</Value></Field>
        <Field label={T.service}><Value data="service">{a ? a.service : service}</Value></Field>
      </div>
    </section>
  );
}

// 2. Citizen's Charter (CC1–CC3)
function CharterPart({ a }) {
  const question = (code, text) => (
    <p className="flex gap-3 text-[15px] font-medium text-gray-900 mb-1">
      <span className="w-9 flex-shrink-0 font-bold">{code}</span>
      <span>{text}</span>
    </p>
  );
  return (
    <section className="space-y-3">
      <SectionTitle n={2}>{T.ccTitle}</SectionTitle>
      <Instructions t={T}>{T.ccIntro}</Instructions>
      {!a && <NotAnswered />}
      <div data-cc="cc1">
        {question('CC1', T.cc.cc1.q)}
        <div className="grid gap-0.5 sm:pl-12">
          {T.cc.cc1.options.map((option, i) => <Picked key={option} top on={a?.cc1 === i + 1}>{i + 1}. {option}</Picked>)}
        </div>
      </div>
      {a?.cc1 !== 4 ? ['cc2', 'cc3'].map(key => (
        <div key={key} data-cc={key}>
          {question(key.toUpperCase(), T.cc[key].q)}
          <div className="grid sm:grid-cols-2 gap-0.5 sm:pl-12">
            {T.cc[key].options.map((option, i) => <Picked key={option} on={a?.[key] === i + 1}>{i + 1}. {option}</Picked>)}
          </div>
        </div>
      )) : (
        <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
          CC2 and CC3 are N/A, since the client chose 4 in CC1.
        </p>
      )}
    </section>
  );
}

// 3. Service quality (SQD0–SQD8): on wider screens a table with the faces on top, as
// on the printed form, the client's answer marked in its column; on phones each
// statement with its answer. Not answered: no marks, and "Not answered" under each.
function QualityPart({ a, wide }) {
  const head = 'flex flex-col items-center gap-1 border-l border-gray-300 px-0.5 py-2';
  const words = 'text-[11px] font-semibold leading-tight text-center break-words';
  return (
    <section className="space-y-3">
      <SectionTitle n={3}>{T.sqdTitle}</SectionTitle>
      <Instructions t={T}>{T.sqdIntro}</Instructions>
      {!a && <NotAnswered />}
      <div className="rounded-lg border border-gray-300" data-layout={wide ? 'table' : 'list'}>
        {wide && (
          <div className="csm-head grid rounded-t-[7px] border-b border-gray-300 text-gray-800" aria-hidden="true"
            style={{ gridTemplateColumns: `minmax(0,1fr) ${COLS}` }}>
            <div />
            {SCALE.map(s => (
              <div key={s.value} className={head}>
                <CsmFace value={s.value} className="w-7 h-7" />
                <span className={words}>{T.scale[s.value]}</span>
              </div>
            ))}
            <div className={head}>
              <span className="h-7 flex items-center text-sm font-bold">N/A</span>
              <span className={words}>{T.notApplicable}</span>
            </div>
          </div>
        )}
        {SQD_KEYS.map((key, i) => {
          // No answers: undefined, so not even the N/A column (null) is marked.
          const value = a ? (a[key] ?? null) : undefined;
          return (
            <div key={key} data-sqd={key}
              className={`${wide ? 'grid' : 'px-3 py-2.5'} ${i ? 'border-t border-gray-200' : ''}`}
              style={wide ? { gridTemplateColumns: `minmax(0,1fr) ${COLS_WIDTH}` } : undefined}>
              <div className={wide ? 'min-w-0 px-3 py-2.5' : ''}>
                <p className="text-xs font-bold uppercase tracking-wide text-blue-700">{SQD_DIMENSIONS[key]}</p>
                <p className="text-sm text-gray-800 leading-snug">
                  <span className="font-bold text-gray-900">SQD{i}.</span> {T.statements[key]}
                </p>
                <p className="mt-1.5">
                  <span className="sr-only">Answer: </span>
                  {a ? <AnswerPill value={value} /> : <span className="text-xs italic text-gray-600">Not answered</span>}
                </p>
              </div>
              {wide && (
                <div className="grid" style={{ gridTemplateColumns: COLS }} aria-hidden="true">
                  {ANSWER_COLUMNS.map(v => (
                    <div key={v ?? 'na'} className={`flex items-center justify-center border-l border-gray-200 ${value === v ? 'bg-blue-50' : ''}`}>
                      <Mark on={value === v} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function FilledForm({ report, answers, onOpenPhoto, children }) {
  const rootRef = useRef(null);
  const wide = useWiderThan(rootRef, TABLE_MIN);
  const date = formDate(report.createdAt);
  const office = report.citizenDepartment && report.citizenDepartment !== 'UNASSIGNED' ? officeLabel(report.citizenDepartment) : null;
  const { service, text } = splitService(report.description);
  const isReport = report.type === 'COMPLAINT' || report.type === 'SUGGESTION';
  const kind = answers ? 'csm' : typedIn(report) ? 'walk-in' : report.type === 'FEEDBACK' ? 'feedback' : 'report';
  const channel = STAFF_CHANNELS.find(c => c.key === report.channel);
  const strong = 'font-semibold text-gray-900';

  let sheet;
  if (kind === 'feedback') {
    // Feedback sent before the satisfaction form (Oct 30, 2026): stars and a comment.
    sheet = (
      <>
        <Letterhead office={office} title="Feedback form" subtitle="Sent online" />
        <p className="text-sm text-gray-700">
          Sent online on {date}. <strong className={strong}>Anonymous:</strong> feedback never shows
          who sent it, so clients can be honest.
        </p>
        <Field label="Rating">
          <FeedbackRatingDisplay rating={report.rating} reaction={report.reaction} feedbackTags={report.feedbackTags} />
        </Field>
        <Field label="Comment"><Value long data="text" empty="Nothing was written.">{report.description}</Value></Field>
        <Photos media={report.media} onOpen={onOpenPhoto} />
        {children}
      </>
    );
  } else {
    // How this one came in (the box under the form's opening words).
    const name = report.user?.fullName;
    const note = kind === 'csm' ? <>Filled in online by the client on {date}.</>
      : kind === 'walk-in' ? (
        <>
          Typed in by <strong className={strong}>{report.encodedByName || 'staff'}</strong> on {date}
          {channel ? `, for a citizen who ${channel.hint.charAt(0).toLowerCase()}${channel.hint.slice(1)}` : ''}.
          {' '}The citizen did not answer parts 1 to 3; what they said is in part 4.
          {' '}No name, mobile number or email is asked: the citizen follows the report with its Transaction Code.
        </>
      ) : (
        <>
          Sent online by {name ? <strong className={strong}>{name}</strong> : 'the citizen'} on {date}
          {new Date(report.createdAt) < ONE_FORM_FROM
            ? ', on the form used before November 10, 2026, which did not ask the questions in parts 1 to 3.'
            : '. Its answers to parts 1 to 3 were not found.'}
        </>
      );
    sheet = (
      <>
        <Letterhead office={office} title={T.helpUs} subtitle={T.title} />
        <FormIntro note={note} />
        <AboutPart a={answers} date={date} service={service} />
        <CharterPart a={answers} />
        <QualityPart a={answers} wide={wide} />
        <section className="space-y-3" data-filled-part="remark">
          <SectionTitle n={4}>{T.suggestionsTitle}</SectionTitle>
          <Field label={kind === 'csm' ? 'What the client wrote' : kind === 'walk-in' ? 'What the citizen said' : 'What the citizen wrote'}>
            <Value long data="text" empty="Nothing was written.">{isReport ? text : report.description}</Value>
          </Field>
          {isReport && (
            <p className="text-sm text-gray-700" data-sent-as={report.type}>
              Sent to the office as a <strong className={strong}>{TYPE_WORD[report.type]}</strong>,
              with a deadline.
            </p>
          )}
          {report.address && <Field label="Where"><Value>{report.address}</Value></Field>}
          <Photos media={report.media} onOpen={onOpenPhoto} />
          {children}
        </section>
      </>
    );
  }

  return (
    <article ref={rootRef} data-filled-form={kind} data-csm-answers={answers ? '' : undefined}
      data-not-answered-form={kind === 'walk-in' || kind === 'report' ? '' : undefined}
      aria-label="The citizen's form"
      className="rounded-2xl border border-gray-300 bg-white p-4 sm:p-5 space-y-5 shadow-sm">
      <style>{formCss + markCss}</style>
      {sheet}
    </article>
  );
}
