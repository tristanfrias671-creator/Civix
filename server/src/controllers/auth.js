const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');
const { OAuth2Client } = require('google-auth-library');
const { configured: cloudinaryConfigured } = require('../utils/cloudinary');
const UPLOAD_ROOT = require('../utils/uploadRoot');
const { ensureSettings, getDepartmentList, isAdminLoginPath } = require('./settings');
const { notifyAdmins } = require('./accessRequests');
const { sendVerificationCodeEmail, sendPasswordResetCodeEmail, sendPasswordChangedEmail, sendSignInCodeEmail } = require('../utils/mailer');
const { networkKey } = require('../utils/clientIp');
const { createLimiter } = require('../utils/rateLimit');
const { logSignIn } = require('../utils/signInLog');
const { forgetPasswordChange } = require('../middleware/auth');

const prisma = require('../utils/prisma');
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
const ADMIN_LINK_INVALID = 'This admin sign-in link is no longer valid. Ask another administrator for the current link.';

// For the sign-in history: which account tried which page.
const ACCOUNT_WORD = { ADMIN: 'Administrator', STAFF: 'Staff', CITIZEN: 'Citizen' };
const PAGE_WORD = { ADMIN: 'the admin sign-in page', STAFF: 'the Staff Login page' };
const wrongPageNote = (role, portal) => `${ACCOUNT_WORD[role] || 'An'} account on ${PAGE_WORD[portal] || 'an unknown page'}`;

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
    const portal = req.body.portal;
    if (!rows.length) {
      await logSignIn(req, { email, outcome: 'UNKNOWN_ACCOUNT', method: 'GOOGLE', portal });
      return res.status(401).json({ error: 'No staff or administrator account is registered with this Google email' });
    }
    const { accountStatus, ...user } = rows[0];
    const denied = portalError(portal, user.role);
    if (denied) {
      await logSignIn(req, { user, outcome: 'WRONG_PAGE', method: 'GOOGLE', portal, detail: wrongPageNote(user.role, portal) });
      return res.status(403).json({ error: denied });
    }
    if (accountStatus === 'PENDING') {
      await logSignIn(req, { user, outcome: 'NOT_APPROVED', method: 'GOOGLE', portal });
      return res.status(403).json({ error: PENDING_ACCOUNT_MESSAGE });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, fullName: user.fullName },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    await logSignIn(req, { user, outcome: 'SIGNED_IN', method: 'GOOGLE', portal });
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
// ── Email codes for staff account requests ──
// A request is only accepted with the 6-digit code emailed to its address, so
// nobody can file requests for addresses they don't own.
const CODE_MINUTES = 10;          // how long a code works
const RESEND_SECONDS = 60;        // wait before another code to the same email
const MAX_CODE_TRIES = 5;         // wrong guesses before the code is cancelled
const MAX_CODES_PER_HOUR = 5;     // codes per email per hour
const MAX_CODES_PER_IP_HOUR = 20; // codes per device or network per hour

