const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'CIVIX-System-Summary.pdf');
const doc = new PDFDocument({ margin: 50, size: 'A4' });
doc.pipe(fs.createWriteStream(OUT));

const W = doc.page.width - 100;
const PRIMARY = '#4f46e5';
const DARK    = '#1e293b';
const GRAY    = '#64748b';
const LIGHT   = '#f1f5f9';
const WHITE   = '#ffffff';

// ── helpers ──────────────────────────────────────────────────────────────────
function sectionHeader(title) {
  doc.moveDown(0.5);
  doc.rect(50, doc.y, W, 28).fill(PRIMARY);
  doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(11)
     .text(title, 60, doc.y - 22, { lineBreak: false });
  doc.fillColor(DARK).moveDown(1.2);
}

function bullet(text, indent = 0) {
  const x = 60 + indent;
  doc.font('Helvetica').fontSize(10).fillColor(DARK);
  doc.text(`•  ${text}`, x, doc.y, { width: W - indent - 10, lineBreak: true });
  doc.moveDown(0.2);
}

function subHead(text) {
  doc.moveDown(0.4);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(PRIMARY)
     .text(text, 60, doc.y);
  doc.fillColor(DARK).moveDown(0.3);
}

// ── COVER PAGE ───────────────────────────────────────────────────────────────
doc.rect(0, 0, doc.page.width, 200).fill(PRIMARY);
doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(26)
   .text('CIVIX', 50, 70, { align: 'center', lineBreak: false });
doc.moveDown(0.3);
doc.font('Helvetica').fontSize(13).fillColor('#c7d2fe')
   .text('Integrated Citizen Engagement Platform', { align: 'center' });
doc.moveDown(0.5);
doc.font('Helvetica').fontSize(11).fillColor('#e0e7ff')
   .text('Municipality of Cantilan, Surigao del Sur', { align: 'center' });

doc.fillColor(DARK).moveDown(3);
doc.font('Helvetica-Bold').fontSize(15).fillColor(PRIMARY)
   .text('System Features & Additions', { align: 'center' });
doc.moveDown(0.4);
doc.font('Helvetica').fontSize(10).fillColor(GRAY)
   .text(`Generated: ${new Date().toLocaleDateString('en-PH', { year:'numeric', month:'long', day:'numeric' })}`, { align: 'center' });

doc.moveDown(2);
doc.rect(50, doc.y, W, 1).fill('#e2e8f0'); doc.moveDown(0.5);

// ── SECTION 1: Auth & User Accounts ─────────────────────────────────────────
sectionHeader('1. Authentication & User Accounts');

subHead('Login Page');
bullet('Town hall building background with dark overlay');
bullet('Glassmorphism card (blur, frosted glass effect)');
bullet('Cantilan official seal + CIVIX logo side by side');
bullet('Glass inputs with white text and white focus border');

subHead('Register Page');
bullet('Same background and logo layout as Login');
bullet('3-step wizard: Account → Contact → Security');
bullet('Glassmorphism card styling');

subHead('User Roles');
bullet('CITIZEN — public users who submit complaints/suggestions/feedback');
bullet('STAFF — government personnel assigned to departments');
bullet('ADMIN — full system access and management');

subHead('Profile & Avatar');
bullet('Canvas-based circular crop tool on all portals (Admin, Staff, Citizen)');
bullet('Drag to reposition + zoom slider for precise cropping');
bullet('Single Save Changes: uploads photo and name in one action');

subHead('Auto Citizen ID');
bullet('Backend auto-generates unique Citizen ID: CIT-YYYYMMDD-XXXXX');
bullet('No manual entry required on registration form');

// ── SECTION 2: Citizen Portal ─────────────────────────────────────────────────
sectionHeader('2. Citizen Portal');

subHead('Submission Form');
bullet('Address field (required) for location context');
bullet('Gmail and Phone pre-filled from user profile');
bullet('20 LGU department categories dropdown');
bullet('File attachment support');

subHead('Keyword Auto-Assignment');
bullet('System detects keywords in description and title');
bullet('Suggests the correct department automatically');
bullet('Citizen can override or confirm the suggestion');

subHead('Map Picker');
bullet('Interactive Leaflet.js map locked to Cantilan town center');
bullet('Bounds restricted to prevent out-of-area pin placement');
bullet('Center coordinates: 9.330°N, 125.978°E');

// ── SECTION 3: Admin Portal ────────────────────────────────────────────────────
sectionHeader('3. Admin Portal');

