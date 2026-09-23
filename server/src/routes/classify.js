const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin, requireStaffOrAdmin } = require('../middleware/auth');
const { classifyText } = require('../utils/classifier');

const prisma = new PrismaClient();

// POST /api/classify  — public: real-time classification while citizen types
router.post('/', (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text is required' });
  }
  const result = classifyText(text.slice(0, 2000)); // cap input length
  res.json(result);
});

// GET /api/classify/submission/:id  — returns saved AI classification for a submission
router.get('/submission/:id', authenticate, requireStaffOrAdmin, async (req, res) => {
  try {
    const rec = await prisma.aIClassification.findUnique({
      where: { submissionId: req.params.id },
    });
    res.json(rec || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch classification' });
  }
});

// GET /api/classify/audit-log  — department change history
router.get('/audit-log', authenticate, requireStaffOrAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [logs, total] = await Promise.all([
      prisma.departmentChangeLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.departmentChangeLog.count(),
    ]);
    res.json({ logs, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

// GET /api/classify/stats  — AI accuracy statistics (admin only)
router.get('/stats', authenticate, requireAdmin, async (req, res) => {
  try {
    const [total, withAI, changes] = await Promise.all([
      prisma.submission.count(),
      prisma.aIClassification.count(),
      prisma.departmentChangeLog.count(),
    ]);

    // Count where AI prediction matches the final assigned department
    const classified = await prisma.aIClassification.findMany({
      select: { predictedDepartment: true, submission: { select: { department: true } } },
    });

    const correct = classified.filter(
      c => c.predictedDepartment === c.submission?.department
    ).length;

    const avgConf = classified.length > 0
      ? Math.round(classified.reduce((s, c) => s + c.confidence, 0) / classified.length)
      : 0;

    res.json({
      total,
      classified: withAI,
      correct,
      accuracy: withAI > 0 ? Math.round((correct / withAI) * 100) : 0,
      avgConfidence: avgConf,
      manualOverrides: changes,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/classify/review  — list of submissions with AI data for admin review
router.get('/review', authenticate, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [records, total] = await Promise.all([
      prisma.aIClassification.findMany({
        include: {
          submission: {
            select: {
              id: true, trackingId: true, description: true,
              department: true, status: true, createdAt: true,
              user: { select: { fullName: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.aIClassification.count(),
    ]);
    res.json({ records, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch review list' });
  }
});

module.exports = router;
