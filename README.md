# Kanji Grid

A personal iPhone web app (PWA) for daily practice of *Remembering the Kanji*, vol. 1, 6th edition: kanji → keyword, WaniKani-style stages, multiple choice first and typed answers later, and a grid of all 2,200 kanji that brighten as you learn them.

Everything is stored on the phone (IndexedDB). There is no server or account.

## Book text stays private

GitHub Pages needs a public repo, so **nothing from the book is committed**:

- `*.pdf` and `private/` are git-ignored.
- The app's public data (`src/data/rtk6.json`) holds only frame, kanji, keyword, lesson, stroke count and part names.
- Heisig's stories are extracted on your PC into `private/rtk6-book.json` and imported on the phone (Settings → Import book data).

### Making the data files

Needs Python 3.11+ and `pdftotext` (xpdf or poppler) on PATH.

```sh
# 1. Stories, primitives and lesson intros from your PDF -> private/rtk6-book.json
curl -L -o private/heisig-kanjis.csv https://raw.githubusercontent.com/sdcr/heisig-kanjis/master/heisig-kanjis.csv
python -X utf8 scripts/extract_book.py rtkv6.pdf private/heisig-kanjis.csv

# 2. Public kanji list -> src/data/rtk6.json (commit this one)
python -X utf8 scripts/build_public_data.py
```

To get the stories onto the iPhone, AirDrop `private/rtk6-book.json` to it (or save it to iCloud Drive), then in the app: Settings → Import book data.

## Development

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests (scheduling, answer checking, queues)
npm run check    # type check
npm run icons    # regenerate public/icons
```

## Deploying

Every push to `main` runs the tests, builds with base `/rtk-kanji-learning-app/` and publishes to GitHub Pages (`.github/workflows/deploy.yml`).

One-time setup: repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.

The app is then at `https://abbliseng.github.io/rtk-kanji-learning-app/`. On the iPhone, open it in Safari → Share → **Add to Home Screen**. After a deploy, close and reopen the app to get the new version.

## Backups

Settings → Export backup saves progress, your own stories and settings as a JSON file (via the share sheet to Files or iCloud Drive). Deleting the home-screen app deletes its data, so back up now and then; the app reminds you weekly.
