// The map canvas: drawing loop, pan and zoom (mouse, trackpad, touch), and
// clicking on people and buildings.
import { useEffect, useRef } from 'preact/hooks';
import { Renderer } from '../render/renderer';
import { store } from '../game/store';
import { view } from './view';
import { skyAt } from '../game/sky';
import { reportCrash } from './App';

export function MapView() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const r = new Renderer(canvas);
    view.renderer = r;
    const s0 = store.state;
    if (s0) { r.centerOn(s0.hearth.x + 0.5, s0.hearth.y + 0.5); r.night = skyAt(s0, Date.now()).night; }

    // A quiet companion: 30 frames a second while you work, 10 while the city
    // sleeps, so it costs little battery sitting beside your work all day.
    let raf = 0;
    let lastDraw = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const s = store.state;
      if (!s) return;
      const interval = s.focus.running ? 1000 / 30 : 1000 / 10;
      if (t - lastDraw < interval - 2) return;
      lastDraw = t;
      try {
        store.tick();
        r.frame(s, t, !!s.focus.running, store.ui.selection, skyAt(s, Date.now()).night);
      } catch (e) {
        reportCrash(e);
      }
    };
    raf = requestAnimationFrame(loop);

    const ro = new ResizeObserver(() => r.resize());
    ro.observe(canvas);

    // Pointer handling: drag to pan, pinch to zoom, click to select.
    const pointers = new Map<number, { x: number; y: number }>();
    let moved = 0;
    let pinch = 0;
    const pos = (e: PointerEvent) => {
      const b = canvas.getBoundingClientRect();
      return { x: e.clientX - b.left, y: e.clientY - b.top };
    };
    const down = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, pos(e));
      moved = 0;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
      canvas.classList.add('dragging');
    };
    const move = (e: PointerEvent) => {
      const p = pos(e);
      const prev = pointers.get(e.pointerId);
      if (!prev) {
        const s = store.state;
        if (s) {
          const hit = r.hover(s, p.x, p.y);
          canvas.classList.toggle('pointing', !!hit);
        }
        return;
      }
      if (pointers.size === 2) {
        pointers.set(e.pointerId, p);
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 0) r.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinch);
        pinch = d;
        moved += 10;
        return;
      }
      r.pan(p.x - prev.x, p.y - prev.y);
      moved += Math.abs(p.x - prev.x) + Math.abs(p.y - prev.y);
      pointers.set(e.pointerId, p);
    };
    const up = (e: PointerEvent) => {
      const p = pos(e);
      const was = pointers.size;
      pointers.delete(e.pointerId);
      if (!pointers.size) canvas.classList.remove('dragging');
      if (was === 1 && moved < 6) {
        const s = store.state;
        if (s) store.setUi({ selection: r.pick(s, p.x, p.y) });
      }
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const b = canvas.getBoundingClientRect();
      const x = e.clientX - b.left;
      const y = e.clientY - b.top;
      if (e.ctrlKey) r.zoomAt(x, y, Math.exp(-e.deltaY * 0.012)); // trackpad pinch
      else if (e.deltaMode === 0 && e.deltaX !== 0) r.pan(-e.deltaX, -e.deltaY); // two-finger scroll
      else r.zoomAt(x, y, Math.exp(-e.deltaY * (e.deltaMode ? 0.08 : 0.0025))); // mouse wheel
    };
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, select')) return;
      const step = 40;
      if (e.key === 'ArrowLeft' || e.key === 'a') r.pan(step, 0);
      else if (e.key === 'ArrowRight' || e.key === 'd') r.pan(-step, 0);
      else if (e.key === 'ArrowUp' || e.key === 'w') r.pan(0, step);
      else if (e.key === 'ArrowDown' || e.key === 's') r.pan(0, -step);
      else if (e.key === '+' || e.key === '=') r.zoomAt(r.w / 2, r.h / 2, 1.2);
      else if (e.key === '-') r.zoomAt(r.w / 2, r.h / 2, 1 / 1.2);
      else if (e.key === 'Escape') store.setUi({ selection: null, panel: null, act: null });
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('keydown', key);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('wheel', wheel);
      window.removeEventListener('keydown', key);
      view.renderer = null;
    };
  }, []);

  return <canvas ref={ref} class="map grab" aria-label="Map of the settlement" />;
}

export function ZoomButtons() {
  const z = (f: number) => { const r = view.renderer; if (r) r.zoomAt(r.w / 2, r.h / 2, f); };
  const home = () => { const r = view.renderer; const s = store.state; if (r && s) r.centerOn(s.hearth.x + 0.5, s.hearth.y + 0.5); };
  return (
    <div class="zoom">
      <button class="btn paper" onClick={() => z(1.25)} aria-label="Zoom in">+</button>
      <button class="btn paper" onClick={() => z(0.8)} aria-label="Zoom out">−</button>
      <button class="btn paper" onClick={home} aria-label="Back to the hearth" title="Back to the hearth">⌂</button>
    </div>
  );
}
