const bcrypt = require('bcryptjs');
const { Prisma } = require('@prisma/client');
const { sendStatusUpdateEmail, sendUrgencyChangeEmail } = require('../utils/mailer');
const { sendStatusUpdateSms } = require('../utils/sms');
const { phDayStart, phMonthStart, deadlineDays, dueAfterUrgencyChange } = require('../utils/deadline');
const { PRIORITIES, PRIORITY_LABELS } = require('../utils/urgency');
const { getDepartmentList, getReceivingOffice, ensureSettings } = require('./settings');
const prisma = require('../utils/prisma');
const { logSignIn } = require('../utils/signInLog');
const { forgetPasswordChange } = require('../middleware/auth');
const { savedPhotoPath } = require('../middleware/upload');
const { discardUploads } = require('../utils/uploadSafety');

const DAY_MS = 24 * 60 * 60 * 1000;
const STATUSES = ['PENDING', 'REVIEWING', 'IN_PROGRESS', 'RESOLVED'];
const TYPES = ['COMPLAINT', 'SUGGESTION', 'FEEDBACK'];
// Spam / Invalid: set by the office's staff, with a reason. Such reports leave every
// list, count, alert and map except the Spam tab; an administrator may delete them.
const SPAM = 'SPAM';
const NOT_SPAM = { status: { not: SPAM } };
const CLOSED = ['RESOLVED', SPAM];
const NEEDS_SPAM_REASON = 'Please say why this report is spam or invalid.';

// Proof of the work: moving a report forward to In Progress or Resolved needs at
// least one photo (of the work being done, or of the finished work or the reply).
// Going back a step doesn't, so a mistake can be undone. While a report stays at
// a step, staff can still post progress photos (a log entry with the same status).
const PROOF_STEPS = ['IN_PROGRESS', 'RESOLVED'];
const NEEDS_PROOF = {
  IN_PROGRESS: 'Add at least one photo that shows the work has started.',
  RESOLVED: 'Add at least one photo that shows the finished work (or the reply that was sent).',
};
const NEEDS_PROGRESS_PHOTO = 'Add at least one photo to post a progress update.';
// Each status update with its proof photos, newest first.
const LOGS_WITH_PHOTOS = { orderBy: { createdAt: 'desc' }, include: { photos: { orderBy: { createdAt: 'asc' } } } };
// What the report window shows of a report.
const REPORT_DETAIL = {
  user: { select: { fullName: true, email: true, citizenId: true } },
  location: true,
  media: true,
  statusLogs: LOGS_WITH_PHOTOS,
};
// Changes to how urgent a report is, newest first (they are kept apart from the
// report, like office moves).
const urgencyChangesOf = submissionId => prisma.priorityChangeLog.findMany({
  where: { submissionId }, orderBy: { createdAt: 'desc' }, take: 50,
});
// The office's reason for changing the urgency is shown to the citizen.
const URGENCY_REASON_MIN = 10;

// A short preview of a report's text for lists.
const excerpt = text => (text && text.length > 140 ? `${text.slice(0, 140).trimEnd()}…` : text || '');

// Which reports a staff member sees and works on: their own office's only, plus,
// for the office that receives reports with no office (Settings), those as well.
// Other offices' reports are never shown to them.
async function officeScope(userId) {
  const [user] = await prisma.$queryRaw`SELECT department FROM User WHERE id = ${userId} LIMIT 1`;
  if (!user?.department) return null;
  const receiving = (await getReceivingOffice()) === user.department;
  return { department: user.department, receiving, departments: receiving ? [user.department, 'UNASSIGNED'] : [user.department] };
}
const inScope = (scope, department) => scope.departments.includes(department);
const NO_OFFICE = 'No department assigned to your account';
const OTHER_OFFICE = 'This report belongs to another office.';

// Use raw SQL to bypass Prisma's stale enum cache (STAFF was added after client generation)

