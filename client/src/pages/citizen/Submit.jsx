import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import CitizenPortalLayout from '../../components/common/CitizenPortalLayout';
import Icon from '../../components/common/Icons';
import { formatDueDate } from '../../components/common/DeadlineBadge';
import { PriorityBadge } from '../../components/common/StatusBadge';
import FeedbackRatingPanel from '../../components/citizen/FeedbackRatingPanel';
import LocationPicker from '../../components/citizen/LocationPicker';
import TurnstileBox from '../../components/citizen/TurnstileBox';
import { useTheme } from '../../context/ThemeContext';
import { useLang, useText } from '../../i18n/LanguageContext';
import SUBMIT_TEXT, { refusalText } from '../../i18n/submitText';
import api from '../../utils/api';
import { fetchFormTicket } from '../../utils/reportGuard';
import { suggestLocations, withBarangay, CANTILAN_BARANGAY_OPTIONS } from '../../data/cantilanLocations';
import { officeLabel } from '../../data/officeNames';
import { DEFAULT_DEADLINES, urgencyDays, addWorkingDays } from '../../data/urgency';

const fadeCss = `
@keyframes submitFadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
.submit-fade-0 { animation: submitFadeUp .45s .02s cubic-bezier(.22,1,.36,1) both; }
.submit-fade-1 { animation: submitFadeUp .45s .08s cubic-bezier(.22,1,.36,1) both; }
.submit-fade-2 { animation: submitFadeUp .45s .14s cubic-bezier(.22,1,.36,1) both; }
`;

const DEPARTMENTS = [
  "Mayor's Office – CRMO", 'HR', 'Tourism', 'Motorpool', 'Traffic',
  'CSDO', 'OSCA', 'MDRRMO',
  'Municipal Budget Office', 'Municipal Accountant Office',
  'Municipal Agriculture Office', 'Municipal Health Office',
  'Municipal Civil Registry Office',
  'Municipal Social Welfare & Development Office',
  'Municipal Economic & Natural Resource Office',
  'Municipal Treasurer Office', 'Municipal Engineering Office',
  'Municipal Planning & Development Office',
  'Sangguniang Bayan Office', 'Office of the Vice Mayor',
];

function ConfidenceBadge({ confidence, text }) {
  const color = confidence >= 70 ? '#166534' : confidence >= 40 ? '#92400e' : '#b91c1c';
  const bg    = confidence >= 70 ? '#dcfce7' : confidence >= 40 ? '#fef3c7' : '#fee2e2';
  return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color, background: bg }}>
      {text(confidence)}
    </span>
  );
}

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

// The contact number is a PH mobile number: digits only, starting with 09, 11 in
// all. A pasted "+63 917 123 4567" or "917 123 4567" becomes "09171234567".
const MOBILE_DIGITS = 11;
function cleanMobile(raw) {
  const digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('63')) return `0${digits.slice(2)}`;
  if (digits.startsWith('9')) return `0${digits}`;
  return digits;
}

// A form ticket only works a few seconds after it was issued (see utils/reportGuard).
const TICKET_READY_MS = 3200;

const AI_PATH = 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z';
const PHONE_PATH = 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z';

