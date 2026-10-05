// Shared wording helpers so every page shows dates and counts the same way.

// "Sep 25, 2026", on the Philippine calendar.
export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric',
  });
}

// "Sep 25, 2026, 3:04 PM"
export function formatDateTime(date) {
  return new Date(date).toLocaleString('en-US', {
    timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

// "just now", "5 minutes ago", "2 hours ago", "yesterday", "3 days ago", then the date.
export function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${plural(minutes, 'minute')} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${plural(hours, 'hour')} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return formatDate(date);
}

// "1 report", "3 reports"
export function plural(n, word, many = `${word}s`) {
  return `${n} ${n === 1 ? word : many}`;
}
