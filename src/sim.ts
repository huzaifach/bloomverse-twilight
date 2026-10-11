// Twilight Haven — pure simulation core. No engine imports, no stochastic calls,
// no wall clock (timestamps arrive via commands). Deterministic given inputs.
import { ACTIVE_WISHES, BOARD_CELLS, GROVE_POTS, OFFLINE_CAP_HOURS,
         WISH_DECK_SIZE } from './config.js';
import { blessingFor, familyOf, BlessingKind, GameData, nextTierId,
         plantById, WishDef } from './data.js';

export type Cell =
  | { kind: 'plant'; plant: string }
  | { kind: 'withered' }
  | null;

export interface Currencies { moondew: number; stardust: number; renown: number; starMedals: number }

export interface GameState {
  version: number;
  board: Cell[];
  currencies: Currencies;
  wishDeckIndex: number;   // wishes completed (total)
  dayIndex: number;
  grove: { pots: (string | null)[]; upgrades: Record<string, number>;
           pending: number; lastCollect: number };
  wings: Record<string, number>;
  achievements: Record<string, boolean>;
  discovered: string[];
  rebirths: number;
  podReadyAt: number;
  stats: { merges: number; wishes: number; highestTier: number;
           groveCollected: number; playSeconds: number;
           spawned: number; renownEarned: number };
  tutorialStep: number;
  shareDay: number;
}

export type SimCommand =
  | { type: 'spawn'; now: number }
  | { type: 'move'; from: number; to: number; now: number }
  | { type: 'offer'; cell: number; now: number }
  | { type: 'claimWish'; slot: number; now: number }
  | { type: 'transplant'; cell: number; pot: number; now: number }
  | { type: 'collectGrove'; now: number }
  | { type: 'buyUpgrade'; line: string; now: number }
  | { type: 'buyWing'; wing: string; now: number }
  | { type: 'rebirth'; now: number }
  | { type: 'advanceTutorial'; now: number }
  | { type: 'tick'; dt: number; now: number };

export type SimEvent =
  | { type: 'merged'; at: number; result: string; restored: number | null }
  | { type: 'moved'; from: number; to: number }
  | { type: 'spawned'; at: number; plant: string }
  | { type: 'offered'; at: number; moondew: number }
  | { type: 'wishClaimed'; slot: number; wish: string }
  | { type: 'transplanted'; pot: number; plant: string }
  | { type: 'collected'; amount: number }
  | { type: 'upgradeBought'; line: string; level: number }
  | { type: 'wingBought'; wing: string; level: number }
  | { type: 'reborn'; medals: number }
  | { type: 'achievement'; id: string }
  | { type: 'discovered'; plant: string }
  | { type: 'denied'; reason: string };

const FRESH_WITHERED = [0, 4, 5, 10, 14, 19, 20, 24];
const FRESH_PLANTS: [number, string][] = [
  [7, 'sylvani_t1'], [11, 'sylvani_t1'], [12, 'prism_t1'],
  [13, 'sylvani_t1'], [17, 'prism_t1'],
];

export function freshState(now: number): GameState {
  const board: Cell[] = new Array<Cell>(BOARD_CELLS).fill(null);
  for (const i of FRESH_WITHERED) board[i] = { kind: 'withered' };
  for (const [i, p] of FRESH_PLANTS) board[i] = { kind: 'plant', plant: p };
  return {
    version: 1,
    board,
    currencies: { moondew: 60, stardust: 0, renown: 0, starMedals: 0 },
    wishDeckIndex: 0, dayIndex: 0,
    grove: { pots: new Array<string | null>(GROVE_POTS).fill(null),
             upgrades: { raincaller: 0, moths: 0, starpots: 0 },
             pending: 0, lastCollect: now },
    wings: {}, achievements: {}, discovered: ['sylvani_t1', 'prism_t1'],
    rebirths: 0, podReadyAt: 0,
    stats: { merges: 0, wishes: 0, highestTier: 1, groveCollected: 0,
             playSeconds: 0, spawned: 0, renownEarned: 0 },
    tutorialStep: 0,
    shareDay: 0,
  };
}

export function activeWishes(data: GameData, s: GameState): WishDef[] {
  const out: WishDef[] = [];
  for (let k = 0; k < ACTIVE_WISHES; k++) {
    const w = data.wishes[(s.wishDeckIndex + k) % WISH_DECK_SIZE];
    if (w) out.push(w);
  }
  return out;
}

export function medalMultiplier(s: GameState): number {
  return Math.min(1 + 0.05 * s.currencies.starMedals, 3);
}

