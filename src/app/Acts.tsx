// Acts: the player's powers, bought with Favor. Plus the travelers waiting at
// the gate after each Spark.
import { useState } from 'preact/hooks';
import { ACTS, actCost, applyPending, createSettler, nameChild, nameYear, sendOnQuest, welcomeParty } from '../sim/acts';
import { QUEST_KIND_LABEL } from '../sim/names';
import { DREAMS, DREAM_LABEL, JOB_LABEL, TRADES, TRAITS, TRAIT_LABEL } from '../sim/people';
import { store } from '../game/store';
import type { DreamId, JobId, Orientation, PersonDraft, QuestKind, Sex, TraitId } from '../sim/types';
import { ageOf, fullName, yearOf } from '../sim/world';
import { PersonLink } from './format';

const ICON: Record<string, string> = { bless: '☀', name: '✎', settler: '✦', quest: '⚑' };

export function ActsPanel() {
  const s = store.state!;
  const act = store.ui.act;
  if (act === 'settler') return <SettlerForm />;
  if (act === 'quest') return <QuestForm />;
  if (act === 'name') return <NameForm />;
  return (
    <>
      <p class="note">
        You have <b class="cost">✦ {s.favor} Favor</b>. Every Spark earns 1; reaching your daily goal earns 5.
        {!s.focus.running && ' Anything that brings people or sends them away happens at dawn, when you next start working.'}
      </p>
      {ACTS.map((a) => (
        <div class="act" key={a.id}>
          <div class="icon" aria-hidden>{ICON[a.id]}</div>
          <div class="what"><b>{a.label}</b><span>{a.blurb}</span></div>
          <span class="cost">✦{a.cost}</span>
          <button class="btn small" disabled={s.favor < a.cost}
            onClick={() => (a.id === 'bless'
              ? store.toast('Choose someone on the map or in People, then press Bless on their card.')
              : store.setUi({ act: a.id as 'settler' | 'quest' | 'name', actTarget: undefined }))}>
            {a.id === 'bless' ? 'How' : 'Begin'}
          </button>
        </div>
      ))}
      {s.pending.length > 0 && (
        <>
          <h4 style={{ margin: '14px 0 6px' }}>Waiting for dawn</h4>
          {s.pending.map((p, i) => (
            <p class="note" key={i}>
              {p.kind === 'party'
                ? `${p.party.people.map((d) => `${d.first} ${d.family}`).join(', ')} will arrive.`
                : `${s.people[p.leader]?.first ?? 'Someone'} will set out for ${QUEST_KIND_LABEL[p.questKind].toLowerCase()}.`}
            </p>
          ))}
        </>
      )}
    </>
  );
}

function Back({ title }: { title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <button class="btn small ghost" onClick={() => store.setUi({ act: null })}>← Acts</button>
      <b style={{ fontFamily: 'var(--serif)', fontSize: 17 }}>{title}</b>
    </div>
  );
}

