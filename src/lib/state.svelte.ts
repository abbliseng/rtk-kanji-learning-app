import { db, type BookPrimitive, type Progress, type ReviewLog } from './db';
import { TOTAL } from './kanji';
import { DEFAULT_SETTINGS, type Settings } from './session';
import { nextReviewAt, nextStage } from './srs';
import { dayKey } from './stats';

export type Tab = 'home' | 'grid' | 'settings';
export type Screen = null | 'review' | 'lesson';

export const app = $state({
  ready: false,
  tab: 'home' as Tab,
  screen: null as Screen,
  now: Date.now(),
  settings: { ...DEFAULT_SETTINGS } as Settings,
  /** Number of stories in the imported book data (0 = not imported). */
  bookCount: 0,
  activeDays: [] as string[],
  /** Frame shown in the detail sheet, or null. */
  detail: null as number | null
});

/** Replaced (not mutated) on every change so Svelte notices. */
export const store = $state({ progress: new Map<number, Progress>() });

/** The clock the scheduler uses: frozen while vacation mode is on. */
export const schedulerNow = () => app.settings.vacationSince ?? app.now;

let clockStarted = false;

export async function start(): Promise<void> {
  const [progress, settings, activeDays, bookCount] = await Promise.all([
    db.progress.toArray(),
    db.kv.get('settings'),
    db.kv.get('activeDays'),
    db.book.count()
  ]);
  store.progress = new Map(progress.map((p) => [p.frame, p]));
  app.settings = { ...DEFAULT_SETTINGS, ...((settings?.value as Partial<Settings>) ?? {}) };
  app.activeDays = (activeDays?.value as string[]) ?? [];
  app.bookCount = bookCount;
  app.ready = true;
  if (clockStarted) return;
  clockStarted = true;
  setInterval(() => (app.now = Date.now()), 30_000);
  document.addEventListener('visibilitychange', () => (app.now = Date.now()));
  navigator.storage?.persist?.().catch(() => {});
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  app.settings = { ...app.settings, ...patch };
  await db.kv.put({ key: 'settings', value: $state.snapshot(app.settings) });
}

async function markActiveToday(): Promise<void> {
  const today = dayKey(Date.now());
  if (app.activeDays.includes(today)) return;
  app.activeDays = [...app.activeDays, today];
  await db.kv.put({ key: 'activeDays', value: $state.snapshot(app.activeDays) });
}

function setProgress(rows: Progress[]): void {
  const next = new Map(store.progress);
  for (const p of rows) next.set(p.frame, p);
  store.progress = next;
}

export async function logAnswer(entry: Omit<ReviewLog, 'id'>): Promise<number> {
  return db.reviewLog.add(entry);
}

/** Lesson quiz passed: the kanji enter the review queue at Apprentice 1. */
export async function completeLessons(frames: number[]): Promise<void> {
  const now = schedulerNow();
  const rows: Progress[] = [];
  for (const frame of frames) {
    rows.push({
      frame,
      stage: 1,
      nextReview: nextReviewAt(1, now),
      unlockedAt: Date.now(),
      myStory: await pendingStory(frame)
    });
  }
  await db.progress.bulkPut(rows);
  await db.kv.bulkDelete(frames.map((f) => `story:${f}`));
  setProgress(rows);
  await markActiveToday();
}

/** A review item is finished (answered right, possibly after misses). Returns the new stage. */
export async function completeReview(frame: number, wrongInSession: boolean): Promise<number> {
  const current = store.progress.get(frame);
  if (!current) return 0;
  const stage = nextStage(current.stage, wrongInSession);
  const row = { ...current, stage, nextReview: nextReviewAt(stage, schedulerNow()) };
  await db.progress.put(row);
  setProgress([row]);
  await markActiveToday();
  return stage;
}

export async function setMyStory(frame: number, text: string): Promise<void> {
  const current = store.progress.get(frame);
  const myStory = text.trim() || undefined;
  if (current) {
    const row = { ...current, myStory };
    await db.progress.put(row);
    setProgress([row]);
  } else {
    // Stories can be written before a kanji is started; keep them in kv until then.
    await db.kv.put({ key: `story:${frame}`, value: myStory });
  }
}

