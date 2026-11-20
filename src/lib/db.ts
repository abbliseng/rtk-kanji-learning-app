import Dexie, { type Table } from 'dexie';

/** One row per kanji you have started. Frames without a row are not started (stage 0). */
export interface Progress {
  frame: number;
  stage: number;
  /** Epoch ms when due, null once burned. */
  nextReview: number | null;
  unlockedAt: number;
  myStory?: string;
}

export interface ReviewLog {
  id?: number;
  frame: number;
  at: number;
  mode: 'choice' | 'typed' | 'lesson';
  correct: boolean;
  typed?: string;
  stageBefore: number;
  stageAfter: number;
  /** Set when a wrong answer was flipped with "I knew that". */
  overridden?: boolean;
}

/** Heisig's text for a frame, imported from your private book file. Never shipped with the app. */
export interface BookStory {
  frame: number;
  story: string;
}

export interface BookPrimitive {
  id?: number;
  name: string;
  afterFrame: number;
  text: string;
}

export interface KeyValue {
  key: string;
  value: unknown;
}

class RtkDb extends Dexie {
  progress!: Table<Progress, number>;
  reviewLog!: Table<ReviewLog, number>;
  book!: Table<BookStory, number>;
  primitives!: Table<BookPrimitive, number>;
  kv!: Table<KeyValue, string>;

  constructor() {
    super('rtk-trainer');
    this.version(1).stores({
      progress: 'frame, nextReview',
      reviewLog: '++id, frame, at',
      book: 'frame',
      primitives: '++id, afterFrame',
      kv: 'key'
    });
  }
}

export const db = new RtkDb();
