const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const fs     = require('fs');
const path   = require('path');
const { PrismaClient } = require('@prisma/client');
const { OAuth2Client } = require('google-auth-library');
const { configured: cloudinaryConfigured } = require('../utils/cloudinary');
const { ensureSettings, getDepartmentList, isAdminLoginPath } = require('./settings');
const { notifyAdmins } = require('./accessRequests');

const prisma = new PrismaClient();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Each login page names its portal; an account can only sign in on its own
// portal's page. Checked only after the credentials are verified, so a wrong
// password never reveals what kind of account an email belongs to.
const PORTAL_LABEL = { ADMIN: 'Admin Login', STAFF: 'Staff Login' };
function portalError(portal, role) {
  if (!PORTAL_LABEL[portal]) return 'Please sign in from the Admin Login or Staff Login page.';
  if (role === portal) return null;
  if (PORTAL_LABEL[role]) {
    if (role === 'ADMIN') return 'This is an administrator account. Please sign in using your private admin sign-in link.';
    return 'This is a staff account. Please sign in on the Staff Login page.';
  }
  return 'This account is not authorized for staff or administrator access.';
}

const PENDING_ACCOUNT_MESSAGE = 'Your staff account is waiting for administrator approval. You can sign in once it is approved.';

function formatMinutes(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  const part = (n, unit) => `${n} ${unit}${n === 1 ? '' : 's'}`;
  if (!h) return part(m, 'minute');
  return m ? `${part(h, 'hour')} ${part(m, 'minute')}` : part(h, 'hour');
}

// Counts wrong passwords in a row. The count resets on a successful sign-in,
// and when it reaches the limit the account is locked for the set duration.
async function recordFailedLogin(userId, policy) {
  const { failedLoginAttempts: attempts } = await prisma.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: { increment: 1 } },
    select: { failedLoginAttempts: true },
  });
  if (attempts >= policy.maxLoginAttempts) {
    await prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: 0, lockedUntil: new Date(Date.now() + policy.lockoutMinutes * 60000) },
    });
    return { status: 423, error: `Too many failed attempts. This account is locked for ${formatMinutes(policy.lockoutMinutes)}.` };
  }
  const left = policy.maxLoginAttempts - attempts;
  return {
    status: 401,
    error: left <= 2
      ? `Invalid credentials. ${left} attempt${left === 1 ? '' : 's'} left before this account is locked.`
      : 'Invalid credentials',
  };
}

async function googleLogin(req, res) {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Missing Google credential' });
    // Administrators must use email and password (plus the lockout protection).
    if (req.body.portal === 'ADMIN') {
      return res.status(403).json({ error: 'Google sign-in is not available for administrators. Please sign in with your email and password.' });
    }
    if (!process.env.GOOGLE_CLIENT_ID) {
      console.error('GOOGLE_CLIENT_ID is not set in server/.env');
      return res.status(500).json({ error: 'Server misconfigured' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = String(payload.email || '').trim().toLowerCase();
    if (!payload.email_verified || !email) {
      return res.status(401).json({ error: 'Google account email is not verified' });
    }

    const rows = await prisma.$queryRaw`
      SELECT id, fullName, email, role, citizenId, gmail, mobileNumber, department, avatar, accountStatus
      FROM User WHERE email = ${email} OR gmail = ${email} LIMIT 1
    `;
    if (!rows.length) {
      return res.status(401).json({ error: 'No staff or administrator account is registered with this Google email' });
    }
    const { accountStatus, ...user } = rows[0];
    const denied = portalError(req.body.portal, user.role);
    if (denied) return res.status(403).json({ error: denied });
    if (accountStatus === 'PENDING') return res.status(403).json({ error: PENDING_ACCOUNT_MESSAGE });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, fullName: user.fullName },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: 'Google sign-in failed' });
  }
}

