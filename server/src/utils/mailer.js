const nodemailer = require('nodemailer');
const { Resend } = require('resend');

const { EMAIL_USER, EMAIL_APP_PASSWORD, RESEND_API_KEY, RESEND_FROM_EMAIL, CLIENT_URL } = process.env;

// Prefer Resend (HTTP API, works on hosts that block outbound SMTP like Render's free tier).
// Falls back to Gmail SMTP for local dev. Skips silently if neither is configured.
const useResend = Boolean(RESEND_API_KEY && RESEND_FROM_EMAIL);
const useGmail = !useResend && Boolean(EMAIL_USER && EMAIL_APP_PASSWORD);
const configured = useResend || useGmail;

let resendClient = null;
let transporter = null;

if (useResend) {
  resendClient = new Resend(RESEND_API_KEY);
} else if (useGmail) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: EMAIL_USER, pass: EMAIL_APP_PASSWORD },
  });
} else {
  console.warn('[mailer] No email provider configured (RESEND_API_KEY or EMAIL_USER/EMAIL_APP_PASSWORD) — status update emails will be skipped.');
}

const BRAND = '#2563eb';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function layout(title, bodyHtml) {
  return `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; background: #f8fafc; padding: 24px;">
    <div style="background: ${BRAND}; border-radius: 12px 12px 0 0; padding: 20px 24px;">
      <span style="color: #fff; font-size: 18px; font-weight: 700; letter-spacing: 0.5px;">CIVIX</span>
      <div style="color: #dbeafe; font-size: 12px; margin-top: 2px;">Municipality of Cantilan, Surigao del Sur</div>
    </div>
    <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
      <h2 style="margin: 0 0 12px; font-size: 16px; color: #111827;">${title}</h2>
      ${bodyHtml}
    </div>
    <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 16px;">
      This is an automated message from the CIVIX Citizen Complaint and Feedback Management System. Please do not reply to this email.
    </p>
  </div>`;
}

async function sendMail({ to, subject, html }) {
  if (!configured || !to) return;
  try {
    if (useResend) {
      const { error } = await resendClient.emails.send({
        from: `CIVIX - Cantilan <${RESEND_FROM_EMAIL}>`, to, subject, html,
      });
      if (error) throw new Error(error.message || JSON.stringify(error));
    } else {
      await transporter.sendMail({ from: `"CIVIX - Cantilan" <${EMAIL_USER}>`, to, subject, html });
    }
  } catch (err) {
    console.error('[mailer] Failed to send email:', err.message);
  }
}

const STATUS_LABELS = {
  PENDING:     'Pending',
  REVIEWING:   'Under Review',
  IN_PROGRESS: 'In Progress',
  RESOLVED:    'Resolved',
};

const STATUS_COPY = {
  REVIEWING:   'Your report is now being reviewed by the concerned department.',
  IN_PROGRESS: 'The concerned department has started acting on your report.',
  RESOLVED:    'Your report has been marked as resolved. Thank you for helping improve our community!',
};

function sendSubmissionReceivedEmail(submission) {
  const trackUrl = `${CLIENT_URL || 'http://localhost:3000'}/track`;
  const html = layout('We received your report', `
    <p style="color:#374151; font-size:14px; line-height:1.6;">
      Thank you for submitting a report to CIVIX. Here are your details:
    </p>
    <div style="background:#f1f5f9; border-radius:8px; padding:14px 16px; margin:16px 0;">
      <div style="font-size:12px; color:#6b7280;">Tracking ID</div>
      <div style="font-size:18px; font-weight:700; color:${BRAND}; letter-spacing:0.5px;">${submission.trackingId}</div>
    </div>
    <p style="color:#374151; font-size:14px; line-height:1.6;">
      Keep this ID to track your report's status anytime at
      <a href="${trackUrl}" style="color:${BRAND};">${trackUrl}</a>.
      We'll also email you whenever the status changes.
    </p>
  `);
  return sendMail({ to: submission.email, subject: `CIVIX — Report Received (${submission.trackingId})`, html });
}

function sendStatusUpdateEmail(submission, newStatus, note) {
  const trackUrl = `${CLIENT_URL || 'http://localhost:3000'}/track`;
  const label = STATUS_LABELS[newStatus] || newStatus;
  const copy = STATUS_COPY[newStatus] || 'There has been an update to your report.';
  const noteBlock = note ? `
    <div style="background:#eff6ff; border-left:3px solid ${BRAND}; border-radius:6px; padding:10px 14px; margin:12px 0;">
      <div style="font-size:11px; color:#6b7280; text-transform:uppercase; letter-spacing:0.03em; margin-bottom:2px;">Note from staff</div>
      <div style="font-size:14px; color:#1f2937;">${escapeHtml(note)}</div>
    </div>` : '';
  const html = layout('Your report status has been updated', `
    <div style="background:#f1f5f9; border-radius:8px; padding:14px 16px; margin:16px 0;">
      <div style="font-size:12px; color:#6b7280;">Tracking ID</div>
      <div style="font-size:16px; font-weight:700; color:#111827; margin-bottom:8px;">${submission.trackingId}</div>
      <div style="font-size:12px; color:#6b7280;">New Status</div>
      <div style="font-size:15px; font-weight:700; color:${BRAND};">${label}</div>
    </div>
    <p style="color:#374151; font-size:14px; line-height:1.6;">${copy}</p>
    ${noteBlock}
    <p style="color:#374151; font-size:14px; line-height:1.6;">
      View full details anytime at <a href="${trackUrl}" style="color:${BRAND};">${trackUrl}</a>.
    </p>
  `);
  return sendMail({ to: submission.email, subject: `CIVIX — Status Update: ${label} (${submission.trackingId})`, html });
}

