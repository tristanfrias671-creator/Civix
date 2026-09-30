const fs = require('fs');
const path = require('path');

const UPLOAD_ROOT = require('./uploadRoot');
// The built website (client/build) when deployed, the source files (client/public) locally.
const DEFAULT_SEAL = ['build', 'public']
  .map(dir => path.join(__dirname, '../../../client', dir, 'cantilan-seal.png'))
  .find(file => fs.existsSync(file)) || '';

// Disk path of a locally stored branding image (/uploads/branding/<file>), else null.
function localBrandingPath(url) {
  if (!url || !url.startsWith('/uploads/branding/')) return null;
  return path.join(UPLOAD_ROOT, 'branding', path.basename(url));
}

function removeBrandingFile(url) {
  const file = localBrandingPath(url);
  if (file) fs.unlink(file, () => {});
}

function toImage(buffer) {
  // Uploads are limited to PNG and JPEG; PNG files start with 0x89 'P'.
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50;
  return { buffer, extension: isPng ? 'png' : 'jpeg' };
}

// The seal for PDF/Excel exports as { buffer, extension }: the uploaded seal if
// there is one, otherwise the bundled default. null if neither can be read.
async function loadSealImage(sealUrl) {
  try {
    if (sealUrl && sealUrl.startsWith('http')) {
      const res = await fetch(sealUrl);
      if (res.ok) return toImage(Buffer.from(await res.arrayBuffer()));
    } else if (localBrandingPath(sealUrl)) {
      return toImage(await fs.promises.readFile(localBrandingPath(sealUrl)));
    }
  } catch (err) {
    console.warn('[branding] Could not load the uploaded seal, using the default:', err.message);
  }
  try {
    return toImage(await fs.promises.readFile(DEFAULT_SEAL));
  } catch {
    return null;
  }
}

module.exports = { removeBrandingFile, loadSealImage };
