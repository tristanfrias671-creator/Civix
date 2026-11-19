const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const crypto = require('crypto');
const { ensureSettings, getDepartmentList } = require('./settings');
const { loadSealImage } = require('../utils/branding');
const { parsePeriod, PeriodError, phDate, phIsoDate, phMonthKey, MONTHS } = require('../utils/reportPeriod');
const { PRIORITY_LABELS } = require('../utils/urgency');
const { CC_QUESTIONS, SQD, SQD_STATEMENTS } = require('../utils/csm');
const { satisfactionResults } = require('../utils/csmResults');
const { SQD_ACTIONS, lowParts } = require('../utils/csmActions');
const { REMARKS, REMARK_PLURAL } = require('../utils/remarks');
const { CHANNEL_LABELS } = require('../utils/channels');
const prisma = require('../utils/prisma');

// Reports staff marked as spam or invalid (status SPAM) are left out of every figure.
// Status figures (pending, resolved, response rate, resolution time) count cases
// only: feedback has no workflow (no status steps or deadline).
// Same rules as the admin dashboard (controllers/analytics.js).
const NOT_SPAM = { status: { not: 'SPAM' } };
const CASES = { type: { not: 'FEEDBACK' }, ...NOT_SPAM };

// ── Color constants (PDFKit accepts hex strings only — NO rgba()) ─────────────
// The PDF reads as a formal government report: black text, gray rules and
// shading, and color only inside the charts.
const BRAND      = '#1D4ED8'; // the trend line
const TEXT_DARK  = '#111827';
const TEXT_MID   = '#374151'; // notes and captions
const TEXT_LIGHT = '#4b5563'; // axis labels, page headers and footers (7.6:1 on white)
const RULE       = '#374151'; // table borders and section boxes
const GRID       = '#9ca3af'; // lines inside tables
const DIVIDER    = '#d1d5db'; // chart grid lines
const SHADE      = '#e5e7eb'; // section titles and label cells
const HEAD_FILL  = '#f3f4f6'; // table header rows, group rows and totals

