// Game data types + adapter + validation for data/*.json (fetched, not bundled).
// The content files are authored by hand (content worker); this module adapts
// their on-disk schema into the engine's GameData shape.
export interface PlantTier {
  id: string; tier: number; name: string;
  wishValue: number; moondewPerHour: number; art: string;
}
export interface PlantFamily {
  id: string; name: string; desc: string; growth: number;
  tiers: PlantTier[];
}
export interface HybridDef {
  id: string; name: string; desc: string;
  recipe: { a: string; b: string };
  resultTierBoost: number; art: string;
}
export interface WishReq { plant: string; count: number }
export interface WishDef {
  id: string; spirit: string; text: string;
  requires: WishReq[];
  rewards: { moondew: number; stardust: number; renown: number };
  cutting: string | null;
}
export interface WingLevel {
  costMoondew: number; effect: string; effectValue: number;
  effectKind: string; potsTotal?: number;
}
export interface WingDef {
  id: string; name: string; desc: string; renownRequired: number;
  levels: WingLevel[];
}
export interface UpgradeLevel { level: number; costMoondew: number; effectPct: number }
export interface UpgradeLine { id: string; name: string; desc: string; levels: UpgradeLevel[] }
export type TriggerKind = 'mergesTotal' | 'wishesTotal' | 'tierReached' |
  'renownTotal' | 'groveCollected' | 'rebirths' | 'atlasCount' | 'playHours';
export interface AchievementDef {
  id: string; name: string; desc: string;
  trigger: { kind: TriggerKind; value: number };
  reward: { moondew: number; stardust: number };
}
export type BlessingKind = 'moondew' | 'wish' | 'grove' | 'spawn';
export interface BlessingDef {
  day: number; name: string; desc: string; icon: string;
  effect: { kind: BlessingKind; pct: number };
}
export interface SpiritDef { id: string; name: string; line: string; art: string }

