// aseprite.js
// Lean read-only parser for .aseprite/.ase files (spec: https://github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md).
// Parses header, layers, cels (raw/linked/zlib), palette, frame durations and tags,
// then composites visible layers into one full-canvas RGBA image per frame.
// Only Normal blending is implemented (the sprite is a cosmetic underlay in this tool);
// other blend modes fall back to Normal. Tilemap layers/cels are skipped.
// Depends on the browser-native DecompressionStream('deflate') for zlib data.

'use strict';

const AsepriteParser = (() => {

  const COLOR_DEPTH = { RGBA: 32, GRAYSCALE: 16, INDEXED: 8 };

  const LAYER_FLAG_VISIBLE = 1;
  const LAYER_FLAG_BACKGROUND = 8;
  const LAYER_TYPE_IMAGE = 0;
  const LAYER_TYPE_GROUP = 1;
  const LAYER_TYPE_TILEMAP = 2;

  const CEL_RAW = 0;
  const CEL_LINKED = 1;
  const CEL_ZLIB_IMAGE = 2;
  const CEL_ZLIB_TILEMAP = 3;

  const CHUNK_OLD_PALETTE_A = 0x0004;
  const CHUNK_OLD_PALETTE_B = 0x0011;
  const CHUNK_LAYER = 0x2004;
  const CHUNK_CEL = 0x2005;
  const CHUNK_TAGS = 0x2018;
  const CHUNK_PALETTE = 0x2019;

  async function inflate(bytes) {
    const stream = new Blob([bytes]).stream()
      .pipeThrough(new DecompressionStream('deflate'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  // Sequential little-endian reader over a DataView.
  class Reader {
    constructor(view, offset) {
      this.view = view;
      this.pos = offset || 0;
    }
    u8() { return this.view.getUint8(this.pos++); }
    u16() { const v = this.view.getUint16(this.pos, true); this.pos += 2; return v; }
    i16() { const v = this.view.getInt16(this.pos, true); this.pos += 2; return v; }
    u32() { const v = this.view.getUint32(this.pos, true); this.pos += 4; return v; }
    skip(n) { this.pos += n; }
    bytes(n) {
      const arr = new Uint8Array(this.view.buffer, this.view.byteOffset + this.pos, n);
      this.pos += n;
      return arr;
    }
    string() {
      const len = this.u16();
      return new TextDecoder().decode(this.bytes(len));
    }
  }

  async function parse(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    const r = new Reader(view, 0);

    // --- 128-byte header ---
    r.u32(); // file size
    const magic = r.u16();
    if (magic !== 0xA5E0) throw new Error('Not an .aseprite file (bad magic)');
    const numFrames = r.u16();
    const width = r.u16();
    const height = r.u16();
    const colorDepth = r.u16();
    r.u32(); // flags
    r.u16(); // deprecated speed
    r.skip(8);
    const transparentIndex = r.u8();
    r.skip(3);
    r.u16(); // number of colors (0 == 256)
    r.pos = 128;

    const layers = [];       // in chunk order == stacking order (bottom first)
    const palette = [];      // [{r,g,b,a}]
    const tags = [];
    const frames = [];       // [{duration, cels: Map<layerIndex, cel>}]
    let sawNewPalette = false;

    for (let f = 0; f < numFrames; f++) {
      const frameStart = r.pos;
      const frameBytes = r.u32();
      const frameMagic = r.u16();
      if (frameMagic !== 0xF1FA) throw new Error(`Bad frame magic at frame ${f}`);
      const oldChunks = r.u16();
      const duration = r.u16();
      r.skip(2);
      const newChunks = r.u32();
      const numChunks = newChunks === 0 ? oldChunks : newChunks;

      const frame = { duration, cels: new Map() };
      frames.push(frame);

      for (let c = 0; c < numChunks; c++) {
        const chunkStart = r.pos;
        const chunkSize = r.u32();
        const chunkType = r.u16();
        const chunkEnd = chunkStart + chunkSize;

        switch (chunkType) {
          case CHUNK_LAYER: {
            const flags = r.u16();
            const type = r.u16();
            const childLevel = r.u16();
            r.skip(4); // default width/height (ignored)
            const blendMode = r.u16();
            const opacity = r.u8();
            r.skip(3);
            const name = r.string();
            layers.push({
              name, flags, type, childLevel, blendMode, opacity,
              visible: (flags & LAYER_FLAG_VISIBLE) !== 0,
              background: (flags & LAYER_FLAG_BACKGROUND) !== 0,
            });
            break;
          }
          case CHUNK_CEL: {
            const layerIndex = r.u16();
            const x = r.i16();
            const y = r.i16();
            const opacity = r.u8();
            const celType = r.u16();
            const zIndex = r.i16();
            r.skip(5);
            if (celType === CEL_RAW || celType === CEL_ZLIB_IMAGE) {
              const w = r.u16();
              const h = r.u16();
              const data = r.bytes(chunkEnd - r.pos);
              frame.cels.set(layerIndex, {
                layerIndex, x, y, opacity, zIndex, w, h,
                compressed: celType === CEL_ZLIB_IMAGE,
                data, pixels: null, // pixels filled in below (after inflate)
              });
            } else if (celType === CEL_LINKED) {
              const linkedFrame = r.u16();
              frame.cels.set(layerIndex, { layerIndex, linkedFrame });
            }
            // CEL_ZLIB_TILEMAP: skipped
            break;
          }
          case CHUNK_TAGS: {
            const count = r.u16();
            r.skip(8);
            for (let t = 0; t < count; t++) {
              const from = r.u16();
              const to = r.u16();
              const loopDir = r.u8();
              const repeat = r.u16();
              r.skip(6);
              r.skip(3); // deprecated tag color
              r.skip(1);
              const name = r.string();
              tags.push({ name, from, to, loopDir, repeat });
            }
            break;
          }
          case CHUNK_PALETTE: {
            r.u32(); // new palette size
            const first = r.u32();
            const last = r.u32();
            r.skip(8);
            for (let i = first; i <= last; i++) {
              const entryFlags = r.u16();
              palette[i] = { r: r.u8(), g: r.u8(), b: r.u8(), a: r.u8() };
              if (entryFlags & 1) r.string(); // color name (ignored)
            }
            sawNewPalette = true;
            break;
          }
          case CHUNK_OLD_PALETTE_A:
          case CHUNK_OLD_PALETTE_B: {
            if (!sawNewPalette) {
              const packets = r.u16();
              let index = 0;
              for (let p = 0; p < packets; p++) {
                index += r.u8();
                let count = r.u8();
                if (count === 0) count = 256;
                for (let i = 0; i < count; i++) {
                  palette[index + i] = { r: r.u8(), g: r.u8(), b: r.u8(), a: 255 };
                }
                index += count;
              }
            }
            break;
          }
          // everything else (color profile, user data, slices, tilesets…) is skipped
        }

        r.pos = chunkEnd;
      }

      r.pos = frameStart + frameBytes;
    }

    // Decompress all zlib cels up front so compositing is synchronous.
    const jobs = [];
    for (const frame of frames) {
      for (const cel of frame.cels.values()) {
        if (cel.linkedFrame !== undefined) continue;
        if (cel.compressed) {
          jobs.push(inflate(cel.data).then(px => { cel.pixels = px; cel.data = null; }));
        } else {
          cel.pixels = cel.data;
          cel.data = null;
        }
      }
    }
    await Promise.all(jobs);

    // Resolve linked cels to the cel they reference.
    for (const frame of frames) {
      for (const [layerIndex, cel] of frame.cels) {
        if (cel.linkedFrame !== undefined) {
          const target = frames[cel.linkedFrame].cels.get(layerIndex);
          if (target) frame.cels.set(layerIndex, target);
          else frame.cels.delete(layerIndex);
        }
      }
    }

    // Effective visibility: a layer renders only if it and all ancestor groups are visible.
    const effectiveVisible = [];
    const groupVisibleAtLevel = []; // visibility of enclosing group per child level
    for (const layer of layers) {
      let parentsVisible = true;
      for (let lvl = 0; lvl < layer.childLevel; lvl++) {
        if (groupVisibleAtLevel[lvl] === false) { parentsVisible = false; break; }
      }
      effectiveVisible.push(parentsVisible && layer.visible);
      if (layer.type === LAYER_TYPE_GROUP) {
        groupVisibleAtLevel[layer.childLevel] = parentsVisible && layer.visible;
      }
    }

    const bytesPerPixel = colorDepth === COLOR_DEPTH.RGBA ? 4
      : colorDepth === COLOR_DEPTH.GRAYSCALE ? 2 : 1;

    // Read cel pixel i as RGBA. Indexed pixels use the palette; the transparent
    // index is transparent except on background layers.
    function pixelToRGBA(pixels, i, layer, out) {
      if (colorDepth === COLOR_DEPTH.RGBA) {
        const o = i * 4;
        out[0] = pixels[o]; out[1] = pixels[o + 1];
        out[2] = pixels[o + 2]; out[3] = pixels[o + 3];
      } else if (colorDepth === COLOR_DEPTH.GRAYSCALE) {
        const o = i * 2;
        out[0] = out[1] = out[2] = pixels[o]; out[3] = pixels[o + 1];
      } else {
        const idx = pixels[i];
        if (idx === transparentIndex && !layer.background) {
          out[0] = out[1] = out[2] = out[3] = 0;
        } else {
          const col = palette[idx] || { r: 0, g: 0, b: 0, a: 0 };
          out[0] = col.r; out[1] = col.g; out[2] = col.b; out[3] = col.a;
        }
      }
    }

    // Composite one frame: visible layers, bottom to top, Normal (src-over) blending.
    function compositeFrame(frameIndex) {
      const out = new Uint8ClampedArray(width * height * 4);
      const frame = frames[frameIndex];
      if (!frame) throw new Error(`No frame ${frameIndex}`);

      // Draw order: layer stacking order adjusted by cel z-index.
      const drawList = [];
      for (const [layerIndex, cel] of frame.cels) {
        if (!effectiveVisible[layerIndex]) continue;
        const layer = layers[layerIndex];
        if (layer.type !== LAYER_TYPE_IMAGE) continue;
        if (!cel.pixels) continue;
        drawList.push({ cel, layer, order: layerIndex + (cel.zIndex || 0), z: cel.zIndex || 0 });
      }
      drawList.sort((a, b) => (a.order - b.order) || (a.z - b.z));

      const src = [0, 0, 0, 0];
      for (const { cel, layer } of drawList) {
        const alphaScale = (cel.opacity / 255) * (layer.opacity / 255);
        for (let cy = 0; cy < cel.h; cy++) {
          const py = cel.y + cy;
          if (py < 0 || py >= height) continue;
          for (let cx = 0; cx < cel.w; cx++) {
            const px = cel.x + cx;
            if (px < 0 || px >= width) continue;
            pixelToRGBA(cel.pixels, cy * cel.w + cx, layer, src);
            const sa = (src[3] / 255) * alphaScale;
            if (sa <= 0) continue;
            const o = (py * width + px) * 4;
            const da = out[o + 3] / 255;
            const oa = sa + da * (1 - sa);
            out[o]     = (src[0] * sa + out[o]     * da * (1 - sa)) / oa;
            out[o + 1] = (src[1] * sa + out[o + 1] * da * (1 - sa)) / oa;
            out[o + 2] = (src[2] * sa + out[o + 2] * da * (1 - sa)) / oa;
            out[o + 3] = oa * 255;
          }
        }
      }
      return { width, height, data: out };
    }

    return {
      width, height, colorDepth, numFrames,
      layers, palette, tags,
      durations: frames.map(f => f.duration),
      compositeFrame,
    };
  }

  return { parse, COLOR_DEPTH };
})();

if (typeof module !== 'undefined') module.exports = AsepriteParser;