// Only this hash is stored, never the code itself.
const hashCode = (email, code) => crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${email}:${code}`).digest('hex');

// Code requests per IP address in the last hour (kept in memory).
// Codes from everyone together are capped too (STAFF_CODES_PER_HOUR), so the form
// can't be used to flood mailboxes or use up the mailbox's sending limit.
const codesPerIp = createLimiter({ windowMs: 3600 * 1000, max: MAX_CODES_PER_IP_HOUR });
const codesSiteWide = createLimiter({ windowMs: 3600 * 1000, max: Number(process.env.STAFF_CODES_PER_HOUR) || 30 });
// Returns why no code may be sent now, or null.
function codeRequestRefusal(req) {
  const network = networkKey(req); // null when unknown: then only the site-wide cap
  if (network != null && !codesPerIp.take(network).ok) return 'Too many codes were requested from this device. Please try again later.';
  if (codesSiteWide.take('all').ok) return null;
  if (network != null) codesPerIp.give(network);
  return 'Many codes were requested in the last hour. Please try again later.';
}

// The staff request form, checked the same way when the code is sent and when
// the request is made.
async function readStaffRequest(body) {
  const data = {
    fullName: String(body.fullName || '').trim(),
    email: String(body.email || '').trim().toLowerCase(),
    department: String(body.department || '').trim(),
    reason: String(body.reason || '').trim(),
    password: String(body.password || ''),
  };
  if (!data.fullName || !data.email || !data.department || !data.password) {
    return { error: 'Full name, email, department and password are required' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return { error: 'Please enter a valid email address' };
  if (data.password.length < 8) return { error: 'Password must be at least 8 characters' };
  if (data.reason.length > 1000) return { error: 'Please keep the note under 1000 characters' };
  if (!(await getDepartmentList()).includes(data.department)) return { error: 'Please choose your department from the list' };
  return { data };
}

// POST /api/auth/staff-register/code — checks the request form, then emails a
// code to its address.
async function sendStaffCode(req, res) {
  try {
    const { error, data } = await readStaffRequest(req.body);
    if (error) return res.status(400).json({ error });
    const { email, fullName } = data;
    if (await prisma.user.findUnique({ where: { email } })) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const now = new Date();
    const previous = await prisma.emailVerification.findUnique({ where: { email } });
    if (previous) {
      const waitSeconds = Math.ceil((previous.sentAt.getTime() + RESEND_SECONDS * 1000 - now.getTime()) / 1000);
      if (waitSeconds > 0) {
        return res.status(429).json({ error: `Please wait ${waitSeconds} seconds before asking for a new code.`, retryAfter: waitSeconds });
      }
    }
    const sameHour = previous && now.getTime() - previous.windowStart.getTime() < 3600 * 1000;
    if (sameHour && previous.sendCount >= MAX_CODES_PER_HOUR) {
      return res.status(429).json({ error: 'Too many codes were sent to this email. Please try again in an hour.' });
    }
    const refusal = codeRequestRefusal(req);
    if (refusal) return res.status(429).json({ error: refusal });

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const fields = {
      codeHash: hashCode(email, code),
      attempts: 0,
      sentAt: now,
      expiresAt: new Date(now.getTime() + CODE_MINUTES * 60 * 1000),
      sendCount: sameHour ? previous.sendCount + 1 : 1,
      windowStart: sameHour ? previous.windowStart : now,
    };
    await prisma.emailVerification.upsert({ where: { email }, create: { email, ...fields }, update: fields });

    if (!(await sendVerificationCodeEmail({ email, fullName }, code, CODE_MINUTES))) {
      // Don't make them wait out the resend timer for a code that never went out.
      await prisma.emailVerification.update({ where: { email }, data: { sentAt: new Date(0) } }).catch(() => {});
      return res.status(503).json({ error: "We couldn't send the code right now. Please check the email address and try again." });
    }
    res.json({ message: 'Code sent', expiresInMinutes: CODE_MINUTES, resendAfterSeconds: RESEND_SECONDS });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send the code' });
  }
}

async function registerStaff(req, res) {
  try {
    const { error, data } = await readStaffRequest(req.body);
    if (error) return res.status(400).json({ error });
    const { fullName, email, department, reason, password } = data;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

    // The emailed code proves the address belongs to them.
    const code = String(req.body.code || '').replace(/\D/g, '');
    const check = await prisma.emailVerification.findUnique({ where: { email } });
    if (!check) {
      return res.status(400).json({ error: 'Please ask for a verification code first.', codeError: 'missing' });
    }
    if (check.expiresAt < new Date()) {
      return res.status(400).json({ error: 'This code has expired. Please send a new code.', codeError: 'expired' });
    }
    if (check.attempts >= MAX_CODE_TRIES) {
      return res.status(429).json({ error: 'Too many wrong tries. Please send a new code.', codeError: 'locked' });
    }
    const matches = code.length === 6
      && crypto.timingSafeEqual(Buffer.from(check.codeHash, 'hex'), Buffer.from(hashCode(email, code), 'hex'));
    if (!matches) {
      const { attempts } = await prisma.emailVerification.update({ where: { email }, data: { attempts: { increment: 1 } } });
      const left = MAX_CODE_TRIES - attempts;
      return res.status(left > 0 ? 400 : 429).json({
        error: left > 0 ? `That code isn't right. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many wrong tries. Please send a new code.',
        codeError: left > 0 ? 'wrong' : 'locked',
      });
    }

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
      await tx.emailVerification.delete({ where: { email } });
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
    const portal = req.body.portal;
    if (portal === 'ADMIN' && !(await isAdminLoginPath(req.body.adminPath))) {
      return res.status(403).json({ error: ADMIN_LINK_INVALID });
    }
    const rows = await prisma.$queryRaw`
      SELECT id, fullName, email, password, role, citizenId, gmail, mobileNumber, department, avatar,
             failedLoginAttempts, lockedUntil, accountStatus
      FROM User WHERE email = ${email} LIMIT 1
    `;
    if (!rows.length) {
      await logSignIn(req, { email, outcome: 'UNKNOWN_ACCOUNT', portal });
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = rows[0];

    // A locked account is refused even with the right password.
    const policy = await ensureSettings();
    const lockedMs = policy.lockoutEnabled && user.lockedUntil ? new Date(user.lockedUntil) - Date.now() : 0;
    if (lockedMs > 0) {
      await logSignIn(req, { user, outcome: 'LOCKED', portal, detail: 'Tried while the account was locked' });
      return res.status(423).json({
        error: `This account is locked after too many failed attempts. Try again in ${formatMinutes(Math.ceil(lockedMs / 60000))}.`,
      });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      if (!policy.lockoutEnabled) {
        await logSignIn(req, { user, outcome: 'WRONG_PASSWORD', portal });
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const { status, error } = await recordFailedLogin(user.id, policy);
      await logSignIn(req, status === 423
        ? { user, outcome: 'LOCKED', portal, detail: 'Locked after too many wrong passwords' }
        : { user, outcome: 'WRONG_PASSWORD', portal });
      return res.status(status).json({ error });
    }
    if (user.failedLoginAttempts || user.lockedUntil) {
      await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
    }

    const denied = portalError(portal, user.role);
    if (denied) {
      await logSignIn(req, { user, outcome: 'WRONG_PAGE', portal, detail: wrongPageNote(user.role, portal) });
      return res.status(403).json({ error: denied });
    }
    if (user.accountStatus === 'PENDING') {
      await logSignIn(req, { user, outcome: 'NOT_APPROVED', portal });
      return res.status(403).json({ error: PENDING_ACCOUNT_MESSAGE });
    }

    // With sign-in codes on (Settings > Security), an administrator's right password
    // only sends a code; the sign-in finishes at POST /auth/login/code.
    if (user.role === 'ADMIN' && policy.adminSignInCode) return startCodeSignIn(req, res, user, portal);

    await logSignIn(req, { user, outcome: 'SIGNED_IN', portal });
    res.json(signedIn(user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
}

// The answer to a finished sign-in: the session token and the account.
function signedIn(user) {
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, fullName: user.fullName },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  return {
    token,
    user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role, citizenId: user.citizenId, gmail: user.gmail, mobileNumber: user.mobileNumber, department: user.department, avatar: user.avatar },
  };
}

// ── Sign-in codes for administrators (Settings > Security) ──
// With the setting on, the right password on the private admin page isn't enough: a
// 6-digit code goes to the administrator's email, and the sign-in finishes when it
// is typed. The browser keeps a random ticket for that sign-in; only hashes of the
// ticket and the code are stored (SignInCode). Same limits as the reset codes.
const ticketHash = ticket => crypto.createHmac('sha256', process.env.JWT_SECRET).update(`ticket:${ticket}`).digest('hex');
const signInCodeHash = (userId, code) => hashCode(`sign-in:${userId}`, code);
const newTicket = () => crypto.randomBytes(24).toString('base64url');
const newCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');
const SIGN_IN_AGAIN = 'This sign-in has expired. Please sign in again.';
const codeAnswer = (ticket, email) => ({ codeRequired: true, ticket, email, expiresInMinutes: CODE_MINUTES, resendAfterSeconds: RESEND_SECONDS });

// Fields for a freshly sent code, counting it against the hourly limit.
function freshCode(previous, userId, code, now) {
  const sameHour = previous && now - previous.windowStart < 3600 * 1000;
  return {
    codeHash: signInCodeHash(userId, code), attempts: 0, sentAt: now,
    expiresAt: new Date(now.getTime() + CODE_MINUTES * 60 * 1000),
    sendCount: sameHour ? previous.sendCount + 1 : 1,
    windowStart: sameHour ? previous.windowStart : now,
  };
}
const overHourlyLimit = (previous, now) => previous && now - previous.windowStart < 3600 * 1000 && previous.sendCount >= MAX_CODES_PER_HOUR;
const TOO_MANY_CODES = 'Too many codes were sent to this account in the last hour. Please try again later.';
const CODE_NOT_SENT = "We couldn't send the code right now. Please try again in a few minutes.";

async function startCodeSignIn(req, res, user, portal) {
  const now = new Date();
  const ticket = newTicket();
  const previous = await prisma.signInCode.findUnique({ where: { userId: user.id } });
  // Signed in again within a minute of the last code: that code still works.
  if (previous && previous.purpose === 'SIGN_IN' && previous.expiresAt > now && previous.attempts < MAX_CODE_TRIES
      && now - previous.sentAt < RESEND_SECONDS * 1000) {
    await prisma.signInCode.update({ where: { userId: user.id }, data: { ticketHash: ticketHash(ticket), startedAt: now } });
    return res.json({ ...codeAnswer(ticket, user.email), alreadySent: true });
  }
  if (overHourlyLimit(previous, now)) return res.status(429).json({ error: TOO_MANY_CODES });

  const code = newCode();
  const fields = { purpose: 'SIGN_IN', ticketHash: ticketHash(ticket), startedAt: now, ...freshCode(previous, user.id, code, now) };
  await prisma.signInCode.upsert({ where: { userId: user.id }, create: { userId: user.id, ...fields }, update: fields });
  if (!(await sendSignInCodeEmail(user, code, CODE_MINUTES, 'SIGN_IN'))) {
    // Don't make them wait out the resend timer for a code that never went out.
    await prisma.signInCode.update({ where: { userId: user.id }, data: { sentAt: new Date(0) } }).catch(() => {});
    return res.status(503).json({ error: CODE_NOT_SENT });
  }
  await logSignIn(req, { user, outcome: 'CODE_SENT', portal, detail: 'Right password; sign-in code emailed' });
  res.json(codeAnswer(ticket, user.email));
}

// The pending sign-in a ticket belongs to, with its account, or { error } when it
// can't go on (expired, unknown, or the account changed since).
async function pendingSignIn(req) {
  if (req.body.portal !== 'ADMIN' || !(await isAdminLoginPath(req.body.adminPath))) return { status: 403, error: ADMIN_LINK_INVALID };
  const ticket = String(req.body.ticket || '');
  const check = ticket.length <= 64 && ticket ? await prisma.signInCode.findUnique({ where: { ticketHash: ticketHash(ticket) } }) : null;
  if (!check || check.purpose !== 'SIGN_IN') return { status: 400, error: SIGN_IN_AGAIN, codeError: 'restart' };
  const [user] = await prisma.$queryRaw`
    SELECT id, fullName, email, role, citizenId, gmail, mobileNumber, department, avatar, accountStatus, passwordChangedAt
    FROM User WHERE id = ${check.userId} LIMIT 1
  `;
  const passwordChanged = user?.passwordChangedAt && new Date(user.passwordChangedAt) > check.startedAt;
  if (!user || user.role !== 'ADMIN' || user.accountStatus !== 'ACTIVE' || passwordChanged) {
    await prisma.signInCode.delete({ where: { id: check.id } }).catch(() => {});
    return { status: 400, error: SIGN_IN_AGAIN, codeError: 'restart' };
  }
  return { check, user };
}

// POST /api/auth/login/code { ticket, code, portal, adminPath, device }
async function verifySignInCode(req, res) {
  try {
    const pending = await pendingSignIn(req);
    if (pending.error) return res.status(pending.status).json({ error: pending.error, codeError: pending.codeError });
    const { check, user } = pending;
    const portal = 'ADMIN';
    if (check.expiresAt < new Date()) {
      return res.status(400).json({ error: 'This code has expired. Please send a new code.', codeError: 'expired' });
    }
    const code = String(req.body.code || '').replace(/\D/g, '');
    const matches = code.length === 6
      && crypto.timingSafeEqual(Buffer.from(check.codeHash, 'hex'), Buffer.from(signInCodeHash(user.id, code), 'hex'));
    if (!matches) {
      const { attempts } = await prisma.signInCode.update({ where: { id: check.id }, data: { attempts: { increment: 1 } } });
      await logSignIn(req, { user, outcome: 'WRONG_SIGN_IN_CODE', method: 'EMAIL_CODE', portal });
      const left = MAX_CODE_TRIES - attempts;
      if (left <= 0) {
        // Out of tries: the password has to be entered again.
        await prisma.signInCode.delete({ where: { id: check.id } }).catch(() => {});
        return res.status(429).json({ error: 'Too many wrong tries. Please sign in again.', codeError: 'restart' });
      }
      return res.status(400).json({ error: `That code isn't right. ${left} ${left === 1 ? 'try' : 'tries'} left.`, codeError: 'wrong' });
    }

    await prisma.signInCode.delete({ where: { id: check.id } });
    await logSignIn(req, { user, outcome: 'SIGNED_IN', method: 'PASSWORD_AND_CODE', portal });
    res.json(signedIn(user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
}

// POST /api/auth/login/code/resend { ticket, portal, adminPath, device }
async function resendSignInCode(req, res) {
  try {
    const pending = await pendingSignIn(req);
    if (pending.error) return res.status(pending.status).json({ error: pending.error, codeError: pending.codeError });
    const { check, user } = pending;
    const now = new Date();
    const waitSeconds = Math.ceil((check.sentAt.getTime() + RESEND_SECONDS * 1000 - now.getTime()) / 1000);
    if (waitSeconds > 0) {
      return res.status(429).json({ error: `Please wait ${waitSeconds} seconds before asking for a new code.`, retryAfter: waitSeconds });
    }
    if (overHourlyLimit(check, now)) return res.status(429).json({ error: TOO_MANY_CODES });
    const code = newCode();
    await prisma.signInCode.update({ where: { id: check.id }, data: freshCode(check, user.id, code, now) });
    if (!(await sendSignInCodeEmail(user, code, CODE_MINUTES, 'SIGN_IN'))) {
      await prisma.signInCode.update({ where: { id: check.id }, data: { sentAt: new Date(0) } }).catch(() => {});
      return res.status(503).json({ error: CODE_NOT_SENT });
    }
    await logSignIn(req, { user, outcome: 'CODE_SENT', portal: 'ADMIN', detail: 'New sign-in code emailed' });
    res.json({ expiresInMinutes: CODE_MINUTES, resendAfterSeconds: RESEND_SECONDS });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send the code' });
  }
}

// ── Turning sign-in codes on or off (Settings > Security, administrators) ──
// Turning them on needs a code sent to the administrator doing it, so the setting
// can't be switched on for an email that doesn't receive mail.

// POST /api/settings/security/sign-in-code/start
async function startCodeSetting(req, res) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true, fullName: true, email: true } });
    if (!user) return res.status(404).json({ error: 'Account not found' });
    const now = new Date();
    const previous = await prisma.signInCode.findUnique({ where: { userId: user.id } });
    if (previous && previous.purpose === 'ENABLE') {
      const waitSeconds = Math.ceil((previous.sentAt.getTime() + RESEND_SECONDS * 1000 - now.getTime()) / 1000);
      if (waitSeconds > 0) {
        return res.status(429).json({ error: `Please wait ${waitSeconds} seconds before asking for a new code.`, retryAfter: waitSeconds });
      }
    }
    if (overHourlyLimit(previous, now)) return res.status(429).json({ error: TOO_MANY_CODES });
    const code = newCode();
    const fields = { purpose: 'ENABLE', ticketHash: ticketHash(newTicket()), startedAt: now, ...freshCode(previous, user.id, code, now) };
    await prisma.signInCode.upsert({ where: { userId: user.id }, create: { userId: user.id, ...fields }, update: fields });
    if (!(await sendSignInCodeEmail(user, code, CODE_MINUTES, 'ENABLE'))) {
      await prisma.signInCode.update({ where: { userId: user.id }, data: { sentAt: new Date(0) } }).catch(() => {});
      return res.status(503).json({ error: CODE_NOT_SENT });
    }
    res.json({ email: user.email, expiresInMinutes: CODE_MINUTES, resendAfterSeconds: RESEND_SECONDS });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send the code' });
  }
}

