// How a report reached the office (the server's utils/channels.js): sent online by
// the citizen, or typed in by the office's staff ("Walk-in report" in the staff
// portal) for a citizen who came to the office, called, wrote or sent a message.
export const CHANNEL_LABELS = {
  ONLINE: 'Online',
  WALK_IN: 'Walk-in',
  PHONE: 'Phone call',
  LETTER: 'Letter or written form',
  MESSAGE: 'Facebook or email',
};

// The shorter words on badges.
export const CHANNEL_SHORT = { WALK_IN: 'Walk-in', PHONE: 'Phone call', LETTER: 'Letter', MESSAGE: 'Facebook/email' };

// The choices in the "Walk-in report" window.
export const STAFF_CHANNELS = [
  { key: 'WALK_IN', label: 'Walk-in', hint: 'Came to the office' },
  { key: 'PHONE', label: 'Phone call', hint: 'Called the office' },
  { key: 'LETTER', label: 'Letter or written form', hint: 'Wrote to the office' },
  { key: 'MESSAGE', label: 'Facebook or email', hint: 'Sent a message' },
];

// Typed in by the office's staff (anything but online).
export const typedIn = s => Boolean(s?.channel && s.channel !== 'ONLINE');
