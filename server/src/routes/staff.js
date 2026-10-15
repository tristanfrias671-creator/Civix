const express = require('express');
const router  = express.Router();
const { authenticate, requireAdmin, requireStaff } = require('../middleware/auth');
const { proofUpload } = require('../middleware/upload');
const { requireRealPhotos, refuseLargeBodies } = require('../utils/uploadSafety');
const {
  getStaff, createStaff, updateStaff, deleteStaff,
  getMyStats, getMyAlerts, getMyActivity, getMySubmissions, getMySubmissionDetail, updateMySubmission,
  updateMyUrgency, assignSubmission, getMyMapReports,
} = require('../controllers/staff');

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
router.get('/portal/map',               authenticate, requireStaff, getMyMapReports);
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

module.exports = router;
