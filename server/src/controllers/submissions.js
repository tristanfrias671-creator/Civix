const fs = require('fs');
const path = require('path');
const UPLOAD_ROOT = require('../utils/uploadRoot');
const { generateTrackingId } = require('../utils/trackingId');
const { analyzeSentiment } = require('../utils/sentiment');
const { classifyText } = require('../utils/classifier');
const { detectUrgency } = require('../utils/urgencyDetector');
const { emailOfficeStaff } = require('../utils/staffEmails');
const { createLimiter } = require('../utils/rateLimit');
const { networkKey } = require('../utils/clientIp');
const { discardUploads, photoBytes, photoBudget } = require('../utils/uploadSafety');
const { issueTicket, turnstileEnabled } = require('../utils/formGuard');
const { addWorkingDays, deadlineDays } = require('../utils/deadline');
const { ensureSettings, getDepartmentList } = require('./settings');
const { configured: cloudinaryConfigured } = require('../utils/cloudinary');
const { isInCantilan } = require('../utils/cantilanArea');
const {
  readCsm, csmSentiment, resolveRatingCode, refusals, cleanService, CSM_ANSWERS, officeView, wrongRatingCodes, TOO_MANY_WRONG_CODES,
} = require('../utils/csm');
const { remarkKind } = require('../utils/remarks');
const { STAFF_CHANNELS } = require('../utils/channels');
const { officeScope } = require('./staff');

const prisma = require('../utils/prisma');

// The optional map pin as { latitude, longitude }, or null if missing, invalid,
// or outside Cantilan.
function readPin(body) {
  if (body.latitude == null || body.longitude == null || body.latitude === '' || body.longitude === '') return null;
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  return isInCantilan(latitude, longitude) ? { latitude, longitude } : null;
}

// ── Spam protection for new reports ─────────────────────────────────────────
// The route already checked the form ticket, the visitor's network and the
// request size before any photo was saved (routes/submissions.js). Here, once the
// report's text has arrived:
//   - a hidden field people never see must be empty (bots fill in every field),
//   - the form needs a code from the office, and each code opens it once (the
//     citizen's form, createForm, since Nov 10, 2026), so the same form can't be
//     sent twice,
//   - the whole site takes at most SITE_REPORTS_PER_HOUR reports an hour, and a
//     daily amount of photos (PHOTO_MB_PER_DAY).
// A refused report leaves nothing behind: its photos are deleted.
// (Until Nov 17, 2026 each phone number or email could also send only a few reports
// a day; CIVIX no longer asks for either.)
const HOUR_MS = 60 * 60 * 1000;
const SITE_REPORTS_PER_HOUR = Number(process.env.SITE_REPORTS_PER_HOUR) || 300;

const sameText = text => String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();

// Refuses the report: deletes its photos, frees its form ticket (so the person can
// fix it and send again) and answers with the status and message.
function refuse(req, res, status, error, extra = {}) {
  discardUploads(req);
  req.releaseFormTicket?.();
  return res.status(status).json({ error, ...extra });
}

// GET /api/submissions/form-ticket — a ticket for one report (see utils/formGuard),
// plus the Turnstile site key when the "I'm not a robot" check is set up.
function getFormTicket(req, res) {
  res.set('Cache-Control', 'no-store');
  res.json({ ticket: issueTicket(), turnstileSiteKey: turnstileEnabled() ? process.env.TURNSTILE_SITE_KEY : null });
}

async function createSubmission(req, res) {
  try {
    const body = req.body || {};
    // The hidden field: people never see it, so only bots fill it in.
    if (String(body.leave_empty || '').trim()) {
      return refuse(req, res, 400, 'Your report could not be sent. Please reload the page and try again.', { code: 'BOT_CHECK' });
    }
    // Since Nov 10, 2026 citizens send one form, opened with the code from the office
    // (createForm). A complaint or suggestion sent the old way, without a code, is
    // refused: the page it came from is out of date.
    if (body.type === 'FEEDBACK') return await createForm(req, res, body);
    return refuse(req, res, 400, CODE_REQUIRED, { code: 'CODE_REQUIRED' });
  } catch (err) {
    console.error(err);
    if (res.headersSent) return;
    refuse(req, res, 500, 'Your form could not be saved. Please try again.');
  }
}

