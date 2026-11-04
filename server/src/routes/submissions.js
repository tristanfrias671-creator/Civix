const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { limitRequests } = require('../utils/rateLimit');
const { guardReportForm } = require('../utils/formGuard');
const { requireRealPhotos, refuseLargeBodies } = require('../utils/uploadSafety');
const {
  createSubmission, getFormTicket, getSubmissions, getSubmission,
  trackSubmission, setFeedbackSpam, deleteSpamReport, getDeletedReports, getUrgencyChanges,
} = require('../controllers/submissions');

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// Limits per visitor network for the public pages (see utils/clientIp). Generous
// enough for a help desk where many citizens send reports from one connection.
const reportsPerHour = limitRequests({
  windowMs: HOUR, max: Number(process.env.REPORTS_PER_IP_HOUR) || 20,
  message: wait => `Many reports were sent from this network. Please try again in ${wait}.`,
});
const reportsPerDay = limitRequests({
  windowMs: 24 * HOUR, max: Number(process.env.REPORTS_PER_IP_DAY) || 100,
  message: wait => `Many reports were sent from this network today. Please try again in ${wait}.`,
});
const formTickets = limitRequests({
  windowMs: 10 * MINUTE, max: 60,
  message: wait => `The report form was opened many times. Please try again in ${wait}.`,
});
const trackingSearches = limitRequests({
  windowMs: MINUTE, max: 30,
  message: wait => `Too many tracking searches. Please try again in ${wait}.`,
});

// Public routes (no auth required)
router.get('/form-ticket', formTickets, getFormTicket);
router.get('/track/:trackingId', trackingSearches, trackSubmission);
// A new report passes, in order: the network limits and the size check (nothing
// saved yet), the form ticket and bot check, then the photos are saved and checked
// to be real pictures, then the report itself is checked (controller).
router.post('/',
  reportsPerHour, reportsPerDay,
  refuseLargeBodies(26 * 1024 * 1024, 'Your photos are too big. Please send at most 5 photos of up to 5 MB each.'),
  guardReportForm,
  upload.array('photos', 5),
  requireRealPhotos,
  createSubmission);

// Protected routes (requires login)
router.use(authenticate);
router.get('/', getSubmissions);
router.get('/deleted', requireAdmin, getDeletedReports);
router.get('/urgency-changes', requireAdmin, getUrgencyChanges);
router.get('/:id', getSubmission);
// Admins only view complaints and suggestions (staff update them through
// /api/staff/portal). They may mark feedback as spam (it has no office) and delete
// reports already marked as spam.
router.patch('/:id/spam', requireAdmin, setFeedbackSpam);
router.delete('/:id', requireAdmin, deleteSpamReport);

module.exports = router;
