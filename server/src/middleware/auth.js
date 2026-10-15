const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');

// A password reset signs the account out everywhere: sign-ins made before
// User.passwordChangedAt stop working, and so do those of a deleted account.
// Looked up at most every 30 seconds per account (per server process).
const RECHECK_MS = 30 * 1000;
const changes = new Map(); // userId -> { checkedAt, changedAt (ms, 0 = never, null = no account) }

async function passwordChangedAt(userId) {
  const known = changes.get(userId);
  if (known && Date.now() - known.checkedAt < RECHECK_MS) return known.changedAt;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordChangedAt: true } });
  const changedAt = user ? (user.passwordChangedAt?.getTime() || 0) : null;
  if (changes.size > 5000) changes.clear();
  changes.set(userId, { checkedAt: Date.now(), changedAt });
  return changedAt;
}

// After a reset, so this process stops accepting the old sign-ins at once.
function forgetPasswordChange(userId) {
  changes.delete(userId);
}

async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: no token' });
  }
  const token = header.split(' ')[1];
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Unauthorized: invalid token' });
  }
  try {
    const changedAt = await passwordChangedAt(decoded.id);
    // A sign-in from the same second as the change still counts (iat is in seconds).
    if (changedAt === null || (changedAt && decoded.iat < Math.floor(changedAt / 1000))) {
      return res.status(401).json({ error: 'Your session has ended. Please sign in again.' });
    }
  } catch (err) {
    // If the check itself fails (e.g. the database is busy), the signed token still counts.
    console.error('[auth] Could not check for a password change:', err.message);
  }
  req.user = decoded;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden: admin only' });
  }
  next();
}

function requireStaff(req, res, next) {
  if (req.user?.role !== 'STAFF') {
    return res.status(403).json({ error: 'Forbidden: staff only' });
  }
  next();
}

function requireStaffOrAdmin(req, res, next) {
  if (!['ADMIN', 'STAFF'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

module.exports = { authenticate, requireAdmin, requireStaff, requireStaffOrAdmin, forgetPasswordChange };
