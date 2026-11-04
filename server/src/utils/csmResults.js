// Satisfaction results from the ARTA Client Satisfaction Measurement (CSM) form
// (utils/csm.js), for the Analytics page, the staff dashboard and the PDF and Excel
// reports. Worked out the way ARTA's CSM reports do (MC 2022-05): a statement's
// score is the share of Agree and Strongly agree among its answers that are not
// N/A; the overall score pools SQD1–SQD8 the same way; SQD0 ("I am satisfied with
// the service that I availed") is shown on its own. Each score gets ARTA's rating.
// Feedback marked as spam is left out, like every other figure.
const { CLIENT_TYPES, CLIENT_TYPE_LABELS, SEXES, SQD } = require('./csm');
const { parsePeriod } = require('./reportPeriod');
const { REMARKS, remarkKind } = require('./remarks');

// ARTA's ratings, for the score rounded to one decimal (as it is shown).
const RATINGS = [
  { min: 95, label: 'Outstanding' },
  { min: 90, label: 'Very Satisfactory' },
  { min: 80, label: 'Satisfactory' },
  { min: 60, label: 'Fair' },
  { min: 0, label: 'Poor' },
];
const ratingOf = score => (score == null ? null : RATINGS.find(r => score >= r.min).label);

// `part` out of `whole` as a percentage with one decimal; null when `whole` is 0.
const percent = (part, whole) => (whole > 0 ? Math.round((part * 1000) / whole) / 10 : null);

// The age groups of ARTA's CSM reports.
const AGE_GROUPS = [
  { label: '19 or younger', max: 19 },
  { label: '20–34', max: 34 },
  { label: '35–49', max: 49 },
  { label: '50–64', max: 64 },
  { label: '65 or older', max: Infinity },
];
const SEX_LABELS = { MALE: 'Male', FEMALE: 'Female' };

// How many forms have each label (Positive, Neutral, Negative; utils/csm.js).
const LABEL_KEYS = ['POSITIVE', 'NEUTRAL', 'NEGATIVE'];
const byLabel = rows => ({
  ...Object.fromEntries(LABEL_KEYS.map(key => [key, rows.filter(row => row.sentiment === key).length])),
  total: rows.length,
});

// The results of a group of answered forms.
function summarize(rows) {
  const n = rows.length;
  const count = test => rows.filter(test).length;

  // Each statement: how many gave each answer (5 Strongly agree … 1 Strongly
  // disagree, NA), how many answered it (not N/A), and its score.
  const sqd = {};
  for (const key of SQD) {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0, NA: 0 };
    for (const row of rows) counts[row[key] == null ? 'NA' : row[key]] += 1;
    const answered = n - counts.NA;
    const score = percent(counts[5] + counts[4], answered);
    sqd[key] = { counts, answered, score, rating: ratingOf(score) };
  }
  let agree = 0;
  let answered = 0;
  for (const key of SQD.slice(1)) {
    agree += sqd[key].counts[5] + sqd[key].counts[4];
    answered += sqd[key].answered;
  }
  const overall = percent(agree, answered);

  // The Citizen's Charter: how many chose each option, in the form's order (the
  // last option of CC2 and CC3 is N/A).
  const options = (key, total) => Array.from({ length: total }, (_, i) => count(row => row[key] === i + 1));
  const cc1 = options('cc1', 4);
  const cc2 = options('cc2', 5);
  const cc3 = options('cc3', 4);

  return {
    responses: n,
    overall,
    rating: ratingOf(overall),
    sqd,
    sentiment: { POSITIVE: count(row => row.sentiment === 'POSITIVE'), NEUTRAL: count(row => row.sentiment === 'NEUTRAL'), NEGATIVE: count(row => row.sentiment === 'NEGATIVE') },
    // The clients' remarks (utils/remarks.js): comments, complaints and suggestions,
    // and the forms with no remark, each by label.
    remarks: {
      ...Object.fromEntries(REMARKS.map(kind => [kind, byLabel(rows.filter(row => row.remark === kind))])),
      none: byLabel(rows.filter(row => !row.remark)),
    },
    charter: {
      cc1, cc2, cc3,
      aware: percent(cc1[0] + cc1[1] + cc1[2], n), // know what a Citizen's Charter is
      sawCharter: percent(cc1[0] + cc1[2], n), // saw this office's Charter
      easyToSee: percent(cc2[0], n - cc2[4]), // of those who answered CC2 (not N/A)
      helped: percent(cc3[0] + cc3[1], n - cc3[3]), // of those who answered CC3 (not N/A)
    },
    clients: {
      types: CLIENT_TYPES.map(key => ({ key, label: CLIENT_TYPE_LABELS[key], count: count(row => row.clientType === key) })),
      sexes: [
        ...SEXES.map(key => ({ key, label: SEX_LABELS[key], count: count(row => row.sex === key) })),
        { key: null, label: 'Not given', count: count(row => !SEXES.includes(row.sex)) },
      ],
      ages: [
        ...AGE_GROUPS.map((group, i) => ({
          label: group.label,
          count: count(row => row.age != null && row.age <= group.max && (i === 0 || row.age > AGE_GROUPS[i - 1].max)),
        })),
        { label: 'Not given', count: count(row => row.age == null) },
      ],
    },
  };
}

