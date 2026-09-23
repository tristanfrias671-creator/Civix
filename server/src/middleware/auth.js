const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: no token' });
  }
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized: invalid token' });
  }
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

module.exports = { authenticate, requireAdmin, requireStaff, requireStaffOrAdmin };
