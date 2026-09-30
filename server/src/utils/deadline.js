const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

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

function deadlineDays(settings, type) {
  return {
    COMPLAINT: settings.deadlineComplaintDays,
    SUGGESTION: settings.deadlineSuggestionDays,
    FEEDBACK: settings.deadlineFeedbackDays,
  }[type] || settings.deadlineComplaintDays;
}

// Reports filed before deadlines existed get one from their submission date.
async function backfillDeadlines() {
  const { ensureSettings } = require('../controllers/settings');
  const missing = await prisma.submission.findMany({
    where: { dueAt: null },
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

module.exports = { addWorkingDays, deadlineDays, backfillDeadlines };
