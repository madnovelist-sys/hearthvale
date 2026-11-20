import { useEffect } from 'preact/hooks';
import { store, useStore, type Panel } from '../game/store';
import { ActsPanel, ArrivalsPanel } from './Acts';
import { ArtStudio } from './ArtStudio';
import { ChroniclePanel } from './Chronicle';
import { GapDialog, SessionEnd, WordsDialog } from './Dialogs';
import { Founding } from './Founding';
import { Hud } from './Hud';
import { MapView, ZoomButtons } from './MapView';
import { BuildingCard, PeoplePanel, PersonCard } from './People';
import { SettingsPanel } from './Settings';
import { SocietyPanel } from './Society';
import { FamilyTree } from './FamilyTree';

const TITLES: Record<Panel, string> = {
  chronicle: 'The Chronicle', people: 'People', society: 'Society', acts: 'Acts', arrivals: 'Arrivals', settings: 'Settings', art: 'Art',
};

export function App() {
  const st = useStore();
  const s = st.state;
  const ui = st.ui;
  useEffect(() => {
    document.body.classList.toggle('panel-open', !!ui.panel && ui.panel !== 'art');
  }, [ui.panel]);
  useEffect(() => {
    document.title = s ? `${s.focus.running ? '● ' : ''}${s.name} · Hearthwork` : 'Hearthwork';
  });

  if (!st.loaded) return null;
  if (!s) return <Founding />;

  const panel = ui.panel;
  return (
    <>
      <MapView />
      <Hud />
      {!s.focus.running && !ui.ended && !ui.gapMs && !panel && !ui.selection && (
        <div class="sleep">
          <b>{s.name} sleeps.</b>
          <span>Press Start working when you begin. The sun rises while you work.</span>
        </div>
      )}
      <ZoomButtons />
      {panel && panel !== 'art' && (
        <section class="side paper" aria-label={TITLES[panel]}>
          <header>
            <h2>{TITLES[panel]}</h2>
            <button class="btn small ghost" onClick={() => store.setUi({ panel: null, act: null })} aria-label="Close">✕</button>
          </header>
          <div class="body">
            {panel === 'chronicle' && <ChroniclePanel />}
            {panel === 'people' && <PeoplePanel />}
            {panel === 'society' && <SocietyPanel />}
            {panel === 'acts' && <ActsPanel />}
            {panel === 'arrivals' && <ArrivalsPanel />}
            {panel === 'settings' && <SettingsPanel />}
          </div>
        </section>
      )}
      {panel === 'art' && <ArtStudio />}
      {ui.selection?.kind === 'person' && <PersonCard id={ui.selection.id} />}
      {ui.selection?.kind === 'building' && <BuildingCard id={ui.selection.id} />}
      {ui.gapMs ? <GapDialog /> : ui.ended ? <SessionEnd /> : null}
      {ui.tree !== undefined && !ui.ended && !ui.gapMs && <FamilyTree id={ui.tree} />}
      {ui.logWords && !ui.ended && <WordsDialog />}
      <div class="toasts" aria-live="polite">
        {ui.toasts.map((t) => <div class={`toast paper ${t.tone ?? ''}`} key={t.id}>{t.text}</div>)}
      </div>
    </>
  );
}
