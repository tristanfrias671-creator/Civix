const express = require('express');
const router  = express.Router();
const { authenticate, requireAdmin, requireStaff } = require('../middleware/auth');
const { proofUpload } = require('../middleware/upload');
const { requireRealPhotos, refuseLargeBodies } = require('../utils/uploadSafety');
const {
  getStaff, createStaff, updateStaff, deleteStaff,
  getMyStats, getMyAlerts, getMyActivity, getMySubmissions, getMySubmissionDetail, updateMySubmission,
  updateMyUrgency, assignSubmission,
} = require('../controllers/staff');
const { createQueueCode, getMyQueueCodes, getMySatisfaction } = require('../controllers/feedback');
const { createWalkInReport } = require('../controllers/submissions');

// ── Admin-only: manage staff accounts ────────────────────────────────────────
router.get('/',       authenticate, requireAdmin, getStaff);
router.post('/',      authenticate, requireAdmin, createStaff);
router.patch('/:id',  authenticate, requireAdmin, updateStaff);
router.delete('/:id', authenticate, requireAdmin, deleteStaff);

// ── Staff portal: own department ──────────────────────────────────────────────
router.get('/portal/stats',             authenticate, requireStaff, getMyStats);
router.get('/portal/alerts',            authenticate, requireStaff, getMyAlerts);
router.get('/portal/activity',          authenticate, requireStaff, getMyActivity);
router.get('/portal/submissions',       authenticate, requireStaff, getMySubmissions);
// (The Office Map and its /portal/map were removed on Nov 17, 2026: maps are no longer used.)
router.get('/portal/submission/:id',    authenticate, requireStaff, getMySubmissionDetail);
// A status update may carry up to 5 photos of the work (multipart form); the photos
// are saved and checked to be real pictures before the update itself is checked.
router.patch('/portal/submission/:id',  authenticate, requireStaff,
  refuseLargeBodies(26 * 1024 * 1024, 'The photos are too big. Please send at most 5 photos of up to 5 MB each.'),
  proofUpload.array('photos', 5), requireRealPhotos, updateMySubmission);
// How urgent a report is (Urgent / Normal / Can wait), with a reason the citizen sees.
router.patch('/portal/urgency/:id',     authenticate, requireStaff, updateMyUrgency);

// Staff only ever see their own office's reports (and, for the receiving office in
// Settings, reports with no office yet); moving one to another office hands it over.
router.patch('/portal/assign/:id',      authenticate, requireStaff, assignSubmission);

// "Walk-in report": a complaint or suggestion a citizen gave in person, by phone, by
// letter or by message, typed in by the staff member (a slip with its code follows).
router.post('/portal/reports',          authenticate, requireStaff, createWalkInReport);

// "New client": a queuing code for the client's slip, which opens the satisfaction form.
router.post('/portal/queue-codes',      authenticate, requireStaff, createQueueCode);
router.get('/portal/queue-codes',       authenticate, requireStaff, getMyQueueCodes);
// How clients rated the office on that form (totals only).
router.get('/portal/satisfaction',      authenticate, requireStaff, getMySatisfaction);

module.exports = router;
