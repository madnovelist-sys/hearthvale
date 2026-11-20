// Resolve Chronicle name tokens into plain text (the UI renders them as links).
import type { GameState } from './types';
import { fullName } from './world';

export const TOKEN = /\{([pf]):(\d+)\}/g;

export function resolveText(s: GameState, text: string): string {
  return text.replace(TOKEN, (_, kind: string, id: string) => {
    const p = s.people[Number(id)];
    if (!p) return '?';
    return kind === 'f' ? p.first : fullName(p);
  });
}
