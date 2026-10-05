const { ensureSettings } = require('./settings');
const {
  sendStaffAccountDecisionEmail, sendAccessRequestAlertEmail, sendAdminAccessDecisionEmail,
} = require('../utils/mailer');

const prisma = require('../utils/prisma');
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

class ReviewConflict extends Error {}

// Emails every active administrator about a new request (their linked Gmail
// if they have one, since the account email may not be a real inbox).
async function notifyAdmins(request) {
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', accountStatus: 'ACTIVE' },
      select: { email: true, gmail: true },
    });
    await Promise.all(admins.map(a => sendAccessRequestAlertEmail(a.gmail || a.email, request)));
  } catch (err) {
    console.error('[access-requests] Could not notify administrators:', err.message);
  }
}

// ── Staff: request administrator access ───────────────────────────────────────

// GET /api/access-requests/mine
async function getMyRequests(req, res) {
  try {
    const [requests, me] = await Promise.all([
      prisma.accessRequest.findMany({
        where: { userId: req.user.id, type: 'ADMIN_ACCESS' },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.user.findUnique({ where: { id: req.user.id }, select: { role: true } }),
    ]);
    // Once the admin role is active, the requester gets the private admin link
    // so they can move to the Admin Portal without asking for it.
    const adminLoginPath = me?.role === 'ADMIN' ? (await ensureSettings()).adminLoginPath : undefined;
    res.json({ requests, adminLoginPath });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load your requests' });
  }
}

// POST /api/access-requests/admin
async function requestAdminAccess(req, res) {
  try {
    const reason = String(req.body.reason || '').trim();
    if (reason.length < 10) {
      return res.status(400).json({ error: 'Please explain in a sentence or two why you need administrator access' });
    }
    if (reason.length > 1000) {
      return res.status(400).json({ error: 'Please keep the reason under 1000 characters' });
    }
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || user.role !== 'STAFF') {
      return res.status(403).json({ error: 'Only staff accounts can request administrator access' });
    }
    const pending = await prisma.accessRequest.findFirst({
      where: { userId: user.id, type: 'ADMIN_ACCESS', status: 'PENDING' },
    });
    if (pending) return res.status(409).json({ error: 'You already have a request waiting for review' });

    const request = await prisma.accessRequest.create({
      data: {
        type: 'ADMIN_ACCESS', userId: user.id,
        fullName: user.fullName, email: user.email, department: user.department, reason,
      },
    });
    notifyAdmins(request);
    res.status(201).json({ request });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send the request' });
  }
}

// ── Admin: review requests ────────────────────────────────────────────────────

// GET /api/access-requests?view=pending|reviewed
// Pending requests carry the account details an administrator checks before approving.
async function listRequests(req, res) {
  try {
    const reviewed = req.query.view === 'reviewed';
    const [requests, pendingCount] = await Promise.all([
      prisma.accessRequest.findMany({
        where: reviewed ? { status: { not: 'PENDING' } } : { status: 'PENDING' },
        orderBy: reviewed ? { reviewedAt: 'desc' } : { createdAt: 'asc' },
        take: 100,
        include: reviewed ? undefined : {
          user: { select: { citizenId: true, createdAt: true, role: true, accountStatus: true } },
        },
      }),
      prisma.accessRequest.count({ where: { status: 'PENDING' } }),
    ]);
    if (!reviewed) {
      const ids = requests.map(r => r.userId).filter(Boolean);
      const updates = ids.length
        ? await prisma.statusUpdateLog.groupBy({ by: ['updatedById'], where: { updatedById: { in: ids } }, _count: true })
        : [];
      const counts = Object.fromEntries(updates.map(u => [u.updatedById, u._count]));
      requests.forEach(r => { r.reportUpdates = counts[r.userId] || 0; });
    }
    res.json({ requests, pendingCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load access requests' });
  }
}

// GET /api/access-requests/pending-count — also names the newest request for the alert.
async function getPendingCount(req, res) {
  try {
    const [count, latest] = await Promise.all([
      prisma.accessRequest.count({ where: { status: 'PENDING' } }),
      prisma.accessRequest.findFirst({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, type: true, fullName: true, createdAt: true },
      }),
    ]);
    res.json({ count, latest });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to count access requests' });
  }
}

// POST /api/access-requests/:id/approve   or   /:id/reject   { note?, verified }
async function reviewRequest(req, res) {
  try {
    const approve = req.params.decision === 'approve';
    const note = String(req.body.note || '').trim().slice(0, 1000) || null;
    if (approve && req.body.verified !== true) {
      return res.status(400).json({ error: 'Confirm that you verified this person before approving' });
    }

    const request = await prisma.accessRequest.findUnique({ where: { id: req.params.id } });
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'PENDING') return res.status(409).json({ error: 'This request has already been reviewed' });

    // The account must still be in the state the request was made from.
    const user = request.userId ? await prisma.user.findUnique({ where: { id: request.userId } }) : null;
    const stillValid = request.type === 'STAFF_ACCOUNT'
      ? user?.accountStatus === 'PENDING'
      : user?.role === 'STAFF' && user?.accountStatus === 'ACTIVE';
    if (approve && !stillValid) {
      return res.status(409).json({ error: 'This account no longer exists or has changed since the request was made, so it can\'t be approved. You can reject the request to close it.' });
    }

    await prisma.$transaction(async tx => {
      // Claiming the request first stops two administrators from deciding it at once.
      const claimed = await tx.accessRequest.updateMany({
        where: { id: request.id, status: 'PENDING' },
        data: {
          status: approve ? 'APPROVED' : 'REJECTED',
          reviewNote: note,
          reviewedById: req.user.id,
          reviewedByName: req.user.fullName,
          reviewedAt: new Date(),
        },
      });
      if (!claimed.count) throw new ReviewConflict();
      if (!stillValid) return;

      if (request.type === 'STAFF_ACCOUNT') {
        if (approve) {
          await tx.user.update({ where: { id: user.id }, data: { accountStatus: 'ACTIVE' } });
        } else {
          // A rejected sign-up never had any data, so the account is removed;
          // the request keeps the name and email for the history.
          await tx.user.delete({ where: { id: user.id } });
        }
      } else {
        if (approve) await tx.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
        await tx.notification.create({
          data: {
            userId: user.id,
            message: approve
              ? 'Your request for administrator access was approved. Your admin role is now active.'
              : `Your request for administrator access was not approved.${note ? ` Note: ${note}` : ''}`,
          },
        });
      }
    });

    const { adminLoginPath } = await ensureSettings();
    if (stillValid) {
      if (request.type === 'STAFF_ACCOUNT') {
        sendStaffAccountDecisionEmail(request, approve, note);
      } else {
        sendAdminAccessDecisionEmail(request, approve, note, `${CLIENT_URL}/${adminLoginPath}`);
      }
    }
    const updated = await prisma.accessRequest.findUnique({ where: { id: request.id } });
    res.json({
      request: updated,
      // Shown to the approving administrator in case the new administrator needs it in person.
      adminLoginPath: approve && request.type === 'ADMIN_ACCESS' ? adminLoginPath : undefined,
    });
  } catch (err) {
    if (err instanceof ReviewConflict) {
      return res.status(409).json({ error: 'This request has already been reviewed' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to review the request' });
  }
}

module.exports = { notifyAdmins, getMyRequests, requestAdminAccess, listRequests, getPendingCount, reviewRequest };
