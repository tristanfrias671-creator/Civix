import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import ProfileModal from '../../components/common/ProfileModal';
import { mediaUrl } from '../../utils/mediaUrl';
import api from '../../utils/api';

const NAV = [
  { to: '/staff/dashboard',   label: 'Dashboard',           icon: <DashboardIcon />   },
  { to: '/staff/submissions', label: 'Assigned Complaints',  icon: <ComplaintIcon />   },
  { to: '/staff/monitor',     label: 'Service Requests',     icon: <ServiceIcon />     },
];

function DashboardIcon() {
  return (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10-3a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z"/>
    </svg>
  );
}
function ComplaintIcon() {
  return (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
    </svg>
  );
}
function ServiceIcon() {
  return (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
    </svg>
  );
}
function BellIcon() {
  return (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
    </svg>
  );
}

const sidebarCss = `
@keyframes sbFadeIn { from { opacity: 0; transform: translateX(-6px); } to { opacity: 1; transform: translateX(0); } }
.sb-item { position: relative; animation: sbFadeIn .35s cubic-bezier(.22,1,.36,1) both; }
.sb-item::before {
  content: ''; position: absolute; left: -12px; top: 50%; transform: translateY(-50%);
  width: 3px; height: 0; border-radius: 3px; background: #60a5fa;
  transition: height .25s cubic-bezier(.22,1,.36,1);
}
.sb-item.active::before { height: 60%; }
.sb-item:hover svg { transform: scale(1.12); }
.sb-item svg { transition: transform .2s ease; }
/* GPU-composited ping ring (transform+opacity only — no box-shadow repaint cost) */
@keyframes sbPingRing { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(2.2); opacity: 0; } }
.sb-bell-badge { position: relative; }
.sb-bell-badge::after {
  content: ''; position: absolute; inset: 0; border-radius: 9999px; z-index: -1;
  background: rgba(239,68,68,0.6);
  animation: sbPingRing 2s ease-out infinite;
  will-change: transform, opacity;
}
.sb-brand { animation: sbFadeIn .4s ease both; }
.sb-dept { animation: sbFadeIn .4s .05s cubic-bezier(.22,1,.36,1) both; }
.sb-avatar-wrap:hover .sb-avatar-ring { box-shadow: 0 0 0 3px rgba(37,99,235,0.35); }
.sb-avatar-ring { transition: box-shadow .25s ease; }

/* GPU-composited glow pulse (opacity only, on a static-sized pseudo-layer — no box-shadow repaint) */
@keyframes sbMarkGlow { 0%,100% { opacity: 0.35; } 50% { opacity: 0.85; } }
.sb-mark { position: relative; transition: transform .3s cubic-bezier(.22,1,.36,1); }
.sb-mark::before {
  content: ''; position: absolute; inset: -6px; border-radius: 14px; z-index: -1;
  background: radial-gradient(circle, rgba(37,99,235,0.5), rgba(13,148,136,0.35) 70%, transparent 100%);
  animation: sbMarkGlow 3s ease-in-out infinite;
  will-change: opacity;
}
.sb-brand:hover .sb-mark { transform: rotate(-8deg) scale(1.08); }
`;

