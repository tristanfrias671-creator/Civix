// Emails for the office's staff: each active staff member of an office gets one
// when a complaint or suggestion arrives for it, or is moved to it. Reports with no
// office yet go to the receiving office (Settings), which forwards them. Feedback
// needs no action, so it sends none; neither does a resolved or spam report.
const prisma = require('./prisma');
const { createLimiter } = require('./rateLimit');
const { sendNewReportStaffEmail } = require('./mailer');
const { getReceivingOffice } = require('../controllers/settings');

const HOUR_MS = 60 * 60 * 1000;

// Counted across all offices, like the citizens' receipts (controllers/submissions.js):
// a flood of reports must not use up the mailbox's sending limit. Past the cap the
// reports still show in the staff portal (list, alerts and pop-ups).
const budget = {
  hour: createLimiter({ windowMs: HOUR_MS, max: Number(process.env.STAFF_REPORT_EMAILS_PER_HOUR) || 60 }),
  day: createLimiter({ windowMs: 24 * HOUR_MS, max: Number(process.env.STAFF_REPORT_EMAILS_PER_DAY) || 400 }),
};
// Takes one from the hourly and the daily allowance, or neither.
function mayEmail() {
  if (!budget.hour.take('all').ok) return false;
  if (budget.day.take('all').ok) return true;
  budget.hour.give('all');
  return false;
}

// The office whose staff act on reports in `department`: that office or, for
// reports with no office yet, the receiving office.
const handlingOffice = department => (department === 'UNASSIGNED' ? getReceivingOffice() : department);

// Emails the staff of the office that acts on `submission` (as saved, with its
// photos). `move` ({ from, byName, reason }) when a staff member moved it there.
// Each email goes to the person's linked Gmail if they have one, otherwise to
// their sign-in email, like the administrators' alerts. Never throws; nobody
// waits for it.
async function emailOfficeStaff(submission, move = null) {
  try {
    if (submission.type === 'FEEDBACK' || ['RESOLVED', 'SPAM'].includes(submission.status)) return;
    const office = await handlingOffice(submission.department);
    if (!office) return;
    // A report with no office moved to the receiving office itself: its staff
    // already had the email when the report came in.
    if (move && (await handlingOffice(move.from)) === office) return;
    const staff = await prisma.user.findMany({
      where: { role: 'STAFF', accountStatus: 'ACTIVE', department: office },
      select: { fullName: true, email: true, gmail: true },
    });
    const sent = new Set();
    for (const person of staff) {
      const to = String(person.gmail || person.email || '').trim();
      if (!to || sent.has(to.toLowerCase())) continue;
      if (!mayEmail()) {
        console.warn('[staff-emails] The hourly or daily limit is reached; the office still sees the report in the staff portal.');
        return;
      }
      sent.add(to.toLowerCase());
      sendNewReportStaffEmail({ email: to, fullName: person.fullName }, submission, { office, move });
    }
  } catch (err) {
    console.error('[staff-emails] Could not email the office:', err.message);
  }
}

module.exports = { emailOfficeStaff };
