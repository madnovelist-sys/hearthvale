// Shared bits of UI: names as links, durations, dates in city time.
import type { ComponentChildren } from 'preact';
import { store } from '../game/store';
import type { GameState, Person } from '../sim/types';
import { TOKEN } from '../sim/text';
import { ageOf, fullName, seasonName, yearOf } from '../sim/world';
import { view } from './view';

export function hms(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export function minutes(ms: number): string {
  const m = Math.round(ms / 60_000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min`;
}

export const when = (day: number) => `Year ${yearOf(day)}, ${seasonName(day)}`;

export function selectPerson(id: number, center = true) {
  store.setUi({ selection: { kind: 'person', id } });
  const s = store.state;
  const p = s?.people[id];
  if (!s || !p || !center || !view.renderer) return;
  const w = view.renderer.walkers.list.get(id);
  const home = p.home !== undefined ? s.buildings[p.home] : undefined;
  if (w && w.alpha > 0.2) view.renderer.centerOn(w.x, w.y);
  else if (home) view.renderer.centerOn(home.x + 0.5, home.y + 0.5);
}

export function PersonLink({ p }: { p: Person }) {
  return (
    <button class={`pname${p.patron || p.lineage ? ' patron' : ''}`} onClick={() => selectPerson(p.id)} title={p.patron ? 'One of your settlers' : undefined}>
      {fullName(p)}
    </button>
  );
}

/** Chronicle text with names turned into links. */
export function RichText({ s, text }: { s: GameState; text: string }) {
  const out: ComponentChildren[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    const p = s.people[Number(m[2])];
    if (p) {
      out.push(
        <button key={m.index} class={`pname${p.patron || p.lineage ? ' patron' : ''}`} onClick={() => selectPerson(p.id)}>
          {m[1] === 'f' ? p.first : fullName(p)}
        </button>,
      );
    }
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

export function ageText(s: GameState, p: Person): string {
  const a = ageOf(s, p);
  if (a < 1) return 'a baby';
  return `${a}`;
}
