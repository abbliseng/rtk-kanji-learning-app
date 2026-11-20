"""Build src/data/rtk6.json (the PUBLIC kanji list) from private/rtk6-book.json.

Only frame, kanji, keyword, lesson, stroke count and part names are copied: no
stories or other book text. Run after scripts/extract_book.py:

    python -X utf8 scripts/build_public_data.py
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "private" / "rtk6-book.json"
OUT = ROOT / "src" / "data" / "rtk6.json"

book = json.loads(SRC.read_text(encoding="utf-8"))
kanji = [
    {
        "frame": f["frame"],
        "kanji": f["kanji"],
        "keyword": f["keyword"],
        "lesson": f["lesson"],
        "strokes": f.get("strokes"),
        "parts": [p for p in f.get("parts", []) if p != f["keyword"]],
    }
    for f in book["frames"]
]
assert len(kanji) == 2200 and [k["frame"] for k in kanji] == list(range(1, 2201))
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(kanji, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"wrote {OUT.relative_to(ROOT)}: {len(kanji)} kanji, {OUT.stat().st_size // 1024} KB")