export function blessingMult(data: GameData, s: GameState, kind: BlessingKind): number {
  const b = blessingFor(data, s.dayIndex);
  return b.effect.kind === kind ? 1 + b.effect.pct / 100 : 1;
}

/** Current-level effect pct of a wing (0 when unowned). Data-driven. */
export function wingPct(data: GameData, s: GameState, wingId: string): number {
  const lvl = s.wings[wingId] ?? 0;
  if (lvl <= 0) return 0;
  const wing = data.wings.find((w) => w.id === wingId);
  const lv = wing?.levels[lvl - 1];
  return lv ? lv.effectValue : 0;
}

/** Current-level effectPct of an upgrade line (0 when unowned). Data-driven. */
export function upgradePct(data: GameData, s: GameState, lineId: string): number {
  const lvl = s.grove.upgrades[lineId] ?? 0;
  if (lvl <= 0) return 0;
  const line = data.upgrades.find((u) => u.id === lineId);
  const lv = line?.levels[lvl - 1];
  return lv ? lv.effectPct : 0;
}

export function groveRate(data: GameData, s: GameState): number {
  let rate = 0;
  for (const p of s.grove.pots) {
    if (!p) continue;
    const t = plantById(data, p);
    let r = t.moondewPerHour;
    if (familyOf(data, p) === 'prism')
      r *= 1 + wingPct(data, s, 'prism-grotto') / 100;
    rate += r;
  }
  rate *= 1 + upgradePct(data, s, 'moths') / 100;
  rate *= 1 + upgradePct(data, s, 'starpots') / 100;
  rate *= blessingMult(data, s, 'grove');
  rate *= medalMultiplier(s);
  return rate;
}

export function potsUnlocked(data: GameData, s: GameState): number {
  const lvl = s.wings['astral-dome'] ?? 0;
  if (lvl <= 0) return 5;
  const wing = data.wings.find((w) => w.id === 'astral-dome');
  return wing?.levels[lvl - 1]?.potsTotal ?? 5;
}

export function podCooldownMs(data: GameData, s: GameState): number {
  const base = 45000;
  const rc = upgradePct(data, s, 'raincaller');
  const wc = wingPct(data, s, 'root-cellar');
  return Math.max(8000, base * (1 - rc / 100) * (1 - wc / 100));
}

/** Wish-pod spawn cost in moondew (scales with lifetime spawns, reduced by
    Fern Sanctum and the daily spawn blessing). */
export function spawnCost(data: GameData, s: GameState): number {
  const base = Math.min(200, 5 + 2 * s.stats.spawned);
  const red = wingPct(data, s, 'fern-sanctum');
  const b = blessingFor(data, s.dayIndex);
  const blessRed = b.effect.kind === 'spawn' ? b.effect.pct : 0;
  return Math.max(1, Math.round(base * (1 - red / 100) * (1 - blessRed / 100)));
}

/** Moondew gained by offering a plant (prism wing bonus + Moondew blessing). */
export function offerValue(data: GameData, s: GameState, plant: string): number {
  let gain = Math.max(1, Math.floor(plantById(data, plant).wishValue * 0.5));
  if (familyOf(data, plant) === 'prism')
    gain = Math.floor(gain * (1 + wingPct(data, s, 'prism-grotto') / 100));
  return Math.max(1, Math.floor(gain * blessingMult(data, s, 'moondew')));
}

/** Hybrid produced by merging two tier-6 plants (null when no recipe / dome locked). */
export function hybridFor(data: GameData, s: GameState, a: string, b: string): string | null {
  if ((s.wings['astral-dome'] ?? 0) < 1) return null;
  if (plantTierOf(a) !== 6 || plantTierOf(b) !== 6) return null;
  for (const h of data.hybrids) {
    const r = h.recipe;
    if ((r.a === a && r.b === b) || (r.a === b && r.b === a)) return h.id;
  }
  return null;
}

function neighbors(i: number): number[] {
  const r = Math.floor(i / 5), c = i % 5, out: number[] = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < 5 && nc >= 0 && nc < 5) out.push(nr * 5 + nc);
    }
  return out;
}

function countPlant(s: GameState, plant: string): number[] {
  const idx: number[] = [];
  s.board.forEach((c, i) => {
    if (c && c.kind === 'plant' && c.plant === plant) idx.push(i);
  });
  return idx;
}