export async function pendingStory(frame: number): Promise<string | undefined> {
  return store.progress.get(frame)?.myStory ?? ((await db.kv.get(`story:${frame}`))?.value as string | undefined);
}

/** Vacation mode freezes every timer; switching it off shifts all reviews by the time away. */
export async function setVacation(on: boolean): Promise<void> {
  if (on) return saveSettings({ vacationSince: Date.now() });
  const since = app.settings.vacationSince;
  if (since === null) return;
  const shift = Date.now() - since;
  const rows = [...store.progress.values()].map((p) =>
    p.nextReview === null ? p : { ...p, nextReview: p.nextReview + shift }
  );
  await db.progress.bulkPut(rows);
  setProgress(rows);
  await saveSettings({ vacationSince: null });
}

// ---------- Book data (private import) ----------

export interface BookFile {
  edition: number;
  frames: { frame: number; story: string }[];
  primitives: { name: string; afterFrame: number; text: string }[];
  lessonIntros: Record<string, string>;
}

export async function importBook(file: BookFile): Promise<number> {
  if (file.edition !== 6 || !Array.isArray(file.frames) || file.frames.length !== TOTAL) {
    throw new Error('This is not a 6th-edition book file made by scripts/extract_book.py.');
  }
  await db.transaction('rw', db.book, db.primitives, db.kv, async () => {
    await db.book.clear();
    await db.primitives.clear();
    await db.book.bulkPut(file.frames.filter((f) => f.story).map((f) => ({ frame: f.frame, story: f.story })));
    await db.primitives.bulkAdd(file.primitives.map((p) => ({ name: p.name, afterFrame: p.afterFrame, text: p.text })));
    await db.kv.put({ key: 'lessonIntros', value: file.lessonIntros });
  });
  app.bookCount = await db.book.count();
  return app.bookCount;
}

export async function clearBook(): Promise<void> {
  await db.book.clear();
  await db.primitives.clear();
  await db.kv.delete('lessonIntros');
  app.bookCount = 0;
}

export async function bookStory(frame: number): Promise<{ story?: string; primitives: BookPrimitive[] }> {
  const [row, primitives] = await Promise.all([
    db.book.get(frame),
    db.primitives.where('afterFrame').equals(frame - 1).toArray()
  ]);
  return { story: row?.story, primitives };
}

export async function lessonIntro(lesson: number): Promise<string | undefined> {
  const intros = (await db.kv.get('lessonIntros'))?.value as Record<string, string> | undefined;
  return intros?.[String(lesson)];
}

// ---------- Backup ----------

export async function exportBackup(): Promise<Blob> {
  const [progress, reviewLog, pending] = await Promise.all([
    db.progress.toArray(),
    db.reviewLog.toArray(),
    db.kv.filter((kv) => kv.key.startsWith('story:')).toArray()
  ]);
  const backup = {
    app: 'rtk-trainer',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: $state.snapshot(app.settings),
    activeDays: $state.snapshot(app.activeDays),
    progress,
    reviewLog,
    pendingStories: pending
  };
  await saveSettings({ lastBackupAt: Date.now() });
  return new Blob([JSON.stringify(backup)], { type: 'application/json' });
}

export async function importBackup(text: string): Promise<void> {
  const data = JSON.parse(text);
  if (data?.app !== 'rtk-trainer' || !Array.isArray(data.progress)) {
    throw new Error('This is not a backup file from this app.');
  }
  await db.transaction('rw', db.progress, db.reviewLog, db.kv, async () => {
    await db.progress.clear();
    await db.reviewLog.clear();
    await db.progress.bulkPut(data.progress);
    await db.reviewLog.bulkPut(data.reviewLog ?? []);
    for (const kv of data.pendingStories ?? []) await db.kv.put(kv);
    await db.kv.put({ key: 'activeDays', value: data.activeDays ?? [] });
    await db.kv.put({ key: 'settings', value: { ...DEFAULT_SETTINGS, ...data.settings } });
  });
  await start();
}
