const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function pageFooter(doc, pageNum, reportId, verifyCode) {
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
    .text(`Page ${pageNum}`, 50, H - 30, { width: W - 100, align: 'center', lineBreak: false });
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

  const maxCount = Math.max(
    1,
    ...TOP.map(d => Math.max(...TYPES.map(t => d.counts[t] || 0)))
  );

  // Chart background
  doc.rect(CHART_X, y, CHART_W, CHART_H).fill('#fafafa');
  doc.rect(CHART_X, y, CHART_W, CHART_H).lineWidth(0.4).stroke(DIVIDER);

  // Y-axis grid lines + labels
  for (let i = 0; i <= 4; i++) {
    const val = Math.round((maxCount / 4) * i);
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

    // Rotated x-label
    const short  = d.dept.replace('Municipal ', 'Mun. ').replace(' Office', '').slice(0, 16);
    const labelX = gx + (BAR_W * TYPES.length) / 2;
    doc.save()
      .translate(labelX, C_BOT + 6)
      .rotate(-42)
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

// ── Monthly trend — line/area chart ────────────────────────────────────────────
function drawLineChart(doc, data, x, y, w, h) {
  const maxVal = Math.max(1, ...data.map(m => m.total));
  const n = data.length;
  const stepX = n > 1 ? w / (n - 1) : 0;
  const pts = data.map((m, i) => ({ x: x + i * stepX, y: y + h - (m.total / maxVal) * h }));

  doc.rect(x, y, w, h).fill('#fafafa');
  doc.rect(x, y, w, h).lineWidth(0.4).stroke(DIVIDER);

  for (let i = 0; i <= 4; i++) {
    const val = Math.round((maxVal / 4) * i);
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

  // X-axis month labels
  data.forEach((m, i) => {
    doc.fontSize(6.5).font('Helvetica').fillColor(TEXT_MID)
      .text(m.label, pts[i].x - 16, y + h + 6, { width: 32, align: 'center', lineBreak: false });
  });

  doc.moveTo(x, y + h).lineTo(x + w, y + h).lineWidth(0.7).stroke(TEXT_LIGHT);
}

// ═════════════════════════════════════════════════════════════════════════════
async function generatePDF(req, res) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="civix-analytics-report.pdf"');
  doc.pipe(res);

  try {
    // ── Fetch all data upfront ──────────────────────────────────────────────
    const [
      total, pending, reviewing, inProgress, resolved,
      positive, neutral, negative,
      complaints, suggestions, feedbacks,
    ] = await Promise.all([
      prisma.submission.count(),
      prisma.submission.count({ where: { status: 'PENDING' } }),
      prisma.submission.count({ where: { status: 'REVIEWING' } }),
      prisma.submission.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.submission.count({ where: { status: 'RESOLVED' } }),
      prisma.submission.count({ where: { sentiment: 'POSITIVE' } }),
      prisma.submission.count({ where: { sentiment: 'NEUTRAL' } }),
      prisma.submission.count({ where: { sentiment: 'NEGATIVE' } }),
      prisma.submission.count({ where: { type: 'COMPLAINT' } }),
      prisma.submission.count({ where: { type: 'SUGGESTION' } }),
      prisma.submission.count({ where: { type: 'FEEDBACK' } }),
    ]);

    const resolvedSubs = await prisma.submission.findMany({
      where: { status: 'RESOLVED' },
      select: { createdAt: true, updatedAt: true },
    });
    let avgDays = '0.0';
    if (resolvedSubs.length) {
      const ms = resolvedSubs.reduce((s, r) => s + (r.updatedAt - r.createdAt), 0);
      avgDays = (ms / resolvedSubs.length / 86400000).toFixed(1);
    }
    const responseRate = total > 0 ? ((total - pending) / total * 100).toFixed(1) : '0.0';

    const allTypeSubs = await prisma.submission.findMany({
      select: { department: true, type: true, createdAt: true },
    });
    const deptMap = {};
    const monthBuckets = {};
    const nowRef = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(nowRef.getFullYear(), nowRef.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthBuckets[key] = { label: d.toLocaleString('en-US', { month: 'short', year: '2-digit' }), total: 0, COMPLAINT: 0, SUGGESTION: 0, FEEDBACK: 0 };
    }
    for (const s of allTypeSubs) {
      if (s.department && s.department !== 'UNASSIGNED') {
        if (!deptMap[s.department])
          deptMap[s.department] = { COMPLAINT: 0, SUGGESTION: 0, FEEDBACK: 0, total: 0 };
        if (deptMap[s.department][s.type] !== undefined) deptMap[s.department][s.type]++;
        deptMap[s.department].total++;
      }
      const mKey = `${s.createdAt.getFullYear()}-${String(s.createdAt.getMonth() + 1).padStart(2, '0')}`;
      if (monthBuckets[mKey]) { monthBuckets[mKey].total++; if (monthBuckets[mKey][s.type] !== undefined) monthBuckets[mKey][s.type]++; }
    }
    const deptData = Object.entries(deptMap)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 15)
      .map(([dept, d]) => ({ dept, counts: d, total: d.total }));
    const monthlyData = Object.values(monthBuckets);

    const recentSubs = await prisma.submission.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { user: { select: { fullName: true } } },
    });

    const W = doc.page.width;
    const H = doc.page.height;

    // Report ID + verification code — printed on the cover and every page footer
    // so a physical printout can be traced back to the exact data snapshot it was
    // generated from (a stray page found later can still be matched to its report).
    const genTime = new Date();
    const reportId = `CIVIX-${genTime.toISOString().replace(/[-:T]/g, '').slice(0, 14)}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const verifyPayload = `${reportId}|${total}|${resolved}|${pending}|${genTime.toISOString()}`;
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
    const titleText = 'CIVIX Analytics Report';
    doc.font('Helvetica-Bold').fontSize(25);
    const titleWidth = doc.widthOfString(titleText);
    const SEAL_SIZE = 46;
    const SEAL_GAP = 14;
    let sealPath = null;
    try { sealPath = path.join(__dirname, '../../../client/public/cantilan-seal.png'); fs.accessSync(sealPath); } catch (_) { sealPath = null; }
    const groupWidth = (sealPath ? SEAL_SIZE + SEAL_GAP : 0) + titleWidth;
    const groupX = (W - groupWidth) / 2;
    const titleY = 100;
    if (sealPath) {
      doc.image(sealPath, groupX, titleY + (25 - SEAL_SIZE) / 2 + 4, { width: SEAL_SIZE, height: SEAL_SIZE });
    }
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(25)
      .text(titleText, groupX + (sealPath ? SEAL_SIZE + SEAL_GAP : 0), titleY, { lineBreak: false });

    doc.fillColor('#bfdbfe').fontSize(11).font('Helvetica')
      .text('Integrated Citizen Engagement Platform', 0, 140, { align: 'center', width: W, lineBreak: false });
    doc.fillColor('#93c5fd').fontSize(8.5).font('Helvetica')
      .text(`Generated: ${fmtDate(new Date())}`, 0, 162, { align: 'center', width: W });

    // Meta info box
    const bx = 100; const by = 218; const bw = W - 200; const bh = 152;
    doc.rect(bx, by, bw, bh).fill('#f0f9ff');
    doc.rect(bx, by, bw, bh).lineWidth(0.6).stroke('#bfdbfe');
    doc.rect(bx, by, 4, bh).fill(BRAND);
    const meta = [
      ['Report Date',       fmtDate(new Date())],
      ['Reporting Period',  'All Recorded Submissions'],
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
    doc.fontSize(10).font('Helvetica-Bold').fillColor(TEXT_DARK).text('Executive Summary', 50, 394);
    doc.moveTo(50, 410).lineTo(W - 50, 410).lineWidth(0.5).stroke(DIVIDER);
    doc.fontSize(9).font('Helvetica').fillColor(TEXT_MID)
      .text(
        `This report presents a comprehensive statistical analysis of citizen engagement submissions ` +
        `recorded through the CIVIX platform for the Municipality of Cantilan, Surigao del Sur. ` +
        `A total of ${total.toLocaleString()} submission(s) have been recorded, comprising complaints, ` +
        `suggestions, and service feedback from registered citizens. The current response rate stands at ` +
        `${responseRate}%, with an average resolution time of ${avgDays} day(s). This document is intended ` +
        `for review by municipal officials and designated department heads.`,
        50, 422, { width: W - 100, lineGap: 4, align: 'justify' }
      );

    // Table of Contents
    doc.fontSize(10).font('Helvetica-Bold').fillColor(TEXT_DARK).text('Table of Contents', 50, 532);
    doc.moveTo(50, 548).lineTo(W - 50, 548).lineWidth(0.5).stroke(DIVIDER);
    const toc = [
      ['1.', 'Key Performance Indicators',          '2'],
      ['2.', 'Submission Type Distribution',        '2'],
      ['3.', 'Sentiment Analysis',                  '2'],
      ['4.', 'Monthly Trend Analysis',               '3'],
      ['5.', 'Submission Breakdown by Department',  '4'],
      ['6.', 'Recent Submissions Log',              '5'],
    ];
    let ty = 559;
    for (const [num, title, pg] of toc) {
      doc.fontSize(9).font('Helvetica').fillColor(TEXT_MID)
        .text(`${num}  ${title}`, 60, ty, { width: W - 160 });
      doc.fontSize(9).font('Helvetica-Bold').fillColor(TEXT_DARK)
        .text(pg, W - 90, ty, { width: 30, align: 'right' });
      doc.moveTo(60, ty + 12).lineTo(W - 100, ty + 12)
        .lineWidth(0.3).dash(1, { space: 3 }).stroke(DIVIDER);
      doc.undash();
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

    // Section 1 — KPIs
    y = sectionHead(doc, 1, 'Key Performance Indicators', y);

    const CARD_W = (W - 100 - 21) / 4;
    const CARD_H = 60;
    [
      ['Total Submissions', total,      BRAND,     ],
      ['Resolved',          resolved,   '#15803d'  ],
      ['In Progress',       inProgress, '#b45309'  ],
      ['Pending',           pending,    '#6B7280'  ],
    ].forEach(([lbl, val, acc], i) => {
      kpiCard(doc, lbl, val, 50 + i * (CARD_W + 7), y, CARD_W, CARD_H, acc);
    });
    y += CARD_H + 8;

    [
      ['Reviewing',        reviewing,            '#1d4ed8'],
      ['Response Rate',    `${responseRate}%`,   '#7c3aed'],
      ['Avg. Resolution',  `${avgDays} days`,    '#0369a1'],
      ['Feedbacks',        feedbacks,            '#059669'],
    ].forEach(([lbl, val, acc], i) => {
      kpiCard(doc, lbl, val, 50 + i * (CARD_W + 7), y, CARD_W, CARD_H, acc);
    });
    y += CARD_H + 22;

    // Section 2 — Type Distribution (pie)
    y = sectionHead(doc, 2, 'Submission Type Distribution', y);
    {
      const pieCx = 50 + 68; const pieCy = y + 52; const pieR = 48;
      const typeSlices = [
        { label: 'Complaints',  value: complaints,  color: TYPE_COLORS.COMPLAINT.bar },
        { label: 'Suggestions', value: suggestions, color: TYPE_COLORS.SUGGESTION.bar },
        { label: 'Feedback',    value: feedbacks,   color: TYPE_COLORS.FEEDBACK.bar },
      ];
      drawPieChart(doc, pieCx, pieCy, pieR, typeSlices);
      pieLegend(doc, 50 + 155, y + 8, typeSlices, total);
    }
    y += 122;

    // Section 3 — Sentiment (pie)
    y = sectionHead(doc, 3, 'Sentiment Analysis', y);
    {
      const pieCx = 50 + 68; const pieCy = y + 52; const pieR = 48;
      const sentSlices = [
        { label: 'Positive', value: positive, color: '#16A34A' },
        { label: 'Neutral',  value: neutral,  color: '#6B7280' },
        { label: 'Negative', value: negative, color: '#DC2626' },
      ];
      drawPieChart(doc, pieCx, pieCy, pieR, sentSlices);
      pieLegend(doc, 50 + 155, y + 8, sentSlices, total);
    }
    y += 122;

    pageFooter(doc, 2, reportId, verifyCode);

    // ══════════════════════════════════════════════════════════════════════
    // PAGE 3 — Monthly Trend Analysis
    // ══════════════════════════════════════════════════════════════════════
    doc.addPage();
    y = 50;
    y = sectionHead(doc, 4, 'Monthly Trend Analysis', y);
    doc.fontSize(8.5).font('Helvetica').fillColor(TEXT_MID)
      .text('Submission volume over the last twelve (12) months, broken down by type.', 50, y, { width: W - 100 });
    y += 20;

    const LC_X = 50 + 34;
    const LC_W = W - LC_X - 50;
    const LC_H = 190;
    drawLineChart(doc, monthlyData, LC_X, y, LC_W, LC_H);
    y += LC_H + 26;

    // Monthly data table
    doc.rect(50, y, W - 100, 18).fill(ROW_HEAD);
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#ffffff')
      .text('MONTH',       55,  y + 5, { width: 110 })
      .text('COMPLAINTS',  270, y + 5, { width: 75, align: 'center' })
      .text('SUGGESTIONS', 345, y + 5, { width: 80, align: 'center' })
      .text('FEEDBACK',    425, y + 5, { width: 65, align: 'center' })
      .text('TOTAL',       490, y + 5, { width: 50, align: 'center' });
    y += 18;
    monthlyData.forEach((m, i) => {
      if (y + 14 > H - 70) return;
      if (i % 2 === 0) doc.rect(50, y, W - 100, 14).fill(ROW_ALT);
      doc.rect(50, y, W - 100, 14).lineWidth(0.3).stroke(DIVIDER);
      doc.fontSize(7).font('Helvetica').fillColor(TEXT_DARK)
        .text(m.label,                   55,  y + 3.5, { width: 110 })
        .text(String(m.COMPLAINT),       270, y + 3.5, { width: 75, align: 'center' })
        .text(String(m.SUGGESTION),      345, y + 3.5, { width: 80, align: 'center' })
        .text(String(m.FEEDBACK),        425, y + 3.5, { width: 65, align: 'center' })
        .text(String(m.total),           490, y + 3.5, { width: 50, align: 'center' });
      y += 14;
    });

    pageFooter(doc, 3, reportId, verifyCode);

    // ══════════════════════════════════════════════════════════════════════
    // PAGE 4 — Department Breakdown
    // ══════════════════════════════════════════════════════════════════════
    doc.addPage();
    y = 50;
    y = sectionHead(doc, 5, 'Submission Breakdown by Department', y);

    // Legend
    let lx = 62;
    for (const [type, c] of Object.entries(TYPE_COLORS)) {
      doc.rect(lx, y, 11, 11).fill(c.bar);
      doc.fontSize(8.5).font('Helvetica').fillColor(TEXT_MID)
        .text(type.charAt(0) + type.slice(1).toLowerCase(), lx + 15, y + 1);
      lx += 90;
    }
    y += 20;

    y = drawBarChart(doc, deptData, y);
    y += 10;

    // Dept summary table
    if (deptData.length > 0 && y + 40 < H - 80) {
      doc.rect(50, y, W - 100, 18).fill(ROW_HEAD);
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#ffffff')
        .text('DEPARTMENT',  55,  y + 5, { width: 210 })
        .text('COMPLAINTS',  270, y + 5, { width: 70, align: 'center' })
        .text('SUGGESTIONS', 340, y + 5, { width: 75, align: 'center' })
        .text('FEEDBACK',    415, y + 5, { width: 65, align: 'center' })
        .text('TOTAL',       485, y + 5, { width: 55, align: 'center' });
      y += 18;

      for (const [i, d] of deptData.entries()) {
        if (y + 16 > H - 70) break;
        if (i % 2 === 0) doc.rect(50, y, W - 100, 16).fill(ROW_ALT);
        doc.rect(50, y, W - 100, 16).lineWidth(0.3).stroke(DIVIDER);
        const label = d.dept.length > 34 ? d.dept.slice(0, 32) + '…' : d.dept;
        doc.fontSize(7).font('Helvetica').fillColor(TEXT_DARK)
          .text(label,                         55,  y + 4, { width: 210 })
          .text(String(d.counts.COMPLAINT  || 0), 270, y + 4, { width: 70,  align: 'center' })
          .text(String(d.counts.SUGGESTION || 0), 340, y + 4, { width: 75,  align: 'center' })
          .text(String(d.counts.FEEDBACK   || 0), 415, y + 4, { width: 65,  align: 'center' })
          .text(String(d.total),                485, y + 4, { width: 55,  align: 'center' });
        y += 16;
      }
    }

    pageFooter(doc, 4, reportId, verifyCode);

    // ══════════════════════════════════════════════════════════════════════
    // PAGE 5 — Recent Submissions Log
    // ══════════════════════════════════════════════════════════════════════
    doc.addPage();
    y = 50;
    y = sectionHead(doc, 6, 'Recent Submissions Log', y);

    doc.fontSize(8.5).font('Helvetica').fillColor(TEXT_MID)
      .text(
        'The table below presents the ten (10) most recently recorded submissions on the CIVIX platform.',
        50, y, { width: W - 100 }
      );
    y += 22;

    // Table header
    doc.rect(50, y, W - 100, 18).fill(ROW_HEAD);
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#ffffff')
      .text('TRACKING ID',  55,  y + 5, { width: 120 })
      .text('CITIZEN',      180, y + 5, { width: 120 })
      .text('TYPE',         305, y + 5, { width: 70, align: 'center' })
      .text('STATUS',       380, y + 5, { width: 85, align: 'center' })
      .text('DATE FILED',   470, y + 5, { width: 85 });
    y += 18;

    for (const [i, s] of recentSubs.entries()) {
      if (y + 20 > H - 80) break;
      if (i % 2 === 0) doc.rect(50, y, W - 100, 20).fill(ROW_ALT);
      doc.rect(50, y, W - 100, 20).lineWidth(0.3).stroke(DIVIDER);

      const tC = TYPE_COLORS[s.type]   || { bar: '#6B7280', light: '#f3f4f6', text: '#374151' };
      const sC = STATUS_COLORS[s.status] || { bar: '#6B7280', light: '#f3f4f6', text: '#374151' };

      doc.fontSize(7.5).font('Helvetica').fillColor(TEXT_MID)
        .text(s.trackingId, 55, y + 6, { width: 120 });
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor(TEXT_DARK)
        .text(s.user?.fullName || 'Anonymous', 180, y + 6, { width: 120 });

      // Type badge
      doc.rect(307, y + 4, 64, 12).fill(tC.light);
      doc.fontSize(7).font('Helvetica-Bold').fillColor(tC.text)
        .text(s.type, 307, y + 7, { width: 64, align: 'center' });

      // Status badge
      doc.rect(382, y + 4, 80, 12).fill(sC.light);
      doc.fontSize(7).font('Helvetica-Bold').fillColor(sC.text)
        .text(s.status.replace(/_/g, ' '), 382, y + 7, { width: 80, align: 'center' });

      doc.fontSize(7.5).font('Helvetica').fillColor(TEXT_MID)
        .text(new Date(s.createdAt).toLocaleDateString('en-PH'), 470, y + 6, { width: 85 });

      y += 20;
    }

    // Certification block
    y += 24;
    if (y + 110 > H - 80) { y = H - 190; }
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

    pageFooter(doc, 5, reportId, verifyCode);

    doc.end();
  } catch (err) {
    console.error('PDF generation error:', err);
    // If headers not sent yet, attempt to abort cleanly
    try { doc.end(); } catch (_) {}
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate report' });
    }
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

async function generateExcel(req, res) {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CIVIX System';
    workbook.created = new Date();
    workbook.title = 'CIVIX Analytics Report';

    // ── Fetch all data (mirrors /api/analytics/* so numbers match the dashboard) ──
    const [
      total, pending, reviewing, inProgress, resolved,
      positive, neutral, negative,
      complaints, suggestions, feedbacks,
      citizens,
    ] = await Promise.all([
      prisma.submission.count(),
      prisma.submission.count({ where: { status: 'PENDING' } }),
      prisma.submission.count({ where: { status: 'REVIEWING' } }),
      prisma.submission.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.submission.count({ where: { status: 'RESOLVED' } }),
      prisma.submission.count({ where: { sentiment: 'POSITIVE' } }),
      prisma.submission.count({ where: { sentiment: 'NEUTRAL' } }),
      prisma.submission.count({ where: { sentiment: 'NEGATIVE' } }),
      prisma.submission.count({ where: { type: 'COMPLAINT' } }),
      prisma.submission.count({ where: { type: 'SUGGESTION' } }),
      prisma.submission.count({ where: { type: 'FEEDBACK' } }),
      prisma.user.count({ where: { role: 'CITIZEN' } }),
    ]);

    const resolvedSubs = await prisma.submission.findMany({
      where: { status: 'RESOLVED' },
      select: { createdAt: true, updatedAt: true },
    });
    let avgDays = 0;
    if (resolvedSubs.length) {
      const ms = resolvedSubs.reduce((s, r) => s + (r.updatedAt - r.createdAt), 0);
      avgDays = parseFloat((ms / resolvedSubs.length / 86400000).toFixed(1));
    }
    const responseRate = total > 0 ? parseFloat(((total - pending) / total * 100).toFixed(1)) : 0;

    const allSubs = await prisma.submission.findMany({
      select: { createdAt: true, type: true, department: true, citizenDepartment: true },
    });

    // Monthly (last 12 months)
    const months = {};
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months[key] = { label: d.toLocaleString('en-US', { month: 'long', year: 'numeric' }), total: 0, COMPLAINT: 0, SUGGESTION: 0, FEEDBACK: 0 };
    }
    // Quarterly (all time)
    const quarters = {};
    // Department (assigned)
    const deptMap = {};
    // Department (citizen-selected at submission time)
    const citizenDeptMap = {};

    for (const s of allSubs) {
      const mKey = `${s.createdAt.getFullYear()}-${String(s.createdAt.getMonth() + 1).padStart(2, '0')}`;
      if (months[mKey]) { months[mKey].total++; months[mKey][s.type]++; }

      const q = Math.ceil((s.createdAt.getMonth() + 1) / 3);
      const qKey = `${s.createdAt.getFullYear()} Q${q}`;
      if (!quarters[qKey]) quarters[qKey] = { label: qKey, year: s.createdAt.getFullYear(), q, COMPLAINT: 0, SUGGESTION: 0, FEEDBACK: 0, total: 0 };
      quarters[qKey][s.type]++; quarters[qKey].total++;

      if (s.department && s.department !== 'UNASSIGNED') {
        if (!deptMap[s.department]) deptMap[s.department] = { COMPLAINT: 0, SUGGESTION: 0, FEEDBACK: 0, total: 0 };
        deptMap[s.department][s.type]++; deptMap[s.department].total++;
      }
      if (s.citizenDepartment) {
        citizenDeptMap[s.citizenDepartment] = (citizenDeptMap[s.citizenDepartment] || 0) + 1;
      }
    }
    const monthlyData = Object.values(months);
    const quarterlyData = Object.values(quarters).sort((a, b) => a.year - b.year || a.q - b.q);
    const deptData = Object.entries(deptMap).sort((a, b) => b[1].total - a[1].total).map(([dept, d]) => ({ dept, ...d }));
    const citizenDeptData = Object.entries(citizenDeptMap).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([name, value]) => ({ name, value }));

    const recentSubs = await prisma.submission.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { fullName: true } } },
    });

    const genDate = fmtDate(new Date());

    // ══════════════════════════════════════════════════════════════════════
    // SHEET 1 — Summary
    // ══════════════════════════════════════════════════════════════════════
    const sSummary = workbook.addWorksheet('Summary', { views: [{ showGridLines: false }] });
    xlPrintSetup(sSummary, '1:2');
    sSummary.columns = [{ width: 30 }, { width: 16 }, { width: 16 }, { width: 16 }];
    let r = xlBanner(sSummary, 4, 'CIVIX — Analytics Report', `Municipality of Cantilan, Surigao del Sur   |   Generated ${genDate}`, { center: true });

    // Embed the official municipal seal in the top-left corner of the banner.
    try {
      const sealPath = path.join(__dirname, '../../../client/public/cantilan-seal.png');
      const sealBuffer = fs.readFileSync(sealPath);
      const sealImageId = workbook.addImage({ buffer: sealBuffer, extension: 'png' });
      sSummary.addImage(sealImageId, { tl: { col: 0.12, row: 0.08 }, ext: { width: 30, height: 30 } });
    } catch (imgErr) {
      console.warn('[reports] Could not embed municipal seal in Excel export:', imgErr.message);
    }

    r = xlSectionLabel(sSummary, r, 4, 'Key Performance Indicators');
    r = xlHeaderRow(sSummary, r, ['Metric', 'Value', '', '']);
    const kpiRows = [
      ['Total Submissions', total],
      ['Response Rate (%)', responseRate],
      ['Avg. Resolution Time (days)', avgDays],
      ['Registered Citizens', citizens],
    ];
    const kpiStart = r;
    kpiRows.forEach(([label, value]) => {
      sSummary.getCell(r, 1).value = label;
      sSummary.getCell(r, 1).border = xlBorderThin();
      sSummary.getCell(r, 2).value = value;
      sSummary.getCell(r, 2).font = { bold: true, color: { argb: XL_TEXT_DARK } };
      sSummary.getCell(r, 2).alignment = { horizontal: 'center' };
      sSummary.getCell(r, 2).border = xlBorderThin();
      if (r % 2 === 0) { sSummary.getCell(r, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_ROW_ALT } }; sSummary.getCell(r, 2).fill = sSummary.getCell(r, 1).fill; }
      r++;
    });
    r += 1;

    r = xlSectionLabel(sSummary, r, 4, 'Submission Type Distribution');
    r = xlHeaderRow(sSummary, r, ['Type', 'Count', '% of Total', '']);
    const typeBarStart = r;
    [['COMPLAINT', complaints], ['SUGGESTION', suggestions], ['FEEDBACK', feedbacks]].forEach(([key, val]) => {
      const meta = XL_TYPE[key];
      const cell = sSummary.getCell(r, 1);
      cell.value = meta.label;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: meta.light } };
      cell.font = { bold: true, color: { argb: meta.text } };
      cell.border = xlBorderThin();
      sSummary.getCell(r, 2).value = val;
      sSummary.getCell(r, 2).alignment = { horizontal: 'center' };
      sSummary.getCell(r, 2).border = xlBorderThin();
      sSummary.getCell(r, 3).value = total > 0 ? parseFloat(((val / total) * 100).toFixed(1)) : 0;
      sSummary.getCell(r, 3).numFmt = '0.0"%"';
      sSummary.getCell(r, 3).alignment = { horizontal: 'center' };
      sSummary.getCell(r, 3).border = xlBorderThin();
      r++;
    });
    xlDataBar(sSummary, `B${typeBarStart}:B${r - 1}`, XL_BRAND);
    r += 1;

    r = xlSectionLabel(sSummary, r, 4, 'Sentiment Distribution');
    r = xlHeaderRow(sSummary, r, ['Sentiment', 'Count', '% of Total', '']);
    const sentBarStart = r;
    [['Positive', positive], ['Neutral', neutral], ['Negative', negative]].forEach(([name, val]) => {
      const meta = XL_SENTIMENT[name];
      const cell = sSummary.getCell(r, 1);
      cell.value = name;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: meta.light } };
      cell.font = { bold: true, color: { argb: meta.text } };
      cell.border = xlBorderThin();
      sSummary.getCell(r, 2).value = val;
      sSummary.getCell(r, 2).alignment = { horizontal: 'center' };
      sSummary.getCell(r, 2).border = xlBorderThin();
      sSummary.getCell(r, 3).value = total > 0 ? parseFloat(((val / total) * 100).toFixed(1)) : 0;
      sSummary.getCell(r, 3).numFmt = '0.0"%"';
      sSummary.getCell(r, 3).alignment = { horizontal: 'center' };
      sSummary.getCell(r, 3).border = xlBorderThin();
      r++;
    });
    xlDataBar(sSummary, `B${sentBarStart}:B${r - 1}`, XL_BRAND);
    r += 1;

    r = xlSectionLabel(sSummary, r, 4, 'Status Breakdown');
    r = xlHeaderRow(sSummary, r, ['Status', 'Count', '% of Total', '']);
    const statBarStart = r;
    [['PENDING', pending], ['REVIEWING', reviewing], ['IN_PROGRESS', inProgress], ['RESOLVED', resolved]].forEach(([key, val]) => {
      const meta = XL_STATUS[key];
      const cell = sSummary.getCell(r, 1);
      cell.value = meta.label;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: meta.light } };
      cell.font = { bold: true, color: { argb: meta.text } };
      cell.border = xlBorderThin();
      sSummary.getCell(r, 2).value = val;
      sSummary.getCell(r, 2).alignment = { horizontal: 'center' };
      sSummary.getCell(r, 2).border = xlBorderThin();
      sSummary.getCell(r, 3).value = total > 0 ? parseFloat(((val / total) * 100).toFixed(1)) : 0;
      sSummary.getCell(r, 3).numFmt = '0.0"%"';
      sSummary.getCell(r, 3).alignment = { horizontal: 'center' };
      sSummary.getCell(r, 3).border = xlBorderThin();
      r++;
    });
    xlDataBar(sSummary, `B${statBarStart}:B${r - 1}`, XL_BRAND);

    // ══════════════════════════════════════════════════════════════════════
    // SHEET 2 — Monthly Trend
    // ══════════════════════════════════════════════════════════════════════
    const sMonthly = workbook.addWorksheet('Monthly Trend', { views: [{ state: 'frozen', ySplit: 4, showGridLines: false }] });
    xlPrintSetup(sMonthly, '1:4');
    sMonthly.columns = [{ width: 22 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 12 }];
    let rm = xlBanner(sMonthly, 5, 'CIVIX — Monthly Trend', `Submissions over the last 12 months   |   Generated ${genDate}`);
    rm = xlHeaderRow(sMonthly, rm, ['Month', 'Total', 'Complaints', 'Suggestions', 'Feedback']);
    const monthlyStart = rm;
    monthlyData.forEach((m, i) => {
      sMonthly.getCell(rm, 1).value = m.label;
      sMonthly.getCell(rm, 2).value = m.total;
      sMonthly.getCell(rm, 3).value = m.COMPLAINT;
      sMonthly.getCell(rm, 4).value = m.SUGGESTION;
      sMonthly.getCell(rm, 5).value = m.FEEDBACK;
      for (let c = 1; c <= 5; c++) {
        const cell = sMonthly.getCell(rm, c);
        cell.border = xlBorderThin();
        if (c > 1) cell.alignment = { horizontal: 'center' };
        if (i % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_ROW_ALT } };
      }
      rm++;
    });
    xlDataBar(sMonthly, `B${monthlyStart}:B${rm - 1}`, XL_BRAND);
    xlDataBar(sMonthly, `C${monthlyStart}:C${rm - 1}`, XL_TYPE.COMPLAINT.bar);
    xlDataBar(sMonthly, `D${monthlyStart}:D${rm - 1}`, XL_TYPE.SUGGESTION.bar);
    xlDataBar(sMonthly, `E${monthlyStart}:E${rm - 1}`, XL_TYPE.FEEDBACK.bar);

    // ══════════════════════════════════════════════════════════════════════
    // SHEET 3 — Quarterly
    // ══════════════════════════════════════════════════════════════════════
    const sQuarter = workbook.addWorksheet('Quarterly', { views: [{ state: 'frozen', ySplit: 4, showGridLines: false }] });
    xlPrintSetup(sQuarter, '1:4');
    sQuarter.columns = [{ width: 16 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 12 }];
    let rq = xlBanner(sQuarter, 5, 'CIVIX — Submissions by Quarter', `All recorded quarters   |   Generated ${genDate}`);
    rq = xlHeaderRow(sQuarter, rq, ['Quarter', 'Total', 'Complaints', 'Suggestions', 'Feedback']);
    const quarterStart = rq;
    quarterlyData.forEach((q, i) => {
      sQuarter.getCell(rq, 1).value = q.label;
      sQuarter.getCell(rq, 2).value = q.total;
      sQuarter.getCell(rq, 3).value = q.COMPLAINT;
      sQuarter.getCell(rq, 4).value = q.SUGGESTION;
      sQuarter.getCell(rq, 5).value = q.FEEDBACK;
      for (let c = 1; c <= 5; c++) {
        const cell = sQuarter.getCell(rq, c);
        cell.border = xlBorderThin();
        if (c > 1) cell.alignment = { horizontal: 'center' };
        if (i % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_ROW_ALT } };
      }
      rq++;
    });
    if (quarterlyData.length) {
      xlDataBar(sQuarter, `B${quarterStart}:B${rq - 1}`, XL_BRAND);
      xlDataBar(sQuarter, `C${quarterStart}:C${rq - 1}`, XL_TYPE.COMPLAINT.bar);
      xlDataBar(sQuarter, `D${quarterStart}:D${rq - 1}`, XL_TYPE.SUGGESTION.bar);
      xlDataBar(sQuarter, `E${quarterStart}:E${rq - 1}`, XL_TYPE.FEEDBACK.bar);
    }

    // ══════════════════════════════════════════════════════════════════════
    // SHEET 4 — By Department
    // ══════════════════════════════════════════════════════════════════════
    const sDept = workbook.addWorksheet('By Department', { views: [{ state: 'frozen', ySplit: 4, showGridLines: false }] });
    xlPrintSetup(sDept, '1:4');
    sDept.columns = [{ width: 38 }, { width: 13 }, { width: 13 }, { width: 12 }, { width: 10 }];
    let rd = xlBanner(sDept, 5, 'CIVIX — By Department', `Workload distribution across departments   |   Generated ${genDate}`);
    rd = xlHeaderRow(sDept, rd, ['Department', 'Complaints', 'Suggestions', 'Feedback', 'Total']);
    const deptStart = rd;
    deptData.forEach((d, i) => {
      sDept.getCell(rd, 1).value = d.dept;
      sDept.getCell(rd, 2).value = d.COMPLAINT;
      sDept.getCell(rd, 3).value = d.SUGGESTION;
      sDept.getCell(rd, 4).value = d.FEEDBACK;
      sDept.getCell(rd, 5).value = d.total;
      for (let c = 1; c <= 5; c++) {
        const cell = sDept.getCell(rd, c);
        cell.border = xlBorderThin();
        if (c > 1) cell.alignment = { horizontal: 'center' };
        if (i % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_ROW_ALT } };
      }
      sDept.getCell(rd, 5).font = { bold: true };
      rd++;
    });
    if (deptData.length) xlDataBar(sDept, `E${deptStart}:E${rd - 1}`, XL_BRAND);

    rd += 2;
    rd = xlSectionLabel(sDept, rd, 5, 'Top Departments Cited by Citizens at Submission Time');
    rd = xlHeaderRow(sDept, rd, ['Department (as selected by citizen)', 'Times Selected', '', '', '']);
    const citedStart = rd;
    citizenDeptData.forEach((c, i) => {
      sDept.getCell(rd, 1).value = c.name;
      sDept.getCell(rd, 2).value = c.value;
      sDept.getCell(rd, 1).border = xlBorderThin();
      sDept.getCell(rd, 2).border = xlBorderThin();
      sDept.getCell(rd, 2).alignment = { horizontal: 'center' };
      if (i % 2 === 0) { sDept.getCell(rd, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_ROW_ALT } }; sDept.getCell(rd, 2).fill = sDept.getCell(rd, 1).fill; }
      rd++;
    });
    if (citizenDeptData.length) xlDataBar(sDept, `B${citedStart}:B${rd - 1}`, 'FF7C3AED');

    // ══════════════════════════════════════════════════════════════════════
    // SHEET 5 — Recent Submissions
    // ══════════════════════════════════════════════════════════════════════
    const sLog = workbook.addWorksheet('Recent Submissions', { views: [{ state: 'frozen', ySplit: 4, showGridLines: false }] });
    xlPrintSetup(sLog, '1:4');
    sLog.columns = [
      { width: 20 }, { width: 24 }, { width: 14 }, { width: 14 }, { width: 10 }, { width: 12 }, { width: 16 },
    ];
    let rl = xlBanner(sLog, 7, 'CIVIX — Recent Submissions Log', `Most recent ${recentSubs.length} submission(s)   |   Generated ${genDate}`);
    rl = xlHeaderRow(sLog, rl, ['Tracking ID', 'Citizen', 'Type', 'Status', 'Priority', 'Sentiment', 'Date Filed']);
    recentSubs.forEach((s, i) => {
      sLog.getCell(rl, 1).value = s.trackingId;
      sLog.getCell(rl, 2).value = s.user?.fullName || 'Anonymous';
      sLog.getCell(rl, 2).font = s.user?.fullName ? {} : { italic: true, color: { argb: 'FF94A3B8' } };

      const tMeta = XL_TYPE[s.type] || { light: 'FFF3F4F6', text: 'FF374151', label: s.type };
      const tCell = sLog.getCell(rl, 3);
      tCell.value = tMeta.label || s.type;
      tCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: tMeta.light } };
      tCell.font = { color: { argb: tMeta.text }, bold: true };
      tCell.alignment = { horizontal: 'center' };

      const stMeta = XL_STATUS[s.status] || { light: 'FFF3F4F6', text: 'FF374151', label: s.status };
      const stCell = sLog.getCell(rl, 4);
      stCell.value = stMeta.label || s.status;
      stCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: stMeta.light } };
      stCell.font = { color: { argb: stMeta.text }, bold: true };
      stCell.alignment = { horizontal: 'center' };

      sLog.getCell(rl, 5).value = s.priority;
      sLog.getCell(rl, 5).alignment = { horizontal: 'center' };
      sLog.getCell(rl, 6).value = s.sentiment;
      sLog.getCell(rl, 6).alignment = { horizontal: 'center' };
      sLog.getCell(rl, 7).value = new Date(s.createdAt).toLocaleDateString('en-PH');

      for (let c = 1; c <= 7; c++) sLog.getCell(rl, c).border = xlBorderThin();
      if (i % 2 === 0) {
        for (const c of [1, 2, 5, 6, 7]) {
          if (!sLog.getCell(rl, c).fill) sLog.getCell(rl, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_ROW_ALT } };
        }
      }
      rl++;
    });

    // ── Stream the workbook ──────────────────────────────────────────────────
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="civix-analytics-report.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Excel generation error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate Excel report' });
    }
  }
}

module.exports = { generatePDF, generateExcel };
