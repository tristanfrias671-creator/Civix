const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { avatarUpload } = require('../middleware/upload');
const { limitRequests, limitFailures } = require('../utils/rateLimit');
const { requireRealPhotos } = require('../utils/uploadSafety');
const { login, googleLogin, registerStaff, sendStaffCode, checkPortalPath, getMe, updateProfile, changePassword, uploadAvatar } = require('../controllers/auth');

// Failed sign-ins per network, on top of each account's own lockout. Successful
// sign-ins don't count, so a whole office signing in at once is never held up.
const signIns = limitFailures({
  windowMs: 15 * 60 * 1000, max: 30,
  message: wait => `Too many failed sign-in attempts from this network. Please try again in ${wait}.`,
});
const portalChecks = limitRequests({ windowMs: 60 * 1000, max: 30 });
const staffRequests = limitRequests({
  windowMs: 60 * 60 * 1000, max: 20,
  message: wait => `Too many account requests from this network. Please try again in ${wait}.`,
});

router.post('/login', signIns, login);
router.post('/google', signIns, googleLogin);
router.post('/staff-register/code', sendStaffCode);
router.post('/staff-register', staffRequests, registerStaff);
router.post('/portal', portalChecks, checkPortalPath);
router.get('/me', authenticate, getMe);
router.patch('/profile', authenticate, updateProfile);
router.patch('/password', authenticate, changePassword);
router.post('/avatar', authenticate, avatarUpload.single('avatar'), requireRealPhotos, uploadAvatar);

module.exports = router;
