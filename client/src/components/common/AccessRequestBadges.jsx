import React from 'react';

const STATUS = {
  PENDING:  { label: 'Pending verification', cls: 'bg-amber-50 text-amber-700 dark:text-amber-300' },
  APPROVED: { label: 'Approved',             cls: 'bg-green-50 text-green-700' },
  REJECTED: { label: 'Not approved',         cls: 'bg-red-50 text-red-700' },
};

const TYPE = {
  STAFF_ACCOUNT: { label: 'New staff account',    cls: 'bg-blue-50 text-blue-700' },
  ADMIN_ACCESS:  { label: 'Administrator access', cls: 'bg-purple-50 text-purple-700 dark:text-purple-300' },
};

function Badge({ cls, children }) {
  return <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md whitespace-nowrap ${cls}`}>{children}</span>;
}

export function RequestStatusBadge({ status }) {
  const s = STATUS[status] || STATUS.PENDING;
  return <Badge cls={s.cls}>{s.label}</Badge>;
}

export function RequestTypeBadge({ type }) {
  const t = TYPE[type] || TYPE.STAFF_ACCOUNT;
  return <Badge cls={t.cls}>{t.label}</Badge>;
}

export function formatRequestDate(value) {
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function timeAgo(value) {
  const diff = Math.floor((Date.now() - new Date(value)) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} d ago`;
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
