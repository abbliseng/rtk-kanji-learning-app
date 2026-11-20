import { describe, expect, it } from 'vitest';
import { BURNED, isLearned, nextReviewAt, nextStage, reviewMode, stageGroup, stageName } from '../src/lib/srs';

describe('nextStage', () => {
  it('moves up one stage on a clean answer', () => {
    expect(nextStage(1, false)).toBe(2);
    expect(nextStage(8, false)).toBe(BURNED);
    expect(nextStage(BURNED, false)).toBe(BURNED);
  });

  it('drops one stage below Guru and two from Guru up', () => {
    expect(nextStage(4, true)).toBe(3);
    expect(nextStage(5, true)).toBe(3);
    expect(nextStage(8, true)).toBe(6);
  });

  it('never drops below Apprentice 1', () => {
    expect(nextStage(1, true)).toBe(1);
    expect(nextStage(2, true)).toBe(1);
  });
});

describe('scheduling', () => {
  it('uses the WaniKani intervals', () => {
    const h = 3_600_000;
    expect(nextReviewAt(1, 0)).toBe(4 * h);
    expect(nextReviewAt(4, 0)).toBe(48 * h);
    expect(nextReviewAt(8, 0)).toBe(120 * 24 * h);
    expect(nextReviewAt(BURNED, 0)).toBeNull();
  });

  it('switches from multiple choice to typing after mcStages', () => {
    expect(reviewMode(1, 2)).toBe('choice');
    expect(reviewMode(2, 2)).toBe('choice');
    expect(reviewMode(3, 2)).toBe('typed');
    expect(reviewMode(1, 0)).toBe('typed');
  });
});

describe('names', () => {
  it('names and groups stages', () => {
    expect(stageName(0)).toBe('Not started');
    expect(stageName(3)).toBe('Apprentice 3');
    expect(stageName(6)).toBe('Guru 2');
    expect(stageGroup(7)).toBe('master');
    expect(isLearned(4)).toBe(false);
    expect(isLearned(5)).toBe(true);
  });
});
