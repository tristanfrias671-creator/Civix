const prisma = require('./prisma');

// Resolution deadlines count working days (Monday–Friday) on the Philippine calendar,
// like the Anti-Red Tape Act processing times. Holidays are not excluded.
const PH_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// The end (23:59:59 PH time) of the Nth working day after `from`.
function addWorkingDays(from, days) {
  const phDate = new Date(from.getTime() + PH_OFFSET_MS);
  const day = new Date(Date.UTC(phDate.getUTCFullYear(), phDate.getUTCMonth(), phDate.getUTCDate()));
  let added = 0;
  while (added < days) {
    day.setUTCDate(day.getUTCDate() + 1);
    const weekday = day.getUTCDay();
    if (weekday !== 0 && weekday !== 6) added++;
  }
  return new Date(day.getTime() + DAY_MS - 1 - PH_OFFSET_MS);
}

// Midnight on the Philippine calendar at the start of `date`'s day / month.
function phDayStart(date = new Date()) {
  const p = new Date(date.getTime() + PH_OFFSET_MS);
  return new Date(Date.UTC(p.getUTCFullYear(), p.getUTCMonth(), p.getUTCDate()) - PH_OFFSET_MS);
}
function phMonthStart(date = new Date()) {
  const p = new Date(date.getTime() + PH_OFFSET_MS);
  return new Date(Date.UTC(p.getUTCFullYear(), p.getUTCMonth(), 1) - PH_OFFSET_MS);
}

// Feedback rates the municipality's service as a whole: no office acts on it, so
// it has no deadline (null).
function deadlineDays(settings, type) {
  if (type === 'FEEDBACK') return null;
  return {
    COMPLAINT: settings.deadlineComplaintDays,
    SUGGESTION: settings.deadlineSuggestionDays,
  }[type] || settings.deadlineComplaintDays;
}

// Reports filed before deadlines existed get one from their submission date, and
// feedback filed while it still had deadlines loses its (so it is never overdue).
async function backfillDeadlines() {
  const { ensureSettings } = require('../controllers/settings');
  const cleared = await prisma.submission.updateMany({ where: { type: 'FEEDBACK', dueAt: { not: null } }, data: { dueAt: null } });
  if (cleared.count) console.log(`[deadlines] Removed deadlines from ${cleared.count} feedback report(s).`);
  const missing = await prisma.submission.findMany({
    where: { dueAt: null, type: { not: 'FEEDBACK' } },
    select: { id: true, type: true, createdAt: true },
  });
  if (!missing.length) return 0;
  const settings = await ensureSettings();
  for (const s of missing) {
    await prisma.submission.update({
      where: { id: s.id },
      data: { dueAt: addWorkingDays(s.createdAt, deadlineDays(settings, s.type)) },
    });
  }
  return missing.length;
}

module.exports = { addWorkingDays, deadlineDays, backfillDeadlines, phDayStart, phMonthStart };