// POST /api/settings/security/sign-in-code { enabled: true, code } | { enabled: false }
async function setCodeSetting(req, res) {
  try {
    const settings = await ensureSettings();
    const turnOn = req.body.enabled === true;
    if (turnOn) {
      const check = await prisma.signInCode.findUnique({ where: { userId: req.user.id } });
      if (!check || check.purpose !== 'ENABLE') {
        return res.status(400).json({ error: 'Please send yourself a code first.', codeError: 'missing' });
      }
      if (check.expiresAt < new Date()) return res.status(400).json({ error: 'This code has expired. Please send a new code.', codeError: 'expired' });
      if (check.attempts >= MAX_CODE_TRIES) return res.status(429).json({ error: 'Too many wrong tries. Please send a new code.', codeError: 'locked' });
      const code = String(req.body.code || '').replace(/\D/g, '');
      const matches = code.length === 6
        && crypto.timingSafeEqual(Buffer.from(check.codeHash, 'hex'), Buffer.from(signInCodeHash(req.user.id, code), 'hex'));
      if (!matches) {
        const { attempts } = await prisma.signInCode.update({ where: { id: check.id }, data: { attempts: { increment: 1 } } });
        const left = MAX_CODE_TRIES - attempts;
        return res.status(left > 0 ? 400 : 429).json({
          error: left > 0 ? `That code isn't right. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many wrong tries. Please send a new code.',
          codeError: left > 0 ? 'wrong' : 'locked',
        });
      }
      await prisma.signInCode.delete({ where: { id: check.id } });
    }
    const updated = await prisma.systemSettings.update({ where: { id: settings.id }, data: { adminSignInCode: turnOn } });
    await logSignIn(req, { user: req.user, outcome: turnOn ? 'CODES_ON' : 'CODES_OFF', method: 'ADMIN', portal: 'ADMIN',
      detail: turnOn ? 'Administrators now need an email code to sign in' : 'Administrators sign in with their password only' });
    res.json({ adminSignInCode: updated.adminSignInCode });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to change the sign-in code setting' });
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
    await logSignIn(req, { user, outcome: 'PASSWORD_CHANGED', method: 'PROFILE' });
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
    if (existing[0]?.avatar?.startsWith('/uploads/avatars/')) {
      fs.unlink(path.join(UPLOAD_ROOT, 'avatars', path.basename(existing[0].avatar)), () => {});
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

// ── Forgot password (Staff Login page and the private admin page) ──
// A 6-digit code goes to the account's email; with it the person sets a new
// password. The page always gives the same answer, so it can't be used to find out
// which emails have accounts. Administrator accounts are only reset from the
// private admin page (it sends its address); the Staff Login page sends them no
// code. A reset signs the account out everywhere (User.passwordChangedAt).
const RESET_SENT = 'If this email belongs to an active account, we sent a 6-digit code to it.';
const NEW_PASSWORD_MIN = 8; // the same rule as a new staff account
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Reads { email, portal, adminPath } the same way for both steps. Returns
// { email, portal } or { status, error }.
async function readResetRequest(req) {
  const email = String(req.body.email || '').trim().toLowerCase();
  const portal = req.body.portal;
  if (!['STAFF', 'ADMIN'].includes(portal)) return { status: 400, error: 'Please use the Staff Login page or your admin sign-in link.' };
  if (!EMAIL_RE.test(email) || email.length > 191) return { status: 400, error: 'Please enter a valid email address' };
  if (portal === 'ADMIN' && !(await isAdminLoginPath(req.body.adminPath))) return { status: 403, error: ADMIN_LINK_INVALID };
  return { email, portal };
}

// The account a reset from this page may change: an active account of the page's
// own kind. Anything else gets no code (and the same answer).
async function resetAccount(email, portal) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, fullName: true, email: true, role: true, accountStatus: true },
  });
  return user && user.accountStatus === 'ACTIVE' && user.role === portal ? user : null;
}

const resetHash = (user, code) => hashCode(`reset:${user.id}`, code);

// POST /api/auth/password-reset/code { email, portal, adminPath, device }
async function sendResetCode(req, res) {
  try {
    const request = await readResetRequest(req);
    if (request.error) return res.status(request.status).json({ error: request.error });
    const { email, portal } = request;

    // Requests per network count whether the email has an account or not.
    const network = networkKey(req);
    if (network != null && !codesPerIp.take(network).ok) {
      return res.status(429).json({ error: 'Too many codes were requested from this device. Please try again later.' });
    }
    const answer = { message: RESET_SENT, expiresInMinutes: CODE_MINUTES, resendAfterSeconds: RESEND_SECONDS };
    const user = await resetAccount(email, portal);
    if (!user) return res.json(answer);

    // Too soon after the last code, or too many this hour: the same answer, no email.
    const now = new Date();
    const previous = await prisma.passwordReset.findUnique({ where: { userId: user.id } });
    if (previous && now - previous.sentAt < RESEND_SECONDS * 1000) return res.json(answer);
    const sameHour = previous && now - previous.windowStart < 3600 * 1000;
    if (sameHour && previous.sendCount >= MAX_CODES_PER_HOUR) return res.json(answer);
    if (!codesSiteWide.take('all').ok) {
      return res.status(429).json({ error: 'Many codes were requested in the last hour. Please try again later.' });
    }

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const fields = {
      codeHash: resetHash(user, code),
      attempts: 0,
      sentAt: now,
      expiresAt: new Date(now.getTime() + CODE_MINUTES * 60 * 1000),
      sendCount: sameHour ? previous.sendCount + 1 : 1,
      windowStart: sameHour ? previous.windowStart : now,
    };
    await prisma.passwordReset.upsert({ where: { userId: user.id }, create: { userId: user.id, ...fields }, update: fields });
    if (!(await sendPasswordResetCodeEmail(user, code, CODE_MINUTES))) {
      await prisma.passwordReset.update({ where: { userId: user.id }, data: { sentAt: new Date(0) } }).catch(() => {});
      return res.status(503).json({ error: "We couldn't send the email right now. Please try again in a few minutes." });
    }
    await logSignIn(req, { user, outcome: 'RESET_CODE_SENT', method: 'EMAIL_CODE', portal });
    res.json(answer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send the code' });
  }
}

// POST /api/auth/password-reset { email, code, newPassword, portal, adminPath, device }
async function resetPassword(req, res) {
  try {
    const request = await readResetRequest(req);
    if (request.error) return res.status(request.status).json({ error: request.error });
    const { email, portal } = request;
    const code = String(req.body.code || '').replace(/\D/g, '');
    const newPassword = String(req.body.newPassword || '');
    if (newPassword.length < NEW_PASSWORD_MIN) {
      return res.status(400).json({ error: `Your new password must be at least ${NEW_PASSWORD_MIN} characters.`, field: 'password' });
    }
    if (newPassword.length > 128) return res.status(400).json({ error: 'Please use a shorter password (up to 128 characters).', field: 'password' });

    const user = await resetAccount(email, portal);
    const check = user && await prisma.passwordReset.findUnique({ where: { userId: user.id } });
    if (!check) {
      return res.status(400).json({ error: "That code isn't right or has expired. Please ask for a new code.", codeError: 'missing' });
    }
    if (check.expiresAt < new Date()) {
      return res.status(400).json({ error: 'This code has expired. Please ask for a new code.', codeError: 'expired' });
    }
    if (check.attempts >= MAX_CODE_TRIES) {
      return res.status(429).json({ error: 'Too many wrong tries. Please ask for a new code.', codeError: 'locked' });
    }
    const matches = code.length === 6
      && crypto.timingSafeEqual(Buffer.from(check.codeHash, 'hex'), Buffer.from(resetHash(user, code), 'hex'));
    if (!matches) {
      const { attempts } = await prisma.passwordReset.update({ where: { userId: user.id }, data: { attempts: { increment: 1 } } });
      await logSignIn(req, { user, outcome: 'WRONG_CODE', method: 'EMAIL_CODE', portal });
      const left = MAX_CODE_TRIES - attempts;
      return res.status(left > 0 ? 400 : 429).json({
        error: left > 0 ? `That code isn't right. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many wrong tries. Please ask for a new code.',
        codeError: left > 0 ? 'wrong' : 'locked',
      });
    }

    const changedAt = new Date();
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { password: await bcrypt.hash(newPassword, 12), failedLoginAttempts: 0, lockedUntil: null, passwordChangedAt: changedAt },
      }),
      prisma.passwordReset.delete({ where: { userId: user.id } }),
    ]);
    forgetPasswordChange(user.id);
    const event = await logSignIn(req, { user, outcome: 'PASSWORD_RESET', method: 'EMAIL_CODE', portal });
    sendPasswordChangedEmail(user, { when: changedAt, device: event?.device });
    res.json({ message: 'Your password was changed. You can now sign in with your new password.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to change the password' });
  }
}

