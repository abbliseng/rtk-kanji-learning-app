<script lang="ts">
  import { byFrame, TOTAL } from '../lib/kanji';
  import { dueFrames, lessonsLeftToday, startOfDay } from '../lib/session';
  import { stageGroup, type StageGroup } from '../lib/srs';
  import { app, schedulerNow, setVacation, store } from '../lib/state.svelte';
  import { streak } from '../lib/stats';
  import Forecast from './Forecast.svelte';

  const now = $derived(schedulerNow());
  const due = $derived(dueFrames(store.progress.values(), now));
  const lessons = $derived(lessonsLeftToday(store.progress, app.settings, due.length, TOTAL, app.now));
  const todayKanji = $derived(
    [...store.progress.values()].filter((p) => p.unlockedAt >= startOfDay(app.now)).map((p) => p.frame).sort((a, b) => a - b)
  );
  const streakDays = $derived(streak(new Set(app.activeDays), app.now));
  const groups = $derived.by(() => {
    const counts: Record<StageGroup, number> = { locked: 0, apprentice: 0, guru: 0, master: 0, enlightened: 0, burned: 0 };
    for (const p of store.progress.values()) counts[stageGroup(p.stage)]++;
    counts.locked = TOTAL - store.progress.size;
    return counts;
  });
  /** Remind once a week, counting from the last backup or, before the first one, from day one. */
  const backupDue = $derived.by(() => {
    if (store.progress.size === 0) return false;
    const since = app.settings.lastBackupAt ?? Math.min(...[...store.progress.values()].map((p) => p.unlockedAt));
    return since < app.now - 7 * 86_400_000;
  });
  const blockedByBacklog = $derived(due.length > app.settings.backlogLimit && store.progress.size < TOTAL);
</script>

<header>
  <p class="muted small">{streakDays > 0 ? `${streakDays}-day streak` : 'Start a streak today'}</p>
  <h1 class="kanji">今日</h1>
</header>

{#if app.settings.vacationSince !== null}
  <div class="banner">
    Vacation mode is on: no reviews come due.
    <button class="btn btn-quiet small" onclick={() => setVacation(false)}>Turn off</button>
  </div>
{/if}
{#if app.bookCount === 0}
  <div class="banner">Heisig's stories aren't imported yet. <button class="btn btn-quiet small" onclick={() => (app.tab = 'settings')}>Settings</button></div>
{/if}
{#if backupDue}
  <div class="banner">Time for a backup: it's been over a week. <button class="btn btn-quiet small" onclick={() => (app.tab = 'settings')}>Back up</button></div>
{/if}

<div class="actions">
  <button class="action card" disabled={due.length === 0} onclick={() => (app.screen = 'review')}>
    <span class="count">{due.length}</span>
    <span>Reviews</span>
  </button>
  <button class="action card" disabled={lessons === 0} onclick={() => (app.screen = 'lesson')}>
    <span class="count">{lessons}</span>
    <span>New kanji</span>
  </button>
</div>
{#if blockedByBacklog}
  <p class="muted small note">New kanji are paused until fewer than {app.settings.backlogLimit} reviews are waiting.</p>
{/if}

{#if todayKanji.length}
  <section class="card">
    <h2>Started today</h2>
    <div class="today">
      {#each todayKanji as f (f)}
        <button class="kanji mini" onclick={() => (app.detail = f)} aria-label={byFrame(f).keyword}>{byFrame(f).kanji}</button>
      {/each}
    </div>
  </section>
{/if}

<Forecast />

<section class="card">
  <h2>Progress</h2>
  <div class="split" aria-hidden="true">
    {#each ['burned', 'enlightened', 'master', 'guru', 'apprentice'] as g (g)}
      <div class="seg s-{g}" style="flex-grow: {groups[g as StageGroup]}"></div>
    {/each}
    <div class="seg s-locked" style="flex-grow: {groups.locked}"></div>
  </div>
  <dl>
    <div><dt>Apprentice</dt><dd>{groups.apprentice}</dd></div>
    <div><dt>Guru</dt><dd>{groups.guru}</dd></div>
    <div><dt>Master</dt><dd>{groups.master}</dd></div>
    <div><dt>Enlightened</dt><dd>{groups.enlightened}</dd></div>
    <div><dt>Burned</dt><dd>{groups.burned}</dd></div>
    <div><dt>Not started</dt><dd>{groups.locked}</dd></div>
  </dl>
</section>

<style>
  header {
    display: grid;
    gap: 8px;
    margin-bottom: 16px;
  }

  h1 {
    font-size: 2.6rem;
    line-height: 1.1;
  }

  h2 {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
    margin-bottom: 12px;
  }

  .banner {
    margin-bottom: 10px;
  }

  .banner .btn {
    padding: 2px 6px;
    color: var(--accent);
  }

  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin: 6px 0 8px;
  }

  .action {
    display: grid;
    gap: 2px;
    text-align: left;
    cursor: pointer;
    font-weight: 600;
  }

  .action:not(:disabled) {
    border-color: var(--accent);
  }

  .action:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .count {
    font-size: 2.2rem;
  }

  .note {
    margin-bottom: 8px;
  }

  section {
    margin-top: 14px;
  }

  .today {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .mini {
    font-size: 1.8rem;
    background: none;
    border: none;
    padding: 2px;
    cursor: pointer;
  }

  .split {
    display: flex;
    height: 10px;
    border-radius: 5px;
    overflow: hidden;
    background: var(--surface-2);
    margin-bottom: 12px;
  }

  .seg {
    background: var(--text);
  }

  .s-apprentice {
    opacity: var(--shade-apprentice);
  }
  .s-guru {
    opacity: var(--shade-guru);
  }
  .s-master {
    opacity: var(--shade-master);
  }
  .s-enlightened {
    opacity: var(--shade-enlightened);
  }
  .s-burned {
    opacity: var(--shade-burned);
  }
  .s-locked {
    opacity: 0;
  }

  dl {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin: 0;
  }

  dt {
    font-size: 0.75rem;
    color: var(--muted);
  }

  dd {
    margin: 0;
    font-weight: 600;
  }
</style>
