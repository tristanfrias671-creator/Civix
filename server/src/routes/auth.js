const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { avatarUpload } = require('../middleware/upload');
const { limitRequests, limitFailures } = require('../utils/rateLimit');
const { requireRealPhotos } = require('../utils/uploadSafety');
const {
  login, googleLogin, registerStaff, sendStaffCode, checkPortalPath, getMe, updateProfile, changePassword, uploadAvatar,
  sendResetCode, resetPassword, getSignIns, getMySignIns, verifySignInCode, resendSignInCode,
} = require('../controllers/auth');

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

// Forgot password: code requests and reset tries per network (each code also allows
// only 5 wrong tries, and each email a few codes an hour).
const resets = limitRequests({
  windowMs: 15 * 60 * 1000, max: 30,
  message: wait => `Too many password reset tries from this network. Please try again in ${wait}.`,
});

router.post('/login', signIns, login);
// Administrators with sign-in codes on finish here with the emailed code.
router.post('/login/code', signIns, verifySignInCode);
router.post('/login/code/resend', resets, resendSignInCode);
router.post('/google', signIns, googleLogin);
router.post('/staff-register/code', sendStaffCode);
router.post('/staff-register', staffRequests, registerStaff);
router.post('/portal', portalChecks, checkPortalPath);
router.post('/password-reset/code', resets, sendResetCode);
router.post('/password-reset', resets, resetPassword);
router.get('/sign-ins', authenticate, requireAdmin, getSignIns);
router.get('/my-sign-ins', authenticate, getMySignIns);
router.get('/me', authenticate, getMe);
router.patch('/profile', authenticate, updateProfile);
router.patch('/password', authenticate, changePassword);
router.post('/avatar', authenticate, avatarUpload.single('avatar'), requireRealPhotos, uploadAvatar);

module.exports = router;
