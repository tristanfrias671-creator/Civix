const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const {
  getPublicProfile,
  getSettings,
  updateSystemProfile,
  updateLists,
} = require('../controllers/settings');

router.get('/public', getPublicProfile);

router.use(authenticate, requireAdmin);
router.get('/', getSettings);
router.patch('/system', updateSystemProfile);
router.patch('/lists', updateLists);

module.exports = router;