const TYPE_COLORS = {
  COMPLAINT:  { bar: '#DC2626' },
  SUGGESTION: { bar: '#2563EB' },
  FEEDBACK:   { bar: '#16A34A' },
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
// Feedback shows the office it is about, or a dash when it is about the municipality as a whole.
const officeName = s => (s.type === 'FEEDBACK'
  ? (s.department && !['General', 'UNASSIGNED'].includes(s.department) ? s.department : '—')
  : !s.department || s.department === 'UNASSIGNED' ? 'Unassigned' : s.department);

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
  doc.moveTo(50, H - 48).lineTo(W - 50, H - 48).lineWidth(0.5).stroke(GRID);
  doc.fontSize(7).font('Helvetica').fillColor(TEXT_LIGHT)
    .text(
      'CIVIX – Integrated Citizen Engagement Platform  |  Municipality of Cantilan, Surigao del Sur  |  For Internal Use Only',
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

// The report's name and period at the top of every page after the first.
function pageHeader(doc, left, right) {
  const W = doc.page.width;
  const half = (W - 100) / 2;
  doc.fontSize(7.5).font('Helvetica').fillColor(TEXT_LIGHT)
    .text(left, 50, 29, { width: half + 40, lineBreak: false })
    .text(right, 50 + half - 40, 29, { width: half + 40, align: 'right', lineBreak: false });
  doc.moveTo(50, 41).lineTo(W - 50, 41).lineWidth(0.5).stroke(GRID);
}

// A section title in a shaded, bordered box across the page ("1.  Title", or
// just the title when num is null).
function sectionHead(doc, num, title, y) {
  const W = doc.page.width;
  doc.rect(50, y, W - 100, 20).lineWidth(0.75).fillAndStroke(SHADE, RULE);
  doc.fontSize(10.5).font('Helvetica-Bold').fillColor(TEXT_DARK)
    .text(num ? `${num}.  ${title}` : title, 58, y + 5.5, { width: W - 116, lineBreak: false });
  return y + 32;
}

// "Figure 1. ..." under a chart, centered.
function caption(doc, text, y) {
  const W = doc.page.width;
  doc.fontSize(8).font('Helvetica-Oblique').fillColor(TEXT_MID)
    .text(text, 50, y, { width: W - 100, align: 'center', lineBreak: false });
  return y + 14;
}

// The note statistical tables carry when rounded percentages miss 100.0%.
const ROUNDING_NOTE = 'Note: Percentages may not add up to 100.0% because of rounding.';

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

  // Chart frame
  doc.rect(CHART_X, y, CHART_W, CHART_H).lineWidth(0.5).stroke(GRID);

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
        // The count just above its bar, in dark text.
        doc.fontSize(7).font('Helvetica-Bold').fillColor(TEXT_DARK)
          .text(String(cnt), bx - 4, by - 9, { width: BAR_W + 6, align: 'center', lineBreak: false });
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
  doc.fontSize(7.5).font('Helvetica').fillColor(TEXT_MID)
    .text(`Note: Showing the top ${TOP.length} departments by number of submissions.`, CHART_X, noteY, { lineBreak: false });

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

// The pie's legend as a small table beside it: each slice's color, count and share.
function pieTable(doc, x, y, firstLabel, slices) {
  const right = doc.page.width - 50;
  const total = slices.reduce((n, s) => n + s.value, 0);
  // Each share rounded on its own (12 of 26 is 46.2% in every table).
  const tenths = slices.map(s => (total ? Math.round((s.value * 1000) / total) : 0));
  const rows = [
    ...slices.map((s, i) => ({ ...s, share: `${(tenths[i] / 10).toFixed(1)}%` })),
    { label: 'Total', value: total, share: total ? '100.0%' : '0.0%', isTotal: true },
  ];
  const countX = right - 150;
  const end = pdfTable(doc, y, [
    { label: firstLabel, x: x + 5, width: countX - x - 5 },
    { label: 'COUNT', x: countX, width: 70, align: 'center' },
    { label: 'PERCENT', x: countX + 70, width: 80, align: 'center' },
  ], rows, (row, ry) => {
    if (row.color) doc.rect(x + 6, ry + 4.5, 8, 8).fill(row.color);
    doc.fontSize(8).font(row.isTotal ? 'Helvetica-Bold' : 'Helvetica').fillColor(TEXT_DARK)
      .text(row.label, x + (row.color ? 20 : 6), ry + 5, { width: countX - x - 26, lineBreak: false })
      .text(String(row.value), countX, ry + 5, { width: 70, align: 'center', lineBreak: false })
      .text(row.share, countX + 70, ry + 5, { width: 80, align: 'center', lineBreak: false });
  }, { rowH: 17, left: x, right });
  if (total && tenths.reduce((n, t) => n + t, 0) !== 1000) {
    doc.fontSize(7).font('Helvetica').fillColor(TEXT_MID).text(ROUNDING_NOTE, x, end + 3, { width: right - x, lineBreak: false });
  }
  return end;
}

// ── A bordered table that carries on over new pages, repeating its header row ─
// cols: [{ label, x, width, align }]; drawRow(row, y, i) draws one row's cells.
// Group rows (head: true) and totals (isTotal: true) are shaded; a group row has
// no lines between its columns. Returns the y just below the table.
function pdfTable(doc, y, cols, rows, drawRow, { rowH = 16, headH = 18, left = 50, right = doc.page.width - 50 } = {}) {
  const bottom = doc.page.height - 70;
  // The line between two columns: halfway across the gap between them, or just
  // left of a column whose text starts at its edge.
  const seps = cols.slice(1).map((c, i) => {
    const end = cols[i].x + cols[i].width;
    if (end < c.x) return (end + c.x) / 2;
    return c.align === 'center' || c.align === 'right' ? c.x : c.x - 3;
  });
  const colLines = (from, to) => {
    doc.lineWidth(0.4).strokeColor(GRID);
    seps.forEach(x => doc.moveTo(x, from).lineTo(x, to).stroke());
  };
  let top = y; // where this page's part of the table starts
  const box = () => doc.rect(left, top, right - left, y - top).lineWidth(0.75).stroke(RULE);
  const header = () => {
    top = y;
    doc.rect(left, y, right - left, headH).fill(HEAD_FILL);
    colLines(y, y + headH);
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(TEXT_DARK);
    cols.forEach(c => doc.text(c.label, c.x, y + 5.5, { width: c.width, align: c.align || 'left', lineBreak: false }));
    y += headH;
    doc.moveTo(left, y).lineTo(right, y).lineWidth(0.75).stroke(RULE);
  };
  if (y + headH + rowH > bottom) { doc.addPage(); y = 50; }
  header();
  rows.forEach((row, i) => {
    if (y + rowH > bottom) { box(); doc.addPage(); y = 50; header(); }
    if (row.head || row.isTotal) doc.rect(left, y + 0.4, right - left, rowH - 0.4).fill(HEAD_FILL);
    if (!row.head) colLines(y, y + rowH);
    doc.moveTo(left, y + rowH).lineTo(right, y + rowH).lineWidth(0.4).stroke(GRID);
    drawRow(row, y, i);
    y += rowH;
  });
  box();
  return y;
}

// ── Monthly trend — line/area chart ────────────────────────────────────────────
function drawLineChart(doc, data, x, y, w, h) {
  const axis = niceAxis(Math.max(0, ...data.map(m => m.total)));
  const maxVal = axis.top;
  const n = data.length;
  const stepX = n > 1 ? w / (n - 1) : 0;
  const pts = data.map((m, i) => ({ x: x + i * stepX, y: y + h - (m.total / maxVal) * h }));

  doc.rect(x, y, w, h).lineWidth(0.5).stroke(GRID);

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

// ── Client satisfaction: the ARTA Client Satisfaction Measurement form ───────
// Each rating as dark text on a light fill.
const RATING_COLORS = {
  Outstanding:         { light: '#dcfce7', text: '#166534' },
  'Very Satisfactory': { light: '#ccfbf1', text: '#115e59' },
  Satisfactory:        { light: '#dbeafe', text: '#1e40af' },
  Fair:                { light: '#fef3c7', text: '#92400e' },
  Poor:                { light: '#fee2e2', text: '#991b1b' },
};
const pctText = value => (value == null ? '—' : `${value.toFixed(1)}%`);
const SCORE_NOTE = 'A score is the percentage of Agree and Strongly agree answers, not counting N/A. The overall score ' +
  'covers SQD1 to SQD8 together; SQD0 (overall satisfaction) is reported separately. ARTA rating scale: Outstanding, 95% and above; ' +
  'Very Satisfactory, 90% to 94.9%; Satisfactory, 80% to 89.9%; Fair, 60% to 79.9%; Poor, below 60%.';
const CODES_NOTE = "Each client gets a code on a slip from the office (New client), and one code opens one satisfaction form for 7 days, so each code is one transaction. RESPONSE RATE: the share of the codes given that were used to answer the form. Ratings of resolved complaints and suggestions use their Transaction Code instead and are not counted here.";
const SQD_SHORT = { sqd0: 'Overall satisfaction', ...Object.fromEntries(SQD.slice(1).map(key => [key, SQD_STATEMENTS[key].dimension])) };

// The overall row of ARTA's statement table: SQD1–SQD8's answers added up.
function overallCounts(result) {
  const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0, NA: 0 };
  for (const key of SQD.slice(1)) for (const answer of Object.keys(counts)) counts[answer] += result.sqd[key].counts[answer];
  return { counts, total: result.responses * (SQD.length - 1), score: result.overall };
}

// The Citizen's Charter rows: each question (short, to fit one line), then how many
// chose each option.
const CC_SHORT = {
  cc1: "CC1  Awareness of a Citizen's Charter",
  cc2: "CC2  If aware: was this office's Citizen's Charter easy to see?",
  cc3: "CC3  If aware: how much did the Citizen's Charter help in the transaction?",
};
function charterRows(result) {
  return ['cc1', 'cc2', 'cc3'].flatMap(key => [
    { head: true, label: CC_SHORT[key] },
    ...CC_QUESTIONS[key].options.map((option, i) => ({ label: option, count: result.charter[key][i] })),
  ]);
}

// Who answered: client type, sex and age group.
function clientRows(result) {
  return [
    { head: true, label: 'Client type' }, ...result.clients.types,
    { head: true, label: 'Sex' }, ...result.clients.sexes,
    { head: true, label: 'Age' }, ...result.clients.ages,
  ];
}

// A numbered title inside a section ("6.1  Results by office"), on a new page
// when too little room is left.
function subHead(doc, title, y, room = 90) {
  if (y + room > doc.page.height - 70) { doc.addPage(); y = 50; }
  doc.fontSize(9.5).font('Helvetica-Bold').fillColor(TEXT_DARK).text(title, 50, y, { width: doc.page.width - 100 });
  return y + 16;
}

// A rating in bold, centered in its cell ("—" when there is no score).
function ratingTag(doc, rating, x, y, width) {
  const known = Boolean(RATING_COLORS[rating]);
  doc.fontSize(7.5).font(known ? 'Helvetica-Bold' : 'Helvetica').fillColor(known ? TEXT_DARK : TEXT_MID)
    .text(rating || '—', x, y + 2, { width, align: 'center', lineBreak: false });
}

// Rows with a count and its share of `whole`; head rows name the group below them.
function shareTable(doc, y, firstLabel, rows, whole) {
  return pdfTable(doc, y, [
    { label: firstLabel, x: 55, width: 370 },
    { label: 'COUNT', x: 425, width: 50, align: 'center' },
    { label: '% OF ANSWERS', x: 475, width: 70, align: 'center' },
  ], rows, (row, ry) => {
    if (row.head) {
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor(TEXT_DARK)
        .text(fitText(doc, row.label, 365), 55, ry + 4, { width: 370, lineBreak: false });
      return;
    }
    doc.fontSize(7.5).font('Helvetica').fillColor(TEXT_DARK)
      .text(fitText(doc, row.label, 355), 65, ry + 4, { width: 360, lineBreak: false })
      .text(String(row.count), 425, ry + 4, { width: 50, align: 'center', lineBreak: false })
      .text(pctText(whole ? Math.round((row.count * 1000) / whole) / 10 : null), 475, ry + 4, { width: 70, align: 'center', lineBreak: false });
  }, { rowH: 15 });
}

// The codes each office gave its clients (New client) in the time, with how many
// were used to answer the form: the clients served and the response rate.
function drawCodes(doc, s, y, head) {
  const W = doc.page.width;
  const rows = [...s.offices, { department: 'All offices', ...s.all, isTotal: true }];
  y = head('Codes given to clients and response rate, by office', y);
  y = pdfTable(doc, y, [
    { label: 'OFFICE',        x: 55,  width: 170 },
    { label: 'CODES GIVEN',   x: 225, width: 65, align: 'center' },
    { label: 'ANSWERED',      x: 290, width: 60, align: 'center' },
    { label: 'NOT USED YET',  x: 350, width: 65, align: 'center' },
    { label: 'EXPIRED',       x: 415, width: 55, align: 'center' },
    { label: 'RESPONSE RATE', x: 470, width: 75, align: 'center' },
  ], rows, (o, ry) => {
    doc.fontSize(7.5).font(o.isTotal ? 'Helvetica-Bold' : 'Helvetica').fillColor(TEXT_DARK);
    doc.text(fitText(doc, o.department, 165), 55, ry + 5, { width: 170, lineBreak: false })
      .text(String(o.codes.given), 225, ry + 5, { width: 65, align: 'center', lineBreak: false })
      .text(String(o.codes.answered), 290, ry + 5, { width: 60, align: 'center', lineBreak: false })
      .text(String(o.codes.waiting), 350, ry + 5, { width: 65, align: 'center', lineBreak: false })
      .text(String(o.codes.expired), 415, ry + 5, { width: 55, align: 'center', lineBreak: false })
      .text(pctText(o.codes.rate), 470, ry + 5, { width: 75, align: 'center', lineBreak: false });
  });
  doc.fontSize(7.5).font('Helvetica').fillColor(TEXT_MID).text(CODES_NOTE, 50, y + 5, { width: W - 100 });
  return doc.y + 16;
}

// The clients' remarks (utils/remarks.js): comments, complaints and suggestions by
// label for all offices, then by office.
const REMARKS_NOTE = 'A remark is what a client wrote in the last box of the form, sorted from its words (English, Filipino or Bisaya): '
  + 'a complaint names a problem, a suggestion asks for a change, and a comment is any other remark, such as thanks. '
  + 'A remark is not a complaint report and has no deadline.';
function drawRemarks(doc, s, officeRows, y, head) {
  const W = doc.page.width;
  y = head("Clients' remarks: comments, complaints and suggestions", y);
  const r = s.all.remarks;
  const labelRows = [
    ...REMARKS.map(kind => ({ label: REMARK_PLURAL[kind], ...r[kind] })),
    { label: 'No remark written', ...r.none },
    { label: 'All forms', ...s.all.sentiment, total: s.all.responses, isTotal: true },
  ];
  y = pdfTable(doc, y, [
    { label: 'REMARK, ALL OFFICES', x: 55, width: 190 },
    { label: 'POSITIVE', x: 245, width: 75, align: 'center' },
    { label: 'NEUTRAL', x: 320, width: 75, align: 'center' },
    { label: 'NEGATIVE', x: 395, width: 75, align: 'center' },
    { label: 'TOTAL', x: 470, width: 75, align: 'center' },
  ], labelRows, (row, ry) => {
    doc.fontSize(7.5).font(row.isTotal ? 'Helvetica-Bold' : 'Helvetica').fillColor(TEXT_DARK)
      .text(row.label, 55, ry + 4, { width: 190, lineBreak: false });
    ['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'total'].forEach((key, i) => {
      doc.font(row.isTotal || key === 'total' ? 'Helvetica-Bold' : 'Helvetica')
        .text(String(row[key]), 245 + i * 75, ry + 4, { width: 75, align: 'center', lineBreak: false });
    });
  }, { rowH: 15 });
  y += 10;
  y = pdfTable(doc, y, [
    { label: 'OFFICE', x: 55, width: 190 },
    { label: 'COMMENTS', x: 245, width: 75, align: 'center' },
    { label: 'COMPLAINTS', x: 320, width: 75, align: 'center' },
    { label: 'SUGGESTIONS', x: 395, width: 75, align: 'center' },
    { label: 'NO REMARK', x: 470, width: 75, align: 'center' },
  ], officeRows, (o, ry) => {
    doc.fontSize(7.5).font(o.isTotal ? 'Helvetica-Bold' : 'Helvetica').fillColor(TEXT_DARK)
      .text(fitText(doc, o.department, 185), 55, ry + 4, { width: 190, lineBreak: false });
    [...REMARKS.map(kind => o.remarks[kind].total), o.remarks.none.total].forEach((value, i) => {
      doc.text(String(value), 245 + i * 75, ry + 4, { width: 75, align: 'center', lineBreak: false });
    });
  }, { rowH: 15 });
  doc.fontSize(7.5).font('Helvetica').fillColor(TEXT_MID).text(REMARKS_NOTE, 50, y + 5, { width: W - 100 });
  return doc.y + 16;
}

// Areas for improvement: each office's parts of the service under 80% (below
// Satisfactory), the lowest first, with the suggested actions (utils/csmActions.js).
const ACTIONS_NOTE = "Suggested actions for each office's action plan, based on the Citizen's Charter and RA 11032 (Ease of Doing Business); each office decides its own.";
const ALL_SATISFACTORY = "All parts of each office's service are rated Satisfactory (80%) or higher.";
function drawImprove(doc, s, y, head) {
  const W = doc.page.width;
  const bottom = () => doc.page.height - 70;
  y = head('Areas for improvement: parts under 80% (below Satisfactory), by office', y);
  const offices = s.offices.map(o => ({ o, low: lowParts(o) })).filter(x => x.low.length);
  if (!offices.length) {
    doc.fontSize(8).font('Helvetica').fillColor(TEXT_MID).text(ALL_SATISFACTORY, 50, y, { width: W - 100 });
    return doc.y + 16;
  }
  for (const { o, low } of offices) {
    if (y + 50 > bottom()) { doc.addPage(); y = 50; }
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(TEXT_DARK).text(o.department, 50, y, { width: W - 100 });
    y = doc.y + 4;
    for (const key of low) {
      const actions = SQD_ACTIONS[key];
      if (y + 16 + actions.length * 20 > bottom()) { doc.addPage(); y = 50; }
      const part = o.sqd[key];
      doc.fontSize(8).font('Helvetica-Bold').fillColor(TEXT_DARK)
        .text(`${key.toUpperCase()} ${SQD_SHORT[key]}: ${pctText(part.score)}, ${part.rating}`, 60, y, { width: W - 110 });
      y = doc.y + 2;
      doc.fontSize(7.5).font('Helvetica').fillColor(TEXT_MID);
      for (const action of actions) {
        doc.text(`\u2022  ${action}`, 68, y, { width: W - 118 });
        y = doc.y + 1.5;
      }
      y += 5;
    }
    y += 3;
  }
  doc.fontSize(7.5).font('Helvetica-Oblique').fillColor(TEXT_MID).text(ACTIONS_NOTE, 50, y, { width: W - 100 });
  return doc.y + 16;
}

function drawSatisfaction(doc, period, s, y, num) {
  const W = doc.page.width;
  // Numbered subsections: 6.1, 6.2, ...
  let n = 0;
  const head = (title, at, room) => subHead(doc, `${num}.${++n}  ${title}`, at, room);
  const filed = period.kind === 'all' ? '' : ` sent ${period.rangeFull}`;
  doc.fontSize(8.5).font('Helvetica').fillColor(TEXT_MID)
    .text(`Answers to the ARTA Client Satisfaction Measurement (CSM) form${filed}. A client rates one office's service with ` +
      `the code on the slip from that office, or with the Transaction Code of a resolved complaint or suggestion. ${SCORE_NOTE}`,
    50, y, { width: W - 100, lineGap: 2, align: 'justify' });
  y = doc.y + 14;
  if (!s.all.responses) {
    doc.fontSize(9).font('Helvetica-Bold').fillColor(TEXT_DARK)
      .text(period.kind === 'all' ? 'No client has answered the satisfaction form yet.' : `No client answered the satisfaction form in this ${period.word}.`, 50, y);
    y = doc.y + 14;
    return s.all.codes.given ? drawCodes(doc, s, y, head) : y - 4;
  }

  // Each office (the offices on the Settings list, even with no answers), then all of them.
  const officeRows = [...s.offices, { department: 'All offices', ...s.all, isTotal: true }];
  y = head('Results by office', y);
  y = pdfTable(doc, y, [
    { label: 'OFFICE',   x: 55,  width: 125 },
    { label: 'ANSWERS',  x: 180, width: 47, align: 'center' },
    { label: 'OVERALL',  x: 227, width: 52, align: 'center' },
    { label: 'RATING',   x: 279, width: 80, align: 'center' },
    { label: 'SQD0',     x: 359, width: 42, align: 'center' },
    { label: 'POSITIVE', x: 401, width: 48, align: 'center' },
    { label: 'NEUTRAL',  x: 449, width: 48, align: 'center' },
    { label: 'NEGATIVE', x: 497, width: 48, align: 'center' },
  ], officeRows, (o, ry) => {
    doc.fontSize(7.5).font(o.isTotal ? 'Helvetica-Bold' : 'Helvetica').fillColor(TEXT_DARK);
    doc.text(fitText(doc, o.department, 120), 55, ry + 6, { width: 125, lineBreak: false })
      .text(String(o.responses), 180, ry + 6, { width: 47, align: 'center', lineBreak: false })
      .text(pctText(o.overall), 227, ry + 6, { width: 52, align: 'center', lineBreak: false })
      .text(pctText(o.sqd.sqd0.score), 359, ry + 6, { width: 42, align: 'center', lineBreak: false })
      .text(String(o.sentiment.POSITIVE), 401, ry + 6, { width: 48, align: 'center', lineBreak: false })
      .text(String(o.sentiment.NEUTRAL), 449, ry + 6, { width: 48, align: 'center', lineBreak: false })
      .text(String(o.sentiment.NEGATIVE), 497, ry + 6, { width: 48, align: 'center', lineBreak: false });
    ratingTag(doc, o.responses ? o.rating : 'No answers', 279, ry + 4, 80);
  }, { rowH: 20 });
  doc.fontSize(7.5).font('Helvetica').fillColor(TEXT_MID)
    .text('OVERALL: the overall score (SQD1–SQD8). SQD0: satisfied with the service. POSITIVE / NEUTRAL / NEGATIVE: the label of each answered form, from its SQD0 answer (or the average of SQD1–SQD8 when SQD0 is N/A).',
      50, y + 5, { width: W - 100 });
  y = doc.y + 16;

  y = drawRemarks(doc, s, officeRows, y, head);
  y = drawCodes(doc, s, y, head);

  // The score of each statement, office by office.
  y = head('Score of each part of the service, by office', y);
  y = pdfTable(doc, y, [
    { label: 'OFFICE', x: 55, width: 120 },
    ...SQD.map((key, i) => ({ label: key.toUpperCase(), x: 175 + i * 40, width: 40, align: 'center' })),
  ], officeRows, (o, ry) => {
    doc.fontSize(7).font(o.isTotal ? 'Helvetica-Bold' : 'Helvetica').fillColor(TEXT_DARK);
    doc.text(fitText(doc, o.department, 115), 55, ry + 5, { width: 120, lineBreak: false });
    SQD.forEach((key, i) => doc.text(pctText(o.sqd[key].score), 175 + i * 40, ry + 5, { width: 40, align: 'center', lineBreak: false }));
  });
  doc.fontSize(7.5).font('Helvetica').fillColor(TEXT_MID)
    .text(SQD.map(key => `${key.toUpperCase()} ${SQD_SHORT[key]}`).join('  ·  '), 50, y + 5, { width: W - 100 });
  y = doc.y + 16;

  y = drawImprove(doc, s, y, head);

  // ARTA's table: how many gave each answer to each statement.
  y = head('Answers to each statement, all offices', y);
  const statementRows = [
    ...SQD.map(key => ({ label: `${key.toUpperCase()} ${SQD_SHORT[key]}`, counts: s.all.sqd[key].counts, total: s.all.responses, score: s.all.sqd[key].score })),
    { label: 'Overall (SQD1–SQD8)', ...overallCounts(s.all), isTotal: true },
  ];
  y = pdfTable(doc, y, [
    { label: 'STATEMENT',     x: 55,  width: 110 },
    { label: 'STR. AGREE',    x: 165, width: 50, align: 'center' },
    { label: 'AGREE',         x: 215, width: 40, align: 'center' },
    { label: 'NEITHER',       x: 255, width: 44, align: 'center' },
    { label: 'DISAGREE',      x: 299, width: 46, align: 'center' },
    { label: 'STR. DISAGREE', x: 345, width: 58, align: 'center' },
    { label: 'N/A',           x: 403, width: 32, align: 'center' },
    { label: 'TOTAL',         x: 435, width: 38, align: 'center' },
    { label: 'SCORE',         x: 473, width: 72, align: 'center' },
  ], statementRows, (row, ry) => {
    doc.fontSize(7).font(row.isTotal ? 'Helvetica-Bold' : 'Helvetica').fillColor(TEXT_DARK);
    doc.text(fitText(doc, row.label, 106), 55, ry + 5, { width: 110, lineBreak: false });
    [[5, 165, 50], [4, 215, 40], [3, 255, 44], [2, 299, 46], [1, 345, 58], ['NA', 403, 32]].forEach(([answer, x, width]) => {
      doc.text(String(row.counts[answer]), x, ry + 5, { width, align: 'center', lineBreak: false });
    });
    doc.text(String(row.total), 435, ry + 5, { width: 38, align: 'center', lineBreak: false })
      .text(pctText(row.score), 473, ry + 5, { width: 72, align: 'center', lineBreak: false });
  });
  y += 16;

  // The Citizen's Charter.
  y = head("Citizen's Charter, all offices", y, 120);
  const cc = s.all.charter;
  doc.fontSize(8).font('Helvetica').fillColor(TEXT_MID)
    .text(`Aware of the Citizen's Charter: ${pctText(cc.aware)}   ·   Saw this office's Charter: ${pctText(cc.sawCharter)}   ·   ` +
      `Found it easy to see: ${pctText(cc.easyToSee)}   ·   Found it helpful: ${pctText(cc.helped)}  (the last two exclude N/A answers)`,
    50, y, { width: W - 100 });
  y = doc.y + 8;
  y = shareTable(doc, y, 'QUESTION AND ANSWER', charterRows(s.all), s.all.responses) + 16;

  // The services rated, when the slips named them.
  if (s.services.length) {
    const shown = s.services.slice(0, 15);
    y = head('Services rated', y);
    y = pdfTable(doc, y, [
      { label: 'OFFICE',  x: 55,  width: 140 },
      { label: 'SERVICE', x: 195, width: 170 },
      { label: 'ANSWERS', x: 365, width: 50, align: 'center' },
      { label: 'OVERALL', x: 415, width: 55, align: 'center' },
      { label: 'RATING',  x: 470, width: 75, align: 'center' },
    ], shown, (row, ry) => {
      doc.fontSize(7.5).font('Helvetica').fillColor(TEXT_DARK);
      doc.text(fitText(doc, row.department, 135), 55, ry + 6, { width: 140, lineBreak: false })
        .text(fitText(doc, row.service, 165), 195, ry + 6, { width: 170, lineBreak: false })
        .text(String(row.responses), 365, ry + 6, { width: 50, align: 'center', lineBreak: false })
        .text(pctText(row.overall), 415, ry + 6, { width: 55, align: 'center', lineBreak: false });
      ratingTag(doc, row.rating, 470, ry + 4, 75);
    }, { rowH: 20 });
    if (s.services.length > shown.length) {
      doc.fontSize(7.5).font('Helvetica').fillColor(TEXT_MID)
        .text(`The ${shown.length} services with the most answers, of ${s.services.length}. The Excel report lists all of them.`, 50, y + 5, { width: W - 100 });
      y = doc.y;
    }
    y += 16;
  }

  // The respondents: client type, sex and age group.
  y = head('Respondents, all offices', y, 120);
  return shareTable(doc, y, 'CLIENT', clientRows(s.all), s.all.responses) + 10;
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
    previousTotal,
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
    select: { trackingId: true, type: true, department: true, status: true, priority: true, sentiment: true, createdAt: true, channel: true },
  });

  // How clients rated each office on the satisfaction form (ARTA CSM), for the
  // forms sent in the period.
  const satisfaction = await satisfactionResults(prisma, { offices: await getDepartmentList(), from: period.from, to: period.to });

  return {
    total, pending, reviewing, inProgress, resolved, positive, neutral, negative,
    complaints, suggestions, feedbacks, previousTotal, avgDays, responseRate,
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
    satisfaction,
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
  let preparer;
  try {
    [data, seal, preparer] = await Promise.all([
      gatherReport(period),
      ensureSettings().then(s => loadSealImage(s.sealUrl)).catch(() => null),
      // The administrator who downloads the report signs it as "Prepared by"
      // (the name on their profile now, not the one at sign-in).
      prisma.user.findUnique({ where: { id: req.user.id }, select: { fullName: true } }).catch(() => null),
    ]);
  } catch (err) {
    console.error('PDF report data error:', err);
    return res.status(500).json({ error: 'Failed to generate report' });
  }
  const preparedBy = (preparer?.fullName || req.user.fullName || '').trim();

  // Pages are kept until the end, so the footers can say "Page 2 of 6" and the
  // table of contents can give the page each section landed on.
  const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${reportFileName(period, 'pdf')}"`);
  doc.pipe(res);
  try {
    drawPdfReport(doc, period, data, seal, preparedBy);
  } catch (err) {
    console.error('PDF generation error:', err);
  }
  doc.end();
}

