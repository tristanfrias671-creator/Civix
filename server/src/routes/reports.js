const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { generatePDF, generateExcel } = require('../controllers/reports');

router.use(authenticate, requireAdmin);
router.get('/pdf', generatePDF);
router.get('/excel', generateExcel);

module.exports = router;
