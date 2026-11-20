<script lang="ts">
  import { normalize } from '../lib/answer';
  import { LESSONS, TOTAL } from '../lib/kanji';
  import { isLearned, stageGroup } from '../lib/srs';
  import { app, store } from '../lib/state.svelte';

  let query = $state('');
  let filter = $state<'all' | 'learned' | 'started'>('all');

  const learnedCount = $derived([...store.progress.values()].filter((p) => isLearned(p.stage)).length);
  const stage = (frame: number) => store.progress.get(frame)?.stage ?? 0;

  const visible = $derived.by(() => {
    const q = query.trim();
    const qn = normalize(q);
    return LESSONS.map((l) => ({
      lesson: l.lesson,
      frames: l.frames.filter((k) => {
        const s = stage(k.frame);
        if (filter === 'learned' && !isLearned(s)) return false;
        if (filter === 'started' && s === 0) return false;
        if (!q) return true;
        return k.kanji === q || String(k.frame) === q || (qn !== '' && normalize(k.keyword).includes(qn));
      })
    })).filter((l) => l.frames.length);
  });
</script>

<header>
  <h1>{learnedCount} <span class="muted">/ {TOTAL.toLocaleString('en')} learned</span></h1>
  <input type="search" placeholder="Keyword, kanji or frame number" bind:value={query} />
  <div class="filters" role="radiogroup">
    {#each [['all', 'All'], ['started', 'Started'], ['learned', 'Learned']] as [id, label] (id)}
      <button
        class="btn small"
        class:on={filter === id}
        role="radio"
        aria-checked={filter === id}
        onclick={() => (filter = id as typeof filter)}>{label}</button
      >
    {/each}
  </div>
</header>

{#each visible as l (l.lesson)}
  <section>
    <h2 class="muted small">Lesson {l.lesson}</h2>
    <div class="grid">
      {#each l.frames as k (k.frame)}
        <button class="cell kanji s-{stageGroup(stage(k.frame))}" onclick={() => (app.detail = k.frame)} aria-label="{k.frame} {k.keyword}"
          >{k.kanji}</button
        >
      {/each}
    </div>
  </section>
{:else}
  <p class="muted">Nothing matches.</p>
{/each}

<style>
  header {
    display: grid;
    gap: 10px;
    margin-bottom: 16px;
  }

  h1 {
    font-size: 1.5rem;
  }

  h1 .muted {
    font-size: 1rem;
    font-weight: 500;
  }

  .filters {
    display: flex;
    gap: 6px;
  }

  .filters .btn {
    padding: 6px 12px;
  }

  .filters .on {
    background: var(--text);
    color: var(--bg);
  }

  section {
    margin-bottom: 14px;
  }

  h2 {
    font-weight: 600;
    margin-bottom: 4px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(10, 1fr);
  }

  .cell {
    aspect-ratio: 1;
    background: none;
    border: none;
    padding: 0;
    font-size: clamp(1rem, 5.6vw, 1.75rem);
    font-family: var(--kanji-sans);
    color: var(--text);
    cursor: pointer;
  }

  .s-locked {
    opacity: var(--shade-locked);
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
</style>
