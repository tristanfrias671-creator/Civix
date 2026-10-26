import React, { useCallback, useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import Icon from '../../components/common/Icons';
import Avatar from '../../components/common/Avatar';
import SignOutDialog from '../../components/common/SignOutDialog';
import ProfileModal from '../../components/common/ProfileModal';
import IdleSessionGuard from '../../components/common/IdleSessionGuard';
import AdminNotificationBell, { openAlerts } from '../../components/common/AdminNotificationBell';
import { announceNewAlerts } from '../../components/common/alerts';
import { BrandImg } from '../../context/BrandingContext';
import api from '../../utils/api';

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { to: '/admin/dashboard', label: 'Dashboard', icon: 'dashboard' },
    ],
  },
  {
    label: 'Submissions',
    items: [
      { to: '/admin/submissions', label: 'All Submissions', icon: 'submissions' },
      { to: '/admin/complaints', label: 'Complaints', icon: 'complaint' },
      { to: '/admin/suggestions', label: 'Suggestions', icon: 'suggestion' },
      { to: '/admin/feedback', label: 'Feedback', icon: 'feedback' },
      { to: '/admin/map', label: 'Map View', icon: 'map' },
      { to: '/admin/analytics', label: 'Analytics', icon: 'analytics' },
    ],
  },
  {
    label: 'Management',
    items: [
      { to: '/admin/staff',             label: 'Personnel',    icon: 'citizens'  },
      { to: '/admin/access-requests',   label: 'Access Requests', icon: 'lock'   },
      { to: '/admin/ai-classification', label: 'AI Review',    icon: 'ai'        },
      { to: '/admin/audit-log',         label: 'Audit Log',    icon: 'auditlog'  },
      { to: '/admin/settings',          label: 'Settings',     icon: 'settings'  },
    ],
  },
];

const navItems = NAV_SECTIONS.flatMap(s => s.items);

