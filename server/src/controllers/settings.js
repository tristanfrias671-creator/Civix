const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

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
  return settings;
}

function formatSettings(row) {
  return {
    organizationName: row.organizationName,
    tagline: row.tagline,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    officeAddress: row.officeAddress,
    departments: parseJsonArray(row.departmentsJson, DEFAULT_DEPARTMENTS),
    updatedAt: row.updatedAt,
  };
}

async function getPublicProfile(req, res) {
  try {
    const settings = await ensureSettings();
    res.json({
      organizationName: settings.organizationName,
      tagline: settings.tagline,
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

module.exports = { getPublicProfile, getSettings, updateSystemProfile, updateLists };
