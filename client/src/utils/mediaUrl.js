function resolveServer() {
  if (process.env.REACT_APP_SERVER_URL) return process.env.REACT_APP_SERVER_URL;
  if (process.env.NODE_ENV === 'development') return 'http://localhost:5000';
  return '';
}

const SERVER = resolveServer();

export function mediaUrl(path) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${SERVER}${path}`;
}
