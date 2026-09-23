import axios from 'axios';

function resolveApiBase() {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
  if (process.env.NODE_ENV === 'development') return 'http://localhost:5000/api';
  return '/api';
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
      window.location.href = '/login';
    }
    if (!err.response) {
      err.message = 'Cannot reach the server. Start the backend (port 5000) and try again.';
    }
    return Promise.reject(err);
  }
);

export default api;