async function register(req, res) {
  try {
    const { fullName, email, gmail, mobileNumber, password } = req.body;
    if (!fullName || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    const existing = await prisma.user.findFirst({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    // Auto-generate unique Citizen ID: CIT-YYYYMMDD-XXXXX
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randPart = Math.random().toString(36).substring(2, 7).toUpperCase();
    const citizenId = `CIT-${datePart}-${randPart}`;
    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { fullName, citizenId, email, gmail: gmail || null, mobileNumber: mobileNumber || null, password: hashed, role: 'CITIZEN' },
    });
    res.status(201).json({ message: 'Registration successful', userId: user.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
}

// Tells the website whether an address is the private admin sign-in page,
// so that address never has to be written into the website's code.
async function checkPortalPath(req, res) {
  try {
    res.json({ admin: await isAdminLoginPath(req.body.path) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to check the address' });
  }
}

// Public staff sign-up: the account stays PENDING, and a request goes to the
// administrators, until one of them approves it.
async function registerStaff(req, res) {
  try {
    const fullName = String(req.body.fullName || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const department = String(req.body.department || '').trim();
    const reason = String(req.body.reason || '').trim();
    const password = String(req.body.password || '');
    if (!fullName || !email || !department || !password) {
      return res.status(400).json({ error: 'Full name, email, department and password are required' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (reason.length > 1000) {
      return res.status(400).json({ error: 'Please keep the note under 1000 characters' });
    }
    if (!(await getDepartmentList()).includes(department)) {
      return res.status(400).json({ error: 'Please choose your department from the list' });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randPart = Math.random().toString(36).substring(2, 7).toUpperCase();
    const hashed = await bcrypt.hash(password, 12);
    const request = await prisma.$transaction(async tx => {
      const user = await tx.user.create({
        data: {
          fullName, email, department, password: hashed,
          citizenId: `STAFF-${datePart}-${randPart}`,
          role: 'STAFF', accountStatus: 'PENDING',
        },
      });
      return tx.accessRequest.create({
        data: { type: 'STAFF_ACCOUNT', userId: user.id, fullName, email, department, reason: reason || null },
      });
    });
    notifyAdmins(request);
    res.status(201).json({ message: 'Request sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send the request' });
  }
}

async function login(req, res) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = req.body.password;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not set in server/.env');
      return res.status(500).json({ error: 'Server misconfigured' });
    }
    // Admin sign-in only works from the private admin page, which sends its address.
    if (req.body.portal === 'ADMIN' && !(await isAdminLoginPath(req.body.adminPath))) {
      return res.status(403).json({ error: 'This admin sign-in link is no longer valid. Ask another administrator for the current link.' });
    }
    const rows = await prisma.$queryRaw`
      SELECT id, fullName, email, password, role, citizenId, gmail, mobileNumber, department, avatar,
             failedLoginAttempts, lockedUntil, accountStatus
      FROM User WHERE email = ${email} LIMIT 1
    `;
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const user = rows[0];

    // A locked account is refused even with the right password.
    const policy = await ensureSettings();
    const lockedMs = policy.lockoutEnabled && user.lockedUntil ? new Date(user.lockedUntil) - Date.now() : 0;
    if (lockedMs > 0) {
      return res.status(423).json({
        error: `This account is locked after too many failed attempts. Try again in ${formatMinutes(Math.ceil(lockedMs / 60000))}.`,
      });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      if (!policy.lockoutEnabled) return res.status(401).json({ error: 'Invalid credentials' });
      const { status, error } = await recordFailedLogin(user.id, policy);
      return res.status(status).json({ error });
    }
    if (user.failedLoginAttempts || user.lockedUntil) {
      await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
    }

    const denied = portalError(req.body.portal, user.role);
    if (denied) return res.status(403).json({ error: denied });
    if (user.accountStatus === 'PENDING') return res.status(403).json({ error: PENDING_ACCOUNT_MESSAGE });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, fullName: user.fullName },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      token,
      user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role, citizenId: user.citizenId, gmail: user.gmail, mobileNumber: user.mobileNumber, department: user.department, avatar: user.avatar },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
}

async function getMe(req, res) {
  try {
    const rows = await prisma.$queryRaw`
      SELECT id, fullName, email, role, citizenId, gmail, mobileNumber, department, avatar, createdAt
      FROM User WHERE id = ${req.user.id} LIMIT 1
    `;
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
}

async function updateProfile(req, res) {
  try {
    const fullName = String(req.body.fullName || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!fullName || !email) {
      return res.status(400).json({ error: 'Full name and email are required' });
    }
    const existing = await prisma.user.findFirst({
      where: { email, NOT: { id: req.user.id } },
    });
    if (existing) return res.status(409).json({ error: 'Email is already in use' });

    const updateData = { fullName, email };
    if (req.body.gmail       !== undefined) updateData.gmail        = req.body.gmail       || null;
    if (req.body.mobileNumber !== undefined) updateData.mobileNumber = req.body.mobileNumber || null;

    await prisma.user.update({ where: { id: req.user.id }, data: updateData });

    const rows = await prisma.$queryRaw`
      SELECT id, fullName, email, role, citizenId, gmail, mobileNumber, department, avatar
      FROM User WHERE id = ${req.user.id} LIMIT 1
    `;
    const user = rows[0];

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, fullName: user.fullName },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
}

async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to change password' });
  }
}

async function uploadAvatar(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image provided' });

    // Delete old local avatar file if it exists (raw SQL — avatar not in Prisma client)
    const existing = await prisma.$queryRaw`SELECT avatar FROM User WHERE id = ${req.user.id} LIMIT 1`;
    if (existing[0]?.avatar && !existing[0].avatar.startsWith('http')) {
      const oldFile = path.join(__dirname, '../../..', existing[0].avatar);
      fs.unlink(oldFile, () => {});
    }

    const avatarPath = cloudinaryConfigured ? req.file.path : `/uploads/avatars/${req.file.filename}`;

    await prisma.$executeRaw`UPDATE User SET avatar = ${avatarPath} WHERE id = ${req.user.id}`;

    const rows = await prisma.$queryRaw`
      SELECT id, fullName, email, role, citizenId, gmail, mobileNumber, department, avatar
      FROM User WHERE id = ${req.user.id} LIMIT 1
    `;
    const user = rows[0];

    res.json({ avatar: user.avatar, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
}

module.exports = { register, registerStaff, checkPortalPath, login, googleLogin, getMe, updateProfile, changePassword, uploadAvatar };
