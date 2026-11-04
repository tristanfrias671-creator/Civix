import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { StatusBadge, TypeBadge } from '../../components/common/StatusBadge';
import DeadlineBadge, { deadlineInfo } from '../../components/common/DeadlineBadge';
import { Skel, SkeletonStatCards, SkeletonTable, useSkeletonGate } from '../../components/common/Skeleton';
import Icon from '../../components/common/Icons';
import StatCard from '../../components/common/StatCard';
import CsmResultsDetails, {
  RangeSwitch, ScoreHeadline, CodeFacts, useSatisfaction, SCORE_NOTE, RATING_NOTE, RANGE_WORDS,
} from '../../components/common/CsmResults';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { formatDate, plural, timeAgo } from '../../utils/format';
import api from '../../utils/api';

const LINK_LIGHT = '#2563eb';
const LINK_DARK = '#60a5fa';

// The To-do list: overdue first, then urgent, due soon and new reports.
const TODO_GROUPS = [
  { key: 'overdue',    tone: 'bad' },
  { key: 'urgent',     tone: 'bad' },
  { key: 'dueSoon',    tone: 'warn' },
  { key: 'newReports', tone: 'new' },
];
const TODO_TONE_LIGHT = {
  bad:  { chipBg: '#fef2f2', chip: '#b91c1c', dot: '#dc2626' },
  warn: { chipBg: '#fffbeb', chip: '#b45309', dot: '#f59e0b' },
  new:  { chipBg: '#eff6ff', chip: '#1d4ed8', dot: '#2563eb' },
};
const TODO_TONE_DARK = {
  bad:  { chipBg: 'rgba(220,38,38,0.18)', chip: '#fca5a5', dot: '#f87171' },
  warn: { chipBg: 'rgba(217,119,6,0.18)', chip: '#fcd34d', dot: '#fbbf24' },
  new:  { chipBg: 'rgba(37,99,235,0.18)', chip: '#93c5fd', dot: '#60a5fa' },
};
const TODO_SHOWN = 6;

function todoChip(item, key) {
  if (key === 'urgent') {
    const d = deadlineInfo(item);
    return d && d.tone === 'bad' ? `Urgent · ${d.label}` : 'Urgent';
  }
  if (key === 'newReports') return `New · ${timeAgo(item.createdAt)}`;
  return deadlineInfo(item)?.label || '';
}

