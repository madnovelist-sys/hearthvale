// Settings: goals, the two sliders, saves and backups, the art test scene.
import { useEffect, useState } from 'preact/hooks';
import { exportGame, importGame, listBackups, loadBackup, deleteSave } from '../game/save';
import { store } from '../game/store';
import { exportChronicle } from './Chronicle';

const DARK_LABEL = (d: number) => (d < 34 ? 'Gentle' : d < 67 ? 'Balanced' : 'Grim');
const WEIRD_LABEL = ['Historical', 'Folklore', 'Uncanny', 'Mythic', 'Fantastical'];
export const WEIRD_HINT = [
  'Nothing uncanny. Omens are weather and comets.',
  'Ambiguous things: a humming stone, lights over the marsh.',
  'Strange ruins, giant bones, glowing relics.',
  'Beasts beyond the walls, oracles, alchemy.',
  'Open magic: floating stones, living buildings.',
];
export const DARK_HINT = (d: number) => (d < 34
  ? 'Few avoidable deaths. Hunger makes people weak, not dead. Hard things are told softly.'
  : d < 67
    ? 'A pre-modern life: fevers, accidents and childbirth take some. Told plainly.'
    : 'Hard lives. Children die, winters kill, and the Chronicle does not look away. No gore.');

export function SettingsPanel() {
  const s = store.state!;
  const [backups, setBackups] = useState<string[]>([]);
  const [confirm, setConfirm] = useState('');
  useEffect(() => { listBackups().then(setBackups); }, []);
  const g = s.goals;
  const num = (v: string, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));
  const setGoal = (k: keyof typeof g, v: number) => { g[k] = v; store.changed(); };
  const onImport = async (e: Event) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    try {
      const next = await importGame(f);
      store.setState(next);
      store.toast(`Loaded ${next.name}.`);
    } catch (err) {
      store.toast((err as Error).message);
    }
  };
  const restore = async (date: string) => {
    const b = await loadBackup(date);
    if (b) { store.setState(b); store.toast(`Restored the backup from ${date}.`); }
  };
  return (
    <div class="form">
      <h4 style={{ margin: '0 0 4px' }}>Goals</h4>
      <div class="two">
        <div><label>Daily goal, minutes</label><input type="number" min={0} max={720} value={g.dailyMinutes} onChange={(e) => setGoal('dailyMinutes', num((e.target as HTMLInputElement).value, 0, 720))} /></div>
        <div><label>or words</label><input type="number" min={0} max={20000} step={50} value={g.dailyWords} onChange={(e) => setGoal('dailyWords', num((e.target as HTMLInputElement).value, 0, 20000))} /></div>
      </div>
      <div class="two">
        <div><label>A Spark every … minutes</label><input type="number" min={5} max={120} value={g.sparkMinutes} onChange={(e) => setGoal('sparkMinutes', num((e.target as HTMLInputElement).value, 5, 120))} /></div>
        <div><label>or every … words</label><input type="number" min={50} max={5000} step={50} value={g.sparkWords} onChange={(e) => setGoal('sparkWords', num((e.target as HTMLInputElement).value, 50, 5000))} /></div>
      </div>
      <p class="hint">Reaching the daily goal (time or words, whichever comes first) earns 5 Favor. Each Spark earns 1 Favor and brings travelers.</p>

      <h4 style={{ margin: '16px 0 4px' }}>Darkness: {DARK_LABEL(s.settings.darkness)}</h4>
      <input class="slider" type="range" min={0} max={100} value={s.settings.darkness} onInput={(e) => { s.settings.darkness = Number((e.target as HTMLInputElement).value); store.changed(); }} />
      <div class="slider-labels"><span>Gentle</span><span>Balanced</span><span>Grim</span></div>
      <p class="hint">{DARK_HINT(s.settings.darkness)}</p>

      <h4 style={{ margin: '16px 0 4px' }}>Weirdness: {WEIRD_LABEL[s.settings.weirdness]}</h4>
      <input class="slider" type="range" min={0} max={4} step={1} value={s.settings.weirdness} onInput={(e) => { s.settings.weirdness = Number((e.target as HTMLInputElement).value); store.changed(); }} />
      <div class="slider-labels">{WEIRD_LABEL.map((w) => <span key={w}>{w}</span>)}</div>
      <p class="hint">{WEIRD_HINT[s.settings.weirdness]}</p>

      <h4 style={{ margin: '16px 0 6px' }}>Your city</h4>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button class="btn small" type="button" onClick={() => exportGame(s)}>Export save file</button>
        <label class="btn small" style={{ margin: 0 }}>Import save file<input type="file" accept="application/json,.json" hidden onChange={onImport} /></label>
        <button class="btn small" type="button" onClick={() => exportChronicle()}>Export the Chronicle</button>
        <button class="btn small" type="button" onClick={() => store.setUi({ panel: 'art' })}>Art test scene</button>
      </div>
      <p class="hint">Hearthwork saves every 30 seconds and keeps a backup from each of the last 7 days you played. Exported files are full backups you can keep anywhere.</p>
      {backups.length > 0 && (
        <>
          <label>Restore a daily backup</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {backups.map((b) => <button key={b} type="button" class="btn small" onClick={() => restore(b)}>{b}</button>)}
          </div>
        </>
      )}

      <h4 style={{ margin: '20px 0 4px' }}>Start over</h4>
      <p class="hint">Type the city's name to found a new settlement. Export first if you might want this one back.</p>
      <div class="two">
        <input type="text" placeholder={s.name} value={confirm} onInput={(e) => setConfirm((e.target as HTMLInputElement).value)} />
        <button class="btn small" type="button" disabled={confirm.trim() !== s.name} onClick={async () => { await deleteSave(); store.setState(null); }}>Found a new settlement</button>
      </div>
    </div>
  );
}
