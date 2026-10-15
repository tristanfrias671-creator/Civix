import React from 'react';

// Wording and colors for the sign-in history (Admin > Audit Log, and the profile).
// The outcomes are written by the server (server/src/utils/signInLog.js).
export const OUTCOME = {
  SIGNED_IN:        { label: 'Signed in',          tone: 'good' },
  WRONG_PASSWORD:   { label: 'Wrong password',     tone: 'warn' },
  LOCKED:           { label: 'Account locked',     tone: 'bad' },
  UNKNOWN_ACCOUNT:  { label: 'No such account',    tone: 'muted' },
  NOT_APPROVED:     { label: 'Not yet approved',   tone: 'muted' },
  WRONG_PAGE:       { label: 'Wrong sign-in page', tone: 'warn' },
  RESET_CODE_SENT:  { label: 'Reset code sent',    tone: 'info' },
  WRONG_CODE:       { label: 'Wrong reset code',   tone: 'warn' },
  PASSWORD_RESET:   { label: 'Password reset',     tone: 'info' },
  PASSWORD_CHANGED: { label: 'Password changed',   tone: 'info' },
  CODE_SENT:          { label: 'Sign-in code sent',    tone: 'info' },
  WRONG_SIGN_IN_CODE: { label: 'Wrong sign-in code',   tone: 'warn' },
  CODES_ON:           { label: 'Sign-in codes on',     tone: 'info' },
  CODES_OFF:          { label: 'Sign-in codes off',    tone: 'warn' },
};

// Attempts that didn't get in (the "Failed attempts only" view).
export const FAILED = ['WRONG_PASSWORD', 'LOCKED', 'UNKNOWN_ACCOUNT', 'WRONG_PAGE', 'WRONG_CODE', 'WRONG_SIGN_IN_CODE', 'NOT_APPROVED'];

export const METHOD = {
  PASSWORD: 'Password',
  PASSWORD_AND_CODE: 'Password + email code',
  GOOGLE: 'Google',
  EMAIL_CODE: 'Email code',
  PROFILE: 'From the profile',
  ADMIN: 'By an administrator',
};

export const PAGE = { STAFF: 'Staff Login page', ADMIN: 'Admin sign-in page' };

const TONE = {
  good:  'bg-green-50 text-green-800 dark:text-green-300',
  warn:  'bg-amber-50 text-amber-800 dark:text-amber-200',
  bad:   'bg-red-50 text-red-800',
  info:  'bg-blue-50 text-blue-800',
  muted: 'bg-gray-100 text-gray-700',
};
const PILL = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap';

export function OutcomeBadge({ outcome }) {
  const o = OUTCOME[outcome] || { label: outcome, tone: 'muted' };
  return <span className={`${PILL} ${TONE[o.tone]}`}>{o.label}</span>;
}

export function NewDeviceTag() {
  return <span className={`${PILL} ${TONE.warn}`} title="The first sign-in from this phone or computer">New device</span>;
}

// "Oct 6, 2026, 9:14 AM"
export const whenText = date => new Date(date).toLocaleString('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
});
