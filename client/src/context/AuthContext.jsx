import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  PORTALS, portalOf, portalOfRole, getSession, saveSession, clearSession, activityKey, isSessionKey,
} from '../utils/session';

const AuthContext = createContext(null);

// The signed-in user of each portal ({ ADMIN, STAFF }), from this browser's storage.
const readUsers = () => Object.fromEntries(PORTALS.map(p => [p, getSession(p)?.user || null]));

// `user` is the signed-in user of the portal the current page belongs to: the
// administrator on admin pages, the staff member on staff pages, nobody elsewhere.
// Signing in or out only touches that portal, so an admin and a staff sign-in can
// share one browser (see utils/session.js).
export function AuthProvider({ children }) {
  const { pathname } = useLocation();
  const [users, setUsers] = useState(readUsers);

  // Signed in or out in another tab. (A sign-in saved by the old version is moved
  // only when a page opens: moving it here could catch it half written.)
  useEffect(() => {
    const onStorage = e => {
      if (e.key !== null && !isSessionKey(e.key)) return;
      setUsers(readUsers());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const login = useCallback((token, userData) => {
    const portal = portalOfRole(userData?.role);
    if (!portal) return;
    saveSession(portal, token, userData);
    try { localStorage.setItem(activityKey(portal), String(Date.now())); } catch { /* storage unavailable */ }
    setUsers(readUsers());
  }, []);

  // Signs out of the current page's portal (or the one given) only.
  const logout = useCallback((portal = portalOf()) => {
    clearSession(portal);
    // Alerts already shown this session (admin bell); the next sign-in starts fresh.
    try { sessionStorage.removeItem('civix_seen_alerts'); } catch { /* storage unavailable */ }
    setUsers(readUsers());
  }, []);

  const updateUser = useCallback((userData, token) => {
    saveSession(portalOfRole(userData?.role) || portalOf(), token, userData);
    setUsers(readUsers());
  }, []);

  const portal = portalOf(pathname);
  return (
    <AuthContext.Provider value={{ user: portal ? users[portal] : null, users, login, logout, updateUser, loading: false }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
