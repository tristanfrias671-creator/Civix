// The period a PDF or Excel report covers: one week (Monday to Sunday), one month,
// one year, or everything recorded. Boundaries follow the Philippine calendar
// (UTC+8 all year, no daylight saving time), whatever the server's own clock is.

const PH_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const KINDS = ['week', 'month', 'year', 'all'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

class PeriodError extends Error {}

const pad = n => String(n).padStart(2, '0');

// The Philippine calendar date of a moment, as { y, m (0-11), d }.
function phDate(instant) {
  const t = new Date(new Date(instant).getTime() + PH_OFFSET_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate() };
}
// When a Philippine calendar day begins (m and d may overflow, as in Date.UTC).
const phStart = (y, m, d) => new Date(Date.UTC(y, m, d) - PH_OFFSET_MS);
// "2026-10-13" for a moment, on the Philippine calendar.
function phIsoDate(instant) {
  const { y, m, d } = phDate(instant);
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}
// Bucket keys: "2026-10-13" for a day, "2026-10" for a month.
const phDayKey = instant => phIsoDate(instant);
const phMonthKey = instant => { const { y, m } = phDate(instant); return `${y}-${pad(m + 1)}`; };

// "October 12 – 18, 2026", "September 28 – October 4, 2026",
// "December 28, 2026 – January 3, 2027" (both days included).
function dayRange(a, b) {
  if (a.y !== b.y) return `${MONTHS[a.m]} ${a.d}, ${a.y} – ${MONTHS[b.m]} ${b.d}, ${b.y}`;
  if (a.m !== b.m) return `${MONTHS[a.m]} ${a.d} – ${MONTHS[b.m]} ${b.d}, ${a.y}`;
  if (a.d !== b.d) return `${MONTHS[a.m]} ${a.d} – ${b.d}, ${a.y}`;
  return `${MONTHS[a.m]} ${a.d}, ${a.y}`;
}
// The calendar date `n` days after { y, m, d }.
function plusDays({ y, m, d }, n) {
  const t = new Date(Date.UTC(y, m, d) + n * DAY_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate() };
}
// The first day of month m of year y (m may overflow: -1 is December of y - 1).
function monthStart(y, m) {
  const t = new Date(Date.UTC(y, m, 1));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: 1 };
}

// Reads ?period=week|month|year|all&date=YYYY-MM-DD (any day inside the period;
// no date means the current one). Throws PeriodError with a message for the admin.
function parsePeriod(query = {}, now = new Date()) {
  const kind = query.period || 'all';
  if (!KINDS.includes(kind)) throw new PeriodError('Choose a weekly, monthly, yearly or all-time report.');
  if (kind === 'all') {
    return {
      kind, from: null, to: null, prevFrom: null, prevTo: null,
      title: 'Analytics Report', range: 'All recorded submissions', rangeFull: 'All Recorded Submissions',
      fileTag: 'all-time', inProgress: false, unitName: 'month',
    };
  }

  const today = phDate(now);
  let day = today;
  if (query.date) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(query.date));
    const t = m && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (!t || t.getUTCMonth() !== +m[2] - 1 || t.getUTCDate() !== +m[3]) throw new PeriodError('Choose a valid week, month or year.');
    day = { y: +m[1], m: +m[2] - 1, d: +m[3] };
  }
  if (day.y < 2000 || day.y > today.y + 1) throw new PeriodError('Choose a valid week, month or year.');

  let start, end, prevStart; // calendar dates; end is the first day after the period
  if (kind === 'week') {
    const weekday = (new Date(Date.UTC(day.y, day.m, day.d)).getUTCDay() + 6) % 7; // Monday = 0
    start = plusDays(day, -weekday);
    end = plusDays(start, 7);
    prevStart = plusDays(start, -7);
  } else if (kind === 'month') {
    start = monthStart(day.y, day.m);
    end = monthStart(day.y, day.m + 1);
    prevStart = monthStart(day.y, day.m - 1);
  } else {
    start = { y: day.y, m: 0, d: 1 };
    end = { y: day.y + 1, m: 0, d: 1 };
    prevStart = { y: day.y - 1, m: 0, d: 1 };
  }
  const from = phStart(start.y, start.m, start.d);
  const to = phStart(end.y, end.m, end.d);
  if (from > now) throw new PeriodError('That period has not started yet.');

  // A period still running is reported up to today ("month to date").
  const inProgress = to > now;
  const lastDay = inProgress ? today : plusDays(end, -1);
  const word = { week: 'week', month: 'month', year: 'year' }[kind];
  const range = kind === 'week' ? dayRange(start, plusDays(end, -1))
    : kind === 'month' ? `${MONTHS[start.m]} ${start.y}`
      : String(start.y);

  // One row per day for a week or month, one per month for a year.
  const buckets = [];
  if (kind === 'year') {
    for (let i = 0; i < 12; i++) buckets.push({ key: `${start.y}-${pad(i + 1)}`, label: MONTHS[i].slice(0, 3), long: `${MONTHS[i]} ${start.y}` });
  } else {
    for (let c = start; Date.UTC(c.y, c.m, c.d) < Date.UTC(end.y, end.m, end.d); c = plusDays(c, 1)) {
      const weekday = DAYS[(new Date(Date.UTC(c.y, c.m, c.d)).getUTCDay() + 6) % 7];
      buckets.push({
        key: `${c.y}-${pad(c.m + 1)}-${pad(c.d)}`,
        label: kind === 'week' ? `${weekday.slice(0, 3)} ${c.d}` : `${MONTHS[c.m].slice(0, 3)} ${c.d}`,
        long: `${weekday}, ${MONTHS[c.m]} ${c.d}, ${c.y}`,
      });
    }
  }

  return {
    kind, from, to,
    prevFrom: phStart(prevStart.y, prevStart.m, prevStart.d), prevTo: from,
    title: { week: 'Weekly Report', month: 'Monthly Report', year: 'Yearly Report' }[kind],
    range,                                                   // "October 2026"
    rangeFull: dayRange(start, lastDay) + (inProgress ? ` (${word} to date)` : ''), // "October 1 – 13, 2026 (month to date)"
    fileTag: `${{ week: 'weekly', month: 'monthly', year: 'yearly' }[kind]}-${kind === 'week' ? `${start.y}-${pad(start.m + 1)}-${pad(start.d)}` : kind === 'month' ? `${start.y}-${pad(start.m + 1)}` : start.y}`,
    inProgress,
    unitName: kind === 'year' ? 'month' : 'day',
    word,
    buckets,
    bucketOf: kind === 'year' ? phMonthKey : phDayKey,
  };
}

module.exports = { parsePeriod, PeriodError, phDate, phStart, phIsoDate, phMonthKey, MONTHS };
