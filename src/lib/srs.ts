/**
 * WaniKani-style stages with fixed intervals.
 * 0 = not started, 1–4 Apprentice, 5–6 Guru, 7 Master, 8 Enlightened, 9 Burned.
 */
export const BURNED = 9;
export const GURU = 5;

const HOUR = 3600_000;
/** Time until the next review after reaching a stage. */
export const INTERVALS: Record<number, number> = {
  1: 4 * HOUR,
  2: 8 * HOUR,
  3: 24 * HOUR,
  4: 48 * HOUR,
  5: 7 * 24 * HOUR,
  6: 14 * 24 * HOUR,
  7: 30 * 24 * HOUR,
  8: 120 * 24 * HOUR
};

export type StageGroup = 'locked' | 'apprentice' | 'guru' | 'master' | 'enlightened' | 'burned';

export function stageGroup(stage: number): StageGroup {
  if (stage <= 0) return 'locked';
  if (stage < GURU) return 'apprentice';
  if (stage < 7) return 'guru';
  if (stage === 7) return 'master';
  if (stage === 8) return 'enlightened';
  return 'burned';
}

export function stageName(stage: number): string {
  if (stage <= 0) return 'Not started';
  if (stage < GURU) return `Apprentice ${stage}`;
  if (stage < 7) return `Guru ${stage - 4}`;
  if (stage === 7) return 'Master';
  if (stage === 8) return 'Enlightened';
  return 'Burned';
}

export const isLearned = (stage: number) => stage >= GURU;

/**
 * New stage after a review. A kanji answered wrong at least once in a session drops
 * once: one stage below Guru, two from Guru up, never below Apprentice 1.
 */
export function nextStage(stage: number, wrongInSession: boolean): number {
  if (!wrongInSession) return Math.min(stage + 1, BURNED);
  const drop = stage >= GURU ? 2 : 1;
  return Math.max(1, stage - drop);
}

/** When the kanji is next due, or null once burned. */
export function nextReviewAt(stage: number, now: number): number | null {
  const interval = INTERVALS[stage];
  return interval === undefined ? null : now + interval;
}

/** Multiple choice up to and including `mcStages`, typed answers after that. */
export function reviewMode(stage: number, mcStages: number): 'choice' | 'typed' {
  return stage <= mcStages ? 'choice' : 'typed';
}
