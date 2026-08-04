#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSS_PATH = ROOT / "wall-live.css"
CSS = CSS_PATH.read_text(encoding="utf-8")

# The 4×5 macro clock is made from illuminated flap backgrounds and must not
# be altered. Only text glyph styling is changed here.
CSS = CSS.replace("--cell-font: 38px;", "--cell-font: 34px;")
CSS = CSS.replace("--cell-font-y: 4px;", "--cell-font-y: 2px;")

# Remove the unused MP-B face. The macro clock does not use font glyphs.
CSS = re.sub(
    r'\n@font-face \{\n  font-family: "MP-B";.*?\n\}\n',
    "\n",
    CSS,
    count=1,
    flags=re.S,
)

# Make the base text declaration Open Sans Bold so centre header/footer and
# both office zones share exactly the same small-flap typography.
CSS = re.sub(
    r'font-family: "MP-B", "Arial Narrow", Arial, sans-serif;\n'
    r'  font-size: var\(--cell-font\);\n'
    r'  font-weight: normal;',
    'font-family: "Open Sans", Arial, sans-serif;\n'
    '  font-size: var(--cell-font);\n'
    '  font-weight: 700;',
    CSS,
    count=1,
)

# Remove the incorrect zone-specific override from the previous pass.
CSS = re.sub(
    r'\n/\* OPEN SANS OFFICE ZONES START \*/.*?'
    r'/\* OPEN SANS OFFICE ZONES END \*/\n?',
    "\n",
    CSS,
    count=1,
    flags=re.S,
)

start = "/* OPEN SANS SMALL TEXT FLAPS START */"
end = "/* OPEN SANS SMALL TEXT FLAPS END */"
if start in CSS and end in CSS:
    CSS = CSS[:CSS.index(start)] + CSS[CSS.index(end) + len(end):]

CSS = CSS.rstrip() + r'''

/* OPEN SANS SMALL TEXT FLAPS START */
/* Every visible text flap, including Melbourne header and weather footer. */
.flap span {
  font-family: "Open Sans", Arial, sans-serif;
  font-size: 34px;
  font-weight: 700;
  transform: translateY(2px);
  letter-spacing: 0;
}

/* Lift the upper glyph half by 2px for a cleaner hinge split. */
.flap .panel.top span,
.flap .flip-half.top-flip span {
  transform: translateY(0);
}

.flap .panel.bottom span,
.flap .flip-half.bottom-flip span {
  transform: translateY(2px);
}

/* The original 4×5 matrix remains background-driven and font-independent. */
.macro-face span {
  color: transparent;
  text-shadow: none;
}
/* OPEN SANS SMALL TEXT FLAPS END */
''' + "\n"

CSS_PATH.write_text(CSS, encoding="utf-8")

for filename in ("49x7.html", "49x7-live.html", "49x7-random.html"):
    path = ROOT / filename
    if not path.exists():
        continue
    text = path.read_text(encoding="utf-8")
    text = text.replace("open-sans-2", "open-sans-3")
    path.write_text(text, encoding="utf-8")

readme = ROOT / "README.md"
if readme.exists():
    text = readme.read_text(encoding="utf-8")
    text = re.sub(
        r'\n## Typography zones\n.*?(?=\n## |\Z)',
        "",
        text,
        flags=re.S,
    )
    text = text.rstrip() + '''

## Typography

- All smaller text flaps use self-hosted Open Sans Bold at 34 px.
- This includes office names, country codes, office times, Melbourne header and weather footer.
- The upper half of each text glyph is lifted 2 px for hinge legibility.
- The large Melbourne HH:MM:SS remains the original pre-fork 4 × 5 illuminated-flap matrix.
- Open Sans and its OFL licence are stored locally under `fonts/`.
'''
    readme.write_text(text, encoding="utf-8")

metadata = ROOT / "build-metadata.json"
if metadata.exists():
    data = json.loads(metadata.read_text(encoding="utf-8"))
    data.update({
        "font_family": "Open Sans",
        "font_weight": 700,
        "font_size_px": 34,
        "top_half_lift_px": 2,
        "macro_clock": "original 4x5 illuminated flap matrix",
        "cache_version": "open-sans-3",
    })
    metadata.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

print(json.dumps({
    "all_small_text": "Open Sans 700 34px",
    "top_half_lift_px": 2,
    "macro_clock": "unchanged original 4x5",
    "cache": "open-sans-3",
}, indent=2))
