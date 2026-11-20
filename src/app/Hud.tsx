// The top bar: where and when the city is, the focus timer, progress to the
// next Spark and today's goal, Favor, and the panel buttons.
import { useEffect, useState } from 'preact/hooks';
import { goalDaysThisWeek, localDate, sessionElapsed } from '../game/clock';
import { store, type Panel } from '../game/store';
import { currentYearName } from '../sim/chronicle';
import { population, seasonName, yearOf } from '../sim/world';
import { hms } from './format';

const STAGE: Record<string, string> = { settlement: 'Settlement', village: 'Village', town: 'Town', city: 'City', metropolis: 'Metropolis' };

/** Re-render every second while the timer runs. */
function useClock(on: boolean) {
  const [, set] = useState(0);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => set((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [on]);
}

export function Hud() {
  const s = store.state!;
  useClock(!!s.focus.running);
  const now = Date.now();
  const running = !!s.focus.running;
  const elapsed = sessionElapsed(s, now);
  const today = s.focus.days[localDate(now)];
  const g = s.goals;
  const sparkFrac = Math.min(1, (s.focus.sparkMs + (running ? Math.min(now - s.focus.running!.lastTickAt, 60_000) : 0)) / (g.sparkMinutes * 60_000));
  const todayMs = (today?.ms ?? 0) + (running ? Math.max(0, elapsed - s.focus.running!.ms) : 0);
  const goalFrac = g.dailyMinutes > 0 ? Math.min(1, todayMs / (g.dailyMinutes * 60_000)) : 0;
  const words = today?.words ?? 0;
  const waiting = s.arrivals.length;
  const yearName = currentYearName(s);
  const panel = store.ui.panel;
  const tab = (p: Panel, label: string, badge?: number) => (
    <button class={`btn small ${panel === p ? 'active' : 'ghost'}`} onClick={() => store.setUi({ panel: panel === p ? null : p, act: null })}>
      {label}
      {badge ? <span class="badge">{badge}</span> : null}
    </button>
  );
  const nextSpark = Math.max(0, Math.ceil(((1 - sparkFrac) * g.sparkMinutes)));

  return (
    <div class="hud paper" role="banner">
      <div class="place">
        <span class="name">{s.name}</span>
        <span class="when">
          {STAGE[s.stage]} · Year {yearOf(s.day)}, {seasonName(s.day)}{yearName ? ` · ${yearName}` : ''} · {s.age.name}
        </span>
      </div>
      <div class="focus">
        <span class="timer" aria-live="off">{hms(elapsed)}</span>
        {running
          ? <button class="btn stop" onClick={() => store.stop()}>Stop</button>
          : <button class="btn primary start" onClick={() => store.start()}>Start working</button>}
        <div class="meters">
          <div class="meter" title="Every Spark brings travelers and 1 Favor">
            <span>Spark</span><div class="bar"><i style={{ width: `${sparkFrac * 100}%` }} /></div><span>{nextSpark} min</span>
          </div>
          <div class="meter" title={`Daily goal: ${g.dailyMinutes} minutes or ${g.dailyWords} words. ${goalDaysThisWeek(s, now)} goal days this week.`}>
            <span>Today</span>
            <div class={`bar${today?.goalMet ? ' done' : ''}`}><i style={{ width: `${(today?.goalMet ? 1 : goalFrac) * 100}%` }} /></div>
            <span>{Math.floor(todayMs / 60_000)}/{g.dailyMinutes} min{words ? ` · ${words} w` : ''}</span>
          </div>
        </div>
      </div>
      <div class="stats">
        <div class="stat favor" title="Favor: spend it on Acts"><b>✦ {s.favor}</b><span>Favor</span></div>
        <div class="stat"><b>{population(s)}</b><span>People</span></div>
      </div>
      <div class="tabs">
        {tab('chronicle', 'Chronicle')}
        {tab('people', 'People')}
        {tab('acts', 'Acts')}
        {tab('arrivals', 'Arrivals', waiting)}
        {tab('settings', 'Settings')}
      </div>
    </div>
  );
}
