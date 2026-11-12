---
name: visual-design-coffee
description: The recommended mark for a new coffee shop, judged on its visual strength and identity from its renders.
tags: [visual]
max_turns: 80
timeout_seconds: 1800
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: logo.svg, logo.png and logo-48.png hold one solid-color mark that reads at a glance, survives at 48 px, is well crafted, fits Tierra Alta, avoids coffee clichés and has one memorable idea.
---

Design the logo for Tierra Alta, a specialty coffee shop in Oaxaca that roasts beans from the Sierra Mazateca. It must work as an Instagram avatar and printed on paper cups.

Whatever process you follow, deliver these files, directly in the current working directory and not in a subfolder.

- `logo.svg`: the one symbol you recommend (no lettering), in a single solid color on a white background, with a square viewBox. Color comes later; this round judges the form.
- `logo.png` and `logo-48.png`: renders of `logo.svg` made with exactly these commands:

```sh
rsvg-convert -w 512 -h 512 -b white logo.svg -o logo.png
rsvg-convert -w 48 -h 48 -b white logo.svg -o logo-48.png
```

You may present other concepts in your answer as well.
