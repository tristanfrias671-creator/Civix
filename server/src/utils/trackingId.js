const crypto = require('crypto');

const DEPT_CODES = {
  "Mayor's Office – CRMO": 'CRM',
  'HR': 'HRO',
  'Tourism': 'TOU',
  'Motorpool': 'MOT',
  'Traffic': 'TRF',
  'CSDO': 'CSD',
  'OSCA': 'OSC',
  'MDRRMO': 'MDR',
  'Municipal Budget Office': 'MBO',
  'Municipal Accountant Office': 'ACC',
  'Municipal Agriculture Office': 'AGR',
  'Municipal Health Office': 'MHO',
  'Municipal Civil Registry Office': 'MCR',
  'Municipal Social Welfare & Development Office': 'SWD',
  'Municipal Economic & Natural Resource Office': 'ENR',
  'Municipal Treasurer Office': 'TRS',
  'Municipal Engineering Office': 'ENG',
  'Municipal Planning & Development Office': 'MPD',
  'Sangguniang Bayan Office': 'SBO',
  'Office of the Vice Mayor': 'OVM',
  General: 'GEN', // feedback on the municipality's service as a whole
};

function getDeptCode(department) {
  if (DEPT_CODES[department]) return DEPT_CODES[department];
  const cleaned = (department || 'UNA').replace(/[^a-zA-Z]/g, '');
  return cleaned.substring(0, 3).toUpperCase() || 'UNA';
}

// Letters and digits that can't be mixed up when typed from a slip or read aloud:
// no 0/O and no 1/I/L.
const CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const randomPart = length => Array.from({ length }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join('');

// Today's date in the Philippines (UTC+8, no daylight saving) as YYYYMMDD, so a
// report sent at 7 AM gets today's date, not yesterday's.
function phDate(now = new Date()) {
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10).replace(/-/g, '');
}

// A new transaction code for this office: OFFICE-YYYYMMDD-XXXX, e.g. MHO-20261029-K7Q3.
// The last part is random, so no one can guess another person's code from their
// own. A code is never given twice, not even after its report was deleted
// (DeletedReport keeps the codes of deleted reports). Two reports sent at the same
// moment can still draw the same code; the database keeps only one and
// createSubmission asks again with a higher `attempt`.
async function generateTrackingId(prisma, department, attempt = 0) {
  const prefix = `${getDeptCode(department)}-${phDate()}-`;
  for (let tries = 0; tries < 20; tries++) {
    const trackingId = prefix + randomPart(attempt >= 3 ? 6 : 4);
    const [live, deleted] = await Promise.all([
      prisma.submission.findUnique({ where: { trackingId }, select: { id: true } }),
      prisma.deletedReport.findFirst({ where: { trackingId }, select: { id: true } }),
    ]);
    if (!live && !deleted) return trackingId;
  }
  return prefix + randomPart(8);
}

module.exports = { generateTrackingId, phDate, getDeptCode, randomPart };
