#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path('/tmp/aurecon-split-flap-wall-source')

FILES = [
    '49x7.html',
    '49x7-live.html',
    '49x7-random.html',
    'wall-live.css',
    'wall-live.js',
    'launch-clock-dedupe.js',
    'weather-fallback.js',
    'weather.json',
    'robots.txt',
    '.nojekyll',
    'scripts/fetch_weather.py',
]

for relative in FILES:
    source = SOURCE / relative
    destination = ROOT / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)

for obsolete in ('app.js', 'styles.css'):
    path = ROOT / obsolete
    if path.exists():
        path.unlink()

css_path = ROOT / 'wall-live.css'
css = css_path.read_text(encoding='utf-8')
css = re.sub(
    r'@font-face\s*\{\s*font-family:\s*"MP-B";.*?\}\s*',
    '',
    css,
    count=1,
    flags=re.S,
)
open_sans_face = '''@font-face {
  font-family: "Open Sans";
  src: url("fonts/OpenSans-Variable.ttf") format("truetype-variations");
  font-style: normal;
  font-weight: 300 800;
  font-stretch: 75% 100%;
  font-display: swap;
}

'''
css = css.replace('* { box-sizing: border-box; }', open_sans_face + '* { box-sizing: border-box; }', 1)
css = css.replace('"MP-B", "Liberation Sans Narrow", "Arial Narrow", Arial, sans-serif', '"Open Sans", Arial, sans-serif')
css = css.replace('--cell-font: 38px;', '--cell-font: 34px;')
css = css.replace('--cell-font-y: 4px;', '--cell-font-y: 2px;')
css = css.replace('font-weight: normal;', 'font-weight: 400;')
css_path.write_text(css, encoding='utf-8')

for name in ('49x7.html', '49x7-live.html', '49x7-random.html'):
    path = ROOT / name
    html = path.read_text(encoding='utf-8')
    html = re.sub(r'\s*<link rel="preload" href="/Melbl8-Clock03-Split-flap/MP-B\.ttf[^>]*>\s*', '\n', html)
    html = html.replace('<head>', '<head>\n  <link rel="icon" href="data:,">', 1)
    html = html.replace('Aurecon live split-flap wall', 'Aurecon Open Sans split-flap wall')
    html = html.replace('Aurecon random-office split-flap wall', 'Aurecon Open Sans random-office split-flap wall')
    html = html.replace('wall-live.css?v=6', 'wall-live.css?v=open-sans-1')
    html = html.replace('wall-live.js?v=10', 'wall-live.js?v=open-sans-1')
    html = html.replace('wall-live.js?v=11', 'wall-live.js?v=open-sans-1')
    html = html.replace('launch-clock-dedupe.js?v=2', 'launch-clock-dedupe.js?v=open-sans-1')
    path.write_text(html, encoding='utf-8')

index = '''<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex">
  <meta name="googlebot" content="noindex, nofollow, noarchive, nosnippet, noimageindex">
  <meta name="bingbot" content="noindex, nofollow, noarchive, nosnippet, noimageindex">
  <meta name="referrer" content="no-referrer">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; connect-src 'self' https://api.open-meteo.com; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; media-src 'none'; worker-src 'none'">
  <link rel="icon" href="data:,">
  <title>Aurecon split-flap wall · Open Sans</title>
  <style>
    :root{color-scheme:dark;--green:#89c925;--grey:#373a36;--ink:#1c1b1c;--white:#fff}
    *{box-sizing:border-box}html,body{margin:0;min-height:100%;background:var(--grey);color:var(--white);font-family:"Open Sans",Arial,sans-serif}
    body{display:grid;place-items:center;padding:40px}.panel{width:min(1180px,100%);background:var(--ink);border:1px solid rgba(255,255,255,.12);padding:48px;border-radius:18px}
    h1{font-size:clamp(36px,5vw,68px);line-height:1;margin:0 0 18px;font-weight:600}p{color:rgba(255,255,255,.72);font-size:18px;line-height:1.55;max-width:920px}
    .choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;margin-top:36px}.choice{display:block;color:inherit;text-decoration:none;border:1px solid rgba(255,255,255,.18);padding:28px;border-radius:12px;background:#242524}.choice:hover,.choice:focus-visible{border-color:var(--green);outline:none}.choice strong{display:block;color:var(--green);font-size:28px;margin-bottom:8px}.choice span{color:rgba(255,255,255,.72);line-height:1.45}
    @media(max-width:800px){body{padding:16px}.panel{padding:28px}.choices{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <main class="panel">
    <h1>Split-flap wall<br>Open Sans</h1>
    <p>A separate Open Sans build of the 3840 × 804 Aurecon office wall. The original MP-B production repository is unchanged.</p>
    <div class="choices">
      <a class="choice" href="49x7.html"><strong>Fixed order</strong><span>The established office rotation and Melbourne hero clock.</span></a>
      <a class="choice" href="49x7-random.html"><strong>Random order</strong><span>Every office appears once before the deck reshuffles, with a live entrance clock.</span></a>
    </div>
  </main>
</body>
</html>
'''
(ROOT / 'index.html').write_text(index, encoding='utf-8')

readme = '''# Aurecon split-flap wall · Open Sans

A separate Open Sans version of the 3840 × 804 Aurecon split-flap office wall.

## Live pages

- `49x7.html`: fixed office order
- `49x7-random.html`: shuffled non-repeating office order

## Typography

All regular split-flap glyphs use **Open Sans Regular**. The font is self-hosted from the official Google Fonts source and included under the SIL Open Font License.

The large Melbourne clock remains a 4 × 5 illuminated-flap bitmap, so its numeral shapes do not depend on a font.

## Preserved behaviour

- 49 × 7 grid with 343 flaps
- 8 | 33 | 8 composition
- fixed and random office options
- no office repeats before the full random deck is exhausted
- live Melbourne clock during the entrance animation
- unchanged time digits remain still
- current weather with BOM-first and model fallback behaviour
- NVIDIA Shield and Enplug performance mode
- automatic viewport scaling
- noindex and no-referrer controls

## Source

Fork-style derivative of `creative-innovation-labs-bmc/aurecon-split-flap-wall`. The source production repository is not modified by this version.
'''
(ROOT / 'README.md').write_text(readme, encoding='utf-8')

manifest = {
    'font_family': 'Open Sans',
    'font_file': 'fonts/OpenSans-Variable.ttf',
    'font_weight': 400,
    'native_stage': [3840, 804],
    'grid': [49, 7],
    'source_repository': 'creative-innovation-labs-bmc/aurecon-split-flap-wall',
}
(ROOT / 'build-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
