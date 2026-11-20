// A family tree: grandparents and parents above, children and grandchildren below.
import { store } from '../game/store';
import type { GameState, Person } from '../sim/types';
import { ageOf, fullName, yearOf } from '../sim/world';

function Node({ s, p, focus }: { s: GameState; p: Person; focus?: boolean }) {
  const life = p.alive ? (p.left ? `moved away` : `${ageOf(s, p)}`) : `Y${yearOf(Math.max(0, p.born))}–${yearOf(p.died ?? 0)}`;
  return (
    <button class={`tree-node${focus ? ' focus' : ''}${p.alive ? '' : ' gone'}${p.patron || p.lineage ? ' patron' : ''}`}
      onClick={() => store.setUi({ tree: p.id, selection: { kind: 'person', id: p.id } })}>
      <b>{p.patron || p.lineage ? '✦ ' : ''}{fullName(p)}</b>
      <span>{life}</span>
    </button>
  );
}

const ppl = (s: GameState, ids: number[]) => ids.map((id) => s.people[id]).filter(Boolean);

export function FamilyTree({ id }: { id: number }) {
  const s = store.state!;
  const p = s.people[id];
  if (!p) return null;
  // Birth parents first (adoptive parents are listed after them).
  const parents = ppl(s, p.parents);
  const grandparents = parents.map((x) => ppl(s, x.parents));
  const spouse = p.spouse !== undefined ? s.people[p.spouse] : undefined;
  const children = ppl(s, p.children);
  const close = () => store.setUi({ tree: undefined });
  return (
    <div class="scrim" onClick={(e) => e.target === e.currentTarget && close()}>
      <div class="dialog paper tree" role="dialog" aria-label={`Family of ${fullName(p)}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>The family of {p.first}</h2>
          <button class="btn small ghost" onClick={close} aria-label="Close">✕</button>
        </div>
        {grandparents.some((g) => g.length) && (
          <div class="tree-row">
            {grandparents.map((pair, i) => (
              <div class="tree-group" key={i}>{pair.map((g) => <Node key={g.id} s={s} p={g} />)}</div>
            ))}
          </div>
        )}
        {parents.length > 0 && (
          <div class="tree-row"><div class="tree-group">{parents.map((x) => <Node key={x.id} s={s} p={x} />)}</div></div>
        )}
        <div class="tree-row">
          <div class="tree-group">
            <Node s={s} p={p} focus />
            {spouse && <><span class="tree-amp">&amp;</span><Node s={s} p={spouse} /></>}
          </div>
        </div>
        {children.length > 0 && (
          <div class="tree-row">
            {children.map((c) => (
              <div class="tree-col" key={c.id}>
                <Node s={s} p={c} />
                {c.children.length > 0 && (
                  <div class="tree-sub">{ppl(s, c.children).map((g) => <Node key={g.id} s={s} p={g} />)}</div>
                )}
              </div>
            ))}
          </div>
        )}
        <p class="hint">Click anyone to see their family. ✦ marks your settlers and their descendants.</p>
      </div>
    </div>
  );
}
