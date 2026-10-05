// Text-message (SMS) updates to citizens. Two ways to send, whichever has its
// settings filled in:
//   - TextBee (textbee.dev): an Android phone with the TextBee app sends the texts
//     from its own SIM. Needs TEXTBEE_API_KEY and TEXTBEE_DEVICE_ID.
//   - Semaphore (semaphore.co): a paid Philippine SMS gateway. Needs SEMAPHORE_API_KEY
//     (and optionally an approved SMS_SENDER_NAME).
// With neither, SMS is skipped quietly, the same way email is skipped without its settings.
const { TEXTBEE_API_KEY, TEXTBEE_DEVICE_ID, SEMAPHORE_API_KEY, SMS_SENDER_NAME } = process.env;

const provider = TEXTBEE_API_KEY && TEXTBEE_DEVICE_ID ? 'textbee'
  : SEMAPHORE_API_KEY ? 'semaphore'
  : null;
const configured = Boolean(provider);
// A text that the provider hasn't accepted within this time is given up (and logged).
const SEND_TIMEOUT_MS = 15000;

console.log(provider
  ? `[sms] Sending SMS updates through ${provider === 'textbee' ? 'TextBee (Android phone)' : 'Semaphore'}.`
  : '[sms] No SMS provider configured (TEXTBEE_API_KEY + TEXTBEE_DEVICE_ID, or SEMAPHORE_API_KEY) — SMS updates will be skipped.');

const STATUS_TEXT = {
  REVIEWING:   { label: 'Under Review', copy: 'The office is reviewing it.' },
  IN_PROGRESS: { label: 'In Progress',  copy: 'The office has started working on it.' },
  RESOLVED:    { label: 'Resolved',     copy: 'Thank you for helping improve Cantilan!' },
};

// "0917 123 4567", "+63 917 123 4567", "639171234567" -> "09171234567";
// null when it isn't a Philippine mobile number.
function normalizePhMobile(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (/^09\d{9}$/.test(digits)) return digits;
  if (/^639\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
  if (/^9\d{9}$/.test(digits)) return `0${digits}`;
  return null;
}

function sendViaTextBee(to, message) {
  return fetch(`https://api.textbee.dev/api/v1/gateway/devices/${encodeURIComponent(TEXTBEE_DEVICE_ID)}/send-sms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': TEXTBEE_API_KEY },
    body: JSON.stringify({ recipients: [`+63${to.slice(1)}`], message }),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
}

function sendViaSemaphore(to, message) {
  const body = new URLSearchParams({ apikey: SEMAPHORE_API_KEY, number: to, message });
  if (SMS_SENDER_NAME) body.set('sendername', SMS_SENDER_NAME);
  return fetch('https://api.semaphore.co/api/v4/messages', { method: 'POST', body, signal: AbortSignal.timeout(SEND_TIMEOUT_MS) });
}

async function sendSms(number, message) {
  const to = normalizePhMobile(number);
  if (!configured || !to) return;
  try {
    const res = await (provider === 'textbee' ? sendViaTextBee(to, message) : sendViaSemaphore(to, message));
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  } catch (err) {
    console.error(`[sms] Failed to send SMS via ${provider}:`, err.message);
  }
}

// Each text stays within one SMS (160 characters). No links: Philippine networks
// block texts containing URLs (anti-scam rules), so the site is named in words instead.
function sendReportReceivedSms(submission) {
  const target = submission.dueAt
    ? ` Target resolution: ${new Date(submission.dueAt).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' })}.`
    : '';
  return sendSms(submission.contactNumber,
    `CIVIX: We received your report. Tracking code: ${submission.trackingId}.${target} Check its status on the CIVIX website (Track My Report).`);
}

function sendStatusUpdateSms(submission, status) {
  const s = STATUS_TEXT[status];
  if (!s) return Promise.resolve();
  return sendSms(submission.contactNumber,
    `CIVIX: Report ${submission.trackingId} is now ${s.label}. ${s.copy} See details on the CIVIX website.`);
}

module.exports = { configured, provider, normalizePhMobile, sendSms, sendReportReceivedSms, sendStatusUpdateSms };
