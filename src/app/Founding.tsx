// Founding a settlement: pick a site, a name, your goals and the sliders.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Renderer } from '../render/renderer';
import { foundSettlement, DEFAULT_GOALS } from '../sim/sim';
import { settlementName } from '../sim/names';
import { makeRng } from '../sim/rng';
import { store } from '../game/store';
import type { Goals } from '../sim/types';
import { DARK_HINT, WEIRD_HINT } from './Settings';

const newSeed = () => (Math.random() * 2 ** 31) >>> 0;
const WEIRD = ['Historical', 'Folklore', 'Uncanny', 'Mythic', 'Fantastical'];

export function Founding() {
  const [seed, setSeed] = useState(newSeed);
  const [name, setName] = useState(() => settlementName(makeRng(newSeed())));
  const [goals, setGoals] = useState<Goals>({ ...DEFAULT_GOALS });
  const [darkness, setDarkness] = useState(50);
  const [weirdness, setWeirdness] = useState(1);
  const preview = useMemo(() => foundSettlement({ seed, name: name || 'the settlement' }), [seed]);
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const r = new Renderer(ref.current!);
    r.night = 0;
    r.cam.zoom = 0.62;
    r.centerOn(preview.hearth.x - 4, preview.hearth.y + 2);
    let raf = 0;
    const loop = (t: number) => { raf = requestAnimationFrame(loop); r.frame(preview, t, true, null); };
    raf = requestAnimationFrame(loop);
    const ro = new ResizeObserver(() => r.resize());
    ro.observe(ref.current!);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [preview]);

  const begin = (e: Event) => {
    e.preventDefault();
    const s = foundSettlement({ seed, name: name.trim() || 'Hearthwork', goals, settings: { darkness, weirdness } });
    store.setState(s);
  };
  const setGoal = (k: keyof Goals, v: string) => setGoals({ ...goals, [k]: Math.max(0, Math.round(Number(v) || 0)) });

  return (
    <div class="founding">
      <canvas ref={ref} class="map" aria-label="The founding site" />
      <aside class="paper">
        <h1>Hearthwork</h1>
        <p class="lead">
          A city that only lives while you work. Eight travelers have stopped by a river. When you start working, the sun
          rises on them; when you stop, they sleep. Every hour you work is a year of their lives.
        </p>
        <form class="form" onSubmit={begin}>
          <label>Name the settlement</label>
          <div class="two">
            <input type="text" value={name} maxLength={32} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
            <button class="btn small" type="button" onClick={() => setName(settlementName(makeRng(newSeed())))}>Suggest another</button>
          </div>
          <label>The site</label>
          <button class="btn small" type="button" onClick={() => setSeed(newSeed())}>Look elsewhere along the river</button>

          <label>Daily goal</label>
          <div class="two">
            <div><input type="number" min={5} max={720} value={goals.dailyMinutes} onChange={(e) => setGoal('dailyMinutes', (e.target as HTMLInputElement).value)} /><div class="hint">minutes of work</div></div>
            <div><input type="number" min={0} max={20000} step={50} value={goals.dailyWords} onChange={(e) => setGoal('dailyWords', (e.target as HTMLInputElement).value)} /><div class="hint">or words written</div></div>
          </div>
          <label>Sparks (small goals along the way)</label>
          <div class="two">
            <div><input type="number" min={5} max={120} value={goals.sparkMinutes} onChange={(e) => setGoal('sparkMinutes', (e.target as HTMLInputElement).value)} /><div class="hint">every … minutes</div></div>
            <div><input type="number" min={50} max={5000} step={50} value={goals.sparkWords} onChange={(e) => setGoal('sparkWords', (e.target as HTMLInputElement).value)} /><div class="hint">or every … words</div></div>
          </div>
          <p class="hint">Each Spark brings travelers to your gate and 1 Favor. Reaching your daily goal earns 5 Favor. Spend Favor on Acts: bless someone, create your own settler, send someone on a quest.</p>

          <label>Darkness</label>
          <input class="slider" type="range" min={0} max={100} value={darkness} onInput={(e) => setDarkness(Number((e.target as HTMLInputElement).value))} />
          <div class="slider-labels"><span>Gentle</span><span>Balanced</span><span>Grim</span></div>
          <div class="hint">{DARK_HINT(darkness)}</div>

          <label>Weirdness: {WEIRD[weirdness]}</label>
          <input class="slider" type="range" min={0} max={4} step={1} value={weirdness} onInput={(e) => setWeirdness(Number((e.target as HTMLInputElement).value))} />
          <div class="hint">{WEIRD_HINT[weirdness]}</div>

          <div style={{ marginTop: 16 }}><button class="btn primary start" type="submit">Light the first fire</button></div>
          <p class="hint">You can change goals and both sliders later in Settings.</p>
        </form>
      </aside>
    </div>
  );
}
