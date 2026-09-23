const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getSummary(req, res) {
  try {
    const [total, pending, reviewing, inProgress, resolved] = await Promise.all([
      prisma.submission.count(),
      prisma.submission.count({ where: { status: 'PENDING' } }),
      prisma.submission.count({ where: { status: 'REVIEWING' } }),
      prisma.submission.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.submission.count({ where: { status: 'RESOLVED' } }),
    ]);

    const resolvedSubmissions = await prisma.submission.findMany({
      where: { status: 'RESOLVED' },
      select: { createdAt: true, updatedAt: true },
    });

    let avgResolutionTime = 0;
    if (resolvedSubmissions.length) {
      const totalMs = resolvedSubmissions.reduce((sum, s) => {
        return sum + (s.updatedAt.getTime() - s.createdAt.getTime());
      }, 0);
      avgResolutionTime = parseFloat((totalMs / resolvedSubmissions.length / (1000 * 60 * 60 * 24)).toFixed(1));
    }

    const responseRate = total > 0 ? parseFloat(((total - pending) / total * 100).toFixed(1)) : 0;

    const citizens = await prisma.user.count({ where: { role: 'CITIZEN' } });

    res.json({ total, pending, reviewing, inProgress, resolved, avgResolutionTime, responseRate, citizens });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch analytics summary' });
  }
}

async function getQuarterly(req, res) {
  try {
    const submissions = await prisma.submission.findMany({
      select: { createdAt: true, type: true },
      orderBy: { createdAt: 'asc' },
    });

    const quarterly = {};
    for (const s of submissions) {
      const year = s.createdAt.getFullYear();
      const q = Math.ceil((s.createdAt.getMonth() + 1) / 3);
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
      prisma.submission.count({ where: { sentiment: 'POSITIVE' } }),
      prisma.submission.count({ where: { sentiment: 'NEUTRAL' } }),
      prisma.submission.count({ where: { sentiment: 'NEGATIVE' } }),
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

async function getMonthly(req, res) {
  try {
    const submissions = await prisma.submission.findMany({
      select: { createdAt: true, type: true },
      orderBy: { createdAt: 'asc' },
    });

    const months = {};
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
      months[key] = { label, key, total: 0, COMPLAINT: 0, SUGGESTION: 0, FEEDBACK: 0 };
    }

    for (const s of submissions) {
      const key = `${s.createdAt.getFullYear()}-${String(s.createdAt.getMonth() + 1).padStart(2, '0')}`;
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
      select: { department: true, priority: true, type: true, citizenDepartment: true, status: true },
    });

    const department = {};
    const priority = {};
    const type = {};
    const citizenDeptMap = {};

    const deptLabels = {
      PUBLIC_SAFETY: 'Public Safety',
      SANITATION: 'Sanitation',
      INFRASTRUCTURE: 'Infrastructure',
      HEALTH: 'Health',
      UNASSIGNED: 'Unassigned',
    };
    const priorityLabels = { URGENT: 'Urgent', STANDARD: 'Standard', LOW: 'Low' };
    const typeLabels = { COMPLAINT: 'Complaint', SUGGESTION: 'Suggestion', FEEDBACK: 'Feedback' };

    for (const s of submissions) {
      department[s.department] = (department[s.department] || 0) + 1;
      priority[s.priority] = (priority[s.priority] || 0) + 1;
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
    const priorityColors = { URGENT: '#DC2626', STANDARD: '#1D4ED8', LOW: '#6B7280' };
    const typeColors = { COMPLAINT: '#DC2626', SUGGESTION: '#1D4ED8', FEEDBACK: '#16A34A' };

    res.json({
      department: toChart(department, deptLabels, deptColors),
      priority: toChart(priority, priorityLabels, priorityColors),
      type: toChart(type, typeLabels, typeColors),
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

async function getCitizens(req, res) {
  try {
    const citizens = await prisma.user.findMany({
      where: { role: 'CITIZEN' },
      select: {
        id: true, fullName: true, citizenId: true, email: true, gmail: true, mobileNumber: true, createdAt: true,
        _count: { select: { submissions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(citizens);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch citizens' });
  }
}

module.exports = {
  getSummary,
  getQuarterly,
  getSentiment,
  getMonthly,
  getBreakdown,
  getCitizens,
};