function SettlerForm() {
  const s = store.state!;
  const [d, setD] = useState<PersonDraft>({
    first: '', family: '', sex: 'f', orientation: 'straight', age: 24, traits: [], skill: 'farmer', dream: 'love', backstory: '',
  });
  const [error, setError] = useState('');
  const set = (patch: Partial<PersonDraft>) => setD({ ...d, ...patch });
  const toggleTrait = (t: TraitId) => {
    if (d.traits.includes(t)) set({ traits: d.traits.filter((x) => x !== t) });
    else if (d.traits.length < 2) set({ traits: [...d.traits, t] });
  };
  const blocked = (t: TraitId) => {
    const opp = TRAITS.find((x) => x.id === t)?.opposite;
    return (!d.traits.includes(t) && d.traits.length >= 2) || (!!opp && d.traits.includes(opp));
  };
  const submit = (e: Event) => {
    e.preventDefault();
    if (d.traits.length < 1) { setError('Pick at least one trait.'); return; }
    const r = createSettler(s, d);
    if (!r.ok) { setError(r.reason); return; }
    store.toast(`${d.first} will arrive ${s.focus.running ? 'at once' : 'at dawn'}.`, 'gold');
    if (s.focus.running) applyPending(s); // it's daytime: no need to wait for dawn
    store.setUi({ act: null });
    store.changed();
  };
  return (
    <form class="form" onSubmit={submit}>
      <Back title={`Create a Settler · ✦${actCost('settler')}`} />
      <p class="note">Someone of your making. They and their children's children carry your mark ✦.</p>
      <div class="two">
        <div><label>First name</label><input type="text" value={d.first} maxLength={24} onInput={(e) => set({ first: (e.target as HTMLInputElement).value })} /></div>
        <div><label>Family name</label><input type="text" value={d.family} maxLength={24} onInput={(e) => set({ family: (e.target as HTMLInputElement).value })} /></div>
      </div>
      <div class="two">
        <div>
          <label>Sex</label>
          <select value={d.sex} onChange={(e) => set({ sex: (e.target as HTMLSelectElement).value as Sex })}>
            <option value="f">Woman</option><option value="m">Man</option>
          </select>
        </div>
        <div>
          <label>Drawn to</label>
          <select value={d.orientation} onChange={(e) => set({ orientation: (e.target as HTMLSelectElement).value as Orientation })}>
            <option value="straight">{d.sex === 'f' ? 'Men' : 'Women'}</option>
            <option value="gay">{d.sex === 'f' ? 'Women' : 'Men'}</option>
            <option value="bi">Anyone</option>
          </select>
        </div>
      </div>
      <label>Age: {d.age}</label>
      <input class="slider" type="range" min={16} max={70} value={d.age} onInput={(e) => set({ age: Number((e.target as HTMLInputElement).value) })} />
      <label>Traits (pick two)</label>
      <div class="traits">
        {TRAITS.map((t) => (
          <button type="button" key={t.id} class={`chip${d.traits.includes(t.id) ? ' on' : ''}`} disabled={blocked(t.id)} onClick={() => toggleTrait(t.id)}>{t.label}</button>
        ))}
      </div>
      <div class="two">
        <div>
          <label>Trade</label>
          <select value={d.skill} onChange={(e) => set({ skill: (e.target as HTMLSelectElement).value as JobId })}>
            {TRADES.map((j) => <option key={j} value={j}>{JOB_LABEL[j]}</option>)}
          </select>
        </div>
        <div>
          <label>Dream</label>
          <select value={d.dream} onChange={(e) => set({ dream: (e.target as HTMLSelectElement).value as DreamId })}>
            {DREAMS.map((x) => <option key={x} value={x}>{DREAM_LABEL[x]}</option>)}
          </select>
        </div>
      </div>
      <label>Where they come from (optional)</label>
      <textarea maxLength={240} placeholder="A one-line backstory. It goes into the Chronicle when they arrive." value={d.backstory} onInput={(e) => set({ backstory: (e.target as HTMLTextAreaElement).value })} />
      {error && <div class="error">{error}</div>}
      <div style={{ marginTop: 12 }}><button class="btn primary" type="submit" disabled={s.favor < actCost('settler')}>Create {d.first || 'settler'} · ✦{actCost('settler')}</button></div>
    </form>
  );
}

function QuestForm() {
  const s = store.state!;
  const adults = s.people.filter((p) => p.alive && p.away === undefined && !p.preparing && ageOf(s, p) >= 16)
    .sort((a, b) => fullName(a).localeCompare(fullName(b)));
  const [leader, setLeader] = useState<number>(store.ui.actTarget ?? adults[0]?.id ?? -1);
  const [mates, setMates] = useState<number[]>([]);
  const [kind, setKind] = useState<QuestKind>('ruins');
  const [error, setError] = useState('');
  const lead = s.people[leader];
  const toggle = (id: number) => setMates(mates.includes(id) ? mates.filter((x) => x !== id) : mates.length < 2 ? [...mates, id] : mates);
  const submit = (e: Event) => {
    e.preventDefault();
    const r = sendOnQuest(s, leader, mates, kind);
    if (!r.ok) { setError(r.reason); return; }
    store.toast(`${lead.first} will set out ${s.focus.running ? 'at once' : 'at dawn'}.`, 'gold');
    if (s.focus.running) applyPending(s);
    store.setUi({ act: null });
    store.changed();
  };
  return (
    <form class="form" onSubmit={submit}>
      <Back title={`Send on a Quest · ✦${actCost('quest')}`} />
      <p class="note">Quests take half a year to a few years. Brave, clever and strong travelers fare better; a blessing helps. Some never come back.</p>
      <label>Who goes</label>
      <select value={leader} onChange={(e) => { setLeader(Number((e.target as HTMLSelectElement).value)); setMates([]); }}>
        {adults.map((p) => <option key={p.id} value={p.id}>{fullName(p)} ({ageOf(s, p)}, {p.traits.map((t) => TRAIT_LABEL[t]).join(', ')})</option>)}
      </select>
      <label>Where</label>
      <div class="traits">
        {(Object.keys(QUEST_KIND_LABEL) as QuestKind[]).map((k) => (
          <button type="button" key={k} class={`chip${kind === k ? ' on' : ''}`} onClick={() => setKind(k)}>{QUEST_KIND_LABEL[k]}</button>
        ))}
      </div>
      <label>Companions (up to two, optional)</label>
      <div class="traits">
        {adults.filter((p) => p.id !== leader).slice(0, 40).map((p) => (
          <button type="button" key={p.id} class={`chip${mates.includes(p.id) ? ' on' : ''}`} onClick={() => toggle(p.id)}>{fullName(p)}</button>
        ))}
      </div>
      {lead && (lead.spouse !== undefined || lead.children.some((c) => s.people[c]?.alive && ageOf(s, s.people[c]) < 10)) && (
        <p class="hint">{lead.first} has family here. They'll be missed.</p>
      )}
      {error && <div class="error">{error}</div>}
      <div style={{ marginTop: 12 }}><button class="btn primary" type="submit" disabled={!lead || s.favor < actCost('quest')}>Send {lead?.first ?? ''} · ✦{actCost('quest')}</button></div>
    </form>
  );
}

