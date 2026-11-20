<script lang="ts">
  import { tick } from 'svelte';
  import { checkAnswer, type Verdict } from '../lib/answer';
  import { db } from '../lib/db';
  import { byFrame, keywordIndex, TOTAL } from '../lib/kanji';
  import { pickDistractors, shuffle } from '../lib/session';
  import { stageName } from '../lib/srs';
  import { logAnswer, store } from '../lib/state.svelte';
  import StoryPanel from './StoryPanel.svelte';

  let {
    frames,
    title,
    kind,
    modeOf,
    onitemdone,
    onfinish,
    onquit,
    extraStarted = []
  }: {
    frames: number[];
    title: string;
    kind: 'lesson' | 'review';
    modeOf: (frame: number) => 'choice' | 'typed';
    /** Called once per kanji when it is finally answered right; may return its new stage. */
    onitemdone: (frame: number, wrongInSession: boolean) => Promise<number | void>;
    onfinish: () => void;
    onquit: () => void;
    extraStarted?: number[];
  } = $props();

  // svelte-ignore state_referenced_locally
  let queue = $state(shuffle(frames));
  // svelte-ignore state_referenced_locally
  const total = frames.length;
  let finished = $state(0);
  const wrongCount = new Map<number, number>();

  type Feedback = {
    frame: number;
    correct: boolean;
    verdict: Verdict | null;
    given: string;
    newStage?: number;
    logId: number;
  };
  let feedback = $state<Feedback | null>(null);
  let typed = $state('');
  let input = $state<HTMLInputElement>();
  let continueBtn = $state<HTMLButtonElement>();
  let busy = false;

  const current = $derived(queue[0]);
  const mode = $derived(current === undefined ? 'choice' : modeOf(current));
  const options = $derived.by(() => {
    if (current === undefined || mode !== 'choice') return [];
    const started = new Set([...store.progress.keys(), ...extraStarted]);
    const wrong = pickDistractors(current, (f) => byFrame(f).keyword, started, TOTAL);
    return shuffle([current, ...wrong]);
  });

  $effect(() => {
    if (feedback) tick().then(() => continueBtn?.focus());
    else if (mode === 'typed') tick().then(() => input?.focus());
  });

  async function judge(correct: boolean, verdict: Verdict | null, given: string) {
    if (busy || current === undefined) return;
    busy = true;
    const frame = current;
    const stageBefore = store.progress.get(frame)?.stage ?? 0;
    const logId = await logAnswer({
      frame,
      at: Date.now(),
      mode: kind === 'lesson' ? 'lesson' : mode,
      correct,
      typed: mode === 'typed' ? given : undefined,
      stageBefore,
      stageAfter: stageBefore
    });
    const rest = queue.slice(1);
    let newStage: number | undefined;
    if (correct) {
      queue = rest;
      finished++;
      newStage = (await onitemdone(frame, (wrongCount.get(frame) ?? 0) > 0)) ?? undefined;
      if (newStage !== undefined) await db.reviewLog.update(logId, { stageAfter: newStage });
    } else {
      wrongCount.set(frame, (wrongCount.get(frame) ?? 0) + 1);
      const at = Math.min(rest.length, 3 + Math.floor(Math.random() * 3));
      queue = [...rest.slice(0, at), frame, ...rest.slice(at)];
    }
    feedback = { frame, correct, verdict, given, newStage, logId };
    typed = '';
    busy = false;
  }

  function submitTyped(e: SubmitEvent) {
    e.preventDefault();
    if (!typed.trim() || current === undefined) return;
    const verdict = checkAnswer(typed, current, byFrame(current).keyword, keywordIndex);
    judge(verdict.result === 'correct' || verdict.result === 'close', verdict, typed);
  }

  /** "I knew that": undo a wrong mark (for typos the checker didn't catch). */
  async function override() {
    if (!feedback || feedback.correct || busy) return;
    busy = true;
    const frame = feedback.frame;
    const idx = queue.indexOf(frame);
    if (idx >= 0) queue = [...queue.slice(0, idx), ...queue.slice(idx + 1)];
    wrongCount.set(frame, (wrongCount.get(frame) ?? 1) - 1);
    finished++;
    const newStage = (await onitemdone(frame, (wrongCount.get(frame) ?? 0) > 0)) ?? undefined;
    await db.reviewLog.update(feedback.logId, { correct: true, overridden: true, stageAfter: newStage });
    feedback = { ...feedback, correct: true, newStage };
    busy = false;
  }

  function next() {
    feedback = null;
    if (queue.length === 0) onfinish();
  }
