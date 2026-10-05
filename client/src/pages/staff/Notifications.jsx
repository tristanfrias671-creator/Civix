import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Skel, useSkeletonGate } from '../../components/common/Skeleton';
import { AlertSections } from '../../components/common/alerts';
import { getReactionMeta } from '../../components/citizen/FeedbackRatingPanel';
import { formatDateTime, plural, timeAgo } from '../../utils/format';
import api from '../../utils/api';

const STATUS_LABEL = { PENDING: 'Pending', REVIEWING: 'Reviewing', IN_PROGRESS: 'In Progress', RESOLVED: 'Resolved' };
const STATUS_COLOR = { PENDING: '#6b7280', REVIEWING: '#1d4ed8', IN_PROGRESS: '#b45309', RESOLVED: '#15803d' };
const TYPE_WORD = { COMPLAINT: 'complaint', SUGGESTION: 'suggestion', FEEDBACK: 'feedback' };

// Which feed items this person has already seen, kept in this browser:
// everything up to `seen` (a time), plus single items opened since then.
const seenKey = userId => `civix_activity_seen_${userId}`;
const readKey = userId => `civix_activity_read_${userId}`;
function loadSeen(userId) {
  try {
    const stored = Number(localStorage.getItem(seenKey(userId)));
    if (stored) return stored;
  } catch { /* storage unavailable */ }
  return Date.now() - 24 * 60 * 60 * 1000; // first visit: only the last day counts as new
}
function loadRead(userId) {
  try { return new Set(JSON.parse(localStorage.getItem(readKey(userId)) || '[]')); } catch { return new Set(); }
}
function saveSeen(userId, time) {
  try {
    localStorage.setItem(seenKey(userId), String(time));
    localStorage.removeItem(readKey(userId));
  } catch { /* storage unavailable */ }
}
function saveRead(userId, ids) {
  try { localStorage.setItem(readKey(userId), JSON.stringify([...ids].slice(-300))); } catch { /* storage unavailable */ }
}

// "Today", "Yesterday" or the date, on the Philippine calendar.
const phDay = date => new Date(date).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
function dayLabel(day) {
  const today = phDay(Date.now());
  const yesterday = phDay(Date.now() - 24 * 60 * 60 * 1000);
  if (day === today) return 'Today';
  if (day === yesterday) return 'Yesterday';
  return new Date(`${day}T12:00:00+08:00`).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', weekday: 'long', month: 'short', day: 'numeric' });
}

