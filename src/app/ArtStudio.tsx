// Art test scene: drop a ChatGPT image onto the real grid to check its fit,
// light and readability, then use it in your city right away.
import { useEffect, useRef, useState } from 'preact/hooks';
import { ART_KEY, TREE_KEY, buildingSprite, realSprite, setOverride, type Sprite } from '../render/sprites';
import { C, GRASS_BY_SEASON, mix, shade } from '../render/palette';
import { store } from '../game/store';
import { deleteArt, saveArt } from './artStore';
import { fitBase } from '../render/footprint';

const SLOTS = [...Object.values(ART_KEY), ...TREE_KEY.filter(Boolean)] as string[];
const TARGET = 256;

export function footprintOf(key: string): number {
  const m = key.match(/_(\d+)x(\d+)/);
  return m ? Number(m[1]) : 1;
}

/** Any ChatGPT image → game sprite: find the footprint, scale to 256 px per tile, trim the margins. */
export async function processArt(img: HTMLImageElement | ImageBitmap, tiles: number, keyMagenta: boolean): Promise<{ sprite: Sprite; dataUrl: string }> {
  const W = img.width;
  const H = img.height;
  // Find where the building stands, at full size.
  const full = document.createElement('canvas');
  full.width = W; full.height = H;
  const fg = full.getContext('2d', { willReadFrequently: true })!;
  fg.drawImage(img, 0, 0);
  const fd = fg.getImageData(0, 0, W, H).data;
  const alpha = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const r = fd[i * 4], gg = fd[i * 4 + 1], b = fd[i * 4 + 2];
    alpha[i] = keyMagenta && r > 200 && b > 200 && gg < 90 ? 0 : fd[i * 4 + 3];
  }
  const fit = fitBase(alpha, W, H, tiles, tiles);
  const tilePx = fit.tilePx;
  const scale = Math.min(1, TARGET / tilePx);
  const sw = Math.round(W * scale);
  const sh = Math.round(H * scale);
  const cv = document.createElement('canvas');
  cv.width = sw; cv.height = sh;
  const g = cv.getContext('2d', { willReadFrequently: true })!;
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, sw, sh);
  const data = g.getImageData(0, 0, sw, sh);
  const px = data.data;
  if (keyMagenta) {
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i], gg = px[i + 1], b = px[i + 2];
      if (r > 200 && b > 200 && gg < 90) px[i + 3] = 0;
    }
    g.putImageData(data, 0, 0);
  }
  let x0 = sw, y0 = sh, x1 = -1, y1 = -1;
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    if (px[(y * sw + x) * 4 + 3] > 2) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) throw new Error('The image is completely transparent.');
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext('2d')!.drawImage(cv, -x0, -y0);
  const ax = fit.ax * scale - x0;
  const ay = fit.ay * scale - y0;
  const opaque = px[3] === 255 && px[(sw * sh - 1) * 4 + 3] === 255;
  const sprite: Sprite = { img: out, w: out.width, h: out.height, ax, ay, tilePx: tilePx * scale, tiles, lights: [], smoke: [], real: true };
  if (opaque && !keyMagenta) store.toast('This image has no transparent background. Try the magenta option, or ask ChatGPT for a transparent PNG.');
  return { sprite, dataUrl: out.toDataURL('image/png') };
}

