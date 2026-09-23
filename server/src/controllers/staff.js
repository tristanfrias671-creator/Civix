const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { sendStatusUpdateEmail } = require('../utils/mailer');
const prisma = new PrismaClient();

// Use raw SQL to bypass Prisma's stale enum cache (STAFF was added after client generation)

// GET /api/staff
async function getStaff(req, res) {
  try {
    const staff = await prisma.$queryRaw`
      SELECT id, fullName, email, department, role, citizenId, createdAt
      FROM User
      WHERE role = 'STAFF'
      ORDER BY createdAt DESC
    `;
    res.json(staff);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch staff accounts' });
  }
}

// POST /api/staff
async function createStaff(req, res) {
  try {
    const { fullName, email, password, department } = req.body;

    if (!fullName?.trim() || !email?.trim() || !password || !department?.trim()) {
      return res.status(400).json({ error: 'Full name, email, password, and department are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check duplicate email
    const existing = await prisma.$queryRaw`SELECT id FROM User WHERE email = ${cleanEmail} LIMIT 1`;
    if (existing.length > 0) return res.status(409).json({ error: 'Email is already in use' });

    // Auto-generate unique staff ID
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randPart = Math.random().toString(36).substring(2, 7).toUpperCase();
    const citizenId = `STAFF-${datePart}-${randPart}`;

    const hashed = await bcrypt.hash(password, 12);
    const id = require('crypto').randomUUID().replace(/-/g, '').substring(0, 25);
    const now = new Date();

    await prisma.$executeRaw`
      INSERT INTO User (id, fullName, email, citizenId, password, department, role, createdAt)
      VALUES (${id}, ${fullName.trim()}, ${cleanEmail}, ${citizenId}, ${hashed}, ${department.trim()}, 'STAFF', ${now})
    `;

    const [created] = await prisma.$queryRaw`
      SELECT id, fullName, email, department, role, citizenId, createdAt
      FROM User WHERE id = ${id}
    `;

    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create staff account' });
  }
}

// PATCH /api/staff/:id
async function updateStaff(req, res) {
  try {
    const { id } = req.params;
    const { fullName, email, department, password } = req.body;

    const [existing] = await prisma.$queryRaw`SELECT id, role FROM User WHERE id = ${id} LIMIT 1`;
    if (!existing || existing.role !== 'STAFF') {
      return res.status(404).json({ error: 'Staff account not found' });
    }

    if (email) {
      const cleanEmail = email.trim().toLowerCase();
      const conflict = await prisma.$queryRaw`SELECT id FROM User WHERE email = ${cleanEmail} AND id != ${id} LIMIT 1`;
      if (conflict.length > 0) return res.status(409).json({ error: 'Email is already in use' });
    }

    if (fullName?.trim()) {
      await prisma.$executeRaw`UPDATE User SET fullName = ${fullName.trim()} WHERE id = ${id}`;
    }
    if (email?.trim()) {
      await prisma.$executeRaw`UPDATE User SET email = ${email.trim().toLowerCase()} WHERE id = ${id}`;
    }
    if (department?.trim()) {
      await prisma.$executeRaw`UPDATE User SET department = ${department.trim()} WHERE id = ${id}`;
    }
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
      const hashed = await bcrypt.hash(password, 12);
      await prisma.$executeRaw`UPDATE User SET password = ${hashed} WHERE id = ${id}`;
    }

    const [updated] = await prisma.$queryRaw`
      SELECT id, fullName, email, department, role, citizenId, createdAt
      FROM User WHERE id = ${id}
    `;

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update staff account' });
  }
}

// DELETE /api/staff/:id
async function deleteStaff(req, res) {
  try {
    const { id } = req.params;
    const [existing] = await prisma.$queryRaw`SELECT id, role FROM User WHERE id = ${id} LIMIT 1`;
    if (!existing || existing.role !== 'STAFF') {
      return res.status(404).json({ error: 'Staff account not found' });
    }
    await prisma.$executeRaw`DELETE FROM User WHERE id = ${id}`;
    res.json({ message: 'Staff account deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete staff account' });
  }
}

// ── Staff portal: own department endpoints ────────────────────────────────────

// GET /api/staff/portal/stats — stats for the authenticated staff's department
async function getMyStats(req, res) {
  try {
    const [user] = await prisma.$queryRaw`SELECT department FROM User WHERE id = ${req.user.id} LIMIT 1`;
    if (!user?.department) return res.status(400).json({ error: 'No department assigned to your account' });

    const dept = user.department;

    const [totals] = await prisma.$queryRaw`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status='PENDING'     THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status='REVIEWING'   THEN 1 ELSE 0 END) as reviewing,
        SUM(CASE WHEN status='IN_PROGRESS' THEN 1 ELSE 0 END) as inProgress,
        SUM(CASE WHEN status='RESOLVED'    THEN 1 ELSE 0 END) as resolved,
        SUM(CASE WHEN type='COMPLAINT'     THEN 1 ELSE 0 END) as complaints,
        SUM(CASE WHEN type='SUGGESTION'    THEN 1 ELSE 0 END) as suggestions,
        SUM(CASE WHEN type='FEEDBACK'      THEN 1 ELSE 0 END) as feedbacks,
        SUM(CASE WHEN DATE(createdAt)=CURDATE() THEN 1 ELSE 0 END) as todayCount
      FROM Submission
      WHERE department = ${dept}
    `;

    const n = v => Number(v ?? 0);
    res.json({
      department:  dept,
      total:       n(totals.total),
      pending:     n(totals.pending),
      reviewing:   n(totals.reviewing),
      inProgress:  n(totals.inProgress),
      resolved:    n(totals.resolved),
      complaints:  n(totals.complaints),
      suggestions: n(totals.suggestions),
      feedbacks:   n(totals.feedbacks),
      todayCount:  n(totals.todayCount),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch department stats' });
  }
}

// GET /api/staff/portal/submissions — submissions for the staff's department
async function getMySubmissions(req, res) {
  try {
    const [user] = await prisma.$queryRaw`SELECT department FROM User WHERE id = ${req.user.id} LIMIT 1`;
    if (!user?.department) return res.status(400).json({ error: 'No department assigned' });

    const dept = user.department;
    const { status, type, limit = 20, page = 1, sortBy } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build dynamic query with optional filters using Prisma
    const where = { department: dept };
    if (status) where.status = status;
    if (type)   where.type   = type;

    // Priority enum is declared URGENT/STANDARD/LOW, so MySQL sorts ENUM columns
    // by that declaration order (not alphabetically) — 'asc' naturally puts urgent cases first.
    const orderBy = sortBy === 'priority'
      ? [{ priority: 'asc' }, { createdAt: 'desc' }]
      : { createdAt: 'desc' };

    const [submissions, total] = await Promise.all([
      prisma.submission.findMany({
        where,
        include: { user: { select: { fullName: true, email: true } }, location: true },
        orderBy,
        skip: offset,
        take: parseInt(limit),
      }),
      prisma.submission.count({ where }),
    ]);

    res.json({ submissions, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)), department: dept });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
}

// GET /api/staff/portal/submission/:id — full detail view (media, location) for a case in staff's dept
async function getMySubmissionDetail(req, res) {
  try {
    const [user] = await prisma.$queryRaw`SELECT department FROM User WHERE id = ${req.user.id} LIMIT 1`;
    if (!user?.department) return res.status(400).json({ error: 'No department assigned' });

    const submission = await prisma.submission.findUnique({
      where: { id: req.params.id },
      include: {
        user:       { select: { fullName: true, email: true, citizenId: true } },
        location:   true,
        media:      true,
        statusLogs: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!submission) return res.status(404).json({ error: 'Submission not found' });
    if (submission.department !== user.department) {
      return res.status(403).json({ error: 'This submission does not belong to your department' });
    }

    res.json(submission);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch submission' });
  }
}

// PATCH /api/staff/portal/submission/:id — staff updates status of a submission in their dept
async function updateMySubmission(req, res) {
  try {
    const [user] = await prisma.$queryRaw`SELECT department FROM User WHERE id = ${req.user.id} LIMIT 1`;
    if (!user?.department) return res.status(400).json({ error: 'No department assigned' });

    const submission = await prisma.submission.findUnique({ where: { id: req.params.id } });
    if (!submission) return res.status(404).json({ error: 'Submission not found' });
    if (submission.department !== user.department) {
      return res.status(403).json({ error: 'This submission does not belong to your department' });
    }

    const { status, note } = req.body;
    const allowed = ['PENDING', 'REVIEWING', 'IN_PROGRESS', 'RESOLVED'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const statusChanged = status !== submission.status;

    if (statusChanged) {
      await prisma.statusUpdateLog.create({
        data: {
          submissionId: submission.id, trackingId: submission.trackingId, status,
          note: note?.trim() || null,
          updatedById: req.user.id, updatedByName: req.user.fullName || req.user.email, updatedByRole: req.user.role,
        },
      });
    }

    const updated = await prisma.submission.update({
      where: { id: req.params.id },
      data:  { status },
      include: {
        user: { select: { fullName: true, email: true } }, location: true, media: true,
        statusLogs: { orderBy: { createdAt: 'desc' } },
      },
    });

    // Notify citizen
    const messages = {
      REVIEWING:   `Your submission ${submission.trackingId} is now being reviewed.`,
      IN_PROGRESS: `Your submission ${submission.trackingId} is now in progress.`,
      RESOLVED:    `Your submission ${submission.trackingId} has been resolved. Thank you!`,
    };
    if (messages[status] && statusChanged) {
      const fullMessage = note?.trim() ? `${messages[status]} Note: ${note.trim()}` : messages[status];
      if (submission.userId) {
        await prisma.notification.create({ data: { userId: submission.userId, message: fullMessage } });
      }
      if (updated.email) sendStatusUpdateEmail(updated, status, note?.trim());
    }

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update submission' });
  }
}

// GET /api/staff/portal/monitor — ALL submissions (staff can view + track all)
async function monitorSubmissions(req, res) {
  try {
    const { status, type, department, search, limit = 20, page = 1 } = req.query;
    const where = {};
    if (status)     where.status     = status;
    if (type)       where.type       = type;
    if (department) where.department = department;
    if (search) {
      where.OR = [
        { trackingId:  { contains: search } },
        { description: { contains: search } },
        { user: { fullName: { contains: search } } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [submissions, total] = await Promise.all([
      prisma.submission.findMany({
        where,
        include: {
          user:     { select: { fullName: true, email: true } },
          location: true,
          media:    true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.submission.count({ where }),
    ]);

    res.json({ submissions, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
}

// PATCH /api/staff/portal/assign/:id — assign/reassign department + optional status
async function assignSubmission(req, res) {
  try {
    const { id } = req.params;
    const { department, status, note } = req.body;

    const existing = await prisma.submission.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Submission not found' });

    const data = {};
    if (department?.trim()) data.department = department.trim();
    if (status) {
      const allowed = ['PENDING', 'REVIEWING', 'IN_PROGRESS', 'RESOLVED'];
      if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
      data.status = status;
    }

    if (Object.keys(data).length === 0)
      return res.status(400).json({ error: 'Nothing to update' });

    const statusChanged = status && status !== existing.status;

    if (statusChanged) {
      await prisma.statusUpdateLog.create({
        data: {
          submissionId: existing.id, trackingId: existing.trackingId, status,
          note: note?.trim() || null,
          updatedById: req.user.id, updatedByName: req.user.fullName || req.user.email, updatedByRole: req.user.role,
        },
      });
    }

    const updated = await prisma.submission.update({
      where: { id },
      data,
      include: {
        user: { select: { fullName: true, email: true } }, location: true, media: true,
        statusLogs: { orderBy: { createdAt: 'desc' } },
      },
    });

    // Notify citizen if status changed
    if (statusChanged) {
      const messages = {
        REVIEWING:   `Your submission ${existing.trackingId} is now being reviewed.`,
        IN_PROGRESS: `Your submission ${existing.trackingId} is now in progress.`,
        RESOLVED:    `Your submission ${existing.trackingId} has been resolved. Thank you!`,
      };
      if (messages[status]) {
        const fullMessage = note?.trim() ? `${messages[status]} Note: ${note.trim()}` : messages[status];
        if (existing.userId) {
          await prisma.notification.create({ data: { userId: existing.userId, message: fullMessage } });
        }
        if (updated.email) sendStatusUpdateEmail(updated, status, note?.trim());
      }
    }

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to assign submission' });
  }
}

// GET /api/staff/portal/track/:trackingId — track a single submission by ID
async function trackByTrackingId(req, res) {
  try {
    const submission = await prisma.submission.findUnique({
      where: { trackingId: req.params.trackingId },
      include: {
        user:       { select: { fullName: true, email: true, citizenId: true } },
        location:   true,
        media:      true,
        statusLogs: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!submission) return res.status(404).json({ error: 'Tracking ID not found' });
    res.json(submission);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to track submission' });
  }
}

module.exports = {
  getStaff, createStaff, updateStaff, deleteStaff,
  getMyStats, getMySubmissions, getMySubmissionDetail, updateMySubmission,
  monitorSubmissions, assignSubmission, trackByTrackingId,
};
