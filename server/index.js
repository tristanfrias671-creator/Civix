const path = require('path');
// Settings: server/.env locally. Hostinger writes the environment variables set in
// hPanel to a .env file in the app's top folder, so that one is read too.
// Variables already set in the environment are never overridden.
for (const file of [path.join(__dirname, '.env'), path.join(__dirname, '..', '.env')]) {
  require('dotenv').config({ path: file });
}
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const UPLOAD_ROOT = require('./src/utils/uploadRoot');
const { limitRequests } = require('./src/utils/rateLimit');

const authRoutes = require('./src/routes/auth');
const submissionRoutes = require('./src/routes/submissions');
const notificationRoutes = require('./src/routes/notifications');
const analyticsRoutes = require('./src/routes/analytics');
const reportRoutes = require('./src/routes/reports');
const settingsRoutes = require('./src/routes/settings');
const staffRoutes    = require('./src/routes/staff');
const classifyRoutes = require('./src/routes/classify');
const accessRequestRoutes = require('./src/routes/accessRequests');
const feedbackRoutes = require('./src/routes/feedback');

// A failed background task (an email or a text that couldn't be sent, for example)
// is logged instead of stopping the whole server; requests keep being served.
process.on('unhandledRejection', err => console.error('[server] Unhandled promise rejection:', err));
process.on('uncaughtException', err => console.error('[server] Uncaught exception:', err));

const app = express();
app.disable('x-powered-by');

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
// Every API request counts toward a per-network limit, far above normal use (staff
// pages check for new reports about twice a minute), to blunt request floods.
// It comes before the body is read, so refused requests cost almost nothing.
app.use('/api', limitRequests({
  windowMs: 60 * 1000,
  max: Number(process.env.API_REQUESTS_PER_MINUTE) || 300,
  message: wait => `Too many requests from this network. Please try again in ${wait}.`,
}));

// Plain requests carry small amounts of data; photos go through the upload limits.
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Uploaded photos are only ever shown as pictures: the browser must not guess
// another type, and anything that isn't a picture can't run scripts here.
app.use('/uploads', express.static(UPLOAD_ROOT, {
  setHeaders: res => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Security-Policy', 'sandbox');
  },
}));

app.use('/api/auth', authRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/staff',    staffRoutes);
app.use('/api/classify', classifyRoutes);
app.use('/api/access-requests', accessRequestRoutes);
app.use('/api/feedback', feedbackRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Online, this server also serves the built website (client/build). Every other
// address returns the app's index.html so the website's own router can show the
// right page, including the private admin sign-in link. Locally the website runs
// separately on port 3000, and client/build usually doesn't exist.
const CLIENT_BUILD = path.join(__dirname, '../client/build');
if (fs.existsSync(path.join(CLIENT_BUILD, 'index.html'))) {
  app.use(express.static(CLIENT_BUILD, { index: false }));
  app.get(/^\/(?!api\/|uploads\/).*/, (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(CLIENT_BUILD, 'index.html'));
  });
}

// Upload and request-size problems get a plain explanation; anything unexpected
// is logged and answered without inner details.
const UPLOAD_ERRORS = {
  LIMIT_FILE_SIZE: [413, 'Each photo must be 5 MB or smaller.'],
  LIMIT_FILE_COUNT: [400, 'You can attach up to 5 photos.'],
  LIMIT_UNEXPECTED_FILE: [400, 'You can attach up to 5 photos.'],
  LIMIT_FIELD_VALUE: [400, 'Some of the text is too long. Please shorten it and try again.'],
  LIMIT_FIELD_COUNT: [400, 'The form could not be read. Please reload the page and try again.'],
  LIMIT_FIELD_KEY: [400, 'The form could not be read. Please reload the page and try again.'],
  LIMIT_PART_COUNT: [400, 'The form could not be read. Please reload the page and try again.'],
};
app.use((err, req, res, next) => {
  req.releaseFormTicket?.();
  if (res.headersSent) return next(err);
  const upload = UPLOAD_ERRORS[err.code];
  if (upload) return res.status(upload[0]).json({ error: upload[1], code: err.code });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'The request is too large.' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'The request could not be read.' });
  const status = Number(err.status) >= 400 && Number(err.status) < 500 ? Number(err.status) : 500;
  if (status === 500) console.error(err.stack || err);
  res.status(status).json({ error: status < 500 ? err.message : 'Something went wrong. Please try again.', code: err.code });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`CIVIX server running on port ${PORT}`));

// Give reports filed before deadlines existed a resolve-by date.
require('./src/utils/deadline').backfillDeadlines()
  .then(n => { if (n) console.log(`[deadlines] Added deadlines to ${n} existing report(s).`); })
  .catch(err => console.error('[deadlines] Backfill failed:', err.message));

// Sign-in history is kept for a year.
require('./src/utils/signInLog').pruneSignInHistory();
