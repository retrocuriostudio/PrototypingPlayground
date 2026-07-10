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
| `debug-widget.js` | Shared debug button + panel injected into every prototype (see below). |
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
3. Include the shared debug widget as the **first element inside `<body>`** (it must run
   before the prototype's own scripts):

   ```html
   <script src="../../debug-widget.js" data-name="Display Name" data-version="1"></script>
   ```

   The widget injects a round 🐛 button (top-right) that opens a panel showing the
   prototype name, its version, and a "← Back to Menu" link. **Do not add visible
   back links anywhere else** — the menu link lives only in the debug panel.
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

## Prototype versioning

`data-version` on the debug-widget script tag is a plain integer. **Increment it by 1
every time work is done on a prototype** — any change to that prototype's files counts.
This rule is for agents and developers only: never surface it in player-visible text,
UI, or on-page comments; the panel just shows the current number.

## Debug panel conventions

- The shared widget owns the 🐛 button and the panel's open/close behavior; prototypes
  must not create their own debug buttons or overlays.
- Prototype-specific debug controls (sliders, toggles, reset buttons) go in a
  `<template id="debug-extras">` anywhere in `<body>`; the widget adopts its content
  into the panel between the version line and the menu link. The widget adopts the
  template on `DOMContentLoaded`, so bind listeners to those controls in a
  `DOMContentLoaded` handler (or later), not at script parse time.
- The widget reuses the historical IDs `#debug-btn`, `#debug-overlay`,
  `#debug-close-btn`, and `#version-display`, so prototype code may reference them.

## Verifying changes

- Serve the repo root and check: the menu lists the prototype, its card opens it,
  the 🐛 button opens the debug panel, and its "← Back to Menu" link returns to
  `Prototypes.html`.
- Prototypes that `fetch` JSON configs won't work from `file://` — always use a local server.
