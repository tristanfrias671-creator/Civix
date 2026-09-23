const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const fs     = require('fs');
const path   = require('path');
const { PrismaClient } = require('@prisma/client');
const { OAuth2Client } = require('google-auth-library');
const { configured: cloudinaryConfigured } = require('../utils/cloudinary');

const prisma = new PrismaClient();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function googleLogin(req, res) {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Missing Google credential' });
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
      SELECT id, fullName, email, role, citizenId, gmail, mobileNumber, department, avatar
      FROM User WHERE email = ${email} OR gmail = ${email} LIMIT 1
    `;
    if (!rows.length) {
      return res.status(401).json({ error: 'No staff or administrator account is registered with this Google email' });
    }
    const user = rows[0];
    if (user.role !== 'ADMIN' && user.role !== 'STAFF') {
      return res.status(403).json({ error: 'This Google account is not authorized for staff/admin access' });
    }

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
    const rows = await prisma.$queryRaw`
      SELECT id, fullName, email, password, role, citizenId, gmail, mobileNumber, department, avatar
      FROM User WHERE email = ${email} LIMIT 1
    `;
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const user = rows[0];

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

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

module.exports = { register, login, googleLogin, getMe, updateProfile, changePassword, uploadAvatar };
