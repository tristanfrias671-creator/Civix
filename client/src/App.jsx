import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';

import RoleSelect from './pages/RoleSelect';
import PortalLoginSelect from './pages/PortalLoginSelect';
import Login from './pages/citizen/Login';
import Submit from './pages/citizen/Submit';
import Track from './pages/citizen/Track';

import AdminLayout    from './pages/admin/AdminLayout';
import StaffLayout    from './pages/staff/StaffLayout';
import StaffDashboard       from './pages/staff/Dashboard';
import StaffSubmissions     from './pages/staff/Submissions';
import StaffMonitor         from './pages/staff/Monitor';
import StaffNotifications   from './pages/staff/Notifications';
import AdminDashboard from './pages/admin/Dashboard';
import AdminSubmissions from './pages/admin/Submissions';
import SubmissionDetail from './pages/admin/SubmissionDetail';
import MapView from './pages/admin/MapView';
import Analytics from './pages/admin/Analytics';
import Staff    from './pages/admin/Staff';
import Settings from './pages/admin/Settings';
import AIClassification from './pages/admin/AIClassification';
import AuditLog from './pages/admin/AuditLog';

function homeFor(role) {
  if (role === 'ADMIN') return '/admin/dashboard';
  if (role === 'STAFF') return '/staff/dashboard';
  return '/submit';
}

function PrivateRoute({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div></div>;
  if (!user) return <Navigate to="/" replace />;
  if (role && user.role !== role) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      {/* Landing page */}
      <Route path="/" element={user ? <Navigate to={homeFor(user.role)} replace /> : <RoleSelect />} />
      <Route path="/admin-login" element={<Login role="ADMIN" />} />
      <Route path="/staff-login" element={<Login role="STAFF" />} />
      <Route path="/portal-login" element={<PortalLoginSelect />} />
      <Route path="/login" element={<Login />} />

      {/* Public citizen routes — no auth required */}
      <Route path="/submit" element={<Submit />} />
      <Route path="/track" element={<Track />} />

      {/* Admin portal */}
      <Route path="/admin" element={<PrivateRoute role="ADMIN"><AdminLayout /></PrivateRoute>}>
        <Route path="dashboard"        element={<AdminDashboard />} />
        <Route path="submissions"      element={<AdminSubmissions />} />
        <Route path="submissions/:id"  element={<SubmissionDetail />} />
        <Route path="complaints"       element={<AdminSubmissions type="COMPLAINT" />} />
        <Route path="suggestions"      element={<AdminSubmissions type="SUGGESTION" />} />
        <Route path="feedback"         element={<AdminSubmissions type="FEEDBACK" />} />
        <Route path="map"              element={<MapView />} />
        <Route path="analytics"        element={<Analytics />} />
        <Route path="staff"            element={<Staff />} />
        <Route path="ai-classification" element={<AIClassification />} />
        <Route path="audit-log"        element={<AuditLog />} />
        <Route path="settings"         element={<Settings />} />
        <Route index element={<Navigate to="dashboard" replace />} />
      </Route>

      {/* Staff portal */}
      <Route path="/staff" element={<PrivateRoute role="STAFF"><StaffLayout /></PrivateRoute>}>
        <Route path="dashboard"     element={<StaffDashboard />} />
        <Route path="submissions"   element={<StaffSubmissions />} />
        <Route path="monitor"       element={<StaffMonitor />} />
        <Route path="notifications" element={<StaffNotifications />} />
        <Route index element={<Navigate to="dashboard" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function ToastIcon({ color, glow, path }) {
  return (
    <span style={{
      width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `linear-gradient(135deg, ${color}, ${color}cc)`,
      boxShadow: `0 3px 10px ${glow}`,
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
      </svg>
    </span>
  );
}

function AppToaster() {
  const { dark } = useTheme();
  const color = dark ? '#f1f5f9' : '#1f2937';
  const border = dark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.06)';
  const baseStyle = {
    background: dark ? 'rgba(30,41,59,0.82)' : 'rgba(255,255,255,0.86)',
    backdropFilter: 'blur(16px) saturate(160%)',
    WebkitBackdropFilter: 'blur(16px) saturate(160%)',
    color,
    borderRadius: '16px',
    padding: '13px 18px 13px 14px',
    fontSize: '13.5px',
    fontWeight: 500,
    letterSpacing: '0.1px',
    border: `1px solid ${border}`,
    maxWidth: '380px',
  };
  const glowShadow = (rgb) => `0 12px 32px -6px rgba(${rgb},0.35), 0 4px 12px rgba(15,23,42,0.10), inset 0 1px 0 rgba(255,255,255,${dark ? 0.06 : 0.5})`;

  return (
    <Toaster
      position="top-right"
      gutter={10}
      toastOptions={{
        duration: 4000,
        style: { ...baseStyle, boxShadow: glowShadow('37,99,235') },
        success: {
          duration: 3200,
          icon: <ToastIcon color="#16a34a" glow="rgba(22,163,74,0.45)" path="M5 13l4 4L19 7" />,
          style: { ...baseStyle, boxShadow: glowShadow('22,163,74') },
        },
        error: {
          duration: 5000,
          icon: <ToastIcon color="#dc2626" glow="rgba(220,38,38,0.45)" path="M6 18L18 6M6 6l12 12" />,
          style: { ...baseStyle, boxShadow: glowShadow('220,38,38') },
        },
        loading: {
          iconTheme: { primary: '#2563eb', secondary: dark ? '#1e293b' : '#ffffff' },
          style: { ...baseStyle, boxShadow: glowShadow('37,99,235') },
        },
      }}
    />
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <AppToaster />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
