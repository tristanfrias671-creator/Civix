// Same-origin by default; uploads are proxied to the backend in development.
function resolveServer() {
  return process.env.REACT_APP_SERVER_URL || '';
}

const SERVER = resolveServer();

export function mediaUrl(path) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${SERVER}${path}`;
}
