// Headless sim tests — deterministic, no engine. Run: npm test
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  activeWishes, applyCommand, blessingMult, freshState, groveRate,
  hybridFor, medalMultiplier, offerValue, potsUnlocked, spawnCost, wingPct,
} from '../src/sim.js';
import type { BlessingKind, GameData } from '../src/data.js';

function mockData(): GameData {
  const fams = ['sylvani', 'prism', 'dusk', 'astral'].map((f, fi) => ({
    id: f, name: f, desc: '', growth: 60,
    tiers: Array.from({ length: 8 }, (_, i) => ({
      id: `${f}_t${i + 1}`, tier: i + 1, name: `${f}${i + 1}`,
      wishValue: Math.floor(10 * Math.pow(2.2, i) * (fi === 2 ? 2 : 1)),
      moondewPerHour: i < 3 ? 0 : Math.floor(5 * Math.pow(1.8, i) * (fi === 1 ? 1.6 : 1)),
      art: `${f}_t${i + 1}.png`,
    })),
  }));
  const wingKinds = ['podCooldownReduction', 'spawnCostReduction',
                     'prismMoondewMult', 'groveExpansion'];
  const wingIds = ['root-cellar', 'fern-sanctum', 'prism-grotto', 'astral-dome'];
  return {
    families: fams,
    hybrids: Array.from({ length: 8 }, (_, i) => ({
      id: `hybrid_${i + 1}`, name: `h${i + 1}`, desc: '',
      recipe: { a: 'dusk_t6', b: 'sylvani_t6' }, resultTierBoost: 2,
      art: `hybrid_${i + 1}.png`,
    })),
    wishes: Array.from({ length: 120 }, (_, i) => ({
      id: `wish_${String(i + 1).padStart(3, '0')}`,
      spirit: 'spirit-moss-keeper', text: 'x',
      requires: [{ plant: 'sylvani_t1', count: 1 + (i % 3) }],
      rewards: { moondew: 50 + i * 10, stardust: i, renown: 5 },
      cutting: null,
    })),
    wings: wingIds.map((wid, wi) => ({
      id: wid, name: wid, desc: '', renownRequired: 0,
      levels: Array.from({ length: 5 }, (_, i) => ({
        costMoondew: 100 * (i + 1), effect: '', effectValue: 10 * (i + 1),
        effectKind: wingKinds[wi] as string,
        ...(wi === 3 ? { potsTotal: 5 + (i >= 4 ? 3 : i >= 2 ? 2 : 1) } : {}),
      })),
    })),
    upgrades: ['raincaller', 'moths', 'starpots'].map((u) => ({
      id: u, name: u, desc: '',
      levels: Array.from({ length: 10 }, (_, i) => ({
        level: i + 1, costMoondew: Math.floor(100 * Math.pow(1.5, i)),
        effectPct: 5,
      })),
    })),
    achievements: [
      { id: 'a1', name: 'A', desc: '', trigger: { kind: 'mergesTotal', value: 1 },
        reward: { moondew: 10, stardust: 0 } },
      { id: 'a2', name: 'B', desc: '', trigger: { kind: 'renownTotal', value: 5 },
        reward: { moondew: 10, stardust: 0 } },
    ],
    blessings: Array.from({ length: 14 }, (_, i) => {
      const kinds: BlessingKind[] = ['moondew', 'wish', 'grove', 'spawn'];
      return {
        day: i, name: `b${i}`, desc: '', icon: 'blessing-moon.png',
        effect: { kind: kinds[i % 4] as BlessingKind, pct: 20 },
      };
    }),
    spirits: Array.from({ length: 12 }, (_, i) => ({
      id: `s${i}`, name: `s${i}`, line: '', art: '',
    })),
  };
}

const D = mockData();
const NOW = 1000;

describe('freshState', () => {
  it('has 25 cells, 8 withered, 5 starter plants', () => {
    const s = freshState(NOW);
    assert.equal(s.board.length, 25);
    assert.equal(s.board.filter((c) => c?.kind === 'withered').length, 8);
    assert.equal(s.board.filter((c) => c?.kind === 'plant').length, 5);
  });
});

