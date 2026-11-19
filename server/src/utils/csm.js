// The ARTA Client Satisfaction Measurement (CSM) form (ARTA Memorandum Circular
// 2022-05), as citizens answer it in CIVIX when they send Feedback: who the client
// is, the Citizen's Charter questions (CC1–CC3) and the service quality statements
// (SQD0–SQD8). Also the codes that open the form, and the Positive / Neutral /
// Negative label each answered form gets. The English wording is ARTA's; the
// citizen pages show it in Filipino and Bisaya too (client/src/i18n/csmText.js).
const { getDeptCode, randomPart } = require('./trackingId');
const { analyzeSentiment } = require('./sentiment');
const { remarkKind } = require('./remarks');
const { createLimiter } = require('./rateLimit');

const CLIENT_TYPES = ['CITIZEN', 'BUSINESS', 'GOVERNMENT'];
const CLIENT_TYPE_LABELS = { CITIZEN: 'Citizen', BUSINESS: 'Business', GOVERNMENT: 'Government (employee or another agency)' };
const SEXES = ['MALE', 'FEMALE'];

// Region of residence. Cantilan is in Caraga, so it comes first.
const REGIONS = [
  'Caraga (Region XIII)',
  'National Capital Region (NCR)',
  'Cordillera Administrative Region (CAR)',
  'Ilocos Region (Region I)',
  'Cagayan Valley (Region II)',
  'Central Luzon (Region III)',
  'CALABARZON (Region IV-A)',
  'MIMAROPA (Region IV-B)',
  'Bicol Region (Region V)',
  'Western Visayas (Region VI)',
  'Negros Island Region (NIR)',
  'Central Visayas (Region VII)',
  'Eastern Visayas (Region VIII)',
  'Zamboanga Peninsula (Region IX)',
  'Northern Mindanao (Region X)',
  'Davao Region (Region XI)',
  'SOCCSKSARGEN (Region XII)',
  'Bangsamoro (BARMM)',
  'Outside the Philippines',
];

const CC_QUESTIONS = {
  cc1: {
    text: "Which of the following best describes your awareness of a Citizen's Charter?",
    options: [
      "I know what a Citizen's Charter is and I saw this office's Citizen's Charter.",
      "I know what a Citizen's Charter is but I did NOT see this office's Citizen's Charter.",
      "I learned of the Citizen's Charter only when I saw this office's Citizen's Charter.",
      "I do not know what a Citizen's Charter is and I did not see one in this office.",
    ],
  },
  cc2: {
    text: "If aware of the Citizen's Charter, would you say that the Citizen's Charter of this office was ...?",
    options: ['Easy to see', 'Somewhat easy to see', 'Difficult to see', 'Not visible at all', 'N/A'],
  },
  cc3: {
    text: "If aware of the Citizen's Charter, how much did the Citizen's Charter help you in your transaction?",
    options: ['Helped very much', 'Somewhat helped', 'Did not help', 'N/A'],
  },
};
// The last option of CC2 and CC3 is N/A; a client who doesn't know the Charter
// (CC1 = 4) answers N/A on both.
const CC2_NA = 5;
const CC3_NA = 4;

