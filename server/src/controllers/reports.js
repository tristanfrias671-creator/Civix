const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const crypto = require('crypto');
const { ensureSettings } = require('./settings');
const { loadSealImage } = require('../utils/branding');
const { parsePeriod, PeriodError, phDate, phIsoDate, phMonthKey, MONTHS } = require('../utils/reportPeriod');
const { PRIORITY_LABELS } = require('../utils/urgency');
const prisma = require('../utils/prisma');

// Reports staff marked as spam or invalid (status SPAM) are left out of every figure.
// Status figures (pending, resolved, response rate, resolution time) count cases
// only: feedback rates the municipality's service as a whole and has no workflow.
// Same rules as the admin dashboard (controllers/analytics.js).
const NOT_SPAM = { status: { not: 'SPAM' } };
const CASES = { type: { not: 'FEEDBACK' }, ...NOT_SPAM };

// ── Color constants (PDFKit accepts hex strings only — NO rgba()) ─────────────
const BRAND      = '#1D4ED8';
const BRAND_DARK = '#1e3a8a';
const TEXT_DARK  = '#0f172a';
const TEXT_MID   = '#475569';
const TEXT_LIGHT = '#94a3b8';
const DIVIDER    = '#e2e8f0';
const ROW_ALT    = '#f8fafc';
const ROW_HEAD   = '#1e3a8a';

const TYPE_COLORS = {
  COMPLAINT:  { bar: '#ef4444', light: '#fee2e2', text: '#991b1b' },
  SUGGESTION: { bar: '#3b82f6', light: '#dbeafe', text: '#1e40af' },
  FEEDBACK:   { bar: '#22c55e', light: '#dcfce7', text: '#166534' },
};
const STATUS_COLORS = {
  PENDING:     { bar: '#6B7280', light: '#f3f4f6', text: '#374151' },
  REVIEWING:   { bar: '#1D4ED8', light: '#dbeafe', text: '#1e40af' },
  IN_PROGRESS: { bar: '#CA8A04', light: '#fef9c3', text: '#854d0e' },
  RESOLVED:    { bar: '#16A34A', light: '#dcfce7', text: '#166534' },
};

// ── Utilities ─────────────────────────────────────────────────────────────────
// Dates are shown on the Philippine calendar (the server clock may be UTC).
function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila', year: 'numeric', month: 'long', day: 'numeric',
  });
}
const fmtShortDate = d => new Date(d).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' });

// The office a report sits with, as shown in the logs.
const officeName = s => (s.type === 'FEEDBACK' ? '—' : !s.department || s.department === 'UNASSIGNED' ? 'Unassigned' : s.department);

