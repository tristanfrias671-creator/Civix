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

const authRoutes = require('./src/routes/auth');
const submissionRoutes = require('./src/routes/submissions');
const notificationRoutes = require('./src/routes/notifications');
const analyticsRoutes = require('./src/routes/analytics');
const reportRoutes = require('./src/routes/reports');
const settingsRoutes = require('./src/routes/settings');
const staffRoutes    = require('./src/routes/staff');
const classifyRoutes = require('./src/routes/classify');
const accessRequestRoutes = require('./src/routes/accessRequests');

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(UPLOAD_ROOT));

app.use('/api/auth', authRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/staff',    staffRoutes);
app.use('/api/classify', classifyRoutes);
app.use('/api/access-requests', accessRequestRoutes);

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

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`CIVIX server running on port ${PORT}`));

// Give reports filed before deadlines existed a resolve-by date.
require('./src/utils/deadline').backfillDeadlines()
  .then(n => { if (n) console.log(`[deadlines] Added deadlines to ${n} existing report(s).`); })
  .catch(err => console.error('[deadlines] Backfill failed:', err.message));