// The service quality statements, with the part of the service each one measures.
const SQD = ['sqd0', 'sqd1', 'sqd2', 'sqd3', 'sqd4', 'sqd5', 'sqd6', 'sqd7', 'sqd8'];
const SQD_STATEMENTS = {
  sqd0: { dimension: 'Overall', text: 'I am satisfied with the service that I availed.' },
  sqd1: { dimension: 'Responsiveness', text: 'I spent a reasonable amount of time for my transaction.' },
  sqd2: { dimension: 'Reliability', text: "The office followed the transaction's requirements and steps based on the information provided." },
  sqd3: { dimension: 'Access and facilities', text: 'The steps (including payment) I needed to do for my transaction were easy and simple.' },
  sqd4: { dimension: 'Communication', text: 'I easily found information about my transaction from the office or its website.' },
  sqd5: { dimension: 'Costs', text: 'I paid a reasonable amount of fees for my transaction.' },
  sqd6: { dimension: 'Integrity', text: 'I feel the office was fair to everyone, or "walang palakasan", during my transaction.' },
  sqd7: { dimension: 'Assurance', text: 'I was treated courteously by the staff, and (if asked for help) the staff was helpful.' },
  sqd8: { dimension: 'Outcome', text: 'I got what I needed from the government office, or (if denied) denial of request was sufficiently explained to me.' },
};
const ANSWER_LABELS = { 5: 'Strongly agree', 4: 'Agree', 3: 'Neither agree nor disagree', 2: 'Disagree', 1: 'Strongly disagree' };
const answerLabel = value => (value == null ? 'N/A' : ANSWER_LABELS[value] || String(value));

