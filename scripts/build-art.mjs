// Art pipeline: turns ChatGPT masters in art/ into game-ready sprites in
// public/art/, plus a manifest the game reads at startup.
//
//   npm run art
//
// Masters are the images exactly as made against a footprint template:
// 1024 × 1024 (or 1024 × 1536 for the tall templates), transparent, with the
// building's base on the template's diamond. No resizing or trimming by hand.
// Smaller copies of a template-aligned image also work (e.g. 256 × 256).
//
// Optional sidecar JSON next to an image (same name, .json) can override
// { "anchorPx": [x, y], "tilePx": n, "lights": [[x, y], ...], "smoke": [[x, y], ...] }
// in the image's own pixels.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'art');
const OUT = path.join(ROOT, 'public', 'art');
const TARGET_TILE_PX = 256; // game sprites: 256 px per tile at most
const TEMPLATE = { width: 1024, diamond: 720, bottomMargin: 112 };
const NAME = /^([a-z]+)_([a-z0-9-]+)_([a-z-]+)_(\d+)x(\d+)_v(\d\d)(?:_([a-z-]+))?$/;

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.name.toLowerCase().endsWith('.png')) out.push(p);
  }
  return out;
}

async function build() {
  if (!fs.existsSync(SRC)) { console.log('No art/ folder yet.'); return; }
  const manifest = { sprites: {} };
  const problems = [];
  for (const file of walk(SRC)) {
    const rel = path.relative(SRC, file);
    const base = path.basename(file, '.png');
    const m = base.match(NAME);
    if (!m) { problems.push(`${rel}: name doesn't follow kind_subject_era_WxH_vNN[_state].png`); continue; }
    const fw = Number(m[4]);
    const img = sharp(file);
    const meta = await img.metadata();
    const W = meta.width;
    const H = meta.height;
    const k = W / TEMPLATE.width; // template scale of this image
    let anchor = [W / 2, H - TEMPLATE.bottomMargin * k];
    let tilePx = (TEMPLATE.diamond * k) / fw;
    let lights = [];
    let smoke = [];
    const sidecar = file.replace(/\.png$/i, '.json');
    if (fs.existsSync(sidecar)) {
      const extra = JSON.parse(fs.readFileSync(sidecar, 'utf8'));
      if (extra.anchorPx) anchor = extra.anchorPx;
      if (extra.tilePx) tilePx = extra.tilePx;
      lights = extra.lights ?? [];
      smoke = extra.smoke ?? [];
    }
    if (!meta.hasAlpha) problems.push(`${rel}: no transparency (the game will show its background)`);

    // Scale down to the game's resolution, then trim empty margins.
    const scale = Math.min(1, TARGET_TILE_PX / tilePx);
    const sw = Math.max(1, Math.round(W * scale));
    const sh = Math.max(1, Math.round(H * scale));
    const { data, info } = await img.ensureAlpha().resize(sw, sh, { kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
    let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        if (data[(y * info.width + x) * 4 + 3] > 2) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) { problems.push(`${rel}: image is empty`); continue; }
    const pad = 2;
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
    x1 = Math.min(info.width - 1, x1 + pad); y1 = Math.min(info.height - 1, y1 + pad);
    const outRel = rel.split(path.sep).join('/');
    const outFile = path.join(OUT, outRel);
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
      .png({ compressionLevel: 9 })
      .toFile(outFile);
    const tr = ([x, y]) => [Math.round((x * scale - x0) * 10) / 10, Math.round((y * scale - y0) * 10) / 10];
    manifest.sprites[base] = {
      file: outRel,
      tilePx: Math.round(tilePx * scale * 100) / 100,
      anchor: tr(anchor),
      footprint: [fw, Number(m[5])],
      lights: lights.map(tr),
      smoke: smoke.map(tr),
    };
    console.log(`✓ ${outRel}  ${x1 - x0 + 1}×${y1 - y0 + 1}px, ${Math.round(tilePx * scale)} px per tile`);
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  for (const p of problems) console.warn(`! ${p}`);
  console.log(`${Object.keys(manifest.sprites).length} sprites in public/art/manifest.json`);
}

build().catch((e) => { console.error(e); process.exit(1); });
