import React from 'react';

const DAY_MS = 24 * 60 * 60 * 1000;
const PH_OFFSET_MS = 8 * 60 * 60 * 1000;

// Midnight of a date's day on the Philippine calendar, as a timestamp.
function phDay(date) {
  const p = new Date(date.getTime() + PH_OFFSET_MS);
  return Date.UTC(p.getUTCFullYear(), p.getUTCMonth(), p.getUTCDate());
}

export function formatDueDate(dueAt, withWeekday = false) {
  return new Date(dueAt).toLocaleDateString('en-US', {
    timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric',
    ...(withWeekday ? { weekday: 'short' } : {}),
  });
}

// The badge's wording. The citizen Track page passes the same keys in its language.
export const DEADLINE_WORDS = {
  onTime: 'Resolved on time',
  late: 'Resolved late',
  overdue: d => `Overdue by ${d} day${d === 1 ? '' : 's'}`,
  today: 'Due today',
  dueIn: d => `Due in ${d} day${d === 1 ? '' : 's'}`,
  left: d => `${d} days left`,
  due: date => `Due ${date}`,
};

// Where a report stands against its resolve-by date (Submission.dueAt).
// Resolved reports count as on time if they were last updated by the deadline.
export function deadlineInfo({ dueAt, status, updatedAt }, words = DEADLINE_WORDS) {
  if (!dueAt || status === 'SPAM') return null; // spam or invalid: no deadline to meet
  const due = new Date(dueAt);
  const dateText = formatDueDate(dueAt);
  if (status === 'RESOLVED') {
    const onTime = !updatedAt || new Date(updatedAt) <= due;
    return { tone: onTime ? 'good' : 'muted', label: onTime ? words.onTime : words.late, dateText };
  }
  const days = Math.round((phDay(due) - phDay(new Date())) / DAY_MS);
  if (days < 0) return { tone: 'bad', label: words.overdue(-days), dateText };
  if (days === 0) return { tone: 'warn', label: words.today, dateText };
  if (days <= 2) return { tone: 'warn', label: words.dueIn(days), dateText };
  return { tone: 'ok', label: words.left(days), dateText };
}

const TONE = {
  ok:    'bg-blue-50 text-blue-700',
  warn:  'bg-amber-50 text-amber-700 dark:text-amber-300',
  bad:   'bg-red-50 text-red-700',
  good:  'bg-green-50 text-green-700',
  muted: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

export default function DeadlineBadge({ submission, showDate = false, words = DEADLINE_WORDS }) {
  const info = deadlineInfo(submission, words);
  if (!info) return <span className="text-xs text-gray-500">—</span>;
  return (
    <span className="inline-flex flex-col items-start">
      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md whitespace-nowrap ${TONE[info.tone]}`}>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
        </svg>
        {info.label}
      </span>
      {showDate && <span className="text-[11px] text-gray-500 mt-0.5 whitespace-nowrap">{words.due(info.dateText)}</span>}
    </span>
  );
}
