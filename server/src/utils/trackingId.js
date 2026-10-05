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

// A short random tail, e.g. "K7".
const randomTail = () => crypto.randomInt(36 * 36).toString(36).toUpperCase().padStart(2, '0');

// The next free code for this office and day, e.g. ENG-20261004-0007.
// Reports sent at the same moment can pick the same number; the database keeps
// only one and createSubmission asks again with a higher `attempt`. Retries skip
// ahead by a random amount so they don't all pick the same number again, and from
// the 3rd retry the code gets a random tail (ENG-20261004-0042-K7), so the report
// is always saved.
async function generateTrackingId(prisma, department, attempt = 0) {
  const deptCode = getDeptCode(department);
  const yyyymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `${deptCode}-${yyyymmdd}-`;

  const count = await prisma.submission.count({
    where: { trackingId: { startsWith: prefix } },
  });

  let seq = count + 1 + (attempt ? crypto.randomInt(attempt * 4) : 0);
  for (let tries = 0; tries < 10; tries++) {
    const trackingId = `${prefix}${String(seq).padStart(4, '0')}`;
    const existing = await prisma.submission.findUnique({ where: { trackingId }, select: { id: true } });
    if (!existing) return attempt >= 3 ? `${trackingId}-${randomTail()}` : trackingId;
    seq++;
  }
  return `${prefix}${String(seq).padStart(4, '0')}-${randomTail()}`;
}

module.exports = { generateTrackingId };
