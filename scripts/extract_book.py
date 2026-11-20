"""Extract frames, stories, lessons and primitives from your own RTK 6th edition PDF.

LOCAL USE ONLY. The output contains the book's text and goes to private/,
which is git-ignored. Never commit it or put it in the app's source.

Usage:
    python -X utf8 scripts/extract_book.py rtkv6.pdf [heisig-kanjis.csv]

Requires `pdftotext` (xpdf or poppler) on PATH. The optional CSV (sdcr/heisig-kanjis)
is only used to cross-check kanji and to add primitive names ("parts").

How it reads the PDF:
- `pdftotext -layout` keeps the visual order, so it is used for lesson boundaries
  and lesson introductions.
- `pdftotext -raw` keeps each frame's number, keyword and text together (the
  layout mode scrambles the two-column pages of Part 3), so it is used for frames.
  Raw mode sometimes places a lesson introduction inside a frame; lines that belong
  to an introduction are recognised and skipped.
"""

import csv
import difflib
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "private" / "rtk6-book.json"
TOTAL = 2200

CJK = r"⺀-⿿　-〿㐀-䶿一-鿿豈-﫿\U00020000-\U0002FFFF"
RE_HEADER = re.compile(rf"^(?:([{CJK}])\s*)?(\d{{1,4}})(?:\s+(\S.*))?$")
RE_LESSON = re.compile(r"^\s*Lesson\s+(\d+)\s*$")
RE_PRIMITIVE = re.compile(r"^\*\s+([^.\[\]]{1,40})$")
RE_GLYPHS_ONLY = re.compile(rf"^[{CJK}\s.…�]+$")
RE_KANJI_LEAD = re.compile(rf"^([{CJK}])\s*(.*)$")
RE_LAYOUT_FRAME = re.compile(r"^\s*(?:[^\d\s]\s*)?(\d{1,4})(\s|$)")
JUNK = {"OceanofPDF.com", "part one", "part two", "part three", "Stories", "Plots", "Elements"}
END_MARKER = "INDEX 1"


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def pdftotext(pdf: Path, mode: str) -> list[str]:
    out = subprocess.run(["pdftotext", mode, "-enc", "UTF-8", str(pdf), "-"],
                         capture_output=True, check=True).stdout.decode("utf-8")
    return [l.rstrip().replace("\f", "") for l in out.split("\n")]


