<script lang="ts">
  import type { Settings } from '../lib/session';
  import {
    app,
    clearBook,
    exportBackup,
    importBackup,
    importBook,
    saveSettings,
    setVacation,
    type BookFile
  } from '../lib/state.svelte';

  let message = $state('');

  function numberField(key: keyof Settings, min: number, max: number) {
    return (e: Event) => {
      const value = Number((e.target as HTMLInputElement).value);
      if (Number.isFinite(value)) saveSettings({ [key]: Math.min(max, Math.max(min, Math.round(value))) });
    };
  }

  async function readFile(e: Event): Promise<string | null> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    return file ? file.text() : null;
  }

  async function onBookFile(e: Event) {
    const text = await readFile(e);
    if (!text) return;
    try {
      const count = await importBook(JSON.parse(text) as BookFile);
      message = `Imported ${count.toLocaleString('en')} stories.`;
    } catch (err) {
      message = err instanceof Error ? err.message : 'Import failed.';
    }
  }

  async function onBackupFile(e: Event) {
    const text = await readFile(e);
    if (!text) return;
    if (!confirm('Replace all progress on this phone with the backup?')) return;
    try {
      await importBackup(text);
      message = 'Backup restored.';
    } catch (err) {
      message = err instanceof Error ? err.message : 'Restore failed.';
    }
  }

  async function backup() {
    const blob = await exportBackup();
    const name = `kanji-grid-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: name });
        message = 'Backup shared.';
        return;
      } catch {
        // cancelled: fall through to a plain download
      }
    }
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    a.click();
    URL.revokeObjectURL(url);
    message = 'Backup downloaded.';
  }

  async function removeBook() {
    if (confirm("Remove Heisig's stories from this phone? Your own stories stay.")) await clearBook();
  }
</script>

<h1>Settings</h1>

{#if message}<p class="banner">{message}</p>{/if}

<section class="card">
  <h2>Daily practice</h2>
  <label>
    <span>New kanji per day</span>
    <input type="number" inputmode="numeric" min="1" max="50" value={app.settings.newPerDay} onchange={numberField('newPerDay', 1, 50)} />
  </label>
  <label>
    <span>Kanji per lesson batch</span>
    <input type="number" inputmode="numeric" min="1" max="20" value={app.settings.batchSize} onchange={numberField('batchSize', 1, 20)} />
  </label>
  <label>
    <span>Multiple-choice stages before typing</span>
    <input type="number" inputmode="numeric" min="0" max="8" value={app.settings.mcStages} onchange={numberField('mcStages', 0, 8)} />
    <small class="muted">2 = Apprentice 1–2 are multiple choice, typing from Apprentice 3.</small>
  </label>
  <label>
    <span>Pause new kanji above this many due reviews</span>
    <input type="number" inputmode="numeric" min="10" max="1000" value={app.settings.backlogLimit} onchange={numberField('backlogLimit', 10, 1000)} />
  </label>
  <label class="toggle">
    <input type="checkbox" checked={app.settings.vacationSince !== null} onchange={(e) => setVacation((e.target as HTMLInputElement).checked)} />
    <span>Vacation mode <small class="muted">(freezes all review timers)</small></span>
  </label>
</section>

<section class="card">
  <h2>Heisig's stories</h2>
  <p class="small muted">
    {app.bookCount ? `${app.bookCount.toLocaleString('en')} stories on this phone.` : 'Not imported.'}
    Import <code>private/rtk6-book.json</code>, made on your PC by <code>scripts/extract_book.py</code>. It stays on this phone and is never uploaded.
  </p>
  <label class="btn file">Import book data<input type="file" accept="application/json,.json" onchange={onBookFile} /></label>
  {#if app.bookCount}<button class="btn btn-quiet" onclick={removeBook}>Remove from this phone</button>{/if}
</section>

<section class="card">
  <h2>Backup</h2>
  <p class="small muted">
    Progress, your stories and settings (not the book data).
    {app.settings.lastBackupAt ? `Last backup ${new Date(app.settings.lastBackupAt).toLocaleDateString()}.` : 'No backup yet.'}
  </p>
  <button class="btn" onclick={backup}>Export backup</button>
  <label class="btn file">Restore from backup<input type="file" accept="application/json,.json" onchange={onBackupFile} /></label>
</section>

<section class="card small muted">
  <h2>About</h2>
  <p>Kanji Grid follows the frame order and keywords of James W. Heisig's <em>Remembering the Kanji</em>, vol. 1, 6th edition.</p>
  <p>
    Keyword list and parts from <a href="https://github.com/sdcr/heisig-kanjis" target="_blank" rel="noreferrer">sdcr/heisig-kanjis</a>. Scheduling
    based on WaniKani's stages.
  </p>
</section>

<style>
  h1 {
    font-size: 1.6rem;
    margin-bottom: 16px;
  }

  h2 {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
  }

  section {
    display: grid;
    gap: 12px;
    margin-bottom: 14px;
  }

  label {
    display: grid;
    gap: 6px;
  }

  .toggle {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .toggle input {
    width: 22px;
    height: 22px;
    accent-color: var(--accent);
  }

  .file {
    position: relative;
    text-align: center;
  }

  .file input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }

  .banner {
    margin-bottom: 14px;
  }

  a {
    color: var(--accent);
  }
</style>
