import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import CitizenPortalLayout from '../../components/common/CitizenPortalLayout';
import Icon from '../../components/common/Icons';
import { formatDueDate } from '../../components/common/DeadlineBadge';
import { PriorityBadge } from '../../components/common/StatusBadge';
import CsmForm from '../../components/citizen/CsmForm';
import CsmFace from '../../components/common/CsmFace';
import { RequiredNote, Starred } from '../../components/common/RequiredMark';
import TurnstileBox from '../../components/citizen/TurnstileBox';
import Tour, { markTour, shouldAutoStart } from '../../components/common/Tour';
import { useTheme } from '../../context/ThemeContext';
import { useLang, useText } from '../../i18n/LanguageContext';
import SUBMIT_TEXT, { refusalText } from '../../i18n/submitText';
import CSM_TEXT from '../../i18n/csmText';
import TOUR_TEXT, { tourSteps } from '../../i18n/tourText';
import api from '../../utils/api';
import { copyText } from '../../utils/clipboard';
import { fetchFormTicket } from '../../utils/reportGuard';
import { officeLabel } from '../../data/officeNames';
import { DEFAULT_DEADLINES, urgencyDays, addWorkingDays } from '../../data/urgency';
import { emptyCsm, unanswered, csmPayload, scaleMeta, NA } from '../../data/csm';
import { serviceNames } from '../../data/charter';

const fadeCss = `
@keyframes submitFadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
.submit-fade-0 { animation: submitFadeUp .45s .02s cubic-bezier(.22,1,.36,1) both; }
.submit-fade-1 { animation: submitFadeUp .45s .08s cubic-bezier(.22,1,.36,1) both; }
.submit-fade-2 { animation: submitFadeUp .45s .14s cubic-bezier(.22,1,.36,1) both; }
`;

// One form for feedback, complaints and suggestions (since Nov 10, 2026, as the
// panel asked). It opens only with a code from the office: the queuing code on the
// slip the office gave the citizen, or the Transaction Code of their resolved
// complaint or suggestion. The code decides the office. The form is the ARTA
// satisfaction form (components/citizen/CsmForm) with one box at the end; the AI
// reads whether the box is a complaint, a suggestion or a comment, and the citizen
// can choose another. A complaint or suggestion also goes to the office as a report
// (its own Transaction Code and deadline). Since Nov 17, 2026 the form asks for no
// mobile number, email, place, map pin or photos: the citizen follows a report with
// its Transaction Code on Track My Report.

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

// A form ticket only works a few seconds after it was issued (see utils/reportGuard).
const TICKET_READY_MS = 3200;

const AI_PATH = 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z';
const PHONE_PATH = 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z';

// What the form's last box is. A complaint or a suggestion is also a report.
const REMARK_KINDS = ['COMPLAINT', 'SUGGESTION', 'COMMENT'];
const isReport = kind => kind === 'COMPLAINT' || kind === 'SUGGESTION';

// How urgent a complaint is, set automatically from what the citizen wrote (the AI
// on the server reads it again when the form is sent): one line with the level and
// the date the office should finish by (working days counted like the server).
// Nothing to choose. Urgent adds a one-line "call 911" note.
function AutoUrgency({ t, priority, deadlines, hotline }) {
  const days = urgencyDays(deadlines, 'COMPLAINT', priority);
  return (
    <div aria-live="polite" data-urgency-auto={priority} className="space-y-2">
      <div data-urgency-line className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-700">
        <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d={AI_PATH} />
        </svg>
        <div className="space-y-1">
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span>{t.urgencyAuto}</span>
            <PriorityBadge priority={priority} label={t.urgencyLevels[priority].name} />
          </p>
          <p>{t.targetLead} <strong className="font-semibold text-gray-900">{formatDueDate(addWorkingDays(new Date(), days), true)}</strong></p>
        </div>
      </div>
      {priority === 'URGENT' && (
        <p role="note" className="flex items-start gap-2.5 rounded-lg border border-red-200 dark:border-red-500/40 bg-red-50 px-4 py-2.5 text-sm text-gray-800">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d={PHONE_PATH} />
          </svg>
          <span><strong className="font-bold text-red-800">{t.dangerTitle}</strong> {t.dangerText(hotline)}</span>
        </p>
      )}
    </div>
  );
}