</script>

<div class="quiz">
  <header>
    <button class="btn btn-quiet" onclick={onquit} aria-label="Quit">✕</button>
    <div class="progress"><div style="width: {(finished / total) * 100}%"></div></div>
    <span class="muted small">{finished}/{total} · {title}</span>
  </header>

  {#if feedback}
    {@const k = byFrame(feedback.frame)}
    <div class="prompt">
      <span class="kanji big">{k.kanji}</span>
    </div>
    <div class="result card" class:good={feedback.correct} class:bad={!feedback.correct}>
      {#if feedback.correct && feedback.verdict?.result === 'close'}
        <p class="verdict close">Close: check the spelling</p>
      {:else if feedback.correct}
        <p class="verdict">Correct</p>
      {:else if feedback.verdict?.result === 'other'}
        <p class="verdict">That's the keyword of another kanji</p>
        <p class="others">
          {#each feedback.verdict.frames as f (f)}
            <span><span class="kanji">{byFrame(f).kanji}</span> {byFrame(f).keyword} <span class="muted small">#{f}</span></span>
          {/each}
        </p>
      {:else}
        <p class="verdict">Not quite{feedback.given ? `: “${feedback.given}”` : ''}</p>
      {/if}
      <h2>{k.keyword}</h2>
      <p class="muted small">
        Frame {k.frame}{#if feedback.newStage !== undefined}
          · now {stageName(feedback.newStage)}{/if}
      </p>
    </div>

    <div class="buttons">
      <button class="btn btn-primary btn-block" bind:this={continueBtn} onclick={next}>Continue</button>
      {#if !feedback.correct && kind === 'review'}
        <button class="btn btn-quiet" onclick={override}>I knew that</button>
      {/if}
    </div>

    <div class="card"><StoryPanel frame={feedback.frame} compact /></div>
  {:else if current !== undefined}
    <div class="prompt">
      <span class="kanji big">{byFrame(current).kanji}</span>
      <p class="muted small">{mode === 'choice' ? 'Pick the keyword' : 'Type the keyword'}</p>
    </div>
    {#if mode === 'choice'}
      <div class="choices">
        {#each options as f (f)}
          <button class="btn" onclick={() => judge(f === current, null, byFrame(f).keyword)}>{byFrame(f).keyword}</button>
        {/each}
      </div>
    {:else}
      <form onsubmit={submitTyped}>
        <input
          bind:this={input}
          bind:value={typed}
          type="text"
          autocomplete="off"
          autocapitalize="none"
          autocorrect="off"
          spellcheck="false"
          enterkeyhint="done"
          placeholder="Keyword"
        />
        <button class="btn btn-primary btn-block" type="submit" disabled={!typed.trim()}>Check</button>
      </form>
    {/if}
  {/if}
</div>

<style>
  .quiz {
    max-width: 640px;
    margin: 0 auto;
    min-height: 100dvh;
    padding: calc(8px + env(safe-area-inset-top)) 16px calc(24px + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  header {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  header .btn {
    padding: 8px;
  }

  .progress {
    flex: 1;
    height: 6px;
    border-radius: 3px;
    background: var(--surface-2);
    overflow: hidden;
  }

  .progress div {
    height: 100%;
    background: var(--accent);
    transition: width 0.2s;
  }

  .prompt {
    display: grid;
    justify-items: center;
    gap: 10px;
    padding: 24px 0 8px;
  }

  .big {
    font-size: 7rem;
  }

  .choices {
    display: grid;
    gap: 10px;
  }

  .choices .btn {
    padding: 16px;
    font-size: 1.05rem;
  }

  form {
    display: grid;
    gap: 10px;
  }

  form input {
    text-align: center;
    font-size: 1.2rem;
  }

  .result {
    text-align: center;
    display: grid;
    gap: 6px;
  }

  .result.good {
    border-color: var(--good);
  }

  .result.bad {
    border-color: var(--bad);
  }

  .verdict {
    font-weight: 700;
    color: var(--good);
  }

  .bad .verdict {
    color: var(--bad);
  }

  .verdict.close {
    color: var(--close);
  }

  .others {
    display: grid;
    gap: 4px;
  }

  .others .kanji {
    font-size: 1.4rem;
  }

  h2 {
    font-size: 1.5rem;
  }

  .buttons {
    display: grid;
    gap: 6px;
  }
</style>