// GET /api/staff
async function getStaff(req, res) {
  try {
    const staff = await prisma.$queryRaw`
      SELECT id, fullName, email, department, role, citizenId, createdAt
      FROM User
      WHERE role = 'STAFF' AND accountStatus = 'ACTIVE'
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
      // A new password from the administrator signs the staff member out everywhere
      // and unlocks the account.
      await prisma.$executeRaw`
        UPDATE User SET password = ${hashed}, passwordChangedAt = ${new Date()}, failedLoginAttempts = 0, lockedUntil = NULL
        WHERE id = ${id}
      `;
      forgetPasswordChange(id);
      const [staffUser] = await prisma.$queryRaw`SELECT id, fullName, email, role FROM User WHERE id = ${id} LIMIT 1`;
      await logSignIn(req, { user: staffUser, outcome: 'PASSWORD_CHANGED', method: 'ADMIN', detail: `Set by ${req.user.fullName || req.user.email}` });
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

// GET /api/staff/portal/stats — stats for the authenticated staff's department.
// `?type=COMPLAINT|SUGGESTION|FEEDBACK` counts only that kind of report.
// Days and months follow the Philippine calendar.
async function getMyStats(req, res) {
  try {
    const scope = await officeScope(req.user.id);
    if (!scope) return res.status(400).json({ error: NO_OFFICE });

    const dept = scope.department;
    const now = new Date();
    const weekAhead = new Date(now.getTime() + 7 * DAY_MS);
    const onlyType = TYPES.includes(req.query.type) ? Prisma.sql`AND type = ${req.query.type}` : Prisma.empty;

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
        SUM(CASE WHEN createdAt >= ${phDayStart(now)} THEN 1 ELSE 0 END) as todayCount,
        SUM(CASE WHEN status<>'RESOLVED' AND dueAt < ${now} THEN 1 ELSE 0 END) as overdue,
        SUM(CASE WHEN status<>'RESOLVED' AND dueAt >= ${now} AND dueAt < ${weekAhead} THEN 1 ELSE 0 END) as dueThisWeek,
        SUM(CASE WHEN status='RESOLVED' AND updatedAt >= ${phMonthStart(now)} THEN 1 ELSE 0 END) as resolvedThisMonth,
        SUM(CASE WHEN department='UNASSIGNED' THEN 1 ELSE 0 END) as unassigned
      FROM Submission
      WHERE department IN (${Prisma.join(scope.departments)}) AND status <> 'SPAM' ${onlyType}
    `;
    const spam = await prisma.submission.count({
      where: { department: { in: scope.departments }, status: SPAM, ...(TYPES.includes(req.query.type) ? { type: req.query.type } : {}) },
    });

    const n = v => Number(v ?? 0);
    res.json({
      department:  dept,
      total:       n(totals.total),
      open:        n(totals.pending) + n(totals.reviewing) + n(totals.inProgress),
      pending:     n(totals.pending),
      reviewing:   n(totals.reviewing),
      inProgress:  n(totals.inProgress),
      resolved:    n(totals.resolved),
      complaints:  n(totals.complaints),
      suggestions: n(totals.suggestions),
      feedbacks:   n(totals.feedbacks),
      todayCount:  n(totals.todayCount),
      overdue:     n(totals.overdue),
      dueThisWeek: n(totals.dueThisWeek),
      resolvedThisMonth: n(totals.resolvedThisMonth),
      // The receiving office also sees reports with no office yet.
      receivingOffice: scope.receiving,
      unassigned: n(totals.unassigned),
      spam,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch department stats' });
  }
}

// GET /api/staff/portal/alerts — what needs this staff member's office now:
// urgent, overdue and due-within-2-days reports, plus new (still Pending) ones.
// Each report appears once, in its most serious group. `counts` (all open and all
// overdue reports in the office) feeds the sidebar.
async function getMyAlerts(req, res) {
  try {
    const scope = await officeScope(req.user.id);
    if (!scope) return res.status(400).json({ error: NO_OFFICE });
    const now = new Date();
    const soon = new Date(now.getTime() + 2 * DAY_MS);
    const open = { department: { in: scope.departments }, status: { notIn: CLOSED } };
    const notUrgent = { priority: { not: 'URGENT' } };
    const select = {
      id: true, trackingId: true, type: true, department: true, status: true,
      priority: true, dueAt: true, createdAt: true, updatedAt: true, description: true,
    };
    const [urgent, overdue, dueSoon, newReports, openCount, overdueCount] = await Promise.all([
      prisma.submission.findMany({ where: { ...open, priority: 'URGENT' }, select, orderBy: { createdAt: 'asc' }, take: 50 }),
      prisma.submission.findMany({ where: { ...open, ...notUrgent, dueAt: { lt: now } }, select, orderBy: { dueAt: 'asc' }, take: 50 }),
      prisma.submission.findMany({ where: { ...open, ...notUrgent, dueAt: { gte: now, lt: soon } }, select, orderBy: { dueAt: 'asc' }, take: 50 }),
      prisma.submission.findMany({
        where: { ...open, ...notUrgent, status: 'PENDING', OR: [{ dueAt: null }, { dueAt: { gte: soon } }] },
        select, orderBy: { createdAt: 'desc' }, take: 50,
      }),
      prisma.submission.count({ where: open }),
      prisma.submission.count({ where: { ...open, dueAt: { lt: now } } }),
    ]);
    const short = list => list.map(s => ({ ...s, description: excerpt(s.description) }));
    res.json({
      department: scope.department, receivingOffice: scope.receiving,
      urgent: short(urgent), overdue: short(overdue), dueSoon: short(dueSoon), newReports: short(newReports),
      total: urgent.length + overdue.length + dueSoon.length + newReports.length,
      counts: { open: openCount, overdue: overdueCount },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load alerts' });
  }
}

// GET /api/staff/portal/submissions — reports in the staff's department.
// Filters: status, type, overdue=1 (open and past the deadline), unassigned=1 (no
// office yet; receiving office only), search (tracking ID, text, citizen name or address).
async function getMySubmissions(req, res) {
  try {
    const scope = await officeScope(req.user.id);
    if (!scope) return res.status(400).json({ error: NO_OFFICE });

    const dept = scope.department;
    const { status, type, sortBy, overdue } = req.query;
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 50);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;
    const search = String(req.query.search || '').trim().slice(0, 100);

    // Build dynamic query with optional filters using Prisma. Spam shows only when
    // asked for (the Spam tab).
    const where = { department: { in: scope.departments }, ...NOT_SPAM };
    if (req.query.unassigned === '1' && scope.receiving) where.department = 'UNASSIGNED';
    if (overdue === '1') {
      where.status = { notIn: CLOSED };
      where.dueAt = { lt: new Date() };
    } else if (STATUSES.includes(status) || status === SPAM) {
      where.status = status;
    }
    if (TYPES.includes(type)) where.type = type;
    if (search) {
      where.OR = [
        { trackingId:  { contains: search } },
        { description: { contains: search } },
        { address:     { contains: search } },
        { user: { fullName: { contains: search } } },
      ];
    }

    const include = { user: { select: { fullName: true, email: true } }, location: true };
    let submissions;
    let total;

    if (sortBy === 'priority' || sortBy === 'due') {
      // Open reports first, ranked by priority or deadline; resolved ones follow,
      // most recently finished first. Priority enum is declared URGENT/STANDARD/LOW,
      // so MySQL sorts it in that order — 'asc' puts urgent reports first.
      const orderBy = sortBy === 'priority'
        ? [{ priority: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }]
        : [{ dueAt: 'asc' }, { createdAt: 'desc' }];
      const openWhere = { AND: [where, { status: { not: 'RESOLVED' } }] };
      const doneWhere = { AND: [where, { status: 'RESOLVED' }] };
      const [openTotal, doneTotal] = await Promise.all([
        prisma.submission.count({ where: openWhere }),
        prisma.submission.count({ where: doneWhere }),
      ]);
      total = openTotal + doneTotal;
      const open = offset < openTotal
        ? await prisma.submission.findMany({ where: openWhere, include, orderBy, skip: offset, take: limit })
        : [];
      const room = limit - open.length;
      const done = room > 0 && doneTotal > 0
        ? await prisma.submission.findMany({
            where: doneWhere, include, orderBy: { updatedAt: 'desc' }, skip: Math.max(0, offset - openTotal), take: room,
          })
        : [];
      submissions = [...open, ...done];
    } else {
      [submissions, total] = await Promise.all([
        prisma.submission.findMany({ where, include, orderBy: { createdAt: 'desc' }, skip: offset, take: limit }),
        prisma.submission.count({ where }),
      ]);
    }

    res.json({ submissions, total, page, pages: Math.max(1, Math.ceil(total / limit)), department: dept });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
}

// GET /api/staff/portal/submission/:id — full detail view (media, location) for a case in staff's dept
async function getMySubmissionDetail(req, res) {
  try {
    const scope = await officeScope(req.user.id);
    if (!scope) return res.status(400).json({ error: NO_OFFICE });

    const submission = await prisma.submission.findUnique({ where: { id: req.params.id }, include: REPORT_DETAIL });
    if (!submission) return res.status(404).json({ error: 'Report not found' });
    if (!inScope(scope, submission.department)) return res.status(403).json({ error: OTHER_OFFICE });

    res.json({ ...submission, urgencyChanges: await urgencyChangesOf(submission.id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch submission' });
  }
}

// PATCH /api/staff/portal/submission/:id — staff update a report of their office:
// { status, note } as JSON, or as a form with up to 5 `photos` of the work.
async function updateMySubmission(req, res) {
  // Photos are saved before this runs; a refused update deletes them again.
  const refuse = (code, body) => { discardUploads(req); return res.status(code).json(body); };
  try {
    const scope = await officeScope(req.user.id);
    if (!scope) return refuse(400, { error: NO_OFFICE });

    const submission = await prisma.submission.findUnique({ where: { id: req.params.id } });
    if (!submission) return refuse(404, { error: 'Report not found' });
    if (!inScope(scope, submission.department)) return refuse(403, { error: OTHER_OFFICE });

    const { status } = req.body;
    const note = String(req.body.note || '').trim().slice(0, 1000);
    if (![...STATUSES, SPAM].includes(status)) return refuse(400, { error: 'Invalid status' });
    if (status === SPAM && status !== submission.status && !note) {
      return refuse(400, { error: NEEDS_SPAM_REASON });
    }

    const statusChanged = status !== submission.status;
    // Marking spam (or putting a report back) takes no photos.
    const photos = status === SPAM || submission.status === SPAM ? [] : (req.files || []);
    if (photos.length < (req.files || []).length) discardUploads(req);
    const forward = STATUSES.indexOf(status) > STATUSES.indexOf(submission.status);
    if (statusChanged && forward && PROOF_STEPS.includes(status) && !photos.length) {
      return refuse(400, { error: NEEDS_PROOF[status], code: 'PROOF_NEEDED' });
    }
    // Same step: a progress update, which needs a photo (a note alone changes nothing).
    const progressUpdate = !statusChanged && status !== SPAM;
    if (progressUpdate && !photos.length) {
      if (note) return refuse(400, { error: NEEDS_PROGRESS_PHOTO, code: 'PROOF_NEEDED' });
      return refuse(400, { error: 'Choose a different step, or add photos to post a progress update.' });
    }

    if (statusChanged || progressUpdate) {
      await prisma.statusUpdateLog.create({
        data: {
          submissionId: submission.id, trackingId: submission.trackingId, status,
          note: note || null,
          updatedById: req.user.id, updatedByName: req.user.fullName || req.user.email, updatedByRole: req.user.role,
          photos: { create: photos.map(file => ({ filePath: savedPhotoPath(file, 'proof') })) },
        },
      });
    }

    const updated = await prisma.submission.update({
      where: { id: req.params.id },
      data:  { status },
      include: REPORT_DETAIL,
    });

    // Notify citizen
    const messages = {
      REVIEWING:   `Your submission ${submission.trackingId} is now being reviewed.`,
      IN_PROGRESS: `Your submission ${submission.trackingId} is now in progress.`,
      RESOLVED:    `Your submission ${submission.trackingId} has been resolved. Thank you!`,
    };
    if (messages[status] && statusChanged) {
      const fullMessage = note ? `${messages[status]} Note: ${note}` : messages[status];
      if (submission.userId) {
        await prisma.notification.create({ data: { userId: submission.userId, message: fullMessage } });
      }
      if (updated.email) sendStatusUpdateEmail(updated, status, note || undefined);
      sendStatusUpdateSms(updated, status);
    }

    res.json({ ...updated, urgencyChanges: await urgencyChangesOf(updated.id) });
  } catch (err) {
    console.error(err);
    discardUploads(req);
    res.status(500).json({ error: 'Failed to update submission' });
  }
}

// PATCH /api/staff/portal/urgency/:id { priority, reason } — the office changes how
// urgent a report is (Urgent / Normal / Can wait; the citizen chose it for a
// complaint). The resolve-by date is counted again (utils/deadline.js). A reason is
// required: the citizen sees it on the Track page and by email, and administrators
// see every change (report page and Audit Log).
async function updateMyUrgency(req, res) {
  try {
    const scope = await officeScope(req.user.id);
    if (!scope) return res.status(400).json({ error: NO_OFFICE });
    const submission = await prisma.submission.findUnique({ where: { id: req.params.id } });
    if (!submission) return res.status(404).json({ error: 'Report not found' });
    if (!inScope(scope, submission.department)) return res.status(403).json({ error: OTHER_OFFICE });
    if (submission.type === 'FEEDBACK') return res.status(400).json({ error: 'Feedback has no urgency or deadline.' });
    if (CLOSED.includes(submission.status)) {
      return res.status(400).json({ error: 'This report is closed, so its urgency can no longer be changed.' });
    }
    const priority = String(req.body.priority || '').trim().toUpperCase();
    if (!PRIORITIES.includes(priority)) return res.status(400).json({ error: 'Choose Urgent, Normal or Can wait.' });
    if (priority === submission.priority) return res.status(400).json({ error: `This report is already ${PRIORITY_LABELS[priority]}.` });
    const reason = String(req.body.reason || '').trim().replace(/\s+/g, ' ').slice(0, 500);
    if (reason.length < URGENCY_REASON_MIN) {
      return res.status(400).json({ error: 'Please say why in a few words. The citizen will see your reason.' });
    }

    const settings = await ensureSettings();
    const dueAt = dueAfterUrgencyChange({
      createdAt: submission.createdAt, dueAt: submission.dueAt,
      from: submission.priority, to: priority, days: deadlineDays(settings, submission.type, priority),
    });
    const [change, updated] = await prisma.$transaction([
      prisma.priorityChangeLog.create({
        data: {
          submissionId: submission.id, trackingId: submission.trackingId,
          fromPriority: submission.priority, toPriority: priority,
          fromDueAt: submission.dueAt, toDueAt: dueAt, reason,
          changedById: req.user.id, changedByName: req.user.fullName || req.user.email, changedByRole: req.user.role,
        },
      }),
      prisma.submission.update({ where: { id: submission.id }, data: { priority, dueAt }, include: REPORT_DETAIL }),
    ]);

    if (submission.userId) {
      await prisma.notification.create({
        data: { userId: submission.userId, message: `Your submission ${submission.trackingId} is now marked ${PRIORITY_LABELS[priority]}. Reason: ${reason}` },
      });
    }
    if (updated.email) sendUrgencyChangeEmail(updated, change);

    res.json({ ...updated, urgencyChanges: await urgencyChangesOf(submission.id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to change the urgency' });
  }
}

// GET /api/staff/portal/activity — what happened in this staff member's office in
// the last 30 days, newest first: reports that arrived, reports moved in or out,
// status updates and urgency changes (with who made them) and deadlines that passed.
async function getMyActivity(req, res) {
  try {
    const scope = await officeScope(req.user.id);
    if (!scope) return res.status(400).json({ error: NO_OFFICE });
    const dept = scope.department;
    const mine = { in: scope.departments };
    const now = new Date();
    const since = new Date(now.getTime() - 30 * DAY_MS);
    const report = { id: true, trackingId: true, type: true, priority: true, reaction: true, department: true, createdAt: true, dueAt: true };

    const [arrived, moves, updates, lapsed, urgencyLogs] = await Promise.all([
      prisma.submission.findMany({ where: { department: mine, ...NOT_SPAM, createdAt: { gte: since } }, select: report, orderBy: { createdAt: 'desc' }, take: 60 }),
      prisma.departmentChangeLog.findMany({
        where: { createdAt: { gte: since }, OR: [{ toDepartment: mine }, { fromDepartment: mine }] },
        orderBy: { createdAt: 'desc' }, take: 60,
      }),
      prisma.statusUpdateLog.findMany({
        where: { createdAt: { gte: since }, submission: { department: mine } },
        include: { submission: { select: { type: true } } }, orderBy: { createdAt: 'desc' }, take: 60,
      }),
      prisma.submission.findMany({
        where: { department: mine, status: { notIn: CLOSED }, dueAt: { gte: since, lt: now } },
        select: report, orderBy: { dueAt: 'desc' }, take: 60,
      }),
      prisma.priorityChangeLog.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: 200 }),
    ]);
    // Urgency changes are kept apart from the reports: keep the ones on this office's reports.
    const ours = new Set((await prisma.submission.findMany({
      where: { id: { in: [...new Set(urgencyLogs.map(u => u.submissionId))] }, department: mine, ...NOT_SPAM },
      select: { id: true },
    })).map(s => s.id));

    // A report that was moved here shows as "moved in", not as a new arrival.
    const movedIn = new Set(moves.filter(m => inScope(scope, m.toDepartment)).map(m => m.submissionId));
    const byWhom = (id, name, role) => ({ by: name, byMe: id === req.user.id, byRole: role });
    const events = [
      ...arrived.filter(s => !movedIn.has(s.id)).map(s => ({
        id: `new:${s.id}`, kind: 'new', at: s.createdAt, submissionId: s.id, trackingId: s.trackingId,
        type: s.type, priority: s.priority, reaction: s.reaction, noOffice: s.department === 'UNASSIGNED',
      })),
      ...moves.map(m => ({
        id: `move:${m.id}`, kind: inScope(scope, m.toDepartment) ? 'movedIn' : 'movedOut', at: m.createdAt,
        submissionId: m.submissionId, trackingId: m.trackingId,
        fromDepartment: m.fromDepartment, toDepartment: m.toDepartment, reason: m.reason,
        ...byWhom(m.changedById, m.changedByName, m.changedByRole),
      })),
      ...updates.map(u => ({
        id: `status:${u.id}`, kind: 'status', at: u.createdAt, submissionId: u.submissionId, trackingId: u.trackingId,
        type: u.submission?.type, status: u.status, note: u.note,
        ...byWhom(u.updatedById, u.updatedByName, u.updatedByRole),
      })),
      ...lapsed.map(s => ({
        id: `overdue:${s.id}`, kind: 'overdue', at: s.dueAt, submissionId: s.id, trackingId: s.trackingId, type: s.type,
      })),
      ...urgencyLogs.filter(u => ours.has(u.submissionId)).slice(0, 60).map(u => ({
        id: `urgency:${u.id}`, kind: 'urgency', at: u.createdAt, submissionId: u.submissionId, trackingId: u.trackingId,
        fromPriority: u.fromPriority, toPriority: u.toPriority, reason: u.reason,
        ...byWhom(u.changedById, u.changedByName, u.changedByRole),
      })),
    ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 80);

    res.json({ department: dept, receivingOffice: scope.receiving, since, events });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load activity' });
  }
}

// GET /api/staff/portal/map — the office's reports for the Office Map (pinned
// ones are drawn; the rest are only counted).
async function getMyMapReports(req, res) {
  try {
    const scope = await officeScope(req.user.id);
    if (!scope) return res.status(400).json({ error: NO_OFFICE });
    const reports = await prisma.submission.findMany({
      where: { department: { in: scope.departments }, ...NOT_SPAM },
      select: {
        id: true, trackingId: true, type: true, status: true, priority: true, description: true, address: true,
        department: true, citizenDepartment: true, createdAt: true, dueAt: true, updatedAt: true,
        location: { select: { latitude: true, longitude: true } },
        user: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    });
    res.json({ department: scope.department, submissions: reports.map(r => ({ ...r, description: excerpt(r.description) })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load the map' });
  }
}

// PATCH /api/staff/portal/assign/:id — move a report to another office and/or set
// its status. Only staff of the report's office may act on it (the receiving office
// for reports with no office yet). Every office move is recorded for the Audit Log
// and the AI Classification Review.
async function assignSubmission(req, res) {
  try {
    const { id } = req.params;
    const { department, status, note, reason } = req.body;

    const existing = await prisma.submission.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Report not found' });

    const scope = await officeScope(req.user.id);
    if (!scope) return res.status(400).json({ error: NO_OFFICE });
    if (!inScope(scope, existing.department)) return res.status(403).json({ error: OTHER_OFFICE });

    const data = {};
    const target = String(department || '').trim();
    if (target && target !== existing.department) {
      if (!(await getDepartmentList()).includes(target)) {
        return res.status(400).json({ error: 'Please choose an office from the list' });
      }
      data.department = target;
    }
    if (status) {
      if (![...STATUSES, SPAM].includes(status)) return res.status(400).json({ error: 'Invalid status' });
      if (status === SPAM && status !== existing.status && !String(note || '').trim()) {
        return res.status(400).json({ error: NEEDS_SPAM_REASON });
      }
      data.status = status;
    }

    if (Object.keys(data).length === 0)
      return res.status(400).json({ error: 'Nothing to update' });

    const statusChanged = status && status !== existing.status;
    const changedBy = { id: req.user.id, name: req.user.fullName || req.user.email, role: req.user.role };

    // One transaction: the status history, the report itself, and the office move record.
    const results = await prisma.$transaction([
      ...(statusChanged ? [prisma.statusUpdateLog.create({
        data: {
          submissionId: existing.id, trackingId: existing.trackingId, status,
          note: note?.trim() || null,
          updatedById: changedBy.id, updatedByName: changedBy.name, updatedByRole: changedBy.role,
        },
      })] : []),
      prisma.submission.update({
        where: { id },
        data,
        include: {
          user: { select: { fullName: true, email: true } }, location: true, media: true,
          statusLogs: { orderBy: { createdAt: 'desc' } },
        },
      }),
      ...(data.department ? [
        prisma.departmentChangeLog.create({
          data: {
            submissionId: existing.id, trackingId: existing.trackingId,
            changedById: changedBy.id, changedByName: changedBy.name, changedByRole: changedBy.role,
            fromDepartment: existing.department, toDepartment: data.department,
            reason: String(reason || '').trim().slice(0, 500) || null,
          },
        }),
        // A person corrected the office the report went to.
        prisma.aIClassification.updateMany({ where: { submissionId: existing.id }, data: { adminCorrected: true } }),
      ] : []),
    ]);
    const updated = results[statusChanged ? 1 : 0];

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
        sendStatusUpdateSms(updated, status);
      }
    }

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to assign submission' });
  }
}

module.exports = {
  getMyAlerts, getMyActivity, getMyMapReports,
  getStaff, createStaff, updateStaff, deleteStaff,
  getMyStats, getMySubmissions, getMySubmissionDetail, updateMySubmission, updateMyUrgency,
  assignSubmission,
};
