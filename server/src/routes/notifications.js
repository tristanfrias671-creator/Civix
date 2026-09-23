const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { getNotifications, markAsRead, markAllRead } = require('../controllers/notifications');

router.use(authenticate);
router.get('/', getNotifications);
router.patch('/:id/read', markAsRead);
router.patch('/mark-all-read', markAllRead);

module.exports = router;
