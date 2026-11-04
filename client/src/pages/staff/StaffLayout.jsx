import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { BrandImg } from '../../context/BrandingContext';
import Icon from '../../components/common/Icons';
import Avatar from '../../components/common/Avatar';
import SignOutDialog from '../../components/common/SignOutDialog';
import ProfileModal from '../../components/common/ProfileModal';
import IdleSessionGuard from '../../components/common/IdleSessionGuard';
import NotificationBell, { openAlerts } from '../../components/common/NotificationBell';
import NewClientDialog from '../../components/staff/NewClientDialog';
import WalkInDialog from '../../components/staff/WalkInDialog';
import { announceNewAlerts } from '../../components/common/alerts';
import Tour, { markTour, shouldAutoStart } from '../../components/common/Tour';
import TOUR_TEXT from '../../i18n/tourText';
import api from '../../utils/api';

// Same layout as the admin portal (navy sidebar with the town seal, white top
// bar), with the staff member's office and its report counts.
const NAV_SECTIONS = [
  { label: 'Overview', items: [{ to: '/staff/dashboard', label: 'Dashboard', icon: 'dashboard' }] },
  {
    label: 'Reports',
    items: [
      { to: '/staff/submissions', label: 'Our Reports', icon: 'inbox', badge: 'open' },
      { to: '/staff/map',         label: 'Office Map',  icon: 'map' },
    ],
  },
  { label: 'Updates', items: [{ to: '/staff/notifications', label: 'Notifications', icon: 'bell', badge: 'alerts' }] },
];
const PAGE_TITLES = [
  ['/staff/dashboard', 'Dashboard'],
  ['/staff/submissions', 'Our Reports'],
  ['/staff/map', 'Office Map'],
  ['/staff/notifications', 'Notifications'],
  ['/staff/admin-access', 'Administrator Access'],
];

// Staff pop-ups: reports in their own office that are urgent, overdue or newly received.
const STAFF_ALERT_KINDS = {
  urgent: {
    noun: 'urgent report',
    describe: item => <>Urgent report <strong>{item.trackingId}</strong> needs attention.</>,
  },
  overdue: {
    noun: 'overdue report',
    describe: item => <><strong>{item.trackingId}</strong> is now overdue.</>,
  },
  newReports: {
    noun: 'new report',
    describe: item => <>New report <strong>{item.trackingId}</strong> was sent to your office.</>,
  },
};

// The staff portal's guided tour (in English, like the rest of the portal). It opens
// by itself the first time a staff member reaches the dashboard on this device, and
// from "Take the tour" in the menu. Steps for parts that aren't on the screen (the
// sidebar on a phone, the Walk-in button under 1024 px) are left out.
const STAFF_TOUR = [
  { welcome: true, title: 'Welcome to the CIVIX Staff Portal',
    body: "This short tour shows where your office's reports and tools are. It takes about a minute. To see it again later, press Take the tour in the menu." },
  { target: '[data-tour="staff-office"]', title: 'Your office',
    body: 'Complaints, suggestions and feedback for your office come here. The card shows how many are open and overdue; press it to see them all in Our Reports.' },
  { target: '[data-tour="staff-menu"]', title: 'The menu',
    body: 'Press here for Our Reports, the Office Map, Notifications and Take the tour.' },
  { target: '[data-tour="staff-todo"]', title: 'To do',
    body: 'Start here each day: overdue, urgent and new reports, most serious first. Open a report to change its status, add a note for the citizen and attach proof photos.' },
  { target: '[data-tour="staff-new-client"]', title: 'New client',
    body: 'After serving a client, press New client and give them the slip. Its code and QR code open the satisfaction form (ARTA CSM): one code for one form, good for 7 days.' },
  { target: '[data-tour="staff-walk-in"]', title: 'Walk-in report',
    body: 'Type in a complaint or suggestion a citizen gave in person, by phone, by letter or by message. It gets a Transaction Code like any other report.' },
  { target: '[data-tour="staff-bell"]', title: 'Notifications',
    body: 'Overdue, urgent and new reports in your office show here. The red number is how many need attention.' },
  { target: '[data-tour="staff-csm"]', title: 'How clients rate your office',
    body: "Results of the satisfaction form for your office: the overall score, each part of the form, and how many codes were given and answered. Totals only, never one client's answers." },
  { target: '[data-tour="staff-tour"]', title: 'See this tour again',
    body: 'Press Take the tour at any time to see this tour again.' },
];

