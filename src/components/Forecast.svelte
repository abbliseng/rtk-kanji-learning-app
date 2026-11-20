<script lang="ts">
  import { WEEKDAYS } from '../lib/format';
  import { forecast, hourlyForecast, startOfDay } from '../lib/session';
  import { app, schedulerNow, store } from '../lib/state.svelte';

  /** Day shown by hour (0 = today), or null for the 7-day view. */
  let selected = $state<number | null>(null);

  const now = $derived(schedulerNow());
  const days = $derived(forecast(store.progress.values(), now, 7));
  const maxDay = $derived(Math.max(1, ...days));
  const hours = $derived(selected === null ? [] : hourlyForecast(store.progress.values(), now, selected));
  const maxHour = $derived(Math.max(1, ...hours));
  const currentHour = $derived(new Date(now).getHours());

  function dayDate(offset: number): Date {
    const d = new Date(startOfDay(app.now));
    d.setDate(d.getDate() + offset);
    return d;
  }

  const dayLabel = (i: number) => (i === 0 ? 'Today' : WEEKDAYS[dayDate(i).getDay()]);
  const longLabel = (i: number) =>
    i === 0 ? 'Today' : dayDate(i).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
</script>

<section class="card">
  {#if selected === null}
    <h2>Next 7 days</h2>
    <div class="days">
      {#each days as n, i (i)}
        <button class="col" onclick={() => (selected = i)} aria-label="{longLabel(i)}: {n} reviews, show by hour">
          <span class="n small">{n}</span>
          <div class="bar" style="height: {(n / maxDay) * 64}px"></div>
          <span class="muted small">{dayLabel(i)}</span>
        </button>
      {/each}
    </div>
  {:else}
    <button class="hourly" onclick={() => (selected = null)} aria-label="Back to the 7-day view">
      <h2>{longLabel(selected)} · {days[selected]} reviews <span class="back">✕</span></h2>
      <div class="hours">
        {#each hours as n, h (h)}
          <div class="hour" class:past={selected === 0 && h < currentHour}>
            <span class="n tiny">{n || ''}</span>
            <div class="bar" style="height: {(n / maxHour) * 64}px"></div>
            <span class="muted tiny">{h % 6 === 0 ? String(h).padStart(2, '0') : ''}</span>
          </div>
        {/each}
      </div>
    </button>
  {/if}
</section>

<style>
  section {
    margin-top: 14px;
  }

  h2 {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
    margin-bottom: 12px;
    display: flex;
    justify-content: space-between;
  }

  button {
    background: none;
    border: none;
    padding: 0;
    color: inherit;
    cursor: pointer;
    text-align: left;
  }

  .days {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    align-items: end;
    gap: 6px;
  }

  .col,
  .hour {
    display: grid;
    justify-items: center;
    align-content: end;
    gap: 4px;
  }

  .hourly {
    display: block;
    width: 100%;
  }

  .back {
    font-size: 0.9rem;
    letter-spacing: 0;
  }

  .hours {
    display: grid;
    grid-template-columns: repeat(24, 1fr);
    align-items: end;
    gap: 2px;
  }

  .bar {
    width: 100%;
    min-height: 2px;
    border-radius: 4px;
    background: var(--accent);
    opacity: 0.8;
  }

  .hour .bar {
    border-radius: 2px;
  }

  .past {
    opacity: 0.35;
  }

  .tiny {
    font-size: 0.65rem;
    min-height: 0.8em;
  }
</style>
