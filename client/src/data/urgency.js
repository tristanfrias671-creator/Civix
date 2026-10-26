// How urgent a report is: Urgent, Normal or Can wait. The AI sets it for a complaint
// from its description (server/src/utils/urgencyDetector.js; the citizen's wording is
// in i18n/submitText.js and trackText.js); the office's staff can change it later
// with a reason. Staff and admin pages use these English names. The server has the
// same ones (server/src/utils/urgency.js).
export const PRIORITY_ORDER = ['URGENT', 'STANDARD', 'LOW'];
export const PRIORITY_LABEL = { URGENT: 'Urgent', STANDARD: 'Normal', LOW: 'Can wait' };

// The words in a complaint's description that set its urgency (saved as JSON with
// the report's AI record), e.g. ["sunog", "mga bata"]. Reports sent before Oct 16,
// 2026 have none: the citizen chose then.
export function urgencyWords(json) {
  try {
    const words = JSON.parse(json || '[]');
    return Array.isArray(words) ? words.map(String) : [];
  } catch {
    return [];
  }
}
export const quoteWords = words => words.map(w => `“${w}”`).join(', ');

// Why the citizen said a complaint was urgent. The form no longer asks; reports sent
// while it did (Oct 14–15, 2026) still show their answer.
export const URGENCY_REASON_LABEL = {
  DANGER: 'Someone could get hurt',
  MANY_AFFECTED: 'Many families are affected',
  HEALTH: 'Health risk',
  WORSENING: 'Getting worse fast',
};

// Until the settings arrive: the defaults in Settings > Resolution Deadlines.
export const DEFAULT_DEADLINES = { COMPLAINT: 7, SUGGESTION: 15, URGENT: 3, LOW: 15 };

// Working days to resolve a report of this type and urgency (the same rule as the
// server's utils/deadline.js): Urgent and Can wait have their own times, Normal is
// the time for the type.
export function urgencyDays(deadlines, type, priority) {
  const d = { ...DEFAULT_DEADLINES, ...deadlines };
  if (priority === 'URGENT') return d.URGENT;
  if (priority === 'LOW') return d.LOW;
  return type === 'SUGGESTION' ? d.SUGGESTION : d.COMPLAINT;
}

const PH_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// The end (23:59 Philippine time) of the Nth working day (Monday–Friday) after
// `from`, counted like the server does.
export function addWorkingDays(from, days) {
  const ph = new Date(from.getTime() + PH_OFFSET_MS);
  const day = new Date(Date.UTC(ph.getUTCFullYear(), ph.getUTCMonth(), ph.getUTCDate()));
  let added = 0;
  while (added < days) {
    day.setUTCDate(day.getUTCDate() + 1);
    const weekday = day.getUTCDay();
    if (weekday !== 0 && weekday !== 6) added++;
  }
  return new Date(day.getTime() + DAY_MS - 1 - PH_OFFSET_MS);
}