// The services rated: what the staff member typed on the slip (or the client), or
// "Complaint handling" / "Suggestion handling" for a resolved report. One row per
// office and service (the same words in any case), most answers first.
function byService(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!row.service) continue;
    const key = `${row.department}\n${row.service.trim().toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, { department: row.department, service: row.service.trim(), rows: [] });
    groups.get(key).rows.push(row);
  }
  return [...groups.values()]
    .map(group => {
      const result = summarize(group.rows);
      return {
        department: group.department, service: group.service, responses: result.responses,
        overall: result.overall, rating: result.rating, satisfied: result.sqd.sqd0.score,
      };
    })
    .sort((a, b) => b.responses - a.responses || a.department.localeCompare(b.department) || a.service.localeCompare(b.service));
}

// The codes the offices gave their clients (New client) in the time. Each slip is
// one transaction at the office, so the codes show how many clients an office
// served and how many of them answered the form: the response rate. A code whose
// form was marked as spam counts as given, not as answered.
function codeSummary(codes, now = Date.now()) {
  const given = codes.length;
  const answered = codes.filter(c => c.answered).length;
  const unused = codes.filter(c => !c.usedAt);
  return {
    given,
    answered,
    waiting: unused.filter(c => c.expiresAt.getTime() > now).length, // can still be used
    expired: unused.filter(c => c.expiresAt.getTime() <= now).length,
    rate: percent(answered, given),
  };
}

const ANSWERS = Object.fromEntries(['service', 'clientType', 'sex', 'age', 'cc1', 'cc2', 'cc3', ...SQD].map(field => [field, true]));

// The results of each office (the `offices` given first, in their order, even with
// no answers yet; then any other office with answers or codes), of all of them
// together, and of each service, with the codes each office gave (codeSummary).
// `from`/`to` keep the forms sent and the codes given in that time; `department`
// keeps one office's.
async function satisfactionResults(prisma, { offices = [], from = null, to = null, department = null } = {}) {
  const rows = (await prisma.csmResponse.findMany({
    where: {
      submission: {
        status: { not: 'SPAM' },
        ...(department ? { department } : {}),
        ...(from ? { createdAt: { gte: from, lt: to } } : {}),
      },
    },
    select: { ...ANSWERS, submission: { select: { department: true, sentiment: true, description: true } } },
  })).map(({ submission, ...answers }) => ({
    ...answers, department: submission.department, sentiment: submission.sentiment, remark: remarkKind(submission.description),
  }));

  const spam = new Set((await prisma.csmResponse.findMany({
    where: { queueCodeId: { not: null }, submission: { status: 'SPAM' } },
    select: { queueCodeId: true },
  })).map(r => r.queueCodeId));
  const codes = (await prisma.queueCode.findMany({
    where: { ...(department ? { department } : {}), ...(from ? { createdAt: { gte: from, lt: to } } : {}) },
    select: { id: true, department: true, usedAt: true, expiresAt: true },
  })).map(c => ({ ...c, answered: Boolean(c.usedAt) && !spam.has(c.id) }));

  const names = [...offices];
  for (const row of [...rows, ...codes]) if (!names.includes(row.department)) names.push(row.department);
  return {
    offices: names.map(name => ({
      department: name,
      ...summarize(rows.filter(row => row.department === name)),
      codes: codeSummary(codes.filter(c => c.department === name)),
    })),
    all: { ...summarize(rows), codes: codeSummary(codes) },
    services: byService(rows),
  };
}

// ?range=month|year|all on the pages: this month or this year on the Philippine
// calendar (up to today), or every answer so far.
function satisfactionRange(query = {}) {
  const range = ['month', 'year'].includes(query.range) ? query.range : 'all';
  if (range === 'all') return { range, from: null, to: null, label: 'All answers so far' };
  const period = parsePeriod({ period: range });
  return { range, from: period.from, to: period.to, label: period.rangeFull };
}

module.exports = { RATINGS, ratingOf, percent, AGE_GROUPS, summarize, codeSummary, satisfactionResults, satisfactionRange };
