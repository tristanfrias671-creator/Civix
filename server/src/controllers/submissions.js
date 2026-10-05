const { generateTrackingId } = require('../utils/trackingId');
const { analyzeSentiment } = require('../utils/sentiment');
const { classifyText, OFFICES } = require('../utils/classifier');
const { sendSubmissionReceivedEmail } = require('../utils/mailer');
const { normalizePhMobile, sendReportReceivedSms, configured: smsConfigured } = require('../utils/sms');
const { createLimiter } = require('../utils/rateLimit');
const { networkKey } = require('../utils/clientIp');
const { discardUploads, photoBytes, photoBudget } = require('../utils/uploadSafety');
const { issueTicket, turnstileEnabled } = require('../utils/formGuard');
const { addWorkingDays, deadlineDays } = require('../utils/deadline');
const { ensureSettings, getDepartmentList } = require('./settings');
const { configured: cloudinaryConfigured } = require('../utils/cloudinary');
const { isInCantilan } = require('../utils/cantilanArea');

const prisma = require('../utils/prisma');

// The optional map pin as { latitude, longitude }, or null if missing, invalid,
// or outside Cantilan.
function readPin(body) {
  if (body.latitude == null || body.longitude == null || body.latitude === '' || body.longitude === '') return null;
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  return isInCantilan(latitude, longitude) ? { latitude, longitude } : null;
}

