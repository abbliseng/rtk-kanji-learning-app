/** Pure helpers for building lesson and review sessions. */
import type { Progress } from './db';
import { BURNED } from './srs';

export interface Settings {
  newPerDay: number;
  batchSize: number;
  /** Stages 1..mcStages are reviewed with multiple choice, later stages by typing. */
  mcStages: number;
  /** No new lessons while more reviews than this are waiting. */
  backlogLimit: number;
  /** Epoch ms when vacation mode started, or null. */
  vacationSince: number | null;
  lastBackupAt: number | null;
}

export const DEFAULT_SETTINGS: Settings = {
  newPerDay: 10,
  batchSize: 5,
  mcStages: 2,
  backlogLimit: 100,
  vacationSince: null,
  lastBackupAt: null
};

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function dueFrames(progress: Iterable<Progress>, now: number): number[] {
  const due: number[] = [];
  for (const p of progress) {
    if (p.stage > 0 && p.stage < BURNED && p.nextReview !== null && p.nextReview <= now) due.push(p.frame);
  }
  return due;
}

/** How many new kanji can still be started today. */
export function lessonsLeftToday(
  progress: Map<number, Progress>,
  settings: Settings,
  dueCount: number,
  total: number,
  now: number
): number {
  if (settings.vacationSince !== null || dueCount > settings.backlogLimit) return 0;
  const today = startOfDay(now);
  let startedToday = 0;
  for (const p of progress.values()) if (p.unlockedAt >= today) startedToday++;
  return Math.max(0, Math.min(settings.newPerDay - startedToday, total - progress.size));
}

/** The next `count` frames in book order that have not been started. */
export function nextLessonFrames(progress: Map<number, Progress>, count: number, total: number): number[] {
  const out: number[] = [];
  for (let f = 1; f <= total && out.length < count; f++) if (!progress.has(f)) out.push(f);
  return out;
}

/** Reviews due per day for the next `days` days; day 0 includes everything overdue. */
export function forecast(progress: Iterable<Progress>, now: number, days = 7): number[] {
  const counts = new Array(days).fill(0);
  const today = startOfDay(now);
  for (const p of progress) {
    if (p.nextReview === null || p.stage <= 0 || p.stage >= BURNED) continue;
    const day = Math.max(0, Math.floor((startOfDay(p.nextReview) - today) / 86_400_000));
    if (day < days) counts[day]++;
  }
  return counts;
}

export function shuffle<T>(items: T[], random = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Three wrong options for a multiple-choice question. RTK groups kanji by shared
 * parts, so kanji you have met within ~50 frames look alike and make good distractors.
 */
export function pickDistractors(
  frame: number,
  keywordOf: (frame: number) => string,
  started: Set<number>,
  total: number,
  random = Math.random,
  count = 3
): number[] {
  const near = (radius: number, onlyStarted: boolean) => {
    const out: number[] = [];
    for (let f = Math.max(1, frame - radius); f <= Math.min(total, frame + radius); f++) {
      if (f !== frame && (!onlyStarted || started.has(f))) out.push(f);
    }
    return out;
  };
  const chosen: number[] = [];
  const keywords = new Set([keywordOf(frame).toLowerCase()]);
  for (const pool of [near(50, true), near(150, true), near(30, false), near(total, false)]) {
    for (const f of shuffle(pool, random)) {
      if (chosen.length === count) return chosen;
      const kw = keywordOf(f).toLowerCase();
      if (!keywords.has(kw)) {
        keywords.add(kw);
        chosen.push(f);
      }
    }
  }
  return chosen;
}
