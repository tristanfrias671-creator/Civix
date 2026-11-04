import React from 'react';
import toast from 'react-hot-toast';
import { deadlineInfo } from './DeadlineBadge';
import { timeAgo } from '../../utils/format';

// Shared by the admin bell and the staff Notifications page. Alert data comes from
// GET /api/analytics/alerts (admin) or /api/staff/portal/alerts (staff's own office).

const TYPE_LABEL = { COMPLAINT: 'Complaint', SUGGESTION: 'Suggestion', FEEDBACK: 'Feedback' };
const REQUEST_ACTION = {
  STAFF_ACCOUNT: 'requested a staff account',
  ADMIN_ACCESS: 'requested administrator access',
};

// Groups, most serious first; each report appears in only one of them.
// `text` / `textDark` are darker or lighter than the dot so the words stay readable.
const SECTIONS = [
  { key: 'urgent',         title: 'Urgent',          dot: '#dc2626', text: '#b91c1c', textDark: '#fca5a5' },
  { key: 'overdue',        title: 'Overdue',         dot: '#ef4444', text: '#b91c1c', textDark: '#fca5a5' },
  { key: 'dueSoon',        title: 'Due soon',        dot: '#f59e0b', text: '#b45309', textDark: '#fcd34d' },
  { key: 'newReports',     title: 'New reports',     dot: '#2563eb', text: '#1d4ed8', textDark: '#93c5fd' },
  { key: 'accessRequests', title: 'Access requests', dot: '#7c3aed', text: '#6d28d9', textDark: '#c4b5fd' },
];

function reportDetail(item, key) {
  const deadline = deadlineInfo(item);
  const parts = [];
  if (key === 'urgent' || key === 'newReports') parts.push(`Filed ${timeAgo(item.createdAt)}`);
  if (deadline) parts.push(deadline.label);
  return parts.join(' · ');
}

function ReportIcon({ urgent }) {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {urgent
        ? <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        : <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>}
    </svg>
  );
}

// The grouped list. `onSelect(item, sectionKey)` runs when an item is clicked.
export function AlertSections({ alerts, onSelect, dark, showDepartment = true }) {
  const muted = dark ? '#94a3b8' : '#6b7280';
  const strong = dark ? '#e2e8f0' : '#1f2937';
  const hoverBg = dark ? 'rgba(255,255,255,0.04)' : '#f9fafb';
  const sections = SECTIONS.filter(s => alerts?.[s.key]?.length);

  return sections.map(section => (
    <div key={section.key}>
      <p className="px-4 pt-3 pb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide" style={{ color: muted }}>
        <span className="w-2 h-2 rounded-full" style={{ background: section.dot }} aria-hidden="true" />
        {section.title} · {alerts[section.key].length}
      </p>
      <ul>
        {alerts[section.key].map(item => {
          const isRequest = section.key === 'accessRequests';
          return (
            <li key={item.id}>
              <button type="button" onClick={() => onSelect(item, section.key)}
                className="w-full text-left px-4 py-2.5 flex gap-3 transition-colors"
                onMouseEnter={e => { e.currentTarget.style.background = hoverBg; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                {isRequest ? (
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: item.type === 'ADMIN_ACCESS' ? '#7c3aed' : '#2563eb' }}>
                    {item.fullName[0]?.toUpperCase()}
                  </span>
                ) : (
                  <span className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: `${section.dot}1a`, color: section.dot }}>
                    <ReportIcon urgent={section.key === 'urgent'} />
                  </span>
                )}
                <span className="min-w-0">
                  {isRequest ? (
                    <span className="block text-sm leading-snug" style={{ color: strong }}>
                      <strong>{item.fullName}</strong> {REQUEST_ACTION[item.type]}
                    </span>
                  ) : (
                    <span className="block text-sm leading-snug" style={{ color: strong }}>
                      <strong className="font-mono text-[13px]">{item.trackingId}</strong>
                      <span style={{ color: muted }}> · {TYPE_LABEL[item.type] || item.type}</span>
                    </span>
                  )}
                  <span className="block text-xs mt-0.5 truncate" style={{ color: isRequest ? muted : (dark ? section.textDark : section.text) }}>
                    {isRequest ? `${item.department ? `${item.department} · ` : ''}${timeAgo(item.createdAt)}` : reportDetail(item, section.key)}
                  </span>
                  {!isRequest && showDepartment && <span className="block text-xs truncate" style={{ color: muted }}>{item.department}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  ));
}

const SEEN_ALERTS_KEY = 'civix_seen_alerts';
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Pops up an alert for items the user hasn't been told about yet this browser
// session; on the first check of a session it summarizes everything waiting.
// `kinds` maps a group key to { noun, describe(item) } — only those groups alert.
// Alert items the person caused themselves (a walk-in report they just typed in)
// don't pop up as new. `keys` are "kind:id", as below. Before the first look of the
// session nothing is marked: that look sums up everything anyway.
export function markAlertsSeen(keys) {
  try {
    const seen = JSON.parse(sessionStorage.getItem(SEEN_ALERTS_KEY) || 'null');
    if (seen) sessionStorage.setItem(SEEN_ALERTS_KEY, JSON.stringify([...new Set([...seen, ...keys])]));
  } catch { /* storage unavailable */ }
}

export function announceNewAlerts(data, kinds, onView) {
  const keys = Object.keys(kinds).flatMap(k => (data[k] || []).map(item => `${k}:${item.id}`));
  let seen = null;
  try { seen = JSON.parse(sessionStorage.getItem(SEEN_ALERTS_KEY) || 'null'); } catch { /* storage unavailable */ }
  try { sessionStorage.setItem(SEEN_ALERTS_KEY, JSON.stringify(keys)); } catch { /* storage unavailable */ }

  let message = null;
  if (!seen) {
    const parts = Object.entries(kinds)
      .filter(([k]) => data[k]?.length)
      .map(([k, kind]) => plural(data[k].length, kind.noun));
    if (parts.length) message = <>Needs attention: <strong>{parts.join(', ')}</strong>.</>;
  } else {
    const seenSet = new Set(seen);
    const fresh = keys.filter(k => !seenSet.has(k));
    if (fresh.length > 1) {
      message = <><strong>{fresh.length} new items</strong> need attention.</>;
    } else if (fresh.length === 1) {
      const [k, id] = fresh[0].split(':');
      message = kinds[k].describe(data[k].find(item => item.id === id));
    }
  }
  if (!message) return;
  toast(t => (
    <span className="flex items-center gap-3">
      <span>{message}</span>
      <button type="button" className="font-semibold text-primary whitespace-nowrap"
        onClick={() => { toast.dismiss(t.id); onView(); }}>
        View
      </button>
    </span>
  ), { id: 'civix-alert', duration: 10000 });
}
