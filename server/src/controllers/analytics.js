const prisma = require('../utils/prisma');
const { PRIORITY_LABELS } = require('../utils/urgency');
const { satisfactionResults, satisfactionRange } = require('../utils/csmResults');
const { CHANNELS, CHANNEL_LABELS } = require('../utils/channels');
const { getDepartmentList } = require('./settings');

// Reports staff marked as spam or invalid (status SPAM) are left out of every
// figure, chart and alert here.
const NOT_SPAM = { status: { not: 'SPAM' } };
const CLOSED = ['RESOLVED', 'SPAM'];

// Year and month (1-12) on the Philippine calendar. The server clock may be UTC,
// where a report filed early on the 1st (PH time) still falls in the month before.
const PH_MONTH = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: 'numeric' });
function phYearMonth(date) {
  const parts = Object.fromEntries(PH_MONTH.formatToParts(date).map(p => [p.type, p.value]));
  return { year: Number(parts.year), month: Number(parts.month) };
}

// GET /api/analytics/alerts — what needs an administrator's attention right now:
// unresolved reports that are urgent, overdue or due within 2 days, plus pending
// access requests. Worked out live, so an item disappears as soon as it's handled.
async function getAlerts(req, res) {
  try {
    const now = new Date();
    const soon = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    // Feedback has no workflow (no status steps or deadline), so it never needs attention here.
    const open = { status: { notIn: CLOSED }, type: { not: 'FEEDBACK' } };
    const select = {
      id: true, trackingId: true, type: true, department: true, status: true,
      priority: true, dueAt: true, createdAt: true, updatedAt: true,
    };
    const [urgent, overdue, dueSoon, accessRequests] = await Promise.all([
      prisma.submission.findMany({ where: { ...open, priority: 'URGENT' }, select, orderBy: { createdAt: 'asc' }, take: 50 }),
      prisma.submission.findMany({ where: { ...open, priority: { not: 'URGENT' }, dueAt: { lt: now } }, select, orderBy: { dueAt: 'asc' }, take: 50 }),
      prisma.submission.findMany({ where: { ...open, priority: { not: 'URGENT' }, dueAt: { gte: now, lt: soon } }, select, orderBy: { dueAt: 'asc' }, take: 50 }),
      prisma.accessRequest.findMany({
        where: { status: 'PENDING' },
        select: { id: true, type: true, fullName: true, department: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    res.json({
      urgent, overdue, dueSoon, accessRequests,
      total: urgent.length + overdue.length + dueSoon.length + accessRequests.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load alerts' });
  }
}

async function getSummary(req, res) {
  try {
    // Feedback has no workflow (no status steps or deadline), so
    // the case figures (pending, resolved, overdue, response rate, resolution time)
    // count complaints and suggestions only. The total counts every submission.
    const cases = { type: { not: 'FEEDBACK' }, ...NOT_SPAM };
    const [total, caseTotal, pending, reviewing, inProgress, resolved, overdue] = await Promise.all([
      prisma.submission.count({ where: NOT_SPAM }),
      prisma.submission.count({ where: cases }),
      prisma.submission.count({ where: { ...cases, status: 'PENDING' } }),
      prisma.submission.count({ where: { ...cases, status: 'REVIEWING' } }),
      prisma.submission.count({ where: { ...cases, status: 'IN_PROGRESS' } }),
      prisma.submission.count({ where: { ...cases, status: 'RESOLVED' } }),
      // Past their resolve-by date and not yet resolved.
      prisma.submission.count({ where: { ...cases, status: { notIn: CLOSED }, dueAt: { lt: new Date() } } }),
    ]);

    const resolvedSubmissions = await prisma.submission.findMany({
      where: { ...cases, status: 'RESOLVED' },
      select: { createdAt: true, updatedAt: true },
    });

    let avgResolutionTime = 0;
    if (resolvedSubmissions.length) {
      const totalMs = resolvedSubmissions.reduce((sum, s) => {
        return sum + (s.updatedAt.getTime() - s.createdAt.getTime());
      }, 0);
      avgResolutionTime = parseFloat((totalMs / resolvedSubmissions.length / (1000 * 60 * 60 * 24)).toFixed(1));
    }

    const responseRate = caseTotal > 0 ? parseFloat(((caseTotal - pending) / caseTotal * 100).toFixed(1)) : 0;

    // Urgent reports: how many are still open, and how many of the resolved ones were
    // finished by their resolve-by date (the same rule as the deadline badges).
    const [urgentOpen, urgentDone] = await Promise.all([
      prisma.submission.count({ where: { ...cases, priority: 'URGENT', status: { notIn: CLOSED } } }),
      prisma.submission.findMany({ where: { ...cases, priority: 'URGENT', status: 'RESOLVED' }, select: { updatedAt: true, dueAt: true } }),
    ]);
    const urgentOnTime = urgentDone.filter(s => !s.dueAt || s.updatedAt <= s.dueAt).length;

    res.json({
      total, pending, reviewing, inProgress, resolved, overdue, avgResolutionTime, responseRate,
      urgentOpen, urgentResolved: urgentDone.length, urgentOnTime,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch analytics summary' });
  }
}

async function getQuarterly(req, res) {
  try {
    const submissions = await prisma.submission.findMany({
      where: NOT_SPAM,
      select: { createdAt: true, type: true },
      orderBy: { createdAt: 'asc' },
    });

    const quarterly = {};
    for (const s of submissions) {
      const { year, month } = phYearMonth(s.createdAt);
      const q = Math.ceil(month / 3);
      const key = `${year} Q${q}`;
      if (!quarterly[key]) quarterly[key] = { label: key, COMPLAINT: 0, SUGGESTION: 0, FEEDBACK: 0, total: 0 };
      quarterly[key][s.type]++;
      quarterly[key].total++;
    }

    res.json(Object.values(quarterly));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch quarterly data' });
  }
}

async function getSentiment(req, res) {
  try {
    const [positive, neutral, negative] = await Promise.all([
      prisma.submission.count({ where: { ...NOT_SPAM, sentiment: 'POSITIVE' } }),
      prisma.submission.count({ where: { ...NOT_SPAM, sentiment: 'NEUTRAL' } }),
      prisma.submission.count({ where: { ...NOT_SPAM, sentiment: 'NEGATIVE' } }),
    ]);
    res.json([
      { name: 'Positive', value: positive, color: '#16A34A' },
      { name: 'Neutral', value: neutral, color: '#6B7280' },
      { name: 'Negative', value: negative, color: '#DC2626' },
    ]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch sentiment data' });
  }
}

// GET /api/analytics/office-updates?limit=6 — the offices' latest status updates,
// newest first, with the photos staff attached as proof of the work (Dashboard).
async function getOfficeUpdates(req, res) {
  try {
    const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 6));
    const updates = await prisma.statusUpdateLog.findMany({
      where: { updatedByRole: 'STAFF', status: { not: 'SPAM' }, submission: NOT_SPAM },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, status: true, note: true, createdAt: true, updatedByName: true, submissionId: true, trackingId: true,
        submission: { select: { type: true, department: true, status: true } },
        photos: { select: { id: true, filePath: true }, orderBy: { createdAt: 'asc' } },
      },
    });
    res.json(updates);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load the latest office updates' });
  }
}

async function getMonthly(req, res) {
  try {
    const submissions = await prisma.submission.findMany({
      where: NOT_SPAM,
      select: { createdAt: true, type: true },
      orderBy: { createdAt: 'asc' },
    });

    // The last 12 months on the Philippine calendar, oldest first, keyed "2026-10".
    const months = {};
    const now = phYearMonth(new Date());
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(now.year, now.month - 1 - i, 1));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en-US', { timeZone: 'UTC', month: 'short', year: 'numeric' });
      months[key] = { label, key, total: 0, COMPLAINT: 0, SUGGESTION: 0, FEEDBACK: 0 };
    }

    for (const s of submissions) {
      const { year, month } = phYearMonth(s.createdAt);
      const key = `${year}-${String(month).padStart(2, '0')}`;
      if (!months[key]) continue;
      months[key].total++;
      months[key][s.type]++;
    }

    res.json(Object.values(months));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch monthly data' });
  }
}

async function getBreakdown(req, res) {
  try {
    const submissions = await prisma.submission.findMany({
      where: NOT_SPAM,
      select: { department: true, priority: true, type: true, citizenDepartment: true, status: true, channel: true },
    });

    const department = {};
    const priority = {};
    const type = {};
    const citizenDeptMap = {};
    // How complaints and suggestions came in: online, or typed in by the office's
    // staff (feedback is always the online satisfaction form).
    const channel = {};

    const deptLabels = {
      PUBLIC_SAFETY: 'Public Safety',
      SANITATION: 'Sanitation',
      INFRASTRUCTURE: 'Infrastructure',
      HEALTH: 'Health',
      UNASSIGNED: 'Unassigned',
    };
    const priorityLabels = PRIORITY_LABELS;
    const typeLabels = { COMPLAINT: 'Complaint', SUGGESTION: 'Suggestion', FEEDBACK: 'Feedback' };

    for (const s of submissions) {
      department[s.department] = (department[s.department] || 0) + 1;
      // Feedback has no urgency.
      if (s.type !== 'FEEDBACK') priority[s.priority] = (priority[s.priority] || 0) + 1;
      if (s.type !== 'FEEDBACK') channel[s.channel] = (channel[s.channel] || 0) + 1;
      type[s.type] = (type[s.type] || 0) + 1;
      citizenDeptMap[s.citizenDepartment] = (citizenDeptMap[s.citizenDepartment] || 0) + 1;
    }

    const toChart = (obj, labels, colors) =>
      Object.entries(obj)
        .map(([key, value]) => ({
          name: labels[key] || key.replace(/_/g, ' '),
          value,
          color: colors[key] || '#6B7280',
        }))
        .sort((a, b) => b.value - a.value);

    const deptColors = {
      PUBLIC_SAFETY: '#DC2626',
      SANITATION: '#16A34A',
      INFRASTRUCTURE: '#CA8A04',
      HEALTH: '#7C3AED',
      UNASSIGNED: '#6B7280',
    };
    const priorityColors = { URGENT: '#B91C1C', STANDARD: '#1D4ED8', LOW: '#475569' };
    const typeColors = { COMPLAINT: '#DC2626', SUGGESTION: '#1D4ED8', FEEDBACK: '#16A34A' };

    res.json({
      department: toChart(department, deptLabels, deptColors),
      priority: toChart(priority, priorityLabels, priorityColors),
      type: toChart(type, typeLabels, typeColors),
      // Always every way, in this order (Online first), with 0 when none came that way.
      channel: CHANNELS.map(key => ({ key, name: CHANNEL_LABELS[key], value: channel[key] || 0 })),
      departmentSelections: Object.entries(citizenDeptMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch breakdown data' });
  }
}

// GET /api/analytics/satisfaction?range=month|year|all — the satisfaction form's
// results (ARTA CSM) for each office on the Settings list (and any other office
// with answers), for all of them together, and for each service.
async function getSatisfaction(req, res) {
  try {
    const { range, from, to, label } = satisfactionRange(req.query);
    const results = await satisfactionResults(prisma, { offices: await getDepartmentList(), from, to });
    res.json({ range, label, ...results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load the satisfaction results' });
  }
}

module.exports = {
  getOfficeUpdates,
  getAlerts,
  getSummary,
  getQuarterly,
  getSentiment,
  getMonthly,
  getBreakdown,
  getSatisfaction,
};