// What the AI reads the last box as, with the three kinds to choose from (the AI's
// is marked until the citizen picks another) and what happens to the chosen one.
// Without a reading (the AI could not be reached), the citizen chooses.
function RemarkReading({ t, kind, chosen, busy, onPick }) {
  const title = chosen ? t.remarkYouChose : kind ? t.remarkAiReads : t.remarkPick;
  return (
    <div data-remark-reading={kind || 'NONE'} role="group" aria-labelledby="remark-reading-title"
      className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
      <p id="remark-reading-title" className="flex items-center gap-2 text-sm font-semibold text-gray-800">
        <svg className="w-4 h-4 flex-shrink-0 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d={AI_PATH} />
        </svg>
        {busy && !chosen ? t.aiThinking : title}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {REMARK_KINDS.map(k => (
          <button key={k} type="button" data-remark-kind={k} aria-pressed={kind === k} onClick={() => onPick(k)}
            className={`min-h-[40px] px-4 py-2 rounded-lg border text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
              kind === k ? 'border-blue-700 bg-blue-700 text-white' : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'}`}>
            {t.remarkKinds[k]}
          </button>
        ))}
      </div>
      {kind && <p className="mt-2 text-sm text-gray-700 leading-relaxed">{t.remarkMeans[kind]}</p>}
      {kind && <p className="mt-1 text-xs text-gray-600">{t.remarkFix}</p>}
    </div>
  );
}

// Server refusals about the code that opens the form: the citizen types another code.
const CODE_REFUSALS = ['CODE_NOT_FOUND', 'CODE_USED', 'CODE_EXPIRED', 'IS_FEEDBACK', 'NOT_RESOLVED', 'ALREADY_RATED'];
// The note about what the form still needs ("Please answer the questions marked in
// red", a longer description...): one at a time, however often Submit is pressed
// (a new note takes the old one's place), and all are taken away when the form is sent.
const CHECK_TOAST = 'form-check';
// The fields a refusal can point to (the server's `field`).
const FIELD_IDS = { description: 'form-remark' };

