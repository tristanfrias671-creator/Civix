const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const { ensureSettings } = require('../controllers/settings');

const { EMAIL_USER, EMAIL_APP_PASSWORD, EMAIL_HOST, EMAIL_PORT, RESEND_API_KEY, RESEND_FROM_EMAIL, CLIENT_URL } = process.env;

// Prefer Resend (HTTP API, works on hosts that block outbound SMTP like Render's free tier).
// Otherwise SMTP: the mail server in EMAIL_HOST (e.g. smtp.hostinger.com for the
// domain mailbox), or Gmail when no host is set (local dev). Skips silently if
// nothing is configured.
const useResend = Boolean(RESEND_API_KEY && RESEND_FROM_EMAIL);
const useSmtp = !useResend && Boolean(EMAIL_USER && EMAIL_APP_PASSWORD);
const configured = useResend || useSmtp;

let resendClient = null;
let transporter = null;

if (useResend) {
  resendClient = new Resend(RESEND_API_KEY);
} else if (useSmtp) {
  const auth = { user: EMAIL_USER, pass: EMAIL_APP_PASSWORD };
  const port = Number(EMAIL_PORT) || 465;
  transporter = nodemailer.createTransport(EMAIL_HOST
    ? { host: EMAIL_HOST, port, secure: port === 465, auth }
    : { service: 'gmail', auth });
} else {
  console.warn('[mailer] No email provider configured (RESEND_API_KEY or EMAIL_USER/EMAIL_APP_PASSWORD) — status update emails will be skipped.');
}