function adminNoteHtml(note) {
  return note ? `
    <div style="background:#eff6ff; border-left:3px solid ${BRAND}; border-radius:6px; padding:10px 14px; margin:12px 0;">
      <div style="font-size:11px; color:#6b7280; text-transform:uppercase; letter-spacing:0.03em; margin-bottom:2px;">Note from the administrator</div>
      <div style="font-size:14px; color:#1f2937;">${escapeHtml(note)}</div>
    </div>` : '';
}

const REQUEST_LABELS = { STAFF_ACCOUNT: 'a staff account', ADMIN_ACCESS: 'administrator access' };

// Alerts an administrator that a request is waiting for them. The private admin
// link is deliberately left out, since the administrator already has it.
function sendAccessRequestAlertEmail(to, request) {
  const row = (label, value) => `
      <div style="font-size:12px; color:#6b7280; margin-top:8px;">${label}</div>
      <div style="font-size:14px; color:#111827;">${escapeHtml(value)}</div>`;
  const html = layout('New access request', `
    <p style="color:#374151; font-size:14px; line-height:1.6;">
      <strong>${escapeHtml(request.fullName)}</strong> requested ${REQUEST_LABELS[request.type]}.
    </p>
    <div style="background:#f1f5f9; border-radius:8px; padding:6px 16px 14px; margin:16px 0;">
      ${row('Email', request.email)}
      ${row('Department', request.department || '—')}
      ${request.reason ? row('Reason', request.reason) : ''}
    </div>
    <p style="color:#374151; font-size:14px; line-height:1.6;">
      Sign in to the CIVIX admin portal and open <strong>Access Requests</strong> to verify this person, then approve or reject the request.
      Nothing is granted until an administrator approves it.
    </p>
  `);
  return sendMail({ to, subject: `CIVIX — ${request.fullName} requested ${REQUEST_LABELS[request.type]}`, html });
}

// Tells a staff member the decision on their administrator access request. An
// approval includes the private admin sign-in link so they can sign in right away.
function sendAdminAccessDecisionEmail({ email, fullName }, approved, note, adminUrl) {
  const html = approved
    ? layout('Your administrator access is active', `
      <p style="color:#374151; font-size:14px; line-height:1.6;">Hi ${escapeHtml(fullName)}, an administrator approved your request. Your CIVIX account now has administrator access.</p>
      ${adminNoteHtml(note)}
      <p style="color:#374151; font-size:14px; line-height:1.6;">Sign in with your usual email and password at this private address. Bookmark it and don't share it:</p>
      <p style="font-size:14px;"><a href="${adminUrl}" style="color:${BRAND}; word-break:break-all;">${adminUrl}</a></p>
      <p style="color:#6b7280; font-size:13px; line-height:1.6;">The Staff Login page no longer accepts this account.</p>`)
    : layout('Your administrator access request', `
      <p style="color:#374151; font-size:14px; line-height:1.6;">Hi ${escapeHtml(fullName)}, your request for administrator access was not approved. You keep your staff access.</p>
      ${adminNoteHtml(note)}`);
  return sendMail({ to: email, subject: approved ? 'CIVIX — Administrator access approved' : 'CIVIX — Administrator access request', html });
}

// Tells someone who asked for a staff account whether it was approved.
function sendStaffAccountDecisionEmail({ email, fullName }, approved, note) {
  const loginUrl = `${CLIENT_URL || 'http://localhost:3000'}/staff-login`;
  const noteBlock = adminNoteHtml(note);
  const html = approved
    ? layout('Your staff account is approved', `
      <p style="color:#374151; font-size:14px; line-height:1.6;">Hi ${escapeHtml(fullName)}, an administrator approved your CIVIX staff account.</p>
      ${noteBlock}
      <p style="color:#374151; font-size:14px; line-height:1.6;">You can now sign in at <a href="${loginUrl}" style="color:${BRAND};">${loginUrl}</a>.</p>`)
    : layout('Your staff account request was not approved', `
      <p style="color:#374151; font-size:14px; line-height:1.6;">Hi ${escapeHtml(fullName)}, your request for a CIVIX staff account was not approved.</p>
      ${noteBlock}
      <p style="color:#374151; font-size:14px; line-height:1.6;">If you think this is a mistake, please contact the CIVIX administrator at the municipal office.</p>`);
  return sendMail({ to: email, subject: approved ? 'CIVIX — Staff account approved' : 'CIVIX — Staff account request', html });
}

module.exports = {
  sendMail, sendSubmissionReceivedEmail, sendStatusUpdateEmail,
  sendStaffAccountDecisionEmail, sendAccessRequestAlertEmail, sendAdminAccessDecisionEmail,
};
