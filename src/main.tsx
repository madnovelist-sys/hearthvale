import { render } from 'preact';
import { App, Crashproof, reportCrash } from './app/App';
import { loadStoredArt } from './app/artStore';
import { store } from './game/store';
import { loadManifest } from './render/sprites';
import { view } from './app/view';
import { initDesktop } from './game/desktop';
import './app/styles.css';

// A handle for automated tests and for curious people with a console open.
(window as unknown as { hearthwork: unknown }).hearthwork = { store, view };

render(<Crashproof><App /></Crashproof>, document.getElementById('app')!);

void loadManifest().then(loadStoredArt);
void store.load().then(initDesktop).catch(reportCrash);

// The clock keeps counting even when the window is hidden and animation
// frames stop; the city catches up from timestamps.
setInterval(() => { try { store.tick(); } catch (e) { reportCrash(e); } }, 1000);
setInterval(() => store.saveIfDirty(), 30_000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void store.save();
  else store.tick();
});
window.addEventListener('pagehide', () => void store.save());
