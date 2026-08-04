# Project brief

## Description

Open Sans variant of the Aurecon 3840 × 804 split-flap world office wall, preserving the current fixed-order and non-repeating random-office builds.

## Build brief

Purpose:
Create an independent fork-style version of `creative-innovation-labs-bmc/aurecon-split-flap-wall` without changing the existing production repository.

Typography:
- Use Open Sans for all regular split-flap text, including office names, country codes, office times, Melbourne header and weather footer.
- Use official Google Fonts Open Sans assets with reliable system fallbacks.
- Retune font size, vertical offset and tracking so all seven- and eight-character office names remain legible and centred within the existing flap geometry.
- Preserve the white macro clock bitmap exactly because the large HH:MM:SS is built from illuminated flap cells rather than font glyphs.

Builds to preserve:
- Fixed-order 49 × 7 production wall.
- Random-office 49 × 7 option.
- Random office order must not repeat until all offices have appeared.
- During the entrance animation, already-active clock cells must continue tracking live Melbourne time.
- Unchanged HH/MM/SS digits must not flap unnecessarily during launch.
- Preserve the current right-side office-name alignment rules and the Melbourne clock position.

Layout and behaviour:
- Native 3840 × 804 stage.
- 49 × 7 grid, 343 flaps.
- 8 | 33 | 8 layout.
- Longer office names on both sides.
- Embedded green split-circle Melbourne colons.
- Green two-dot office-time colons.
- Live Melbourne time, rotating office cards and current weather behaviour.
- Existing row-by-row launch sequence and card-by-card office transitions.

Performance:
- Vanilla HTML, CSS and JavaScript only.
- No Canvas, WebGL or frameworks.
- Retain NVIDIA Shield and Enplug performance mode.
- Only changed flaps animate.
- Mobile viewport auto-scaling for testing.

Deployment and privacy:
- GitHub Pages enabled from main/root.
- Include noindex, nofollow, noarchive, nosnippet and noimageindex metadata.
- Include robots.txt and .nojekyll.
- No analytics.

Reference font:
https://fonts.google.com/specimen/Open+Sans

Source repository:
https://github.com/creative-innovation-labs-bmc/aurecon-split-flap-wall