function NameForm() {
  const s = store.state!;
  const babies = s.people.filter((p) => p.alive && ageOf(s, p) < 1);
  const [target, setTarget] = useState<number | 'year'>(store.ui.actTarget ?? 'year');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const submit = (e: Event) => {
    e.preventDefault();
    const r = target === 'year' ? nameYear(s, name) : nameChild(s, target, name);
    if (!r.ok) { setError(r.reason); return; }
    store.toast('So it shall be called.', 'gold');
    store.setUi({ act: null });
    store.changed();
  };
  return (
    <form class="form" onSubmit={submit}>
      <Back title={`Name · ✦${actCost('name')}`} />
      <label>What to name</label>
      <select value={String(target)} onChange={(e) => { const v = (e.target as HTMLSelectElement).value; setTarget(v === 'year' ? 'year' : Number(v)); }}>
        <option value="year">This year (Year {yearOf(s.day)})</option>
        {babies.map((b) => <option key={b.id} value={b.id}>The baby {fullName(b)}</option>)}
      </select>
      <label>{target === 'year' ? 'The Year of…' : 'First name'}</label>
      <input type="text" value={name} maxLength={target === 'year' ? 60 : 24} placeholder={target === 'year' ? 'the Long Summer' : ''} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
      {error && <div class="error">{error}</div>}
      <div style={{ marginTop: 12 }}><button class="btn primary" type="submit" disabled={s.favor < actCost('name')}>Name it · ✦{actCost('name')}</button></div>
    </form>
  );
}

export function ArrivalsPanel() {
  const s = store.state!;
  const running = !!s.focus.running;
  const welcome = (id: number) => {
    const r = welcomeParty(s, id, running);
    if (!r.ok) store.toast(r.reason);
    else store.toast(running ? 'They walk in to a warm welcome.' : 'They will arrive at dawn, when you next start working.', 'gold');
    store.changed();
  };
  const waiting = s.pending.filter((p) => p.kind === 'party' && !p.patron);
  return (
    <>
      <p class="note">Every Spark brings three parties to the road. Choose one to welcome; the other two move on. If you don't choose, the settlement takes one in on its own at dawn.</p>
      {s.arrivals.length === 0 && waiting.length === 0 && <p class="note">No one on the road right now. The next Spark will bring travelers.</p>}
      {s.arrivals.map((group, gi) => (
        <div class="group" key={gi}>
          <h4>Travelers on the road{s.arrivals.length > 1 ? ` (${gi + 1} of ${s.arrivals.length})` : ''}</h4>
          {group.map((party) => (
            <div class="party" key={party.id}>
              <div class="story">{party.story}</div>
              <ul>
                {party.people.map((d, i) => (
                  <li key={i}>
                    <b>{d.first} {d.family}</b>, {d.age} · {JOB_LABEL[d.skill]} · {d.traits.map((t) => TRAIT_LABEL[t]).join(', ')}
                  </li>
                ))}
              </ul>
              <button class="btn small primary" onClick={() => welcome(party.id)}>Welcome {party.people.length > 1 ? 'them' : party.people[0].first}</button>
            </div>
          ))}
        </div>
      ))}
      {waiting.length > 0 && (
        <div class="group">
          <h4>Arriving at dawn</h4>
          {waiting.map((p, i) => p.kind === 'party' && <p class="note" key={i}>{p.party.story}</p>)}
        </div>
      )}
      <Newest />
    </>
  );
}

function Newest() {
  const s = store.state!;
  const recent = s.people.filter((p) => p.alive && (p.origin === 'arrival' || p.origin === 'patron')).slice(-5).reverse();
  if (!recent.length) return null;
  return (
    <div class="group">
      <h4>Newest arrivals</h4>
      {recent.map((p) => <div key={p.id}><PersonLink p={p} /></div>)}
    </div>
  );
}
