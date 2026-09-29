const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { avatarUpload } = require('../middleware/upload');
const { login, googleLogin, registerStaff, checkPortalPath, getMe, updateProfile, changePassword, uploadAvatar } = require('../controllers/auth');

router.post('/login', login);
router.post('/google', googleLogin);
router.post('/staff-register', registerStaff);
router.post('/portal', checkPortalPath);
router.get('/me', authenticate, getMe);
router.patch('/profile', authenticate, updateProfile);
router.patch('/password', authenticate, changePassword);
router.post('/avatar', authenticate, avatarUpload.single('avatar'), uploadAvatar);

module.exports = router;