describe('spawn', () => {
  it('spawns sylvani_t1, charges cost, sets cooldown', () => {
    const s = freshState(NOW);
    const before = s.currencies.moondew;
    const ev = applyCommand(D, s, { type: 'spawn', now: NOW });
    assert.ok(ev.some((e) => e.type === 'spawned'));
    assert.ok(s.podReadyAt > NOW);
    assert.equal(s.currencies.moondew, before - spawnCost(D, freshState(NOW)));
    assert.equal(s.stats.spawned, 1);
  });
  it('denies during cooldown', () => {
    const s = freshState(NOW);
    applyCommand(D, s, { type: 'spawn', now: NOW });
    const ev = applyCommand(D, s, { type: 'spawn', now: NOW + 2000 });
    assert.ok(ev.some((e) => e.type === 'denied'));
  });
  it('denies when too poor', () => {
    const s = freshState(NOW);
    s.currencies.moondew = 0;
    const ev = applyCommand(D, s, { type: 'spawn', now: NOW });
    assert.ok(ev.some((e) => e.type === 'denied'));
  });
  it('cost scales with lifetime spawns', () => {
    const s = freshState(NOW);
    const c0 = spawnCost(D, s);
    s.stats.spawned = 50;
    assert.ok(spawnCost(D, s) > c0);
  });
  it('spawn blessing discount applies', () => {
    const s = freshState(NOW);
    s.dayIndex = 3; // kinds[3] = 'spawn' in mock
    const c = spawnCost(D, s);
    s.dayIndex = 0; // 'moondew'
    assert.ok(spawnCost(D, s) > c);
  });
});

describe('merge', () => {
  it('merges two t1 into t2 and restores a withered neighbor', () => {
    const s = freshState(NOW);
    const witheredBefore = s.board.filter((c) => c?.kind === 'withered').length;
    const ev = applyCommand(D, s, { type: 'move', from: 11, to: 13, now: NOW });
    const m = ev.find((e) => e.type === 'merged');
    assert.ok(m && m.type === 'merged' && m.result === 'sylvani_t2');
    const witheredAfter = s.board.filter((c) => c?.kind === 'withered').length;
    assert.equal(witheredAfter, witheredBefore - 1);
    assert.equal(s.stats.merges, 1);
    assert.ok(s.discovered.includes('sylvani_t2'));
  });
  it('denies merge of different plants', () => {
    const s = freshState(NOW);
    const ev = applyCommand(D, s, { type: 'move', from: 11, to: 12, now: NOW });
    assert.ok(ev.some((e) => e.type === 'denied'));
  });
  it('denies merge at max tier', () => {
    const s = freshState(NOW);
    s.board[0] = { kind: 'plant', plant: 'sylvani_t8' };
    s.board[1] = { kind: 'plant', plant: 'sylvani_t8' };
    const ev = applyCommand(D, s, { type: 'move', from: 0, to: 1, now: NOW });
    assert.ok(ev.some((e) => e.type === 'denied'));
  });
  it('merges tier-6 recipe pair into hybrid when dome unlocked', () => {
    const s = freshState(NOW);
    s.wings['astral-dome'] = 1;
    s.board[0] = { kind: 'plant', plant: 'dusk_t6' };
    s.board[1] = { kind: 'plant', plant: 'sylvani_t6' };
    assert.equal(hybridFor(D, s, 'dusk_t6', 'sylvani_t6'), 'hybrid_1');
    const ev = applyCommand(D, s, { type: 'move', from: 0, to: 1, now: NOW });
    const m = ev.find((e) => e.type === 'merged');
    assert.ok(m && m.type === 'merged' && m.result === 'hybrid_1');
  });
  it('no hybrid without dome unlock', () => {
    const s = freshState(NOW);
    assert.equal(hybridFor(D, s, 'dusk_t6', 'sylvani_t6'), null);
  });
});

describe('offer', () => {
  it('grants moondew and clears cell', () => {
    const s = freshState(NOW);
    const before = s.currencies.moondew;
    const ev = applyCommand(D, s, { type: 'offer', cell: 11, now: NOW });
    const o = ev.find((e) => e.type === 'offered');
    assert.ok(o && o.type === 'offered');
    assert.equal(s.currencies.moondew, before + o.moondew);
    assert.equal(s.board[11], null);
  });
  it('offerValue matches command gain', () => {
    const s = freshState(NOW);
    assert.equal(offerValue(D, s, 'sylvani_t1'),
      Math.max(1, Math.floor(10 * 0.5 * blessingMult(D, s, 'moondew'))));
  });
});

