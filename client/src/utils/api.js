import axios from 'axios';
import { tokenForPage, portalOf, clearSession } from './session';

// Same-origin by default: in development the CRA dev server proxies /api to the
// backend (see "proxy" in package.json), so the app also works when opened from
// a phone on the local network.
function resolveApiBase() {
  return process.env.REACT_APP_API_URL || '/api';
}

const api = axios.create({
  baseURL: resolveApiBase(),
});

// Admin pages send the admin's sign-in, staff pages the staff member's (each
// portal has its own, see utils/session.js).
api.interceptors.request.use(config => {
  const token = tokenForPage();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    const isAuthRoute = err.config?.url?.includes('/auth/');
    if (err.response?.status === 401 && !isAuthRoute) {
      // Only this portal's sign-in has ended; the other portal stays signed in.
      clearSession(portalOf());
      const path = window.location.pathname;
      // Staff sign in again and come back to this page; the admin sign-in page is
      // private, so admins go back to the homepage.
      window.location.href = path.startsWith('/staff')
        ? `/staff-login?next=${encodeURIComponent(path + window.location.search)}` : '/';
    }
    if (!err.response) {
      err.message = 'Cannot reach the server. Start the backend (port 5000) and try again.';
    }
    return Promise.reject(err);
  }
);

export default api;
