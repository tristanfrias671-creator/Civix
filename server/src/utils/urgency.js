// How urgent a report is. The citizen chooses for a complaint on the report form;
// the office's staff can change it later, with a reason (controllers/staff.js).
// The website has the same names (client/src/data/urgency.js).
const PRIORITIES = ['URGENT', 'STANDARD', 'LOW'];
const PRIORITY_LABELS = { URGENT: 'Urgent', STANDARD: 'Normal', LOW: 'Can wait' };

// Why the citizen said a complaint was urgent. The form no longer asks; reports sent
// while it did (Oct 14–15, 2026) still show their answer.
const URGENCY_REASONS = {
  DANGER: 'Someone could get hurt',
  MANY_AFFECTED: 'Many families are affected',
  HEALTH: 'Health risk',
  WORSENING: 'Getting worse fast',
};

module.exports = { PRIORITIES, PRIORITY_LABELS, URGENCY_REASONS };
