#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

css_path = ROOT / "wall-live.css"
js_path = ROOT / "wall-live.js"
css = css_path.read_text(encoding="utf-8")
js = js_path.read_text(encoding="utf-8")

# Restore the original centre-zone font and metrics.
if 'font-family: "MP-B";' not in css:
    open_sans_face = re.search(r'@font-face \{\n  font-family: "Open Sans";.*?\n\}\n', css, re.S)
    if not open_sans_face:
        raise RuntimeError("Open Sans @font-face block was not found")
    mp_face = '''\n@font-face {\n  font-family: "MP-B";\n  src: url("fonts/MP-B.ttf") format("truetype");\n  font-weight: normal;\n  font-style: normal;\n  font-display: block;\n}\n'''
    css = css[:open_sans_face.end()] + mp_face + css[open_sans_face.end():]

css = css.replace('--cell-font: 34px;', '--cell-font: 38px;')
css = css.replace('--cell-font-y: 2px;', '--cell-font-y: 4px;')

span_block = re.compile(
    r'(\.panel span, \.flip-half span \{.*?color: var\(--white\);\n)'
    r'  font-family: "Open Sans", Arial, sans-serif;\n'
    r'  font-size: var\(--cell-font\);\n'
    r'  font-weight: 400;',
    re.S,
)
css, replacements = span_block.subn(
    r'\1  font-family: "MP-B", "Arial Narrow", Arial, sans-serif;\n'
    r'  font-size: var(--cell-font);\n'
    r'  font-weight: normal;',
    css,
    count=1,
)
if replacements != 1 and 'font-family: "MP-B", "Arial Narrow", Arial, sans-serif;' not in css:
    raise RuntimeError("Could not restore the centre font declaration")

start_marker = '/* OPEN SANS OFFICE ZONES START */'
end_marker = '/* OPEN SANS OFFICE ZONES END */'
if start_marker in css and end_marker in css:
    css = css[:css.index(start_marker)] + css[css.index(end_marker) + len(end_marker):]

zone_css = r'''

/* OPEN SANS OFFICE ZONES START */
/* Centre remains visually identical to the established MP-B production wall. */
.centre-flap span {
  font-family: "MP-B", "Arial Narrow", Arial, sans-serif;
  font-size: 38px;
  font-weight: normal;
  transform: translateY(4px);
}

/* Only the smaller left and right office flaps use Open Sans Bold. */
.office-flap span {
  font-family: "Open Sans", Arial, sans-serif;
  font-size: 34px;
  font-weight: 700;
  transform: translateY(2px);
  letter-spacing: 0;
}

/* Lift the upper glyph half by 2px to close the hinge interruption. */
.office-flap .panel.top span,
.office-flap .flip-half.top-flip span {
  transform: translateY(0);
}

.office-flap .panel.bottom span,
.office-flap .flip-half.bottom-flip span {
  transform: translateY(2px);
}
/* OPEN SANS OFFICE ZONES END */
'''
css = css.rstrip() + zone_css + '\n'

# Classify every physical flap once, so CSS can be scoped without changing layout logic.
needle = "    flap.className = 'flap';\n"
replacement = (
    "    flap.className = 'flap';\n"
    "    flap.classList.add(\n"
    "      col >= CENTRE_START && col < CENTRE_START + CENTRE_COLS\n"
    "        ? 'centre-flap'\n"
    "        : 'office-flap'\n"
    "    );\n"
)
if "? 'centre-flap'" not in js:
    if needle not in js:
        raise RuntimeError("Could not locate createFlap class assignment")
    js = js.replace(needle, replacement, 1)

css_path.write_text(css, encoding="utf-8")
js_path.write_text(js, encoding="utf-8")

for filename in ("49x7.html", "49x7-live.html", "49x7-random.html"):
    path = ROOT / filename
    if not path.exists():
        continue
    text = path.read_text(encoding="utf-8")
    text = text.replace('open-sans-1', 'open-sans-2')
    path.write_text(text, encoding="utf-8")

readme = ROOT / "README.md"
if readme.exists():
    text = readme.read_text(encoding="utf-8")
    note = '''\n## Typography zones\n\n- Melbourne centre: original MP-B face and 38 px production metrics.\n- Left and right office flaps: self-hosted Open Sans Bold at 34 px.\n- The upper half of each office glyph is lifted 2 px for hinge legibility.\n- Both font files are stored locally under `fonts/`.\n'''
    if '## Typography zones' not in text:
        text = text.rstrip() + '\n' + note
    readme.write_text(text, encoding="utf-8")

print(json.dumps({
    "centre_font": "MP-B 38px",
    "office_font": "Open Sans 700 34px",
    "office_top_lift_px": 2,
    "cache": "open-sans-2"
}, indent=2))

# This file is intentionally touched to trigger the one-off QC workflow.
