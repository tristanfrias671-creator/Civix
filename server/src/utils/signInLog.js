// Sign-in history (Admin > Audit Log, and each person's profile): sign-ins, failed
// attempts and password changes on the staff and admin pages.
//
// A phone or computer is told apart by a random id its browser keeps (localStorage
// civix_device, sent as `device`), never by anything personal. When an account
// signs in on a device it hasn't used before, its owner gets an email. The very
// first sign-in we see for an account is not "new": there is nothing to compare.
// Entries older than a year are removed at start-up.
const prisma = require('./prisma');
const { networkKey } = require('./clientIp');
const { sendNewDeviceSignInEmail } = require('./mailer');

const KEEP_DAYS = 365;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// "Chrome on Windows", "Safari on iPhone"… from the browser's User-Agent.
function describeDevice(userAgent) {
  const ua = String(userAgent || '');
  if (!ua) return null;
  const browser =
    /SamsungBrowser\//.test(ua) ? 'Samsung Internet'
    : /Edg(A|iOS)?\//.test(ua) ? 'Edge'
    : /OPR\/|Opera/.test(ua) ? 'Opera'
    : /Firefox\/|FxiOS\//.test(ua) ? 'Firefox'
    : /Chrome\/|CriOS\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : null;
  const system =
    /iPhone/.test(ua) ? 'iPhone'
    : /iPad/.test(ua) ? 'iPad'
    : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows'
    : /Macintosh|Mac OS X/.test(ua) ? 'Mac'
    : /CrOS/.test(ua) ? 'Chromebook'
    : /Linux/.test(ua) ? 'Linux'
    : null;
  if (!browser && !system) return 'Not a web browser';
  return system ? `${browser || 'A browser'} on ${system}` : browser;
}

const deviceIdOf = req => {
  const id = String(req.body?.device || '');
  return /^[A-Za-z0-9-]{8,64}$/.test(id) ? id : null;
};

const networkOf = req => networkKey(req) || String(req.ip || '').replace(/^::ffff:/, '') || null;

const clip = (value, max = 191) => (value == null ? null : String(value).slice(0, max));

// Records one event and returns it (or null). Never throws: the history must never
// stop anyone from signing in.
async function logSignIn(req, { user = null, email = '', outcome, method = 'PASSWORD', portal = null, detail = null }) {
  try {
    const deviceId = deviceIdOf(req);
    let newDevice = false;
    if (outcome === 'SIGNED_IN' && user) {
      const [signedInBefore, knownHere] = await Promise.all([
        prisma.loginEvent.count({ where: { userId: user.id, outcome: 'SIGNED_IN' } }),
        deviceId
          ? prisma.loginEvent.count({ where: { userId: user.id, deviceId, outcome: { in: ['SIGNED_IN', 'PASSWORD_RESET'] } } })
          : 0,
      ]);
      newDevice = signedInBefore > 0 && knownHere === 0;
    }
    // What was typed is kept only if it looks like an email: people sometimes type
    // their password in the email box, and that must never land in the history.
    const typed = String(email || '').trim().toLowerCase();
    const event = await prisma.loginEvent.create({
      data: {
        userId: user?.id || null,
        name: clip(user?.fullName),
        role: clip(user?.role),
        email: clip(user?.email || (EMAIL_RE.test(typed) ? typed : '(not an email address)')),
        portal: ['ADMIN', 'STAFF'].includes(portal) ? portal : null,
        method,
        outcome,
        newDevice,
        deviceId,
        device: clip(describeDevice(req.headers['user-agent'])),
        network: clip(networkOf(req)),
        detail: clip(detail),
      },
    });
    if (newDevice && user.email) sendNewDeviceSignInEmail(user, event); // not waited for
    return event;
  } catch (err) {
    console.error('[sign-in history] Could not record an event:', err.message);
    return null;
  }
}

async function pruneSignInHistory() {
  try {
    const before = new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000);
    const { count } = await prisma.loginEvent.deleteMany({ where: { createdAt: { lt: before } } });
    if (count) console.log(`[sign-in history] Removed ${count} entries older than ${KEEP_DAYS} days`);
  } catch (err) {
    console.error('[sign-in history] Could not remove old entries:', err.message);
  }
}

module.exports = { logSignIn, pruneSignInHistory, describeDevice };