export function ArtStudio() {
  const [slot, setSlot] = useState('bld_home_bronze_1x1');
  const [sprite, setSprite] = useState<Sprite | null>(null);
  const [png, setPng] = useState('');
  const [zoom, setZoom] = useState(1);
  const [night, setNight] = useState(false);
  const [winter, setWinter] = useState(false);
  const [magenta, setMagenta] = useState(false);
  const [over, setOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const ref = useRef<HTMLCanvasElement>(null);
  const tiles = footprintOf(slot);

  const load = async (f: File) => {
    setFile(f);
    const m = f.name.match(/^([a-z]+_[a-z0-9-]+_[a-z-]+_\d+x\d+)/);
    const key = m && SLOTS.includes(m[1]) ? m[1] : slot;
    if (key !== slot) setSlot(key);
    try {
      const bmp = await createImageBitmap(f);
      const { sprite: sp, dataUrl } = await processArt(bmp, footprintOf(key), magenta);
      setSprite(sp);
      setPng(dataUrl);
    } catch (e) {
      store.toast(`Couldn't read that image: ${(e as Error).message}`);
    }
  };
  useEffect(() => { if (file) void load(file); }, [magenta]);

  useEffect(() => {
    const cv = ref.current!;
    const draw = () => {
      const r = cv.getBoundingClientRect();
      const dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = r.width * dpr; cv.height = r.height * dpr;
      const g = cv.getContext('2d')!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = '#262e28'; g.fillRect(0, 0, r.width, r.height);
      const tw = 64 * zoom * 2;
      const cx = r.width / 2;
      const cy = r.height / 2 + tw * 0.4;
      const P = (x: number, y: number) => ({ x: cx + (x - y) * tw / 2, y: cy + (x + y) * tw / 4 });
      const grass = winter ? C.snow : GRASS_BY_SEASON[1];
      for (let y = -4; y < 4 + tiles; y++) for (let x = -4; x < 4 + tiles; x++) {
        const a = P(x, y), b = P(x + 1, y), c = P(x + 1, y + 1), d = P(x, y + 1);
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(d.x, d.y); g.closePath();
        g.fillStyle = shade(grass, ((x * 7 + y * 3) % 3 - 1) * 0.03); g.fill();
        g.strokeStyle = 'rgba(59,47,42,0.12)'; g.stroke();
      }
      // footprint outline
      const f = [P(0, 0), P(tiles, 0), P(tiles, tiles), P(0, tiles)];
      g.beginPath(); f.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath();
      g.strokeStyle = C.hearthGold; g.lineWidth = 2; g.stroke();
      const put = (sp: Sprite, gx: number, gy: number) => {
        const s = tw / sp.tilePx;
        const a = P(gx, gy);
        g.drawImage(sp.img, a.x - sp.ax * s, a.y - sp.ay * s, sp.w * s, sp.h * s);
      };
      // neighbours for comparison: a placeholder home and the current art in the slot
      const neighbour = buildingSprite('house', 1, winter);
      put(neighbour, -1, tiles + 1);
      put(neighbour, tiles + 1, -1);
      const current = sprite ?? realSprite(slot, 0, winter ? 'winter' : undefined);
      if (current) put(current, tiles, tiles);
      if (night) {
        g.globalCompositeOperation = 'multiply';
        g.fillStyle = mix('#FFE2B8', '#4A5684', 1);
        g.fillRect(0, 0, r.width, r.height);
        g.globalCompositeOperation = 'source-over';
      }
      // readability check: the asset at 48 px wide
      if (current) {
        const s = 48 / current.w;
        g.fillStyle = 'rgba(242,230,204,0.9)'; g.fillRect(12, r.height - 84, 72, 72);
        g.drawImage(current.img, 12 + 12, r.height - 84 + 36 - current.h * s / 2, 48, current.h * s);
        g.fillStyle = C.ink; g.font = '11px system-ui'; g.fillText('at 48 px', 22, r.height - 16);
      }
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(cv);
    return () => ro.disconnect();
  }, [sprite, zoom, night, winter, slot]);

  const use = async () => {
    if (!sprite) return;
    setOverride(`${slot}_v01`, sprite);
    await saveArt(`${slot}_v01`, png, sprite);
    store.toast('Using this art in your city now.', 'gold');
  };
  const remove = async () => {
    setOverride(`${slot}_v01`, null);
    await deleteArt(`${slot}_v01`);
    setSprite(null);
    store.toast('Removed. The city uses the built-in art again.');
  };
  const download = () => {
    const a = document.createElement('a');
    a.href = png;
    a.download = `${slot}_v01.png`;
    a.click();
  };

  return (
    <div class="studio">
      <aside class="paper form">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <b style={{ fontFamily: 'var(--serif)', fontSize: 20 }}>Art test scene</b>
          <button class="btn small" onClick={() => store.setUi({ panel: 'settings' })}>Done</button>
        </div>
        <p class="hint">Drop in an image from ChatGPT at its original size. The game finds where the building stands; the gold outline shows the footprint it found. If the base doesn't sit on it, tell Claude and the file can get hand measurements.</p>
        <label>Asset</label>
        <select value={slot} onChange={(e) => { setSlot((e.target as HTMLSelectElement).value); setSprite(null); setFile(null); }}>
          {SLOTS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <div class={`drop${over ? ' over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer?.files[0]; if (f) void load(f); }}>
          Drop a PNG here, or <label class="pname">choose a file<input type="file" accept="image/png,image/webp" hidden onChange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) void load(f); }} /></label>
        </div>
        <label><input type="checkbox" checked={magenta} onChange={(e) => setMagenta((e.target as HTMLInputElement).checked)} /> Remove a magenta (#FF00FF) background</label>
        <label>Zoom</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {[0.25, 0.5, 1, 1.5].map((z) => <button key={z} type="button" class={`chip${zoom === z ? ' on' : ''}`} onClick={() => setZoom(z)}>{z * 100}%</button>)}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <button type="button" class={`chip${night ? ' on' : ''}`} onClick={() => setNight(!night)}>Night</button>
          <button type="button" class={`chip${winter ? ' on' : ''}`} onClick={() => setWinter(!winter)}>Winter</button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
          <button class="btn primary small" disabled={!sprite} onClick={use}>Use in my city</button>
          <button class="btn small" disabled={!png} onClick={download}>Download game-ready PNG</button>
          <button class="btn small" onClick={remove}>Remove</button>
        </div>
        <p class="hint">Art used here lives on this computer only. To make it permanent, put the original file in the project's art/ folder (or send it to Claude).</p>
      </aside>
      <canvas ref={ref} aria-label="Preview of the asset on the grid" />
    </div>
  );
}
