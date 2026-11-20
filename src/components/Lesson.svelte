<script lang="ts">
  import { byFrame, LESSONS, TOTAL } from '../lib/kanji';
  import { dueFrames, lessonsLeftToday, nextLessonFrames } from '../lib/session';
  import { app, completeLessons, lessonIntro, schedulerNow, store } from '../lib/state.svelte';
  import Quiz from './Quiz.svelte';
  import StoryPanel from './StoryPanel.svelte';

  let { onclose }: { onclose: () => void } = $props();

  const lessonStart = new Set(LESSONS.map((l) => l.frames[0].frame));

  function nextBatch(): number[] {
    const due = dueFrames(store.progress.values(), schedulerNow()).length;
    const left = lessonsLeftToday(store.progress, app.settings, due, TOTAL, app.now);
    return nextLessonFrames(store.progress, Math.min(app.settings.batchSize, left), TOTAL);
  }

  let batch = $state(nextBatch());
  let index = $state(0);
  let phase = $state<'learn' | 'quiz' | 'done'>('learn');
  let intro = $state<string | undefined>();
  let more = $state(0);

  const k = $derived(batch[index] !== undefined ? byFrame(batch[index]) : undefined);

  $effect(() => {
    intro = undefined;
    if (k && lessonStart.has(k.frame)) lessonIntro(k.lesson).then((t) => (intro = t));
  });

  async function finishQuiz() {
    await completeLessons(batch);
    more = nextBatch().length;
    phase = 'done';
  }

  function again() {
    batch = nextBatch();
    index = 0;
    phase = 'learn';
  }
</script>

{#if batch.length === 0}
  <div class="center">
    <h1>No new kanji right now</h1>
    <p class="muted">You've reached today's limit, or reviews need clearing first.</p>
    <button class="btn btn-primary" onclick={onclose}>Back</button>
  </div>
{:else if phase === 'learn' && k}
  <div class="learn">
    <header>
      <button class="btn btn-quiet" onclick={onclose} aria-label="Quit">✕</button>
      <span class="muted small">New kanji {index + 1} of {batch.length}</span>
    </header>

    {#if intro}
      <details class="card intro" open>
        <summary>Lesson {k.lesson}</summary>
        <p class="story small">{intro}</p>
      </details>
    {/if}

    <div class="hero">
      <span class="kanji big">{k.kanji}</span>
      <h1>{k.keyword}</h1>
      <p class="muted small">Frame {k.frame} · Lesson {k.lesson}{k.strokes ? ` · ${k.strokes} stroke${k.strokes === 1 ? '' : 's'}` : ''}</p>
    </div>

    <div class="card"><StoryPanel frame={k.frame} /></div>

    <div class="nav">
      <button class="btn" disabled={index === 0} onclick={() => index--}>Back</button>
      {#if index < batch.length - 1}
        <button class="btn btn-primary" onclick={() => index++}>Next</button>
      {:else}
        <button class="btn btn-primary" onclick={() => (phase = 'quiz')}>Quiz me</button>
      {/if}
    </div>
  </div>
{:else if phase === 'quiz'}
  <Quiz
    frames={batch}
    title="Lesson quiz"
    kind="lesson"
    modeOf={() => 'choice'}
    onitemdone={async () => {}}
    onfinish={finishQuiz}
    onquit={onclose}
    extraStarted={batch}
  />
{:else}
  <div class="center">
    <div class="row">
      {#each batch as f (f)}<span class="kanji mid">{byFrame(f).kanji}</span>{/each}
    </div>
    <h1>Added to your reviews</h1>
    <p class="muted">First review in about 4 hours.</p>
    {#if more > 0}
      <button class="btn btn-primary" onclick={again}>Next {more} kanji</button>
    {/if}
    <button class="btn" onclick={onclose}>Back to today</button>
  </div>
{/if}

<style>
  .learn {
    max-width: 640px;
    margin: 0 auto;
    padding: calc(8px + env(safe-area-inset-top)) 16px calc(24px + env(safe-area-inset-bottom));
    display: grid;
    gap: 16px;
  }

  header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  header .btn {
    padding: 8px;
  }

  .intro summary {
    font-weight: 600;
    cursor: pointer;
  }

  .intro p {
    margin-top: 8px;
  }

  .hero {
    display: grid;
    justify-items: center;
    gap: 8px;
    text-align: center;
  }

  .big {
    font-size: 7rem;
  }

  .nav {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 10px;
  }

  .center {
    min-height: 100dvh;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 12px;
    text-align: center;
    padding: 24px;
  }

  .row {
    display: flex;
    gap: 10px;
  }

  .mid {
    font-size: 2.6rem;
  }
</style>
