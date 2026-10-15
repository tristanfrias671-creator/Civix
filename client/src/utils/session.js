// Where the admin and staff sign-ins are kept in this browser. Each portal has its
// own slot, so one browser can be signed in to both at once (for example an
// administrator checking the staff pages in another tab), and signing out of one
// portal leaves the other signed in. A page's portal comes from its address.
const KEYS = {
  ADMIN: { token: 'civix_admin_token', user: 'civix_admin_user', activity: 'civix_admin_last_activity' },
  STAFF: { token: 'civix_staff_token', user: 'civix_staff_user', activity: 'civix_staff_last_activity' },
};
export const PORTALS = Object.keys(KEYS);

// Before the two slots, one shared slot held whichever account signed in last.
const OLD_KEYS = { token: 'civix_token', user: 'civix_user', activity: 'civix_last_activity' };

function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
}
function remove(key) {
  try { localStorage.removeItem(key); } catch { /* storage unavailable */ }
}

// /admin… pages are the admin portal, /staff… pages the staff portal. The sign-in
// pages and the citizen pages belong to neither.
export function portalOf(pathname = window.location.pathname) {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return 'ADMIN';
  if (pathname === '/staff' || pathname.startsWith('/staff/')) return 'STAFF';
  return null;
}

// The portal an account signs in to.
export const portalOfRole = role => (KEYS[role] ? role : null);

// { token, user } of the portal's sign-in, or null.
export function getSession(portal) {
  const keys = KEYS[portal];
  if (!keys) return null;
  const token = read(keys.token);
  let user = null;
  try { user = JSON.parse(read(keys.user) || 'null'); } catch { user = null; }
  return token && user ? { token, user } : null;
}

export function saveSession(portal, token, user) {
  const keys = KEYS[portal];
  if (!keys) return;
  if (token) write(keys.token, token);
  write(keys.user, JSON.stringify(user));
}

export function clearSession(portal) {
  const keys = KEYS[portal];
  if (!keys) return;
  remove(keys.token);
  remove(keys.user);
  remove(keys.activity);
}

// The key of the portal's "last activity" time (automatic sign-out).
export const activityKey = portal => KEYS[portal]?.activity || null;

// Whether a storage key belongs to a portal's sign-in (for changes made in other tabs).
export const isSessionKey = key => PORTALS.some(p => key === KEYS[p].token || key === KEYS[p].user);

// The token for requests made from this page, if its portal is signed in.
export const tokenForPage = () => getSession(portalOf())?.token || null;

// A sign-in kept in the old shared slot moves to its portal's slot, so nobody is
// signed out by this change.
export function moveOldSession() {
  const token = read(OLD_KEYS.token);
  const raw = read(OLD_KEYS.user);
  if (token && raw) {
    let portal = null;
    try { portal = portalOfRole(JSON.parse(raw)?.role); } catch { portal = null; }
    if (portal) {
      write(KEYS[portal].token, token);
      write(KEYS[portal].user, raw);
      const activity = read(OLD_KEYS.activity);
      if (activity) write(KEYS[portal].activity, activity);
    }
  }
  Object.values(OLD_KEYS).forEach(remove);
}
moveOldSession();