// How urgent a complaint is, set automatically from the description (the AI on the
// server reads it again when the report is sent): one line with the level and the
// date the office should finish by (working days counted like the server). Nothing
// to choose. Urgent adds a one-line "call 911" note.
function AutoUrgency({ t, priority, deadlines, hotline }) {
  const days = urgencyDays(deadlines, 'COMPLAINT', priority);
  return (
    <div aria-live="polite" data-urgency-auto={priority} className="mt-3 space-y-2">
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

export default function Submit() {
  const { dark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { lang } = useLang();
  const t = useText(SUBMIT_TEXT);

  const debounceRef = useRef(null);

  const [form, setForm] = useState({ type: 'COMPLAINT', department: '', description: '', contactNumber: '', email: '', address: '' });
  // Feedback rates the municipality's service as a whole: no office, no photos,
  // no deadline (see server controllers/submissions.js).
  const isFeedback = form.type === 'FEEDBACK';
  const [trackInput, setTrackInput] = useState('');
  const [photos, setPhotos] = useState([]);
  const [pin, setPin] = useState(null); // { lat, lng, barangay } from the map, optional
  const [phoneNote, setPhoneNote] = useState(false); // a typed number didn't start with 09

  // Keeps the contact number to 09 and 9 more digits: a key that would break the
  // 09 start is ignored (with a note under the box), and so is a 12th digit.
  function handlePhone(raw) {
    const next = cleanMobile(raw);
    if (next !== '' && next !== '0' && !next.startsWith('09')) {
      setPhoneNote(true);
      return;
    }
    setPhoneNote(false);
    setForm(f => (next.length > MOBILE_DIGITS && f.contactNumber.length >= MOBILE_DIGITS
      ? f
      : { ...f, contactNumber: next.slice(0, MOBILE_DIGITS) }));
  }

  // A new pin also puts its barangay in the Location field (keeping what was typed).
  function handlePin(next) {
    setPin(next);
    if (next?.barangay) setForm(f => ({ ...f, address: withBarangay(f.address, next.barangay) }));
  }
  const pinAgrees = !pin?.barangay
    || withBarangay(form.address, pin.barangay).toLowerCase() === form.address.trim().toLowerCase();
  const [loading, setLoading] = useState(false);
  const [trackingId, setTrackingId] = useState(null);
  const [dueAt, setDueAt] = useState(null);
  // How urgent the AI finds a complaint ({ priority, words }, while typing), the
  // working days for each level and the emergency hotline (Settings), and what the
  // server decided when the report was sent (confirmation).
  const [urgency, setUrgency] = useState(null);
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
  // (trackingId when the same report was already sent).
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
  // can't load in 8, it reports 'unavailable' and the report goes ahead).
  async function botCheckToken() {
    for (let waited = 0; !botTokenRef.current && waited < 12000; waited += 250) await pause(250);
    return botTokenRef.current;
  }
  const [feedbackRating, setFeedbackRating]     = useState(0);
  const [feedbackReaction, setFeedbackReaction] = useState('');
  const [feedbackTags, setFeedbackTags]         = useState([]);

  const [aiResult, setAiResult]       = useState(null);
  const [aiLoading, setAiLoading]     = useState(false);
  const [aiDismissed, setAiDismissed] = useState(false);

  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  // True while the list is the full set of barangays (nothing specific typed yet).
  const [listingBarangays, setListingBarangays] = useState(false);
  const locationFieldRef = useRef(null);

  const [deptOpen, setDeptOpen] = useState(false);
  const deptFieldRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (deptFieldRef.current && !deptFieldRef.current.contains(e.target)) {
        setDeptOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    const urls = photos.map(p => URL.createObjectURL(p));
    setPhotoPreviews(urls);
    return () => urls.forEach(u => URL.revokeObjectURL(u));
  }, [photos]);

  function addPhotos(fileList) {
    const incoming = Array.from(fileList).filter(f => f.type === 'image/jpeg' || f.type === 'image/png');
    setPhotos(prev => [...prev, ...incoming].slice(0, 5));
  }

  function removePhoto(idx) {
    setPhotos(prev => prev.filter((_, i) => i !== idx));
  }

  useEffect(() => {
    function onClickOutside(e) {
      if (locationFieldRef.current && !locationFieldRef.current.contains(e.target)) {
        setShowLocationSuggestions(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Opens the list for what is typed: every barangay while the field is empty,
  // otherwise the matching barangays and landmarks.
  function showLocationSuggestionsFor(value) {
    const found = suggestLocations(value);
    const matches = found.filter(loc => loc !== value.trim());
    setListingBarangays(found === CANTILAN_BARANGAY_OPTIONS);
    setLocationSuggestions(matches);
    setShowLocationSuggestions(matches.length > 0);
  }

  function handleAddressChange(value) {
    setForm(p => ({ ...p, address: value }));
    showLocationSuggestionsFor(value);
  }

  function selectLocationSuggestion(loc) {
    setForm(p => ({ ...p, address: loc }));
    setShowLocationSuggestions(false);
  }

  // The arrow in the field: shows the whole barangay list, or closes it.
  function toggleBarangayList() {
    if (showLocationSuggestions) return setShowLocationSuggestions(false);
    setListingBarangays(true);
    setLocationSuggestions(CANTILAN_BARANGAY_OPTIONS);
    setShowLocationSuggestions(true);
  }

  useEffect(() => {
    if (location.state?.type) setForm(p => ({ ...p, type: location.state.type }));
  }, [location.state]);

  // After each pause in typing, the AI suggests an office and reads how urgent the
  // text is. Only the newest answer counts (an older one can arrive late).
  const aiRequestRef = useRef(0);
  const runAI = useCallback((text) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const request = ++aiRequestRef.current;
    if (!text || text.length < 10) { setAiResult(null); setUrgency(null); setAiLoading(false); return; }
    setAiLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.post('/classify', { text });
        if (request !== aiRequestRef.current) return;
        setUrgency(res.data.urgency || null);
        if (res.data.department !== 'UNASSIGNED') {
          setAiResult(res.data);
          setAiDismissed(false);
        } else {
          setAiResult(null);
        }
      } catch {
        if (request !== aiRequestRef.current) return;
        setAiResult(null);
        setUrgency(null);
      } finally {
        if (request === aiRequestRef.current) setAiLoading(false);
      }
    }, 600);
  }, []);

  // Complaints are always read (for how urgent they are); a suggestion only while no
  // office is chosen (for the office). Feedback isn't read.
  function handleDescriptionChange(e) {
    const text = e.target.value;
    setForm(p => ({ ...p, description: text }));
    if (!isFeedback && (form.type === 'COMPLAINT' || !form.department)) runAI(text);
    else { setAiResult(null); setAiLoading(false); }
  }

  function applyAISuggestion() {
    if (aiResult) {
      setForm(p => ({ ...p, department: aiResult.department }));
      setAiResult(null);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;
    if (!isFeedback && !form.department) return toast.error(t.needOffice);
    if (form.description.trim().length < 20) return toast.error(t.descMin);
    if (!form.contactNumber.trim()) return toast.error(t.phoneRequired);
    // A PH mobile number (so updates can be texted once an SMS service is set up).
    // The box only lets in digits starting with 09, so this checks all 11 are there.
    if (!/^09\d{9}$/.test(form.contactNumber)) return toast.error(t.phoneInvalid);
    if (!form.email.trim()) return toast.error(t.emailRequired);
    if (form.type === 'FEEDBACK') {
      if (!feedbackRating) return toast.error(t.ratingRequired);
      if (!feedbackReaction) return toast.error(t.reactionRequired);
    }
    setLoading(true);
    setNotice(null);
    let sent = false;
    try {
      const fd = new FormData();
      fd.append('type', form.type);
      if (!isFeedback) fd.append('citizenDepartment', form.department);
      fd.append('description', form.description);
      if (form.contactNumber) fd.append('contactNumber', form.contactNumber);
      if (form.email) fd.append('email', form.email);
      if (form.address) fd.append('address', form.address);
      if (pin) {
        fd.append('latitude', String(pin.lat));
        fd.append('longitude', String(pin.lng));
      }
      if (form.type === 'FEEDBACK') {
        fd.append('rating', String(feedbackRating));
        fd.append('reaction', feedbackReaction);
        if (feedbackTags.length) fd.append('feedbackTags', JSON.stringify(feedbackTags));
      }
      const bait = honeypotRef.current?.value;
      if (bait) fd.append('leave_empty', bait);
      if (!isFeedback) photos.forEach(p => fd.append('photos', p));

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
          throw err;
        }
      }
      setTrackingId(res.data.trackingId);
      setDueAt(res.data.submission?.dueAt || null);
      setSentPriority(form.type === 'COMPLAINT' ? res.data.submission?.priority || null : null);
      toast.success(t.sentToast);
    } catch (err) {
      const data = err.response?.data;
      setNotice({
        text: err.response ? (refusalText(t, lang, data, isFeedback) || t.sendFailed) : t.offline,
        // Already sent: a friendly note (plus a Track link, except for feedback).
        info: data?.code === 'DUPLICATE',
        trackingId: data?.code === 'DUPLICATE' && !isFeedback ? data.trackingId : null,
      });
    } finally {
      setLoading(false);
      if (sent) {
        // Each ticket and each "I'm not a robot" pass is good for one report.
        ticketRef.current = null;
        loadTicket().catch(() => {});
        setBotCheckRound(n => n + 1);
      }
    }
  }

  function resetForm() {
    setTrackingId(null);
    setDueAt(null);
    setNotice(null);
    setForm({ type: 'COMPLAINT', department: '', description: '', contactNumber: '', email: '', address: '' });
    setPhotos([]);
    setPin(null);
    setPhoneNote(false);
    setFeedbackRating(0);
    setFeedbackReaction('');
    setFeedbackTags([]);
    setAiResult(null);
    setAiDismissed(false);
    setUrgency(null);
    setSentPriority(null);
  }

  // Feedback: a thank-you, with no code to keep (nothing to track or wait for).
  if (trackingId && isFeedback) {
    return (
      <CitizenPortalLayout>
        <div className="max-w-lg mx-auto py-8 text-center">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-10">
            <div className="mb-4 flex justify-center">
              <div className="p-4 rounded-full bg-green-50 text-green-700">
                <Icon name="feedback" className="w-14 h-14" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">{t.thanksTitle}</h2>
            {feedbackRating > 0 && (
              <p className="mb-3">
                <span className="text-2xl tracking-wider" aria-hidden="true">
                  <span style={{ color: '#f59e0b' }}>{'★'.repeat(feedbackRating)}</span>
                  <span style={{ color: '#cbd5e1' }}>{'★'.repeat(5 - feedbackRating)}</span>
                </span>
                <span className="block text-sm font-semibold text-gray-700 mt-1">{t.youRated(feedbackRating)}</span>
              </p>
            )}
            <p className="text-gray-600 mb-2">{t.thanksHelps}</p>
            <p className="text-sm text-gray-500 mb-1">{t.thanksEmailed}</p>
            <p className="text-xs text-gray-500 mb-8">{t.referenceNo} <span className="font-mono">{trackingId}</span></p>
            <div className="flex flex-wrap gap-3 justify-center">
              <button onClick={resetForm}
                className="px-5 py-2.5 bg-primary text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors">
                {t.sendAnother}
              </button>
              <button onClick={() => navigate('/')}
                className="px-5 py-2.5 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                {t.backHome}
              </button>
            </div>
          </div>
        </div>
      </CitizenPortalLayout>
    );
  }

  if (trackingId) {
    return (
      <CitizenPortalLayout>
        <div className="max-w-lg mx-auto py-8 text-center">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10">
            <div className="mb-4 flex justify-center">
              <div className="p-4 rounded-full bg-green-50" style={{ color: '#16a34a' }}>
                <Icon name="checkCircle" className="w-14 h-14" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">{t.receivedTitle}</h2>
            <p className="text-gray-500 mb-2">{t.yourCode}</p>
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-6 py-4 font-mono text-xl font-bold mb-3"
              style={{ color: dark ? '#60a5fa' : '#2563eb' }}>
              {trackingId}
            </div>
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
              {t.saveCode}
            </p>
            <p className="text-xs text-gray-500 mb-8">
              {t.noAccount}
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={resetForm}
                className="px-5 py-2.5 bg-primary text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors">
                {t.submitAnother}
              </button>
              <button onClick={() => navigate('/track', { state: { prefill: trackingId } })}
                className="px-5 py-2.5 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                {t.trackThis}
              </button>
            </div>
          </div>
        </div>
      </CitizenPortalLayout>
    );
  }

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

        <form onSubmit={handleSubmit} className="submit-fade-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
          <h2 className="flex items-center gap-2 text-base font-bold text-gray-800 -mb-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            {t.formTitle}
          </h2>

          {/* REPORT TYPE + DEPARTMENT */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.typeLabel}</label>
              <select value={form.type}
                onChange={e => {
                  const type = e.target.value;
                  setForm(p => ({ ...p, type }));
                  if (type === 'FEEDBACK') { setAiResult(null); setAiLoading(false); setDeptOpen(false); }
                  // A complaint's text is read again for how urgent it is.
                  else if (type === 'COMPLAINT') runAI(form.description);
                }}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm">
                <option value="COMPLAINT">{t.types.COMPLAINT}</option>
                <option value="SUGGESTION">{t.types.SUGGESTION}</option>
                <option value="FEEDBACK">{t.types.FEEDBACK}</option>
              </select>
            </div>
            {/* Feedback rates the municipality's service as a whole: no office to choose. */}
            {isFeedback ? (
              <div className="flex items-start gap-2.5 sm:self-end rounded-lg border border-green-200 bg-green-50 px-3.5 py-2.5">
                <Icon name="feedback" className="w-5 h-5 flex-shrink-0 mt-0.5 text-green-700" />
                <p className="text-sm text-gray-700 leading-snug">
                  {t.feedbackNoOffice}
                </p>
              </div>
            ) : (
            <div ref={deptFieldRef} className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.officeLabel}
                {form.department && (
                  <span className="ml-2 text-xs text-primary font-normal">{t.officeAuto}</span>
                )}
              </label>
              <button type="button" onClick={() => setDeptOpen(v => !v)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm text-left bg-white flex items-center justify-between gap-2">
                <span className={form.department ? 'text-gray-900' : 'text-gray-500'}>
                  {form.department ? officeLabel(form.department) : t.officePlaceholder}
                </span>
                <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${deptOpen ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {deptOpen && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1.5 bg-white rounded-lg border border-gray-200 shadow-lg overflow-y-auto"
                  style={{ maxHeight: '16rem' }}>
                  {DEPARTMENTS.map(d => (
                    <button key={d} type="button"
                      onClick={() => {
                        setForm(p => ({ ...p, department: d }));
                        setAiResult(null);
                        setDeptOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                        form.department === d ? 'bg-blue-50 text-primary font-semibold' : 'text-gray-700 hover:bg-gray-50'
                      }`}>
                      {officeLabel(d)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            )}
          </div>

          {/* LOCATION */}
          <div ref={locationFieldRef}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.locationLabel}</label>
            <div className="relative">
              <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <input type="text" value={form.address}
                onChange={e => handleAddressChange(e.target.value)}
                onFocus={() => showLocationSuggestionsFor(form.address)}
                onKeyDown={e => { if (e.key === 'Escape') setShowLocationSuggestions(false); }}
                placeholder={t.locationPlaceholder}
                autoComplete="off" maxLength={191}
                role="combobox" aria-expanded={showLocationSuggestions} aria-controls="location-suggestions" aria-autocomplete="list"
                className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
              <button type="button" onClick={toggleBarangayList} tabIndex={-1}
                aria-label={showLocationSuggestions ? t.closeList : t.showList}
                className="absolute right-0 top-0 h-full px-3 flex items-center text-gray-400 hover:text-gray-600">
                <svg className={`w-4 h-4 transition-transform ${showLocationSuggestions ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showLocationSuggestions && (
                <div id="location-suggestions" role="listbox"
                  className="absolute z-20 left-0 right-0 mt-1.5 bg-white rounded-lg border border-gray-200 shadow-lg overflow-y-auto"
                  style={{ maxHeight: '16rem' }}>
                  {listingBarangays && (
                    <p className="px-4 pt-2.5 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{t.barangaysTitle}</p>
                  )}
                  {locationSuggestions.map(loc => (
                    <button key={loc} type="button" role="option" aria-selected={false}
                      onClick={() => selectLocationSuggestion(loc)}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-blue-50 transition-colors">
                      <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {loc}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">{t.locationHint}</p>
            {pin?.barangay && (pinAgrees ? (
              <p className="text-xs font-medium text-green-700 mt-1">
                {t.pinFilled(pin.barangay)}
              </p>
            ) : (
              <p className="text-xs font-medium text-amber-700 mt-1">
                {t.pinElsewhere(pin.barangay)}{' '}
                <button type="button" onClick={() => setForm(f => ({ ...f, address: withBarangay(f.address, pin.barangay) }))}
                  className="font-semibold underline">
                  {t.useBarangay(pin.barangay)}
                </button>
              </p>
            ))}
          </div>

          {/* MAP PIN (optional) */}
          <LocationPicker value={pin} onChange={handlePin} />

          {/* CONTACT NUMBER (REQUIRED) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.phoneLabel}</label>
            <input type="tel" inputMode="numeric" autoComplete="tel" value={form.contactNumber} required
              onChange={e => handlePhone(e.target.value)}
              placeholder={t.phonePlaceholder}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
            <p aria-live="polite" className={phoneNote ? 'text-xs text-red-700 mt-1' : 'sr-only'}>{phoneNote ? t.phoneStart : ''}</p>
            {/* No hint for reports: CIVIX has no SMS service yet, so it promises no texts. */}
            {isFeedback && <p className="text-xs text-gray-500 mt-1">{t.phoneHintFeedback}</p>}
          </div>

          {/* EMAIL (REQUIRED) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.emailLabel}</label>
            <input type="email" value={form.email} required maxLength={191}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              placeholder={t.emailPlaceholder}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
            <p className="text-xs text-gray-500 mt-1">
              {isFeedback
                ? t.emailHintFeedback
                : t.emailHint}
            </p>
          </div>

          {form.type === 'FEEDBACK' && (
            <FeedbackRatingPanel rating={feedbackRating} reaction={feedbackReaction} tags={feedbackTags}
              onRatingChange={setFeedbackRating} onReactionChange={setFeedbackReaction} onTagsChange={setFeedbackTags} />
          )}

          {/* DESCRIPTION + AI */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {form.type === 'FEEDBACK' ? t.tellUsMore : t.descLabel}
            </label>
            {form.type !== 'FEEDBACK' && (
              <div className="mb-2 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700 leading-relaxed">
                <strong>{t.includeTitle}</strong>{' '}
                {t.include.map((part, i) => (
                  <React.Fragment key={i}>
                    ({i + 1}) {part.b && <strong>{part.b}</strong>}{part.t}{i < t.include.length - 1 ? ', ' : ''}
                  </React.Fragment>
                ))}
              </div>
            )}
            <div className="relative">
              <textarea value={form.description} onChange={handleDescriptionChange} rows={5} maxLength={2000}
                placeholder={form.type === 'FEEDBACK'
                  ? t.feedbackPlaceholder
                  : t.descPlaceholder}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm resize-none" />
              {aiLoading && (
                <div className="absolute bottom-3 right-3 flex items-center gap-1.5 text-xs text-gray-500">
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  {t.aiThinking}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex-1 h-1 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (form.description.length / 20) * 100)}%`,
                    background: form.description.length >= 20 ? '#16a34a' : form.description.length >= 10 ? '#d97706' : '#dc2626',
                  }} />
              </div>
              <p className="text-xs text-gray-500 flex-shrink-0">
                {form.description.length < 20
                  ? t.countShort(form.description.length)
                  : `${form.description.length.toLocaleString('en-US')} / 2,000`}
              </p>
            </div>

            {/* HOW URGENT (complaints): set automatically from the description */}
            {form.type === 'COMPLAINT' && urgency && (
              <AutoUrgency t={t} priority={urgency.priority} deadlines={deadlines} hotline={hotline} />
            )}

            {/* AI Suggestion Panel */}
            {aiResult && !aiDismissed && !form.department && (
              <div className="mt-3 rounded-xl border border-blue-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-blue-600 text-white">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                    </svg>
                    <span className="text-xs font-bold uppercase tracking-wide">{t.aiTitle}</span>
                  </div>
                  <button type="button" onClick={() => setAiDismissed(true)}
                    className="text-white hover:text-blue-100 text-lg leading-none">×</button>
                </div>
                <div className="bg-blue-50 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                    <div>
                      <p className="text-xs text-blue-600 font-medium mb-0.5">{t.aiSuggested}</p>
                      <p className="text-sm font-bold text-gray-800">{officeLabel(aiResult.department)}</p>
                    </div>
                    <ConfidenceBadge confidence={aiResult.confidence} text={t.confidence} />
                  </div>
                  {aiResult.matchedKeywords?.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-600 mb-1.5">{t.aiKeywords}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {aiResult.matchedKeywords.map(kw => (
                          <span key={kw} className="px-2 py-0.5 bg-white border border-blue-200 text-blue-700 text-xs rounded-full font-medium">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button type="button" onClick={applyAISuggestion}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                      {t.aiApply}
                    </button>
                    <button type="button" onClick={() => setAiDismissed(true)}
                      className="px-4 py-2 border border-gray-300 text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors">
                      {t.aiManual}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* FILE ATTACHMENT (not for feedback) */}
          {!isFeedback && <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.photosLabel}</label>
            <div
              onDragOver={e => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={e => { e.preventDefault(); setDragActive(false); addPhotos(e.dataTransfer.files); }}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-all hover:border-primary hover:shadow-[0_0_0_4px_rgba(37,99,235,0.08)] ${
                dragActive ? 'border-primary bg-blue-50 shadow-[0_0_0_4px_rgba(37,99,235,0.12)]' : 'border-gray-200'
              }`}>
              <input type="file" accept="image/jpeg,image/png" multiple
                onChange={e => addPhotos(e.target.files)}
                className="hidden" id="photo-upload" />
              <label htmlFor="photo-upload" className="cursor-pointer">
                <div className="mb-2 flex justify-center text-gray-400">
                  <Icon name="camera" className="w-10 h-10" />
                </div>
                <p className="text-sm text-gray-500">
                  <span className="text-primary font-semibold">{t.photosClick}</span>{t.photosDrag}
                </p>
                <p className="text-xs text-gray-500 mt-1">{t.photosHint}</p>
              </label>
              {photos.length > 0 && (
                <div className="mt-4 grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {photos.map((p, i) => (
                    <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200">
                      <img src={photoPreviews[i]} alt={p.name} className="w-full h-full object-cover" />
                      <button type="button" onClick={() => removePhoto(i)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title={t.removePhoto} aria-label={t.removePhoto}>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>}

          {/* Hidden from people (off-screen, skipped by Tab and screen readers). Only
              bots fill it in, and the server then refuses the report. */}
          <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
            <label htmlFor="leave_empty">Leave this field empty</label>
            <input ref={honeypotRef} id="leave_empty" name="leave_empty" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
          </div>

          {/* SUBMIT BUTTON */}
          <div className="space-y-3">
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
            <button type="submit" disabled={loading}
              className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
              {loading ? t.sending : t.send}
            </button>
          </div>
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
    </CitizenPortalLayout>
  );
}
