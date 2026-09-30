const path = require('path');

// Folder for uploaded photos (reports, profile pictures, seal and homepage photo).
// UPLOAD_DIR may be absolute (recommended on a host, so redeploying the app doesn't
// wipe the photos) or relative to the server folder. Defaults to server/uploads.
module.exports = path.resolve(__dirname, '../..', process.env.UPLOAD_DIR || 'uploads');
