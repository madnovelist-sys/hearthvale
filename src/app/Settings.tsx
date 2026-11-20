// Settings: goals, the two sliders, saves and backups, the art test scene.
import { useEffect, useState } from 'preact/hooks';
import { exportGame, importGame, listBackups, loadBackup, deleteSave } from '../game/save';
import { store } from '../game/store';
import { exportChronicle } from './Chronicle';
import { GoalFields } from './GoalFields';

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
      <GoalFields goals={g} onChange={(next) => { Object.assign(g, next); store.changed(); }} />

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
