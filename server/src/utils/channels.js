// How a report reached the office (Submission.channel): sent online by the citizen,
// or typed in by the office's staff ("Walk-in report" in the staff portal) for a
// citizen who came to the office, called, wrote, or sent a message. The client
// keeps the same labels in data/channels.js.
const CHANNELS = ['ONLINE', 'WALK_IN', 'PHONE', 'LETTER', 'MESSAGE'];
// The ways staff can choose when they type a report in.
const STAFF_CHANNELS = ['WALK_IN', 'PHONE', 'LETTER', 'MESSAGE'];
const CHANNEL_LABELS = {
  ONLINE: 'Online',
  WALK_IN: 'Walk-in',
  PHONE: 'Phone call',
  LETTER: 'Letter or written form',
  MESSAGE: 'Facebook or email',
};
// "The citizen gave it <how>." in the office's emails.
const CHANNEL_HOW = {
  WALK_IN: 'in person at the office',
  PHONE: 'by phone',
  LETTER: 'by letter or on a written form',
  MESSAGE: 'by Facebook or email',
};

module.exports = { CHANNELS, STAFF_CHANNELS, CHANNEL_LABELS, CHANNEL_HOW };
