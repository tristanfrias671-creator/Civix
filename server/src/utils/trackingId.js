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
};

function getDeptCode(department) {
  if (DEPT_CODES[department]) return DEPT_CODES[department];
  const cleaned = (department || 'UNA').replace(/[^a-zA-Z]/g, '');
  return cleaned.substring(0, 3).toUpperCase() || 'UNA';
}

async function generateTrackingId(prisma, department) {
  const deptCode = getDeptCode(department);
  const yyyymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `${deptCode}-${yyyymmdd}-`;

  const count = await prisma.submission.count({
    where: { trackingId: { startsWith: prefix } },
  });

  let seq = count + 1;
  for (let attempts = 0; attempts < 10; attempts++) {
    const trackingId = `${prefix}${String(seq).padStart(4, '0')}`;
    const existing = await prisma.submission.findUnique({ where: { trackingId } });
    if (!existing) return trackingId;
    seq++;
  }
  // Fallback with timestamp suffix to guarantee uniqueness
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

module.exports = { generateTrackingId };