// `rate`: opened at /rate or /rate/<code> (the QR code on a client's slip); the
// same form as /submit. A code in the address is checked right away.
export default function Submit({ rate = false }) {
  const { dark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { code: routeCode } = useParams();
  const { lang } = useLang();
  const t = useText(SUBMIT_TEXT);
  const tc = useText(CSM_TEXT);

  // From the Citizen's Charter page: the office and the service the citizen pressed
  // ("Give feedback or a complaint"). Read once. The code still decides the office;
  // the service fills in the form's service when the code is from that office and
  // its slip names none.
  const [presetService] = useState(() => {
    const state = location.state || {};
    return state.service && state.department ? { service: state.service, department: state.department } : null;
  });

  // The guided tour of the form. It opens by itself on the first visit (not when the
  // address brings a slip's code), and from "Show me how" beside the form's title.
  const tt = useText(TOUR_TEXT);
  const [tourOpen, setTourOpen] = useState(false);
  const [autoTour] = useState(() => !routeCode && shouldAutoStart('form', ['home']));
  const closeTour = useCallback(how => {
    setTourOpen(false);
    markTour('form', how);
  }, []);
  useEffect(() => {
    if (!autoTour) return undefined;
    const timer = setTimeout(() => setTourOpen(true), 700);
    return () => clearTimeout(timer);
  }, [autoTour]);

  const [csm, setCsm] = useState(emptyCsm);
  const [missing, setMissing] = useState([]);
  const [rateCode, setRateCode] = useState('');
  // What the code opens (GET /feedback/code/:code), or why it can't be used.
  const [codeInfo, setCodeInfo] = useState(null);
  const [codeError, setCodeError] = useState(null);
  const [codeChecking, setCodeChecking] = useState(false);
  // Before the code is checked only the code box is on the page: the tour's other
  // steps are then cards in the middle of the screen.
  const formTourSteps = useMemo(
    () => tourSteps('form', tt).map((step, i) => (i > 0 && !codeInfo ? { ...step, target: null } : step)),
    [tt, codeInfo],
  );
  const codeRequest = useRef(0);
  const codeFieldRef = useRef(null);

  const checkCode = useCallback(async raw => {
    const code = String(raw || '').toUpperCase().replace(/\s+/g, '');
    const request = ++codeRequest.current;
    setCodeInfo(null);
    if (!code) {
      setCodeError({ code: 'CODE_NEEDED' });
      setCodeChecking(false);
      return;
    }
    setCodeError(null);
    setCodeChecking(true);
    try {
      const res = await api.get(`/feedback/code/${encodeURIComponent(code)}`);
      if (request !== codeRequest.current) return;
      setCodeInfo(res.data);
      setRateCode(res.data.code);
    } catch (err) {
      if (request !== codeRequest.current) return;
      setCodeError(err.response ? err.response.data || {} : { offline: true });
    } finally {
      if (request === codeRequest.current) setCodeChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!routeCode) return;
    setRateCode(routeCode.toUpperCase());
    checkCode(routeCode);
  }, [routeCode, checkCode]);

  function setAnswer(key, answer) {
    setCsm(c => ({ ...c, [key]: answer }));
    setMissing(m => (m.includes(key) ? m.filter(k => k !== key) : m));
  }

  // The questions marked red: the first one is scrolled into view.
  function pointTo(keys) {
    setMissing(keys);
    const el = document.getElementById(`csm-q-${keys[0]}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.querySelector('input, select')?.focus({ preventScroll: true });
    }
  }

  // The last part's box: scrolled to and focused (after the next render).
  function focusField(field) {
    setTimeout(() => {
      const el = document.getElementById(FIELD_IDS[field] || field);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus({ preventScroll: true });
    }, 60);
  }

  // The service being rated: as typed on the slip, or the report's handling.
  const lockedService = codeInfo?.kind === 'REPORT'
    ? tc.reportService[codeInfo.reportType] || null
    : codeInfo?.service || null;
  const codeErrorText = codeError && (codeError.offline ? tc.codeFailed
    : codeError.code === 'CODE_NEEDED' ? tc.codeNeeded
    : refusalText(t, lang, codeError, true) || tc.codeFailed);

  // The service from the Charter fills in the form's service when the code is from
  // that office's slip and the slip names none.
  useEffect(() => {
    if (!codeInfo || !presetService || codeInfo.kind === 'REPORT' || codeInfo.service) return;
    if (codeInfo.department !== presetService.department) return;
    setCsm(c => (c.service ? c : { ...c, service: presetService.service }));
  }, [codeInfo, presetService]);

  // ── The last box: comments, complaints or suggestions ──
  const [remark, setRemark] = useState('');
  // The AI's reading of the box ({ text, kind, urgency, failed }): kind is
  // COMPLAINT, SUGGESTION or COMMENT, or null for no remark ("None", "Wala po").
  const [reading, setReading] = useState(null);
  const [readingBusy, setReadingBusy] = useState(false);
  // The citizen's own choice when the AI's reading is not right (null: the AI's).
  const [chosenKind, setChosenKind] = useState(null);
  const debounceRef = useRef(null);
  const readRequest = useRef(0);
  useEffect(() => () => clearTimeout(debounceRef.current), []);
  const trimmed = remark.trim();
  const kind = trimmed ? chosenKind || reading?.kind || null : null;
  const reportKind = isReport(kind) ? kind : null;

  // Asks the AI what the text is (and how urgent a complaint is). Only the newest
  // answer counts (an older one can arrive late).
  const readRemark = useCallback(async text => {
    const request = ++readRequest.current;
    setReadingBusy(true);
    try {
      const res = await api.post('/classify', { text });
      if (request !== readRequest.current) return null;
      const next = { text, kind: res.data.remark || null, urgency: res.data.urgency || null };
      setReading(next);
      return next;
    } catch {
      if (request !== readRequest.current) return null;
      const next = { text, kind: null, urgency: null, failed: true };
      setReading(next);
      return next;
    } finally {
      if (request === readRequest.current) setReadingBusy(false);
    }
  }, []);

  // After each pause in typing, the AI reads the box again.
  function handleRemarkChange(e) {
    const text = e.target.value;
    setRemark(text);
    clearTimeout(debounceRef.current);
    const clean = text.trim();
    if (!clean) {
      readRequest.current += 1;
      setReading(null);
      setReadingBusy(false);
      setChosenKind(null);
      return;
    }
    setReadingBusy(true);
    debounceRef.current = setTimeout(() => readRemark(clean), 600);
  }

  // Choosing the AI's own reading again goes back to following the AI.
  function pickKind(next) {
    setChosenKind(reading?.kind === next && !reading?.failed ? null : next);
  }

  const [trackInput, setTrackInput] = useState('');
  const [loading, setLoading] = useState(false);
  // Sent: the code to keep (the complaint's or suggestion's, or the feedback's), what
  // the box was sent as, the feedback's own code next to a report, and the office.
  const [trackingId, setTrackingId] = useState(null);
  const [sentKind, setSentKind] = useState(null);
  const [feedbackCode, setFeedbackCode] = useState(null);
  const [dueAt, setDueAt] = useState(null);
  const [sentOffice, setSentOffice] = useState(null);
  // The confirmation's "Copy code" button shows "Copied!" for a moment after a tap.
  const [codeCopied, setCodeCopied] = useState(false);
  const copiedTimer = useRef(null);
  useEffect(() => () => clearTimeout(copiedTimer.current), []);
  async function copyCode() {
    if (await copyText(trackingId)) {
      setCodeCopied(true);
      toast.success(t.codeCopiedToast, { id: 'code-copied' });
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCodeCopied(false), 2500);
    } else {
      toast.error(t.copyFailed, { id: 'code-copied' });
    }
  }
  // The working days for each urgency and type and the emergency hotline (Settings),
  // and the urgency the server gave a complaint (confirmation).
  const [deadlines, setDeadlines] = useState(DEFAULT_DEADLINES);
  const [hotline, setHotline] = useState('');
  const [sentPriority, setSentPriority] = useState(null);
  useEffect(() => {
    api.get('/settings/public').then(r => {
      if (r.data.deadlines) setDeadlines(d => ({ ...d, ...r.data.deadlines }));
      setHotline(r.data.emergencyHotline || '');
    }).catch(() => {});
  }, []);
  // Why the last send didn't go through, shown above Submit: { text, trackingId? }
  // (trackingId when the same complaint or suggestion was already sent).
  const [notice, setNotice] = useState(null);

  // Spam protection: the form's one-time ticket { ticket, at, siteKey }, the
  // "I'm not a robot" check (only when the site has it set up), and a hidden field
  // only bots fill in.
  const ticketRef = useRef(null);
  const [siteKey, setSiteKey] = useState(null);
  const botTokenRef = useRef(null);
  const [botCheckRound, setBotCheckRound] = useState(0);
  const honeypotRef = useRef(null);
  const handleBotToken = useCallback(token => { botTokenRef.current = token; }, []);

  const loadTicket = useCallback(async () => {
    const { ticket, siteKey: key } = await fetchFormTicket();
    ticketRef.current = { ticket, at: Date.now(), siteKey: key };
    setSiteKey(key);
    return ticketRef.current;
  }, []);

  useEffect(() => { loadTicket().catch(() => {}); }, [loadTicket]);

  // Waits up to 12 seconds for the "I'm not a robot" check to finish (if its script
  // can't load in 8, it reports 'unavailable' and the form goes ahead).
  async function botCheckToken() {
    for (let waited = 0; !botTokenRef.current && waited < 12000; waited += 250) await pause(250);
    return botTokenRef.current;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;
    if (!codeInfo) return toast.error(tc.codeNeeded, { id: CHECK_TOAST });
    const left = unanswered(csm);
    if (left.length) {
      toast.error(tc.missingToast, { id: CHECK_TOAST });
      return pointTo(left);
    }
    setLoading(true);
    setNotice(null);
    let sent = false;
    try {
      // What the box is: the citizen's choice, or the AI's reading of the latest
      // words (read now if the AI hasn't yet). Without a reading the citizen chooses.
      let finalKind = chosenKind;
      if (trimmed && !chosenKind) {
        let current = reading?.text === trimmed ? reading : null;
        if (!current) {
          clearTimeout(debounceRef.current);
          current = await readRemark(trimmed);
        }
        finalKind = current?.kind || null;
        if (!current || current.failed) {
          toast.error(t.remarkPickToast, { id: CHECK_TOAST });
          return focusField('description');
        }
      }
      const asReport = isReport(finalKind);
      if (asReport && trimmed.length < 20) {
        toast.error(t.reportMin[finalKind], { id: CHECK_TOAST });
        return focusField('description');
      }

      const fd = new FormData();
      fd.append('type', 'FEEDBACK');
      // The office is the one the code belongs to.
      fd.append('ratingCode', codeInfo.code);
      fd.append('csm', JSON.stringify(csmPayload(csm)));
      if (trimmed) {
        fd.append('description', trimmed);
        if (finalKind) fd.append('remarkType', finalKind);
      }
      const bait = honeypotRef.current?.value;
      if (bait) fd.append('leave_empty', bait);

      let res;
      let botToken = null;
      for (let attempt = 1; ; attempt += 1) {
        const ticket = ticketRef.current || await loadTicket();
        if (ticket.siteKey && !botToken) {
          botToken = await botCheckToken();
          if (!botToken) {
            setNotice({ text: t.botCheck });
            return;
          }
        }
        const age = Date.now() - ticket.at;
        if (age < TICKET_READY_MS) await pause(TICKET_READY_MS - age);

        const headers = { 'Content-Type': 'multipart/form-data', 'X-Form-Ticket': ticket.ticket };
        if (botToken) headers['X-Turnstile-Token'] = botToken;
        sent = true;
        try {
          res = await api.post('/submissions', fd, { headers });
          break;
        } catch (err) {
          // The ticket was too old or already used (e.g. the page was open overnight):
          // send once more with a new one.
          if (attempt === 1 && err.response?.data?.code === 'FORM_TICKET') {
            ticketRef.current = null;
            continue;
          }
          err.asReport = asReport;
          throw err;
        }
      }
      const main = res.data.submission || {};
      const madeReport = isReport(main.type) ? main.type : null;
      setTrackingId(res.data.trackingId);
      setSentKind(madeReport);
      setFeedbackCode(madeReport ? res.data.feedback?.trackingId || null : null);
      setDueAt(madeReport ? main.dueAt || null : null);
      setSentOffice(main.department || codeInfo.department || null);
      setSentPriority(madeReport === 'COMPLAINT' ? main.priority || null : null);
      toast.dismiss();
      toast.success(t.sentToast);
    } catch (err) {
      const data = err.response?.data;
      // A question the server found unanswered is marked red; a code that can't be
      // used (used a moment ago, for example) goes back to the code box, and the
      // answers stay for another code.
      if (data?.code === 'CSM_INCOMPLETE' && data.field) {
        toast.error(tc.missingToast, { id: CHECK_TOAST });
        pointTo([data.field]);
        return;
      }
      if (CODE_REFUSALS.includes(data?.code)) {
        setCodeInfo(null);
        setCodeError(data);
        codeFieldRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      setNotice({
        text: err.response ? (refusalText(t, lang, data, !err.asReport) || t.sendFailed) : t.offline,
        // Already sent: a friendly note with a Track link.
        info: data?.code === 'DUPLICATE',
        trackingId: data?.code === 'DUPLICATE' ? data.trackingId : null,
      });
      if (data?.field && FIELD_IDS[data.field]) focusField(data.field);
    } finally {
      setLoading(false);
      if (sent) {
        // Each ticket and each "I'm not a robot" pass is good for one form.
        ticketRef.current = null;
        loadTicket().catch(() => {});
        setBotCheckRound(n => n + 1);
      }
    }
  }

  // A new form for the next client (an office may keep one phone or tablet for its
  // clients); the used code is not checked again.
  function resetForm() {
    setTrackingId(null);
    setSentKind(null);
    setFeedbackCode(null);
    setDueAt(null);
    setSentOffice(null);
    setSentPriority(null);
    setCodeCopied(false);
    setNotice(null);
    setCsm(emptyCsm());
    setMissing([]);
    setRemark('');
    readRequest.current += 1;
    setReading(null);
    setReadingBusy(false);
    setChosenKind(null);
    setRateCode('');
    setCodeInfo(null);
    setCodeError(null);
    if (routeCode || rate) navigate('/submit', { replace: true });
    window.scrollTo(0, 0);
  }

  // Sent: the Transaction Code to keep, with Copy and Track, and the office it went
  // to. A complaint shows how urgent it is; a complaint or suggestion its date and the
  // feedback's own code; a form without one, the overall answer (SQD0).
  if (trackingId) {
    const overall = scaleMeta(csm.sqd0);
    return (
      <CitizenPortalLayout>
        <div className="max-w-lg mx-auto py-8 text-center">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-10">
            <div className="mb-4 flex justify-center">
              {sentKind ? (
                <div className="p-4 rounded-full bg-green-50" style={{ color: '#16a34a' }}>
                  <Icon name="checkCircle" className="w-14 h-14" />
                </div>
              ) : (
                <div className="p-4 rounded-full bg-green-50 text-green-700">
                  <Icon name="feedback" className="w-14 h-14" />
                </div>
              )}
            </div>
            <h2 data-sent-kind={sentKind || 'FEEDBACK'} className="text-2xl font-bold text-gray-800 mb-2">{sentKind ? t.sentTitle[sentKind] : t.thanksTitle}</h2>
            {csm.sqd0 != null && (
              <p data-overall-answer className="mb-3 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-1.5 text-sm text-gray-700">
                {overall && <CsmFace value={overall.value} className="w-5 h-5 flex-shrink-0" />}
                <span>{tc.overallAnswer} <strong className="text-gray-900">{csm.sqd0 === NA ? tc.scale.NA : tc.scale[csm.sqd0]}</strong></span>
              </p>
            )}
            {sentOffice && (
              <p data-sent-office className="text-gray-700 font-medium mb-2">
                {(sentKind ? t.kindSentTo[sentKind] : t.feedbackSentTo)(officeLabel(sentOffice))}
              </p>
            )}
            {!sentKind && <p className="text-gray-600 mb-4">{tc.thanksHelps}</p>}
            <p className="text-gray-500 mb-2">{t.yourCode}</p>
            {/* select-all: one press selects the whole code, not just the part between dashes. */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-6 py-4 font-mono text-xl font-bold mb-3 select-all break-all"
              style={{ color: dark ? '#60a5fa' : '#2563eb' }}>
              {trackingId}
            </div>
            <button type="button" onClick={copyCode} data-copy-code
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 mb-4 rounded-lg border font-semibold text-sm transition-colors ${codeCopied
                ? 'border-green-300 bg-green-50 text-green-700'
                : 'border-blue-200 bg-white text-blue-700 hover:bg-gray-50'}`}>
              {codeCopied ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden="true">
                  <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              )}
              {codeCopied ? t.codeCopied : t.copyCode}
            </button>
            {sentPriority && (
              <p className="flex items-center justify-center gap-2 mb-3 text-sm">
                <span className="text-gray-700">{t.urgencyOnConfirm}</span>
                <PriorityBadge priority={sentPriority} label={t.urgencyLevels[sentPriority]?.name} />
              </p>
            )}
            {dueAt && (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 mb-3 text-sm">
                <Icon name="clock" className="w-4 h-4 flex-shrink-0" />
                <span className="text-gray-700">{t.targetDate} <strong className="text-gray-900">{formatDueDate(dueAt, true)}</strong></span>
              </div>
            )}
            <p className="text-sm text-gray-500 mb-1 font-medium">
              {sentKind ? t.saveCodeKind[sentKind] : t.saveCodeFeedback}
            </p>
            {feedbackCode && (
              <p data-feedback-code className="text-xs text-gray-600 mb-1">{t.alsoFeedback(feedbackCode)}</p>
            )}
            <p className="text-xs text-gray-500 mb-8">
              {sentKind ? t.noAccount : null}
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <button onClick={resetForm}
                className="px-5 py-2.5 bg-primary text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors">
                {t.sendAnotherForm}
              </button>
              <button onClick={() => navigate('/track', { state: { prefill: trackingId } })}
                className="px-5 py-2.5 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                {sentKind ? t.trackThis : t.trackFeedback}
              </button>
            </div>
          </div>
        </div>
      </CitizenPortalLayout>
    );
  }

  // The form's last part: the box, what the AI reads it as, and for a complaint how
  // urgent it is (with what to include), for a suggestion the date to act by.
  const remarkPart = (
    <>
      <div data-tour="form-remark">
        <label htmlFor="form-remark" className="block text-sm font-semibold text-gray-800 mb-1">{tc.suggestions}</label>
        <p id="form-remark-hint" className="text-xs text-gray-600 mb-1.5 leading-relaxed">{tc.remarkHint}</p>
        <textarea id="form-remark" value={remark} onChange={handleRemarkChange} rows={5} maxLength={2000}
          aria-describedby="form-remark-hint" placeholder={tc.suggestionsPlaceholder}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm resize-none" />
        {reportKind ? (
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 h-1 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, (trimmed.length / 20) * 100)}%`,
                  background: trimmed.length >= 20 ? '#16a34a' : trimmed.length >= 10 ? '#d97706' : '#dc2626',
                }} />
            </div>
            <p className="text-xs text-gray-500 flex-shrink-0">
              {trimmed.length < 20 ? t.countShort(trimmed.length) : `${remark.length.toLocaleString('en-US')} / 2,000`}
            </p>
          </div>
        ) : remark.length > 1500 && (
          <p className="text-xs text-gray-500 mt-1 text-right">{remark.length.toLocaleString('en-US')} / 2,000</p>
        )}
      </div>

      {trimmed && (kind || reading?.failed || readingBusy) && (
        <RemarkReading t={t} kind={kind} chosen={Boolean(chosenKind)} busy={readingBusy && !reading} onPick={pickKind} />
      )}

      {/* HOW URGENT (complaints): set automatically from what was written */}
      {reportKind === 'COMPLAINT' && reading?.urgency && (
        <AutoUrgency t={t} priority={reading.urgency.priority} deadlines={deadlines} hotline={hotline} />
      )}
      {reportKind === 'SUGGESTION' && (
        <p data-reply-by className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-700">
          <Icon name="clock" className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{t.replyBy} <strong className="font-semibold text-gray-900">{formatDueDate(addWorkingDays(new Date(), urgencyDays(deadlines, 'SUGGESTION', 'STANDARD')), true)}</strong></span>
        </p>
      )}
      {reportKind === 'COMPLAINT' && (
        <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700 leading-relaxed">
          <strong>{t.includeTitle}</strong>{' '}
          {t.include.map((part, i) => (
            <React.Fragment key={i}>
              ({i + 1}) {part.b && <strong>{part.b}</strong>}{part.t}{i < t.include.length - 1 ? ', ' : ''}
            </React.Fragment>
          ))}
        </div>
      )}
    </>
  );

  return (
    <CitizenPortalLayout>
      <style>{fadeCss}</style>
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 items-start">
        <div>
        <div className="submit-fade-0 mb-5 bg-blue-50 border border-blue-100 rounded-2xl px-6 py-5 flex items-start gap-4">
          <div className="p-2.5 rounded-xl bg-blue-600 text-white flex-shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-800">{t.pageTitle}</h1>
            <p className="text-gray-600 text-sm mt-0.5">{t.pageLead}</p>
            <p className="text-gray-600 text-xs mt-0.5">{t.pageNote}</p>
          </div>
        </div>

        {/* Data Privacy Act notice */}
        <div className="mb-6 flex items-start gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-500 leading-relaxed">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span>
            {t.privacy[0]}<strong>{t.privacy[1]}</strong>{t.privacy[2]}
          </span>
        </div>

        {/* noValidate: the page checks the form itself (handleSubmit), so the notes are in
            the citizen's language and come in the form's order: the questions first,
            then the box. */}
        <form onSubmit={handleSubmit} noValidate className="submit-fade-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 space-y-6">
          <div className="-mb-2">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <h2 className="flex items-center gap-2 text-base font-bold text-gray-800">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                {t.formTitle}
              </h2>
              <button type="button" onClick={() => setTourOpen(true)} data-tour-replay
                className="inline-flex items-center gap-1.5 min-h-[36px] text-sm font-semibold text-blue-700 hover:underline underline-offset-2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" /><path d="M10 8.5v7l5.5-3.5z" />
                </svg>
                {tt.ui.showMeHow}
              </button>
            </div>
            <RequiredNote className="mt-1">{t.requiredNote}</RequiredNote>
          </div>

          {/* THE CODE FROM THE OFFICE: the form opens once it is checked */}
          <div ref={codeFieldRef} className="scroll-mt-24 sm:max-w-xl" data-tour="form-code">
            <label htmlFor="rate-code" className="block text-sm font-medium text-gray-700 mb-1"><Starred>{tc.codeLabel}</Starred></label>
            <div className="flex gap-2">
              <input id="rate-code" type="text" value={rateCode} maxLength={40} autoComplete="off" autoCapitalize="characters" spellCheck={false}
                onChange={e => {
                  setRateCode(e.target.value.toUpperCase());
                  setCodeInfo(null);
                  setCodeError(null);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    checkCode(rateCode);
                  }
                }}
                placeholder={tc.codePlaceholder}
                aria-describedby="rate-code-hint"
                className="flex-1 min-w-0 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm font-mono tracking-wide" />
              <button type="button" onClick={() => checkCode(rateCode)} disabled={codeChecking}
                className="flex-shrink-0 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60">
                {codeChecking ? tc.codeChecking : tc.codeCheck}
              </button>
            </div>
            <p id="rate-code-hint" className="text-xs text-gray-500 mt-1">{tc.codeHint}</p>
          </div>

          {/* The office the code opens the form for (then the form), why it can't be
              used, or how to get a code */}
          {codeInfo ? (
            <div data-code-ok className="flex items-start gap-3 rounded-xl border border-green-200 dark:border-green-500/40 bg-green-50 px-4 py-3">
              <svg className="w-5 h-5 mt-0.5 flex-shrink-0 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 13l4 4L19 7" />
              </svg>
              <div className="min-w-0">
                <p className="text-sm text-gray-700">{tc.ratingOffice}</p>
                <p className="text-base font-bold text-gray-900">{officeLabel(codeInfo.department)}</p>
                {lockedService && <p className="text-sm text-gray-700 mt-0.5">{tc.ratingService} <strong className="text-gray-900">{lockedService}</strong></p>}
              </div>
            </div>
          ) : codeError ? (
            <div role="alert" data-code-error={codeError.code || 'OFFLINE'}
              className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed">
              <Icon name="complaint" className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-700" />
              <div className="min-w-0">
                <p className="text-red-700">{codeErrorText}</p>
                <p className="text-gray-700 mt-1">{tc.noCode}</p>
              </div>
            </div>
          ) : (
            <div data-code-start className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-4 text-sm leading-relaxed">
              {presetService && (
                <p data-rate-service className="text-gray-700 mb-1">{tc.fromCharter} <strong className="text-gray-900">{presetService.service}</strong></p>
              )}
              <p className="text-gray-700">{codeChecking ? tc.codeChecking : tc.codeStart}</p>
              <p className="text-gray-600 mt-1">{tc.noCode}</p>
            </div>
          )}

          {codeInfo && (
            <CsmForm value={csm} onChange={setAnswer} missing={missing} office={officeLabel(codeInfo.department)} lockedService={lockedService}
              serviceOptions={serviceNames(codeInfo.department)}>
              {remarkPart}
            </CsmForm>
          )}

          {/* Hidden from people (off-screen, skipped by Tab and screen readers). Only
              bots fill it in, and the server then refuses the form. */}
          <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
            <label htmlFor="leave_empty">Leave this field empty</label>
            <input ref={honeypotRef} id="leave_empty" name="leave_empty" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
          </div>

          {/* SUBMIT BUTTON (once the code is checked) */}
          {codeInfo && <div className="space-y-3">
            {notice && (
              <div role="alert"
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed ${
                  notice.info ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'
                }`}>
                <Icon name={notice.info ? 'check' : 'complaint'}
                  className={`w-5 h-5 flex-shrink-0 mt-0.5 ${notice.info ? 'text-blue-700' : 'text-red-700'}`} />
                <div className="min-w-0">
                  <p className={notice.info ? 'text-gray-800' : 'text-red-700'}>{notice.text}</p>
                  {notice.trackingId && (
                    <button type="button" onClick={() => navigate('/track', { state: { prefill: notice.trackingId } })}
                      className="mt-1 font-semibold text-blue-700 underline underline-offset-2">
                      {t.trackReport(notice.trackingId)}
                    </button>
                  )}
                </div>
              </div>
            )}
            {siteKey && (
              <TurnstileBox siteKey={siteKey} theme={dark ? 'dark' : 'light'} onToken={handleBotToken} resetSignal={botCheckRound} />
            )}
            <button type="submit" disabled={loading} data-tour="form-send"
              className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
              {loading ? t.sending : t.send}
            </button>
          </div>}
        </form>
        </div>

        {/* RIGHT SIDE PANELS */}
        <div className="submit-fade-2 space-y-5">
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">{t.mattersTitle}</h3>
            <p className="text-sm text-gray-600">
              {t.mattersText}
            </p>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-1">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
              </svg>
              {t.trackTitle}
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              {t.trackText}
            </p>
            <input type="text" value={trackInput} onChange={e => setTrackInput(e.target.value)}
              placeholder={t.trackPlaceholder}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary" />
            <button type="button"
              onClick={() => navigate('/track', { state: { prefill: trackInput } })}
              className="w-full bg-primary text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
              </svg>
              {t.checkStatus}
            </button>
          </div>

          <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-2xl p-4">
            <div className="p-1.5 rounded-lg bg-blue-600 text-white flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">{t.noNameTitle}</p>
              <p className="text-xs text-gray-600">{t.noNameText}</p>
            </div>
          </div>
        </div>
      </div>

      <Tour open={tourOpen} steps={formTourSteps} labels={tt.ui} dark={dark} lang={lang} onClose={closeTour} />
    </CitizenPortalLayout>
  );
}
