const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../utils/cloudinary');

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/jpg'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Only JPG and PNG images are allowed'), false);
};

let storage, avatarStorage;

if (cloudinary.configured) {
  storage = new CloudinaryStorage({
    cloudinary: cloudinary.instance,
    params: { folder: 'civix/submissions', allowed_formats: ['jpg', 'jpeg', 'png'] },
  });
  avatarStorage = new CloudinaryStorage({
    cloudinary: cloudinary.instance,
    params: { folder: 'civix/avatars', allowed_formats: ['jpg', 'jpeg', 'png'] },
  });
} else {
  console.warn('[upload] Cloudinary not configured — falling back to local disk storage (uploads/).');
  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${path.extname(file.originalname)}`);
    },
  });

  const avatarDir = path.join(uploadDir, 'avatars');
  if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });
  avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, avatarDir),
    filename: (req, file, cb) => cb(null, `avatar-${req.user.id}-${Date.now()}.jpg`),
  });
}

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });
const avatarUpload = multer({ storage: avatarStorage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

module.exports = { upload, avatarUpload };
