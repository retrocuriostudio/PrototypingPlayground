# Heightmap → Normal Tool

A self-contained web app for authoring **normal maps for pixel art** by painting
per-pixel **distance steps** (closer/farther from the camera) over an Aseprite
sprite, with a live heightmap and normal-map preview.

No build step, no install, no dependencies. Open `index.html` in a Chromium
browser and go.

## Purpose & background

Hand-drawing normal maps for pixel art is error-prone; generating them from the
sprite's colors bakes lighting artifacts into the result. The clean workflow
(per ["Analysis and Compilation of Normal Map Generation Techniques for Pixel
Art"](https://arxiv.org/abs/2212.09692), IEEE 2022) is to author a **height map**
by hand and derive the normal map from it with a **Sobel filter**. This tool
streamlines that: instead of painting subtle grays, you paint small integer
**distance steps** (−range … 0 … +range, "farther … base … closer"), which are
easy to see and reason about at pixel-art scale, and the tool derives both the
heightmap and the normal map live.

It was originally planned as a set of Aseprite Lua scripts, but Aseprite's
scripting API cannot add a real custom paint tool to the editor canvas, so it
became an external companion app. Design consequence: the tool is strictly
**read-only on `.aseprite` files** — the sprite is only a trace-over underlay;
all authored data lives in the tool and exports as PNGs. Your source files are
never modified, so there is zero corruption risk.

## The pipeline

```
.aseprite (read-only underlay)
        │  you paint integer distance steps per pixel, per frame
        ▼
distance map  ──(base + step × heightStep)──►  heightmap  ──(Sobel)──►  normal map
   Int steps                                   grayscale                 RGB
```

Everything downstream of your painting recomputes live as you paint or change
a setting.

### 1. Distance steps (what you author)

- Each pixel holds an integer step in `−range … +range` (default ±5, max ±10 —
  pixel art rarely needs more). `0` = base plane, positive = closer to camera,
  negative = farther.
- Unpainted pixels are step 0.
- Shown in the editor as a vivid diverging overlay (blues = farther,
  oranges/reds = closer) over the dimmed sprite, so steps stay distinct while
  you work.

### 2. Heightmap (derived)

`height = heightBase + step × heightStep`, clamped to 0–255.

- `heightBase` (default 128): gray value of the base plane.
- `heightStep` (default 8): gray units per step — deliberately **independent**
  of how the steps are displayed/stored, so the real heightmap can be subtle
  while the authoring view stays bold.
- `smooth` (default 0): box-blur radius in pixels; softens hard step edges so
  they become slopes instead of 1px walls in the normal map. Blur never bleeds
  across the sprite silhouette.
- `invert`: flips closer/farther.
- Pixels outside the sprite silhouette (alpha 0) have no height.

### 3. Normal map (derived)

Standard Sobel-operator method. For each pixel of the heightmap `H`:

```
Gx = [-1 0 1; -2 0 2; -1 0 1] ⊛ H        (horizontal gradient)
Gy = [-1 -2 -1; 0 0 0; 1 2 1] ⊛ H        (vertical gradient)
dx = Gx / (8·255)                         (slope, height-units per pixel, 0..1)
dy = Gy / (8·255)
N  = normalize(−dx·strength, −dy·strength, 1/8)
R = (N.x·0.5 + 0.5)·255
G = (N.y·0.5 + 0.5)·255                   (sign flipped for OpenGL)
B = (N.z·0.5 + 0.5)·255
```

Flat areas encode exactly `(128, 128, 255)`.

Settings:
- **Strength** (default 2): scales slope steepness.
- **Y axis**: `DirectX (−Y)` (default — Unity/Unreal style, green points down)
  or `OpenGL (+Y)` (Godot/Blender style, green points up).
- **Edges** — how the silhouette boundary is treated:
  - `Clamp (flat)`: out-of-silhouette neighbors reuse the center height → no
    rim lighting at the outline (safe default).
  - `Bevel (rounded)`: outside counts as height 0 → edges slope away, giving a
    rounded/embossed rim (coins, buttons).
- **Transparent**: `Keep` leaves outside-silhouette pixels transparent; `Fill
  flat` writes `(128,128,255)` there.

## Using the tool

1. **Load** an `.aseprite`/`.ase` (visible layers are composited per frame;
   hidden layers skipped; frame durations and tags read) or any PNG.
2. **Paint** steps in the left pane. Pick a step in the Step palette.
   - Tools: **paint** (P), **raise** ▲ / **lower** ▼ (+1/−1 per stroke, R/L),
     **fill** (F), **pick** (I), **erase** to base (E).
   - Right-click = erase. Zoom with the Zoom dropdown (100–1500%); when the
     canvas doesn't fit, the editor pane shows scrollbars — pan by dragging
     them. Ctrl+Z = undo (50 levels). Use the Brush field for brush size.
   - **Clamp to sprite** (default on) restricts painting to non-transparent
     sprite pixels.
3. **Animations**: a frame bar appears for multi-frame files. Arrow keys switch
   frames. **⧉ copy prev** seeds the current frame from the previous one;
   **onion** shows the previous frame's steps faintly.
4. Watch the **Heightmap** and **Normal** panes update live; tune settings.
5. **Export PNG sequences** writes, per frame:
   - `<name>_distance_NNNN.png` — your authored steps (see encoding below)
   - `<name>_height_NNNN.png` — the heightmap
   - `<name>_normal_NNNN.png` — the normal map
   - `<name>_settings.json` — all settings
   Uses a folder picker where available (Chrome/Edge), otherwise individual
   downloads. Frame numbers are 1-based to match Aseprite. Import the normal
   PNGs into Aseprite/your engine as needed (Aseprite opens a PNG sequence as
   frames).
6. **Resume later**: load the same sprite, then **Resume (distance PNGs)** and
   select the exported distance PNGs (+ settings JSON if you have it).

### Distance PNG encoding

`gray = 128 + step × spacing`, alpha 255 inside the silhouette (or wherever a
step is set), alpha 0 elsewhere. `spacing` (Author section, default 20) only
controls how visually distinct the exported grays are — it carries no height
meaning, and the UI auto-clamps it so `range × spacing ≤ 127` (round-trip can
never overflow 0–255). Resume decodes with `step = round((gray − 128) / spacing)`,
so keep the same spacing between export and resume (the settings JSON records it).

## Files

| File | Role |
|---|---|
| `index.html` | The entire app (UI + pipeline). Works from `file://`. |
| `aseprite.js` | Read-only `.aseprite` parser + per-frame compositor. |
| `test/index.html` | Parser test suite (needs a static server for `fetch`). |
| `test/assets/*.aseprite` | Fixtures generated headless by Aseprite 1.3.17. |
| `test/truth/*.png` | Aseprite's own composited exports = ground truth. |

### The parser (`aseprite.js`)

Implements the [ASE file spec](https://github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md):
header, layer chunks (incl. group visibility hierarchy), cel chunks
(raw / linked / zlib-compressed via native `DecompressionStream('deflate')`),
new+old palette chunks, frame durations, and tags. Supports RGBA, grayscale,
and indexed sprites (transparent index honored on non-background layers).
Composites visible image layers bottom-to-top with Normal (src-over) blending —
layer × cel opacity applied; non-Normal blend modes intentionally fall back to
Normal because the composite is only a cosmetic underlay, never part of the
output. Tilemap layers are skipped.

`test/index.html` runs 14 checks comparing composites pixel-by-pixel (±2
tolerance for canvas premultiply rounding) against the truth PNGs, plus
metadata assertions (durations, tags, hidden-layer exclusion, palette). Serve
the folder (e.g. `py -m http.server 8613 --directory heightmap-normal-tool`)
and open `http://localhost:8613/test/`.

## Browser requirements & known limitations

- Chromium-based browser recommended. Needs `DecompressionStream`,
  `OffscreenCanvas`, `createImageBitmap` (Chrome/Edge ≥ 94, Firefox ≥ 113,
  Safari ≥ 16.4). The folder-picker export path is Chromium-only; other
  browsers fall back to multiple downloads.
- (`Image.decode()` is deliberately avoided — it can stall forever in
  backgrounded tabs; all decoding goes through `createImageBitmap`.)
- Linked cels resolve to their source cel; tilemap layers and non-Normal blend
  modes are approximated (underlay-only impact).
- No selection tools yet; painting is brush/fill based.
- Undo is stroke-level, 50 entries, in-memory only.

## Ideas / future work

- Lit preview pane: render the sprite with the generated normal map and a
  movable light — judge results without leaving the tool.
- Auto-generate a starting heightmap from the sprite (distance-transform of the
  silhouette per the paper) as a seed to hand-correct.
- Sprite-sheet export, palette-constrained normal output, selection tools.
