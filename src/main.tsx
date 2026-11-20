import { render } from 'preact';
import { App } from './app/App';
import { loadStoredArt } from './app/artStore';
import { store } from './game/store';
import { loadManifest } from './render/sprites';
import { view } from './app/view';
import './app/styles.css';

// A handle for automated tests and for curious people with a console open.
(window as unknown as { hearthwork: unknown }).hearthwork = { store, view };

render(<App />, document.getElementById('app')!);

void loadManifest().then(loadStoredArt);
void store.load();

// The clock keeps counting even when the window is hidden and animation
// frames stop; the city catches up from timestamps.
setInterval(() => store.tick(), 1000);
setInterval(() => store.saveIfDirty(), 30_000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void store.save();
  else store.tick();
});
window.addEventListener('pagehide', () => void store.save());
