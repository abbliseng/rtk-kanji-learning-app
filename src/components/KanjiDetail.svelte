<script lang="ts">
  import { relativeTime } from '../lib/format';
  import { byFrame } from '../lib/kanji';
  import { stageName } from '../lib/srs';
  import { schedulerNow, store } from '../lib/state.svelte';
  import StoryPanel from './StoryPanel.svelte';

  let { frame, onclose }: { frame: number; onclose: () => void } = $props();

  const k = $derived(byFrame(frame));
  const p = $derived(store.progress.get(frame));
</script>

<div class="backdrop" onclick={onclose} role="presentation"></div>
<div class="sheet" role="dialog" aria-modal="true" aria-label="{k.kanji} {k.keyword}">
  <button class="close btn btn-quiet" onclick={onclose} aria-label="Close">✕</button>
  <div class="top">
    <span class="kanji big">{k.kanji}</span>
    <div>
      <h2>{k.keyword}</h2>
      <p class="muted small">
        Frame {k.frame} · Lesson {k.lesson}{k.strokes ? ` · ${k.strokes} stroke${k.strokes === 1 ? '' : 's'}` : ''}
      </p>
      <p class="small">
        {stageName(p?.stage ?? 0)}{#if p && p.stage > 0}<span class="muted">
            · next review {relativeTime(p.nextReview, schedulerNow())}</span
          >{/if}
      </p>
    </div>
  </div>
  <StoryPanel {frame} />
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: rgb(0 0 0 / 0.5);
  }

  .sheet {
    position: fixed;
    z-index: 41;
    inset: auto 0 0 0;
    max-height: 88dvh;
    overflow-y: auto;
    max-width: 640px;
    margin: 0 auto;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    padding: 20px 18px calc(24px + env(safe-area-inset-bottom));
    display: grid;
    gap: 18px;
  }

  .close {
    position: absolute;
    top: 8px;
    right: 8px;
  }

  .top {
    display: flex;
    gap: 18px;
    align-items: center;
  }

  .big {
    font-size: 4.5rem;
  }

  h2 {
    font-size: 1.4rem;
  }
</style>
