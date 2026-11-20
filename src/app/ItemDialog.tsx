// An heirloom's story: who made or found it, and everyone who has kept it.
import { store } from '../game/store';
import { ITEM_KIND_LABEL } from '../sim/items';
import type { ItemEvent } from '../sim/types';
import { yearOf } from '../sim/world';
import { PersonLink } from './format';

const HOW: Record<ItemEvent['how'], string> = {
  made: 'made by', found: 'found by', brought: 'brought home by', inherited: 'passed to', gift: 'given to',
  buried: 'buried with', lost: 'lost with', returned: 'brought back by', kept: 'kept by the whole settlement',
};

export function ItemDialog({ id }: { id: number }) {
  const s = store.state!;
  const item = s.items[id];
  if (!item) return null;
  const close = () => store.setUi({ item: undefined });
  const age = Math.floor((s.day - item.made) / 360);
  const holder = item.owner !== undefined ? s.people[item.owner] : undefined;
  return (
    <div class="scrim" onClick={(e) => e.target === e.currentTarget && close()}>
      <div class="dialog paper" role="dialog" aria-label={item.name}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>{item.name[0].toUpperCase() + item.name.slice(1)}</h2>
          <button class="btn small ghost" onClick={close} aria-label="Close">✕</button>
        </div>
        <p class="lead">
          A {ITEM_KIND_LABEL[item.kind]}, {age < 1 ? 'new this year' : `${age} ${age === 1 ? 'year' : 'years'} old`}.{' '}
          {item.buried ? 'It lies in the burial ground.' : item.lost ? 'It is lost.' : item.village ? 'It hangs in the gathering place.' : holder ? <>Kept by <PersonLink p={holder} />.</> : ''}
        </p>
        {item.history.map((h, i) => (
          <p class="life" key={i}>
            <small>Year {yearOf(h.day)}</small>
            {HOW[h.how][0].toUpperCase() + HOW[h.how].slice(1)}{h.person !== undefined && s.people[h.person] ? <> <PersonLink p={s.people[h.person]} /></> : ''}
          </p>
        ))}
      </div>
    </div>
  );
}
