require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./src/routes/auth');
const submissionRoutes = require('./src/routes/submissions');
const notificationRoutes = require('./src/routes/notifications');
const analyticsRoutes = require('./src/routes/analytics');
const reportRoutes = require('./src/routes/reports');
const settingsRoutes = require('./src/routes/settings');
const staffRoutes    = require('./src/routes/staff');
const classifyRoutes = require('./src/routes/classify');

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/staff',    staffRoutes);
app.use('/api/classify', classifyRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`CIVIX server running on port ${PORT}`));