// Shortens text with "…" until it fits `width` at the current font and size.
function fitText(doc, text, width) {
  if (doc.widthOfString(text) <= width) return text;
  let t = text;
  while (t.length > 1 && doc.widthOfString(`${t}…`) > width) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

function pageFooter(doc, pageNum, pageCount, reportId, verifyCode) {
  const W = doc.page.width;
  const H = doc.page.height;
  // Footer text is drawn inside the bottom margin band (below H - margins.bottom).
  // PDFKit treats any text() call there as an overflow and silently inserts a
  // phantom page, so the bottom margin is zeroed for the duration of this draw.
  const savedBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.moveTo(50, H - 48).lineTo(W - 50, H - 48).lineWidth(0.5).stroke(DIVIDER);
  doc.fontSize(7).font('Helvetica').fillColor(TEXT_LIGHT)
    .text(
      'CIVIX – Integrated Citizen Engagement Platform  |  Municipality of Cantilan, Surigao del Sur  |  Confidential',
      50, H - 40, { width: W - 100, align: 'center', lineBreak: false }
    );
  // Left: traceable report ID. Center: page number. Right: verification code —
  // together these let a single loose printed page be matched back to the exact
  // data snapshot it came from.
  doc.fontSize(6.5).font('Helvetica').fillColor(TEXT_LIGHT)
    .text(`Report ID: ${reportId}`, 50, H - 30, { width: 220, lineBreak: false });
  doc.fontSize(7).fillColor(TEXT_LIGHT)
    .text(`Page ${pageNum} of ${pageCount}`, 50, H - 30, { width: W - 100, align: 'center', lineBreak: false });
  doc.fontSize(6.5).fillColor(TEXT_LIGHT)
    .text(`Verify: ${verifyCode}`, W - 270, H - 30, { width: 220, align: 'right', lineBreak: false });
  doc.page.margins.bottom = savedBottom;
}

function sectionHead(doc, num, title, y) {
  const W = doc.page.width;
  doc.rect(50, y, 4, 20).fill(BRAND);
  doc.fontSize(13).font('Helvetica-Bold').fillColor(TEXT_DARK)
    .text(`${num}.  ${title}`, 62, y + 3);
  y += 24;
  doc.moveTo(50, y).lineTo(W - 50, y).lineWidth(0.5).stroke(DIVIDER);
  return y + 12;
}

function kpiCard(doc, label, value, x, y, w, h, accent) {
  doc.rect(x, y, w, h).fill('#f0f9ff');
  doc.rect(x, y, w, h).lineWidth(0.5).stroke('#bfdbfe');
  doc.rect(x, y, 4, h).fill(accent);
  doc.fontSize(7.5).font('Helvetica').fillColor(TEXT_MID)
    .text(label.toUpperCase(), x + 10, y + 9, { width: w - 14 });
  doc.fontSize(20).font('Helvetica-Bold').fillColor(TEXT_DARK)
    .text(String(value), x + 10, y + 23, { width: w - 14 });
}

function horizBar(doc, label, count, total, color, lightColor, y) {
  const BAR_X = 160;
  const BAR_W = 320;
  const pct   = total > 0 ? count / total : 0;
  doc.fontSize(9).font('Helvetica-Bold').fillColor(TEXT_DARK)
    .text(label, 50, y + 3, { width: 105 });
  doc.rect(BAR_X, y, BAR_W, 16).fill('#f1f5f9');
  doc.rect(BAR_X, y, BAR_W, 16).lineWidth(0.4).stroke(DIVIDER);
  if (pct > 0) doc.rect(BAR_X, y, Math.max(pct * BAR_W, 2), 16).fill(color);
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor(TEXT_DARK)
    .text(`${count}  (${(pct * 100).toFixed(1)}%)`, BAR_X + BAR_W + 8, y + 3);
}

// Even axis steps for counts: 0, 3, 6, 9, 12 rather than 0, 2, 5, 7, 9.
function niceAxis(max) {
  const step = Math.max(1, Math.ceil(max / 4));
  return { step, top: step * 4 };
}

// ── Vertical grouped bar chart ────────────────────────────────────────────────
function drawBarChart(doc, deptData, startY) {
  const W      = doc.page.width;
  const MARGIN = 50;
  let y        = startY;

  if (!deptData || deptData.length === 0) {
    doc.fontSize(9).font('Helvetica').fillColor(TEXT_LIGHT)
      .text('No departmental data available.', MARGIN, y);
    return y + 24;
  }

  const TOP     = deptData.slice(0, 8);
  const CHART_H = 240;
  const CHART_X = MARGIN + 36;
  const CHART_W = W - CHART_X - MARGIN;
  const C_BOT   = y + CHART_H;
  const TYPES   = ['COMPLAINT', 'SUGGESTION', 'FEEDBACK'];
  const GROUP_W = CHART_W / TOP.length;
  const BAR_W   = Math.min((GROUP_W - 10) / TYPES.length, 24);
  const G_PAD   = (GROUP_W - BAR_W * TYPES.length) / 2;

  const axis = niceAxis(Math.max(...TOP.map(d => Math.max(...TYPES.map(t => d.counts[t] || 0)))));
  const maxCount = axis.top;

  // Chart background
  doc.rect(CHART_X, y, CHART_W, CHART_H).fill('#fafafa');
  doc.rect(CHART_X, y, CHART_W, CHART_H).lineWidth(0.4).stroke(DIVIDER);

  // Y-axis grid lines + labels
  for (let i = 0; i <= 4; i++) {
    const val = axis.step * i;
    const gy  = C_BOT - (val / maxCount) * CHART_H;
    doc.moveTo(CHART_X, gy).lineTo(CHART_X + CHART_W, gy)
      .lineWidth(i === 0 ? 0.7 : 0.3)
      .stroke(i === 0 ? TEXT_LIGHT : DIVIDER);
    doc.fontSize(7).font('Helvetica').fillColor(TEXT_LIGHT)
      .text(String(val), MARGIN, gy - 5, { width: 32, align: 'right' });
  }

  // Bars
  TOP.forEach((d, gi) => {
    const gx = CHART_X + gi * GROUP_W + G_PAD;

    TYPES.forEach((type, ti) => {
      const cnt   = d.counts[type] || 0;
      const barH  = maxCount > 0 ? (cnt / maxCount) * CHART_H : 0;
      const bx    = gx + ti * BAR_W;
      const by    = C_BOT - barH;
      const color = TYPE_COLORS[type].bar;

      if (barH > 0) {
        doc.rect(bx, by, BAR_W - 2, barH).fill(color);
        if (barH > 14) {
          doc.fontSize(7).font('Helvetica-Bold').fillColor('#ffffff')
            .text(String(cnt), bx, by + 4, { width: BAR_W - 2, align: 'center' });
        }
      } else {
        doc.rect(bx, C_BOT - 3, BAR_W - 2, 3).fill('#e5e7eb');
      }
    });

    // Slanted x-label, running down and right from under its bars (never into them)
    const short  = d.dept.replace('Municipal ', 'Mun. ').replace(' Office', '').slice(0, 16);
    const labelX = gx + (BAR_W * TYPES.length) / 2 - 8;
    doc.save()
      .translate(labelX, C_BOT + 6)
      .rotate(38)
      .fontSize(7).font('Helvetica').fillColor(TEXT_MID)
      .text(short, 0, 0, { width: 65, lineBreak: false })
      .restore();
  });

  // X baseline
  doc.moveTo(CHART_X, C_BOT).lineTo(CHART_X + CHART_W, C_BOT)
    .lineWidth(0.7).stroke(TEXT_LIGHT);

  const noteY = C_BOT + 60;
  doc.fontSize(7).font('Helvetica').fillColor(TEXT_LIGHT)
    .text(`* Showing top ${TOP.length} departments by submission volume.`, CHART_X, noteY);

  return noteY + 14;
}

// ── Pie chart (polygon-approximated wedges — reliable across PDF viewers) ──────
function drawPieChart(doc, cx, cy, r, slices) {
  const total = slices.reduce((s, d) => s + d.value, 0);
  if (total <= 0) {
    doc.circle(cx, cy, r).lineWidth(1).stroke(DIVIDER);
    doc.fontSize(8).font('Helvetica').fillColor(TEXT_LIGHT)
      .text('No data yet', cx - 35, cy - 4, { width: 70, align: 'center', lineBreak: false });
    return;
  }
  let startAngle = -Math.PI / 2;
  const STEPS = 48;
  doc.lineWidth(1.2);
  slices.forEach(slice => {
    if (slice.value <= 0) return;
    const sweep = (slice.value / total) * Math.PI * 2;
    const endAngle = startAngle + sweep;
    const segs = Math.max(2, Math.round(STEPS * (sweep / (Math.PI * 2))));
    doc.moveTo(cx, cy);
    for (let i = 0; i <= segs; i++) {
      const a = startAngle + (sweep * i) / segs;
      doc.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    doc.closePath();
    doc.fillAndStroke(slice.color, '#ffffff');
    startAngle = endAngle;
  });
}

function pieLegend(doc, x, y, slices, total) {
  let ly = y;
  slices.forEach(s => {
    const pct = total > 0 ? ((s.value / total) * 100).toFixed(1) : '0.0';
    doc.rect(x, ly + 1, 10, 10).fill(s.color);
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(TEXT_DARK)
      .text(s.label, x + 16, ly, { width: 130, lineBreak: false });
    doc.fontSize(8).font('Helvetica').fillColor(TEXT_MID)
      .text(`${s.value}  (${pct}%)`, x + 16, ly + 12, { width: 130, lineBreak: false });
    ly += 32;
  });
  return ly;
}

// ── A table that carries on over new pages, repeating its header row ──────────
// cols: [{ label, x, width, align }]; drawRow(row, y, i) draws one row's cells.
// Returns the y just below the table.
function pdfTable(doc, y, cols, rows, drawRow, { rowH = 16, headH = 18 } = {}) {
  const W = doc.page.width;
  const bottom = doc.page.height - 70;
  const header = () => {
    doc.rect(50, y, W - 100, headH).fill(ROW_HEAD);
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#ffffff');
    cols.forEach(c => doc.text(c.label, c.x, y + 5, { width: c.width, align: c.align || 'left', lineBreak: false }));
    y += headH;
  };
  if (y + headH + rowH > bottom) { doc.addPage(); y = 50; }
  header();
  rows.forEach((row, i) => {
    if (y + rowH > bottom) { doc.addPage(); y = 50; header(); }
    if (i % 2 === 0) doc.rect(50, y, W - 100, rowH).fill(ROW_ALT);
    doc.rect(50, y, W - 100, rowH).lineWidth(0.3).stroke(DIVIDER);
    drawRow(row, y, i);
    y += rowH;
  });
  return y;
}

// ── Monthly trend — line/area chart ────────────────────────────────────────────
function drawLineChart(doc, data, x, y, w, h) {
  const axis = niceAxis(Math.max(0, ...data.map(m => m.total)));
  const maxVal = axis.top;
  const n = data.length;
  const stepX = n > 1 ? w / (n - 1) : 0;
  const pts = data.map((m, i) => ({ x: x + i * stepX, y: y + h - (m.total / maxVal) * h }));

  doc.rect(x, y, w, h).fill('#fafafa');
  doc.rect(x, y, w, h).lineWidth(0.4).stroke(DIVIDER);

  for (let i = 0; i <= 4; i++) {
    const val = axis.step * i;
    const gy = y + h - (val / maxVal) * h;
    doc.moveTo(x, gy).lineTo(x + w, gy)
      .lineWidth(i === 0 ? 0.7 : 0.3).stroke(i === 0 ? TEXT_LIGHT : DIVIDER);
    doc.fontSize(7).font('Helvetica').fillColor(TEXT_LIGHT)
      .text(String(val), x - 34, gy - 4, { width: 30, align: 'right', lineBreak: false });
  }

  // Area fill under the line
  doc.moveTo(pts[0].x, y + h);
  pts.forEach(p => doc.lineTo(p.x, p.y));
  doc.lineTo(pts[pts.length - 1].x, y + h);
  doc.closePath();
  doc.fillOpacity(0.15).fill(BRAND);
  doc.fillOpacity(1);

  // Line
  doc.moveTo(pts[0].x, pts[0].y);
  pts.slice(1).forEach(p => doc.lineTo(p.x, p.y));
  doc.lineWidth(2).stroke(BRAND);

  // Point markers
  pts.forEach(p => {
    doc.circle(p.x, p.y, 2.6).fill(BRAND);
    doc.circle(p.x, p.y, 2.6).lineWidth(1).stroke('#ffffff');
  });

  // X-axis labels: at most about 12, so a month of days stays readable.
  const every = Math.ceil(n / 12);
  data.forEach((m, i) => {
    if (i % every) return;
    doc.fontSize(6.5).font('Helvetica').fillColor(TEXT_MID)
      .text(m.label, pts[i].x - 16, y + h + 6, { width: 32, align: 'center', lineBreak: false });
  });

  doc.moveTo(x, y + h).lineTo(x + w, y + h).lineWidth(0.7).stroke(TEXT_LIGHT);
}

// ═════════════════════════════════════════════════════════════════════════════
// REPORT DATA — the same figures for the PDF and the Excel workbook, for one
// period: ?period=week|month|year|all&date=YYYY-MM-DD (see utils/reportPeriod.js).
// Every figure counts the reports filed in the period, with their status as of now.
// ═════════════════════════════════════════════════════════════════════════════
const LOG_LIMIT = { all: 100, period: 5000 };   // rows in the Excel log
const PDF_LOG_LIMIT = { all: 10, period: 100 }; // rows in the PDF log

async function gatherReport(period) {
  const filed = period.from ? { createdAt: { gte: period.from, lt: period.to } } : {};
  const ALL = { ...NOT_SPAM, ...filed };
  const CASE = { ...CASES, ...filed };
  const [
    total, pending, reviewing, inProgress, resolved,
    positive, neutral, negative,
    complaints, suggestions, feedbacks,
    citizens, previousTotal,
  ] = await Promise.all([
    prisma.submission.count({ where: ALL }),
    prisma.submission.count({ where: { ...CASE, status: 'PENDING' } }),
    prisma.submission.count({ where: { ...CASE, status: 'REVIEWING' } }),
    prisma.submission.count({ where: { ...CASE, status: 'IN_PROGRESS' } }),
    prisma.submission.count({ where: { ...CASE, status: 'RESOLVED' } }),
    prisma.submission.count({ where: { ...ALL, sentiment: 'POSITIVE' } }),
    prisma.submission.count({ where: { ...ALL, sentiment: 'NEUTRAL' } }),
    prisma.submission.count({ where: { ...ALL, sentiment: 'NEGATIVE' } }),
    prisma.submission.count({ where: { ...ALL, type: 'COMPLAINT' } }),
    prisma.submission.count({ where: { ...ALL, type: 'SUGGESTION' } }),
    prisma.submission.count({ where: { ...ALL, type: 'FEEDBACK' } }),
    prisma.user.count({ where: { role: 'CITIZEN' } }),
    period.prevFrom
      ? prisma.submission.count({ where: { ...NOT_SPAM, createdAt: { gte: period.prevFrom, lt: period.prevTo } } })
      : null,
  ]);

  const resolvedSubs = await prisma.submission.findMany({
    where: { ...CASE, status: 'RESOLVED' },
    select: { createdAt: true, updatedAt: true, priority: true, dueAt: true },
  });
  // How urgent the complaints and suggestions were, and how many urgent ones were
  // resolved by their resolve-by date (the same rule as the deadline badges).
  const [urgent, normal, canWait] = await Promise.all(['URGENT', 'STANDARD', 'LOW'].map(priority =>
    prisma.submission.count({ where: { ...CASE, priority } })));
  const urgentDone = resolvedSubs.filter(s => s.priority === 'URGENT');
  const urgentOnTime = urgentDone.filter(s => !s.dueAt || s.updatedAt <= s.dueAt).length;
  const avgDays = resolvedSubs.length
    ? Number((resolvedSubs.reduce((s, r) => s + (r.updatedAt - r.createdAt), 0) / resolvedSubs.length / 86400000).toFixed(1))
    : 0;
  const caseTotal = complaints + suggestions;
  const responseRate = caseTotal > 0 ? Number(((caseTotal - pending) / caseTotal * 100).toFixed(1)) : 0;

  // Trend rows: each day (a week or a month), each month (a year), or the last
  // 12 months (all time).
  let trend;
  if (period.kind === 'all') {
    const now = phDate(new Date());
    trend = [];
    for (let i = 11; i >= 0; i--) {
      const t = new Date(Date.UTC(now.y, now.m - i, 1));
      const y = t.getUTCFullYear();
      const m = t.getUTCMonth();
      trend.push({ key: `${y}-${String(m + 1).padStart(2, '0')}`, label: `${MONTHS[m].slice(0, 3)} ${String(y).slice(2)}`, long: `${MONTHS[m]} ${y}` });
    }
  } else {
    trend = period.buckets.map(b => ({ ...b }));
    // A period still running stops at today: the days (or months) to come aren't zeros.
    if (period.inProgress) {
      const todayKey = period.bucketOf(new Date());
      trend = trend.filter(t => t.key <= todayKey);
    }
  }
  trend.forEach(t => Object.assign(t, { total: 0, COMPLAINT: 0, SUGGESTION: 0, FEEDBACK: 0 }));
  const trendRow = Object.fromEntries(trend.map(t => [t.key, t]));
  const trendKey = period.kind === 'all' ? phMonthKey : period.bucketOf;

  // Quarters: every quarter on record (all time), or those of the year (up to
  // the current one while the year is still running).
  const quarters = {};
  if (period.kind === 'year') {
    const { y } = phDate(period.from);
    const lastQ = period.inProgress ? Math.floor(phDate(new Date()).m / 3) + 1 : 4;
    ['Jan – Mar', 'Apr – Jun', 'Jul – Sep', 'Oct – Dec'].slice(0, lastQ).forEach((months, i) => {
      quarters[`${y} Q${i + 1}`] = { label: `${y} Q${i + 1} (${months})`, year: y, q: i + 1, COMPLAINT: 0, SUGGESTION: 0, FEEDBACK: 0, total: 0 };
    });
  }
  const deptMap = {};
  const citizenDeptMap = {};

  const subs = await prisma.submission.findMany({
    where: ALL,
    select: { createdAt: true, type: true, department: true, citizenDepartment: true },
  });
  for (const s of subs) {
    const row = trendRow[trendKey(s.createdAt)];
    if (row) { row.total++; row[s.type]++; }
    if (period.kind === 'all' || period.kind === 'year') {
      const { y, m } = phDate(s.createdAt);
      const q = Math.floor(m / 3) + 1;
      const key = `${y} Q${q}`;
      if (!quarters[key]) quarters[key] = { label: key, year: y, q, COMPLAINT: 0, SUGGESTION: 0, FEEDBACK: 0, total: 0 };
      quarters[key][s.type]++; quarters[key].total++;
    }
    if (s.department && s.department !== 'UNASSIGNED') {
      if (!deptMap[s.department]) deptMap[s.department] = { COMPLAINT: 0, SUGGESTION: 0, FEEDBACK: 0, total: 0 };
      deptMap[s.department][s.type]++; deptMap[s.department].total++;
    }
    if (s.citizenDepartment) citizenDeptMap[s.citizenDepartment] = (citizenDeptMap[s.citizenDepartment] || 0) + 1;
  }

  const log = await prisma.submission.findMany({
    where: ALL,
    orderBy: { createdAt: 'desc' },
    take: period.kind === 'all' ? LOG_LIMIT.all : LOG_LIMIT.period,
    select: { trackingId: true, type: true, department: true, status: true, priority: true, sentiment: true, createdAt: true },
  });

  return {
    total, pending, reviewing, inProgress, resolved, positive, neutral, negative,
    complaints, suggestions, feedbacks, citizens, previousTotal, avgDays, responseRate,
    urgent, normal, canWait, urgentResolved: urgentDone.length, urgentOnTime,
    trend,
    quarters: Object.values(quarters).sort((a, b) => a.year - b.year || a.q - b.q),
    departments: Object.entries(deptMap)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([dept, c]) => ({ dept, ...c, counts: c })),
    citedDepartments: Object.entries(citizenDeptMap)
      .sort((a, b) => b[1] - a[1]).slice(0, 15)
      .map(([name, value]) => ({ name, value })),
    log,
  };
}

// The period asked for, or null after answering 400 with what's wrong.
function periodFrom(req, res) {
  try {
    return parsePeriod(req.query);
  } catch (err) {
    if (!(err instanceof PeriodError)) throw err;
    res.status(400).json({ error: err.message });
    return null;
  }
}

// civix-report-monthly-2026-10.pdf, civix-report-all-time-2026-10-13.xlsx
const reportFileName = (period, ext) =>
  `civix-report-${period.fileTag}${period.kind === 'all' ? `-${phIsoDate(new Date())}` : ''}.${ext}`;

// GET /api/reports/periods — the first day with a report on record and today
// (Philippine calendar), so the Analytics page lists only periods with data.
async function getReportPeriods(req, res) {
  try {
    const first = await prisma.submission.findFirst({
      where: NOT_SPAM, orderBy: { createdAt: 'asc' }, select: { createdAt: true },
    });
    res.json({ first: first ? phIsoDate(first.createdAt) : null, today: phIsoDate(new Date()) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load the report periods' });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// PDF EXPORT
// ═════════════════════════════════════════════════════════════════════════════
async function generatePDF(req, res) {
  const period = periodFrom(req, res);
  if (!period) return;
  let data;
  let seal;
  try {
    [data, seal] = await Promise.all([
      gatherReport(period),
      ensureSettings().then(s => loadSealImage(s.sealUrl)).catch(() => null),
    ]);
  } catch (err) {
    console.error('PDF report data error:', err);
    return res.status(500).json({ error: 'Failed to generate report' });
  }

  // Pages are kept until the end, so the footers can say "Page 2 of 6" and the
  // table of contents can give the page each section landed on.
  const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${reportFileName(period, 'pdf')}"`);
  doc.pipe(res);
  try {
    drawPdfReport(doc, period, data, seal);
  } catch (err) {
    console.error('PDF generation error:', err);
  }
  doc.end();
}

function drawPdfReport(doc, period, d, seal) {
  const W = doc.page.width;
  const H = doc.page.height;
  const isAll = period.kind === 'all';
  const word = period.word; // week, month or year (not set for all time)
  const genTime = new Date();
  const genDate = fmtDate(genTime);
  const pageNo = () => doc.bufferedPageRange().count;
  const sectionPage = {};
  const trendTitle = isAll || period.kind === 'year' ? 'Monthly Trend Analysis' : 'Daily Trend Analysis';
  const logTitle = isAll ? 'Recent Submissions Log' : 'Submissions Log';

  // Report ID + verification code — printed on the cover and every page footer
  // so a physical printout can be traced back to the exact data snapshot it was
  // generated from (a stray page found later can still be matched to its report).
  const reportId = `CIVIX-${genTime.toISOString().replace(/[-:T]/g, '').slice(0, 14)}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const verifyPayload = `${reportId}|${period.fileTag}|${d.total}|${d.resolved}|${d.pending}|${genTime.toISOString()}`;
  const verifyHash = crypto.createHash('sha256').update(verifyPayload).digest('hex').toUpperCase();
  const verifyCode = `${verifyHash.slice(0, 4)}-${verifyHash.slice(4, 8)}-${verifyHash.slice(8, 12)}`;

  // ══════════════════════════════════════════════════════════════════════
  // PAGE 1 — COVER
  // ══════════════════════════════════════════════════════════════════════
  doc.rect(0, 0, W, 190).fill(BRAND_DARK);
  doc.rect(0, 188, W, 6).fill(BRAND);
  doc.rect(0, 194, W, 3).fill('#93c5fd');

  // Header text (solid white — no rgba)
  doc.fillColor('#c7d2fe').fontSize(9).font('Helvetica')
    .text('REPUBLIC OF THE PHILIPPINES', 0, 40, { align: 'center', width: W, lineBreak: false });
  doc.fillColor('#e0e7ff').fontSize(11).font('Helvetica-Bold')
    .text('MUNICIPALITY OF CANTILAN, SURIGAO DEL SUR', 0, 56, { align: 'center', width: W, lineBreak: false });

  // Title, paired with the municipal seal as one centered group (widths computed
  // precisely via widthOfString so the seal can never collide with the text).
  const titleText = `CIVIX ${period.title}`;
  doc.font('Helvetica-Bold').fontSize(25);
  const titleWidth = doc.widthOfString(titleText);
  const SEAL_SIZE = 46;
  const SEAL_GAP = 14;
  const groupWidth = (seal ? SEAL_SIZE + SEAL_GAP : 0) + titleWidth;
  const groupX = (W - groupWidth) / 2;
  const titleY = 100;
  if (seal) {
    doc.image(seal.buffer, groupX, titleY + (25 - SEAL_SIZE) / 2 + 4, { fit: [SEAL_SIZE, SEAL_SIZE], align: 'center', valign: 'center' });
  }
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(25)
    .text(titleText, groupX + (seal ? SEAL_SIZE + SEAL_GAP : 0), titleY, { lineBreak: false });

  doc.fillColor('#bfdbfe').fontSize(11).font('Helvetica')
    .text('Integrated Citizen Engagement Platform', 0, 140, { align: 'center', width: W, lineBreak: false });
  doc.fillColor('#93c5fd').fontSize(8.5).font('Helvetica')
    .text(isAll ? `Generated: ${genDate}` : `Reporting period: ${period.range}   |   Generated: ${genDate}`, 0, 162, { align: 'center', width: W });

  // Meta info box
  const bx = 100; const by = 218; const bw = W - 200; const bh = 152;
  doc.rect(bx, by, bw, bh).fill('#f0f9ff');
  doc.rect(bx, by, bw, bh).lineWidth(0.6).stroke('#bfdbfe');
  doc.rect(bx, by, 4, bh).fill(BRAND);
  const meta = [
    ['Report Date',       genDate],
    ['Reporting Period',  period.rangeFull],
    ['Prepared By',       'CIVIX System — Auto-Generated'],
    ['Classification',    'For Internal Use Only'],
    ['Report ID',         reportId],
    ['Verification Code', verifyCode],
  ];
  let my = by + 12;
  for (const [lbl, val] of meta) {
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(TEXT_MID).text(lbl + ':', bx + 14, my);
    doc.fontSize(8.5).font('Helvetica').fillColor(TEXT_DARK).text(val, bx + 140, my);
    my += 22;
  }

  // Executive Summary
  const summaryText = isAll
    ? `This report presents a comprehensive statistical analysis of citizen engagement submissions ` +
      `recorded through the CIVIX platform for the Municipality of Cantilan, Surigao del Sur. ` +
      `A total of ${d.total.toLocaleString()} submission(s) have been recorded, comprising complaints, ` +
      `suggestions, and service feedback from registered citizens. The current response rate for complaints ` +
      `and suggestions stands at ${d.responseRate}%, with an average resolution time of ${d.avgDays} day(s). ` +
      `Feedback rates the municipality's service as a whole and is not routed to an office. This document is intended ` +
      `for review by municipal officials and designated department heads.`
    : `This ${period.title.toLowerCase()} covers the citizen submissions filed through the CIVIX platform for the ` +
      `Municipality of Cantilan, Surigao del Sur, for the period ${period.rangeFull.replace(/ \(.*\)$/, '')}. ` +
      `${d.total.toLocaleString()} submission(s) were filed in this ${word}, compared with ` +
      `${d.previousTotal.toLocaleString()} in the previous ${word}. ` +
      (period.inProgress ? `The ${word} is still in progress, so the figures run up to the report date. ` : '') +
      `For the complaints and suggestions filed in this ${word}, the response rate is ${d.responseRate}% and the average ` +
      `resolution time is ${d.avgDays} day(s); statuses are as of ${genDate}. Feedback rates the municipality's service ` +
      `as a whole and is not routed to an office. This document is intended for review by municipal officials and designated department heads.`;
  doc.fontSize(10).font('Helvetica-Bold').fillColor(TEXT_DARK).text('Executive Summary', 50, 394);
  doc.moveTo(50, 410).lineTo(W - 50, 410).lineWidth(0.5).stroke(DIVIDER);
  doc.fontSize(9).font('Helvetica').fillColor(TEXT_MID);
  const summaryH = doc.heightOfString(summaryText, { width: W - 100, lineGap: 4 });
  doc.text(summaryText, 50, 422, { width: W - 100, lineGap: 4, align: 'justify' });

  // Table of Contents (page numbers are filled in at the end)
  const tocTop = Math.max(532, 422 + summaryH + 16);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(TEXT_DARK).text('Table of Contents', 50, tocTop);
  doc.moveTo(50, tocTop + 16).lineTo(W - 50, tocTop + 16).lineWidth(0.5).stroke(DIVIDER);
  const toc = [
    [1, 'Key Performance Indicators'],
    [2, 'Submission Type Distribution'],
    [3, 'Sentiment Analysis'],
    [4, trendTitle],
    [5, 'Submission Breakdown by Department'],
    [6, logTitle],
  ];
  const tocRowY = {};
  let ty = tocTop + 27;
  for (const [num, title] of toc) {
    doc.fontSize(9).font('Helvetica').fillColor(TEXT_MID)
      .text(`${num}.  ${title}`, 60, ty, { width: W - 160 });
    doc.moveTo(60, ty + 12).lineTo(W - 100, ty + 12)
      .lineWidth(0.3).dash(1, { space: 3 }).stroke(DIVIDER);
    doc.undash();
    tocRowY[num] = ty;
    ty += 22;
  }

  // Cover footer (drawn inside the bottom margin band — see pageFooter() for why
  // the margin must be zeroed here too, or PDFKit silently inserts a phantom page)
  doc.rect(0, H - 46, W, 46).fill(BRAND_DARK);
  {
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.fontSize(7.5).font('Helvetica').fillColor('#93c5fd')
      .text('CIVIX – Integrated Citizen Engagement Platform  |  Municipality of Cantilan, Surigao del Sur',
        0, H - 26, { align: 'center', width: W, lineBreak: false });
    doc.page.margins.bottom = savedBottom;
  }

  // ══════════════════════════════════════════════════════════════════════
  // PAGE 2 — KPIs + Type Distribution + Sentiment
  // ══════════════════════════════════════════════════════════════════════
  doc.addPage();
  let y = 50;
  sectionPage[1] = sectionPage[2] = sectionPage[3] = pageNo();

  // Section 1 — KPIs
  y = sectionHead(doc, 1, 'Key Performance Indicators', y);
  if (!isAll) {
    doc.fontSize(8.5).font('Helvetica').fillColor(TEXT_MID)
      .text(`Reports filed ${period.rangeFull}. Statuses as of ${genDate}.`, 50, y, { width: W - 100 });
    y += 18;
  }

  const CARD_W = (W - 100 - 21) / 4;
  const CARD_H = 60;
  [
    ['Total Submissions', d.total,      BRAND,     ],
    ['Resolved',          d.resolved,   '#15803d'  ],
    ['In Progress',       d.inProgress, '#b45309'  ],
    ['Pending',           d.pending,    '#6B7280'  ],
  ].forEach(([lbl, val, acc], i) => {
    kpiCard(doc, lbl, val, 50 + i * (CARD_W + 7), y, CARD_W, CARD_H, acc);
  });
  y += CARD_H + 8;

  [
    ['Reviewing',        d.reviewing,            '#1d4ed8'],
    ['Response Rate',    `${d.responseRate}%`,   '#7c3aed'],
    ['Avg. Resolution',  `${d.avgDays} days`,    '#0369a1'],
    ['Feedbacks',        d.feedbacks,            '#059669'],
  ].forEach(([lbl, val, acc], i) => {
    kpiCard(doc, lbl, val, 50 + i * (CARD_W + 7), y, CARD_W, CARD_H, acc);
  });
  y += CARD_H + 8;

  // How urgent the complaints and suggestions were (chosen by the citizen, or changed
  // by the office), and whether the urgent ones were resolved on time.
  [
    ['Urgent',           d.urgent,               '#b91c1c'],
    ['Normal',           d.normal,               '#1d4ed8'],
    ['Can Wait',         d.canWait,              '#475569'],
    ['Urgent On Time',   d.urgentResolved ? `${d.urgentOnTime} of ${d.urgentResolved}` : '—', '#15803d'],
  ].forEach(([lbl, val, acc], i) => {
    kpiCard(doc, lbl, val, 50 + i * (CARD_W + 7), y, CARD_W, CARD_H, acc);
  });
  y += CARD_H + 6;
  doc.fontSize(7.5).font('Helvetica').fillColor(TEXT_MID)
    .text('Urgency covers complaints and suggestions. "Urgent On Time": urgent reports resolved by their resolve-by date, out of all urgent reports resolved.',
      50, y, { width: W - 100 });
  y += 26;

  // Section 2 — Type Distribution (pie)
  y = sectionHead(doc, 2, 'Submission Type Distribution', y);
  {
    const pieCx = 50 + 68; const pieCy = y + 52; const pieR = 48;
    const typeSlices = [
      { label: 'Complaints',  value: d.complaints,  color: TYPE_COLORS.COMPLAINT.bar },
      { label: 'Suggestions', value: d.suggestions, color: TYPE_COLORS.SUGGESTION.bar },
      { label: 'Feedback',    value: d.feedbacks,   color: TYPE_COLORS.FEEDBACK.bar },
    ];
    drawPieChart(doc, pieCx, pieCy, pieR, typeSlices);
    pieLegend(doc, 50 + 155, y + 8, typeSlices, d.total);
  }
  y += 122;

  // Section 3 — Sentiment (pie)
  y = sectionHead(doc, 3, 'Sentiment Analysis', y);
  {
    const pieCx = 50 + 68; const pieCy = y + 52; const pieR = 48;
    const sentSlices = [
      { label: 'Positive', value: d.positive, color: '#16A34A' },
      { label: 'Neutral',  value: d.neutral,  color: '#6B7280' },
      { label: 'Negative', value: d.negative, color: '#DC2626' },
    ];
    drawPieChart(doc, pieCx, pieCy, pieR, sentSlices);
    pieLegend(doc, 50 + 155, y + 8, sentSlices, d.total);
  }

  // ══════════════════════════════════════════════════════════════════════
  // PAGE 3 — Trend: each day of the week or month, each month of the year,
  // or the last 12 months (all time)
  // ══════════════════════════════════════════════════════════════════════
  doc.addPage();
  y = 50;
  sectionPage[4] = pageNo();
  y = sectionHead(doc, 4, trendTitle, y);
  const trendCaption = {
    all: 'Submission volume over the last twelve (12) months, broken down by type.',
    week: 'Submissions filed on each day of the week, broken down by type.',
    month: 'Submissions filed on each day of the month, broken down by type.',
    year: 'Submissions filed in each month of the year, broken down by type.',
  }[period.kind] + (period.inProgress ? ` ${period.kind === 'year' ? 'Months' : 'Days'} still to come are not shown.` : '');
  doc.fontSize(8.5).font('Helvetica').fillColor(TEXT_MID).text(trendCaption, 50, y, { width: W - 100 });
  y += 20;

  const LC_X = 50 + 34;
  const LC_W = W - LC_X - 50;
  const LC_H = 190;
  drawLineChart(doc, d.trend, LC_X, y, LC_W, LC_H);
  y += LC_H + 26;

  const sum = key => d.trend.reduce((n, t) => n + t[key], 0);
  const trendRows = [...d.trend, { long: 'Total', COMPLAINT: sum('COMPLAINT'), SUGGESTION: sum('SUGGESTION'), FEEDBACK: sum('FEEDBACK'), total: sum('total'), isTotal: true }];
  const trendRowH = trendRows.length > 20 ? 13 : 14;
  y = pdfTable(doc, y, [
    { label: period.kind === 'week' || period.kind === 'month' ? 'DAY' : 'MONTH', x: 55, width: 200 },
    { label: 'COMPLAINTS',  x: 270, width: 75, align: 'center' },
    { label: 'SUGGESTIONS', x: 345, width: 80, align: 'center' },
    { label: 'FEEDBACK',    x: 425, width: 65, align: 'center' },
    { label: 'TOTAL',       x: 490, width: 50, align: 'center' },
  ], trendRows, (m, ry) => {
    const ty2 = ry + (trendRowH - 7) / 2;
    doc.fontSize(7).font(m.isTotal ? 'Helvetica-Bold' : 'Helvetica').fillColor(TEXT_DARK)
      .text(m.long,               55,  ty2, { width: 200, lineBreak: false })
      .text(String(m.COMPLAINT),  270, ty2, { width: 75, align: 'center', lineBreak: false })
      .text(String(m.SUGGESTION), 345, ty2, { width: 80, align: 'center', lineBreak: false })
      .text(String(m.FEEDBACK),   425, ty2, { width: 65, align: 'center', lineBreak: false })
      .text(String(m.total),      490, ty2, { width: 50, align: 'center', lineBreak: false });
  }, { rowH: trendRowH });

  // ══════════════════════════════════════════════════════════════════════
  // PAGE 4 — Department Breakdown
  // ══════════════════════════════════════════════════════════════════════
  doc.addPage();
  y = 50;
  sectionPage[5] = pageNo();
  y = sectionHead(doc, 5, 'Submission Breakdown by Department', y);
  if (!isAll) {
    doc.fontSize(8.5).font('Helvetica').fillColor(TEXT_MID)
      .text(`Reports filed ${period.rangeFull}, by the office each one is assigned to.`, 50, y, { width: W - 100 });
    y += 18;
  }

  // Legend
  let lx = 62;
  for (const [type, c] of Object.entries(TYPE_COLORS)) {
    doc.rect(lx, y, 11, 11).fill(c.bar);
    doc.fontSize(8.5).font('Helvetica').fillColor(TEXT_MID)
      .text(type.charAt(0) + type.slice(1).toLowerCase(), lx + 15, y + 1);
    lx += 90;
  }
  y += 20;

  y = drawBarChart(doc, d.departments, y);
  y += 10;

  if (d.departments.length) {
    y = pdfTable(doc, y, [
      { label: 'DEPARTMENT',  x: 55,  width: 210 },
      { label: 'COMPLAINTS',  x: 270, width: 70, align: 'center' },
      { label: 'SUGGESTIONS', x: 340, width: 75, align: 'center' },
      { label: 'FEEDBACK',    x: 415, width: 65, align: 'center' },
      { label: 'TOTAL',       x: 485, width: 55, align: 'center' },
    ], d.departments, (row, ry) => {
      doc.fontSize(7).font('Helvetica').fillColor(TEXT_DARK);
      doc.text(fitText(doc, row.dept, 205),      55,  ry + 4, { width: 210, lineBreak: false })
        .text(String(row.COMPLAINT),  270, ry + 4, { width: 70, align: 'center', lineBreak: false })
        .text(String(row.SUGGESTION), 340, ry + 4, { width: 75, align: 'center', lineBreak: false })
        .text(String(row.FEEDBACK),   415, ry + 4, { width: 65, align: 'center', lineBreak: false })
        .text(String(row.total),      485, ry + 4, { width: 55, align: 'center', lineBreak: false });
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // PAGE 5 — Submissions Log (continues over more pages when needed)
  // ══════════════════════════════════════════════════════════════════════
  doc.addPage();
  y = 50;
  sectionPage[6] = pageNo();
  y = sectionHead(doc, 6, logTitle, y);

  const shown = d.log.slice(0, isAll ? PDF_LOG_LIMIT.all : PDF_LOG_LIMIT.period);
  const intro = isAll
    ? 'The table below presents the ten (10) most recently recorded submissions on the CIVIX platform.'
    : d.total === 0 ? `No submissions were filed in this ${word}.`
      : d.total > shown.length ? `The ${shown.length} most recent of the ${d.total.toLocaleString()} submissions filed in this ${word}, newest first. The Excel report lists all of them.`
        : `All ${d.total} submission(s) filed in this ${word}, newest first.`;
  doc.fontSize(8.5).font('Helvetica').fillColor(TEXT_MID).text(intro, 50, y, { width: W - 100 });
  y += 22;

  if (shown.length) {
    y = pdfTable(doc, y, [
      { label: 'TRACKING ID', x: 55,  width: 110 },
      { label: 'TYPE',        x: 168, width: 64, align: 'center' },
      { label: 'OFFICE',      x: 238, width: 160 },
      { label: 'STATUS',      x: 402, width: 80, align: 'center' },
      { label: 'DATE FILED',  x: 488, width: 55 },
    ], shown, (s, ry) => {
      const tC = TYPE_COLORS[s.type]     || { light: '#f3f4f6', text: '#374151' };
      const sC = STATUS_COLORS[s.status] || { light: '#f3f4f6', text: '#374151' };
      doc.fontSize(7.5).font('Helvetica').fillColor(TEXT_MID)
        .text(s.trackingId, 55, ry + 6, { width: 110, lineBreak: false });
      // Type badge
      doc.rect(168, ry + 4, 64, 12).fill(tC.light);
      doc.fontSize(7).font('Helvetica-Bold').fillColor(tC.text)
        .text(s.type, 168, ry + 7, { width: 64, align: 'center', lineBreak: false });
      doc.fontSize(7.5).font('Helvetica').fillColor(TEXT_DARK);
      doc.text(fitText(doc, officeName(s), 156), 238, ry + 6, { width: 160, lineBreak: false });
      // Status badge
      doc.rect(402, ry + 4, 80, 12).fill(sC.light);
      doc.fontSize(7).font('Helvetica-Bold').fillColor(sC.text)
        .text(s.status.replace(/_/g, ' '), 402, ry + 7, { width: 80, align: 'center', lineBreak: false });
      doc.fontSize(7.5).font('Helvetica').fillColor(TEXT_MID)
        .text(fmtShortDate(s.createdAt), 488, ry + 6, { width: 57, lineBreak: false });
    }, { rowH: 20 });
  }

  // Certification block (on a new page when the log filled this one)
  if (y + 24 + 130 > H - 70) { doc.addPage(); y = 50; } else { y += 24; }
  doc.moveTo(50, y).lineTo(W - 50, y).lineWidth(0.5).stroke(DIVIDER);
  y += 12;
  doc.fontSize(9).font('Helvetica-Bold').fillColor(TEXT_DARK).text('CERTIFICATION', 50, y);
  y += 14;
  doc.fontSize(8.5).font('Helvetica').fillColor(TEXT_MID)
    .text(
      'This report was automatically generated by the CIVIX Integrated Citizen Engagement Platform. ' +
      'The data presented herein is accurate as of the date of generation. ' +
      'This document is certified for official use by the Municipality of Cantilan.',
      50, y, { width: W - 100, lineGap: 3, align: 'justify' }
    );
  y += 46;

  // Signature lines
  const sigW = 150;
  doc.moveTo(50, y).lineTo(50 + sigW, y).lineWidth(0.5).stroke(TEXT_DARK);
  doc.moveTo(W - 50 - sigW, y).lineTo(W - 50, y).lineWidth(0.5).stroke(TEXT_DARK);
  doc.fontSize(7.5).font('Helvetica').fillColor(TEXT_MID)
    .text('System Administrator', 50, y + 5, { width: sigW, align: 'center', lineBreak: false });
  doc.text('Authorized Municipal Official', W - 50 - sigW, y + 5, { width: sigW, align: 'center', lineBreak: false });

  // Footers on every page after the cover, then the contents' page numbers.
  const pageCount = pageNo();
  for (let i = 1; i < pageCount; i++) {
    doc.switchToPage(i);
    pageFooter(doc, i + 1, pageCount, reportId, verifyCode);
  }
  doc.switchToPage(0);
  for (const [num, rowY] of Object.entries(tocRowY)) {
    doc.fontSize(9).font('Helvetica-Bold').fillColor(TEXT_DARK)
      .text(String(sectionPage[num]), W - 90, rowY, { width: 30, align: 'right', lineBreak: false });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// EXCEL EXPORT — multi-sheet workbook with native in-cell data-bar "charts"
// ═════════════════════════════════════════════════════════════════════════════
const XL_BRAND      = 'FF1D4ED8';
const XL_BRAND_DARK = 'FF1E3A8A';
const XL_WHITE      = 'FFFFFFFF';
const XL_TEXT_DARK  = 'FF0F172A';
const XL_TEXT_MID   = 'FF475569';
const XL_ROW_ALT    = 'FFF8FAFC';
const XL_BORDER     = 'FFE2E8F0';

const XL_TYPE = {
  COMPLAINT:  { bar: 'FFDC2626', light: 'FFFEE2E2', text: 'FF991B1B', label: 'Complaint' },
  SUGGESTION: { bar: 'FF1D4ED8', light: 'FFDBEAFE', text: 'FF1E40AF', label: 'Suggestion' },
  FEEDBACK:   { bar: 'FF16A34A', light: 'FFDCFCE7', text: 'FF166534', label: 'Feedback' },
};
const XL_STATUS = {
  PENDING:     { bar: 'FF6B7280', light: 'FFF3F4F6', text: 'FF374151', label: 'Pending' },
  REVIEWING:   { bar: 'FF1D4ED8', light: 'FFDBEAFE', text: 'FF1E40AF', label: 'Reviewing' },
  IN_PROGRESS: { bar: 'FFCA8A04', light: 'FFFEF9C3', text: 'FF854D0E', label: 'In Progress' },
  RESOLVED:    { bar: 'FF16A34A', light: 'FFDCFCE7', text: 'FF166534', label: 'Resolved' },
};
const XL_SENTIMENT = {
  Positive: { bar: 'FF16A34A', light: 'FFDCFCE7', text: 'FF166534' },
  Neutral:  { bar: 'FF6B7280', light: 'FFF3F4F6', text: 'FF374151' },
  Negative: { bar: 'FFDC2626', light: 'FFFEE2E2', text: 'FF991B1B' },
};

function xlBorderThin() {
  return {
    top: { style: 'thin', color: { argb: XL_BORDER } },
    bottom: { style: 'thin', color: { argb: XL_BORDER } },
    left: { style: 'thin', color: { argb: XL_BORDER } },
    right: { style: 'thin', color: { argb: XL_BORDER } },
  };
}

// Banner + subtitle for the top of every sheet. Returns the next free row number.
// opts.center: true leaves the left corner clear (for a logo) and centers the title instead.
function xlBanner(sheet, lastCol, title, subtitle, opts = {}) {
  sheet.mergeCells(1, 1, 1, lastCol);
  const t = sheet.getCell(1, 1);
  t.value = title;
  t.font = { bold: true, size: 15, color: { argb: XL_WHITE } };
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_BRAND_DARK } };
  t.alignment = opts.center
    ? { vertical: 'middle', horizontal: 'center' }
    : { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(1).height = 32;

  sheet.mergeCells(2, 1, 2, lastCol);
  const s = sheet.getCell(2, 1);
  s.value = subtitle;
  s.font = { italic: true, size: 9.5, color: { argb: XL_TEXT_MID } };
  s.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  s.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(2).height = 18;

  return 4; // row 3 left blank as a spacer
}

function xlSectionLabel(sheet, row, lastCol, text) {
  sheet.mergeCells(row, 1, row, lastCol);
  const c = sheet.getCell(row, 1);
  c.value = text;
  c.font = { bold: true, size: 11, color: { argb: XL_TEXT_DARK } };
  c.border = { bottom: { style: 'medium', color: { argb: XL_BRAND } } };
  sheet.getRow(row).height = 20;
  return row + 1;
}

function xlHeaderRow(sheet, row, headers) {
  headers.forEach((h, i) => {
    const cell = sheet.getCell(row, i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 9.5, color: { argb: XL_WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_BRAND } };
    cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'center', indent: i === 0 ? 1 : 0 };
    cell.border = xlBorderThin();
  });
  sheet.getRow(row).height = 20;
  return row + 1;
}

function xlDataBar(sheet, ref, colorArgb) {
  sheet.addConditionalFormatting({
    ref,
    rules: [{
      type: 'dataBar',
      cfvo: [{ type: 'min' }, { type: 'max' }],
      color: { argb: colorArgb },
      border: false,
      gradient: true,
      priority: 1,
    }],
  });
}

// Landscape, fit-to-width, and a repeating header band on every printed page.
function xlPrintSetup(sheet, titleRowsRange) {
  sheet.pageSetup.orientation = 'landscape';
  sheet.pageSetup.fitToPage = true;
  sheet.pageSetup.fitToWidth = 1;
  sheet.pageSetup.fitToHeight = 0;
  sheet.pageSetup.margins = { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 };
  sheet.pageSetup.horizontalCentered = true;
  if (titleRowsRange) sheet.pageSetup.printTitlesRow = titleRowsRange;
  sheet.headerFooter.oddFooter = '&L&8CIVIX – Municipality of Cantilan, Surigao del Sur — Confidential&C&8&P of &N&R&8Generated &D';
}

const titleCase = s => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase().replace(/_/g, ' ') : '');

async function generateExcel(req, res) {
  const period = periodFrom(req, res);
  if (!period) return;
  try {
    const [d, settings] = await Promise.all([gatherReport(period), ensureSettings()]);
    const isAll = period.kind === 'all';
    const word = period.word;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CIVIX System';
    workbook.created = new Date();
    workbook.title = `CIVIX ${period.title}`;
    const genDate = fmtDate(new Date());
    const zebra = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_ROW_ALT } };

    // ══════════════════════════════════════════════════════════════════════
    // SHEET 1 — Summary
    // ══════════════════════════════════════════════════════════════════════
    const sSummary = workbook.addWorksheet('Summary', { views: [{ showGridLines: false }] });
    xlPrintSetup(sSummary, '1:2');
    sSummary.columns = [{ width: 32 }, { width: 16 }, { width: 16 }, { width: 16 }];
    // (The municipality is named in every page footer; the period needs the room here.)
    let r = xlBanner(sSummary, 4, `CIVIX — ${period.title}`,
      `${isAll ? 'Municipality of Cantilan, Surigao del Sur' : period.rangeFull}   |   Generated ${genDate}`, { center: true });

    // Embed the official municipal seal in the top-left corner of the banner.
    try {
      const seal = await loadSealImage(settings.sealUrl);
      if (seal) {
        const sealImageId = workbook.addImage({ buffer: seal.buffer, extension: seal.extension });
        sSummary.addImage(sealImageId, { tl: { col: 0.12, row: 0.08 }, ext: { width: 30, height: 30 } });
      }
    } catch (imgErr) {
      console.warn('[reports] Could not embed municipal seal in Excel export:', imgErr.message);
    }

    r = xlSectionLabel(sSummary, r, 4, 'Key Performance Indicators');
    r = xlHeaderRow(sSummary, r, ['Metric', 'Value', '', '']);
    // How urgent the complaints and suggestions were, and the urgent ones resolved on time.
    const urgencyRows = [
      ['Urgent Reports', d.urgent],
      ['Normal Reports', d.normal],
      ['Can-Wait Reports', d.canWait],
      ['Urgent Reports Resolved On Time', d.urgentResolved ? `${d.urgentOnTime} of ${d.urgentResolved}` : 'None resolved yet'],
    ];
    const kpiRows = isAll ? [
      ['Total Submissions', d.total],
      ['Response Rate (%)', d.responseRate],
      ['Avg. Resolution Time (days)', d.avgDays],
      ['Registered Citizens', d.citizens],
      ...urgencyRows,
    ] : [
      ['Reporting Period', period.rangeFull],
      ['Total Submissions', d.total],
      [`Submissions in the Previous ${titleCase(word)}`, d.previousTotal],
      ['Response Rate (%)', d.responseRate],
      ['Avg. Resolution Time (days)', d.avgDays],
      ['Registered Citizens (all time)', d.citizens],
      ...urgencyRows,
    ];
    kpiRows.forEach(([label, value]) => {
      const text = typeof value === 'string';
      if (text) sSummary.mergeCells(r, 2, r, 4); // the period's dates need the room
      sSummary.getCell(r, 1).value = label;
      sSummary.getCell(r, 1).border = xlBorderThin();
      sSummary.getCell(r, 2).value = value;
      sSummary.getCell(r, 2).font = { bold: true, color: { argb: XL_TEXT_DARK } };
      sSummary.getCell(r, 2).alignment = { horizontal: text ? 'left' : 'center', indent: text ? 1 : 0 };
      sSummary.getCell(r, 2).border = xlBorderThin();
      if (r % 2 === 0) { sSummary.getCell(r, 1).fill = zebra; sSummary.getCell(r, 2).fill = zebra; }
      r++;
    });
    r += 1;

    // Count, and its share of `whole`, for each row of a small table.
    const shareRows = (rows, whole, metaOf) => {
      const start = r;
      rows.forEach(([key, val]) => {
        const meta = metaOf(key);
        const cell = sSummary.getCell(r, 1);
        cell.value = meta.label || key;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: meta.light } };
        cell.font = { bold: true, color: { argb: meta.text } };
        cell.border = xlBorderThin();
        sSummary.getCell(r, 2).value = val;
        sSummary.getCell(r, 2).alignment = { horizontal: 'center' };
        sSummary.getCell(r, 2).border = xlBorderThin();
        sSummary.getCell(r, 3).value = whole > 0 ? parseFloat(((val / whole) * 100).toFixed(1)) : 0;
        sSummary.getCell(r, 3).numFmt = '0.0"%"';
        sSummary.getCell(r, 3).alignment = { horizontal: 'center' };
        sSummary.getCell(r, 3).border = xlBorderThin();
        r++;
      });
      xlDataBar(sSummary, `B${start}:B${r - 1}`, XL_BRAND);
      r += 1;
    };

    r = xlSectionLabel(sSummary, r, 4, 'Submission Type Distribution');
    r = xlHeaderRow(sSummary, r, ['Type', 'Count', '% of Total', '']);
    shareRows([['COMPLAINT', d.complaints], ['SUGGESTION', d.suggestions], ['FEEDBACK', d.feedbacks]], d.total, k => XL_TYPE[k]);

    r = xlSectionLabel(sSummary, r, 4, 'Sentiment Distribution');
    r = xlHeaderRow(sSummary, r, ['Sentiment', 'Count', '% of Total', '']);
    shareRows([['Positive', d.positive], ['Neutral', d.neutral], ['Negative', d.negative]], d.total, k => XL_SENTIMENT[k]);

    // Statuses apply to complaints and suggestions only (feedback has no workflow).
    r = xlSectionLabel(sSummary, r, 4, 'Status Breakdown (complaints and suggestions)');
    r = xlHeaderRow(sSummary, r, ['Status', 'Count', '% of Cases', '']);
    shareRows([['PENDING', d.pending], ['REVIEWING', d.reviewing], ['IN_PROGRESS', d.inProgress], ['RESOLVED', d.resolved]],
      d.complaints + d.suggestions, k => XL_STATUS[k]);

    // ══════════════════════════════════════════════════════════════════════
    // SHEET 2 — Trend: each day of the week or month, each month of the year,
    // or the last 12 months (all time)
    // ══════════════════════════════════════════════════════════════════════
    const byDay = period.kind === 'week' || period.kind === 'month';
    const trendName = isAll ? 'Monthly Trend' : byDay ? 'Daily Breakdown' : 'Monthly Breakdown';
    const sTrend = workbook.addWorksheet(trendName, { views: [{ state: 'frozen', ySplit: 4, showGridLines: false }] });
    xlPrintSetup(sTrend, '1:4');
    sTrend.columns = [{ width: byDay ? 30 : 22 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 12 }];
    let rm = xlBanner(sTrend, 5, `CIVIX — ${trendName}`,
      isAll ? `Submissions over the last 12 months   |   Generated ${genDate}` : `${period.rangeFull}   |   Generated ${genDate}`);
    rm = xlHeaderRow(sTrend, rm, [byDay ? 'Day' : 'Month', 'Total', 'Complaints', 'Suggestions', 'Feedback']);
    const trendStart = rm;
    d.trend.forEach((m, i) => {
      sTrend.getCell(rm, 1).value = m.long;
      sTrend.getCell(rm, 2).value = m.total;
      sTrend.getCell(rm, 3).value = m.COMPLAINT;
      sTrend.getCell(rm, 4).value = m.SUGGESTION;
      sTrend.getCell(rm, 5).value = m.FEEDBACK;
      for (let c = 1; c <= 5; c++) {
        const cell = sTrend.getCell(rm, c);
        cell.border = xlBorderThin();
        if (c > 1) cell.alignment = { horizontal: 'center' };
        if (i % 2 === 0) cell.fill = zebra;
      }
      rm++;
    });
    // Totals as formulas, so they follow any edits.
    sTrend.getCell(rm, 1).value = 'Total';
    ['B', 'C', 'D', 'E'].forEach((col, i) => {
      const key = ['total', 'COMPLAINT', 'SUGGESTION', 'FEEDBACK'][i];
      sTrend.getCell(`${col}${rm}`).value = { formula: `SUM(${col}${trendStart}:${col}${rm - 1})`, result: d.trend.reduce((n, t) => n + t[key], 0) };
    });
    for (let c = 1; c <= 5; c++) {
      const cell = sTrend.getCell(rm, c);
      cell.font = { bold: true, color: { argb: XL_TEXT_DARK } };
      cell.border = { ...xlBorderThin(), top: { style: 'medium', color: { argb: XL_BRAND } } };
      if (c > 1) cell.alignment = { horizontal: 'center' };
    }
    xlDataBar(sTrend, `B${trendStart}:B${rm - 1}`, XL_BRAND);
    xlDataBar(sTrend, `C${trendStart}:C${rm - 1}`, XL_TYPE.COMPLAINT.bar);
    xlDataBar(sTrend, `D${trendStart}:D${rm - 1}`, XL_TYPE.SUGGESTION.bar);
    xlDataBar(sTrend, `E${trendStart}:E${rm - 1}`, XL_TYPE.FEEDBACK.bar);

    // ══════════════════════════════════════════════════════════════════════
    // SHEET 3 — Quarterly (all time, or the four quarters of the year)
    // ══════════════════════════════════════════════════════════════════════
    if (isAll || period.kind === 'year') {
      const sQuarter = workbook.addWorksheet('Quarterly', { views: [{ state: 'frozen', ySplit: 4, showGridLines: false }] });
      xlPrintSetup(sQuarter, '1:4');
      sQuarter.columns = [{ width: isAll ? 16 : 24 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 12 }];
      let rq = xlBanner(sQuarter, 5, 'CIVIX — Submissions by Quarter',
        `${isAll ? 'All recorded quarters' : `The four quarters of ${period.range}`}   |   Generated ${genDate}`);
      rq = xlHeaderRow(sQuarter, rq, ['Quarter', 'Total', 'Complaints', 'Suggestions', 'Feedback']);
      const quarterStart = rq;
      d.quarters.forEach((q, i) => {
        sQuarter.getCell(rq, 1).value = q.label;
        sQuarter.getCell(rq, 2).value = q.total;
        sQuarter.getCell(rq, 3).value = q.COMPLAINT;
        sQuarter.getCell(rq, 4).value = q.SUGGESTION;
        sQuarter.getCell(rq, 5).value = q.FEEDBACK;
        for (let c = 1; c <= 5; c++) {
          const cell = sQuarter.getCell(rq, c);
          cell.border = xlBorderThin();
          if (c > 1) cell.alignment = { horizontal: 'center' };
          if (i % 2 === 0) cell.fill = zebra;
        }
        rq++;
      });
      if (d.quarters.length) {
        xlDataBar(sQuarter, `B${quarterStart}:B${rq - 1}`, XL_BRAND);
        xlDataBar(sQuarter, `C${quarterStart}:C${rq - 1}`, XL_TYPE.COMPLAINT.bar);
        xlDataBar(sQuarter, `D${quarterStart}:D${rq - 1}`, XL_TYPE.SUGGESTION.bar);
        xlDataBar(sQuarter, `E${quarterStart}:E${rq - 1}`, XL_TYPE.FEEDBACK.bar);
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // SHEET 4 — By Department
    // ══════════════════════════════════════════════════════════════════════
    const sDept = workbook.addWorksheet('By Department', { views: [{ state: 'frozen', ySplit: 4, showGridLines: false }] });
    xlPrintSetup(sDept, '1:4');
    sDept.columns = [{ width: 38 }, { width: 13 }, { width: 13 }, { width: 12 }, { width: 10 }];
    let rd = xlBanner(sDept, 5, 'CIVIX — By Department',
      `${isAll ? 'Workload distribution across departments' : `${period.rangeFull}, by assigned office`}   |   Generated ${genDate}`);
    rd = xlHeaderRow(sDept, rd, ['Department', 'Complaints', 'Suggestions', 'Feedback', 'Total']);
    const deptStart = rd;
    d.departments.forEach((row, i) => {
      sDept.getCell(rd, 1).value = row.dept;
      sDept.getCell(rd, 2).value = row.COMPLAINT;
      sDept.getCell(rd, 3).value = row.SUGGESTION;
      sDept.getCell(rd, 4).value = row.FEEDBACK;
      sDept.getCell(rd, 5).value = row.total;
      for (let c = 1; c <= 5; c++) {
        const cell = sDept.getCell(rd, c);
        cell.border = xlBorderThin();
        if (c > 1) cell.alignment = { horizontal: 'center' };
        if (i % 2 === 0) cell.fill = zebra;
      }
      sDept.getCell(rd, 5).font = { bold: true };
      rd++;
    });
    if (d.departments.length) xlDataBar(sDept, `E${deptStart}:E${rd - 1}`, XL_BRAND);

    rd += 2;
    rd = xlSectionLabel(sDept, rd, 5, 'Top Departments Cited by Citizens at Submission Time');
    rd = xlHeaderRow(sDept, rd, ['Department (as selected by citizen)', 'Times Selected', '', '', '']);
    const citedStart = rd;
    d.citedDepartments.forEach((c, i) => {
      sDept.getCell(rd, 1).value = c.name;
      sDept.getCell(rd, 2).value = c.value;
      sDept.getCell(rd, 1).border = xlBorderThin();
      sDept.getCell(rd, 2).border = xlBorderThin();
      sDept.getCell(rd, 2).alignment = { horizontal: 'center' };
      if (i % 2 === 0) { sDept.getCell(rd, 1).fill = zebra; sDept.getCell(rd, 2).fill = zebra; }
      rd++;
    });
    if (d.citedDepartments.length) xlDataBar(sDept, `B${citedStart}:B${rd - 1}`, 'FF7C3AED');

    // ══════════════════════════════════════════════════════════════════════
    // SHEET 5 — Submissions: every one filed in the period (all time: the most
    // recent 100). Filters on the header row.
    // ══════════════════════════════════════════════════════════════════════
    const logName = isAll ? 'Recent Submissions' : 'Submissions';
    const sLog = workbook.addWorksheet(logName, { views: [{ state: 'frozen', ySplit: 4, showGridLines: false }] });
    xlPrintSetup(sLog, '1:4');
    sLog.columns = [
      { width: 20 }, { width: 13 }, { width: 40 }, { width: 14 }, { width: 11 }, { width: 12 }, { width: 22 },
    ];
    const logNote = isAll ? `Most recent ${d.log.length} submission(s)`
      : d.log.length < d.total ? `The ${d.log.length} most recent of ${d.total} submissions filed ${period.rangeFull}`
        : `All ${d.total} submission(s) filed ${period.rangeFull}`;
    let rl = xlBanner(sLog, 7, `CIVIX — ${isAll ? 'Recent Submissions Log' : 'Submissions Log'}`, `${logNote}   |   Generated ${genDate}`);
    const logHeader = rl;
    rl = xlHeaderRow(sLog, rl, ['Tracking ID', 'Type', 'Office', 'Status', 'Urgency', 'Sentiment', 'Date Filed']);
    if (d.log.length) sLog.autoFilter = { from: { row: logHeader, column: 1 }, to: { row: logHeader, column: 7 } };
    d.log.forEach((s, i) => {
      sLog.getCell(rl, 1).value = s.trackingId;

      const tMeta = XL_TYPE[s.type] || { light: 'FFF3F4F6', text: 'FF374151', label: s.type };
      const tCell = sLog.getCell(rl, 2);
      tCell.value = tMeta.label || s.type;
      tCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: tMeta.light } };
      tCell.font = { color: { argb: tMeta.text }, bold: true };
      tCell.alignment = { horizontal: 'center' };

      sLog.getCell(rl, 3).value = officeName(s);

      const stMeta = XL_STATUS[s.status] || { light: 'FFF3F4F6', text: 'FF374151', label: s.status };
      const stCell = sLog.getCell(rl, 4);
      stCell.value = stMeta.label || s.status;
      stCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: stMeta.light } };
      stCell.font = { color: { argb: stMeta.text }, bold: true };
      stCell.alignment = { horizontal: 'center' };

      // Feedback has no urgency (no office acts on it).
      sLog.getCell(rl, 5).value = s.type === 'FEEDBACK' ? '—' : (PRIORITY_LABELS[s.priority] || titleCase(s.priority));
      sLog.getCell(rl, 5).alignment = { horizontal: 'center' };
      sLog.getCell(rl, 6).value = titleCase(s.sentiment);
      sLog.getCell(rl, 6).alignment = { horizontal: 'center' };
      // A real date (sortable, filterable), at Philippine time. Excel dates carry
      // no time zone, so the cell holds the Manila clock reading.
      const filed = sLog.getCell(rl, 7);
      filed.value = new Date(new Date(s.createdAt).getTime() + 8 * 60 * 60 * 1000);
      filed.numFmt = 'mmm d, yyyy h:mm AM/PM';
      filed.alignment = { horizontal: 'left' };

      for (let c = 1; c <= 7; c++) sLog.getCell(rl, c).border = xlBorderThin();
      if (i % 2 === 0) for (const c of [1, 3, 5, 6, 7]) sLog.getCell(rl, c).fill = zebra;
      rl++;
    });
    if (!d.log.length) {
      sLog.mergeCells(rl, 1, rl, 7);
      sLog.getCell(rl, 1).value = `No submissions were filed in this ${word}.`;
      sLog.getCell(rl, 1).font = { italic: true, color: { argb: XL_TEXT_MID } };
      sLog.getCell(rl, 1).alignment = { horizontal: 'center' };
    }

    // ── Stream the workbook ──────────────────────────────────────────────────
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${reportFileName(period, 'xlsx')}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Excel generation error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate Excel report' });
    }
  }
}

module.exports = { generatePDF, generateExcel, getReportPeriods };
