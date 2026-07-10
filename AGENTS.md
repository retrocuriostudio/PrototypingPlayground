# Prototyping Playground — Agent Guide

This repo is the static site for retrocuriostudio.com (GitHub Pages, domain set via `CNAME`).
There is **no build step and no npm** — everything must run from plain HTML/JS/CSS files.
Test by serving the repo root (e.g. `python3 -m http.server`) and clicking through.

## Site layout

| File | Purpose |
|---|---|
| `index.html` | Logo splash (looping video). Contains a subtle `π` link in the top-left corner that leads to the prototypes menu. Keep it otherwise link-free. |
| `Prototypes.html` | The prototypes menu. Fetches `PrototypesConfig.json` and renders a card per entry, skipping entries with `"private": true`. |
| `PrototypesConfig.json` | Registry of all prototypes (name, description, path, private). |
| `coming-soon.html` | Placeholder page for unbuilt sections. |
| `prototypes/<name>/` | One folder per prototype. |

## Adding a new prototype

1. Create a folder `prototypes/<kebab-case-name>/` with an `index.html` entry point.
2. Follow the file conventions:
   - `index.html` — the entry point. Small prototypes may inline everything here.
   - `game.js` — the logic, when split out (house-builder additionally keeps a
     unit-tested `core.js` module; that pattern is fine too).
   - `style.css` — the styles, when split out (`style.css`, not `styles.css`).
   - Tunable/balance values go in PascalCase JSON files (e.g. `GameConfig.json`,
     `WeaponPresets.json`) loaded via `fetch`, so they can be tweaked without touching code.
3. Add a "← Back to Menu" link near the top of `<body>` pointing to `../../Prototypes.html`,
   styled to fit the prototype's look (most use a small fixed pill in the top-left corner).
4. Register it in `PrototypesConfig.json`:

   ```json
   {
     "name": "Display Name",
     "description": "One-sentence description shown on the card.",
     "path": "prototypes/<kebab-case-name>/index.html",
     "private": false
   }
   ```

   Set `"private": true` to keep a prototype off the menu while still reachable by
   direct URL (e.g. `prototypes/tmi-b2b-calculator/`).

## Verifying changes

- Serve the repo root and check: the menu lists the prototype, its card opens it,
  and the back link returns to `Prototypes.html`.
- Prototypes that `fetch` JSON configs won't work from `file://` — always use a local server.
