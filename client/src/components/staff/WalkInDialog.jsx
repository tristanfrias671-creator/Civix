import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '../common/Icons';
import api from '../../utils/api';
import { copyText } from '../../utils/clipboard';
import { useAuth } from '../../context/AuthContext';
import { officeLabel } from '../../data/officeNames';
import { Req, RequiredNote } from '../common/RequiredMark';
import { serviceNames } from '../../data/charter';
import { CANTILAN_BARANGAY_OPTIONS } from '../../data/cantilanLocations';
import { STAFF_CHANNELS } from '../../data/channels';
import { markAlertsSeen } from '../common/alerts';
import { drawQr, qrSvg, QrImage, fmtDate, escapeHtml, printSlip } from './slipTools';

const dialogCss = `
@keyframes wiFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes wiPop { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 1; transform: none; } }
.wi-overlay { animation: wiFade .15s ease-out both; }
.wi-card { animation: wiPop .2s cubic-bezier(.22,1,.36,1) both; }
@media (prefers-reduced-motion: reduce) { .wi-overlay, .wi-card { animation: none; } }
`;

const FOCUS_RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800';
const INPUT = 'w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm dark:placeholder:!text-slate-400';
const LABEL = 'block text-sm font-medium text-gray-700 mb-1';
const HINT = 'text-xs text-gray-600 mt-1';

const TYPES = [
  { key: 'COMPLAINT', label: 'Complaint', hint: 'Something went wrong' },
  { key: 'SUGGESTION', label: 'Suggestion', hint: 'An idea to do better' },
];
const TYPE_WORD = { COMPLAINT: 'Complaint', SUGGESTION: 'Suggestion' };
const MIN_TEXT = 20;
const MAX_TEXT = 2000;

// Since Nov 17, 2026 no mobile number or email, like the citizen's form: the citizen
// follows the report with the slip.
const blankForm = (department, channel = 'WALK_IN') => ({
  channel, type: 'COMPLAINT', department, service: '', description: '', address: '',
});
const hasDraft = f => [f.service, f.description, f.address].some(v => v.trim());

const trackUrl = code => `${window.location.origin}/track?id=${encodeURIComponent(code)}`;
const trackAddress = () => `${window.location.host}/track`;

