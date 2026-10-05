const fs = require('fs');

// What a real photo file starts with. The browser's "image/jpeg" label and the
// file name come from the sender and can be faked; the first bytes can't be,
// short of making a real image.
const SIGNATURES = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/jpg':  [0xff, 0xd8, 0xff],
  'image/png':  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
};

const isLocal = file => file?.path && !/^https?:\/\//.test(file.path);

// Deletes the photos saved for this request (local disk only; Cloudinary uploads
// are left alone), e.g. when the report is refused, so refused reports don't fill
// the disk.
function discardUploads(req) {
  for (const file of req.files || (req.file ? [req.file] : [])) {
    if (isLocal(file)) fs.unlink(file.path, () => {});
  }
}

async function startsLike(file) {
  const expected = SIGNATURES[file.mimetype];
  if (!expected) return false;
  const handle = await fs.promises.open(file.path, 'r');
  try {
    const { bytesRead, buffer } = await handle.read(Buffer.alloc(expected.length), 0, expected.length, 0);
    return bytesRead === expected.length && expected.every((byte, i) => buffer[i] === byte);
  } finally {
    await handle.close();
  }
}

// Middleware after multer: every saved photo must really be a JPG or PNG.
// Otherwise all of this request's photos are deleted and the report is refused.
async function requireRealPhotos(req, res, next) {
  const files = (req.files || (req.file ? [req.file] : [])).filter(isLocal);
  try {
    for (const file of files) {
      if (!(await startsLike(file))) {
        discardUploads(req);
        req.releaseFormTicket?.();
        return res.status(400).json({ error: 'Each photo must be a real JPG or PNG picture. Please choose a different photo.', code: 'BAD_PHOTO' });
      }
    }
    next();
  } catch (err) {
    discardUploads(req);
    req.releaseFormTicket?.();
    next(err);
  }
}

// Middleware before multer: refuses a request whose size is already too big
// (more than `maxBytes`) before anything is saved.
function refuseLargeBodies(maxBytes, message) {
  return (req, res, next) => {
    const size = Number(req.get('Content-Length'));
    if (size > maxBytes) {
      req.releaseFormTicket?.();
      return res.status(413).json({ error: message, code: 'TOO_LARGE' });
    }
    next();
  };
}

// Photo storage for the whole site per day (PHOTO_MB_PER_DAY, default 2 GB), so a
// flood of reports can't fill the server's disk. Counted when a report is saved.
const DAY_MS = 24 * 60 * 60 * 1000;
const PHOTO_BYTES_PER_DAY = (Number(process.env.PHOTO_MB_PER_DAY) || 2048) * 1024 * 1024;
let photoDay = { start: 0, bytes: 0 };

function currentPhotoDay(now) {
  if (now - photoDay.start >= DAY_MS) photoDay = { start: now, bytes: 0 };
  return photoDay;
}

const photoBytes = req => (req.files || []).reduce((sum, file) => sum + (Number(file.size) || 0), 0);

const photoBudget = {
  fits: (bytes, now = Date.now()) => currentPhotoDay(now).bytes + bytes <= PHOTO_BYTES_PER_DAY,
  use: (bytes, now = Date.now()) => { currentPhotoDay(now).bytes += bytes; },
};

module.exports = { discardUploads, requireRealPhotos, refuseLargeBodies, photoBytes, photoBudget };
