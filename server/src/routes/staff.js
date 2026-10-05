const express = require('express');
const router  = express.Router();
const { authenticate, requireAdmin, requireStaff } = require('../middleware/auth');
const {
  getStaff, createStaff, updateStaff, deleteStaff,
  getMyStats, getMyAlerts, getMyActivity, getMySubmissions, getMySubmissionDetail, updateMySubmission,
  assignSubmission, getMyMapReports,
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
router.patch('/portal/submission/:id',  authenticate, requireStaff, updateMySubmission);

// Staff only ever see their own office's reports (and, for the receiving office in
// Settings, reports with no office yet); moving one to another office hands it over.
router.patch('/portal/assign/:id',      authenticate, requireStaff, assignSubmission);

module.exports = router;
