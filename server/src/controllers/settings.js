const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { configured: cloudinaryConfigured } = require('../utils/cloudinary');
const { removeBrandingFile } = require('../utils/branding');

const prisma = new PrismaClient();

// Upload kind in the URL -> SystemSettings column.
const BRANDING_FIELDS = { seal: 'sealUrl', hero: 'heroImageUrl' };

const DEFAULT_DEPARTMENTS = [
  "Mayor's Office – CRMO", 'HR', 'Tourism', 'Motorpool', 'Traffic',
  'CSDO', 'OSCA', 'MDRRMO',
  'Municipal Budget Office', 'Municipal Accountant Office',
  'Municipal Agriculture Office', 'Municipal Health Office',
  'Municipal Civil Registry Office',
  'Municipal Social Welfare & Development Office',
  'Municipal Economic & Natural Resource Office',
  'Municipal Treasurer Office', 'Municipal Engineering Office',
  'Municipal Planning & Development Office',
  'Sangguniang Bayan Office', 'Office of the Vice Mayor',
];

function parseJsonArray(raw, fallback) {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

// Random, unguessable address for the admin sign-in page, e.g. portal-3f9c1a7e5b2d8c40.
function newAdminLoginPath() {
  return `portal-${crypto.randomBytes(8).toString('hex')}`;
}

async function ensureSettings() {
  let settings = await prisma.systemSettings.findUnique({ where: { id: 'default' } });
  if (!settings) {
    settings = await prisma.systemSettings.create({
      data: {
        id: 'default',
        departmentsJson: JSON.stringify(DEFAULT_DEPARTMENTS),
      },
    });
  }
  if (!settings.adminLoginPath) {
    await prisma.systemSettings.updateMany({
      where: { id: settings.id, adminLoginPath: null },
      data: { adminLoginPath: newAdminLoginPath() },
    });
    settings = await prisma.systemSettings.findUnique({ where: { id: settings.id } });
  }
  return settings;
}

async function getDepartmentList() {
  const settings = await ensureSettings();
  return parseJsonArray(settings.departmentsJson, DEFAULT_DEPARTMENTS);
}

// True only for the current private admin sign-in address.
async function isAdminLoginPath(value) {
  if (typeof value !== 'string' || !value) return false;
  const { adminLoginPath } = await ensureSettings();
  const a = Buffer.from(value);
  const b = Buffer.from(adminLoginPath);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Allowed ranges for the sign-in protection settings.
const SECURITY_LIMITS = {
  maxLoginAttempts:   { min: 3, max: 10,   label: 'Wrong passwords allowed' },
  lockoutMinutes:     { min: 1, max: 1440, label: 'Lock duration' },
  idleTimeoutMinutes: { min: 5, max: 480,  label: 'Inactivity limit' },
};

function formatSecurity(row) {
  return {
    lockoutEnabled: row.lockoutEnabled,
    maxLoginAttempts: row.maxLoginAttempts,
    lockoutMinutes: row.lockoutMinutes,
    idleTimeoutEnabled: row.idleTimeoutEnabled,
    idleTimeoutMinutes: row.idleTimeoutMinutes,
  };
}

// Working days to resolve each report type.
function formatDeadlines(row) {
  return {
    COMPLAINT: row.deadlineComplaintDays,
    SUGGESTION: row.deadlineSuggestionDays,
    FEEDBACK: row.deadlineFeedbackDays,
  };
}

function formatSettings(row) {
  return {
    organizationName: row.organizationName,
    tagline: row.tagline,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    officeAddress: row.officeAddress,
    departments: parseJsonArray(row.departmentsJson, DEFAULT_DEPARTMENTS),
    security: formatSecurity(row),
    deadlines: formatDeadlines(row),
    ...formatBranding(row),
    updatedAt: row.updatedAt,
  };
}

function formatBranding(row) {
  return { sealUrl: row.sealUrl, heroImageUrl: row.heroImageUrl };
}

async function getPublicProfile(req, res) {
  try {
    const settings = await ensureSettings();
    res.json({
      organizationName: settings.organizationName,
      tagline: settings.tagline,
      departments: parseJsonArray(settings.departmentsJson, DEFAULT_DEPARTMENTS),
      deadlines: formatDeadlines(settings),
      ...formatBranding(settings),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load public profile' });
  }
}

async function getSettings(req, res) {
  try {
    const settings = await ensureSettings();
    res.json(formatSettings(settings));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load settings' });
  }
}

async function updateSystemProfile(req, res) {
  try {
    const { organizationName, tagline, contactEmail, contactPhone, officeAddress } = req.body;
    if (!organizationName?.trim()) {
      return res.status(400).json({ error: 'Organization name is required' });
    }
    const settings = await ensureSettings();
    const updated = await prisma.systemSettings.update({
      where: { id: settings.id },
      data: {
        organizationName: organizationName.trim(),
        tagline: (tagline || '').trim(),
        contactEmail: (contactEmail || '').trim().toLowerCase(),
        contactPhone: (contactPhone || '').trim(),
        officeAddress: (officeAddress || '').trim(),
      },
    });
    res.json(formatSettings(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update system profile' });
  }
}

async function updateLists(req, res) {
  try {
    const { departments } = req.body;
    const data = {};
    if (departments !== undefined) {
      if (!Array.isArray(departments)) return res.status(400).json({ error: 'departments must be an array' });
      data.departmentsJson = JSON.stringify(departments.map(d => String(d).trim()).filter(Boolean));
    }
    const settings = await ensureSettings();
    const updated = await prisma.systemSettings.update({ where: { id: settings.id }, data });
    res.json(formatSettings(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update lists' });
  }
}

async function updateSecurity(req, res) {
  try {
    const data = {};
    for (const key of ['lockoutEnabled', 'idleTimeoutEnabled']) {
      if (req.body[key] !== undefined) data[key] = Boolean(req.body[key]);
    }
    for (const [key, { min, max, label }] of Object.entries(SECURITY_LIMITS)) {
      if (req.body[key] === undefined) continue;
      const n = Number(req.body[key]);
      if (!Number.isInteger(n) || n < min || n > max) {
        return res.status(400).json({ error: `${label} must be a whole number from ${min} to ${max}` });
      }
      data[key] = n;
    }
    const settings = await ensureSettings();
    const updated = await prisma.systemSettings.update({ where: { id: settings.id }, data });
    res.json(formatSettings(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update security settings' });
  }
}

async function getLockedAccounts(req, res) {
  try {
    const accounts = await prisma.user.findMany({
      where: { lockedUntil: { gt: new Date() } },
      select: { id: true, fullName: true, email: true, role: true, department: true, lockedUntil: true },
      orderBy: { lockedUntil: 'desc' },
    });
    res.json({ accounts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load locked accounts' });
  }
}

async function unlockAccount(req, res) {
  try {
    await prisma.user.update({
      where: { id: req.params.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
    res.json({ message: 'Account unlocked' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Account not found' });
    console.error(err);
    res.status(500).json({ error: 'Failed to unlock account' });
  }
}

// Inactivity limit for the signed-in portals; 0 means automatic sign-out is off.
async function getSessionPolicy(req, res) {
  try {
    const settings = await ensureSettings();
    res.json({ idleTimeoutMinutes: settings.idleTimeoutEnabled ? settings.idleTimeoutMinutes : 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load session policy' });
  }
}

async function uploadBranding(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image provided' });
    const field = BRANDING_FIELDS[req.params.kind];
    const url = cloudinaryConfigured ? req.file.path : `/uploads/branding/${req.file.filename}`;
    const settings = await ensureSettings();
    const updated = await prisma.systemSettings.update({ where: { id: settings.id }, data: { [field]: url } });
    removeBrandingFile(settings[field]);
    res.json(formatBranding(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save image' });
  }
}

// Goes back to the bundled default image.
async function resetBranding(req, res) {
  try {
    const field = BRANDING_FIELDS[req.params.kind];
    const settings = await ensureSettings();
    const updated = await prisma.systemSettings.update({ where: { id: settings.id }, data: { [field]: null } });
    removeBrandingFile(settings[field]);
    res.json(formatBranding(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reset image' });
  }
}

// PATCH /api/settings/deadlines { COMPLAINT, SUGGESTION, FEEDBACK } — working days.
// Applies to reports submitted from now on; existing deadlines stay as promised.
async function updateDeadlines(req, res) {
  try {
    const fields = { COMPLAINT: 'deadlineComplaintDays', SUGGESTION: 'deadlineSuggestionDays', FEEDBACK: 'deadlineFeedbackDays' };
    const data = {};
    for (const [type, column] of Object.entries(fields)) {
      if (req.body[type] === undefined) continue;
      const n = Number(req.body[type]);
      if (!Number.isInteger(n) || n < 1 || n > 60) {
        return res.status(400).json({ error: 'Deadlines must be whole numbers from 1 to 60 working days' });
      }
      data[column] = n;
    }
    const settings = await ensureSettings();
    const updated = await prisma.systemSettings.update({ where: { id: settings.id }, data });
    res.json(formatSettings(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update deadlines' });
  }
}

async function getAdminLink(req, res) {
  try {
    const settings = await ensureSettings();
    res.json({ path: settings.adminLoginPath });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load the admin sign-in link' });
  }
}

// Replaces the private admin link; the old one stops working immediately.
async function rotateAdminLink(req, res) {
  try {
    const settings = await ensureSettings();
    const updated = await prisma.systemSettings.update({
      where: { id: settings.id },
      data: { adminLoginPath: newAdminLoginPath() },
    });
    res.json({ path: updated.adminLoginPath });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to change the admin sign-in link' });
  }
}

module.exports = {
  ensureSettings, getDepartmentList, isAdminLoginPath, BRANDING_FIELDS,
  getAdminLink, rotateAdminLink, updateDeadlines,
  getPublicProfile, getSettings, updateSystemProfile, updateLists,
  updateSecurity, getLockedAccounts, unlockAccount, getSessionPolicy,
  uploadBranding, resetBranding,
};