export default function StaffLayout() {
  const { user, logout } = useAuth();
  const { dark, toggle: toggleDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    api.get('/staff/portal/stats')
      .then(r => setUnreadCount((r.data.pending || 0) + (r.data.reviewing || 0)))
      .catch(() => {});
  }, [location.pathname]);
  const [profileOpen, setProfileOpen] = useState(false);

  function handleLogout() { logout(); navigate('/staff-login'); }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 flex flex-col transform transition-transform duration-200 md:relative md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: 'linear-gradient(180deg, #0f172a 0%, #090e1a 100%)' }}>
        <style>{sidebarCss}</style>

        {/* Brand */}
        <div className="sb-brand flex items-center gap-3 px-6 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="sb-mark w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #2563eb, #0d9488)' }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5">
              <line x1="5" y1="5" x2="19" y2="19" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
              <line x1="19" y1="5" x2="5" y2="19" stroke="white" strokeWidth="2.2" strokeLinecap="round" opacity="0.55" />
              <circle cx="5" cy="5" r="2.1" fill="white" />
              <circle cx="19" cy="5" r="2.1" fill="#5eead4" />
              <circle cx="5" cy="19" r="2.1" fill="#5eead4" />
              <circle cx="19" cy="19" r="2.1" fill="white" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="font-extrabold text-white text-base leading-none tracking-tight">CIVIX</p>
            <p className="text-[10px] font-medium mt-1 leading-none" style={{ color: '#5eead4' }}>Real-Time Civic Engagement</p>
          </div>
          <span className="ml-auto text-xs font-bold text-blue-200 px-2 py-0.5 rounded-md flex-shrink-0"
            style={{ background: 'rgba(37,99,235,0.25)', border: '1px solid rgba(37,99,235,0.4)' }}>STAFF</span>
        </div>

        {/* Department chip */}
        {user?.department && (
          <div className="sb-dept mx-3 mt-3 px-3 py-2.5 rounded-xl flex items-center gap-2.5 transition-all hover:shadow-[0_0_0_1px_rgba(37,99,235,0.4)]"
            style={{ background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.2)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(37,99,235,0.25)' }}>
              <svg className="w-4 h-4" fill="none" stroke="#93c5fd" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2M5 21H3m4-14h.01M11 7h.01M7 11h.01M11 11h.01M7 15h.01M11 15h.01M9 21v-4h2v4"/>
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'rgba(147,197,253,0.6)' }}>Department</p>
              <p className="text-xs font-bold leading-snug truncate" style={{ color: '#93c5fd' }}>{user.department}</p>
            </div>
          </div>
        )}

        {/* Main nav */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto space-y-0.5">
          <p className="text-xs font-bold uppercase tracking-widest px-3 pb-1 pt-2" style={{ color: 'rgba(255,255,255,0.25)' }}>Navigation</p>
          {NAV.map((item, i) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/staff/dashboard'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `sb-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${isActive ? 'active' : ''} ${
                  isActive
                    ? 'text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 hover:translate-x-0.5'
                }`
              }
              style={({ isActive }) => ({
                animationDelay: `${i * 0.05}s`,
                ...(isActive ? {
                  background: 'linear-gradient(135deg, rgba(37,99,235,0.85), rgba(29,78,216,0.85))',
                  boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
                } : {}),
              })}>
              {item.icon}
              {item.label}
            </NavLink>
          ))}

          {/* Divider */}
          <div className="mx-1 my-3" style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

          {/* Notifications */}
          <p className="text-xs font-bold uppercase tracking-widest px-3 pb-1" style={{ color: 'rgba(255,255,255,0.25)' }}>More</p>
          <NavLink to="/staff/notifications"
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `sb-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${isActive ? 'active' : ''} ${
                isActive ? 'text-white' : 'text-slate-400 hover:text-white hover:bg-white/5 hover:translate-x-0.5'
              }`
            }
            style={({ isActive }) => ({
              animationDelay: '.15s',
              ...(isActive ? {
                background: 'linear-gradient(135deg, rgba(37,99,235,0.85), rgba(29,78,216,0.85))',
                boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
              } : {}),
            })}>
            <BellIcon />
            Notifications
            {unreadCount > 0 && (
              <span className="sb-bell-badge ml-auto min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </NavLink>
        </nav>

        {/* Bottom: user + logout */}
        <div className="px-3 py-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <button onClick={() => setProfileOpen(true)}
            className="sb-avatar-wrap flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all hover:bg-white/5 group mb-1">
            <div className="relative flex-shrink-0">
              {user?.avatar
                ? <img src={mediaUrl(user.avatar)} alt="avatar"
                    className="sb-avatar-ring w-9 h-9 rounded-full object-cover"
                    style={{ border: '2px solid rgba(37,99,235,0.5)' }} />
                : <div className="sb-avatar-ring w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
                    style={{ background: 'linear-gradient(135deg,#2563eb,#4f46e5)' }}>
                    {user?.fullName?.[0]?.toUpperCase()}
                  </div>
              }
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2" style={{ background: '#22c55e', borderColor: '#0f172a' }} />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-sm font-semibold text-white truncate leading-tight">{user?.fullName}</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Staff · Edit Profile</p>
            </div>
            <svg className="w-4 h-4 flex-shrink-0 opacity-40 group-hover:opacity-70 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
            </svg>
          </button>

          <button onClick={toggleDark}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all mb-1"
            style={{ color: 'rgba(255,255,255,0.45)' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.background = 'transparent'; }}>
            {dark ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <circle cx="12" cy="12" r="5"/>
                <path strokeLinecap="round" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
              </svg>
            )}
            {dark ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ color: 'rgba(255,255,255,0.35)' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; e.currentTarget.style.background = 'transparent'; }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Mobile top bar */}
        <header className="bg-white border-b border-gray-200 flex items-center px-4 py-3 md:hidden"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <button onClick={() => setSidebarOpen(true)} className="p-2 text-gray-500 hover:text-gray-800 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <div className="flex items-center gap-2 ml-3">
            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)' }}>
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
              </svg>
            </div>
            <span className="font-extrabold text-gray-900 text-sm">CIVIX</span>
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Staff</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}