// Links and images in emails must be absolute URLs.
const SITE_URL = (CLIENT_URL || 'http://localhost:3000').replace(/\/+$/, '');
const SITE_LABEL = SITE_URL.replace(/^https?:\/\//, '');

const BRAND = '#2563eb';
const NAVY = '#0b2f66';
const INK = '#0f172a';
const FONT = "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const MONO = "Consolas, 'Courier New', monospace";
const TONES = {
  blue:   { fg: '#2563eb', bg: '#dbeafe' },
  green:  { fg: '#16a34a', bg: '#dcfce7' },
  amber:  { fg: '#d97706', bg: '#fef3c7' },
  violet: { fg: '#7c3aed', bg: '#ede9fe' },
  red:    { fg: '#dc2626', bg: '#fee2e2' },
};

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// The seal in the email header: the one uploaded in Settings > Branding, or the
// bundled small copy (client/public/email).
async function sealImageUrl() {
  try {
    const { sealUrl } = await ensureSettings();
    if (/^https?:\/\//.test(sealUrl || '')) return sealUrl;
    if (sealUrl && sealUrl.startsWith('/')) return `${SITE_URL}${sealUrl}`;
  } catch (err) {
    console.warn('[mailer] Could not read the branding seal, using the default:', err.message);
  }
  return `${SITE_URL}/email/cantilan-seal.png`;
}

// ── Email building blocks (tables and inline styles, so they hold up in Gmail,
//    Outlook and phone mail apps) ──

function layout({ seal, preheader, icon, tone = 'blue', title, intro, body }) {
  const t = TONES[tone] || TONES.blue;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0; padding:0; background:#eef2f7;">
<div style="display:none; font-size:1px; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden; mso-hide:all;">${escapeHtml(preheader || '')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#eef2f7" style="background:#eef2f7;">
<tr><td align="center" style="padding:28px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; background:#ffffff; border:1px solid #dbe3ee; border-radius:16px;">
    <tr><td bgcolor="${NAVY}" style="background-color:${NAVY}; background-image:linear-gradient(120deg, ${NAVY} 0%, #1d4ed8 65%, #0d9488 100%); border-radius:15px 15px 0 0; padding:22px 28px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td valign="middle" style="padding-right:14px;">
          <img src="${seal}" width="60" height="60" alt="Municipality of Cantilan seal" style="display:block; width:60px; height:60px; border:0; border-radius:50%; background:#ffffff;">
        </td>
        <td valign="middle" style="font-family:${FONT};">
          <div style="font-size:11px; font-weight:700; letter-spacing:1.6px; text-transform:uppercase; color:#bfdbfe;">Municipality of Cantilan</div>
          <div style="font-size:24px; font-weight:800; letter-spacing:1px; line-height:1.25; color:#ffffff;">CIVIX</div>
          <div style="font-size:12px; color:#dbeafe;">Citizen Complaint &amp; Feedback Management System</div>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:28px 28px 4px; font-family:${FONT};">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td valign="top" style="padding-right:14px;">
          <!--text:skip--><div style="width:44px; height:44px; line-height:44px; border-radius:50%; background:${t.bg}; color:${t.fg}; font-size:22px; font-weight:700; text-align:center;">${icon}</div><!--/text:skip-->
        </td>
        <td valign="middle">
          <h1 style="margin:0; font-size:21px; line-height:1.3; font-weight:800; color:${INK};">${escapeHtml(title)}</h1>
          ${intro ? `<p style="margin:4px 0 0; font-size:15px; line-height:1.5; color:#475569;">${intro}</p>` : ''}
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:18px 28px 26px; font-family:${FONT}; font-size:15px; line-height:1.6; color:#334155;">
      ${body}
    </td></tr>
    <tr><td align="center" bgcolor="#ffffff" style="background:#ffffff; border-top:1px solid #e2e8f0; border-radius:0 0 15px 15px; padding:18px 28px 22px; font-family:${FONT};">
      <img src="${SITE_URL}/email/civix-logo.png" width="158" height="61" alt="CIVIX - Real-Time Civic Engagement" style="display:block; width:158px; height:61px; border:0; margin:0 auto;">
      <p style="margin:12px 0 0; font-size:12px; color:#64748b;">Municipality of Cantilan, Surigao del Sur, Philippines</p>
      <p style="margin:4px 0 0; font-size:12px;"><a href="${SITE_URL}" style="color:${BRAND}; font-weight:600; text-decoration:none;">${SITE_LABEL}</a></p>
      <p style="margin:12px 0 0; font-size:11px; line-height:1.5; color:#94a3b8;">This is an automated message from CIVIX. Please do not reply to this email.</p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

function paragraph(html) {
  return `<p style="margin:0 0 16px;">${html}</p>`;
}

function strong(text) {
  return `<strong style="color:${INK};">${text}</strong>`;
}

function trackingBox(trackingId, caption) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;"><tr>
    <td align="center" bgcolor="#eff6ff" style="background:#eff6ff; border:1px dashed #93c5fd; border-radius:12px; padding:16px;">
      <div style="font-size:11px; font-weight:700; letter-spacing:1.4px; text-transform:uppercase; color:#1d4ed8;">Tracking ID</div>
      <div style="margin-top:4px; font-family:${MONO}; font-size:20px; font-weight:700; letter-spacing:1px; white-space:nowrap; color:${INK};">${escapeHtml(trackingId)}</div>
      ${caption ? `<div style="margin-top:4px; font-size:12px; color:#475569;">${caption}</div>` : ''}
    </td></tr></table>`;
}

// Label/value rows like a receipt. Falsy rows are skipped.
function detailRows(rows) {
  const items = rows.filter(Boolean);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px; border:1px solid #e2e8f0; border-radius:12px;">
    ${items.map(([label, value], i) => `<tr><td style="padding:11px 16px;${i < items.length - 1 ? ' border-bottom:1px solid #e2e8f0;' : ''}">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td valign="top" style="width:40%; font-size:13px; color:#64748b;">${label}</td>
        <td valign="top" align="right" style="font-size:14px; font-weight:600; color:${INK};">${value}</td>
      </tr></table>
    </td></tr>`).join('')}
  </table>`;
}

function pill(text, tone) {
  const t = TONES[tone] || TONES.blue;
  return `<span style="display:inline-block; padding:3px 10px; border-radius:999px; background:${t.bg}; color:${t.fg}; font-size:12px; font-weight:700;">${text}</span>`;
}

function quote(label, text) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;"><tr>
    <td bgcolor="#f8fafc" style="background:#f8fafc; border-left:4px solid #cbd5e1; border-radius:0 10px 10px 0; padding:12px 16px;">
      <div style="font-size:11px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#64748b;">${label}</div>
      <div style="margin-top:4px; font-size:14px; line-height:1.55; font-style:italic; color:#334155;">&ldquo;${text}&rdquo;</div>
    </td></tr></table>`;
}

function noteBlock(heading, note) {
  if (!note) return '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;"><tr>
    <td bgcolor="#eff6ff" style="background:#eff6ff; border-left:4px solid ${BRAND}; border-radius:0 10px 10px 0; padding:12px 16px;">
      <div style="font-size:11px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#1d4ed8;">${heading}</div>
      <div style="margin-top:4px; font-size:15px; line-height:1.55; color:#1e293b;">${escapeHtml(note).replace(/\n/g, '<br>')}</div>
    </td></tr></table>`;
}

function button(href, label) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 18px;"><tr>
    <td bgcolor="${BRAND}" style="background:${BRAND}; border-radius:10px;">
      <a href="${href}" target="_blank" style="display:inline-block; padding:13px 28px; font-family:${FONT}; font-size:15px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:10px;">${label}</a>
    </td></tr></table>`;
}

function small(html) {
  return `<p style="margin:0 0 12px; font-size:13px; line-height:1.55; color:#64748b;">${html}</p>`;
}

const STEPS = [['PENDING', 'Received'], ['REVIEWING', 'Under review'], ['IN_PROGRESS', 'In progress'], ['RESOLVED', 'Resolved']];

// Four steps with the finished ones ticked and the current one highlighted.
function progressTracker(status) {
  const current = Math.max(0, STEPS.findIndex(([s]) => s === status));
  const cells = STEPS.map(([, label], i) => {
    const reached = i <= current;
    const isCurrent = i === current && status !== 'RESOLVED';
    const circle = !reached
      ? 'width:28px; height:28px; line-height:28px; background:#ffffff; color:#94a3b8; border:2px solid #cbd5e1;'
      : `width:32px; height:32px; line-height:32px; background:${isCurrent ? BRAND : TONES.green.fg}; color:#ffffff;`;
    return `<td align="center" valign="top" width="25%" style="padding:0 2px;">
      <div style="${circle} margin:0 auto; border-radius:50%; font-size:14px; font-weight:700; text-align:center;">${reached && !isCurrent ? '&#10003;' : i + 1}</div>
      <div style="margin-top:6px; font-size:12px; line-height:1.3; font-weight:${isCurrent ? 700 : 500}; color:${reached ? INK : '#94a3b8'};">${label}</div>
    </td>`;
  }).join('');
  // Left out of the plain-text copy; the details below state the status.
  return `<!--text:skip--><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px;"><tr><td style="padding:16px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table>
  </td></tr></table><!--/text:skip-->`;
}

