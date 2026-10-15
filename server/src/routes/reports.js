const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { generatePDF, generateExcel, getReportPeriods } = require('../controllers/reports');

// ?period=week|month|year|all&date=YYYY-MM-DD picks what a report covers.
router.use(authenticate, requireAdmin);
router.get('/periods', getReportPeriods);
router.get('/pdf', generatePDF);
router.get('/excel', generateExcel);

module.exports = router;
