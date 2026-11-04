// Feedback is the ARTA satisfaction form (utils/csm.js). The office's staff give each
// client a queuing code ("New client" in the staff portal), printed on a slip with
// a QR code that opens the form. Here: checking a code before the citizen answers,
// and the staff's codes. Which code a feedback came from is never shown, so the
// staff can't tell which client gave which answers.
const prisma = require('../utils/prisma');
const { networkKey } = require('../utils/clientIp');
const {
  QUEUE_CODE_DAYS, cleanService, generateQueueCode, resolveRatingCode, wrongRatingCodes, TOO_MANY_WRONG_CODES,
} = require('../utils/csm');
const { satisfactionResults, satisfactionRange } = require('../utils/csmResults');
const { officeScope } = require('./staff');

const DAY_MS = 24 * 60 * 60 * 1000;
const NO_OFFICE = 'No department assigned to your account';

// GET /api/feedback/code/:code — what the code on a client's slip (or a resolved
// report's Transaction Code) lets the citizen rate: the office, and the service
// when the staff member typed it.
async function lookupRatingCode(req, res) {
  try {
    const network = networkKey(req);
    if (network != null && wrongRatingCodes.isFull(network)) {
      return res.status(429).json({ error: TOO_MANY_WRONG_CODES, code: 'RATE_LIMITED' });
    }
    const found = await resolveRatingCode(prisma, req.params.code);
    if (found.error) {
      if (found.code === 'CODE_NOT_FOUND' && network != null) wrongRatingCodes.take(network);
      return res.status(found.status).json({ error: found.error, code: found.code });
    }
    res.json({
      kind: found.kind,
      code: found.code,
      department: found.department,
      service: found.kind === 'QUEUE' ? found.service : null,
      reportType: found.report?.type || null,
      expiresAt: found.queueCode?.expiresAt || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not check the code. Please try again.' });
  }
}

const codeView = c => ({
  id: c.id, code: c.code, department: c.department, service: c.service,
  createdAt: c.createdAt, expiresAt: c.expiresAt, used: Boolean(c.usedAt), createdByName: c.createdByName,
});

// POST /api/staff/portal/queue-codes { service } — a new client at the office: a
// queuing code for their slip (the page draws the QR code and prints the slip).
async function createQueueCode(req, res) {
  try {
    const scope = await officeScope(req.user.id);
    if (!scope) return res.status(400).json({ error: NO_OFFICE });
    const service = cleanService(req.body?.service);
    for (let attempt = 0; ; attempt += 1) {
      const now = new Date();
      try {
        const created = await prisma.queueCode.create({
          data: {
            code: await generateQueueCode(prisma, scope.department),
            department: scope.department,
            service,
            createdById: req.user.id,
            createdByName: req.user.fullName || req.user.email,
            expiresAt: new Date(now.getTime() + QUEUE_CODE_DAYS * DAY_MS),
          },
        });
        return res.status(201).json(codeView(created));
      } catch (err) {
        // Another slip took this code a moment ago.
        if (err.code === 'P2002' && attempt < 5) continue;
        throw err;
      }
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not make a code. Please try again.' });
  }
}

// GET /api/staff/portal/queue-codes — the office's codes from the last few days
// (as long as a code works), newest first: whether each was used, not what the
// client answered.
async function getMyQueueCodes(req, res) {
  try {
    const scope = await officeScope(req.user.id);
    if (!scope) return res.status(400).json({ error: NO_OFFICE });
    const codes = await prisma.queueCode.findMany({
      where: { department: scope.department, createdAt: { gte: new Date(Date.now() - QUEUE_CODE_DAYS * DAY_MS) } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ department: scope.department, days: QUEUE_CODE_DAYS, codes: codes.map(codeView) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load the codes' });
  }
}

// GET /api/staff/portal/satisfaction?range=month|year|all — how clients rated this
// office on the satisfaction form (the totals only, never one client's answers),
// and each service the office's slips named.
async function getMySatisfaction(req, res) {
  try {
    const scope = await officeScope(req.user.id);
    if (!scope) return res.status(400).json({ error: NO_OFFICE });
    const { range, from, to, label } = satisfactionRange(req.query);
    const results = await satisfactionResults(prisma, { offices: [scope.department], department: scope.department, from, to });
    res.json({ range, label, department: scope.department, ...results.offices[0], services: results.services });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load the satisfaction results' });
  }
}

module.exports = { lookupRatingCode, createQueueCode, getMyQueueCodes, getMySatisfaction };