function sentimentFromFeedback(rating) {
  if (rating >= 4) return 'POSITIVE';
  if (rating <= 2) return 'NEGATIVE';
  return 'NEUTRAL';
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
// The "office" of feedback: it rates the municipality's service as a whole, so it
// goes to no office (staff lists are per office; administrators see all feedback).
const GENERAL_OFFICE = 'General';
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

    const { type, citizenDepartment, rating, reaction, feedbackTags, contactNumber } = body;
    const description = String(body.description || '').trim();
    const email = String(body.email || '').trim();
    const address = String(body.address || '').trim();
    if (!TYPES.includes(type)) return refuse(req, res, 400, 'Please choose the type of report.');
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
    // Feedback rates the municipality's service as a whole: it goes to no office
    // (administrators read it), carries no photos and has no deadline.
    const isFeedback = type === 'FEEDBACK';
    if (isFeedback && req.files?.length) {
      discardUploads(req);
      req.files = [];
    }
    // An office that isn't on the list (a page left open while an office was renamed,
    // or a bot) counts as no office chosen: the receiving office forwards the report.
    const chosen = String(citizenDepartment || '').trim();
    const listed = !isFeedback && chosen && chosen !== 'UNASSIGNED'
      && (OFFICES.includes(chosen) || (await getDepartmentList()).includes(chosen));
    const office = isFeedback ? GENERAL_OFFICE : (listed ? chosen : 'UNASSIGNED');

    let parsedRating = rating ? parseInt(rating, 10) : null;
    let parsedReaction = reaction ? String(reaction).slice(0, 40) : null;
    let parsedTags = null;

    if (type === 'FEEDBACK') {
      if (!parsedRating || parsedRating < 1 || parsedRating > 5) {
        return refuse(req, res, 400, 'Please select a rating from 1 to 5 stars for feedback');
      }
      if (!parsedReaction) {
        return refuse(req, res, 400, 'Please select how you felt about the experience');
      }
      if (feedbackTags) {
        try {
          const tags = typeof feedbackTags === 'string' ? JSON.parse(feedbackTags) : feedbackTags;
          parsedTags = JSON.stringify(Array.isArray(tags) ? tags.slice(0, 8).map(t => String(t).slice(0, 60)) : []);
        } catch {
          parsedTags = null;
        }
      }
    } else {
      parsedRating = null;
      parsedReaction = null;
      parsedTags = null;
    }

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
    const duplicate = recent.find(r => r.type === type && sameText(r.description) === sameText(description));
    if (duplicate) {
      const message = isFeedback
        ? 'You already sent this feedback. Thank you!'
        : `You already sent this report. Its tracking code is ${duplicate.trackingId}.`;
      return refuse(req, res, 409, message, { code: 'DUPLICATE', trackingId: duplicate.trackingId });
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

    const sentiment = type === 'FEEDBACK' && parsedRating
      ? sentimentFromFeedback(parsedRating)
      : analyzeSentiment(description);

    // The office classifier routes complaints and suggestions; feedback isn't routed.
    const aiResult = isFeedback ? null : classifyText(description);

    const finalDepartment = isFeedback || office !== 'UNASSIGNED'
      ? office
      : (aiResult.department !== 'UNASSIGNED' ? aiResult.department : 'UNASSIGNED');

    const citizenOverrode = !isFeedback && office !== 'UNASSIGNED' && office !== aiResult.department;

    const pin = readPin(body);
    // Resolve-by date: working days for this report type, fixed at submission
    // (none for feedback).
    const days = deadlineDays(await ensureSettings(), type);
    const dueAt = days ? addWorkingDays(new Date(), days) : null;

    let submission;
    for (let attempt = 0; ; attempt += 1) {
      const trackingId = await generateTrackingId(prisma, finalDepartment, attempt);
      try {
        submission = await prisma.submission.create({
          data: {
            trackingId,
            type,
            citizenDepartment: office,
            description,
            contactNumber: mobile,
            email,
            address: address || null,
            sentiment,
            rating: parsedRating,
            reaction: parsedReaction,
            feedbackTags: parsedTags,
            department: finalDepartment,
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
            aiClassification: aiResult ? {
              create: {
                predictedDepartment: aiResult.department,
                confidence: aiResult.confidence,
                matchedKeywords: JSON.stringify(aiResult.matchedKeywords),
                citizenSelected: citizenOverrode ? office : null,
              },
            } : undefined,
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

    // Feedback gets a thank-you email (see mailer) and no text: there is no tracking
    // code to follow and no status updates will come.
    if (submission.email && mayReceipt(receipts.emailHour, receipts.emailDay)) sendSubmissionReceivedEmail(submission);
    if (smsConfigured && !isFeedback && mayReceipt(receipts.smsHour, receipts.smsDay)) sendReportReceivedSms(submission);
  } catch (err) {
    console.error(err);
    if (res.headersSent) return;
    refuse(req, res, 500, 'Your report could not be saved. Please try again.');
  }
}

// Who may read reports through these routes: admins see every report, citizens only
// their own. Staff use /api/staff/portal, which shows only their office's reports.
function readableBy(user) {
  if (user?.role === 'ADMIN') return {};
  if (user?.role === 'CITIZEN') return { userId: user.id };
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
    if (status) {
      where.status = status;
      // Feedback has no status steps (no office acts on it), so a status filter
      // lists complaints and suggestions only.
      if (!type) where.type = { not: 'FEEDBACK' };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [submissions, total] = await Promise.all([
      prisma.submission.findMany({
        where,
        include: {
          location: true,
          media: true,
          aiClassification: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.submission.count({ where }),
    ]);

    res.json({ submissions, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
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
      },
    });
    // A citizen asking for someone else's report gets the same answer as a missing one.
    if (!submission || (scope.userId && submission.userId !== scope.userId)) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    res.json(submission);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch submission' });
  }
}

// Wrong tracking codes per network: codes run in order (DEPT-YYYYMMDD-0001,
// -0002…), so someone guessing codes to read other people's reports is slowed
// down. A person mistyping their code a few times is never affected.
const wrongCodes = createLimiter({ windowMs: HOUR_MS, max: 20 });

async function trackSubmission(req, res) {
  try {
    const network = networkKey(req); // null when unknown: then not counted
    if (network != null && wrongCodes.isFull(network)) {
      return res.status(429).json({ error: 'Too many tracking codes were not found from this network. Please check your code and try again later.', code: 'RATE_LIMITED' });
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
      },
    });
    if (!submission) {
      if (network != null) wrongCodes.take(network);
      return res.status(404).json({ error: 'Tracking code not found' });
    }
    // Public endpoint and codes are sequential (DEPT-YYYYMMDD-0001, -0002…), so never
    // return the citizen's contact details to whoever enters a code.
    const { userId, contactNumber, email, ...safe } = submission;
    res.json(safe);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to track submission' });
  }
}

async function getSubmissionsByUser(req, res) {
  try {
    const submissions = await prisma.submission.findMany({
      where: { userId: req.params.userId },
      include: { location: true, media: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(submissions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
}

module.exports = { createSubmission, getFormTicket, getSubmissions, getSubmission, trackSubmission, getSubmissionsByUser };
