// Versioned localStorage save/load with migrations and backup.
import { SAVE_KEY, SAVE_VERSION } from './config.js';
import { freshState, GameState } from './sim.js';

const BACKUP_KEY = SAVE_KEY + '_backup';

function migrate(s: GameState): GameState {
  // v1 is the first schema — future versions add single-step migrations here.
  // Defensive: backfill any missing nested fields from a fresh state.
  const fresh = freshState(Date.now());
  s.stats = { ...fresh.stats, ...(s.stats as object) } as GameState['stats'];
  s.currencies = { ...fresh.currencies, ...(s.currencies as object) } as GameState['currencies'];
  s.grove = { ...fresh.grove, ...(s.grove as object),
              upgrades: { ...fresh.grove.upgrades,
                          ...((s.grove as object) as { upgrades?: object }).upgrades } } as GameState['grove'];
  if (!Array.isArray(s.grove.pots) || s.grove.pots.length !== fresh.grove.pots.length)
    s.grove.pots = fresh.grove.pots;
  if (!Array.isArray(s.board) || s.board.length !== fresh.board.length)
    s.board = fresh.board;
  s.version = SAVE_VERSION;
  return s;
}

export function saveGame(s: GameState): boolean {
  try {
    const raw = JSON.stringify(s);
    const prev = localStorage.getItem(SAVE_KEY);
    if (prev) localStorage.setItem(BACKUP_KEY, prev);
    const tmp = SAVE_KEY + '_tmp';
    localStorage.setItem(tmp, raw);
    const verify = localStorage.getItem(tmp);
    if (verify !== raw) return false;
    localStorage.setItem(SAVE_KEY, raw);
    localStorage.removeItem(tmp);
    return true;
  } catch {
    return false;
  }
}

export function loadGame(now: number): { state: GameState; fresh: boolean } {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { state: freshState(now), fresh: true };
    const parsed = JSON.parse(raw) as Partial<GameState>;
    if (typeof parsed.version !== 'number' || !Array.isArray(parsed.board))
      throw new Error('bad save shape');
    const merged = { ...freshState(now), ...parsed } as GameState;
    return { state: migrate(merged), fresh: false };
  } catch {
    try {
      const b = localStorage.getItem(BACKUP_KEY);
      if (b) {
        const parsed = JSON.parse(b) as GameState;
        return { state: migrate({ ...freshState(now), ...parsed } as GameState), fresh: false };
      }
    } catch { /* fall through */ }
    return { state: freshState(now), fresh: true };
  }
}

export function wipeSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(BACKUP_KEY);
  } catch { /* noop */ }
}
