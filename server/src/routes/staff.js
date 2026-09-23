const express = require('express');
const router  = express.Router();
const { authenticate, requireAdmin, requireStaff } = require('../middleware/auth');
const {
  getStaff, createStaff, updateStaff, deleteStaff,
  getMyStats, getMySubmissions, getMySubmissionDetail, updateMySubmission,
  monitorSubmissions, assignSubmission, trackByTrackingId,
} = require('../controllers/staff');

// ── Admin-only: manage staff accounts ────────────────────────────────────────
router.get('/',       authenticate, requireAdmin, getStaff);
router.post('/',      authenticate, requireAdmin, createStaff);
router.patch('/:id',  authenticate, requireAdmin, updateStaff);
router.delete('/:id', authenticate, requireAdmin, deleteStaff);

// ── Staff portal: own department ──────────────────────────────────────────────
router.get('/portal/stats',             authenticate, requireStaff, getMyStats);
router.get('/portal/submissions',       authenticate, requireStaff, getMySubmissions);
router.get('/portal/submission/:id',    authenticate, requireStaff, getMySubmissionDetail);
router.patch('/portal/submission/:id',  authenticate, requireStaff, updateMySubmission);

// ── Staff portal: monitor + assign all submissions ────────────────────────────
router.get('/portal/monitor',           authenticate, requireStaff, monitorSubmissions);
router.patch('/portal/assign/:id',      authenticate, requireStaff, assignSubmission);
router.get('/portal/track/:trackingId', authenticate, requireStaff, trackByTrackingId);

module.exports = router;
