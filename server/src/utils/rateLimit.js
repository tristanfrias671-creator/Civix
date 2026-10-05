const jwt = require('jsonwebtoken');
const { networkKey } = require('./clientIp');

// Signed-in staff and admins aren't held to the per-network limits: the municipal
// hall shares one internet connection, and a help desk may file reports for
// walk-in citizens. (Philippine mobile networks also put many people behind one
// address, which is why the per-phone/email limits do most of the work.)
function signedInStaff(req) {
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) return false;
  try {
    const { role } = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    return role === 'STAFF' || role === 'ADMIN';
  } catch {
    return false;
  }
}

// Counts events per key in fixed time windows, in memory (CIVIX runs as one
// server process). Memory stays small during a flood: each key keeps one counter,
// finished windows are swept away, and the oldest keys go first past maxKeys.
function createLimiter({ windowMs, max, maxKeys = 50000 }) {
  const windows = new Map(); // key -> { start, count }
  let lastSweep = 0;

  function sweep(now) {
    for (const [key, w] of windows) if (now - w.start >= windowMs) windows.delete(key);
    while (windows.size > maxKeys) windows.delete(windows.keys().next().value);
    lastSweep = now;
  }

  return {
    // Counts one event for `key` when allowed. Returns { ok, retryAfter } with
    // retryAfter in seconds (0 when allowed).
    take(key, now = Date.now()) {
      if (now - lastSweep >= windowMs || windows.size > maxKeys) sweep(now);
      let w = windows.get(key);
      if (!w || now - w.start >= windowMs) {
        w = { start: now, count: 0 };
        windows.set(key, w);
      }
      if (w.count >= max) return { ok: false, retryAfter: Math.max(1, Math.ceil((w.start + windowMs - now) / 1000)) };
      w.count += 1;
      return { ok: true, retryAfter: 0 };
    },
    // Whether `key` has used up its allowance in the current window (counts nothing).
    isFull(key, now = Date.now()) {
      const w = windows.get(key);
      return Boolean(w && now - w.start < windowMs && w.count >= max);
    },
    // Seconds until `key` may go again: 0 when it may go now (counts nothing).
    waitFor(key, now = Date.now()) {
      const w = windows.get(key);
      if (!w || now - w.start >= windowMs || w.count < max) return 0;
      return Math.max(1, Math.ceil((w.start + windowMs - now) / 1000));
    },
    // Takes back one event (e.g. a request that turned out not to count).
    give(key) {
      const w = windows.get(key);
      if (w && w.count > 0) w.count -= 1;
    },
  };
}

// "1 minute", "5 minutes", "about 2 hours"
function waitText(seconds) {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  if (minutes < 90) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  return `about ${Math.round(minutes / 60)} hours`;
}

// Express middleware: answers 429 (with Retry-After) once `max` requests in
// `windowMs` come from the same key (the visitor's network unless `key` says
// otherwise; requests with no key, see networkKey, aren't counted).
// `message(wait)` builds the error shown to the person. Signed-in staff and admins
// pass freely.
function limitRequests({ windowMs, max, key = networkKey, code = 'RATE_LIMITED', status = 429, message }) {
  const limiter = createLimiter({ windowMs, max });
  return (req, res, next) => {
    if (signedInStaff(req)) return next();
    const id = key(req);
    if (id == null) return next();
    const { ok, retryAfter } = limiter.take(id);
    if (ok) return next();
    res.set('Retry-After', String(retryAfter));
    res.status(status).json({
      error: message ? message(waitText(retryAfter)) : `Too many requests. Please try again in ${waitText(retryAfter)}.`,
      code,
      retryAfter,
    });
  };
}

// Like limitRequests, but only failed attempts count (answers 401 and 423: a wrong
// password or a locked account). A whole office signing in from the municipal
// hall's one connection is never held up; guessing passwords from one network is.
function limitFailures({ windowMs, max, message }) {
  const limiter = createLimiter({ windowMs, max });
  return (req, res, next) => {
    const id = networkKey(req);
    if (id == null) return next();
    const wait = limiter.waitFor(id);
    if (wait > 0) {
      res.set('Retry-After', String(wait));
      return res.status(429).json({ error: message(waitText(wait)), code: 'RATE_LIMITED', retryAfter: wait });
    }
    res.on('finish', () => {
      if (res.statusCode === 401 || res.statusCode === 423) limiter.take(id);
    });
    next();
  };
}

module.exports = { createLimiter, limitRequests, limitFailures, waitText, signedInStaff };
