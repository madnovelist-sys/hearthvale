// Day and night, independent of whether you're working. By default the sky
// follows your own clock; or the city can keep its own faster days, which
// only pass while you work.
import type { GameState } from '../sim/types';

/** One city day in "city time" mode: this many minutes of work. */
export const CITY_DAY_MINUTES = 15;

/** Hour of the day, 0–24. */
export function hourOfDay(s: GameState, now: number): number {
  if (s.settings.dayNight === 'city') {
    const r = s.focus.running;
    const ms = s.focus.totalMs + (r ? Math.max(0, Math.min(now - r.lastTickAt, 60_000)) : 0);
    // Start the city's first day mid-morning.
    return ((ms / (CITY_DAY_MINUTES * 60_000)) * 24 + 9) % 24;
  }
  const d = new Date(now);
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

const smooth = (t: number) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };

/**
 * How dark it is (0 = full day, 1 = full night). Dawn runs 5–7, dusk 18:30–21.
 */
export function nightAt(hour: number): number {
  if (hour < 5 || hour >= 21) return 1;
  if (hour < 7) return 1 - smooth((hour - 5) / 2);
  if (hour < 18.5) return 0;
  return smooth((hour - 18.5) / 2.5);
}

export function skyAt(s: GameState, now: number): { night: number; hour: number } {
  const hour = hourOfDay(s, now);
  return { hour, night: nightAt(hour) };
}

/** Today's stopping time as a timestamp, or null if none is set. */
export function stopTimeToday(s: GameState, now: number): number | null {
  const at = s.settings.stopAt;
  if (!at) return null;
  const m = at.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const d = new Date(now);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d.getTime();
}