// ── The citizen's form ──────────────────────────────────────────────────────
// Since Nov 10, 2026 (the panel's request) a citizen sends one form, and only with a
// code from the office: the queuing code on the slip the office gave them ("New
// client" in the staff portal), or the Transaction Code of their resolved complaint
// or suggestion. The code decides the office, and each code opens the form once.
// The form is the ARTA Client Satisfaction Measurement (utils/csm.js) with one box
// at the end for comments, complaints or suggestions. The AI reads what the box is
// (utils/remarks.js), and the citizen may correct it (`remarkType`):
//  - a complaint or a suggestion is also sent to the office as a report, handled
//    like before: its own Transaction Code and deadline (a complaint's urgency is
//    read by the AI from its words);
//  - a comment (thanks, praise) stays with the answers.
// Since Nov 17, 2026 the form asks for no mobile number, email, place, map pin or
// photos: the citizen follows a report with its Transaction Code on Track My Report,
// and CIVIX sends citizens no emails or texts. A copy of the page from before (still
// open in someone's browser) may still send them: its place, pin and photos are
// kept, its mobile number and email are not. The answers are saved as Feedback.
const CODE_REQUIRED = 'Please enter the code from the office first. Complaints and suggestions are sent on the form that the code opens. Please reload the page.';
const REMARK_TYPES = ['COMPLAINT', 'SUGGESTION', 'COMMENT'];
const REPORT_TYPES = ['COMPLAINT', 'SUGGESTION'];
const REPORT_WORD = { COMPLAINT: 'complaint', SUGGESTION: 'suggestion' };

