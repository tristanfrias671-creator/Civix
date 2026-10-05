const crypto = require('crypto');
const { networkKey } = require('./clientIp');
const { createLimiter } = require('./rateLimit');

// Bot checks for the public report form.
//
// 1. Form ticket. The page asks for one when the report form opens
//    (GET /api/submissions/form-ticket) and sends it back in the X-Form-Ticket
//    header. A ticket is signed by the server, is only accepted once it is
//    MIN_AGE old (no person fills in the form faster) and until MAX_AGE, and sends
//    one report. Bots that post straight to the API have none; bots that fetch
//    one must wait, and each ticket gives them a single report.
// 2. Cloudflare Turnstile ("I'm not a robot", usually invisible). Only when
//    TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY are set; the page then sends the
//    widget's token in the X-Turnstile-Token header.
//
// Both are checked before multer saves any photos.

const MIN_AGE_MS = 3000;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const usedTickets = new Map(); // ticket nonce -> time it stops mattering (its expiry)
let lastSweep = 0;

const secret = () => process.env.JWT_SECRET || 'civix-local-dev';
const sign = payload => crypto.createHmac('sha256', secret()).update(`form-ticket:${payload}`).digest('base64url');

function issueTicket(now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ t: now, n: crypto.randomBytes(12).toString('base64url') })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function sweepUsed(now) {
  if (now - lastSweep < 60 * 1000) return;
  for (const [nonce, expiry] of usedTickets) if (expiry <= now) usedTickets.delete(nonce);
  lastSweep = now;
}

// Claims a ticket for one report. Returns { ok: true, release } (call release() if
// the report is then refused, so the same ticket works when the person fixes it
// and sends again), or { ok: false, reason, wait } with wait in ms for 'too-fast'.
function claimTicket(ticket, now = Date.now()) {
  const [payload, mac, extra] = String(ticket || '').split('.');
  if (!payload || !mac || extra !== undefined) return { ok: false, reason: ticket ? 'invalid' : 'missing' };
  const expected = sign(payload);
  if (mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) {
    return { ok: false, reason: 'invalid' };
  }
  let data;
  try { data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { return { ok: false, reason: 'invalid' }; }
  if (typeof data?.t !== 'number' || typeof data?.n !== 'string') return { ok: false, reason: 'invalid' };
  const age = now - data.t;
  if (age < MIN_AGE_MS) return { ok: false, reason: 'too-fast', wait: MIN_AGE_MS - age };
  if (age > MAX_AGE_MS) return { ok: false, reason: 'expired' };
  sweepUsed(now);
  if (usedTickets.has(data.n)) return { ok: false, reason: 'used' };
  usedTickets.set(data.n, data.t + MAX_AGE_MS);
  return { ok: true, release: () => usedTickets.delete(data.n) };
}

const turnstileEnabled = () => Boolean(process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY);

// When the check can't even load in the person's browser (some networks block it),
// the page says "unavailable"; and the server sometimes can't ask Cloudflare (an
// outage, or a mistyped secret key in hPanel). Those reports are still accepted,
// but only a few per hour from one network and REPORTS_WITHOUT_CHECK_PER_HOUR from
// everyone together, so nobody is locked out and bots gain little from it.
const HOUR_MS = 60 * 60 * 1000;
const withoutCheck = createLimiter({ windowMs: HOUR_MS, max: 3 });
const withoutCheckSite = createLimiter({ windowMs: HOUR_MS, max: Number(process.env.REPORTS_WITHOUT_CHECK_PER_HOUR) || 30 });

// `network` is null when the visitor's network isn't known (see networkKey); then
// only the site-wide allowance applies.
function mayGoWithoutCheck(network) {
  if (network != null && !withoutCheck.take(network).ok) return false;
  if (withoutCheckSite.take('all').ok) return true;
  if (network != null) withoutCheck.give(network);
  return false;
}

// Cloudflare's answers that mean "we couldn't check" rather than "this isn't a person".
const CHECK_PROBLEMS = ['missing-input-secret', 'invalid-input-secret', 'bad-request', 'internal-error'];

// The "I'm not a robot" result: 'pass', 'failed' (no token, or Cloudflare says the
// token isn't from a person) or 'busy' (it couldn't be checked, and the few
// reports allowed without a check are used up).
async function botCheck(token, network) {
  if (!turnstileEnabled()) return 'pass';
  if (!token) return 'failed';
  const withoutIt = () => (mayGoWithoutCheck(network) ? 'pass' : 'busy');
  if (token === 'unavailable') return withoutIt();
  try {
    const form = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY, response: String(token).slice(0, 2048) });
    if (network) form.set('remoteip', network);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json().catch(() => null);
    if (data?.success === true) return 'pass';
    const codes = data?.['error-codes'] || [];
    // A mistyped key answers HTTP 400 "invalid-input-secret"; a bad token answers
    // "invalid-input-response" (a refusal, not a problem on our side).
    if (!data || res.status >= 500 || codes.some(code => CHECK_PROBLEMS.includes(code))) {
      throw new Error(`Cloudflare answered HTTP ${res.status}${codes.length ? ` (${codes.join(', ')})` : ''}`);
    }
    return 'failed';
  } catch (err) {
    console.error('[turnstile] Could not check a token; treating it as unavailable:', err.message);
    return withoutIt();
  }
}

const TICKET_MESSAGES = {
  missing: 'Please reload the page and send your report again.',
  invalid: 'Please reload the page and send your report again.',
  expired: 'This form was open for a long time. Please reload the page and send your report again.',
  used: 'This report was already sent. Please reload the page to send another.',
  'too-fast': 'Please take a moment to check your report, then send it again.',
};

// Express middleware for POST /api/submissions, before the photos are saved.
// Sets req.releaseFormTicket for the controller to call if it refuses the report.
async function guardReportForm(req, res, next) {
  const claim = claimTicket(req.get('X-Form-Ticket'));
  if (!claim.ok) {
    return res.status(400).json({ error: TICKET_MESSAGES[claim.reason], code: 'FORM_TICKET', reason: claim.reason, wait: claim.wait || 0 });
  }
  const token = req.get('X-Turnstile-Token');
  const result = await botCheck(token, networkKey(req));
  if (result !== 'pass') {
    claim.release();
    let error = "Please complete the \"I'm not a robot\" check, then send your report again.";
    if (result === 'busy') {
      error = token === 'unavailable'
        ? "The \"I'm not a robot\" check could not load on your connection. Please try again in a while, or from another connection (for example, mobile data instead of Wi-Fi)."
        : "The \"I'm not a robot\" check is not working right now. Please try again in a few minutes.";
    }
    return res.status(400).json({ error, code: 'BOT_CHECK' });
  }
  req.releaseFormTicket = claim.release;
  next();
}

module.exports = { issueTicket, claimTicket, guardReportForm, turnstileEnabled, MIN_AGE_MS };
