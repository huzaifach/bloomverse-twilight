// Validator for BLOOMVERSE: TWILIGHT HAVEN data. Run: node _validate.cjs
// Prints PASS/FAIL per check; exits non-zero on any failure.
const fs = require('fs');
const path = require('path');
const DIR = __dirname;

const SPRITES = new Set();
['sylvani', 'prism', 'dusk', 'astral'].forEach((f) => {
  for (let t = 1; t <= 8; t++) SPRITES.add(`${f}_t${t}.png`);
});
for (let h = 1; h <= 8; h++) SPRITES.add(`hybrid_${h}.png`);
[
  'spirit-moss-keeper', 'spirit-dusk-moth', 'spirit-star-wisp',
  'spirit-bramble', 'spirit-ember-wisp', 'spirit-nightchoir',
].forEach((s) => SPRITES.add(`${s}.png`));
[
  'tile-withered', 'tile-parchment', 'wish-pod', 'star-pot',
  'icon-moondew', 'icon-stardust', 'icon-renown', 'icon-gear',
  'panel-parchment', 'panel-umbral', 'ribbon-banner', 'button-amber',
  'pill-label', 'divider-flourish', 'icon-sleeping-moon', 'coach-hand',
  'frame-spirit-card', 'track-starchart', 'fx-gold-burst', 'ornament-corner',
  'tex-parchment', 'tex-umbral', 'tex-nightteal', 'tex-moss',
].forEach((s) => SPRITES.add(`${s}.png`));

let fails = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) fails++;
};

const load = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));

// --- counts ---
const families = load('families.json').families;
check('families count = 4', families.length === 4, `got ${families.length}`);
check('each family has 8 tiers', families.every((f) => f.tiers.length === 8));

const hybrids = load('hybrids.json').hybrids;
check('hybrids count = 8', hybrids.length === 8, `got ${hybrids.length}`);

const wishes = load('wishes.json').wishes;
check('wishes count = 120', wishes.length === 120, `got ${wishes.length}`);

const wings = load('wings.json').wings;
check('wings count = 4', wings.length === 4, `got ${wings.length}`);
check('each wing has 5 levels', wings.every((w) => w.levels.length === 5));

const upgrades = load('upgrades.json').lines;
check('upgrade lines = 3', upgrades.length === 3, `got ${upgrades.length}`);
check('each line has 10 levels', upgrades.every((u) => u.levels.length === 10));

const ach = load('achievements.json').achievements;
check('achievements count = 24', ach.length === 24, `got ${ach.length}`);

const blessings = load('blessings.json').blessings;
check('blessings count = 14', blessings.length === 14, `got ${blessings.length}`);
check('blessing days are 0..13 in order', blessings.every((b, i) => b.day === i));

const spirits = load('spirits.json').spirits;
check('spirits count = 6', spirits.length === 6, `got ${spirits.length}`);

// --- plant id registry ---
const plantIds = new Set();
families.forEach((f) => f.tiers.forEach((t) => plantIds.add(t.id)));
const hybridIds = new Set(hybrids.map((h) => h.id));
check('32 plant ids registered', plantIds.size === 32, `got ${plantIds.size}`);

// --- wishes reference valid plants/hybrids ---
let badWishRefs = [];
wishes.forEach((w) => {
  w.requires.forEach((r) => {
    if (!plantIds.has(r.plant) && !hybridIds.has(r.plant)) badWishRefs.push(`${w.id}:${r.plant}`);
  });
  if (w.cutting !== null && !plantIds.has(w.cutting)) badWishRefs.push(`${w.id}:cutting=${w.cutting}`);
});
check('all wish plant/cutting refs exist', badWishRefs.length === 0, badWishRefs.slice(0, 5).join(', '));

let badHybridRefs = [];
hybrids.forEach((h) => {
  ['a', 'b'].forEach((k) => { if (!plantIds.has(h.recipe[k])) badHybridRefs.push(`${h.id}:${k}=${h.recipe[k]}`); });
});
check('all hybrid recipe refs exist', badHybridRefs.length === 0, badHybridRefs.join(', '));