async function createForm(req, res, body) {
  // What the box is: the citizen's choice when they corrected the AI, otherwise the
  // AI's reading. "None", "N/A" or "wala po" is no remark.
  const remark = String(body.description || '').trim();
  if (remark.length > 2000) return refuse(req, res, 400, 'Please keep what you write under 2,000 characters.', { field: 'description' });
  const chosen = REMARK_TYPES.includes(body.remarkType) ? body.remarkType : null;
  const reading = remark ? chosen || remarkKind(remark) : null;
  // Today's page always says what the box is. A copy of the page from before the one
  // form (still open in someone's browser) says nothing and has no mobile number box:
  // as that page told the client, the remark then stays with the answers.
  const olderPage = !chosen && !String(body.contactNumber || '').trim();
  const remarkType = olderPage && REPORT_TYPES.includes(reading) ? 'COMMENT' : reading;
  const reportType = REPORT_TYPES.includes(remarkType) ? remarkType : null;
  const what = REPORT_WORD[reportType];

  let address = '';
  if (reportType) {
    if (remark.length < 20) {
      return refuse(req, res, 400, `Please describe your ${what} in at least 20 characters.`, { code: 'TOO_SHORT', field: 'description' });
    }
    // Only a page from before Nov 17 sends a place (optional; a VARCHAR(191) column).
    address = String(body.address || '').trim();
    if (address.length > 191) return refuse(req, res, 400, 'Please keep the location shorter (191 characters at most).', { field: 'address' });
  }
  // Photos go with a complaint or suggestion only.
  if (!reportType && req.files?.length) {
    discardUploads(req);
    req.files = [];
  }

  const read = readCsm(body.csm);
  if (read.error) return refuse(req, res, 400, read.error, { code: 'CSM_INCOMPLETE', field: read.field });

  const network = networkKey(req);
  if (network != null && wrongRatingCodes.isFull(network)) {
    return refuse(req, res, 429, TOO_MANY_WRONG_CODES, { code: 'RATE_LIMITED' });
  }
  const found = await resolveRatingCode(prisma, body.ratingCode);
  if (found.error) {
    if (found.code === 'CODE_NOT_FOUND' && network != null) wrongRatingCodes.take(network);
    return refuse(req, res, found.status, found.error, { code: found.code });
  }

  // The site's last hour. (A repeat of the same form is stopped by its one-time
  // office code.)
  const siteLastHour = await prisma.submission.count({ where: { createdAt: { gte: new Date(Date.now() - HOUR_MS) } } });
  if (siteLastHour >= SITE_REPORTS_PER_HOUR) {
    return refuse(req, res, 503, 'CIVIX is receiving a lot of reports right now. Please try again in a few minutes.', { code: 'BUSY' });
  }

  const { answers } = read;
  const office = found.department;
  // The office's own words for the service (from the slip) come first.
  const service = found.service || answers.service;
  // The service becomes the first line of a complaint or suggestion, for the office.
  const reportText = service ? `Service: ${service}\n\n${remark}` : remark;

  let photoSize = 0;
  let reportData = null;
  if (reportType) {
    photoSize = photoBytes(req);
    if (photoSize && !photoBudget.fits(photoSize)) {
      return refuse(req, res, 503, 'CIVIX has received a lot of photos today. Please remove your photos and send your form again.',
        { code: 'PHOTOS_FULL' });
    }

    // How urgent a complaint is (Urgent / Normal / Can wait) sets its resolve-by
    // date. The AI reads it from the citizen's words (utils/urgencyDetector.js);
    // suggestions are Normal. The AI's reading of the office is kept for the AI
    // Classification page; the report goes to the code's office.
    const urgency = reportType === 'COMPLAINT' ? detectUrgency(remark) : null;
    const priority = urgency ? urgency.priority : 'STANDARD';
    const days = deadlineDays(await ensureSettings(), reportType, priority);
    const aiResult = classifyText(remark, await getDepartmentList());
    const pin = readPin(body);
    reportData = {
      type: reportType,
      citizenDepartment: office,
      department: office,
      description: reportText,
      address: address || null,
      sentiment: analyzeSentiment(remark),
      priority,
      dueAt: days ? addWorkingDays(new Date(), days) : null,
      location: pin ? { create: pin } : undefined,
      media: req.files?.length
        ? {
            create: req.files.map(f => ({
              filePath: cloudinaryConfigured ? f.path : `/uploads/${f.filename}`,
              fileType: f.mimetype,
            })),
          }
        : undefined,
      aiClassification: {
        create: {
          predictedDepartment: aiResult.department,
          confidence: aiResult.confidence,
          matchedKeywords: JSON.stringify(aiResult.matchedKeywords),
          // The office of the citizen's code, when the AI read another one.
          citizenSelected: aiResult.department !== office ? office : null,
          predictedPriority: urgency ? urgency.priority : null,
          urgencyKeywords: urgency ? JSON.stringify(urgency.words) : null,
        },
      },
    };
  }

  const csm = {
    ...answers,
    service,
    queueCodeId: found.queueCode?.id || null,
    ratedReportId: found.report?.id || null,
  };
  // The code was used a moment ago by someone else (two phones, one slip).
  const codeTaken = found.kind === 'QUEUE'
    ? { status: 409, code: 'CODE_USED', error: refusals.used.error }
    : { status: 409, code: 'ALREADY_RATED', error: refusals.rated.error };

  let feedback;
  let report = null;
  for (let attempt = 0; ; attempt += 1) {
    const feedbackId = await generateTrackingId(prisma, office, attempt);
    let reportId = null;
    if (reportData) {
      do reportId = await generateTrackingId(prisma, office, attempt); while (reportId === feedbackId);
    }
    try {
      [feedback, report] = await prisma.$transaction(async tx => {
        if (found.queueCode) {
          const at = new Date();
          const taken = await tx.queueCode.updateMany({
            where: { id: found.queueCode.id, usedAt: null, expiresAt: { gt: at } },
            data: { usedAt: at },
          });
          if (!taken.count) throw Object.assign(new Error('Code already used'), { refusal: codeTaken });
        }
        const answered = await tx.submission.create({
          data: {
            trackingId: feedbackId,
            type: 'FEEDBACK',
            citizenDepartment: office,
            department: office,
            description: remark,
            sentiment: csmSentiment(answers, remark),
            csm: { create: csm },
          },
          include: { csm: true },
        });
        const sent = reportData
          ? await tx.submission.create({
              data: { trackingId: reportId, ...reportData },
              include: { media: true, aiClassification: true, location: true },
            })
          : null;
        return [answered, sent];
      });
      break;
    } catch (err) {
      if (err.refusal) return refuse(req, res, err.refusal.status, err.refusal.error, { code: err.refusal.code });
      if (err.code === 'P2002') {
        // The report was rated a moment ago, or another report took a tracking ID.
        if (/ratedReportId|queueCodeId/.test(String(err.meta?.target || ''))) {
          return refuse(req, res, codeTaken.status, codeTaken.error, { code: codeTaken.code });
        }
        if (attempt < 8) {
          await new Promise(resolve => setTimeout(resolve, (10 + Math.random() * 50) * (attempt + 1)));
          continue;
        }
      }
      throw err;
    }
  }

  if (report) photoBudget.use(photoSize);
  // The code to keep is the report's when the form had a complaint or suggestion
  // (it has a status to follow); the feedback's is also given.
  res.status(201).json({
    trackingId: (report || feedback).trackingId,
    submission: report || feedback,
    feedback: { trackingId: feedback.trackingId, sentiment: feedback.sentiment, service: feedback.csm?.service || null },
    remarkType,
  });

  // The office's staff are emailed about a complaint or suggestion, and about answers
  // only when the client was not satisfied (Negative). The citizen gets no email: the
  // Transaction Code on the screen is how they follow it.
  emailOfficeStaff(report || feedback);
}

