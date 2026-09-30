const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const {
  createSubmission, getSubmissions, getSubmission,
  trackSubmission, getSubmissionsByUser,
} = require('../controllers/submissions');

// Public routes (no auth required)
router.get('/track/:trackingId', trackSubmission);
router.post('/', upload.array('photos', 5), createSubmission);

// Protected routes (requires login)
router.use(authenticate);
router.get('/', getSubmissions);
router.get('/user/:userId', requireAdmin, getSubmissionsByUser);
router.get('/:id', getSubmission);
// No edit route here: admins only view reports; staff update them through /api/staff/portal.

module.exports = router;
