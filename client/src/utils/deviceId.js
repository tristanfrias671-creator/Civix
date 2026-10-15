// A random name for this browser, kept on the device (localStorage civix_device),
// so the sign-in history can tell a new phone or computer from one used before.
// It says nothing about the person, and signing out keeps it.
const KEY = 'civix_device';

export function deviceId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!/^[A-Za-z0-9-]{8,64}$/.test(id || '')) {
      id = window.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return undefined; // storage blocked: the history just can't tell devices apart
  }
}