// ── Walk-in reports: typed in by the office's staff ─────────────────────────
// A citizen may give a complaint or suggestion in person, by phone, by letter or by
// message (Facebook, email) instead of online. The office's staff type it in
// ("Walk-in report" in the staff portal), and from then on it is handled like one
// sent online: a Transaction Code, a deadline, the same staff emails and the same
// counts. The staff member gives the citizen a slip with the code. The report goes to
// their own office unless they choose another office on the list, and the AI reads
// how urgent a complaint is from its text, as for reports sent online. Since Nov 17,
// 2026 it asks for no mobile number or email (the place is optional): the citizen
// follows the report with the slip's Transaction Code.
const WALK_IN_PER_HOUR = Number(process.env.WALK_IN_REPORTS_PER_HOUR) || 60;
const walkInsPerStaff = createLimiter({ windowMs: HOUR_MS, max: WALK_IN_PER_HOUR });

// What the slip needs (staff portal).
const slipView = s => ({
  id: s.id, trackingId: s.trackingId, type: s.type, channel: s.channel, department: s.department,
  priority: s.priority, createdAt: s.createdAt, dueAt: s.dueAt,
  service: (/^Service: (.+)\n\n/.exec(s.description || '') || [])[1] || null,
});

// POST /api/staff/portal/reports { channel, type, department, service, description,
// address } — refusals name the `field` to fix. A mobile number or email sent by a
// page from before Nov 17, 2026 is not kept.
async function createWalkInReport(req, res) {
  const refuseField = (error, field, extra = {}) => res.status(400).json({ error, field, ...extra });
  try {
    const scope = await officeScope(req.user.id);
    if (!scope) return res.status(400).json({ error: 'No office is assigned to your account, so you cannot type in reports.' });
    const body = req.body || {};

    const channel = String(body.channel || '').trim();
    if (!STAFF_CHANNELS.includes(channel)) return refuseField('Choose how the report came in.', 'channel');
    const type = String(body.type || '').trim();
    if (type === 'FEEDBACK') {
      return refuseField('Feedback is the satisfaction form: press New client and give the client a slip.', 'type');
    }
    if (type !== 'COMPLAINT' && type !== 'SUGGESTION') return refuseField('Choose Complaint or Suggestion.', 'type');
    // The office's own staff member, or another office on the Settings list they chose.
    const offices = await getDepartmentList();
    const office = String(body.department || '').trim() || scope.department;
    if (!offices.includes(office)) return refuseField('Please choose an office from the list.', 'department', { code: 'NO_OFFICE' });
    const description = String(body.description || '').trim();
    if (description.length < 20) return refuseField('Please write what the citizen said in at least 20 characters.', 'description');
    if (description.length > 2000) return refuseField('Please keep it under 2,000 characters.', 'description');
    // The Citizen's Charter service it is about, as the first line (see createSubmission).
    const service = cleanService(body.service);
    const reportText = service ? `Service: ${service}\n\n${description}` : description;
    const address = String(body.address || '').trim();
    if (address.length > 191) return refuseField('Please keep the location shorter (191 characters at most).', 'address');

    // The same report typed in twice within a day (saved, then typed again by
    // mistake) is not saved again: the first one's slip is shown instead.
    const recent = await prisma.submission.findMany({
      where: { encodedById: req.user.id, type, createdAt: { gte: new Date(Date.now() - 24 * HOUR_MS) } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const duplicate = recent.find(r => sameText(r.description) === sameText(reportText));
    if (duplicate) {
      return res.status(409).json({
        error: `You already typed in this report. Its Transaction Code is ${duplicate.trackingId}.`,
        code: 'DUPLICATE', trackingId: duplicate.trackingId, report: slipView(duplicate),
      });
    }
    if (!walkInsPerStaff.take(req.user.id).ok) {
      return res.status(429).json({ error: `You typed in ${WALK_IN_PER_HOUR} reports in the last hour. Please wait a while before the next one.` });
    }

    const urgency = type === 'COMPLAINT' ? detectUrgency(description) : null;
    const priority = urgency ? urgency.priority : 'STANDARD';
    const aiResult = classifyText(description, offices);
    const days = deadlineDays(await ensureSettings(), type, priority);
    const dueAt = days ? addWorkingDays(new Date(), days) : null;

    let submission;
    for (let attempt = 0; ; attempt += 1) {
      const trackingId = await generateTrackingId(prisma, office, attempt);
      try {
        submission = await prisma.submission.create({
          data: {
            trackingId,
            type,
            channel,
            citizenDepartment: office,
            department: office,
            description: reportText,
            address: address || null,
            sentiment: analyzeSentiment(description),
            priority,
            dueAt,
            encodedById: req.user.id,
            encodedByName: req.user.fullName || req.user.email,
            // Typed in by its own office: already read (Track page).
            readAt: office === scope.department ? new Date() : null,
            aiClassification: {
              create: {
                predictedDepartment: aiResult.department,
                confidence: aiResult.confidence,
                matchedKeywords: JSON.stringify(aiResult.matchedKeywords),
                citizenSelected: office !== aiResult.department ? office : null,
                predictedPriority: urgency ? urgency.priority : null,
                urgencyKeywords: urgency ? JSON.stringify(urgency.words) : null,
              },
            },
          },
        });
        break;
      } catch (err) {
        if (err.code === 'P2002' && attempt < 8) {
          await new Promise(resolve => setTimeout(resolve, (10 + Math.random() * 50) * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }

    res.status(201).json({ trackingId: submission.trackingId, report: slipView(submission) });

    // The office's other staff get the usual email (not the one who typed it in).
    emailOfficeStaff(submission, null, { except: req.user.id });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'The report could not be saved. Please try again.' });
  }
}

// Who may read reports through these routes: admins see every report. Citizens
// have no accounts (they follow a report by its code on the Track page), and staff
// use /api/staff/portal, which shows only their office's reports.
function readableBy(user) {
  if (user?.role === 'ADMIN') return {};
  return null;
}
const STAFF_USE_PORTAL = "Use the staff portal to see your office's reports.";

async function getSubmissions(req, res) {
  try {
    const scope = readableBy(req.user);
    if (!scope) return res.status(403).json({ error: STAFF_USE_PORTAL });
    const { type, status, page = 1, limit = 20 } = req.query;
    const where = { ...scope };
    if (type) where.type = type;
    if (status === 'SPAM') {
      where.status = 'SPAM'; // the Spam view: every type, ready to delete
    } else if (status) {
      where.status = status;
      // Feedback has no status steps, so a status filter
      // lists complaints and suggestions only.
      if (!type) where.type = { not: 'FEEDBACK' };
    } else {
      where.status = { not: 'SPAM' };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [submissions, total] = await Promise.all([
      prisma.submission.findMany({
        where,
        include: {
          location: true,
          media: true,
          aiClassification: true,
          csm: { select: { service: true, sqd0: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.submission.count({ where }),
    ]);

    res.json({ submissions: submissions.map(officeView), total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
}

async function getSubmission(req, res) {
  try {
    const scope = readableBy(req.user);
    if (!scope) return res.status(403).json({ error: STAFF_USE_PORTAL });
    const submission = await prisma.submission.findUnique({
      where: { id: req.params.id },
      include: {
        location: true,
        media: true,
        aiClassification: true,
        // Feedback: the client's answers to the satisfaction form.
        csm: { select: CSM_ANSWERS },
        // Every update from the office, with its proof photos (for the admin's view).
        statusLogs: { orderBy: { createdAt: 'desc' }, take: 50, include: { photos: { orderBy: { createdAt: 'asc' } } } },
      },
    });
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    // Every change the office made to how urgent it is, newest first.
    const urgencyChanges = await prisma.priorityChangeLog.findMany({
      where: { submissionId: submission.id }, orderBy: { createdAt: 'desc' }, take: 50,
    });
    res.json({ ...officeView(submission), urgencyChanges });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch submission' });
  }
}

// Wrong tracking codes per network: older codes run in order (DEPT-YYYYMMDD-0001,
// -0002…), so someone guessing codes to read other people's reports is slowed
// down. A person mistyping their code a few times is never affected.
const wrongCodes = createLimiter({ windowMs: HOUR_MS, max: 20 });

async function trackSubmission(req, res) {
  try {
    const network = networkKey(req); // null when unknown: then not counted
    if (network != null && wrongCodes.isFull(network)) {
      return res.status(429).json({ error: 'Too many transaction codes were not found from this network. Please check your code and try again later.', code: 'RATE_LIMITED' });
    }
    const trackingId = String(req.params.trackingId || '').trim().toUpperCase().slice(0, 40);
    const submission = await prisma.submission.findUnique({
      where: { trackingId },
      // No map pin (latitude/longitude): maps were removed on Nov 17, 2026, so this
      // public page has no use for a report's coordinates.
      include: {
        media: true,
        statusLogs: {
          orderBy: { createdAt: 'desc' },
          select: { status: true, note: true, createdAt: true },
        },
        // Feedback: the service and the overall answer (not who the client is).
        csm: { select: { service: true, sqd0: true } },
      },
    });
    if (!submission) {
      if (network != null) wrongCodes.take(network);
      return res.status(404).json({ error: 'Transaction code not found' });
    }
    // Public endpoint, and older codes are numbered in order (DEPT-YYYYMMDD-0001,
    // -0002…), so never return the citizen's contact details to whoever enters a code,
    // nor which staff member typed in a walk-in report.
    const { userId, contactNumber, email, encodedById, encodedByName, ...safe } = submission;
    // Why staff marked a report as spam (and the note when they put it back) is for
    // the municipality only; the citizen sees "Closed as invalid" without the reason.
    // Logs are newest first, so logs[i + 1] is the entry just before this one.
    safe.statusLogs = submission.statusLogs.map((log, i, logs) =>
      (log.status === 'SPAM' || logs[i + 1]?.status === 'SPAM' ? { ...log, note: null } : log));
    // When the office changed how urgent it is, the citizen sees the change, the new
    // resolve-by date and the office's reason (not who made the change).
    safe.urgencyChanges = await prisma.priorityChangeLog.findMany({
      where: { submissionId: submission.id },
      orderBy: { createdAt: 'desc' },
      select: { fromPriority: true, toPriority: true, toDueAt: true, reason: true, createdAt: true },
    });
    // A resolved complaint or suggestion can be rated once (the satisfaction form,
    // opened with its code): whether it was, and the overall answer given.
    if (submission.status === 'RESOLVED' && submission.type !== 'FEEDBACK') {
      safe.serviceRating = await prisma.csmResponse.findUnique({
        where: { ratedReportId: submission.id }, select: { sqd0: true, createdAt: true },
      });
    }
    res.json(safe);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to track submission' });
  }
}

// ── Spam / Invalid and deleting (administrators) ────────────────────────────
// Staff mark their office's reports as spam or invalid (staff portal). General
// feedback goes to no office, so the administrator marks feedback (feedback sent to
// an office can also be marked by that office's staff). An administrator may then
// delete a report for good, but only one marked as spam; every deletion is kept in
// DeletedReport (who marked it and why, who deleted it, when), without the
// citizen's details.

const byWhom = user => ({ updatedById: user.id, updatedByName: user.fullName || user.email, updatedByRole: user.role });

// PATCH /api/submissions/:id/spam { spam: true|false, reason } — feedback only.
async function setFeedbackSpam(req, res) {
  try {
    const submission = await prisma.submission.findUnique({ where: { id: req.params.id } });
    if (!submission) return res.status(404).json({ error: 'Submission not found' });
    if (submission.type !== 'FEEDBACK') {
      return res.status(400).json({ error: "Complaints and suggestions are marked as spam by their office's staff." });
    }
    const spam = req.body?.spam === true;
    const reason = String(req.body?.reason || '').trim().slice(0, 500);
    if (spam && !reason) return res.status(400).json({ error: 'Please say why this feedback is spam or invalid.' });
    const status = spam ? 'SPAM' : 'PENDING';
    if (status === submission.status) return res.json(officeView(submission));
    const [, updated] = await prisma.$transaction([
      prisma.statusUpdateLog.create({
        data: { submissionId: submission.id, trackingId: submission.trackingId, status, note: spam ? reason : 'Not spam', ...byWhom(req.user) },
      }),
      prisma.submission.update({ where: { id: submission.id }, data: { status } }),
    ]);
    res.json(officeView(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update the feedback' });
  }
}

// DELETE /api/submissions/:id — only reports marked as spam or invalid.
async function deleteSpamReport(req, res) {
  try {
    const submission = await prisma.submission.findUnique({
      where: { id: req.params.id },
      include: { media: true, statusLogs: { where: { status: 'SPAM' }, orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!submission) return res.status(404).json({ error: 'Submission not found' });
    if (submission.status !== 'SPAM') {
      return res.status(400).json({ error: 'Only reports marked as spam or invalid can be deleted.' });
    }
    const marked = submission.statusLogs[0];
    const id = submission.id;
    // The office's proof photos go with their updates (rows by the database's cascade).
    const proofPhotos = await prisma.statusPhoto.findMany({ where: { statusLog: { submissionId: id } }, select: { filePath: true } });
    // Office moves (DepartmentChangeLog) stay in the Audit Log.
    await prisma.$transaction([
      prisma.deletedReport.create({
        data: {
          trackingId: submission.trackingId, type: submission.type, department: submission.department,
          reportCreatedAt: submission.createdAt, markedByName: marked?.updatedByName || null, markedReason: marked?.note || null,
          deletedById: req.user.id, deletedByName: req.user.fullName || req.user.email,
        },
      }),
      prisma.media.deleteMany({ where: { submissionId: id } }),
      prisma.location.deleteMany({ where: { submissionId: id } }),
      prisma.aIClassification.deleteMany({ where: { submissionId: id } }),
      prisma.csmResponse.deleteMany({ where: { submissionId: id } }),
      prisma.statusUpdateLog.deleteMany({ where: { submissionId: id } }),
      prisma.submission.delete({ where: { id } }),
    ]);
    // Its photos on this server go too (copies on Cloudinary are left).
    for (const m of submission.media) {
      if (m.filePath?.startsWith('/uploads/')) fs.unlink(path.join(UPLOAD_ROOT, path.basename(m.filePath)), () => {});
    }
    for (const p of proofPhotos) {
      if (p.filePath?.startsWith('/uploads/proof/')) fs.unlink(path.join(UPLOAD_ROOT, 'proof', path.basename(p.filePath)), () => {});
    }
    res.json({ deleted: true, trackingId: submission.trackingId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete the report' });
  }
}

// GET /api/submissions/deleted — the deletion log, newest first.
async function getDeletedReports(req, res) {
  try {
    res.json(await prisma.deletedReport.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load deleted reports' });
  }
}

// GET /api/submissions/urgency-changes — every change the offices made to how urgent
// a report is, newest first (Audit Log).
async function getUrgencyChanges(req, res) {
  try {
    res.json(await prisma.priorityChangeLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load the urgency changes' });
  }
}

module.exports = {
  createSubmission, createWalkInReport, getFormTicket, getSubmissions, getSubmission, trackSubmission,
  setFeedbackSpam, deleteSpamReport, getDeletedReports, getUrgencyChanges,
};