// ── Sign-in history ──
const PROBLEM_OUTCOMES = ['WRONG_PASSWORD', 'LOCKED', 'UNKNOWN_ACCOUNT', 'WRONG_PAGE', 'WRONG_CODE', 'WRONG_SIGN_IN_CODE', 'NOT_APPROVED'];
const HISTORY_FIELDS = {
  id: true, userId: true, name: true, role: true, email: true, portal: true, method: true,
  outcome: true, newDevice: true, device: true, network: true, detail: true, createdAt: true,
};

// GET /api/auth/sign-ins?view=problems — newest first, for Admin > Audit Log.
async function getSignIns(req, res) {
  try {
    const where = req.query.view === 'problems' ? { outcome: { in: PROBLEM_OUTCOMES } } : {};
    res.json(await prisma.loginEvent.findMany({ where, orderBy: { createdAt: 'desc' }, take: 300, select: HISTORY_FIELDS }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load the sign-in history' });
  }
}

// GET /api/auth/my-sign-ins — the signed-in person's own latest entries (profile).
async function getMySignIns(req, res) {
  try {
    res.json(await prisma.loginEvent.findMany({
      where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 8, select: HISTORY_FIELDS,
    }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load your sign-in activity' });
  }
}

module.exports = {
  register, registerStaff, sendStaffCode, checkPortalPath, login, googleLogin, getMe, updateProfile, changePassword, uploadAvatar,
  sendResetCode, resetPassword, getSignIns, getMySignIns,
  verifySignInCode, resendSignInCode, startCodeSetting, setCodeSetting,
};
