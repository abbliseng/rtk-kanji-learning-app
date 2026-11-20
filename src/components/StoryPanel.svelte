<script lang="ts">
  import type { BookPrimitive } from '../lib/db';
  import { byFrame } from '../lib/kanji';
  import { app, bookStory, pendingStory, setMyStory } from '../lib/state.svelte';

  let { frame, compact = false }: { frame: number; compact?: boolean } = $props();

  const k = $derived(byFrame(frame));
  let story = $state<string | undefined>();
  let loaded = $state(false);
  let primitives = $state<BookPrimitive[]>([]);
  let mine = $state('');
  let editing = $state(false);
  let showBook = $state(true);

  $effect(() => {
    const f = frame;
    void app.bookCount; // reload after an import
    loaded = false;
    bookStory(f).then((r) => {
      story = r.story;
      primitives = r.primitives;
      loaded = true;
    });
    pendingStory(f).then((s) => {
      mine = s ?? '';
      editing = false;
      showBook = !compact || !s;
    });
  });

  async function save() {
    await setMyStory(frame, mine);
    editing = false;
  }
</script>

<div class="panel">
  {#if k.parts.length}
    <p class="parts small"><span class="muted">Parts:</span> {k.parts.join(' · ')}</p>
  {/if}

  <section>
    <div class="head">
      <h3>My story</h3>
      {#if !editing}
        <button class="btn btn-quiet small" onclick={() => (editing = true)}>{mine ? 'Edit' : 'Write'}</button>
      {/if}
    </div>
    {#if editing}
      <!-- svelte-ignore a11y_autofocus -->
      <textarea bind:value={mine} rows="4" autofocus placeholder="Your own story for “{k.keyword}”"></textarea>
      <div class="row">
        <button class="btn btn-primary" onclick={save}>Save</button>
        <button class="btn btn-quiet" onclick={() => (editing = false)}>Cancel</button>
      </div>
    {:else if mine}
      <p class="story">{mine}</p>
    {:else}
      <p class="muted small">No story of your own yet.</p>
    {/if}
  </section>

  <section>
    <div class="head">
      <h3>Heisig</h3>
      {#if compact && story}
        <button class="btn btn-quiet small" onclick={() => (showBook = !showBook)}>{showBook ? 'Hide' : 'Show'}</button>
      {/if}
    </div>
    {#if showBook && loaded}
      {#each primitives as p (p.id)}
        <div class="primitive small">
          <p class="muted">New primitive: <strong>{p.name}</strong></p>
          <p class="story">{p.text}</p>
        </div>
      {/each}
      {#if story}
        <p class="story">{story}</p>
      {:else if app.bookCount === 0}
        <p class="muted small">Import your book data in Settings to see Heisig's stories here.</p>
      {:else}
        <p class="muted small">The book has no story for this frame. Write your own above.</p>
      {/if}
    {/if}
    <a class="small" href="https://kanji.koohii.com/study/kanji/{encodeURIComponent(k.kanji)}" target="_blank" rel="noreferrer"
      >Community stories on Kanji Koohii ↗</a
    >
  </section>
</div>

<style>
  .panel {
    display: grid;
    gap: 16px;
  }

  section {
    display: grid;
    gap: 8px;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  h3 {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
  }

  .head .btn {
    padding: 2px 6px;
  }

  .row {
    display: flex;
    gap: 8px;
  }

  .primitive {
    border-left: 2px solid var(--border);
    padding-left: 10px;
    display: grid;
    gap: 4px;
  }

  a {
    color: var(--accent);
    text-decoration: none;
  }
</style>