// A plain-text copy of the email; mail providers trust messages that include one.
function toPlainText(html) {
  return html
    .replace(/<head[\s\S]*?<\/head>/i, '')
    .replace(/<!--text:skip-->[\s\S]*?<!--\/text:skip-->/g, '')
    .replace(/<div style="display:none[\s\S]*?<\/div>/i, '')
    .replace(/\s+/g, ' ')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (m, href, text) => {
      const label = text.replace(/<[^>]+>/g, '').trim();
      return label && label !== href ? `${label} (${href})` : href;
    })
    // Detail rows read "Label: value".
    .replace(/<\/td>\s*<td[^>]*align="right"[^>]*>/gi, ': ')
    .replace(/<(br|\/p|\/div|\/tr|\/h1)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (m, code) => String.fromCodePoint(Number(code)))
    .replace(/&ldquo;|&rdquo;|&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function sendMail({ to, subject, html }) {
  if (!configured || !to) return;
  const text = toPlainText(html);
  try {
    if (useResend) {
      const { error } = await resendClient.emails.send({
        from: `CIVIX - Cantilan <${RESEND_FROM_EMAIL}>`, to, subject, html, text,
      });
      if (error) throw new Error(error.message || JSON.stringify(error));
    } else {
      await transporter.sendMail({ from: `"CIVIX - Cantilan" <${EMAIL_USER}>`, to, subject, html, text });
    }
  } catch (err) {
    console.error('[mailer] Failed to send email:', err.message);
  }
}

// Builds then sends; never throws, since callers don't wait for emails.
async function deliver(build) {
  try {
    await sendMail(await build);
  } catch (err) {
    console.error('[mailer] Failed to build email:', err.message);
  }
}

// ── The emails ──

const TYPE_LABELS = { COMPLAINT: 'Complaint', SUGGESTION: 'Suggestion', FEEDBACK: 'Feedback' };

const RECEIVED_COPY = {
  COMPLAINT:  { title: 'We received your complaint', intro: 'Thank you for reporting this to the Municipality of Cantilan.' },
  SUGGESTION: { title: 'Thank you for your suggestion', intro: 'We appreciate your idea for improving our community.' },
  FEEDBACK:   { title: 'Thank you for your feedback', intro: 'Your feedback helps us serve you better.' },
};

const STATUS_META = {
  PENDING:     { label: 'Pending',      tone: 'amber',  icon: '&#8635;', title: 'Your report status was updated' },
  REVIEWING:   { label: 'Under Review', tone: 'blue',   icon: '&#8635;', title: 'Your report is under review' },
  IN_PROGRESS: { label: 'In Progress',  tone: 'violet', icon: '&#8594;', title: 'Work has started on your report' },
  RESOLVED:    { label: 'Resolved',     tone: 'green',  icon: '&#10003;', title: 'Your report has been resolved' },
};

const STATUS_COPY = {
  PENDING:     'Your report is waiting to be reviewed by the concerned office.',
  REVIEWING:   'Your report is now being reviewed by the concerned office.',
  IN_PROGRESS: 'The concerned office has started acting on your report.',
  RESOLVED:    'Your report has been marked as resolved. Thank you for helping improve our community!',
};

// "Wed, Oct 7, 2026" on the Philippine calendar.
function formatPhDate(date) {
  return new Date(date).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

// "Sep 30, 2026, 3:15 PM" in Philippine time.
function formatPhDateTime(date) {
  return new Date(date).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function officeOf(submission) {
  return submission.department && submission.department !== 'UNASSIGNED' ? submission.department : submission.citizenDepartment;
}

function trackUrl(trackingId) {
  return `${SITE_URL}/track?id=${encodeURIComponent(trackingId)}`;
}

function excerpt(text, max = 220) {
  const clean = String(text || '').trim().replace(/\s+/g, ' ');
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

function stars(rating) {
  const n = Math.max(0, Math.min(5, Number(rating) || 0));
  return `<span style="color:#f59e0b; letter-spacing:1px;">${'&#9733;'.repeat(n)}</span><span style="color:#cbd5e1; letter-spacing:1px;">${'&#9733;'.repeat(5 - n)}</span> ${n}/5`;
}

async function buildSubmissionReceivedEmail(submission) {
  const copy = RECEIVED_COPY[submission.type] || RECEIVED_COPY.COMPLAINT;
  const isFeedback = submission.type === 'FEEDBACK';
  const office = officeOf(submission);
  const html = layout({
    seal: await sealImageUrl(),
    preheader: `Your tracking ID is ${submission.trackingId}. Keep it to follow your report.`,
    icon: '&#10003;', tone: 'green', title: copy.title, intro: copy.intro,
    body: `
      ${trackingBox(submission.trackingId, 'Keep this ID. You will need it to check on your report.')}
      ${detailRows([
        ['Type', escapeHtml(TYPE_LABELS[submission.type] || submission.type)],
        office && ['Office', escapeHtml(office)],
        ['Submitted', formatPhDateTime(submission.createdAt || new Date())],
        submission.dueAt && [isFeedback ? 'Target response' : 'Target resolution', formatPhDate(submission.dueAt)],
        submission.rating && ['Your rating', stars(submission.rating)],
      ])}
      ${submission.description ? quote(isFeedback ? 'Your feedback' : 'Your report', escapeHtml(excerpt(submission.description))) : ''}
      ${paragraph(`${strong('What happens next?')}<br>${escapeHtml(office || 'The concerned office')} will review it${submission.dueAt ? ` and aim to ${isFeedback ? 'respond' : 'act on it'} by ${strong(formatPhDate(submission.dueAt))}` : ''}. We'll email you every time its status changes.`)}
      ${button(trackUrl(submission.trackingId), 'Track my report')}
    `,
  });
  return { to: submission.email, subject: `CIVIX — Report Received (${submission.trackingId})`, html };
}

async function buildStatusUpdateEmail(submission, newStatus, note) {
  const meta = STATUS_META[newStatus] || { label: newStatus, tone: 'blue', icon: '&#8635;', title: 'Your report status was updated' };
  const resolved = newStatus === 'RESOLVED';
  const office = officeOf(submission);
  const html = layout({
    seal: await sealImageUrl(),
    preheader: `${submission.trackingId} is now ${meta.label}.`,
    icon: meta.icon, tone: meta.tone, title: meta.title,
    intro: escapeHtml(STATUS_COPY[newStatus] || 'There has been an update to your report.'),
    body: `
      ${progressTracker(newStatus)}
      ${detailRows([
        ['Tracking ID', `<span style="font-family:${MONO};">${escapeHtml(submission.trackingId)}</span>`],
        ['Status', pill(meta.label, meta.tone)],
        office && ['Office', escapeHtml(office)],
        !resolved && submission.dueAt && ['Target resolution', formatPhDate(submission.dueAt)],
      ])}
      ${noteBlock('Note from the office', note)}
      ${button(trackUrl(submission.trackingId), 'View my report')}
      ${resolved ? small(`Was your concern handled well? <a href="${SITE_URL}/submit" style="color:${BRAND}; font-weight:600;">Tell us how we did</a>. Your feedback helps us improve.`) : ''}
    `,
  });
  return { to: submission.email, subject: `CIVIX — Status Update: ${meta.label} (${submission.trackingId})`, html };
}

const REQUEST_LABELS = { STAFF_ACCOUNT: 'a staff account', ADMIN_ACCESS: 'administrator access' };
const REQUEST_TITLES = { STAFF_ACCOUNT: 'Staff account', ADMIN_ACCESS: 'Administrator access' };

// Alerts an administrator that a request is waiting for them. The private admin
// link is deliberately left out, since the administrator already has it.
async function buildAccessRequestAlertEmail(to, request) {
  const html = layout({
    seal: await sealImageUrl(),
    preheader: `${request.fullName} requested ${REQUEST_LABELS[request.type]}. It needs your review.`,
    icon: '!', tone: 'amber', title: 'New access request',
    intro: `${strong(escapeHtml(request.fullName))} requested ${REQUEST_LABELS[request.type]}.`,
    body: `
      ${detailRows([
        ['Name', escapeHtml(request.fullName)],
        ['Email', escapeHtml(request.email)],
        ['Department', escapeHtml(request.department || '—')],
        ['Request', escapeHtml(REQUEST_TITLES[request.type] || request.type)],
      ])}
      ${request.reason ? quote('Reason given', escapeHtml(request.reason)) : ''}
      ${paragraph(`Sign in to the CIVIX admin portal and open ${strong('Access Requests')} to verify this person, then approve or reject the request. Nothing is granted until an administrator approves it.`)}
    `,
  });
  return { to, subject: `CIVIX — ${request.fullName} requested ${REQUEST_LABELS[request.type]}`, html };
}

// Tells a staff member the decision on their administrator access request. An
// approval includes the private admin sign-in link so they can sign in right away.
async function buildAdminAccessDecisionEmail({ email, fullName }, approved, note, adminUrl) {
  const seal = await sealImageUrl();
  const html = approved
    ? layout({
      seal, preheader: 'Your CIVIX account now has administrator access.',
      icon: '&#10003;', tone: 'green', title: 'Your administrator access is active',
      intro: `Hi ${escapeHtml(fullName)}, an administrator approved your request.`,
      body: `
        ${noteBlock('Note from the administrator', note)}
        ${paragraph('Sign in with your usual email and password using your private admin link below. Bookmark it and don\'t share it.')}
        ${button(adminUrl, 'Open the admin sign-in')}
        ${small(`Or copy this link: <a href="${adminUrl}" style="color:${BRAND}; word-break:break-all;">${adminUrl}</a>`)}
        ${small('The Staff Login page no longer accepts this account.')}
      `,
    })
    : layout({
      seal, preheader: 'An update on your administrator access request.',
      icon: '&#10005;', tone: 'red', title: 'Your administrator access request',
      intro: `Hi ${escapeHtml(fullName)}, your request was not approved. You keep your staff access.`,
      body: `
        ${noteBlock('Note from the administrator', note)}
        ${small('If you have questions, please contact the CIVIX administrator at the municipal office.')}
      `,
    });
  return { to: email, subject: approved ? 'CIVIX — Administrator access approved' : 'CIVIX — Administrator access request', html };
}

// Tells someone who asked for a staff account whether it was approved.
async function buildStaffAccountDecisionEmail({ email, fullName }, approved, note) {
  const seal = await sealImageUrl();
  const loginUrl = `${SITE_URL}/staff-login`;
  const html = approved
    ? layout({
      seal, preheader: 'Your CIVIX staff account is ready to use.',
      icon: '&#10003;', tone: 'green', title: 'Your staff account is approved',
      intro: `Hi ${escapeHtml(fullName)}, an administrator approved your CIVIX staff account.`,
      body: `
        ${noteBlock('Note from the administrator', note)}
        ${paragraph('You can now sign in with the email and password you registered with.')}
        ${button(loginUrl, 'Sign in to CIVIX')}
      `,
    })
    : layout({
      seal, preheader: 'An update on your CIVIX staff account request.',
      icon: '&#10005;', tone: 'red', title: 'Your staff account request was not approved',
      intro: `Hi ${escapeHtml(fullName)}, your request for a CIVIX staff account was not approved.`,
      body: `
        ${noteBlock('Note from the administrator', note)}
        ${small('If you think this is a mistake, please contact the CIVIX administrator at the municipal office.')}
      `,
    });
  return { to: email, subject: approved ? 'CIVIX — Staff account approved' : 'CIVIX — Staff account request', html };
}

const sendSubmissionReceivedEmail = submission => deliver(buildSubmissionReceivedEmail(submission));
const sendStatusUpdateEmail = (submission, newStatus, note) => deliver(buildStatusUpdateEmail(submission, newStatus, note));
const sendAccessRequestAlertEmail = (to, request) => deliver(buildAccessRequestAlertEmail(to, request));
const sendAdminAccessDecisionEmail = (user, approved, note, adminUrl) => deliver(buildAdminAccessDecisionEmail(user, approved, note, adminUrl));
const sendStaffAccountDecisionEmail = (user, approved, note) => deliver(buildStaffAccountDecisionEmail(user, approved, note));

module.exports = {
  sendMail, sendSubmissionReceivedEmail, sendStatusUpdateEmail,
  sendStaffAccountDecisionEmail, sendAccessRequestAlertEmail, sendAdminAccessDecisionEmail,
  // For previews and tests.
  buildSubmissionReceivedEmail, buildStatusUpdateEmail, buildAccessRequestAlertEmail,
  buildAdminAccessDecisionEmail, buildStaffAccountDecisionEmail, toPlainText,
};
