const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { brandingUpload } = require('../middleware/upload');
const { requireRealPhotos } = require('../utils/uploadSafety');
const {
  BRANDING_FIELDS,
  getPublicProfile,
  getSettings,
  updateSystemProfile,
  updateLists,
  updateSecurity,
  getLockedAccounts,
  unlockAccount,
  getSessionPolicy,
  uploadBranding,
  resetBranding,
  getAdminLink,
  rotateAdminLink,
  updateDeadlines,
} = require('../controllers/settings');
const { startCodeSetting, setCodeSetting } = require('../controllers/auth');

// Rejects unknown kinds before anything is written to disk.
function brandingKind(req, res, next) {
  if (!BRANDING_FIELDS[req.params.kind]) return res.status(404).json({ error: 'Unknown image type' });
  next();
}

// Turns multer errors (wrong type, too large) into a JSON 400.
function brandingFile(req, res, next) {
  brandingUpload.single('image')(req, res, err => {
    if (!err) return next();
    const error = err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5 MB or smaller' : err.message;
    res.status(400).json({ error });
  });
}

router.get('/public', getPublicProfile);
router.get('/session', authenticate, getSessionPolicy);

router.use(authenticate, requireAdmin);
router.get('/', getSettings);
router.patch('/system', updateSystemProfile);
router.patch('/lists', updateLists);
router.patch('/security', updateSecurity);
router.patch('/deadlines', updateDeadlines);
router.get('/security/locked', getLockedAccounts);
router.post('/security/unlock/:id', unlockAccount);
// Sign-in codes for administrators: turning them on needs a code from your email.
router.post('/security/sign-in-code/start', startCodeSetting);
router.post('/security/sign-in-code', setCodeSetting);
router.post('/branding/:kind', brandingKind, brandingFile, requireRealPhotos, uploadBranding);
router.delete('/branding/:kind', brandingKind, resetBranding);
router.get('/admin-link', getAdminLink);
router.post('/admin-link/rotate', rotateAdminLink);

module.exports = router;
