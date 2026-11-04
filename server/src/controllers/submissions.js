const fs = require('fs');
const path = require('path');
const UPLOAD_ROOT = require('../utils/uploadRoot');
const { generateTrackingId } = require('../utils/trackingId');
const { analyzeSentiment } = require('../utils/sentiment');
const { classifyText } = require('../utils/classifier');
const { detectUrgency } = require('../utils/urgencyDetector');
const { sendSubmissionReceivedEmail } = require('../utils/mailer');
const { emailOfficeStaff } = require('../utils/staffEmails');
const { normalizePhMobile, sendReportReceivedSms, configured: smsConfigured } = require('../utils/sms');
const { createLimiter } = require('../utils/rateLimit');
const { networkKey } = require('../utils/clientIp');
const { discardUploads, photoBytes, photoBudget } = require('../utils/uploadSafety');
const { issueTicket, turnstileEnabled } = require('../utils/formGuard');
const { addWorkingDays, deadlineDays } = require('../utils/deadline');
const { ensureSettings, getDepartmentList } = require('./settings');
const { configured: cloudinaryConfigured } = require('../utils/cloudinary');
const { isInCantilan } = require('../utils/cantilanArea');
const {
  readCsm, csmSentiment, resolveRatingCode, cleanService, CSM_ANSWERS, officeView, wrongRatingCodes, TOO_MANY_WRONG_CODES,
} = require('../utils/csm');
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
//   - the same text from the same phone number or email within a day isn't saved
//     twice (the first report's tracking ID is shown instead),
//   - each phone number or email can send a few reports per hour and per day,
//   - the whole site takes at most SITE_REPORTS_PER_HOUR reports an hour, and a
//     daily amount of photos (PHOTO_MB_PER_DAY).
// A refused report leaves nothing behind: its photos are deleted.
const TYPES = ['COMPLAINT', 'SUGGESTION', 'FEEDBACK'];
const HOUR_MS = 60 * 60 * 1000;
const PER_CONTACT_HOUR = Number(process.env.REPORTS_PER_CONTACT_HOUR) || 3;
const PER_CONTACT_DAY = Number(process.env.REPORTS_PER_CONTACT_DAY) || 5;
const SITE_REPORTS_PER_HOUR = Number(process.env.SITE_REPORTS_PER_HOUR) || 300;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Receipt emails and texts for new reports, counted across everyone: a flood of
// reports must not use up the mailbox's sending limit or the SMS phone's load.
// Reports past the cap are still saved, and the tracking ID still shows on screen.
const receipts = {
  emailHour: createLimiter({ windowMs: HOUR_MS, max: Number(process.env.RECEIPT_EMAILS_PER_HOUR) || 60 }),
  emailDay: createLimiter({ windowMs: 24 * HOUR_MS, max: Number(process.env.RECEIPT_EMAILS_PER_DAY) || 400 }),
  smsHour: createLimiter({ windowMs: HOUR_MS, max: Number(process.env.RECEIPT_SMS_PER_HOUR) || 30 }),
  smsDay: createLimiter({ windowMs: 24 * HOUR_MS, max: Number(process.env.RECEIPT_SMS_PER_DAY) || 150 }),
};
// Takes one from the hourly and the daily allowance, or neither.
function mayReceipt(hour, day) {
  if (!hour.take('all').ok) return false;
  if (day.take('all').ok) return true;
  hour.give('all');
  return false;
}

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

    const { type, citizenDepartment, contactNumber } = body;
    if (!TYPES.includes(type)) return refuse(req, res, 400, 'Please choose the type of report.');
    // Feedback is the satisfaction form: a code from the office instead of contact details.
    if (type === 'FEEDBACK') return await createFeedback(req, res, body);
    const description = String(body.description || '').trim();
    // The Citizen's Charter service the report is about ("File a complaint" on the
    // Charter page) becomes its first line, for the office. How urgent the report is
    // and which office fits it are read from the citizen's own words only.
    const service = cleanService(body.service);
    const reportText = service ? `Service: ${service}\n\n${description}` : description;
    const email = String(body.email || '').trim();
    const address = String(body.address || '').trim();
    if (description.length < 20) return refuse(req, res, 400, 'Please describe the problem in at least 20 characters.');
    if (description.length > 2000) return refuse(req, res, 400, 'Please keep the description under 2,000 characters.');
    // Address and email are VARCHAR(191) columns.
    if (address.length > 191) return refuse(req, res, 400, 'Please keep the location shorter (191 characters at most).');
    if (!String(contactNumber || '').trim()) return refuse(req, res, 400, 'Contact number is required');
    // Status updates are texted to this number, so it must be a PH mobile number.
    const mobile = normalizePhMobile(contactNumber);
    if (!mobile) return refuse(req, res, 400, 'Please enter a valid mobile number, e.g. 09171234567');
    if (!email) return refuse(req, res, 400, 'Email address is required');
    if (email.length > 191 || !EMAIL_PATTERN.test(email)) {
      return refuse(req, res, 400, 'Please enter a valid email address, e.g. juan@gmail.com');
    }
    // How urgent a complaint is (Urgent / Normal / Can wait) sets its resolve-by date.
    // The AI reads it from the description (utils/urgencyDetector.js); a priority sent
    // by the page is ignored, so no one can make their own report Urgent. Suggestions
    // are Normal.
    const urgency = type === 'COMPLAINT' ? detectUrgency(description) : null;
    const priority = urgency ? urgency.priority : 'STANDARD';
    // Every report goes straight to one office on the Settings list: the one the
    // citizen confirmed (the page fills it in from the AI's reading of the text).
    // Without one (an office removed in Settings while the page was open, or a bot),
    // the report goes to the office the AI reads from its text, or is refused.
    const offices = await getDepartmentList();
    const chosen = String(citizenDepartment || '').trim();
    const listed = chosen && offices.includes(chosen);
    const aiResult = classifyText(description, offices);
    const office = listed ? chosen : aiResult.department !== 'UNASSIGNED' ? aiResult.department : null;
    if (!office) return refuse(req, res, 400, 'Please choose the office for your report.', { code: 'NO_OFFICE' });

    // What this phone number or email sent in the last day, and the site's last hour.
    const now = Date.now();
    const [recent, siteLastHour] = await Promise.all([
      prisma.submission.findMany({
        where: { OR: [{ contactNumber: mobile }, { email }], createdAt: { gte: new Date(now - 24 * HOUR_MS) } },
        select: { trackingId: true, type: true, description: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.submission.count({ where: { createdAt: { gte: new Date(now - HOUR_MS) } } }),
    ]);
    const duplicate = recent.find(r => r.type === type && sameText(r.description) === sameText(reportText));
    if (duplicate) {
      return refuse(req, res, 409, `You already sent this report. Its transaction code is ${duplicate.trackingId}.`,
        { code: 'DUPLICATE', trackingId: duplicate.trackingId });
    }
    if (recent.filter(r => new Date(r.createdAt).getTime() >= now - HOUR_MS).length >= PER_CONTACT_HOUR) {
      return refuse(req, res, 429, `This phone number or email already sent ${PER_CONTACT_HOUR} reports in the last hour. Please wait a while before sending another.`,
        { code: 'CONTACT_LIMIT' });
    }
    if (recent.length >= PER_CONTACT_DAY) {
      return refuse(req, res, 429, `This phone number or email already sent ${PER_CONTACT_DAY} reports in the last 24 hours. Please try again tomorrow, or visit the municipal office.`,
        { code: 'CONTACT_LIMIT' });
    }
    if (siteLastHour >= SITE_REPORTS_PER_HOUR) {
      return refuse(req, res, 503, 'CIVIX is receiving a lot of reports right now. Please try again in a few minutes.', { code: 'BUSY' });
    }
    const photoSize = photoBytes(req);
    if (photoSize && !photoBudget.fits(photoSize)) {
      return refuse(req, res, 503, 'CIVIX has received a lot of photos today. Please remove your photos and send your report again.',
        { code: 'PHOTOS_FULL' });
    }

    const sentiment = analyzeSentiment(description);

    // The citizen picked another office than the AI's.
    const citizenOverrode = listed && chosen !== aiResult.department;

    const pin = readPin(body);
    // Resolve-by date: working days for this report type and urgency, fixed at
    // submission.
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
            citizenDepartment: office,
            description: reportText,
            contactNumber: mobile,
            email,
            address: address || null,
            sentiment,
            department: office,
            priority,
            dueAt,
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
                citizenSelected: citizenOverrode ? chosen : null,
                predictedPriority: urgency ? urgency.priority : null,
                urgencyKeywords: urgency ? JSON.stringify(urgency.words) : null,
              },
            },
          },
          include: { media: true, aiClassification: true, location: true },
        });
        break;
      } catch (err) {
        // Another report took this tracking ID a moment ago: wait a moment (a
        // different time for each report) and take another.
        if (err.code === 'P2002' && attempt < 8) {
          await new Promise(resolve => setTimeout(resolve, (10 + Math.random() * 50) * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }

    photoBudget.use(photoSize);
    res.status(201).json({ trackingId: submission.trackingId, submission });

    if (submission.email && mayReceipt(receipts.emailHour, receipts.emailDay)) sendSubmissionReceivedEmail(submission);
    if (smsConfigured && mayReceipt(receipts.smsHour, receipts.smsDay)) sendReportReceivedSms(submission);
    // The office's staff get an email about a new complaint or suggestion.
    emailOfficeStaff(submission);
  } catch (err) {
    console.error(err);
    if (res.headersSent) return;
    refuse(req, res, 500, 'Your report could not be saved. Please try again.');
  }
}

// ── Feedback: the ARTA satisfaction form ────────────────────────────────────
// Feedback rates one office's service with the ARTA Client Satisfaction
// Measurement form (utils/csm.js). It needs a code, which decides the office: the
// queuing code on the client's slip from the office, or the Transaction Code of the
// citizen's complaint or suggestion once it is resolved. Each code rates once. The
// citizen stays anonymous: no name or phone number, and the email (for a thank-you
// note with the feedback's own Transaction Code) is optional.
async function createFeedback(req, res, body) {
  // Feedback carries no photos and has no deadline.
  if (req.files?.length) {
    discardUploads(req);
    req.files = [];
  }
  const comment = String(body.description || '').trim();
  if (comment.length > 2000) return refuse(req, res, 400, 'Please keep your suggestions under 2,000 characters.');
  const email = String(body.email || '').trim();
  if (email && (email.length > 191 || !EMAIL_PATTERN.test(email))) {
    return refuse(req, res, 400, 'Please enter a valid email address, e.g. juan@gmail.com, or leave it empty.');
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
  const siteLastHour = await prisma.submission.count({ where: { createdAt: { gte: new Date(Date.now() - HOUR_MS) } } });
  if (siteLastHour >= SITE_REPORTS_PER_HOUR) {
    return refuse(req, res, 503, 'CIVIX is receiving a lot of reports right now. Please try again in a few minutes.', { code: 'BUSY' });
  }

  const { answers } = read;
  const office = found.department;
  const csm = {
    ...answers,
    // The office's own words for the service (from the slip) come first.
    service: found.service || answers.service,
    queueCodeId: found.queueCode?.id || null,
    ratedReportId: found.report?.id || null,
  };
  // The code was used a moment ago by someone else (two phones, one slip).
  const codeTaken = found.kind === 'QUEUE'
    ? { status: 409, code: 'CODE_USED', error: 'This code was already used to rate the service. Each code can be used once.' }
    : { status: 409, code: 'ALREADY_RATED', error: 'You already rated how the office handled this report. Thank you!' };

  let submission;
  for (let attempt = 0; ; attempt += 1) {
    const trackingId = await generateTrackingId(prisma, office, attempt);
    try {
      submission = await prisma.$transaction(async tx => {
        if (found.queueCode) {
          const now = new Date();
          const taken = await tx.queueCode.updateMany({
            where: { id: found.queueCode.id, usedAt: null, expiresAt: { gt: now } },
            data: { usedAt: now },
          });
          if (!taken.count) throw Object.assign(new Error('Code already used'), { refusal: codeTaken });
        }
        return tx.submission.create({
          data: {
            trackingId,
            type: 'FEEDBACK',
            citizenDepartment: office,
            department: office,
            description: comment,
            email: email || null,
            sentiment: csmSentiment(answers, comment),
            csm: { create: csm },
          },
          include: { csm: true },
        });
      });
      break;
    } catch (err) {
      if (err.refusal) return refuse(req, res, err.refusal.status, err.refusal.error, { code: err.refusal.code });
      if (err.code === 'P2002') {
        // The report was rated a moment ago, or another feedback took this tracking ID.
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

  // How the client's suggestions read, for the thank-you page: a problem written out
  // there is offered a complaint even when the ratings are good.
  res.status(201).json({ trackingId: submission.trackingId, submission, commentSentiment: comment ? analyzeSentiment(comment) : null });

  // A thank-you email with its code (see mailer); no texts, as no status updates
  // will come, only "Read by the office" on the Track page. The office's staff are
  // emailed only when the client was not satisfied (Negative).
  if (submission.email && mayReceipt(receipts.emailHour, receipts.emailDay)) sendSubmissionReceivedEmail(submission);
  emailOfficeStaff(submission);
}

// ── Walk-in reports: typed in by the office's staff ─────────────────────────
// A citizen may give a complaint or suggestion in person, by phone, by letter or by
// message (Facebook, email) instead of online. The office's staff type it in
// ("Walk-in report" in the staff portal), and from then on it is handled like one
// sent online: a Transaction Code, a deadline, the same emails and the same counts.
// The staff member gives the citizen a slip with the code. The report goes to their
// own office unless they choose another office on the list, and the AI reads how
// urgent a complaint is from its text, as for reports sent online. The citizen's
// mobile number and email are optional: an older citizen may have neither.
const WALK_IN_PER_HOUR = Number(process.env.WALK_IN_REPORTS_PER_HOUR) || 60;
const walkInsPerStaff = createLimiter({ windowMs: HOUR_MS, max: WALK_IN_PER_HOUR });

// What the slip needs (staff portal).
const slipView = s => ({
  id: s.id, trackingId: s.trackingId, type: s.type, channel: s.channel, department: s.department,
  priority: s.priority, createdAt: s.createdAt, dueAt: s.dueAt,
  service: (/^Service: (.+)\n\n/.exec(s.description || '') || [])[1] || null,
});

// POST /api/staff/portal/reports { channel, type, department, service, description,
// address, contactNumber, email } — refusals name the `field` to fix.
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
    const typedMobile = String(body.contactNumber || '').trim();
    const mobile = typedMobile ? normalizePhMobile(typedMobile) : null;
    if (typedMobile && !mobile) {
      return refuseField('Please enter a valid mobile number, e.g. 09171234567, or leave it empty.', 'contactNumber');
    }
    const email = String(body.email || '').trim();
    if (email && (email.length > 191 || !EMAIL_PATTERN.test(email))) {
      return refuseField('Please enter a valid email address, e.g. juan@gmail.com, or leave it empty.', 'email');
    }

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
            contactNumber: mobile,
            email: email || null,
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

    // The citizen's receipt, when they gave an email or a mobile number. The office's
    // other staff get the usual email (not the one who typed it in).
    if (submission.email && mayReceipt(receipts.emailHour, receipts.emailDay)) sendSubmissionReceivedEmail(submission);
    if (smsConfigured && submission.contactNumber && mayReceipt(receipts.smsHour, receipts.smsDay)) sendReportReceivedSms(submission);
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
      include: {
        location: true,
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
    if (status === submission.status) return res.json(submission);
    const [, updated] = await prisma.$transaction([
      prisma.statusUpdateLog.create({
        data: { submissionId: submission.id, trackingId: submission.trackingId, status, note: spam ? reason : 'Not spam', ...byWhom(req.user) },
      }),
      prisma.submission.update({ where: { id: submission.id }, data: { status } }),
    ]);
    res.json(updated);
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
