const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../utils/cloudinary');

// The saved file's extension comes from its checked type, never from the sender's
// file name: a file named page.html must not be saved (and served) as a web page.
const extensionFor = file => (file.mimetype === 'image/png' ? '.png' : '.jpg');

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/jpg'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(Object.assign(new Error('Only JPG and PNG photos are allowed.'), { status: 400, code: 'BAD_PHOTO' }), false);
};

let storage, avatarStorage, brandingStorage;

if (cloudinary.configured) {
  storage = new CloudinaryStorage({
    cloudinary: cloudinary.instance,
    params: { folder: 'civix/submissions', allowed_formats: ['jpg', 'jpeg', 'png'] },
  });
  avatarStorage = new CloudinaryStorage({
    cloudinary: cloudinary.instance,
    params: { folder: 'civix/avatars', allowed_formats: ['jpg', 'jpeg', 'png'] },
  });
  brandingStorage = new CloudinaryStorage({
    cloudinary: cloudinary.instance,
    params: { folder: 'civix/branding', allowed_formats: ['jpg', 'jpeg', 'png'] },
  });
} else {
  console.warn('[upload] Cloudinary not configured — falling back to local disk storage (uploads/).');
  const uploadDir = require('../utils/uploadRoot');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${extensionFor(file)}`);
    },
  });

  const avatarDir = path.join(uploadDir, 'avatars');
  if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });
  avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, avatarDir),
    filename: (req, file, cb) => cb(null, `avatar-${req.user.id}-${Date.now()}.jpg`),
  });

  // Seal and homepage photo; the file name starts with the kind (seal / hero).
  const brandingDir = path.join(uploadDir, 'branding');
  if (!fs.existsSync(brandingDir)) fs.mkdirSync(brandingDir, { recursive: true });
  brandingStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, brandingDir),
    filename: (req, file, cb) => cb(null, `${req.params.kind}-${Date.now()}${file.mimetype === 'image/png' ? '.png' : '.jpg'}`),
  });
}

// Report photos: up to 5 of 5 MB each, and a few small text fields (the longest is
// the description, at most 2,000 characters). Anything bigger is refused before
// it fills memory or disk.
const PHOTO_LIMITS = { fileSize: 5 * 1024 * 1024, files: 5, fields: 30, fieldSize: 16 * 1024, parts: 40 };
const ONE_IMAGE = { fileSize: 5 * 1024 * 1024, files: 1, fields: 10, fieldSize: 4 * 1024 };

const upload = multer({ storage, fileFilter, limits: PHOTO_LIMITS });
const avatarUpload = multer({ storage: avatarStorage, fileFilter, limits: ONE_IMAGE });
const brandingUpload = multer({ storage: brandingStorage, fileFilter, limits: ONE_IMAGE });

module.exports = { upload, avatarUpload, brandingUpload };
