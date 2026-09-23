import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import Icon from '../../components/common/Icons';
import ProfileModal from '../../components/common/ProfileModal';
import { mediaUrl } from '../../utils/mediaUrl';

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
      { to: '/admin/ai-classification', label: 'AI Review',    icon: 'ai'        },
      { to: '/admin/audit-log',         label: 'Audit Log',    icon: 'auditlog'  },
      { to: '/admin/settings',          label: 'Settings',     icon: 'settings'  },
    ],
  },
];

const navItems = NAV_SECTIONS.flatMap(s => s.items);

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { dark, toggle: toggleDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [profileOpen,  setProfileOpen]  = useState(false);
  const [topSearch, setTopSearch] = useState('');
  const isMapPage = location.pathname.startsWith('/admin/map');
  const activeItem = navItems.find(i => i.to === '/admin/dashboard'
    ? location.pathname === i.to
    : location.pathname.startsWith(i.to));

  function handleLogout() {
    logout();
    navigate('/admin-login');
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
          <img src="/cantilan-seal.png" alt="Municipality of Cantilan" className="w-10 h-10 object-contain flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-white font-extrabold text-sm leading-tight truncate">CIVIX</p>
            <p className="text-white/50 text-[11px] font-medium leading-tight truncate">Administrator Portal</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto scrollbar-none">
          {NAV_SECTIONS.map(section => (
            <div key={section.label} className="mb-4">
              <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-white/30">{section.label}</p>
              {section.items.map(item => (
                <NavLink key={item.to} to={item.to} end={item.to === '/admin/dashboard'}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `relative flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm font-medium transition-colors ${
                      isActive ? 'text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
                    }`
                  }
                  style={({ isActive }) => isActive ? { background: 'rgba(37,99,235,0.9)' } : undefined}>
                  {({ isActive }) => (
                    <>
                      {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full bg-white/80" />}
                      <Icon name={item.icon} className="w-5 h-5 flex-shrink-0" />
                      {item.label}
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
            {user?.avatar
              ? <img src={mediaUrl(user.avatar)} alt="avatar" className="w-9 h-9 rounded-full object-cover flex-shrink-0 ring-2 ring-white/20 group-hover:ring-blue-400 transition-all" />
              : <div className="w-9 h-9 rounded-full text-white flex items-center justify-center font-semibold text-sm flex-shrink-0" style={{ background: '#2563eb' }}>{user?.fullName?.[0]}</div>
            }
            <div className="min-w-0">
              <p className="text-sm font-medium text-white leading-tight truncate">{user?.fullName}</p>
              <p className="text-xs text-white/45 group-hover:text-white/70">Administrator · Edit Profile</p>
            </div>
          </button>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/50 hover:text-red-300 hover:bg-white/5 rounded-lg transition-colors">
            <Icon name="logout" className="w-5 h-5" /> Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="bg-white shadow-sm border-b border-gray-200 flex items-center px-4 py-3 md:hidden">
          <button onClick={() => setSidebarOpen(true)} className="p-2 text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <img src="/civix-logo.png" alt="CIVIX" className="ml-3 h-7 w-auto" />
        </header>

        {/* Desktop topbar */}
        <header className="hidden md:flex items-center gap-4 px-6 h-16 flex-shrink-0"
          style={{ background: dark ? '#1e293b' : 'white', borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : '#e5e7eb'}` }}>
          <div className="min-w-0">
            <p className="text-xs font-medium" style={{ color: dark ? '#64748b' : '#9ca3af' }}>Admin</p>
            <h2 className="text-sm font-bold truncate" style={{ color: dark ? '#f1f5f9' : '#111827' }}>{activeItem?.label || 'Dashboard'}</h2>
          </div>

          <form onSubmit={handleTopSearch} className="hidden lg:block flex-1 max-w-sm ml-4">
            <div className="relative">
              <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: dark ? '#64748b' : '#9ca3af' }}
                fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <input value={topSearch} onChange={e => setTopSearch(e.target.value)}
                placeholder="Search submissions, tracking code..."
                className="w-full pl-10 pr-3 py-2 rounded-lg text-sm outline-none transition-all"
                style={{
                  background: dark ? '#0f172a' : '#f3f4f6',
                  color: dark ? '#e2e8f0' : '#111827',
                  border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'transparent'}`,
                }} />
            </div>
          </form>

          <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
            <button onClick={() => navigate('/admin/audit-log')}
              className="relative p-2 rounded-lg transition-colors"
              style={{ color: dark ? '#94a3b8' : '#6b7280' }}
              onMouseEnter={e => e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.06)' : '#f3f4f6'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              title="Audit Log">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>
            </button>
            <button onClick={toggleDark}
              className="p-2 rounded-lg transition-colors"
              style={{ color: dark ? '#94a3b8' : '#6b7280' }}
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
              {user?.avatar
                ? <img src={mediaUrl(user.avatar)} alt="avatar" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                : <div className="w-8 h-8 rounded-full text-white flex items-center justify-center font-semibold text-xs flex-shrink-0" style={{ background: '#2563eb' }}>{user?.fullName?.[0]}</div>
              }
            </button>
          </div>
        </header>

        <main className={`flex-1 min-h-0 ${isMapPage ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}`}>
          <Outlet />
        </main>
      </div>

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}