export interface GameData {
  families: PlantFamily[];
  hybrids: HybridDef[];
  wishes: WishDef[];
  wings: WingDef[];
  upgrades: UpgradeLine[];
  achievements: AchievementDef[];
  blessings: BlessingDef[];
  spirits: SpiritDef[];
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
function arr(o: Record<string, unknown>, k: string): unknown[] {
  const v = o[k];
  if (!Array.isArray(v)) throw new Error(`data: ${k} not an array`);
  return v;
}
function str(o: Record<string, unknown>, k: string): string {
  const v = o[k];
  if (typeof v !== 'string') throw new Error(`data: ${k} not a string`);
  return v;
}
function num(o: Record<string, unknown>, k: string, dflt = 0): number {
  const v = o[k];
  if (v === undefined) return dflt;
  if (typeof v !== 'number') throw new Error(`data: ${k} not a number`);
  return v;
}

/** Unwrap the worker's single-key envelope: {families:[...]} -> [...] */
function unwrap(j: unknown, key: string): unknown[] {
  if (!isObj(j)) throw new Error(`data: ${key}.json root not object`);
  return arr(j, key);
}

const BLESS_MAP: Record<string, BlessingKind> = {
  moondewBoost: 'moondew', wishRewardBoost: 'wish', groveBoost: 'grove',
  spawnDiscount: 'spawn',
};

/** Adapt the authored on-disk schema into the engine's GameData. */
export function adaptWorkerData(raw: Record<string, unknown[]>): GameData {
  const get = (k: string): unknown[] => {
    const v = raw[k];
    if (!v) throw new Error(`data: missing section ${k}`);
    return v;
  };
  const families: PlantFamily[] = get('families').map((f0) => {
    const f = f0 as Record<string, unknown>;
    return {
      id: str(f, 'id'), name: str(f, 'name'), desc: str(f, 'desc'),
      growth: num(f, 'growthSeconds', 60),
      tiers: arr(f, 'tiers').map((t0) => {
        const t = t0 as Record<string, unknown>;
        return {
          id: str(t, 'id'), tier: num(t, 'tier'), name: str(t, 'name'),
          wishValue: num(t, 'wishValue'), moondewPerHour: num(t, 'moondewPerHour'),
          art: str(t, 'art'),
        };
      }),
    };
  });
  const hybrids: HybridDef[] = get('hybrids').map((h0) => {
    const h = h0 as Record<string, unknown>;
    const recipe = h['recipe'] as Record<string, unknown>;
    return {
      id: str(h, 'id'), name: str(h, 'name'), desc: str(h, 'desc'),
      recipe: { a: str(recipe, 'a'), b: str(recipe, 'b') },
      resultTierBoost: num(h, 'resultTierBoost', 2), art: str(h, 'art'),
    };
  });
  const wishes: WishDef[] = get('wishes').map((w0) => {
    const w = w0 as Record<string, unknown>;
    const rw = w['rewards'] as Record<string, unknown>;
    return {
      id: str(w, 'id'), spirit: str(w, 'spirit'), text: str(w, 'text'),
      requires: arr(w, 'requires').map((r0) => {
        const r = r0 as Record<string, unknown>;
        return { plant: str(r, 'plant'), count: num(r, 'count') };
      }),
      rewards: {
        moondew: num(rw, 'moondew'), stardust: num(rw, 'stardust'),
        renown: num(rw, 'renown'),
      },
      cutting: (w['cutting'] as string | null) ?? null,
    };
  });
  const wings: WingDef[] = get('wings').map((w0) => {
    const w = w0 as Record<string, unknown>;
    return {
      id: str(w, 'id'), name: str(w, 'name'), desc: str(w, 'desc'),
      renownRequired: num(w, 'renownRequired', 0),
      levels: arr(w, 'levels').map((l0) => {
        const l = l0 as Record<string, unknown>;
        const cost = l['cost'] as Record<string, unknown>;
        const eff = l['effect'] as Record<string, unknown>;
        const lvl: WingLevel = {
          costMoondew: num(cost, 'moondew'),
          effect: str(l, 'effectDesc'),
          effectValue: num(eff, 'pct', 0),
          effectKind: str(eff, 'kind'),
        };
        if (typeof eff['potsTotal'] === 'number') {
          lvl.potsTotal = eff['potsTotal'] as number;
          lvl.effectValue = lvl.potsTotal;
        }
        return lvl;
      }),
    };
  });
  // upgrades.json wraps lines under "lines"
  const upgrades: UpgradeLine[] = get('upgrades').map((u0) => {
    const u = u0 as Record<string, unknown>;
    return {
      id: str(u, 'id'), name: str(u, 'name'), desc: str(u, 'desc'),
      levels: arr(u, 'levels').map((l0) => {
        const l = l0 as Record<string, unknown>;
        return {
          level: num(l, 'level'), costMoondew: num(l, 'costMoondew'),
          effectPct: num(l, 'effectPct'),
        };
      }),
    };
  });
  const achievements: AchievementDef[] = get('achievements').map((a0) => {
    const a = a0 as Record<string, unknown>;
    const tr = a['trigger'] as Record<string, unknown>;
    const rw = a['reward'] as Record<string, unknown>;
    return {
      id: str(a, 'id'), name: str(a, 'name'), desc: str(a, 'desc'),
      trigger: { kind: str(tr, 'kind') as TriggerKind, value: num(tr, 'value') },
      reward: { moondew: num(rw, 'moondew'), stardust: num(rw, 'stardust') },
    };
  });
  const blessings: BlessingDef[] = get('blessings').map((b0) => {
    const b = b0 as Record<string, unknown>;
    const eff = b['effect'] as Record<string, unknown>;
    const k = BLESS_MAP[str(eff, 'kind')] ?? 'moondew';
    return {
      day: num(b, 'day'), name: str(b, 'name'), desc: str(b, 'desc'),
      icon: str(b, 'icon'),
      effect: { kind: k, pct: num(eff, 'pct') },
    };
  });
  const spirits: SpiritDef[] = get('spirits').map((s0) => {
    const s = s0 as Record<string, unknown>;
    return {
      id: str(s, 'id'), name: str(s, 'name'), line: str(s, 'line'), art: str(s, 'art'),
    };
  });
  return { families, hybrids, wishes, wings, upgrades, achievements, blessings, spirits };
}

export function validateGameData(d: GameData): GameData {
  if (d.families.length !== 4) throw new Error('data: want 4 families');
  const plantIds = new Set<string>();
  for (const f of d.families) {
    if (f.tiers.length !== 8) throw new Error(`data: family ${f.id} tiers != 8`);
    for (const t of f.tiers) {
      if (!t.id || !t.art) throw new Error(`data: bad tier in ${f.id}`);
      plantIds.add(t.id);
    }
  }
  if (d.wishes.length !== 120) throw new Error(`data: want 120 wishes, got ${d.wishes.length}`);
  if (d.hybrids.length !== 8) throw new Error('data: want 8 hybrids');
  for (const h of d.hybrids) {
    if (!plantIds.has(h.recipe.a) || !plantIds.has(h.recipe.b))
      throw new Error(`data: hybrid ${h.id} bad recipe`);
    if (!h.art) throw new Error(`data: hybrid ${h.id} missing art`);
    plantIds.add(h.id); // wishes may require hybrids
  }
  for (const w of d.wishes)
    for (const r of w.requires)
      if (!plantIds.has(r.plant))
        throw new Error(`data: wish ${w.id} references unknown plant ${r.plant}`);
  if (d.wings.length !== 4) throw new Error('data: want 4 wings');
  for (const w of d.wings)
    if (w.levels.length !== 5) throw new Error(`data: wing ${w.id} levels != 5`);
  if (d.upgrades.length !== 3) throw new Error('data: want 3 upgrade lines');
  for (const u of d.upgrades)
    if (u.levels.length !== 10) throw new Error(`data: upgrade ${u.id} levels != 10`);
  if (d.achievements.length !== 24) throw new Error('data: want 24 achievements');
  if (d.blessings.length !== 14) throw new Error('data: want 14 blessings');
  if (d.spirits.length !== 12) throw new Error('data: want 12 spirits');
  return d;
}

/** Max tier-8 baseline used to derive hybrid stats (data-driven). */
function hybridStats(data: GameData): { wishValue: number; moondewPerHour: number } {
  let wv = 0, mh = 0;
  for (const f of data.families)
    for (const t of f.tiers)
      if (t.tier === 8) { wv = Math.max(wv, t.wishValue); mh = Math.max(mh, t.moondewPerHour); }
  return { wishValue: wv * 2, moondewPerHour: mh * 2 };
}

export function plantById(data: GameData, id: string): PlantTier {
  for (const f of data.families)
    for (const t of f.tiers)
      if (t.id === id) return t;
  for (const h of data.hybrids)
    if (h.id === id) {
      const s = hybridStats(data);
      return { id: h.id, tier: 9, name: h.name, wishValue: s.wishValue,
               moondewPerHour: s.moondewPerHour, art: h.art };
    }
  throw new Error(`unknown plant ${id}`);
}

export function familyOf(data: GameData, plantId: string): string {
  for (const f of data.families)
    if (f.tiers.some((t) => t.id === plantId)) return f.id;
  return 'hybrid';
}

export function nextTierId(data: GameData, plantId: string): string | null {
  for (const f of data.families) {
    const i = f.tiers.findIndex((t) => t.id === plantId);
    if (i >= 0) return i + 1 < f.tiers.length ? (f.tiers[i + 1] as PlantTier).id : null;
  }
  return null;
}

export function spiritById(data: GameData, id: string): SpiritDef {
  const s = data.spirits.find((x) => x.id === id);
  if (!s) throw new Error(`unknown spirit ${id}`);
  return s;
}

export function blessingFor(data: GameData, dayIndex: number): BlessingDef {
  const b = data.blessings[((dayIndex % 14) + 14) % 14];
  if (!b) throw new Error('data: no blessings');
  return b;
}

const FILES = ['families', 'hybrids', 'wishes', 'wings', 'upgrades',
               'achievements', 'blessings', 'spirits'] as const;

export async function loadGameData(base: string): Promise<GameData> {
  const raws: Record<string, unknown[]> = {};
  for (const f of FILES) {
    const res = await fetch(`${base}data/${f}.json`);
    if (!res.ok) throw new Error(`data fetch failed: ${f}.json (${res.status})`);
    const j: unknown = await res.json();
    // upgrades.json wraps under "lines", everything else under its own name
    raws[f] = unwrap(j, f === 'upgrades' ? 'lines' : f);
  }
  return validateGameData(adaptWorkerData(raws));
}