// The slip, in English and Bisaya, sized for a receipt printer like the New client
// slip (also fine on A4, where it can be cut out).
function slipHtml(slip, qr) {
  const service = slip.service ? `<p class="small"><b>About:</b> ${escapeHtml(slip.service)}</p>` : '';
  const target = slip.dueAt ? `<p class="small">Target resolution: <b>${escapeHtml(fmtDate(slip.dueAt))}</b></p>` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><title>CIVIX ${escapeHtml(slip.trackingId)}</title><style>
@page { margin: 6mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #000; }
.slip { width: 72mm; padding: 4mm 3mm; border: 1px dashed #777; text-align: center; }
p { margin: 0; }
.muni { font-size: 8.5pt; font-weight: bold; letter-spacing: .05em; text-transform: uppercase; }
.office { font-size: 10.5pt; font-weight: bold; margin-top: 1mm; }
.title { font-size: 14pt; font-weight: bold; margin-top: 3mm; }
.alt { font-size: 9.5pt; font-style: italic; }
.label { font-size: 8.5pt; margin-top: 3mm; }
.code { font-family: 'Courier New', monospace; font-size: 18pt; font-weight: bold; letter-spacing: .06em; margin-top: .5mm; }
.qr { display: block; width: 36mm; height: 36mm; margin: 3mm auto 2mm; }
.small { font-size: 8.5pt; line-height: 1.35; margin-top: 1.5mm; }
.foot { font-size: 8pt; margin-top: 3mm; padding-top: 2mm; border-top: 1px solid #bbb; }
</style></head><body><div class="slip">
<p class="muni">Municipality of Cantilan</p>
<p class="office">${escapeHtml(officeLabel(slip.department))}</p>
<p class="title">Report received</p>
<p class="alt">Nadawat ang imong report</p>
<p class="label">Transaction Code</p>
<p class="code">${escapeHtml(slip.trackingId)}</p>
<p class="small"><b>${escapeHtml(TYPE_WORD[slip.type] || 'Report')}</b> &middot; received ${escapeHtml(fmtDate(slip.createdAt))}</p>
${service}
${target}
<div class="qr">${qrSvg(qr)}</div>
<p class="small">To follow it, scan the QR code, or go to <b>${escapeHtml(trackAddress())}</b> and enter the code.</p>
<p class="small alt">Aron masubay, i-scan ang QR code, o adto sa ${escapeHtml(trackAddress())} ug isulod ang code.</p>
<p class="foot">Keep this slip. Thank you!<br><i>Itago kini nga slip. Salamat!</i></p>
</div></body></html>`;
}

// One choice of a set (how it came in, the type), as a tile with a radio button.
function Choice({ name, checked, onChange, label, hint, inputRef }) {
  return (
    <label className={`flex items-start gap-3 rounded-xl border px-3.5 py-2.5 cursor-pointer transition-colors ${checked ? 'border-blue-600 bg-blue-50' : 'border-gray-300 hover:bg-gray-50'}`}>
      <input ref={inputRef} type="radio" name={name} checked={checked} onChange={onChange}
        className="mt-0.5 h-4 w-4 flex-shrink-0 accent-blue-700 dark:[color-scheme:dark]" />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-gray-900">{label}</span>
        <span className="block text-xs text-gray-600">{hint}</span>
      </span>
    </label>
  );
}

// "Walk-in report" (staff portal): a complaint or suggestion a citizen gave in person,
// by phone, by letter or by message (Facebook, email), typed in by the staff member.
// It gets a Transaction Code and a deadline like a report sent online, and the citizen
// gets a slip with the code and a QR code that opens Track My Report. A report not
// saved yet stays in the window when it is closed, until it is saved.
export default function WalkInDialog({ open, onClose }) {
  const { user } = useAuth();
  const own = user?.department || '';
  const cardRef = useRef(null);
  const firstRef = useRef(null);
  const refs = {
    department: useRef(null), service: useRef(null), description: useRef(null), address: useRef(null),
  };
  const [form, setForm] = useState(() => blankForm(own));
  const [offices, setOffices] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null); // { text, field }
  const [slip, setSlip] = useState(null); // the saved report; `again` when it was saved before
  const [qr, setQr] = useState(null); // { size, path }, or 'failed'
  const latest = useRef({ form, slip });
  latest.current = { form, slip };

  // Each time it opens: a new report for the staff member's office (a report not
  // saved yet is kept), and the offices on the Settings list.
  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    if (latest.current.slip || !hasDraft(latest.current.form)) setForm(blankForm(own));
    setSlip(null);
    setError(null);
    api.get('/settings/public')
      .then(res => active && setOffices(res.data.departments || []))
      .catch(() => active && setOffices(own ? [own] : []));
    setTimeout(() => firstRef.current?.focus(), 0);
    return () => { active = false; };
  }, [open, own]);

  useEffect(() => {
    if (!slip) { setQr(null); return undefined; }
    let active = true;
    setQr(null);
    drawQr(trackUrl(slip.trackingId))
      .then(drawn => active && setQr(drawn))
      .catch(() => active && setQr('failed'));
    return () => { active = false; };
  }, [slip]);

  // Esc closes; the keyboard stays inside the window.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = e => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !cardRef.current) return;
      const items = [...cardRef.current.querySelectorAll('button:not([disabled]), input:not([type="radio"]), input[type="radio"]:checked, select, textarea')];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const set = (field, value) => {
    setForm(f => ({ ...f, [field]: value }));
    if (error?.field === field) setError(null);
  };

  function showError(text, field) {
    setError({ text, field });
    const target = refs[field]?.current;
    if (target) setTimeout(() => target.focus(), 0);
  }

  function saved(report, again) {
    setSlip({ ...report, again });
    if (again) return;
    // The staff member's own report doesn't pop up for them as a new one; the
    // sidebar counts and the list of reports show it at once.
    markAlertsSeen(['urgent', 'overdue', 'dueSoon', 'newReports'].map(kind => `${kind}:${report.id}`));
    window.dispatchEvent(new Event('civix:alerts-changed'));
    window.dispatchEvent(new Event('civix:report-added'));
  }

  async function save(e) {
    e.preventDefault();
    if (saving) return;
    const description = form.description.trim();
    if (!form.department) { showError('Please choose an office.', 'department'); return; }
    if (description.length < MIN_TEXT) {
      showError(`Please write what the citizen said in at least ${MIN_TEXT} characters.`, 'description');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await api.post('/staff/portal/reports', {
        channel: form.channel, type: form.type, department: form.department, description,
        service: form.service.trim(), address: form.address.trim(),
      });
      saved(res.data.report, false);
    } catch (err) {
      const data = err.response?.data;
      if (data?.code === 'DUPLICATE' && data.report) saved(data.report, true);
      else showError(data?.error || 'The report could not be saved. Please check your connection and try again.', data?.field);
    } finally {
      setSaving(false);
    }
  }

  function nextReport() {
    setSlip(null);
    setError(null);
    setForm(f => blankForm(own, f.channel));
    setTimeout(() => firstRef.current?.focus(), 0);
  }

  async function copyLink() {
    if (await copyText(trackUrl(slip.trackingId))) toast.success('Link copied. You can send it to the citizen.', { id: 'track-link' });
    else toast.error('Could not copy the link.', { id: 'track-link' });
  }

  if (!open) return null;
  const qrReady = qr && qr !== 'failed';
  const invalid = field => (error?.field === field ? ' ring-2 ring-red-500' : '');
  const officeServices = serviceNames(form.department);
  const textLength = form.description.trim().length;

  return (
    <div className="wi-overlay fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <style>{dialogCss}</style>
      <div ref={cardRef} role="dialog" aria-modal="true" aria-labelledby="walk-in-title"
        className="wi-card relative w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:ring-white/10"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-start gap-4 px-6 pt-6">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0">
            <Icon name="write" className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1 pr-8">
            <h2 id="walk-in-title" className="text-lg font-semibold text-gray-900 leading-7">Walk-in report</h2>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              For a complaint or suggestion a citizen gave in person, by phone, by letter or by message. It gets a
              Transaction Code and a deadline, the same as one sent online.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className={`absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors ${FOCUS_RING}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 pt-5 pb-6">
          {!slip ? (
            <form onSubmit={save} noValidate className="space-y-5">
              <RequiredNote className="-mb-1" />
              <fieldset>
                <legend className="text-sm font-semibold text-gray-800 mb-2">How did it come in?<Req /></legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {STAFF_CHANNELS.map(c => (
                    <Choice key={c.key} name="wi-channel" checked={form.channel === c.key} onChange={() => set('channel', c.key)}
                      label={c.label} hint={c.hint} inputRef={form.channel === c.key ? firstRef : undefined} />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-sm font-semibold text-gray-800 mb-2">Type<Req /></legend>
                <div className="grid grid-cols-2 gap-2">
                  {TYPES.map(t => (
                    <Choice key={t.key} name="wi-type" checked={form.type === t.key} onChange={() => set('type', t.key)}
                      label={t.label} hint={t.hint} />
                  ))}
                </div>
                <p className={HINT}>Feedback on a service is the satisfaction form: use New client instead.</p>
              </fieldset>

              <div>
                <label htmlFor="wi-office" className={LABEL}>Office<Req /></label>
                <select id="wi-office" ref={refs.department} value={form.department} onChange={e => set('department', e.target.value)}
                  aria-invalid={error?.field === 'department' || undefined}
                  className={`${INPUT}${invalid('department')}`}>
                  {!offices.includes(form.department) && <option value="">Choose an office...</option>}
                  {offices.map(name => <option key={name} value={name}>{officeLabel(name)}</option>)}
                </select>
                <p className={HINT}>
                  {form.department && form.department !== own
                    ? 'It goes to that office and leaves your list. Its staff get an email.'
                    : 'Your office, unless the report is for another one.'}
                </p>
              </div>

              <div>
                <label htmlFor="wi-service" className={LABEL}>
                  Service it is about <span className="font-normal text-gray-600">(optional)</span>
                </label>
                <input id="wi-service" ref={refs.service} value={form.service} maxLength={120} autoComplete="off"
                  list={officeServices.length ? 'wi-service-options' : undefined}
                  onChange={e => set('service', e.target.value)}
                  placeholder="e.g. Request for a birth certificate"
                  className={`${INPUT}${invalid('service')}`} />
                {officeServices.length > 0 && (
                  <datalist id="wi-service-options">
                    {officeServices.map(name => <option key={name} value={name} />)}
                  </datalist>
                )}
              </div>

              <div>
                <label htmlFor="wi-text" className={LABEL}>What the citizen said<Req /></label>
                <textarea id="wi-text" ref={refs.description} rows={5} maxLength={MAX_TEXT} value={form.description}
                  onChange={e => set('description', e.target.value)}
                  aria-invalid={error?.field === 'description' || undefined} aria-describedby="wi-text-hint"
                  className={`${INPUT} resize-y${invalid('description')}`} />
                <div className="flex justify-between gap-3">
                  <p id="wi-text-hint" className={HINT}>What happened, where and when, in the citizen's own words. At least {MIN_TEXT} characters.</p>
                  <p className={`${HINT} flex-shrink-0 tabular-nums`}>{textLength} / {MAX_TEXT}</p>
                </div>
              </div>

              <div>
                <label htmlFor="wi-where" className={LABEL}>
                  Where <span className="font-normal text-gray-600">(optional)</span>
                </label>
                <input id="wi-where" ref={refs.address} value={form.address} maxLength={191} autoComplete="off" list="wi-barangays"
                  onChange={e => set('address', e.target.value)}
                  placeholder="e.g. Purok 2, Barangay Lobo"
                  className={`${INPUT}${invalid('address')}`} />
                <datalist id="wi-barangays">
                  {CANTILAN_BARANGAY_OPTIONS.map(name => <option key={name} value={name} />)}
                </datalist>
              </div>

              <p className="text-xs text-gray-600 -mt-2">
                CIVIX does not ask for the citizen's mobile number or email. Give them the slip: they follow the report with
                its Transaction Code or QR code on Track My Report.
              </p>

              {error && <p role="alert" className="text-sm font-medium text-red-700">{error.text}</p>}
              <button type="submit" disabled={saving}
                className={`w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-blue-700 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 transition-colors disabled:opacity-60 ${FOCUS_RING}`}>
                <Icon name="write" className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save and make the slip'}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              {slip.again ? (
                <p role="status" className="rounded-lg bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900 dark:text-amber-200">
                  You typed in this report before, so it was not saved again. Here is its slip.
                </p>
              ) : (
                <p role="status" className="flex items-center gap-2 text-sm font-semibold text-green-700">
                  <Icon name="check" className="w-5 h-5 flex-shrink-0" /> Saved. Give the citizen this slip.
                </p>
              )}

              {/* The slip as it prints: always white paper, in light and dark mode */}
              <div data-walk-in-slip={slip.trackingId} className="mx-auto w-full max-w-[300px] rounded-xl border border-dashed px-4 py-4 text-center"
                style={{ background: '#ffffff', color: '#111827', borderColor: '#9ca3af' }}>
                <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#374151' }}>Municipality of Cantilan</p>
                <p className="text-sm font-bold mt-0.5">{officeLabel(slip.department)}</p>
                <p className="text-lg font-bold mt-2">Report received</p>
                <p className="text-xs mt-2" style={{ color: '#374151' }}>Transaction Code</p>
                <p className="font-mono text-2xl font-bold tracking-wider select-all">{slip.trackingId}</p>
                <p className="text-xs mt-1" style={{ color: '#374151' }}>
                  <strong>{TYPE_WORD[slip.type] || 'Report'}</strong> · received {fmtDate(slip.createdAt)}
                </p>
                {slip.service && <p className="text-xs mt-1" style={{ color: '#374151' }}><strong>About:</strong> {slip.service}</p>}
                {slip.dueAt && (
                  <p className="text-xs mt-1" style={{ color: '#374151' }}>Target resolution: <strong>{fmtDate(slip.dueAt)}</strong></p>
                )}
                <div className="mx-auto my-2 w-40 h-40 flex items-center justify-center">
                  <QrImage qr={qr} label={`QR code that opens ${trackUrl(slip.trackingId)}`}
                    failedText="The QR code could not be drawn. The citizen can type the code." />
                </div>
                <p className="text-xs" style={{ color: '#374151' }}>To follow it, scan the QR code or go to <strong>{trackAddress()}</strong>.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button type="button" onClick={() => printSlip(slipHtml(slip, qr))} disabled={!qrReady}
                  className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-700 text-sm font-semibold text-white hover:bg-blue-800 transition-colors disabled:opacity-60 ${FOCUS_RING}`}>
                  <Icon name="printer" className="w-4 h-4" /> Print slip
                </button>
                <button type="button" onClick={copyLink}
                  className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors ${FOCUS_RING}`}>
                  Copy link
                </button>
                <button type="button" onClick={nextReport}
                  className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors ${FOCUS_RING}`}>
                  Next report
                </button>
              </div>
              <p className="text-xs text-gray-600 text-center">
                No printer? Write the code on paper for the citizen, or let them take a photo of the slip.
                For a phone call or a message, read or send them the code.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