// --- hybrid recipe rules: tier 6+, different families ---
let badRecipes = [];
hybrids.forEach((h) => {
  const pa = h.recipe.a.match(/^([a-z]+)_t(\d)$/);
  const pb = h.recipe.b.match(/^([a-z]+)_t(\d)$/);
  if (!pa || !pb || pa[1] === pb[1] || +pa[2] < 6 || +pb[2] < 6) badRecipes.push(h.id);
});
check('hybrid recipes: tier-6+ of different families', badRecipes.length === 0, badRecipes.join(', '));

// --- wish ids unique + sequential ---
const ids = wishes.map((w) => w.id);
check('wish ids unique', new Set(ids).size === 120);
check('wish ids sequential wish_001..wish_120', ids.every((id, i) => id === 'wish_' + String(i + 1).padStart(3, '0')));

// --- spirit refs valid ---
const spiritIds = new Set(spirits.map((s) => s.id));
check('all wish spirits exist', wishes.every((w) => spiritIds.has(w.spirit)));

// --- art basenames in sprite list ---
let badArt = [];
const artOf = (a) => { if (!SPRITES.has(a)) badArt.push(a); };
families.forEach((f) => f.tiers.forEach((t) => artOf(t.art)));
hybrids.forEach((h) => artOf(h.art));
spirits.forEach((s) => artOf(s.art));
check('all art basenames are real sprites', badArt.length === 0, [...new Set(badArt)].slice(0, 5).join(', '));

// --- monotonic costs ---
const mono = (arr) => arr.every((v, i) => i === 0 || v > arr[i - 1]);
check('wing costs rise per level', wings.every((w) => mono(w.levels.map((l) => l.cost.moondew))));
check('wing renown gates sane (0/150/600/1500)', JSON.stringify(wings.map((w) => w.renownRequired)) === '[0,150,600,1500]');
check('upgrade costs rise per level', upgrades.every((u) => mono(u.levels.map((l) => l.costMoondew))));
check('upgrade effectPct rises per level', upgrades.every((u) => mono(u.levels.map((l) => l.effectPct))));

// --- reward curve sanity (non-decreasing-ish across phases) ---
const md = wishes.map((w) => w.rewards.moondew);
check('wish moondew rewards rise overall', md[0] < 100 && md[119] > 5000, `${md[0]} -> ${md[119]}`);
const ren = wishes.map((w) => w.rewards.renown);
check('wish renown rewards rise overall', ren[0] < ren[119], `${ren[0]} -> ${ren[119]}`);

// --- wishValue sanity: tier^2.2 shape per family ---
let badWV = [];
families.forEach((f) => {
  const wv = f.tiers.map((t) => t.wishValue);
  if (!mono(wv)) badWV.push(f.id);
});
check('wishValue rises per tier in every family', badWV.length === 0);

// --- wish difficulty ramp: max required tier non-decreasing across quartiles ---
const maxTier = (w) => Math.max(...w.requires.map((r) => {
  const m = r.plant.match(/_t(\d)$/);
  return m ? +m[1] : 9; // hybrids count as high-tier
}));
const q = [0, 1, 2, 3].map((k) => {
  const slice = wishes.slice(k * 30, k * 30 + 30);
  return Math.max(...slice.map(maxTier));
});
check('difficulty ramp (quartile max tiers rise)', q[0] <= q[1] && q[1] <= q[2] && q[2] <= q[3], q.join(' <= '));

// --- hybrid ids referenced by late wishes all exist ---
const lateHybrids = new Set();
wishes.forEach((w) => w.requires.forEach((r) => { if (r.plant.startsWith('hybrid_')) lateHybrids.add(r.plant); }));
check('late wishes use all 8 hybrids', lateHybrids.size === 8, [...lateHybrids].sort().join(','));

console.log(fails === 0 ? '\nALL CHECKS PASSED' : `\n${fails} CHECK(S) FAILED`);
process.exit(fails === 0 ? 0 : 1);
