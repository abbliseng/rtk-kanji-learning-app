/** "now", "in 3h", "in 2 days", "in 4 months". */
export function relativeTime(ts: number | null, now: number): string {
  if (ts === null) return 'never (burned)';
  const diff = ts - now;
  if (diff <= 0) return 'now';
  const hours = diff / 3_600_000;
  if (hours < 1) return `in ${Math.max(1, Math.round(diff / 60_000))} min`;
  if (hours < 36) return `in ${Math.round(hours)}h`;
  const days = hours / 24;
  if (days < 45) return `in ${Math.round(days)} days`;
  return `in ${Math.round(days / 30)} months`;
}

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
