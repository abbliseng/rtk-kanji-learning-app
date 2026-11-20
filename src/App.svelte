<script lang="ts">
  import BottomBar from './components/BottomBar.svelte';
  import Grid from './components/Grid.svelte';
  import Home from './components/Home.svelte';
  import KanjiDetail from './components/KanjiDetail.svelte';
  import Lesson from './components/Lesson.svelte';
  import ReviewSession from './components/ReviewSession.svelte';
  import Settings from './components/Settings.svelte';
  import { app, start } from './lib/state.svelte';

  start();
</script>

{#if !app.ready}
  <div class="splash kanji" aria-hidden="true">漢</div>
{:else if app.screen === 'review'}
  <ReviewSession onclose={() => (app.screen = null)} />
{:else if app.screen === 'lesson'}
  <Lesson onclose={() => (app.screen = null)} />
{:else}
  <main>
    {#if app.tab === 'home'}
      <Home />
    {:else if app.tab === 'grid'}
      <Grid />
    {:else}
      <Settings />
    {/if}
  </main>
  <BottomBar />
{/if}

{#if app.detail !== null}
  <KanjiDetail frame={app.detail} onclose={() => (app.detail = null)} />
{/if}

<style>
  .splash {
    display: grid;
    place-items: center;
    min-height: 100dvh;
    font-size: 4rem;
    opacity: 0.3;
  }

  main {
    max-width: 640px;
    margin: 0 auto;
    padding: calc(16px + env(safe-area-inset-top)) 16px calc(var(--bar-height) + 24px + env(safe-area-inset-bottom));
  }
</style>