def load_csv(path: Path | None) -> dict[int, dict]:
    if not path:
        return {}
    rows = {}
    with open(path, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["id_6th_ed"].strip() and int(r["id_6th_ed"]) <= TOTAL:
                rows[int(r["id_6th_ed"])] = r
    return rows


def lessons_from_layout(lines: list[str]) -> tuple[dict[int, int], dict[int, list[str]]]:
    """Lesson number -> first frame, and lesson number -> intro lines."""
    starts, intros, cur, last = {}, {}, None, 0
    for line in lines:
        m = RE_LESSON.match(line)
        if m and int(m.group(1)) == len(starts) + 1:
            cur = int(m.group(1))
            intros[cur] = []
            continue
        if cur and cur not in starts:
            f = RE_LAYOUT_FRAME.match(line)
            if f and last < int(f.group(1)) <= last + 300:
                starts[cur] = last = int(f.group(1))
            elif line.strip():
                intros[cur].append(line.strip())
    return starts, intros


def find_header(lines: list[str], i: int, expected: int, ref: dict[int, dict]):
    """Return (kanji, keyword, lines used) if line i starts frame `expected`."""
    m = RE_HEADER.match(lines[i].strip())
    if not m or int(m.group(2)) != expected:
        return None
    kanji, rest = m.group(1), (m.group(3) or "").strip()
    nxt = lines[i + 1].strip() if i + 1 < len(lines) else ""
    known = ref.get(expected)
    if rest:  # "694 rub", then "抹 Fingers ..." on the next line
        if not kanji:
            k = RE_KANJI_LEAD.match(nxt)
            kanji = k.group(1) if k else None
        if not kanji and known and norm(rest) == norm(known["keyword_6th_ed"]):
            # the kanji is an image in this PDF (shows up as a stray letter): trust the CSV
            return known["kanji"], rest, 1, True
        if not kanji:
            return None
        if known and kanji != known["kanji"] and norm(rest)[:4] != norm(known["keyword_6th_ed"])[:4]:
            return None
        return kanji, rest, 1, False
    k = RE_KANJI_LEAD.match(nxt)  # "43", then "昇 rise up"
    if k and k.group(2) and (not known or k.group(1) == known["kanji"]):
        return k.group(1), k.group(2).strip(), 2, False
    after = RE_KANJI_LEAD.match(lines[i + 2].strip()) if i + 2 < len(lines) else None
    if nxt and not k and after:  # "43", then "rise up", then "昇 Our image ..."
        if not known or after.group(1) == known["kanji"]:
            return after.group(1), nxt, 2, False
    return None


def to_paragraphs(raw: list[str]) -> list[str]:
    paras, cur = [], []
    for s in raw:
        s = s.strip()
        if not s or s in JUNK or RE_GLYPHS_ONLY.match(s):
            continue
        s = re.sub(rf"(\[\d{{1,2}}\])[{CJK}\s]+$", r"\1", s)  # stroke-order glyphs after the count
        if cur and re.search(r"[A-Za-z]-$", cur[-1]):
            cur[-1] = cur[-1] + s  # line ends in a hyphen: join without a space, keep the hyphen
        else:
            cur.append(s)
        if re.search(r"\[\d{1,2}\]$", s) or (len(s) < 45 and re.search(r"[.\]:?!”\"]$", s)):
            paras.append(" ".join(cur))
            cur = []
    if cur:
        paras.append(" ".join(cur))
    return [p for p in paras if re.search(r"[A-Za-z0-9]", p)]  # drop leftover glyph-only lines


def strip_lesson_intros(lines: list[str], intro_blob: dict[int, str]) -> list[str]:
    """Remove "Lesson N" headings and their intro text, wherever raw mode put them."""
    out, i = [], 0
    while i < len(lines):
        m = RE_LESSON.match(lines[i])
        if not m:
            out.append(lines[i])
            i += 1
            continue
        blob = intro_blob.get(int(m.group(1)), "")
        i += 1
        while i < len(lines):
            n = norm(lines[i])
            if n and (n not in blob or RE_HEADER.match(lines[i].strip())):
                break
            i += 1
    return out


def close_enough(a: str, b: str) -> bool:
    """Same keyword up to spelling: saké/sake, sūtra/sutra, tranquilize/tranquillize."""
    fold = lambda s: norm(unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode())
    return difflib.SequenceMatcher(None, fold(a), fold(b)).ratio() >= 0.8


# Places where this ebook prints a story under the wrong frame (checked by hand).
# frame -> frame its story belongs to. Only the story up to its stroke count moves;
# notes after it (such as "As a primitive ...") stay with the original frame.
STORY_MOVES = {509: 510, 510: 511, 2004: 2005}


def apply_moves(frames: list[dict], to_check: list[dict]) -> None:
    by_frame = {f["frame"]: f for f in frames}
    moving = {}
    for src in STORY_MOVES:
        paras = by_frame[src]["story"].split("\n\n")
        cut = next((k + 1 for k, p in enumerate(paras) if re.search(r"\[\d{1,2}\]", p)), len(paras))
        moving[src] = "\n\n".join(paras[:cut])
        by_frame[src]["_rest"] = paras[cut:]
    for src, dst in STORY_MOVES.items():
        f = by_frame[dst]
        rest = f.pop("_rest", None)
        if rest is None:  # destination keeps nothing of the misplaced story it had
            rest = []
        f["story"] = "\n\n".join([moving[src], *rest])
    for f in by_frame.values():
        if "_rest" in f:  # a source nothing moved into: only its own notes remain
            f["story"] = "\n\n".join(f.pop("_rest"))
            to_check.append({"frame": f["frame"], "field": "story", "pdf": "missing in the PDF", "used": ""})


# Corrections checked against the printed 6th edition (2026-11-20). Numbers only:
# any corrected *text* from the book lives in private/corrections.json instead,
# so it never ends up in this public repo.
FRAME_SWAPS = [(230, 231)]  # the book has 230 昧 obscure, 231 末 extremity
STROKE_FIXES = {1591: (13, 15), 1956: (10, 6)}  # frame: (count the ebook prints, the book's)
CORRECTIONS = ROOT / "private" / "corrections.json"


def apply_book_fixes(frames: list[dict]) -> None:
    by_frame = {f["frame"]: f for f in frames}
    keep = ("frame", "lesson")
    for a, b in FRAME_SWAPS:
        fa, fb = by_frame[a], by_frame[b]
        for key in set(fa) | set(fb):
            if key not in keep:
                fa[key], fb[key] = fb.get(key), fa.get(key)
        for f in (fa, fb):  # drop keys that only one side had
            for key in [k for k, v in f.items() if v is None and k != "strokes"]:
                del f[key]
    for frame, (wrong, right) in STROKE_FIXES.items():
        f = by_frame[frame]
        f["story"] = f["story"].replace(f"[{wrong}]", f"[{right}]", 1)
    if CORRECTIONS.exists():  # {"stories": {"509": "If the cushions ... [11]"}}
        fixes = json.loads(CORRECTIONS.read_text(encoding="utf-8"))
        for frame, story in fixes.get("stories", {}).items():
            by_frame[int(frame)]["story"] = story
    for f in frames:  # stroke count = the first [n] of the final story
        counts = re.findall(r"\[(\d{1,2})\]", f["story"])
        f["strokes"] = int(counts[0]) if counts else None


def suspicious(frames: list[dict], ref: dict[int, dict]) -> list[int]:
    """Frames worth a look in the printed book: stroke count off by 2 or more, or the
    same story as the next frame."""
    out = []
    for k, f in enumerate(frames):
        counts = [int(x) for x in re.findall(r"\[(\d{1,2})\]", f["story"])]
        want = ref.get(f["frame"], {}).get("stroke_count", "").strip()
        if counts and want and min(abs(c - int(want)) for c in counts) >= 2:
            out.append(f["frame"])
        elif k + 1 < len(frames) and f["story"] and f["story"] == frames[k + 1]["story"]:
            out.append(f["frame"])
    return out


def main() -> None:
    pdf = Path(sys.argv[1])
    ref = load_csv(Path(sys.argv[2]) if len(sys.argv) > 2 else None)

    starts, intro_lines = lessons_from_layout(pdftotext(pdf, "-layout"))
    intro_blob = {n: norm(" ".join(v)) for n, v in intro_lines.items()}
    lesson_of = lambda frame: max(n for n, s in starts.items() if s <= frame)

    lines = strip_lesson_intros(pdftotext(pdf, "-raw"), intro_blob)
    frames, primitives = [], []
    expected, target = 1, None

    i = next(k for k in range(len(lines)) if find_header(lines, k, 1, ref))  # skip front matter
    while i < len(lines):
        s = lines[i].strip()
        if s == END_MARKER:
            break
        if expected <= TOTAL and (hit := find_header(lines, i, expected, ref)):
            kanji, keyword, used, image_kanji = hit
            target = []
            frames.append({"frame": expected, "kanji": kanji, "keyword": keyword,
                           "lesson": lesson_of(expected), "_raw": target})
            expected += 1
            i += used
            if i < len(lines):
                k = RE_KANJI_LEAD.match(lines[i].strip())
                if k and k.group(1) == kanji:  # the frame's kanji leads its first line
                    target.append(k.group(2))
                    i += 1
                elif image_kanji and (m := re.match(r"^\S\s+(.*)$", lines[i].strip())):
                    target.append(m.group(1))  # drop the stray letter left by the image
                    i += 1
            continue
        if pm := RE_PRIMITIVE.match(s):
            target = []
            primitives.append({"name": pm.group(1).strip(), "afterFrame": expected - 1,
                               "_raw": target})
        elif target is not None:
            target.append(s)
        i += 1

    # The ebook has a few typos (a keyword printed twice, a wrong kanji). The CSV wins
    # when they really differ; spelling-only differences keep the book's form.
    to_check = []
    for f in frames:
        known = ref.get(f["frame"])
        if known:
            if f["kanji"] != known["kanji"]:
                to_check.append({"frame": f["frame"], "field": "kanji", "pdf": f["kanji"], "used": known["kanji"]})
                f["kanji"] = known["kanji"]
            if not close_enough(f["keyword"], known["keyword_6th_ed"]):
                to_check.append({"frame": f["frame"], "field": "keyword", "pdf": f["keyword"],
                                 "used": known["keyword_6th_ed"]})
                f["keyword"] = known["keyword_6th_ed"]
            if known.get("components"):
                f["parts"] = [p.strip() for p in known["components"].split(";") if p.strip()]
        f["story"] = "\n\n".join(to_paragraphs(f.pop("_raw")))
    apply_moves(frames, to_check)
    apply_book_fixes(frames)
    has_story = {f["frame"] for f in frames if f["story"]}
    to_check = [c for c in to_check if not (c["field"] == "story" and c["frame"] in has_story)]
    for p in primitives:
        p["text"] = "\n\n".join(to_paragraphs(p.pop("_raw")))
    intros = {n: "\n\n".join(to_paragraphs(v)) for n, v in intro_lines.items()}

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps({"edition": 6, "lessonStarts": starts, "lessonIntros": intros,
                               "frames": frames, "primitives": primitives, "toCheck": to_check},
                              ensure_ascii=False, indent=1), encoding="utf-8")

    short = [f["frame"] for f in frames if len(f["story"]) < 15]
    print(f"worth checking in the book: {suspicious(frames, ref)}")
    print(f"frames: {len(frames)}/{TOTAL}  lessons: {len(starts)}  primitives: {len(primitives)}")
    print(f"corrected from CSV, check in your book: {to_check}")
    print(f"frames with almost no text ({len(short)}): {short[:20]}")
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
