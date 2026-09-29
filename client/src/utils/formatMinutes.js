// 15 -> "15 minutes", 60 -> "1 hour", 90 -> "1 hour 30 minutes"
export default function formatMinutes(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  const part = (n, unit) => `${n} ${unit}${n === 1 ? '' : 's'}`;
  if (!h) return part(m, 'minute');
  return m ? `${part(h, 'hour')} ${part(m, 'minute')}` : part(h, 'hour');
}