function drawPdfReport(doc, period, d, seal, preparedBy) {
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
  // PAGE 1 — Letterhead, title, document information, summary and contents
  // ══════════════════════════════════════════════════════════════════════
  const centered = (text, y, size, font, color = TEXT_DARK) => doc.fontSize(size).font(font).fillColor(color)
    .text(text, 50, y, { width: W - 100, align: 'center', lineBreak: false });

  // Letterhead: the municipal seal at the left, the government lines centered.
  if (seal) doc.image(seal.buffer, 56, 34, { fit: [64, 64], align: 'center', valign: 'center' });
  centered('Republic of the Philippines', 40, 10, 'Times-Roman');
  centered('Province of Surigao del Sur', 53, 10, 'Times-Roman');
  centered('MUNICIPALITY OF CANTILAN', 67, 14, 'Times-Bold');
  centered('CIVIX – Integrated Citizen Engagement Platform', 86, 9.5, 'Times-Italic', TEXT_MID);
  doc.moveTo(50, 106).lineTo(W - 50, 106).lineWidth(1.6).stroke(TEXT_DARK);
  doc.moveTo(50, 109.5).lineTo(W - 50, 109.5).lineWidth(0.5).stroke(TEXT_DARK);

  // The report's title and the period it covers.
  centered(`CIVIX ${period.title}`.toUpperCase(), 126, 17, 'Times-Bold');
  centered('Citizen Complaints, Suggestions and Client Satisfaction', 148, 11, 'Times-Italic', TEXT_MID);
  centered(isAll ? `All recorded submissions as of ${genDate}` : `For the period ${period.rangeFull}`, 166, 9.5, 'Helvetica');

  // Document information, as a bordered form: shaded labels at the left.
  const info = [
    ['Report Date',       genDate],
    ['Reporting Period',  period.rangeFull],
    ['Prepared By',       preparedBy ? `${preparedBy}, System Administrator` : 'System Administrator'],
    ['Classification',    'For Internal Use Only'],
    ['Report ID',         reportId],
    ['Verification Code', verifyCode],
  ];
  const INFO_TOP = 192;
  const LABEL_W = 130;
  const INFO_ROW = 18;
  info.forEach(([label, value], i) => {
    const ry = INFO_TOP + i * INFO_ROW;
    doc.rect(50, ry, LABEL_W, INFO_ROW).fill(SHADE);
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(TEXT_DARK).text(label, 58, ry + 5, { width: LABEL_W - 12, lineBreak: false });
    doc.font('Helvetica').text(fitText(doc, value, W - 118 - LABEL_W), 59 + LABEL_W, ry + 5, { lineBreak: false });
    if (i) doc.moveTo(50, ry).lineTo(W - 50, ry).lineWidth(0.4).stroke(GRID);
  });
  const infoBottom = INFO_TOP + info.length * INFO_ROW;
  doc.moveTo(50 + LABEL_W, INFO_TOP).lineTo(50 + LABEL_W, infoBottom).lineWidth(0.4).stroke(GRID);
  doc.rect(50, INFO_TOP, W - 100, infoBottom - INFO_TOP).lineWidth(0.75).stroke(RULE);

  // Executive Summary
  const rated = d.satisfaction.all;
  const satisfactionText = rated.responses
    ? `Clients rated the offices' service on the ARTA Client Satisfaction Measurement form ${rated.responses.toLocaleString()} time(s)` +
      (rated.overall == null ? '. ' : `, for an overall score of ${pctText(rated.overall)} (${rated.rating}). `)
    : `No client ${isAll ? 'has answered' : 'answered'} the ARTA Client Satisfaction Measurement form${isAll ? ' yet' : ` in this ${word}`}. `;
  const summaryText = isAll
    ? `This report presents a comprehensive statistical analysis of citizen engagement submissions ` +
      `recorded through the CIVIX platform for the Municipality of Cantilan, Surigao del Sur. ` +
      `A total of ${d.total.toLocaleString()} submission(s) have been recorded, comprising complaints, ` +
      `suggestions, and service feedback from citizens. The current response rate for complaints ` +
      `and suggestions stands at ${d.responseRate}%, with an average resolution time of ${d.avgDays} day(s). ` +
      `Feedback is the satisfaction form: it rates one office's service and has no status steps or deadline. ${satisfactionText}` +
      `This document is intended for review by municipal officials and designated department heads.`
    : `This ${period.title.toLowerCase()} covers the citizen submissions filed through the CIVIX platform for the ` +
      `Municipality of Cantilan, Surigao del Sur, for the period ${period.rangeFull.replace(/ \(.*\)$/, '')}. ` +
      `${d.total.toLocaleString()} submission(s) were filed in this ${word}, compared with ` +
      `${d.previousTotal.toLocaleString()} in the previous ${word}. ` +
      (period.inProgress ? `The ${word} is still in progress, so the figures run up to the report date. ` : '') +
      `For the complaints and suggestions filed in this ${word}, the response rate is ${d.responseRate}% and the average ` +
      `resolution time is ${d.avgDays} day(s); statuses are as of ${genDate}. Feedback is the satisfaction form: it rates ` +
      `one office's service and has no status steps or deadline. ${satisfactionText}` +
      `This document is intended for review by municipal officials and designated department heads.`;
  let cy = sectionHead(doc, null, 'Executive Summary', infoBottom + 18);
  doc.fontSize(9).font('Helvetica').fillColor(TEXT_DARK)
    .text(summaryText, 50, cy, { width: W - 100, lineGap: 3, align: 'justify' });
  cy = doc.y + 18;

  // Table of Contents, with dot leaders (page numbers are filled in at the end)
  cy = sectionHead(doc, null, 'Table of Contents', cy);
  const toc = [
    [1, 'Key Performance Indicators'],
    [2, 'Submission Type Distribution'],
    [3, 'Sentiment Analysis'],
    [4, trendTitle],
    [5, 'Submission Breakdown by Department'],
    [6, 'Client Satisfaction (ARTA CSM)'],
    [7, logTitle],
  ];
  const tocRowY = {};
  for (const [num, title] of toc) {
    const label = `${num}.  ${title}`;
    doc.fontSize(9.5).font('Helvetica').fillColor(TEXT_DARK).text(label, 58, cy, { lineBreak: false });
    doc.moveTo(58 + doc.widthOfString(label) + 6, cy + 8.5).lineTo(W - 80, cy + 8.5)
      .lineWidth(0.9).lineCap('round').dash(0.1, { space: 2.8 }).stroke(TEXT_LIGHT);
    doc.undash().lineCap('butt');
    tocRowY[num] = cy;
    cy += 19;
  }

  // ══════════════════════════════════════════════════════════════════════
  // PAGE 2 — KPIs + Type Distribution + Sentiment
  // ══════════════════════════════════════════════════════════════════════
  doc.addPage();
  let y = 50;
  sectionPage[1] = sectionPage[2] = sectionPage[3] = pageNo();

  // Section 1 — KPIs, as a table: each figure with what it counts.
  y = sectionHead(doc, 1, 'Key Performance Indicators', y);
  doc.fontSize(8.5).font('Helvetica').fillColor(TEXT_MID)
    .text(`${isAll ? 'All recorded submissions' : `Submissions filed ${period.rangeFull}`}. Statuses are as of ${genDate}.`, 50, y, { width: W - 100 });
  y += 16;
  const kpis = [
    { head: true, label: 'Submissions' },
    { label: 'Total submissions', value: d.total, note: 'Complaints, suggestions and feedback' },
    { label: 'Feedback', value: d.feedbacks, note: 'Satisfaction forms (no status steps or deadline)' },
    { head: true, label: 'Complaints and suggestions, by status' },
    { label: 'Pending', value: d.pending, note: 'Not yet acted on by the office' },
    { label: 'Reviewing', value: d.reviewing, note: 'Under review by the office' },
    { label: 'In Progress', value: d.inProgress, note: 'Being acted on by the office' },
    { label: 'Resolved', value: d.resolved, note: 'Action completed' },
    { label: 'Response rate', value: `${d.responseRate}%`, note: 'Percentage no longer pending' },
    { label: 'Average resolution time', value: `${d.avgDays} days`, note: 'From filing to resolution' },
    // How urgent they were (set by the AI from a complaint's description, or changed
    // by the office), and whether the urgent ones were resolved on time.
    { head: true, label: 'Complaints and suggestions, by urgency' },
    { label: PRIORITY_LABELS.URGENT, value: d.urgent, note: 'Shortest deadline' },
    { label: PRIORITY_LABELS.STANDARD, value: d.normal, note: 'Standard deadline' },
    { label: PRIORITY_LABELS.LOW, value: d.canWait, note: 'Longest deadline' },
    { label: 'Urgent, resolved on time', value: d.urgentResolved ? `${d.urgentOnTime} of ${d.urgentResolved}` : '—', note: 'Resolved by their resolve-by date' },
  ];
  y = pdfTable(doc, y, [
    { label: 'INDICATOR', x: 55, width: 185 },
    { label: 'VALUE', x: 240, width: 80, align: 'center' },
    { label: 'DESCRIPTION', x: 329, width: 211 },
  ], kpis, (k, ry) => {
    doc.fontSize(8).font('Helvetica-Bold').fillColor(TEXT_DARK);
    if (k.head) {
      doc.text(k.label, 55, ry + 4.5, { width: 480, lineBreak: false });
      return;
    }
    doc.text(String(k.value), 240, ry + 4.5, { width: 80, align: 'center', lineBreak: false });
    doc.font('Helvetica').text(k.label, 65, ry + 4.5, { width: 170, lineBreak: false });
    doc.fillColor(TEXT_MID).text(fitText(doc, k.note, 205), 329, ry + 4.5, { width: 211, lineBreak: false });
  });
  doc.fontSize(7.5).font('Helvetica').fillColor(TEXT_MID)
    .text('The urgency of a complaint is set by the AI from its description, or changed by the office.', 50, y + 5, { width: W - 100 });
  y = doc.y + 16;

  // Section 2 — Type Distribution (pie, with a table of the counts)
  y = sectionHead(doc, 2, 'Submission Type Distribution', y);
  {
    const typeSlices = [
      { label: 'Complaints',  value: d.complaints,  color: TYPE_COLORS.COMPLAINT.bar },
      { label: 'Suggestions', value: d.suggestions, color: TYPE_COLORS.SUGGESTION.bar },
      { label: 'Feedback',    value: d.feedbacks,   color: TYPE_COLORS.FEEDBACK.bar },
    ];
    drawPieChart(doc, 50 + 72, y + 46, 46, typeSlices);
    pieTable(doc, 215, y + 4, 'TYPE', typeSlices);
    y = caption(doc, 'Figure 1. Submissions by type', y + 108) + 10;
  }

  // Section 3 — Sentiment (pie, with a table of the counts)
  y = sectionHead(doc, 3, 'Sentiment Analysis', y);
  {
    const sentSlices = [
      { label: 'Positive', value: d.positive, color: '#16A34A' },
      { label: 'Neutral',  value: d.neutral,  color: '#6B7280' },
      { label: 'Negative', value: d.negative, color: '#DC2626' },
    ];
    drawPieChart(doc, 50 + 72, y + 46, 46, sentSlices);
    pieTable(doc, 215, y + 4, 'SENTIMENT', sentSlices);
    caption(doc, 'Figure 2. Submissions by sentiment', y + 108);
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
  y = caption(doc, `Figure 3. Submissions per ${isAll || period.kind === 'year' ? 'month' : 'day'}`, y + LC_H + 21) + 6;

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
  if (d.departments.length) y = caption(doc, 'Figure 4. Submissions by department and type', y + 2);
  y += 10;

  if (d.departments.length) {
    const add = key => d.departments.reduce((n, row) => n + row[key], 0);
    const deptRows = [...d.departments, { dept: 'Total', COMPLAINT: add('COMPLAINT'), SUGGESTION: add('SUGGESTION'), FEEDBACK: add('FEEDBACK'), total: add('total'), isTotal: true }];
    y = pdfTable(doc, y, [
      { label: 'DEPARTMENT',  x: 55,  width: 210 },
      { label: 'COMPLAINTS',  x: 270, width: 70, align: 'center' },
      { label: 'SUGGESTIONS', x: 340, width: 75, align: 'center' },
      { label: 'FEEDBACK',    x: 415, width: 65, align: 'center' },
      { label: 'TOTAL',       x: 485, width: 55, align: 'center' },
    ], deptRows, (row, ry) => {
      doc.fontSize(7.5).font(row.isTotal ? 'Helvetica-Bold' : 'Helvetica').fillColor(TEXT_DARK);
      doc.text(fitText(doc, row.dept, 205),      55,  ry + 4, { width: 210, lineBreak: false })
        .text(String(row.COMPLAINT),  270, ry + 4, { width: 70, align: 'center', lineBreak: false })
        .text(String(row.SUGGESTION), 340, ry + 4, { width: 75, align: 'center', lineBreak: false })
        .text(String(row.FEEDBACK),   415, ry + 4, { width: 65, align: 'center', lineBreak: false })
        .text(String(row.total),      485, ry + 4, { width: 55, align: 'center', lineBreak: false });
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // PAGE 5 — Client Satisfaction: the ARTA satisfaction form, by office
  // ══════════════════════════════════════════════════════════════════════
  doc.addPage();
  y = 50;
  sectionPage[6] = pageNo();
  y = sectionHead(doc, 6, 'Client Satisfaction (ARTA CSM)', y);
  drawSatisfaction(doc, period, d.satisfaction, y, 6);

  // ══════════════════════════════════════════════════════════════════════
  // PAGE 6 — Submissions Log (continues over more pages when needed)
  // ══════════════════════════════════════════════════════════════════════
  doc.addPage();
  y = 50;
  sectionPage[7] = pageNo();
  y = sectionHead(doc, 7, logTitle, y);

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
      { label: 'TRANSACTION CODE', x: 55, width: 110 },
      { label: 'TYPE',        x: 168, width: 64, align: 'center' },
      { label: 'OFFICE',      x: 238, width: 160 },
      { label: 'STATUS',      x: 402, width: 80, align: 'center' },
      { label: 'DATE FILED',  x: 488, width: 55 },
    ], shown, (s, ry) => {
      doc.fontSize(7.5).font('Helvetica').fillColor(TEXT_DARK)
        .text(s.trackingId, 55, ry + 5, { width: 110, lineBreak: false })
        .text(XL_TYPE[s.type]?.label || titleCase(s.type), 168, ry + 5, { width: 64, align: 'center', lineBreak: false })
        .text(fitText(doc, officeName(s), 156), 238, ry + 5, { width: 160, lineBreak: false })
        .text(XL_STATUS[s.status]?.label || titleCase(s.status), 402, ry + 5, { width: 80, align: 'center', lineBreak: false })
        .text(fmtShortDate(s.createdAt), 488, ry + 5, { width: 57, lineBreak: false });
    }, { rowH: 17 });
  }

  // Certification and signatures (on a new page when they don't fit below the log)
  const certText = 'This is to certify that this report was generated from the records of the CIVIX Integrated Citizen ' +
    'Engagement Platform of the Municipality of Cantilan, Surigao del Sur, and that the data presented herein ' +
    `are accurate as of ${genDate}.`;
  doc.fontSize(9).font('Helvetica');
  const certHeight = 28 + 32 + doc.heightOfString(certText, { width: W - 100, lineGap: 3 }) + 24 + 100;
  if (y + certHeight > H - 66) { doc.addPage(); y = 50; } else { y += 28; }
  y = sectionHead(doc, null, 'Certification', y);
  doc.fontSize(9).font('Helvetica').fillColor(TEXT_DARK)
    .text(certText, 50, y, { width: W - 100, lineGap: 3, align: 'justify' });
  y = doc.y + 24;

  // Two signature blocks: the administrator who prepared the report, and the
  // official who notes it. Each signs above the printed name.
  const SIG_W = 190;
  const signers = [
    { x: 50, role: 'Prepared by:', name: preparedBy.toUpperCase(), title: 'System Administrator' },
    { x: W - 50 - SIG_W, role: 'Noted by:', name: '', title: 'Municipal Mayor' },
  ];
  for (const s of signers) {
    doc.fontSize(9).font('Helvetica').fillColor(TEXT_DARK).text(s.role, s.x, y, { lineBreak: false });
    if (s.name) {
      doc.font('Helvetica-Bold').text(fitText(doc, s.name, SIG_W), s.x, y + 46, { width: SIG_W, align: 'center', lineBreak: false });
    }
    doc.moveTo(s.x, y + 58).lineTo(s.x + SIG_W, y + 58).lineWidth(0.6).stroke(TEXT_DARK);
    doc.fontSize(8.5).font('Helvetica').fillColor(TEXT_DARK)
      .text(s.title, s.x, y + 62, { width: SIG_W, align: 'center', lineBreak: false })
      .text('Date: ______________________', s.x, y + 86, { width: SIG_W, align: 'center', lineBreak: false });
  }

  // Footers on every page, the running header from page 2, then the contents' page numbers.
  const pageCount = pageNo();
  const headerLeft = `Municipality of Cantilan  ·  CIVIX ${period.title}`;
  const headerRight = isAll ? `All recorded submissions as of ${genDate}` : period.rangeFull;
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    if (i) pageHeader(doc, headerLeft, headerRight);
    pageFooter(doc, i + 1, pageCount, reportId, verifyCode);
  }
  doc.switchToPage(0);
  for (const [num, rowY] of Object.entries(tocRowY)) {
    doc.fontSize(9.5).font('Helvetica').fillColor(TEXT_DARK)
      .text(String(sectionPage[num]), W - 76, rowY, { width: 18, align: 'right', lineBreak: false });
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
// The satisfaction ratings (the same colors as the PDF's).
const XL_RATING = Object.fromEntries(Object.entries(RATING_COLORS).map(([rating, c]) => [rating, {
  light: `FF${c.light.slice(1).toUpperCase()}`, text: `FF${c.text.slice(1).toUpperCase()}`,
}]));

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
    // The satisfaction form (ARTA CSM): the "Client Satisfaction" sheet has the details.
    const rated = d.satisfaction.all;
    const satisfactionRows = [
      ['Satisfaction Forms Answered', rated.responses],
      ['Overall Satisfaction Score (ARTA)', rated.overall == null ? 'No answers yet' : `${pctText(rated.overall)} (${rated.rating})`],
      ['Codes Given to Clients', rated.codes.given],
      ['Satisfaction Form Response Rate', rated.codes.given ? `${pctText(rated.codes.rate)} (${rated.codes.answered} of ${rated.codes.given} codes used)` : 'No codes given yet'],
    ];
    const kpiRows = isAll ? [
      ['Total Submissions', d.total],
      ['Response Rate (%)', d.responseRate],
      ['Avg. Resolution Time (days)', d.avgDays],
      ...urgencyRows,
      ...satisfactionRows,
    ] : [
      ['Reporting Period', period.rangeFull],
      ['Total Submissions', d.total],
      [`Submissions in the Previous ${titleCase(word)}`, d.previousTotal],
      ['Response Rate (%)', d.responseRate],
      ['Avg. Resolution Time (days)', d.avgDays],
      ...urgencyRows,
      ...satisfactionRows,
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
    // SHEET 5 — Client Satisfaction: the ARTA satisfaction form, by office
    // ══════════════════════════════════════════════════════════════════════
    const sat = d.satisfaction;
    const sCsm = workbook.addWorksheet('Client Satisfaction', { views: [{ showGridLines: false }] });
    xlPrintSetup(sCsm, '1:2');
    sCsm.columns = [{ width: 44 }, ...Array.from({ length: 9 }, () => ({ width: 14 }))];
    let rs = xlBanner(sCsm, 10, 'CIVIX — Client Satisfaction (ARTA CSM)',
      `${isAll ? 'All answers so far' : `Forms sent ${period.rangeFull}`}   |   Generated ${genDate}`);
    sCsm.mergeCells(rs, 1, rs, 10);
    sCsm.getCell(rs, 1).value = SCORE_NOTE;
    sCsm.getCell(rs, 1).font = { size: 9, color: { argb: XL_TEXT_MID } };
    sCsm.getCell(rs, 1).alignment = { wrapText: true, vertical: 'top', indent: 1 };
    sCsm.getRow(rs).height = 30;
    rs += 2;

    // One row of a table: `values` from column A; numbers centered, percentages as
    // "96.4%" (a dash when there is none), ratings tinted.
    const csmRow = (values, { bold = false, total = false, zebraRow = false, indent = 0 } = {}) => {
      values.forEach((value, i) => {
        const cell = sCsm.getCell(rs, i + 1);
        const kind = value && typeof value === 'object' ? value : { value };
        if (kind.percent !== undefined) {
          cell.value = kind.percent == null ? '—' : kind.percent;
          if (kind.percent != null) cell.numFmt = '0.0"%"';
        } else if (kind.rating !== undefined) {
          cell.value = kind.rating || '—';
          const tint = XL_RATING[kind.rating];
          if (tint) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: tint.light } };
            cell.font = { bold: true, color: { argb: tint.text } };
          }
        } else {
          cell.value = kind.value;
        }
        if (!cell.fill && zebraRow) cell.fill = zebra;
        if (bold && !cell.font) cell.font = { bold: true, color: { argb: XL_TEXT_DARK } };
        cell.alignment = i === 0 ? { horizontal: 'left', indent, wrapText: true, vertical: 'middle' } : { horizontal: 'center', vertical: 'middle' };
        cell.border = total ? { ...xlBorderThin(), top: { style: 'medium', color: { argb: XL_BRAND } } } : xlBorderThin();
      });
      rs++;
    };
    const csmNote = text => {
      sCsm.mergeCells(rs, 1, rs, 10);
      sCsm.getCell(rs, 1).value = text;
      sCsm.getCell(rs, 1).font = { italic: true, size: 9, color: { argb: XL_TEXT_MID } };
      sCsm.getCell(rs, 1).alignment = { wrapText: true, indent: 1 };
      rs++;
    };
    // A header row whose labels may take two lines.
    const csmHeader = labels => {
      const row = rs;
      rs = xlHeaderRow(sCsm, rs, labels);
      labels.forEach((_, i) => { sCsm.getCell(row, i + 1).alignment = { ...sCsm.getCell(row, i + 1).alignment, wrapText: true }; });
      sCsm.getRow(row).height = 32;
    };

    rs = xlSectionLabel(sCsm, rs, 10, 'Results by Office');
    csmHeader(['Office', 'Answers', 'Overall Score (%)', 'Rating', 'Satisfied, SQD0 (%)', 'Positive', 'Neutral', 'Negative', 'Codes Given', 'Response Rate (%)']);
    const csmOffices = [...sat.offices, { department: 'All offices', ...sat.all, isTotal: true }];
    csmOffices.forEach((o, i) => csmRow([
      o.department, o.responses, { percent: o.overall }, { rating: o.responses ? o.rating : 'No answers' },
      { percent: o.sqd.sqd0.score }, o.sentiment.POSITIVE, o.sentiment.NEUTRAL, o.sentiment.NEGATIVE,
      o.codes.given, { percent: o.codes.rate },
    ], { bold: o.isTotal, total: o.isTotal, zebraRow: i % 2 === 0 && !o.isTotal }));
    csmNote('Overall score: SQD1–SQD8 together. SQD0: satisfied with the service. Positive / Neutral / Negative: the label of each answered form, from its SQD0 answer (or the average of SQD1–SQD8 when SQD0 is N/A).');
    csmNote(`Codes given: ${CODES_NOTE.replace('RESPONSE RATE:', 'Response rate:')}`);
    sCsm.getRow(rs - 1).height = 26;
    rs += 1;

    // The clients' remarks: by label for all offices, then by office.
    rs = xlSectionLabel(sCsm, rs, 10, "Clients' Remarks: Comments, Complaints and Suggestions");
    csmHeader(['Remark, All Offices', 'Positive', 'Neutral', 'Negative', 'Total']);
    [...REMARKS.map(kind => [REMARK_PLURAL[kind], sat.all.remarks[kind]]), ['No remark written', sat.all.remarks.none]]
      .forEach(([label, c], i) => csmRow([label, c.POSITIVE, c.NEUTRAL, c.NEGATIVE, c.total], { zebraRow: i % 2 === 0 }));
    csmRow(['All forms', sat.all.sentiment.POSITIVE, sat.all.sentiment.NEUTRAL, sat.all.sentiment.NEGATIVE, sat.all.responses], { bold: true, total: true });
    rs += 1;
    csmHeader(['Office', 'Comments', 'Complaints', 'Suggestions', 'No Remark']);
    csmOffices.forEach((o, i) => csmRow([o.department, ...REMARKS.map(kind => o.remarks[kind].total), o.remarks.none.total],
      { bold: o.isTotal, total: o.isTotal, zebraRow: i % 2 === 0 && !o.isTotal }));
    csmNote(REMARKS_NOTE);
    sCsm.getRow(rs - 1).height = 26;
    rs += 1;

    rs = xlSectionLabel(sCsm, rs, 10, 'Score of Each Part of the Service, by Office (%)');
    csmHeader(['Office', ...SQD.map(key => `${key.toUpperCase()} ${SQD_SHORT[key]}`)]);
    csmOffices.forEach((o, i) => csmRow([o.department, ...SQD.map(key => ({ percent: o.sqd[key].score }))],
      { bold: o.isTotal, total: o.isTotal, zebraRow: i % 2 === 0 && !o.isTotal }));
    rs += 1;

    // Areas for improvement: each office's parts under 80%, with the suggested actions.
    rs = xlSectionLabel(sCsm, rs, 10, 'Areas for Improvement: Parts under 80% (below Satisfactory), by Office');
    const improve = sat.offices.flatMap(o => lowParts(o).map(key => ({ o, key })));
    if (!improve.length) {
      csmNote(ALL_SATISFACTORY);
    } else {
      const head = rs;
      csmHeader(['Office', 'Part of the Service', 'Score (%)', 'Rating', 'Suggested Actions', '', '', '', '', '']);
      sCsm.mergeCells(head, 5, head, 10);
      improve.forEach(({ o, key }, i) => {
        const row = rs;
        const actions = SQD_ACTIONS[key];
        csmRow([o.department, `${key.toUpperCase()} ${SQD_SHORT[key]}`, { percent: o.sqd[key].score }, { rating: o.sqd[key].rating },
          actions.map(action => `• ${action}`).join('\n'), '', '', '', '', ''], { zebraRow: i % 2 === 0 });
        sCsm.mergeCells(row, 5, row, 10);
        sCsm.getCell(row, 2).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        sCsm.getCell(row, 5).alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
        const lines = actions.reduce((n, action) => n + Math.ceil((action.length + 2) / 80), 0);
        sCsm.getRow(row).height = Math.max(30, lines * 13 + 6);
      });
      csmNote(ACTIONS_NOTE);
    }
    rs += 1;

    // ARTA's table, for all offices and for each office with answers.
    const statementTable = (title, result) => {
      rs = xlSectionLabel(sCsm, rs, 10, title);
      csmHeader(['Statement', 'Strongly Agree', 'Agree', 'Neither', 'Disagree', 'Strongly Disagree', 'N/A', 'Total', 'Score (%)', 'Rating']);
      const rows = [
        ...SQD.map(key => ({ label: `${key.toUpperCase()} ${SQD_SHORT[key]}`, counts: result.sqd[key].counts, total: result.responses, score: result.sqd[key].score, rating: result.sqd[key].rating })),
        { label: 'Overall (SQD1–SQD8)', ...overallCounts(result), rating: result.rating, isTotal: true },
      ];
      rows.forEach((row, i) => csmRow([
        row.label, row.counts[5], row.counts[4], row.counts[3], row.counts[2], row.counts[1], row.counts.NA, row.total,
        { percent: row.score }, { rating: row.rating },
      ], { bold: row.isTotal, total: row.isTotal, zebraRow: i % 2 === 0 && !row.isTotal }));
      rs += 1;
    };
    if (sat.all.responses) {
      statementTable('Answers to Each Statement — All Offices', sat.all);
      sat.offices.filter(o => o.responses).forEach(o => statementTable(`Answers to Each Statement — ${o.department}`, o));
    }

    rs = xlSectionLabel(sCsm, rs, 10, "Citizen's Charter — All Offices");
    csmHeader(['Question and Answer', 'Count', '% of Answers']);
    const share = count => ({ percent: sat.all.responses ? Math.round((count * 1000) / sat.all.responses) / 10 : null });
    ['cc1', 'cc2', 'cc3'].forEach(key => {
      csmRow([`${key.toUpperCase()}  ${CC_QUESTIONS[key].text}`, '', ''], { bold: true });
      sCsm.getRow(rs - 1).height = 30;
      CC_QUESTIONS[key].options.forEach((option, i) => csmRow([option, sat.all.charter[key][i], share(sat.all.charter[key][i])], { indent: 2 }));
    });
    const cc = sat.all.charter;
    csmNote(`Aware of the Citizen's Charter: ${pctText(cc.aware)}  ·  Saw this office's Charter: ${pctText(cc.sawCharter)}  ·  ` +
      `Found it easy to see: ${pctText(cc.easyToSee)}  ·  Found it helpful: ${pctText(cc.helped)} (the last two exclude N/A answers).`);
    rs += 1;

    // The services the slips named, office by office.
    rs = xlSectionLabel(sCsm, rs, 10, 'Services Rated');
    csmHeader(['Service', 'Answers', 'Overall Score (%)', 'Rating', 'Satisfied, SQD0 (%)']);
    if (!sat.services.length) csmNote('No service was named on the slips.');
    sat.offices.forEach(o => {
      const services = sat.services.filter(row => row.department === o.department);
      if (!services.length) return;
      csmRow([o.department, '', '', '', ''], { bold: true, zebraRow: true });
      services.forEach(row => csmRow([row.service, row.responses, { percent: row.overall }, { rating: row.rating }, { percent: row.satisfied }], { indent: 2 }));
    });
    rs += 1;

    rs = xlSectionLabel(sCsm, rs, 10, 'Respondents — All Offices');
    csmHeader(['Client', 'Count', '% of Answers']);
    clientRows(sat.all).forEach(row => (row.head
      ? csmRow([row.label, '', ''], { bold: true, zebraRow: true })
      : csmRow([row.label, row.count, share(row.count)], { indent: 2 })));

    // ══════════════════════════════════════════════════════════════════════
    // SHEET 6 — Submissions: every one filed in the period (all time: the most
    // recent 100). Filters on the header row.
    // ══════════════════════════════════════════════════════════════════════
    const logName = isAll ? 'Recent Submissions' : 'Submissions';
    const sLog = workbook.addWorksheet(logName, { views: [{ state: 'frozen', ySplit: 4, showGridLines: false }] });
    xlPrintSetup(sLog, '1:4');
    sLog.columns = [
      { width: 20 }, { width: 13 }, { width: 40 }, { width: 14 }, { width: 11 }, { width: 12 }, { width: 22 }, { width: 22 },
    ];
    const logNote = isAll ? `Most recent ${d.log.length} submission(s)`
      : d.log.length < d.total ? `The ${d.log.length} most recent of ${d.total} submissions filed ${period.rangeFull}`
        : `All ${d.total} submission(s) filed ${period.rangeFull}`;
    let rl = xlBanner(sLog, 8, `CIVIX — ${isAll ? 'Recent Submissions Log' : 'Submissions Log'}`, `${logNote}   |   Generated ${genDate}`);
    const logHeader = rl;
    rl = xlHeaderRow(sLog, rl, ['Transaction Code', 'Type', 'Office', 'Status', 'Urgency', 'Sentiment', 'Date Filed', 'Received Via']);
    if (d.log.length) sLog.autoFilter = { from: { row: logHeader, column: 1 }, to: { row: logHeader, column: 8 } };
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

      // Feedback has no urgency.
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
      // Online, or typed in by the office's staff (walk-in, phone call, letter, message).
      sLog.getCell(rl, 8).value = CHANNEL_LABELS[s.channel] || 'Online';

      for (let c = 1; c <= 8; c++) sLog.getCell(rl, c).border = xlBorderThin();
      if (i % 2 === 0) for (const c of [1, 3, 5, 6, 7, 8]) sLog.getCell(rl, c).fill = zebra;
      rl++;
    });
    if (!d.log.length) {
      sLog.mergeCells(rl, 1, rl, 8);
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
