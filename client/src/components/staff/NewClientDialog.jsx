import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '../common/Icons';
import api from '../../utils/api';
import { copyText } from '../../utils/clipboard';
import { officeLabel } from '../../data/officeNames';
import { serviceNames } from '../../data/charter';
import { drawQr, qrSvg, QrImage, fmtDate, escapeHtml, printSlip } from './slipTools';

const dialogCss = `
@keyframes ncFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes ncPop { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 1; transform: none; } }
.nc-overlay { animation: ncFade .15s ease-out both; }
.nc-card { animation: ncPop .2s cubic-bezier(.22,1,.36,1) both; }
@media (prefers-reduced-motion: reduce) { .nc-overlay, .nc-card { animation: none; } }
`;

const FOCUS_RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800';

const rateUrl = code => `${window.location.origin}/rate/${encodeURIComponent(code)}`;
const rateAddress = () => `${window.location.host}/rate`;
const fmtTime = d => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

// The slip, in English and Bisaya, sized for a receipt printer (also fine on A4,
// where it can be cut out).
function slipHtml(slip, qr) {
  const service = slip.service ? `<p class="small"><b>Service:</b> ${escapeHtml(slip.service)}</p>` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><title>CIVIX ${escapeHtml(slip.code)}</title><style>
@page { margin: 6mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #000; }
.slip { width: 72mm; padding: 4mm 3mm; border: 1px dashed #777; text-align: center; }
p { margin: 0; }
.muni { font-size: 8.5pt; font-weight: bold; letter-spacing: .05em; text-transform: uppercase; }
.office { font-size: 10.5pt; font-weight: bold; margin-top: 1mm; }
.title { font-size: 14pt; font-weight: bold; margin-top: 3mm; }
.alt { font-size: 9.5pt; font-style: italic; }
.qr { display: block; width: 40mm; height: 40mm; margin: 3mm auto 2mm; }
.small { font-size: 8.5pt; line-height: 1.35; margin-top: 1.5mm; }
.code { font-family: 'Courier New', monospace; font-size: 18pt; font-weight: bold; letter-spacing: .06em; margin-top: 1mm; }
.foot { font-size: 8pt; margin-top: 3mm; padding-top: 2mm; border-top: 1px solid #bbb; }
</style></head><body><div class="slip">
<p class="muni">Municipality of Cantilan</p>
<p class="office">${escapeHtml(officeLabel(slip.department))}</p>
<p class="title">Rate our service</p>
<p class="alt">I-rate ang among serbisyo</p>
<div class="qr">${qrSvg(qr)}</div>
<p class="small">Scan the QR code, or go to <b>${escapeHtml(rateAddress())}</b> and enter this code:</p>
<p class="small alt">I-scan ang QR code, o adto sa ${escapeHtml(rateAddress())} ug isulod kini nga code:</p>
<p class="code">${escapeHtml(slip.code)}</p>
${service}
<p class="small">Valid until ${escapeHtml(fmtDate(slip.expiresAt))} &middot; one use only</p>
<p class="foot">Your answers are anonymous. Thank you!<br><i>Dili mahibaloan kon kinsa ka. Salamat!</i></p>
</div></body></html>`;
}

function codeState(c) {
  if (c.used) return { label: 'Used', className: 'bg-green-100 text-green-700' };
  if (new Date(c.expiresAt) <= new Date()) return { label: 'Expired', className: 'bg-gray-100 text-gray-700' };
  return { label: 'Not used yet', className: 'bg-blue-50 text-blue-700' };
}

// "New client" (staff portal): a queuing code for a client the office just served,
// printed on a slip with a QR code that opens the satisfaction form (ARTA CSM) at
// /rate/<code>. Each code rates once, for 7 days. Below: the office's codes from
// those days and whether each was used — never what the client answered.
export default function NewClientDialog({ open, onClose }) {
  const cardRef = useRef(null);
  const serviceRef = useRef(null);
  const [service, setService] = useState('');
  const [making, setMaking] = useState(false);
  const [error, setError] = useState('');
  const [slip, setSlip] = useState(null);
  const [qr, setQr] = useState(null); // { size, path }, or 'failed'
  const [codes, setCodes] = useState(null);
  const [days, setDays] = useState(7);
  // The office's services in the Citizen's Charter, suggested in the service box.
  const [officeServices, setOfficeServices] = useState([]);

  // Each time it opens: an empty form and the office's recent codes.
  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setService('');
    setError('');
    setSlip(null);
    setCodes(null);
    api.get('/staff/portal/queue-codes')
      .then(res => {
        if (!active) return;
        setCodes(res.data.codes || []);
        setDays(res.data.days || 7);
        setOfficeServices(serviceNames(res.data.department));
      })
      .catch(() => active && setCodes([]));
    return () => { active = false; };
  }, [open]);

  useEffect(() => {
    if (!slip) { setQr(null); return undefined; }
    let active = true;
    setQr(null);
    drawQr(rateUrl(slip.code))
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
      const items = [...cardRef.current.querySelectorAll('button:not([disabled]), input, a[href]')];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  async function makeCode(e) {
    e.preventDefault();
    if (making) return;
    setMaking(true);
    setError('');
    try {
      const res = await api.post('/staff/portal/queue-codes', { service: service.trim() });
      setSlip(res.data);
      setCodes(list => [res.data, ...(list || [])]);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not make a code. Please check your connection and try again.');
    } finally {
      setMaking(false);
    }
  }

  function nextClient() {
    setSlip(null);
    setService('');
    setTimeout(() => serviceRef.current?.focus(), 0);
  }

  async function copyLink() {
    if (await copyText(rateUrl(slip.code))) toast.success('Link copied. You can send it to the client.', { id: 'rate-link' });
    else toast.error('Could not copy the link.', { id: 'rate-link' });
  }

  if (!open) return null;
  const qrReady = qr && qr !== 'failed';

  return (
    <div className="nc-overlay fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <style>{dialogCss}</style>
      <div ref={cardRef} role="dialog" aria-modal="true" aria-labelledby="new-client-title"
        className="nc-card relative w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:ring-white/10"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-start gap-4 px-6 pt-6">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0">
            <Icon name="qr" className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1 pr-8">
            <h2 id="new-client-title" className="text-lg font-semibold text-gray-900 leading-7">New client</h2>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              After serving a client, give them a slip. They scan the QR code (or type the code) to answer the
              satisfaction form (ARTA CSM). Each code works once, for {days} days. You never see who answered.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className={`absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors ${FOCUS_RING}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 pt-5 pb-6 space-y-5">
          {!slip ? (
            <form onSubmit={makeCode} className="space-y-3">
              <div>
                <label htmlFor="nc-service" className="block text-sm font-medium text-gray-700 mb-1">
                  Service availed <span className="font-normal text-gray-600">(optional)</span>
                </label>
                <input id="nc-service" ref={serviceRef} autoFocus value={service} maxLength={120} autoComplete="off"
                  list={officeServices.length ? 'nc-service-options' : undefined}
                  onChange={e => setService(e.target.value)}
                  placeholder="e.g. Request for a birth certificate"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                {officeServices.length > 0 && (
                  <datalist id="nc-service-options">
                    {officeServices.map(name => <option key={name} value={name} />)}
                  </datalist>
                )}
                <p className="text-xs text-gray-600 mt-1">
                  Printed on the slip and shown on the form, so the client doesn't have to type it.
                  {officeServices.length > 0 && " Pick one of your office's services in the Citizen's Charter, or type another."}
                </p>
              </div>
              {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
              <button type="submit" disabled={making}
                className={`w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-blue-700 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 transition-colors disabled:opacity-60 ${FOCUS_RING}`}>
                <Icon name="qr" className="w-4 h-4" />
                {making ? 'Making the code...' : 'Make a code for this client'}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              {/* The slip as it prints: always white paper, in light and dark mode */}
              <div data-slip={slip.code} className="mx-auto w-full max-w-[300px] rounded-xl border border-dashed px-4 py-4 text-center"
                style={{ background: '#ffffff', color: '#111827', borderColor: '#9ca3af' }}>
                <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#374151' }}>Municipality of Cantilan</p>
                <p className="text-sm font-bold mt-0.5">{officeLabel(slip.department)}</p>
                <p className="text-lg font-bold mt-2">Rate our service</p>
                <div className="mx-auto my-2 w-40 h-40 flex items-center justify-center">
                  <QrImage qr={qr} label={`QR code that opens ${rateUrl(slip.code)}`}
                    failedText="The QR code could not be drawn. The client can type the code below." />
                </div>
                <p className="text-xs" style={{ color: '#374151' }}>Or go to <strong>{rateAddress()}</strong> and enter:</p>
                <p className="font-mono text-2xl font-bold tracking-wider mt-1 select-all">{slip.code}</p>
                {slip.service && <p className="text-xs mt-1" style={{ color: '#374151' }}><strong>Service:</strong> {slip.service}</p>}
                <p className="text-xs mt-1" style={{ color: '#374151' }}>Valid until {fmtDate(slip.expiresAt)} · one use only</p>
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
                <button type="button" onClick={nextClient}
                  className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors ${FOCUS_RING}`}>
                  Next client
                </button>
              </div>
              <p className="text-xs text-gray-600 text-center">No printer? Let the client scan the QR code on this screen, or write the code on paper.</p>
            </div>
          )}

          {/* The office's recent codes: used or not, never the answers */}
          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-semibold text-gray-800">Your office's codes, last {days} days</h3>
            {codes === null ? (
              <p className="text-sm text-gray-600 mt-2">Loading...</p>
            ) : codes.length === 0 ? (
              <p className="text-sm text-gray-600 mt-2">No codes yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-gray-100 max-h-56 overflow-y-auto">
                {codes.map(c => {
                  const state = codeState(c);
                  const reprintable = state.label === 'Not used yet' && c.code !== slip?.code;
                  return (
                    <li key={c.id} className="flex items-center gap-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-sm font-semibold text-gray-900">{c.code}</p>
                        <p className="text-xs text-gray-600 truncate">
                          {fmtTime(c.createdAt)}{c.service ? ` · ${c.service}` : ''}{c.createdByName ? ` · ${c.createdByName}` : ''}
                        </p>
                      </div>
                      <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${state.className}`}>{state.label}</span>
                      {reprintable && (
                        <button type="button" onClick={() => setSlip(c)}
                          className={`flex-shrink-0 text-xs font-semibold text-blue-700 underline underline-offset-2 rounded ${FOCUS_RING}`}>
                          Show slip
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