function discover(s: GameState, plant: string, ev: SimEvent[]): void {
  if (!s.discovered.includes(plant)) {
    s.discovered.push(plant);
    ev.push({ type: 'discovered', plant });
  }
  const t = plantTierOf(plant);
  if (t > s.stats.highestTier) s.stats.highestTier = t;
}

export function plantTierOf(plant: string): number {
  const m = /_t(\d)$/.exec(plant);
  const n = m ? m[1] : undefined;
  return n ? parseInt(n, 10) : 9;
}

function checkAchievements(data: GameData, s: GameState, ev: SimEvent[]): void {
  for (const a of data.achievements) {
    if (s.achievements[a.id]) continue;
    const st = s.stats, c = s.currencies;
    let v = 0;
    switch (a.trigger.kind) {
      case 'mergesTotal': v = st.merges; break;
      case 'wishesTotal': v = st.wishes; break;
      case 'tierReached': v = st.highestTier; break;
      case 'renownTotal': v = st.renownEarned; break;
      case 'groveCollected': v = st.groveCollected; break;
      case 'rebirths': v = s.rebirths; break;
      case 'atlasCount': v = s.discovered.length; break;
      case 'playHours': v = Math.floor(st.playSeconds / 3600); break;
      default: continue;
    }
    if (v >= a.trigger.value) {
      s.achievements[a.id] = true;
      c.moondew += a.reward.moondew;
      c.stardust += a.reward.stardust;
      ev.push({ type: 'achievement', id: a.id });
    }
  }
}