const KIND_STYLE = {
  new:      { color: '#2563eb', path: 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4' },
  movedIn:  { color: '#7c3aed', path: 'M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1' },
  movedOut: { color: '#64748b', path: 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1' },
  status:   { color: '#16a34a', path: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  overdue:  { color: '#dc2626', path: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
};

function describe(e) {
  const who = e.byMe ? 'You' : e.by;
  const id = <strong className="font-mono text-[13px]">{e.trackingId}</strong>;
  switch (e.kind) {
    case 'new': {
      const reaction = e.type === 'FEEDBACK' ? getReactionMeta(e.reaction) : null;
      return (
        <>
          New {TYPE_WORD[e.type] || 'report'} {id} {e.noOffice ? 'arrived with no office. Send it to the right office' : 'was sent to your office'}
          {e.priority === 'URGENT' && <> · <strong className="text-red-700">urgent</strong></>}
          {reaction && <> · rated <strong>{reaction.emoji} {reaction.label}</strong></>}
        </>
      );
    }
    case 'movedIn':
      return <><strong>{who}</strong> moved {id} to your office from {e.fromDepartment === 'UNASSIGNED' ? 'the reports with no office' : <strong>{e.fromDepartment}</strong>}</>;
    case 'movedOut':
      return <><strong>{who}</strong> moved {id} to <strong>{e.toDepartment}</strong></>;
    case 'status':
      return <><strong>{who}</strong> set {id} to <strong style={{ color: STATUS_COLOR[e.status] }} className="dark:!text-inherit">{STATUS_LABEL[e.status]}</strong></>;
    case 'overdue':
      return <>{id} passed its deadline and is now <strong className="text-red-700">overdue</strong></>;
    default:
      return id;
  }
}

// Reports in the staff member's office that are urgent, overdue, due soon or new
// (from StaffLayout, which keeps them up to date).
function AttentionPanel({ alerts, dark, onOpen }) {
  const count = alerts?.total || 0;
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-5">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-gray-900">Needs your attention</h2>
          <p className="text-sm text-gray-600 mt-0.5">
            Urgent, overdue, due soon and new reports{alerts?.department ? ` in ${alerts.department}` : ''}.
          </p>
        </div>
        {count > 0 && (
          <span className="px-2.5 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full flex-shrink-0">{count}</span>
        )}
      </div>
      {!alerts ? (
        <div className="px-5 py-4 space-y-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex items-center gap-3">
              <Skel className="w-8 h-8 rounded-full" />
              <div className="flex-1"><Skel className="h-3 w-40 mb-2" /><Skel className="h-3 w-56" /></div>
            </div>
          ))}
        </div>
      ) : count === 0 ? (
        <div className="px-5 py-6 text-center">
          <p className="text-sm font-semibold text-gray-800">You're all caught up</p>
          <p className="text-sm text-gray-600 mt-0.5">No urgent, overdue or new reports in your office.</p>
        </div>
      ) : (
        <div className="max-h-[420px] overflow-y-auto pb-2">
          <AlertSections alerts={alerts} dark={dark} showDepartment={false} onSelect={item => onOpen(item.id)} />
        </div>
      )}
    </div>
  );
}