subHead('Map View');
bullet('Displays ALL submissions as color-coded pins');
bullet('Complaint = Red, Suggestion = Blue, Feedback = Green');
bullet('Submissions without GPS coordinates placed near center with dashed markers');
bullet('Rich popups with citizen info, type/status badges, description');

subHead('Analytics PDF Report');
bullet('4-page formal PDF generated server-side using PDFKit');
bullet('Page 1: Cover page, Table of Contents, Executive Summary');
bullet('Page 2: KPI cards, type distribution bars, sentiment breakdown');
bullet('Page 3: Departmental bar chart (top 8 departments), summary table');
bullet('Page 4: Full submissions log table, certification, signature lines');

subHead('Personnel Directory');
bullet('Full CRUD management for Staff accounts');
bullet('Fields: Full Name, Email, Department, Password');
bullet('Edit and Delete with confirmation dialog');
bullet('Auto-generates Staff ID: STAFF-YYYYMMDD-XXXXX');

subHead('20 LGU Department Categories');
bullet('Includes all official offices of the Municipality of Cantilan');
bullet('Used for routing submissions to correct government departments');

// ── SECTION 4: Staff Portal ─────────────────────────────────────────────────
sectionHeader('4. Staff Portal');

subHead('Dashboard');
bullet('Department-filtered KPIs (only shows data for staff\'s assigned department)');
bullet('Type breakdown: Complaints / Suggestions / Feedback');
bullet('Status breakdown: Pending / Reviewing / In Progress / Resolved');
bullet('Recent submissions table with status and type badges');
bullet('Matches Admin dashboard design for consistency');

subHead('My Submissions');
bullet('Lists all submissions assigned to the staff\'s department');
bullet('Filter by status, type, and search keyword');

subHead('Track & Monitor');
bullet('Track any submission by Tracking ID');
bullet('View all submissions across all departments');
bullet('Filters: status, type, department, text search');
bullet('Slide-in detail panel with progress timeline');
bullet('Assign submission to any department (all 20 offices)');
bullet('Update submission status directly');

// ── SECTION 5: Backend / Server ───────────────────────────────────────────────
sectionHeader('5. Backend & Server');

subHead('Technology Stack');
bullet('Node.js + Express.js REST API');
bullet('Prisma ORM with MySQL (XAMPP)');
bullet('JWT authentication (7-day expiry)');
bullet('bcryptjs password hashing (12 salt rounds)');
bullet('Multer for file uploads (submissions + avatar separate)');
bullet('PDFKit for server-side PDF generation');

subHead('Raw SQL Workaround');
bullet('Prisma client uses $queryRaw and $executeRaw for all queries');
bullet('Required due to DLL lock preventing Prisma client regeneration');
bullet('Affects: department, avatar, STAFF role fields');

subHead('Avatar Upload');
bullet('Saved to uploads/avatars/ directory');
bullet('Old avatar automatically deleted when new one is uploaded');
bullet('Filename format: avatar-{userId}-{timestamp}.jpg');

subHead('Staff API Endpoints');
bullet('GET  /staff              — List all staff (Admin only)');
bullet('POST /staff              — Create staff account (Admin only)');
bullet('PATCH /staff/:id         — Update staff account (Admin only)');
bullet('DELETE /staff/:id        — Delete staff account (Admin only)');
bullet('GET  /staff/portal/stats — Staff dashboard KPIs');
bullet('GET  /staff/portal/submissions — Department submissions');
bullet('GET  /staff/portal/monitor    — All submissions (read)');
bullet('PATCH /staff/portal/assign/:id — Reassign department & status');
bullet('GET  /staff/portal/track/:id   — Track by tracking ID');

subHead('Settings');
bullet('20 LGU offices stored as default categories');
bullet('Organization name and tagline configurable');
bullet('Public settings endpoint for branding on login page');

// ── FOOTER ────────────────────────────────────────────────────────────────────
doc.moveDown(2);
doc.rect(50, doc.y, W, 1).fill('#e2e8f0'); doc.moveDown(0.5);
doc.font('Helvetica').fontSize(9).fillColor(GRAY)
   .text(`© ${new Date().getFullYear()} Municipality of Cantilan · CIVIX Integrated Citizen Engagement Platform`, { align: 'center', lineBreak: false });

doc.end();

doc.on('finish', () => {
  console.log(`PDF saved to: ${OUT}`);
});
