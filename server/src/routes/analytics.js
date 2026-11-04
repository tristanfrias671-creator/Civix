const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const {
  getAlerts,
  getSummary,
  getQuarterly,
  getSentiment,
  getMonthly,
  getBreakdown,
  getOfficeUpdates,
  getSatisfaction,
} = require('../controllers/analytics');

router.use(authenticate, requireAdmin);
router.get('/alerts', getAlerts);
router.get('/office-updates', getOfficeUpdates);
router.get('/summary', getSummary);
router.get('/quarterly', getQuarterly);
router.get('/sentiment', getSentiment);
router.get('/monthly', getMonthly);
router.get('/breakdown', getBreakdown);
router.get('/satisfaction', getSatisfaction);

module.exports = router;
