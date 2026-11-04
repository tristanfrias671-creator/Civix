const router = require('express').Router();
const { limitRequests } = require('../utils/rateLimit');
const { lookupRatingCode } = require('../controllers/feedback');

// Public: the satisfaction form checks the code on the client's slip before it is
// answered (the answers themselves are sent with POST /api/submissions).
const codeChecks = limitRequests({
  windowMs: 60 * 1000, max: 30,
  message: wait => `Too many code checks. Please try again in ${wait}.`,
});
router.get('/code/:code', codeChecks, lookupRatingCode);

module.exports = router;
