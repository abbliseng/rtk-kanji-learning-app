<script lang="ts">
  import { dueFrames } from '../lib/session';
  import { reviewMode } from '../lib/srs';
  import { app, completeReview, schedulerNow, store } from '../lib/state.svelte';
  import Quiz from './Quiz.svelte';

  let { onclose }: { onclose: () => void } = $props();

  /** Fixed when the session starts; reviews that come due meanwhile wait for the next one. */
  const frames = dueFrames(store.progress.values(), schedulerNow());
  let done = $state(false);
</script>

{#if done || frames.length === 0}
  <div class="done">
    <p class="kanji big">済</p>
    <h1>All caught up</h1>
    <p class="muted">{frames.length} reviews done.</p>
    <button class="btn btn-primary" onclick={onclose}>Back to today</button>
  </div>
{:else}
  <Quiz
    {frames}
    title="Reviews"
    kind="review"
    modeOf={(f) => reviewMode(store.progress.get(f)?.stage ?? 1, app.settings.mcStages)}
    onitemdone={(f, wrong) => completeReview(f, wrong)}
    onfinish={() => (done = true)}
    onquit={onclose}
  />
{/if}

<style>
  .done {
    min-height: 100dvh;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 12px;
    text-align: center;
    padding: 24px;
  }

  .big {
    font-size: 5rem;
  }
</style>
