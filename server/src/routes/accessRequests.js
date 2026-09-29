const router = require('express').Router();
const { authenticate, requireAdmin, requireStaff } = require('../middleware/auth');
const {
  getMyRequests, requestAdminAccess, listRequests, getPendingCount, reviewRequest,
} = require('../controllers/accessRequests');

// Staff portal
router.get('/mine', authenticate, requireStaff, getMyRequests);
router.post('/admin', authenticate, requireStaff, requestAdminAccess);

// Admin portal
router.get('/', authenticate, requireAdmin, listRequests);
router.get('/pending-count', authenticate, requireAdmin, getPendingCount);
router.post('/:id/:decision(approve|reject)', authenticate, requireAdmin, reviewRequest);

module.exports = router;