export default function StaffNotifications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { dark } = useTheme();
  const { alerts } = useOutletContext() || {};
  const [events, setEvents] = useState(null);
  const [failed, setFailed] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [seenAt, setSeenAt] = useState(() => loadSeen(user?.id));
  const [readIds, setReadIds] = useState(() => loadRead(user?.id));
  const gate = useSkeletonGate();

  // This page lists the same items as the pop-up alert, which would cover them.
  useEffect(() => { toast.dismiss('civix-alert'); }, [alerts]);

  const load = useCallback((quiet = false) => {
    const request = api.get('/staff/portal/activity');
    return (quiet ? request : gate(request))
      .then(res => { setEvents(res.data.events || []); setFailed(false); })
      .catch(() => { if (!quiet) setFailed(true); });
  }, [gate]);

  useEffect(() => {
    load();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') load(true); }, 60000);
    return () => clearInterval(timer);
  }, [load]);

  const isUnread = e => !e.byMe && new Date(e.at).getTime() > seenAt && !readIds.has(e.id);
  const unreadCount = (events || []).filter(isUnread).length;
  const shown = (events || []).filter(e => !showUnreadOnly || isUnread(e));

  function markAllRead() {
    const now = Date.now();
    saveSeen(user?.id, now);
    setSeenAt(now);
    setReadIds(new Set());
  }

  function openEvent(e) {
    if (isUnread(e)) {
      const next = new Set(readIds).add(e.id);
      setReadIds(next);
      saveRead(user?.id, next);
    }
    navigate('/staff/submissions', { state: { openId: e.submissionId } });
  }

  // Newest first, under a heading for each day.
  const days = [];
  for (const e of shown) {
    const day = phDay(e.at);
    if (!days.length || days[days.length - 1].day !== day) days.push({ day, items: [] });
    days[days.length - 1].items.push(e);
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">

      {/* ── Page Header ── */}
      <div className="mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          {unreadCount > 0 && (
            <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">{unreadCount} unread</span>
          )}
        </div>
        <p className="text-gray-600 text-sm mt-1">
          What needs action now, and what happened in {alerts?.department || 'your office'} in the last 30 days.
        </p>
      </div>

      <AttentionPanel alerts={alerts} dark={dark}
        onOpen={id => navigate('/staff/submissions', { state: { openId: id } })} />

      {/* ── Activity feed ── */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden" aria-labelledby="activity-title">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 id="activity-title" className="text-base font-bold text-gray-900">Activity</h2>
            <p className="text-sm text-gray-600 mt-0.5">New reports, moves between offices, status updates and missed deadlines.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-gray-200 overflow-hidden" role="group" aria-label="Show">
              {[[false, 'All'], [true, `Unread${unreadCount ? ` (${unreadCount})` : ''}`]].map(([value, label]) => (
                <button key={label} type="button" onClick={() => setShowUnreadOnly(value)} aria-pressed={showUnreadOnly === value}
                  className={`px-3 py-1.5 text-sm font-semibold transition-colors ${showUnreadOnly === value ? 'bg-blue-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>
                  {label}
                </button>
              ))}
            </div>
            <button type="button" onClick={markAllRead} disabled={!unreadCount}
              className="px-3 py-1.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Mark all as read
            </button>
          </div>
        </div>

        {events === null && !failed ? (
          <div className="px-5 py-4 space-y-4">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3">
                <Skel className="w-9 h-9 rounded-full" />
                <div className="flex-1"><Skel className="h-3.5 w-72 max-w-full mb-2" /><Skel className="h-3 w-24" /></div>
              </div>
            ))}
          </div>
        ) : failed ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-semibold text-gray-800">Could not load the activity</p>
            <button type="button" onClick={() => load()} className="mt-3 px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">Try again</button>
          </div>
        ) : shown.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <svg className="w-10 h-10 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
            </svg>
            <p className="font-semibold text-gray-800">{showUnreadOnly ? 'No unread notifications' : 'Nothing has happened yet'}</p>
            <p className="text-sm text-gray-600 mt-1">
              {showUnreadOnly ? "You've read everything." : 'New reports and updates in your office will show up here.'}
            </p>
          </div>
        ) : (
          days.map(({ day, items }) => (
            <div key={day}>
              <h3 className="px-5 pt-4 pb-2 text-xs font-bold uppercase tracking-wide text-gray-600">{dayLabel(day)}</h3>
              <ul>
                {items.map(e => {
                  const style = KIND_STYLE[e.kind] || KIND_STYLE.new;
                  const color = e.kind === 'status' ? STATUS_COLOR[e.status] || style.color : style.color;
                  const unread = isUnread(e);
                  const extra = e.kind === 'status' ? e.note : (e.kind === 'movedIn' || e.kind === 'movedOut') ? e.reason : null;
                  // A report moved to another office can only be opened by that office now.
                  const canOpen = e.kind !== 'movedOut';
                  const Row = canOpen ? 'button' : 'div';
                  return (
                    <li key={e.id}>
                      <Row {...(canOpen ? { type: 'button', onClick: () => openEvent(e) } : {})}
                        className={`w-full text-left px-5 py-3 flex gap-3 transition-colors ${canOpen ? 'hover:bg-gray-50' : ''} ${unread ? 'bg-blue-50' : ''}`}>
                        <span className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: `${color}1f`, color: dark ? '#e2e8f0' : color }}>
                          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d={style.path} />
                          </svg>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-gray-800 leading-snug">{describe(e)}</span>
                          {extra && (
                            <span className="block text-sm text-gray-600 mt-1 line-clamp-2">
                              {e.kind === 'status' ? `“${extra}”` : `Reason: ${extra}`}
                            </span>
                          )}
                          {!canOpen && <span className="block text-xs text-gray-600 mt-1">Only {e.toDepartment} can open it now.</span>}
                          <span className="block text-xs text-gray-600 mt-1" title={formatDateTime(e.at)}>{timeAgo(e.at)}</span>
                        </span>
                        {unread && <span className="w-2.5 h-2.5 rounded-full bg-blue-600 flex-shrink-0 mt-2" aria-label="Unread" />}
                      </Row>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
        {events && events.length > 0 && (
          <p className="px-5 py-3 border-t border-gray-100 text-xs text-gray-600">
            Showing {plural(events.length, 'item')} from the last 30 days.
          </p>
        )}
      </section>
    </div>
  );
}
