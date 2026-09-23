const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const {
  createSubmission, getSubmissions, getSubmission,
  updateSubmission, trackSubmission, getSubmissionsByUser,
} = require('../controllers/submissions');

// Public routes (no auth required)
router.get('/track/:trackingId', trackSubmission);
router.post('/', upload.array('photos', 5), createSubmission);

// Protected routes (requires login)
router.use(authenticate);
router.get('/', getSubmissions);
router.get('/user/:userId', requireAdmin, getSubmissionsByUser);
router.get('/:id', getSubmission);
router.patch('/:id', requireAdmin, updateSubmission);

module.exports = router;