// Admin pop-ups: urgent and overdue reports, and new access requests.
const ADMIN_ALERT_KINDS = {
  urgent: {
    noun: 'urgent report',
    describe: item => <>Urgent report <strong>{item.trackingId}</strong> ({item.department}) needs attention.</>,
  },
  overdue: {
    noun: 'overdue report',
    describe: item => <><strong>{item.trackingId}</strong> ({item.department}) is now overdue.</>,
  },
  accessRequests: {
    noun: 'access request',
    describe: r => <><strong>{r.fullName}</strong> {r.type === 'ADMIN_ACCESS' ? 'requested administrator access' : 'requested a staff account'}.</>,
  },
};

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { dark, toggle: toggleDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [profileOpen,  setProfileOpen]  = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const closeSignOut = useCallback(() => setConfirmSignOut(false), []);
  const [topSearch, setTopSearch] = useState('');
  const [alerts, setAlerts] = useState(null);
  const pendingRequests = alerts?.accessRequests?.length || 0;

  // What needs attention (urgent, overdue and due-soon reports; pending access
  // requests), refreshed every 30 seconds and on each page change. Items that newly
  // appear pop up an alert once per browser session.
  useEffect(() => {
    let active = true;
    const load = () => api.get('/analytics/alerts')
      .then(res => {
        if (!active) return;
        setAlerts(res.data);
        announceNewAlerts(res.data, ADMIN_ALERT_KINDS, openAlerts);
      })
      .catch(() => {});
    load();
    const timer = setInterval(load, 30000);
    window.addEventListener('civix:access-requests-changed', load);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('civix:access-requests-changed', load);
    };
  }, [location.pathname]);

  const isMapPage = location.pathname.startsWith('/admin/map');
  const activeItem = navItems.find(i => i.to === '/admin/dashboard'
    ? location.pathname === i.to
    : location.pathname.startsWith(i.to));

  function handleLogout() {
    setConfirmSignOut(false);
    logout();
    navigate('/');
  }

  function handleTopSearch(e) {
    e.preventDefault();
    if (!topSearch.trim()) return;
    navigate('/admin/submissions', { state: { search: topSearch.trim() } });
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: dark ? '#0f172a' : '#f1f5f9' }}>
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-30 w-64 flex flex-col transform transition-transform duration-200 md:relative md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: 'linear-gradient(180deg, #0b2f66 0%, #081d40 100%)' }}>
        <div className="flex items-center gap-3 px-5 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <BrandImg kind="seal" alt="Municipality of Cantilan" className="w-10 h-10 object-contain flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-white font-extrabold text-sm leading-tight truncate">CIVIX</p>
            <p className="text-white/70 text-[11px] font-medium leading-tight truncate">Administrator Portal</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto scrollbar-none">
          {NAV_SECTIONS.map(section => (
            <div key={section.label} className="mb-4">
              <p className="px-3 mb-1.5 text-[11px] font-bold uppercase tracking-widest text-white/60">{section.label}</p>
              {section.items.map(item => (
                <NavLink key={item.to} to={item.to} end={item.to === '/admin/dashboard'}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `relative flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm font-medium transition-colors ${
                      isActive ? 'text-white' : 'text-white/75 hover:bg-white/5 hover:text-white'
                    }`
                  }
                  style={({ isActive }) => isActive ? { background: 'rgba(37,99,235,0.9)' } : undefined}>
                  {({ isActive }) => (
                    <>
                      {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full bg-white/80" />}
                      <Icon name={item.icon} className="w-5 h-5 flex-shrink-0" />
                      {item.label}
                      {item.to === '/admin/access-requests' && pendingRequests > 0 && (
                        <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center text-[11px] font-bold text-white bg-red-600"
                          aria-label={`${pendingRequests} pending`}>
                          {pendingRequests > 9 ? '9+' : pendingRequests}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="px-4 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={() => setProfileOpen(true)}
            className="flex items-center gap-3 mb-1 w-full text-left hover:bg-white/5 rounded-lg p-1.5 -ml-1.5 transition-colors group">
            <Avatar user={user} className="w-9 h-9" imgClassName="ring-2 ring-white/20 group-hover:ring-blue-400 transition-all" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-white leading-tight truncate">{user?.fullName}</p>
              <p className="text-xs text-white/70 group-hover:text-white/90">Administrator · Edit Profile</p>
            </div>
          </button>
          <button onClick={() => setConfirmSignOut(true)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/75 hover:text-red-200 hover:bg-white/5 rounded-lg transition-colors">
            <Icon name="logout" className="w-5 h-5" /> Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="bg-white border-b border-gray-200 flex items-center px-4 py-3 md:hidden"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <button onClick={() => setSidebarOpen(true)} aria-label="Open menu" className="p-2 text-gray-600 hover:text-gray-800 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2 ml-3">
            <BrandImg kind="seal" className="w-6 h-6 object-contain" />
            <span className="font-extrabold text-gray-900 text-sm">CIVIX</span>
            <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">Admin</span>
          </div>
          <div className="ml-auto flex items-center gap-0.5">
            <button onClick={toggleDark} aria-label={dark ? 'Light mode' : 'Dark mode'}
              className="p-2 rounded-lg transition-colors" style={{ color: dark ? '#94a3b8' : '#4b5563' }}>
              {dark ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <circle cx="12" cy="12" r="5"/>
                  <path strokeLinecap="round" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
                </svg>
              )}
            </button>
            <AdminNotificationBell alerts={alerts} dark={dark} />
          </div>
        </header>

        {/* Desktop topbar */}
        <header className="hidden md:flex items-center gap-4 px-6 h-16 flex-shrink-0"
          style={{ background: dark ? '#1e293b' : 'white', borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : '#e5e7eb'}` }}>
          <div className="min-w-0">
            <p className="text-xs font-medium" style={{ color: dark ? '#94a3b8' : '#4b5563' }}>Admin</p>
            <h2 className="text-sm font-bold truncate" style={{ color: dark ? '#f1f5f9' : '#111827' }}>{activeItem?.label || 'Dashboard'}</h2>
          </div>

          <form onSubmit={handleTopSearch} className="hidden lg:block flex-1 max-w-sm ml-4">
            <div className="relative">
              <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: dark ? '#94a3b8' : '#4b5563' }}
                fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <input value={topSearch} onChange={e => setTopSearch(e.target.value)}
                placeholder="Search submissions, transaction code..."
                className="w-full pl-10 pr-3 py-2 rounded-lg text-sm outline-none transition-all placeholder:text-gray-500 dark:placeholder:!text-slate-400 focus:ring-2 focus:ring-blue-500"
                style={{
                  background: dark ? '#0f172a' : '#f3f4f6',
                  color: dark ? '#e2e8f0' : '#111827',
                  border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'transparent'}`,
                }} />
            </div>
          </form>

          <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
            <AdminNotificationBell alerts={alerts} dark={dark} />
            <button onClick={toggleDark}
              className="p-2 rounded-lg transition-colors"
              style={{ color: dark ? '#94a3b8' : '#4b5563' }}
              onMouseEnter={e => e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.06)' : '#f3f4f6'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              title={dark ? 'Light Mode' : 'Dark Mode'}>
              {dark ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <circle cx="12" cy="12" r="5"/>
                  <path strokeLinecap="round" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
                </svg>
              )}
            </button>
            <button onClick={() => setProfileOpen(true)} className="flex items-center gap-2 pl-2 ml-1" style={{ borderLeft: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}` }}>
              <Avatar user={user} className="w-8 h-8" letterClassName="text-xs" />
            </button>
          </div>
        </header>

        {/* The map page fills the height; it still scrolls if the screen is too short. */}
        <main className={`flex-1 min-h-0 overflow-y-auto ${isMapPage ? 'flex flex-col' : ''}`}>
          <Outlet key={location.key} />
        </main>
      </div>

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
      <SignOutDialog open={confirmSignOut} user={user} roleLabel="Administrator"
        message="You'll need your private admin link to sign in again."
        onCancel={closeSignOut} onConfirm={handleLogout} />
      <IdleSessionGuard loginPath="/" />
    </div>
  );
}
