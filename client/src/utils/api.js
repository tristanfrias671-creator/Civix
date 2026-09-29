import axios from 'axios';

// Same-origin by default: in development the CRA dev server proxies /api to the
// backend (see "proxy" in package.json), so the app also works when opened from
// a phone on the local network.
function resolveApiBase() {
  return process.env.REACT_APP_API_URL || '/api';
}

const api = axios.create({
  baseURL: resolveApiBase(),
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('civix_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    const isAuthRoute = err.config?.url?.includes('/auth/');
    if (err.response?.status === 401 && !isAuthRoute) {
      localStorage.removeItem('civix_token');
      localStorage.removeItem('civix_user');
      const path = window.location.pathname;
      // The admin sign-in page is private, so admins go back to the homepage.
      window.location.href = path.startsWith('/staff') ? '/staff-login' : '/';
    }
    if (!err.response) {
      err.message = 'Cannot reach the server. Start the backend (port 5000) and try again.';
    }
    return Promise.reject(err);
  }
);

export default api;
