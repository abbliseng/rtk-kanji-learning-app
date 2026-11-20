/** Streaks and other small statistics. */

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shiftDays(ts: number, days: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

/**
 * Days in a row with at least one session. A single missed day is forgiven (a rest
 * day) as long as there was no other rest day in the 6 days before it. Today not
 * being done yet doesn't break the streak.
 */
export function streak(activeDays: Set<string>, now: number): number {
  let day = activeDays.has(dayKey(now)) ? now : shiftDays(now, -1);
  let count = 0;
  let lastRest = -Infinity; // how many days back the most recent rest day was
  for (let back = 0; back < 3650; back++, day = shiftDays(day, -1)) {
    if (activeDays.has(dayKey(day))) {
      count++;
      continue;
    }
    const restAllowed = count > 0 && back - lastRest > 6 && activeDays.has(dayKey(shiftDays(day, -1)));
    if (!restAllowed) break;
    lastRest = back;
  }
  return count;
}