describe('wish', () => {
  it('claims when requirements met, advances deck', () => {
    const s = freshState(NOW);
    const ev = applyCommand(D, s, { type: 'claimWish', slot: 0, now: NOW });
    assert.ok(ev.some((e) => e.type === 'wishClaimed'));
    assert.equal(s.wishDeckIndex, 1);
    assert.equal(s.stats.wishes, 1);
    assert.equal(s.stats.renownEarned, 5);
  });
  it('denies when plants missing', () => {
    const s = freshState(NOW);
    s.board = s.board.map(() => null);
    const ev = applyCommand(D, s, { type: 'claimWish', slot: 0, now: NOW });
    assert.ok(ev.some((e) => e.type === 'denied'));
  });
  it('renownTotal achievement fires on cumulative renown', () => {
    const s = freshState(NOW);
    applyCommand(D, s, { type: 'claimWish', slot: 0, now: NOW });
    assert.ok(s.achievements['a2']);
  });
  it('active wishes rotate deterministically', () => {
    const s = freshState(NOW);
    const a = activeWishes(D, s).map((w) => w.id);
    s.wishDeckIndex = 119;
    const b = activeWishes(D, s).map((w) => w.id);
    assert.deepEqual(a, ['wish_001', 'wish_002', 'wish_003']);
    assert.deepEqual(b, ['wish_120', 'wish_001', 'wish_002']);
  });
});

describe('grove', () => {
  it('denies transplant below tier 4', () => {
    const s = freshState(NOW);
    const ev = applyCommand(D, s, { type: 'transplant', cell: 11, pot: 0, now: NOW });
    assert.ok(ev.some((e) => e.type === 'denied'));
  });
  it('transplants tier 4+ and accrues', () => {
    const s = freshState(NOW);
    s.board[2] = { kind: 'plant', plant: 'sylvani_t4' };
    const ev = applyCommand(D, s, { type: 'transplant', cell: 2, pot: 0, now: NOW });
    assert.ok(ev.some((e) => e.type === 'transplanted'));
    assert.ok(groveRate(D, s) > 0);
    s.grove.lastCollect = 0;
    const ev2 = applyCommand(D, s, { type: 'collectGrove', now: 3600000 });
    const got = ev2.find((e) => e.type === 'collected');
    assert.ok(got && got.type === 'collected' && got.amount > 0);
  });
  it('pots unlock with astral dome (data-driven)', () => {
    const s = freshState(NOW);
    assert.equal(potsUnlocked(D, s), 5);
    s.wings['astral-dome'] = 1;
    assert.equal(potsUnlocked(D, s), 6);
    s.wings['astral-dome'] = 5;
    assert.equal(potsUnlocked(D, s), 8);
  });
  it('wingPct reads authored pct', () => {
    const s = freshState(NOW);
    assert.equal(wingPct(D, s, 'root-cellar'), 0);
    s.wings['root-cellar'] = 2;
    assert.equal(wingPct(D, s, 'root-cellar'), 20);
  });
});

describe('upgrades & wings', () => {
  it('denies purchase when poor', () => {
    const s = freshState(NOW);
    s.currencies.moondew = 0;
    const ev = applyCommand(D, s, { type: 'buyUpgrade', line: 'moths', now: NOW });
    assert.ok(ev.some((e) => e.type === 'denied'));
  });
  it('buys upgrade and raises grove rate', () => {
    const s = freshState(NOW);
    s.currencies.moondew = 100000;
    s.grove.pots[0] = 'prism_t4';
    const r0 = groveRate(D, s);
    applyCommand(D, s, { type: 'buyUpgrade', line: 'moths', now: NOW });
    assert.ok(groveRate(D, s) > r0);
  });
});

describe('rebirth', () => {
  it('denies below tier 7', () => {
    const s = freshState(NOW);
    const ev = applyCommand(D, s, { type: 'rebirth', now: NOW });
    assert.ok(ev.some((e) => e.type === 'denied'));
  });
  it('grants medals and keeps atlas', () => {
    const s = freshState(NOW);
    s.stats.highestTier = 8;
    s.stats.renownEarned = 999;
    s.discovered.push('dusk_t5');
    const ev = applyCommand(D, s, { type: 'rebirth', now: NOW });
    const r = ev.find((e) => e.type === 'reborn');
    assert.ok(r && r.type === 'reborn' && r.medals === 3);
    assert.equal(s.currencies.starMedals, 3);
    assert.ok(s.discovered.includes('dusk_t5'));
    // renownTotal achievement (a2) fires on the kept lifetime renown: 60 + 10
    assert.ok(s.achievements['a2']);
    assert.equal(s.currencies.moondew, 70);
    assert.equal(s.stats.renownEarned, 999);
    assert.ok(medalMultiplier(s) > 1);
  });
});

describe('achievements', () => {
  it('fires on trigger and grants reward', () => {
    const s = freshState(NOW);
    const before = s.currencies.moondew;
    applyCommand(D, s, { type: 'move', from: 11, to: 13, now: NOW });
    assert.ok(s.achievements['a1']);
    assert.ok(s.currencies.moondew >= before);
  });
});
