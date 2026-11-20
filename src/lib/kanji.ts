import data from '../data/rtk6.json';
import { buildKeywordIndex } from './answer';

export interface Kanji {
  frame: number;
  kanji: string;
  keyword: string;
  lesson: number;
  strokes: number | null;
  parts: string[];
}

/** All 2,200 frames of RTK vol. 1, 6th edition, in book order (index = frame - 1). */
export const KANJI = data as Kanji[];
export const TOTAL = KANJI.length;
export const byFrame = (frame: number) => KANJI[frame - 1];
export const keywordIndex = buildKeywordIndex(KANJI);

export const LESSONS: { lesson: number; frames: Kanji[] }[] = [];
for (const k of KANJI) {
  const last = LESSONS.at(-1);
  if (last?.lesson === k.lesson) last.frames.push(k);
  else LESSONS.push({ lesson: k.lesson, frames: [k] });
}
