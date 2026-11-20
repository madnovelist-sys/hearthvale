// What the Mac app adds around the game: the menu-bar clock, pausing when
// you've stepped away from the computer, and system notifications.
// In a plain browser these quietly do nothing (notifications use the
// browser's own, if allowed).
import { sessionElapsed } from './clock';
import { store } from './store';

export const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

type Invoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
let invoke: Invoke | null = null;
let idleAvailable = false;

/** Whether this computer can tell how long you've been away from it. */
export const canDetectAway = () => idleAvailable;

/** A little longer than the check interval, so normal work never waits on it. */
const AWAY_SLACK_MS = 90_000;
const CHECK_EVERY_MS = 20_000;

export async function initDesktop() {
  if (!isDesktop) return;
  const core = await import('@tauri-apps/api/core');
  const events = await import('@tauri-apps/api/event');
  invoke = core.invoke as Invoke;
  await events.listen('tray-toggle', () => {
    const s = store.state;
    if (!s) return;
    if (s.focus.running) store.stop();
    else store.start();
  });
  try {
    idleAvailable = (await invoke<number | null>('idle_seconds')) !== null;
  } catch {
    idleAvailable = false;
  }

  // Tell the menu bar about the timer whenever it starts or stops, and now and then to stay in step.
  let wasRunning: boolean | null = null;
  const sync = () => {
    const s = store.state;
    if (!s || !invoke) return;
    const running = !!s.focus.running;
    wasRunning = running;
    void invoke('set_timer', { running, elapsedMs: Math.round(running ? sessionElapsed(s, Date.now()) : 0) }).catch(() => {});
  };
  store.subscribe(() => { if (!!store.state?.focus.running !== wasRunning) sync(); });
  setInterval(sync, 15_000);
  sync();

  setInterval(() => void checkAway(), CHECK_EVERY_MS);
}

/**
 * While a session runs, ask the computer how long it's been since the last
 * keyboard or mouse input. Time is only counted up to shortly after that, and
 * once you've been away long enough, the session pauses at the moment you left.
 */
async function checkAway() {
  const s = store.state;
  const r = s?.focus.running;
  if (!s || !r || !invoke || !idleAvailable) { store.activeUntil = null; return; }
  const minutes = s.settings.awayMinutes;
  if (!minutes) { store.activeUntil = null; return; }
  let idle: number | null = null;
  try { idle = await invoke<number | null>('idle_seconds'); } catch { return; }
  if (idle === null) return;
  const now = Date.now();
  const lastActive = Math.max(r.startedAt, now - idle * 1000);
  store.activeUntil = lastActive + AWAY_SLACK_MS;
  if (idle >= minutes * 60) store.pauseForAway(lastActive, now);
}

/** A system notification (only if allowed). */
export async function notify(title: string, body: string) {
  try {
    if (isDesktop) {
      const n = await import('@tauri-apps/plugin-notification');
      let ok = await n.isPermissionGranted();
      if (!ok) ok = (await n.requestPermission()) === 'granted';
      if (ok) n.sendNotification({ title, body });
      return;
    }
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') await Notification.requestPermission();
    if (Notification.permission === 'granted') new Notification(title, { body });
  } catch { /* notifications unavailable */ }
}

/** Ask for permission up front, when the person turns notifications on. */
export async function askNotificationPermission(): Promise<boolean> {
  try {
    if (isDesktop) {
      const n = await import('@tauri-apps/plugin-notification');
      return (await n.isPermissionGranted()) || (await n.requestPermission()) === 'granted';
    }
    if (typeof Notification === 'undefined') return false;
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}
