import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

// Last time the signed-in user did something; read by IdleSessionGuard.
export const ACTIVITY_KEY = 'civix_last_activity';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('civix_user');
    const token = localStorage.getItem('civix_token');
    if (stored && token) {
      try { setUser(JSON.parse(stored)); } catch { /* ignore */ }
    }
    setLoading(false);
  }, []);

  function login(token, userData) {
    localStorage.setItem('civix_token', token);
    localStorage.setItem('civix_user', JSON.stringify(userData));
    localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
    setUser(userData);
  }

  function logout() {
    localStorage.removeItem('civix_token');
    localStorage.removeItem('civix_user');
    localStorage.removeItem(ACTIVITY_KEY);
    // Alerts already shown this session (admin bell); the next sign-in starts fresh.
    try { sessionStorage.removeItem('civix_seen_alerts'); } catch { /* storage unavailable */ }
    setUser(null);
  }

  function updateUser(userData, token) {
    if (token) localStorage.setItem('civix_token', token);
    localStorage.setItem('civix_user', JSON.stringify(userData));
    setUser(userData);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
