<script lang="ts">
  import { app, type Tab } from '../lib/state.svelte';

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'home', label: 'Today', icon: '今' },
    { id: 'grid', label: 'Kanji', icon: '漢' },
    { id: 'settings', label: 'Settings', icon: '設' }
  ];
</script>

<nav class="bar">
  <div class="tabs" role="tablist">
  {#each tabs as tab (tab.id)}
    <button
      role="tab"
      aria-selected={app.tab === tab.id}
      class:active={app.tab === tab.id}
      onclick={() => (app.tab = tab.id)}
    >
      <span class="icon kanji" aria-hidden="true">{tab.icon}</span>
      <span class="label">{tab.label}</span>
    </button>
  {/each}
  </div>
</nav>

<style>
  .bar {
    position: fixed;
    inset: auto 0 0 0;
    z-index: 20;
    display: flex;
    justify-content: center;
    gap: 8px;
    padding: 6px 16px calc(6px + env(safe-area-inset-bottom));
    background: color-mix(in srgb, var(--bg) 88%, transparent);
    backdrop-filter: blur(14px);
    border-top: 1px solid var(--border);
  }

  .tabs {
    display: flex;
    justify-content: center;
    gap: 8px;
    width: 100%;
    max-width: 420px;
  }

  button {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 6px 0;
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
  }

  .icon {
    font-size: 1.35rem;
  }

  .label {
    font-size: 0.7rem;
    font-weight: 600;
  }

  .active {
    color: var(--text);
  }
</style>