export function applyCommand(data: GameData, s: GameState, cmd: SimCommand): SimEvent[] {
  const ev: SimEvent[] = [];
  const deny = (reason: string): SimEvent[] => [{ type: 'denied', reason }];
  s.dayIndex = Math.floor(cmd.now / 86400000);
  switch (cmd.type) {
    case 'tick': {
      s.stats.playSeconds += cmd.dt;
      s.grove.pending += (groveRate(data, s) / 3600) * cmd.dt;
      break;
    }
    case 'spawn': {
      if (cmd.now < s.podReadyAt) return deny('pod-cooldown');
      const empty = s.board.findIndex((c) => c === null);
      if (empty < 0) return deny('board-full');
      const cost = spawnCost(data, s);
      if (s.currencies.moondew < cost) return deny('poor');
      s.currencies.moondew -= cost;
      s.stats.spawned++;
      s.board[empty] = { kind: 'plant', plant: 'sylvani_t1' };
      s.podReadyAt = cmd.now + podCooldownMs(data, s);
      discover(s, 'sylvani_t1', ev);
      ev.push({ type: 'spawned', at: empty, plant: 'sylvani_t1' });
      break;
    }
    case 'move': {
      const { from, to } = cmd;
      if (from === to || from < 0 || from >= BOARD_CELLS || to < 0 || to >= BOARD_CELLS)
        return deny('bad-cells');
      const a: Cell = s.board[from] ?? null;
      const b: Cell = s.board[to] ?? null;
      if (!a || a.kind !== 'plant') return deny('empty-source');
      if (b === null) {
        s.board[to] = a; s.board[from] = null;
        ev.push({ type: 'moved', from, to });
        break;
      }
      if (b.kind !== 'plant') return deny('no-merge');
      // Same plant -> tier up. Recipe pair (different plants) -> hybrid.
      const hybrid = hybridFor(data, s, a.plant, b.plant);
      let next: string | null;
      if (b.plant === a.plant) {
        next = hybrid ?? nextTierId(data, a.plant);
      } else {
        next = hybrid;
      }
      if (!next) return deny(b.plant === a.plant ? 'max-tier' : 'no-merge');
      s.board[to] = { kind: 'plant', plant: next };
      s.board[from] = null;
      s.stats.merges++;
      discover(s, next, ev);
      let restored: number | null = null;
      for (const n of neighbors(to)) {
        const c = s.board[n];
        if (c && c.kind === 'withered') { restored = n; break; }
      }
      if (restored !== null) s.board[restored] = null;
      ev.push({ type: 'merged', at: to, result: next, restored });
      break;
    }
    case 'offer': {
      const c = s.board[cmd.cell];
      if (!c || c.kind !== 'plant') return deny('empty-cell');
      const gain = offerValue(data, s, c.plant);
      s.currencies.moondew += gain;
      s.board[cmd.cell] = null;
      ev.push({ type: 'offered', at: cmd.cell, moondew: gain });
      break;
    }
    case 'claimWish': {
      const wishes = activeWishes(data, s);
      const w = wishes[cmd.slot];
      if (!w) return deny('no-wish');
      for (const r of w.requires) {
        if (countPlant(s, r.plant).length < r.count) return deny('missing-plants');
      }
      for (const r of w.requires) {
        const idx = countPlant(s, r.plant).slice(0, r.count);
        for (const i of idx) s.board[i] = null;
      }
      const bm = blessingMult(data, s, 'wish');
      s.currencies.moondew += Math.floor(w.rewards.moondew * bm);
      s.currencies.stardust += w.rewards.stardust;
      s.currencies.renown += w.rewards.renown;
      s.stats.renownEarned += w.rewards.renown;
      if (w.cutting) {
        const empty = s.board.findIndex((c) => c === null);
        if (empty >= 0) {
          s.board[empty] = { kind: 'plant', plant: w.cutting };
          discover(s, w.cutting, ev);
        } else {
          s.currencies.moondew += 100;
        }
      }
      s.wishDeckIndex++;
      s.stats.wishes++;
      ev.push({ type: 'wishClaimed', slot: cmd.slot, wish: w.id });
      break;
    }
    case 'transplant': {
      const c = s.board[cmd.cell];
      if (!c || c.kind !== 'plant') return deny('empty-cell');
      if (plantTierOf(c.plant) < 4) return deny('tier-too-low');
      if (cmd.pot < 0 || cmd.pot >= potsUnlocked(data, s)) return deny('pot-locked');
      if (s.grove.pots[cmd.pot]) return deny('pot-full');
      s.grove.pots[cmd.pot] = c.plant;
      s.board[cmd.cell] = null;
      ev.push({ type: 'transplanted', pot: cmd.pot, plant: c.plant });
      break;
    }
    case 'collectGrove': {
      const elapsedH = Math.min((cmd.now - s.grove.lastCollect) / 3600000,
                                OFFLINE_CAP_HOURS);
      const gain = s.grove.pending + groveRate(data, s) * Math.max(0, elapsedH);
      const amt = Math.floor(gain);
      if (amt <= 0) return deny('nothing');
      s.currencies.moondew += amt;
      s.stats.groveCollected += amt;
      s.grove.pending = 0;
      s.grove.lastCollect = cmd.now;
      ev.push({ type: 'collected', amount: amt });
      break;
    }
    case 'buyUpgrade': {
      const line = data.upgrades.find((u) => u.id === cmd.line);
      if (!line) return deny('no-line');
      const lvl = s.grove.upgrades[cmd.line] ?? 0;
      const next = line.levels[lvl];
      if (!next) return deny('maxed');
      if (s.currencies.moondew < next.costMoondew) return deny('poor');
      s.currencies.moondew -= next.costMoondew;
      s.grove.upgrades[cmd.line] = lvl + 1;
      ev.push({ type: 'upgradeBought', line: cmd.line, level: lvl + 1 });
      break;
    }
    case 'buyWing': {
      const wing = data.wings.find((w) => w.id === cmd.wing);
      if (!wing) return deny('no-wing');
      const lvl = s.wings[cmd.wing] ?? 0;
      const next = wing.levels[lvl];
      if (!next) return deny('maxed');
      if (s.currencies.renown < wing.renownRequired) return deny('renown');
      if (s.currencies.moondew < next.costMoondew) return deny('poor');
      s.currencies.moondew -= next.costMoondew;
      s.wings[cmd.wing] = lvl + 1;
      ev.push({ type: 'wingBought', wing: cmd.wing, level: lvl + 1 });
      break;
    }
    case 'rebirth': {
      if (s.stats.highestTier < 7) return deny('tier-low');
      const medals = s.stats.highestTier >= 8 ? 3 : 2;
      const keepMedals = s.currencies.starMedals + medals;
      const keepDiscovered = s.discovered;
      const keepAch = s.achievements;
      const keepPlay = s.stats.playSeconds;
      const keepRenown = s.stats.renownEarned;
      const fresh = freshState(0);
      fresh.currencies.starMedals = keepMedals;
      fresh.discovered = keepDiscovered;
      fresh.achievements = keepAch;
      fresh.stats.playSeconds = keepPlay;
      fresh.stats.renownEarned = keepRenown;
      fresh.rebirths = s.rebirths + 1;
      fresh.dayIndex = s.dayIndex;
      Object.assign(s, fresh);
      ev.push({ type: 'reborn', medals });
      break;
    }
    case 'advanceTutorial': {
      s.tutorialStep++;
      break;
    }
    default: {
      const _ex: never = cmd;
      throw new Error(`unhandled command ${_ex}`);
    }
  }
  checkAchievements(data, s, ev);
  return ev;
}
