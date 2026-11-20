import { describe, expect, it } from 'vitest';
import type { Progress } from '../src/lib/db';
import { KANJI, LESSONS, TOTAL } from '../src/lib/kanji';
import {
  DEFAULT_SETTINGS,
  dueFrames,
  forecast,
  lessonsLeftToday,
  nextLessonFrames,
  pickDistractors,
  startOfDay
} from '../src/lib/session';
import { dayKey, streak } from '../src/lib/stats';

const NOW = new Date(2026, 10, 20, 12, 0).getTime();
const HOUR = 3_600_000;
const p = (frame: number, stage: number, nextReview: number | null, unlockedAt = 0): Progress => ({
  frame,
  stage,
  nextReview,
  unlockedAt
});

describe('kanji data', () => {
  it('has all 2,200 frames in 56 lessons', () => {
    expect(TOTAL).toBe(2200);
    expect(KANJI.every((k, i) => k.frame === i + 1 && k.kanji && k.keyword)).toBe(true);
    expect(LESSONS).toHaveLength(56);
    expect(LESSONS[0].frames).toHaveLength(15);
  });
});

describe('queues', () => {
  it('finds due reviews, ignoring burned kanji', () => {
    const rows = [p(1, 1, NOW - HOUR), p(2, 3, NOW + HOUR), p(3, 9, null), p(4, 5, NOW)];
    expect(dueFrames(rows, NOW)).toEqual([1, 4]);
  });

  it('limits new kanji per day and pauses on a backlog', () => {
    const progress = new Map([1, 2, 3].map((f) => [f, p(f, 1, NOW, NOW - HOUR)]));
    expect(lessonsLeftToday(progress, DEFAULT_SETTINGS, 0, TOTAL, NOW)).toBe(7);
    expect(lessonsLeftToday(progress, DEFAULT_SETTINGS, 101, TOTAL, NOW)).toBe(0);
    expect(lessonsLeftToday(progress, { ...DEFAULT_SETTINGS, vacationSince: NOW }, 0, TOTAL, NOW)).toBe(0);
    expect(lessonsLeftToday(new Map(), DEFAULT_SETTINGS, 0, TOTAL, NOW)).toBe(10);
  });

  it('picks the next frames in book order', () => {
    const progress = new Map([1, 2, 4].map((f) => [f, p(f, 1, NOW)]));
    expect(nextLessonFrames(progress, 3, TOTAL)).toEqual([3, 5, 6]);
  });

  it('forecasts reviews by day, overdue counting as today', () => {
    const rows = [p(1, 1, NOW - 48 * HOUR), p(2, 2, NOW + 2 * HOUR), p(3, 4, startOfDay(NOW) + 30 * HOUR)];
    expect(forecast(rows, NOW, 3)).toEqual([2, 1, 0]);
  });
});

describe('pickDistractors', () => {
  const keywordOf = (f: number) => KANJI[f - 1].keyword;

  it('returns three distinct wrong answers, preferring nearby started kanji', () => {
    const started = new Set([90, 95, 100, 105, 110]);
    const picks = pickDistractors(100, keywordOf, started, TOTAL, () => 0.3);
    expect(picks).toHaveLength(3);
    expect(picks).not.toContain(100);
    expect(picks.every((f) => started.has(f))).toBe(true);
    expect(new Set(picks.map(keywordOf)).size).toBe(3);
  });

  it('still finds options at the very start of the book', () => {
    expect(pickDistractors(1, keywordOf, new Set(), TOTAL)).toHaveLength(3);
  });
});

describe('streak', () => {
  const day = (offset: number) => dayKey(NOW + offset * 24 * HOUR);

  it('counts consecutive days and does not break before today is done', () => {
    expect(streak(new Set([day(0), day(-1), day(-2)]), NOW)).toBe(3);
    expect(streak(new Set([day(-1), day(-2)]), NOW)).toBe(2);
    expect(streak(new Set(), NOW)).toBe(0);
  });

  it('forgives one rest day a week', () => {
    expect(streak(new Set([day(0), day(-2), day(-3)]), NOW)).toBe(3);
    expect(streak(new Set([day(0), day(-2), day(-4)]), NOW)).toBe(2);
  });
});