// A whole number from min to max, or null.
function intIn(value, min, max) {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

// What the client came for (typed by the staff member or the client): one line.
function cleanService(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  return text || null;
}

// Reads the answers sent with a feedback (JSON). Returns { answers }, or { error,
// field } for the first question left unanswered. Every SQD statement needs an
// answer (N/A is one: 'NA'); CC2 and CC3 are N/A when CC1 is 4.
function readCsm(raw) {
  let input;
  try {
    input = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    input = null;
  }
  if (!input || typeof input !== 'object') return { error: 'Please answer the satisfaction form.', field: 'clientType' };

  const answers = {};
  if (!CLIENT_TYPES.includes(input.clientType)) {
    return { error: 'Please choose your client type: citizen, business or government.', field: 'clientType' };
  }
  answers.clientType = input.clientType;
  answers.sex = SEXES.includes(input.sex) ? input.sex : null;
  const age = input.age === '' || input.age == null ? null : intIn(input.age, 10, 120);
  if (input.age !== '' && input.age != null && age === null) {
    return { error: 'Please enter your age in years (10 to 120), or leave it empty.', field: 'age' };
  }
  answers.age = age;
  answers.region = REGIONS.includes(input.region) ? input.region : null;
  answers.service = cleanService(input.service);

  answers.cc1 = intIn(input.cc1, 1, 4);
  if (!answers.cc1) return { error: "Please answer CC1 (the Citizen's Charter).", field: 'cc1' };
  if (answers.cc1 === 4) {
    answers.cc2 = CC2_NA;
    answers.cc3 = CC3_NA;
  } else {
    answers.cc2 = intIn(input.cc2, 1, 5);
    if (!answers.cc2) return { error: "Please answer CC2 (the Citizen's Charter).", field: 'cc2' };
    answers.cc3 = intIn(input.cc3, 1, 4);
    if (!answers.cc3) return { error: "Please answer CC3 (the Citizen's Charter).", field: 'cc3' };
  }

  for (const key of SQD) {
    if (input[key] === 'NA') {
      answers[key] = null;
      continue;
    }
    answers[key] = intIn(input[key], 1, 5);
    if (!answers[key]) return { error: `Please answer ${key.toUpperCase()} (choose N/A if it does not apply).`, field: key };
  }
  return { answers };
}

// Positive, Neutral or Negative (Submission.sentiment), from the answer to SQD0, "I
// am satisfied with the service that I availed": Agree or Strongly agree is
// Positive, Neither is Neutral, Disagree or Strongly disagree is Negative. When SQD0
// is N/A, the average of SQD1–SQD8 decides the same way (it is rounded to the
// nearest answer); when all of them are N/A, the words of the client's suggestions
// do, and with no words either it is Neutral.
function csmSentiment(answers, comment) {
  const label = score => (score >= 3.5 ? 'POSITIVE' : score < 2.5 ? 'NEGATIVE' : 'NEUTRAL');
  if (answers.sqd0 != null) return label(answers.sqd0);
  const rated = SQD.slice(1).map(key => answers[key]).filter(value => value != null);
  if (rated.length) return label(rated.reduce((sum, value) => sum + value, 0) / rated.length);
  return comment ? analyzeSentiment(comment) : 'NEUTRAL';
}

// ── Codes that open the form ────────────────────────────────────────────────
// A queuing code, from the office's staff ("New client"), looks like MHO-7K3QP: the
// office, then 5 random letters and digits (the same ones as Transaction Codes, none
// that can be mixed up). A Transaction Code has the date in the middle
// (MHO-20261029-K7Q3); a resolved complaint's or suggestion's code also opens the
// form, to rate how the office handled it.
const QUEUE_CODE_DAYS = 7;
const QUEUE_CODE = /^[A-Z]{2,4}-[2-9A-HJKMNP-Z]{5,7}$/;
const TRANSACTION_CODE = /^[A-Z]{2,4}-\d{8}-[A-Z0-9]{4,8}$/;

// The code as typed: capitals, no spaces; "MHO7K3QP" becomes "MHO-7K3QP".
function normalizeCode(raw) {
  const code = String(raw || '').toUpperCase().replace(/\s+/g, '').slice(0, 40);
  return /^[A-Z]{3}[2-9A-HJKMNP-Z]{5}$/.test(code) ? `${code.slice(0, 3)}-${code.slice(3)}` : code;
}

async function generateQueueCode(prisma, department) {
  const prefix = `${getDeptCode(department)}-`;
  for (let tries = 0; tries < 20; tries++) {
    const code = prefix + randomPart(5);
    if (!(await prisma.queueCode.findUnique({ where: { code }, select: { id: true } }))) return code;
  }
  return prefix + randomPart(7);
}

const TYPE_SERVICE = { COMPLAINT: 'Complaint handling', SUGGESTION: 'Suggestion handling' };

const refusals = {
  notFound: { status: 404, code: 'CODE_NOT_FOUND', error: 'We could not find this code. Please check it and try again.' },
  used: { status: 409, code: 'CODE_USED', error: 'This code was already used. Each code opens the form once.' },
  expired: { status: 410, code: 'CODE_EXPIRED', error: `This code has expired. Codes work for ${QUEUE_CODE_DAYS} days after the visit.` },
  isFeedback: { status: 400, code: 'IS_FEEDBACK', error: 'This is the Transaction Code of a form already sent. Please use the code on the slip from the office.' },
  notResolved: { status: 409, code: 'NOT_RESOLVED', error: 'This report is not resolved yet. Its code opens the form once it is marked Resolved. For a new complaint or suggestion, use the code on the slip from the office.' },
  rated: { status: 409, code: 'ALREADY_RATED', error: 'You already sent the form for this report. Thank you!' },
};

// What a code lets the citizen rate: { kind: 'QUEUE', code, queueCode, department,
// service } for a queuing code, or { kind: 'REPORT', code, report, department,
// service } for a resolved complaint or suggestion; or a refusal ({ status, code,
// error }) when it can't be used.
async function resolveRatingCode(prisma, raw, now = new Date()) {
  const code = normalizeCode(raw);
  if (QUEUE_CODE.test(code)) {
    const queueCode = await prisma.queueCode.findUnique({ where: { code } });
    if (!queueCode) return refusals.notFound;
    if (queueCode.usedAt) return refusals.used;
    if (queueCode.expiresAt <= now) return refusals.expired;
    return { kind: 'QUEUE', code, queueCode, department: queueCode.department, service: queueCode.service };
  }
  if (TRANSACTION_CODE.test(code)) {
    const report = await prisma.submission.findUnique({
      where: { trackingId: code },
      select: { id: true, trackingId: true, type: true, status: true, department: true },
    });
    if (!report) return refusals.notFound;
    if (report.type === 'FEEDBACK') return refusals.isFeedback;
    if (report.status !== 'RESOLVED') return refusals.notResolved;
    if (await prisma.csmResponse.findUnique({ where: { ratedReportId: report.id }, select: { id: true } })) return refusals.rated;
    return { kind: 'REPORT', code, report, department: report.department, service: TYPE_SERVICE[report.type] };
  }
  return refusals.notFound;
}

// A client's answers as the office and the administrators see them: never which
// code they came from, so no one can tell which client gave them.
const CSM_ANSWERS = Object.fromEntries([
  'service', 'clientType', 'sex', 'age', 'region', 'cc1', 'cc2', 'cc3', ...SQD, 'createdAt',
].map(field => [field, true]));

// The answers to the form a complaint or suggestion was sent with. Since Nov 10, 2026
// the one form saves the client's answers (as feedback) and, when the box was read
// as a complaint or suggestion, the report too, both at once (controllers/
// submissions.js, createForm). Nothing in the database links the two, so the answers
// are found by what they share: the office the form went to (an office move doesn't
// change it), the moment (both are saved within the same second) and the client's
// words (the report starts with "Service: ..." when the form named a service). The
// staff's report window shows them as the form the citizen filled in. Null for a
// walk-in report, a report sent before Nov 10, 2026, or feedback (which has its own).
const SAME_FORM_MS = 5000;
async function formAnswersOf(prisma, report) {
  if (!report || !['COMPLAINT', 'SUGGESTION'].includes(report.type)) return null;
  if (report.channel && report.channel !== 'ONLINE') return null;
  const at = new Date(report.createdAt).getTime();
  const answered = await prisma.submission.findMany({
    where: {
      type: 'FEEDBACK',
      citizenDepartment: report.citizenDepartment,
      createdAt: { gte: new Date(at - SAME_FORM_MS), lte: new Date(at + SAME_FORM_MS) },
      csm: { isNot: null },
    },
    select: { description: true, createdAt: true, csm: { select: CSM_ANSWERS } },
    take: 25,
  });
  const words = report.description || '';
  const sameForm = f => f.csm && (words === f.description
    || (f.csm.service != null && words === `Service: ${f.csm.service}\n\n${f.description}`));
  const gap = f => Math.abs(new Date(f.createdAt).getTime() - at);
  const form = answered.filter(sameForm).sort((a, b) => gap(a) - gap(b))[0];
  return form ? form.csm : null;
}

// A report as the pages of the office and of the administrators get it. Since Nov 17,
// 2026 CIVIX asks citizens for no mobile number or email, so these pages never get
// one, not even the ones older reports still have saved (feedback never showed them).
// For feedback, `remark` is the kind of remark the client wrote: a comment, a
// complaint or a suggestion (utils/remarks.js), or null.
const officeView = s => {
  if (!s) return s;
  const view = { ...s, email: null, contactNumber: null };
  if (s.user) view.user = { ...s.user, email: null };
  if (s.type === 'FEEDBACK') view.remark = remarkKind(s.description);
  return view;
};

// Wrong codes per network, on the form and when checking a code: someone trying
// codes to find a working one is slowed down; a person mistyping theirs a few times
// is never affected.
const wrongRatingCodes = createLimiter({ windowMs: 60 * 60 * 1000, max: 20 });
const TOO_MANY_WRONG_CODES = 'Too many codes were not found from this network. Please check your code and try again later.';

module.exports = {
  CLIENT_TYPES, CLIENT_TYPE_LABELS, SEXES, REGIONS, CC_QUESTIONS, SQD, SQD_STATEMENTS, answerLabel,
  QUEUE_CODE_DAYS, cleanService, readCsm, csmSentiment, normalizeCode, generateQueueCode, resolveRatingCode, refusals,
  CSM_ANSWERS, formAnswersOf, officeView, wrongRatingCodes, TOO_MANY_WRONG_CODES,
};