function ThemeIcon({ dark }) {
  return dark ? (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <circle cx="12" cy="12" r="5"/>
      <path strokeLinecap="round" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>
  ) : (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
    </svg>
  );
}

export default function StaffLayout() {
  const { user, logout } = useAuth();
  const { dark, toggle: toggleDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [alerts, setAlerts] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  // "New client": a code and slip for the satisfaction form (ARTA CSM).
  const [newClientOpen, setNewClientOpen] = useState(false);
  const closeNewClient = useCallback(() => setNewClientOpen(false), []);
  // "Walk-in report": a complaint or suggestion a citizen gave in person, by phone,
  // by letter or by message, typed in by the staff member.
  const [walkInOpen, setWalkInOpen] = useState(false);
  const closeWalkIn = useCallback(() => setWalkInOpen(false), []);
  const openWalkIn = useCallback(() => setWalkInOpen(true), []);
  const [topSearch, setTopSearch] = useState('');
  const [tourOpen, setTourOpen] = useState(false);
  const tourId = user ? `staff:${user.id}` : null;
  const closeTour = useCallback(how => {
    setTourOpen(false);
    if (tourId) markTour(tourId, how);
  }, [tourId]);
  const alertCount = alerts?.total || 0;
  const openCount = alerts?.counts?.open ?? null;
  const overdueCount = alerts?.counts?.overdue || 0;

  // Reports in this staff member's office that need attention, refreshed every
  // 30 seconds, on each page change and after they update a report. Items that
  // newly appear pop up an alert once per browser session.
  useEffect(() => {
    let active = true;
    const load = () => api.get('/staff/portal/alerts')
      .then(res => {
        if (!active) return;
        setAlerts(res.data);
        announceNewAlerts(res.data, STAFF_ALERT_KINDS, openAlerts);
      })
      .catch(() => {});
    load();
    const timer = setInterval(load, 30000);
    window.addEventListener('civix:alerts-changed', load);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('civix:alerts-changed', load);
    };
  }, [location.pathname]);

  // The tour, the first time this staff member reaches the dashboard here.
  const onDashboard = location.pathname.startsWith('/staff/dashboard');
  useEffect(() => {
    if (!tourId || !onDashboard || !shouldAutoStart(tourId)) return undefined;
    const timer = setTimeout(() => setTourOpen(true), 800);
    return () => clearTimeout(timer);
  }, [tourId, onDashboard]);

  // "Take the tour": it starts on the dashboard, where its last parts are.
  function startTour() {
    setSidebarOpen(false);
    if (!onDashboard) navigate('/staff/dashboard');
    setTourOpen(true);
  }

  const isMapPage = location.pathname.startsWith('/staff/map');
  const pageTitle = (PAGE_TITLES.find(([path]) => location.pathname.startsWith(path)) || [null, 'Dashboard'])[1];

  function handleLogout() { setConfirmSignOut(false); logout(); navigate('/staff-login'); }
  const closeSignOut = useCallback(() => setConfirmSignOut(false), []);

  function handleTopSearch(e) {
    e.preventDefault();
    if (!topSearch.trim()) return;
    navigate('/staff/submissions', { state: { search: topSearch.trim() } });
    setTopSearch('');
  }

  // Count badges. On the highlighted (blue) item they turn solid white to stay readable.
  function navBadge(kind, isActive) {
    let label = null;
    let style = null;
    let title = '';
    if (kind === 'open' && openCount > 0) {
      label = openCount > 99 ? '99+' : openCount;
      title = `${openCount} open${overdueCount ? `, ${overdueCount} overdue` : ''}`;
      style = overdueCount > 0
        ? (isActive ? { background: '#ffffff', color: '#b91c1c' } : { background: '#dc2626', color: '#ffffff' })
        : (isActive ? { background: '#ffffff', color: '#1d4ed8' } : { background: 'rgba(255,255,255,0.16)', color: '#ffffff' });
    } else if (kind === 'alerts' && alertCount > 0) {
      label = alertCount > 9 ? '9+' : alertCount;
      title = `${alertCount} need attention`;
      style = isActive ? { background: '#ffffff', color: '#b91c1c' } : { background: '#dc2626', color: '#ffffff' };
    }
    if (label === null) return null;
    return (
      <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
        style={style} title={title}>
        {label}
      </span>
    );
  }

  const bell = (
    <NotificationBell alerts={alerts} dark={dark} showDepartment={false} tourId="staff-bell"
      emptyText="No urgent, overdue or new reports in your office."
      onSelect={item => navigate('/staff/submissions', { state: { openId: item.id } })}
      links={[
        { label: 'All notifications', onClick: () => navigate('/staff/notifications') },
        { label: 'Our reports', onClick: () => navigate('/staff/submissions') },
      ]} />
  );

  const adminAccessLink = {
    label: 'Request administrator access',
    description: 'Only if your work needs it. An administrator will review it.',
    icon: <Icon name="shield" className="w-4 h-4 text-gray-500 flex-shrink-0" />,
    onClick: () => { setProfileOpen(false); navigate('/staff/admin-access'); },
  };

  const topBarMuted = dark ? '#94a3b8' : '#4b5563';

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: dark ? '#0f172a' : '#f1f5f9' }}>
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 flex flex-col transform transition-transform duration-200 md:relative md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: 'linear-gradient(180deg, #0b2f66 0%, #081d40 100%)' }}>
        <div className="flex items-center gap-3 px-5 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <BrandImg kind="seal" alt="Municipality of Cantilan" className="w-10 h-10 object-contain flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-white font-extrabold text-sm leading-tight truncate">CIVIX</p>
            <p className="text-white/70 text-[11px] font-medium leading-tight truncate">Staff Portal</p>
          </div>
        </div>

        {/* The staff member's office, with how many reports are open */}
        {user?.department && (
          <NavLink to="/staff/submissions" onClick={() => setSidebarOpen(false)} data-tour="staff-office"
            className="mx-3 mt-4 px-3 py-2.5 rounded-xl flex items-center gap-2.5 transition-colors hover:bg-white/10"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.12)', color: '#bfdbfe' }}>
              <Icon name="offices" className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#bfdbfe' }}>Your office</p>
              <p className="text-sm font-bold leading-snug truncate text-white">{user.department}</p>
              {openCount !== null && (
                <p className="text-xs mt-0.5" style={{ color: '#dbeafe' }}>
                  {openCount === 0 ? 'No open reports' : `${openCount} open`}
                  {overdueCount > 0 && <span style={{ color: '#fecaca' }}> · {overdueCount} overdue</span>}
                </p>
              )}
            </div>
          </NavLink>
        )}

        <nav className="flex-1 px-3 py-4 overflow-y-auto scrollbar-none" aria-label="Staff menu">
          {NAV_SECTIONS.map(section => (
            <div key={section.label} className="mb-4">
              <p className="px-3 mb-1.5 text-[11px] font-bold uppercase tracking-widest text-white/60">{section.label}</p>
              {section.items.map(item => (
                <NavLink key={item.to} to={item.to} end={item.to === '/staff/dashboard'}
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
                      <span className="min-w-0 truncate">{item.label}</span>
                      {navBadge(item.badge, isActive)}
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
              <p className="text-xs text-white/70 group-hover:text-white/90">Staff · Edit Profile</p>
            </div>
          </button>
          <button type="button" onClick={startTour} data-tour="staff-tour"
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/75 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
            <Icon name="tour" className="w-5 h-5" /> Take the tour
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
          <button onClick={() => setSidebarOpen(true)} aria-label="Open menu" data-tour="staff-menu"
            className="p-2 text-gray-600 hover:text-gray-800 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2 ml-3">
            <BrandImg kind="seal" className="w-6 h-6 object-contain" />
            <span className="font-extrabold text-gray-900 text-sm">CIVIX</span>
            <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">Staff</span>
          </div>
          <div className="ml-auto flex items-center gap-0.5">
            {user?.department && (
              <button onClick={() => setNewClientOpen(true)} aria-label="New client: make a slip for the satisfaction form" data-tour="staff-new-client"
                className="mr-1 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-700 text-white text-xs font-semibold hover:bg-blue-800 transition-colors">
                <Icon name="qr" className="w-4 h-4" /> New client
              </button>
            )}
            <button onClick={toggleDark} aria-label={dark ? 'Light mode' : 'Dark mode'}
              className="p-2 rounded-lg transition-colors" style={{ color: topBarMuted }}>
              <ThemeIcon dark={dark} />
            </button>
            {bell}
          </div>
        </header>

        {/* Desktop top bar */}
        <header className="hidden md:flex items-center gap-4 px-6 h-16 flex-shrink-0"
          style={{ background: dark ? '#1e293b' : 'white', borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : '#e5e7eb'}` }}>
          <div className="min-w-0">
            <p className="text-xs font-medium truncate" style={{ color: topBarMuted }}>Staff{user?.department ? ` · ${user.department}` : ''}</p>
            <h2 className="text-sm font-bold truncate" style={{ color: dark ? '#f1f5f9' : '#111827' }}>{pageTitle}</h2>
          </div>

          <form onSubmit={handleTopSearch} className="hidden lg:block flex-1 max-w-sm ml-4" role="search">
            <div className="relative">
              <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: topBarMuted }}
                fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden="true">
                <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <input value={topSearch} onChange={e => setTopSearch(e.target.value)} aria-label="Search your office's reports"
                placeholder="Search reports, transaction code..."
                className="w-full pl-10 pr-3 py-2 rounded-lg text-sm outline-none transition-all placeholder:text-gray-500 dark:placeholder:!text-slate-400 focus:ring-2 focus:ring-blue-500"
                style={{
                  background: dark ? '#0f172a' : '#f3f4f6',
                  color: dark ? '#e2e8f0' : '#111827',
                  border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'transparent'}`,
                }} />
            </div>
          </form>

          <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
            {/* From 1024 px; narrower, the page title needs the room and Our Reports has the same button */}
            {user?.department && (
              <button onClick={openWalkIn} data-tour="staff-walk-in" title="Type in a complaint or suggestion a citizen gave in person, by phone, by letter or by message"
                className="mr-1 hidden lg:inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                style={{ borderColor: dark ? 'rgba(147,197,253,0.4)' : '#bfdbfe', color: dark ? '#bfdbfe' : '#1d4ed8', background: dark ? 'transparent' : '#ffffff' }}
                onMouseEnter={e => { e.currentTarget.style.background = dark ? 'rgba(37,99,235,0.15)' : '#eff6ff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = dark ? 'transparent' : '#ffffff'; }}>
                <Icon name="write" className="w-4 h-4" /> Walk-in report
              </button>
            )}
            {user?.department && (
              <button onClick={() => setNewClientOpen(true)} data-tour="staff-new-client" title="Make a slip for the satisfaction form (ARTA CSM)"
                className="mr-1 inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
                <Icon name="qr" className="w-4 h-4" /> New client
              </button>
            )}
            {bell}
            <button onClick={toggleDark}
              className="p-2 rounded-lg transition-colors"
              style={{ color: topBarMuted }}
              onMouseEnter={e => { e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.06)' : '#f3f4f6'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              title={dark ? 'Light Mode' : 'Dark Mode'} aria-label={dark ? 'Light mode' : 'Dark mode'}>
              <ThemeIcon dark={dark} />
            </button>
            <button onClick={() => setProfileOpen(true)} aria-label="Edit profile"
              className="flex items-center gap-2 pl-2 ml-1" style={{ borderLeft: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}` }}>
              <Avatar user={user} className="w-8 h-8" letterClassName="text-xs" />
            </button>
          </div>
        </header>

        {/* The map page fills the height; it still scrolls if the screen is too short.
            "relative" keeps anything a page places absolutely (e.g. a hidden note for
            screen readers) inside this scrolling panel; outside it, such an element
            made the whole window scroll, with a second scroll bar. */}
        <main className={`relative flex-1 min-h-0 overflow-y-auto ${isMapPage ? 'flex flex-col' : ''}`}>
          <Outlet key={location.key} context={{ alerts, openNewClient: () => setNewClientOpen(true), openWalkIn: user?.department ? openWalkIn : null }} />
        </main>
      </div>

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} links={[adminAccessLink]} />
      <SignOutDialog open={confirmSignOut} user={user}
        roleLabel={`Staff${user?.department ? ` · ${user.department}` : ''}`}
        message="You'll need to sign in again to see your office's reports."
        onCancel={closeSignOut} onConfirm={handleLogout} />
      <NewClientDialog open={newClientOpen} onClose={closeNewClient} />
      <WalkInDialog open={walkInOpen} onClose={closeWalkIn} />
      <IdleSessionGuard loginPath="/staff-login" />
      <Tour open={tourOpen} steps={STAFF_TOUR} labels={TOUR_TEXT.en.ui} dark={dark} onClose={closeTour} />
    </div>
  );
}