function TodoList({ alerts, onOpen, dark }) {
  const tones = dark ? TODO_TONE_DARK : TODO_TONE_LIGHT;
  const items = alerts
    ? TODO_GROUPS.flatMap(g => (alerts[g.key] || []).map(item => ({ item, key: g.key, tone: tones[g.tone] })))
    : null;
  const muted = dark ? '#94a3b8' : '#4b5563';
  const strong = dark ? '#f1f5f9' : '#111827';
  const line = dark ? 'rgba(255,255,255,0.06)' : '#f3f4f6';

  return (
    <section className="rounded-2xl border mb-6" aria-labelledby="todo-title"
      style={{ background: dark ? '#1e293b' : 'white', borderColor: dark ? 'rgba(255,255,255,0.06)' : '#f3f4f6', boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
      <div className="flex items-start justify-between gap-3 px-5 sm:px-6 py-4 border-b" style={{ borderColor: line }} data-tour="staff-todo">
        <div className="min-w-0">
          <h2 id="todo-title" className="font-bold text-lg" style={{ color: strong }}>To do</h2>
          <p className="text-sm mt-0.5" style={{ color: muted }}>Reports that need action now, most serious first.</p>
        </div>
        {items && items.length > TODO_SHOWN && (
          <Link to="/staff/notifications" className="text-sm font-bold whitespace-nowrap flex items-center gap-1 mt-1" style={{ color: dark ? LINK_DARK : LINK_LIGHT }}>
            See all {items.length}
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
          </Link>
        )}
      </div>

      {!items ? (
        <div className="px-6 py-4 space-y-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex items-center gap-3">
              <Skel className="w-2.5 h-2.5 rounded-full" />
              <div className="flex-1"><Skel className="h-3.5 w-48 mb-2" /><Skel className="h-3 w-72 max-w-full" /></div>
              <Skel className="h-8 w-16 rounded-lg" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="px-6 py-8 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: dark ? 'rgba(22,163,74,0.18)' : '#dcfce7', color: dark ? '#4ade80' : '#15803d' }}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
          </div>
          <p className="font-semibold" style={{ color: strong }}>You're all caught up</p>
          <p className="text-sm mt-0.5" style={{ color: muted }}>No overdue, urgent or new reports{alerts.department ? ` in ${alerts.department}` : ''}.</p>
        </div>
      ) : (
        <ul>
          {items.slice(0, TODO_SHOWN).map(({ item, key, tone }, i) => (
            <li key={`${key}:${item.id}`} style={{ borderTop: i ? `1px solid ${line}` : 'none' }}>
              <button type="button" onClick={() => onOpen(item.id)}
                className="w-full text-left px-5 sm:px-6 py-3.5 flex items-center gap-3 transition-colors"
                onMouseEnter={e => { e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.03)' : '#f9fafb'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: tone.dot }} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[13px] font-semibold" style={{ color: strong }}>{item.trackingId}</span>
                    <TypeBadge type={item.type} />
                    {item.department === 'UNASSIGNED' && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md whitespace-nowrap" style={{ background: dark ? 'rgba(217,119,6,0.18)' : '#fffbeb', color: dark ? '#fcd34d' : '#92400e' }}>
                        No office yet
                      </span>
                    )}
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md whitespace-nowrap" style={{ background: tone.chipBg, color: tone.chip }}>
                      {todoChip(item, key)}
                    </span>
                  </span>
                  {item.description && (
                    <span className="block text-sm mt-1 truncate" style={{ color: muted }}>{item.description}</span>
                  )}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold flex-shrink-0"
                  style={{ background: dark ? 'rgba(37,99,235,0.18)' : '#eff6ff', color: dark ? '#93c5fd' : '#1d4ed8' }}>
                  Open
                </span>
                <svg className="sm:hidden w-4 h-4 flex-shrink-0" style={{ color: muted }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// How clients rated the office on the satisfaction form (ARTA CSM): the totals for
// this month, this year or so far, never one client's answers.
function Satisfaction({ dark, onNewClient }) {
  const { range, setRange, data, failed, loading } = useSatisfaction('/staff/portal/satisfaction');
  const muted = dark ? '#94a3b8' : '#4b5563';
  const strong = dark ? '#f1f5f9' : '#111827';
  const line = dark ? 'rgba(255,255,255,0.06)' : '#f3f4f6';

  return (
    <section className="rounded-2xl border mt-7" aria-labelledby="csm-title" data-csm-section
      style={{ background: dark ? '#1e293b' : 'white', borderColor: dark ? 'rgba(255,255,255,0.06)' : '#f3f4f6', boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 sm:px-6 py-4 border-b" style={{ borderColor: line }} data-tour="staff-csm">
        <div className="min-w-0">
          <h2 id="csm-title" className="font-bold text-lg" style={{ color: strong }}>How clients rate your office</h2>
          <p className="text-sm mt-0.5" style={{ color: muted }}>
            From the satisfaction form (ARTA CSM){data && !failed ? `: ${data.label}` : ''}. Totals only, never one client's answers.
          </p>
        </div>
        <RangeSwitch value={range} onChange={setRange} />
      </div>

      <div className="px-5 sm:px-6 py-5 transition-opacity" aria-busy={loading} style={{ opacity: loading && data ? 0.55 : 1 }}>
        {failed ? (
          <p className="text-sm py-6 text-center" style={{ color: muted }}>Could not load the results. Please reload the page.</p>
        ) : !data ? (
          <div className="space-y-4">
            <Skel className="h-12 w-64" />
            {[0, 1, 2, 3].map(i => <Skel key={i} className="h-3 w-full" />)}
          </div>
        ) : data.responses === 0 ? (
          <>
          {data.codes?.given > 0 && <CodeFacts codes={data.codes} />}
          <div className="flex flex-col items-center text-center py-6" data-csm-empty>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: dark ? 'rgba(255,255,255,0.05)' : '#f3f4f6' }}>
              <span style={{ color: muted }}><Icon name="feedback" className="w-7 h-7" /></span>
            </div>
            <p className="font-semibold" style={{ color: strong }}>No answers{RANGE_WORDS[range]} yet</p>
            <p className="text-sm mt-1 max-w-md" style={{ color: muted }}>
              Give each client a slip with New client. The client scans the QR code on it and rates your office's service.
            </p>
            {onNewClient && (
              <button type="button" onClick={onNewClient}
                className="mt-4 inline-flex items-center gap-2 px-4 min-h-[44px] rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }}>
                <Icon name="qr" className="w-4 h-4" />
                New client
              </button>
            )}
          </div>
          </>
        ) : (
          <>
            <ScoreHeadline result={data} />
            <div className="mt-6"><CodeFacts codes={data.codes} /></div>
            <div className="mt-6 pt-6 border-t" style={{ borderColor: line }}>
              <CsmResultsDetails result={data} services={data.services} />
            </div>
            <p className="text-xs mt-6" style={{ color: muted }}>{SCORE_NOTE} {RATING_NOTE}</p>
          </>
        )}
      </div>
    </section>
  );
}

export default function StaffDashboard() {
  const { user } = useAuth();
  const { dark } = useTheme();
  const navigate = useNavigate();
  const { alerts, openNewClient } = useOutletContext() || {};
  const [stats,   setStats]   = useState(null);
  const [recent,  setRecent]  = useState([]);
  const [loading, setLoading] = useState(true);
  const gate = useSkeletonGate();

  useEffect(() => {
    gate(Promise.all([
      api.get('/staff/portal/stats'),
      api.get('/staff/portal/submissions?limit=8'),
    ])).then(([s, r]) => {
      setStats(s.data);
      setRecent(r.data.submissions);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [gate]);

  const openReport = id => navigate('/staff/submissions', { state: { openId: id } });
  const muted = dark ? '#94a3b8' : '#4b5563';
  const strong = dark ? '#f1f5f9' : '#111827';
  const line = dark ? 'rgba(255,255,255,0.06)' : '#f3f4f6';

  if (loading) return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="mb-7"><Skel className="h-7 w-64 mb-2" /><Skel className="h-4 w-48" /></div>
      <Skel className="h-56 w-full rounded-2xl mb-6" />
      <SkeletonStatCards count={4} className="mb-6" />
      <div className="rounded-2xl border bg-white border-gray-100" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
        <div className="px-6 py-4 border-b border-gray-100"><Skel className="h-4 w-48" /></div>
        <SkeletonTable cols={6} rows={8} />
      </div>
    </div>
  );

  const today = Number(stats?.todayCount ?? 0);
  const month = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'long' });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">

      {/* Header, the same as the admin dashboard's */}
      <div className="mb-7 flex items-center justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight leading-tight" style={{ color: dark ? '#f1f5f9' : '#0f172a' }}>
            Welcome back{user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}
          </h1>
          <p className="text-sm sm:text-[15px] mt-1 flex items-center gap-2 flex-wrap" style={{ color: muted }}>
            {new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Manila', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            {stats?.department && (
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full" style={{ background: dark ? 'rgba(37,99,235,0.18)' : '#dbeafe', color: dark ? '#93c5fd' : '#1d4ed8' }}>
                {stats.department}
              </span>
            )}
          </p>
        </div>
        <Link to="/staff/submissions"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }}>
          View All Reports
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
          </svg>
        </Link>
      </div>

      <TodoList alerts={alerts} onOpen={openReport} dark={dark} />

      {/* The four numbers that matter day to day */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        <StatCard stack label="Open" value={stats?.open ?? 0} tone="blue" icon="inbox" to="/staff/submissions"
          sub={today ? `${today} new today` : 'None new today'} />
        <StatCard stack label="Overdue" value={stats?.overdue ?? 0} tone="red" icon="complaint" to="/staff/submissions"
          sub="Past their deadline" />
        <StatCard stack label="Due in 7 Days" value={stats?.dueThisWeek ?? 0} tone="orange" icon="clock" to="/staff/submissions"
          sub="Not overdue yet" />
        <StatCard stack label="Resolved" value={stats?.resolvedThisMonth ?? 0} tone="green" icon="check" to="/staff/submissions"
          sub={`This month (${month})`} />
      </div>

      {/* Newest reports */}
      <div className="rounded-2xl border" style={{ background: dark ? '#1e293b' : 'white', borderColor: dark ? 'rgba(255,255,255,0.06)' : '#f3f4f6', boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
        <div className="flex justify-between items-center gap-3 px-5 sm:px-6 py-4 border-b" style={{ borderColor: line }}>
          <div className="min-w-0">
            <h2 className="font-bold text-lg" style={{ color: strong }}>Newest reports</h2>
            <p className="text-sm mt-0.5" style={{ color: muted }}>The latest reports sent to your office.</p>
          </div>
          <Link to="/staff/submissions" className="text-sm font-bold flex items-center gap-1 whitespace-nowrap" style={{ color: dark ? LINK_DARK : LINK_LIGHT }}>
            View all
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
            </svg>
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center px-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: dark ? 'rgba(255,255,255,0.05)' : '#f3f4f6' }}>
              <span style={{ color: muted }}><Icon name="inbox" className="w-7 h-7" /></span>
            </div>
            <p className="font-semibold" style={{ color: strong }}>No reports yet</p>
            <p className="text-sm mt-1" style={{ color: muted }}>Reports sent to your office will appear here.</p>
          </div>
        ) : (
          <ul>
            {recent.map((s, i) => {
              const isAnon = !s.user?.fullName;
              return (
                <li key={s.id} style={{ borderTop: i ? `1px solid ${line}` : 'none' }}>
                  <button type="button" onClick={() => openReport(s.id)}
                    className="w-full text-left px-5 sm:px-6 py-3.5 grid gap-x-4 gap-y-1.5 items-center sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] transition-colors"
                    onMouseEnter={e => { e.currentTarget.style.background = dark ? 'rgba(37,99,235,0.08)' : 'rgba(37,99,235,0.04)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[13px] font-semibold" style={{ color: strong }}>{s.trackingId}</span>
                        <TypeBadge type={s.type} />
                      </span>
                      <span className="block text-sm mt-1 truncate" style={{ color: muted }}>
                        {isAnon ? 'Anonymous' : s.user.fullName} · {s.description}
                      </span>
                    </span>
                    <span className="flex items-center gap-2 flex-wrap sm:contents">
                      <StatusBadge status={s.status} />
                      <DeadlineBadge submission={s} />
                      <span className="text-xs whitespace-nowrap" style={{ color: muted }}>{formatDate(s.createdAt)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {stats && (
        <p className="text-xs mt-4 text-center" style={{ color: muted }}>
          {plural(stats.total, 'report')} in {stats.department} so far · {plural(stats.resolved, 'resolved report')}
        </p>
      )}

      <Satisfaction dark={dark} onNewClient={openNewClient} />
    </div>
  );
}
