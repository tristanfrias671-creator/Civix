const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { avatarUpload } = require('../middleware/upload');
const { login, googleLogin, getMe, updateProfile, changePassword, uploadAvatar } = require('../controllers/auth');

router.post('/login', login);
router.post('/google', googleLogin);
router.get('/me', authenticate, getMe);
router.patch('/profile', authenticate, updateProfile);
router.patch('/password', authenticate, changePassword);
router.post('/avatar', authenticate, avatarUpload.single('avatar'), uploadAvatar);

module.exports = router;
