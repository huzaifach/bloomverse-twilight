// Deterministic content generator for BLOOMVERSE: TWILIGHT HAVEN.
// Fixed authored order throughout. ZERO randomness — every list, rotation and
// line index is computed from the wish index. Run: node _gen.cjs
const fs = require('fs');
const path = require('path');
const DIR = __dirname;

const SPIRITS = [
  'spirit-moss-keeper',
  'spirit-dusk-moth',
  'spirit-star-wisp',
  'spirit-bramble',
  'spirit-ember-wisp',
  'spirit-nightchoir',
];

// 20 authored personality lines per spirit. Wish i uses LINES[spirit][floor(i/6)],
// so each spirit speaks its 20 lines in order across its 20 appearances.
const LINES = {
  'spirit-moss-keeper': [
    'Ah, a young gardener returns. The soil remembers you.',
    'Patience, little one. Even moonlight takes its time.',
    'I have watched ten thousand sprouts. Yours are the stubbornest.',
    'Bring me what I ask, and I will tell you a root-secret.',
    'The old roots whisper your name. They like you.',
    'A garden is just a promise you keep watering.',
    'I once knew a fern that outlived a mountain. Yours could too.',
    'Do not rush the bloom. The bloom knows when.',
    'My moss has grown over three fallen stars. Mind where you step.',
    'Every weed you pulled taught the soil something. Thank you.',
    'The twilight deepens, and so does my hunger for petals.',
    'You plant with your hands. I plant with centuries.',
    'A secret: the shadiest corner grows the bravest flowers.',
    'I counted your merges last night. Impressive, for a mayfly.',
    'Bring the offering. The earth is listening.',
    'Old as I am, your garden still surprises me.',
    'Roots first, glory later. That is the whole law.',
    'I remember when this haven was one sad seed. Look at it now.',
    'The moss keeps your footprints. Walk gently, gardener.',
    'One more wish, and I shall nap for a hundred years. Make it good.',
  ],
  'spirit-dusk-moth': [
    'Mmm... five more minutes... oh, a wish? Fine, fine.',
    'I dreamed your garden last night. It was purple. Bring purple.',
    'Twilight is when the flowers tell the truth. Listen.',
    'My wings are dusty with stardust. Yours could be too.',
    'Shhh. The nightchoir is tuning. Bring me something quiet.',
    'I collect dusk in my pockets. Trade you some for petals.',
    'Half asleep, fully hungry. You know the drill.',
    'The moon asked about you. I said you were doing fine.',
    'Dreams are just wishes that got tired. Feed me anyway.',
    'I flew over your grove at dusk. Lovely. Needs more velvet.',
    'Yawn... oh! A gardener! What did I promise? Something.',
    'The dark is not empty, you know. It is full of almost-flowers.',
    'Bring me dusk-born blooms and I will dream you a good omen.',
    'I nap through noon. Twilight is my morning. Good morning.',
    'My antennae tingle. That means a wish is near. Or hunger.',
    'Softly now. The petals bruise if you wish too loudly.',
    'I traded a secret to the moon for you. It cost me a nap.',
    'Dusk is the garden\u2019s eyelid, closing. Beautiful, no?',
    'One day I will sleep through a whole century. Not today.',
    'Last wish of the evening? Make it a velvet one.',
  ],
  'spirit-star-wisp': [
    'Hi hi hi! A wish! I LOVE wishes! What do you need?!',
    'I raced a comet once. I won. Anyway, petals please!',
    'Twinkle-twinkle! Your garden is getting SO shiny!',
    'I can hold my breath for a whole meteor shower. Watch\u2014',
    'The stars sent me down with a list. Your name is on it!',
    'Faster! Merge faster! The sky is waiting!',
    'I polished three constellations today. Reward me with blooms!',
    'Did you know my sparkle is 100% organic? It is now.',
    'Wishes are my favorite food. Second favorite: compliments.',
    'I blinked and your fern grew! Do it again!',
    'The big dipper says hello. It wants a cutting.',
    'Zoom! That is the sound of me delivering your reward.',
    'I am small but my wishes are ENORMOUS.',
    'Count the stars with me later. First, the offering!',
    'My glow got brighter! That means you are doing great!',
    'I dared the moon to a staring contest. Bring snacks\u2014 I mean, blooms.',
    'Every wish you make adds a star somewhere. Probably.',
    'Wheee! Another one! You are on a roll, gardener!',
    'I wrapped your reward in moonlight. Do not shake it.',
    'Okay okay okay\u2014 one more wish and then I nap. MAYBE.',
  ],
  'spirit-bramble': [
    'Hmph. Another wish? Fine. Make it worth my thorns.',
    'I do not do \u2018cozy\u2019. I do trades. Bring the plants.',
    'Soft gardeners, hard bargains. That is the rule.',
    'You again. Good. I was getting bored of the quiet.',
    'My thorns have seen things. Your sprouts are... adequate.',
    'Do not mistake my grumbling for dislike. It is just... grumbling.',
    'A fair trade, thorn for petal. No hugging.',
    'I guarded this grove before you were a seedling. Respect.',
    'Tough soil makes tough flowers. You are doing fine. Do not tell anyone I said that.',
    'Hurry up. My patience has thorns too.',
    'I like you, gardener. There. I said it. Moving on.',
    'Bring me the strong ones. The weak ones I... also accept. Quietly.',
    'Every bramble was once a soft shoot. Remember that.',
    'I will trade fair. My bark is worse than my bite. Usually.',
    'The night is cold. Your garden is warm. Keep it that way.',
    'Stop smiling. It is... fine. Keep smiling.',
    'I have tangled with storms. Your wishes are easy by comparison.',
    'A bramble\u2019s promise is root-deep. I will keep mine.',
    'You bring the blooms, I bring the protection. Deal.',
    'Last one. Make it count, soft-heart.',
  ],
  'spirit-ember-wisp': [
    'Come closer, gardener. I do not bite. I barely even flicker.',
    'I have burned low for a hundred years. Your garden keeps me warm.',
    'A little warmth goes a long way on a cold twilight.',
    'Bring me something lovely, and I will glow a little brighter.',
    'I remember every hearth I ever lit. Yours is my favorite.',
    'Do not worry about me. Worry about your watering schedule.',
    'Embers never truly die. They just... wait. Like me.',
    'Your wish is safe with me. I keep them all, glowing.',
    'A warm wish for a warm heart. That is the trade.',
    'I hum old fire-songs when no one listens. You may listen.',
    'The cold creeps in at dusk. Your blooms push it back.',
    'Small flame, big promises. That has always been me.',
    'I saved a spark from the first star. It is yours now.',
    'Gently, gently. Even wishes can singe if rushed.',
    'You remind me of spring. I have not seen spring in ages.',
    'Keep me near your heart, gardener, and I will keep you warm.',
    'Every petal you bring feeds my little light. Thank you.',
    'I am not much, but I am yours. That is enough.',
    'The night is long, but so is my patience.',
    'One last glow, one last wish. Make it a warm one.',
  ],
  'spirit-nightchoir': [
    'We sing, and the garden listens. Bring us an offering.',
    'Laaa... your wish joins our round. Do you hear it?',
    'We are many voices, one hunger. Petals, gardener.',
    'The night blooms when we sing. Sing with us\u2014 bring flowers.',
    'Soprano asks for starlight. Alto asks for roots. We ask for both.',
    'Hush now. The verse is beginning. Your offering is the chorus.',
    'We sang your garden into being. We remember every note.',
    'A wish in harmony is worth ten alone. Bring us yours.',
    'We do not sleep. We rehearse. The dawn is our deadline.',
    'Minor key tonight. Bring something to cheer the basses.',
    'Your merges make a lovely rhythm. Keep the beat, gardener.',
    'We traded verses with the wind. It wants a cutting too.',
    'Crescendo! Your garden swells! Our favorite movement.',
    'Every petal is a note. Bring us a whole symphony.',
    'We sing for the moon. The moon sings back. You bring snacks.',
    'Round and round the wish goes. Where it stops, we bloom.',
    'The quiet between notes is where wishes hide. Listen.',
    'Encore! Encore! The garden demands another wish!',
    'We will remember your name in song long after the stars fade.',
    'Final verse, gardener. Make it bloom.',
  ],
};

const FAMS = ['sylvani', 'prism', 'dusk', 'astral'];
const plant = (fam, tier) => `${fam}_t${tier}`;
const hybrid = (n) => `hybrid_${n}`;

function buildWishes() {
  const wishes = [];
  for (let i = 0; i < 120; i++) {
    const n = i + 1;
    const spirit = SPIRITS[i % 6];
    const text = LINES[spirit][Math.floor(i / 6)]; // 0..19 per spirit, in order
    let requires;
    let phase;

    if (i < 24) {
      // Phase A (wishes 1-24): tiers 1-3 of sylvani/prism, gentle counts.
      phase = 'A';
      const fam = FAMS[i % 2];
      const tier = 1 + Math.floor(i / 8);
      const count = 1 + (i % 3);
      requires = [{ plant: plant(fam, tier), count }];
    } else if (i < 60) {
      // Phase B (25-60): tiers 2-4 of sylvani/prism/dusk; second ingredient from #42.
      phase = 'B';
      const fam = FAMS[i % 3];
      const tier = 2 + Math.floor((i - 24) / 12);
      const count = 2 + (i % 3);
      requires = [{ plant: plant(fam, tier), count }];
      if (i >= 42) {
        const fam2 = FAMS[(i + 1) % 3];
        const t2 = Math.min(4, 2 + Math.floor((i - 24) / 18));
        requires.push({ plant: plant(fam2, t2), count: 2 });
      }
    } else if (i < 96) {
      // Phase C (61-96): tiers 3-6 across all four families; hybrids debut at #90.
      phase = 'C';
      if (i >= 89) {
        requires = [{ plant: hybrid(1 + ((i - 89) % 4)), count: 1 }];
      } else {
        const fam = FAMS[i % 4];
        const tier = 3 + Math.floor((i - 60) / 9);
        const count = 2 + (i % 3);
        requires = [{ plant: plant(fam, tier), count }];
        if (i % 4 === 3) {
          requires.push({ plant: plant(FAMS[(i + 2) % 4], Math.max(2, tier - 1)), count: 2 });
        }
      }
    } else {
      // Phase D (97-120): tiers 5-8 + hybrids; every third wish pairs a hybrid with a plant.
      phase = 'D';
      const tier = Math.min(8, 5 + Math.floor((i - 96) / 6));
      const fam = FAMS[i % 4];
      const count = 2 + (i % 3);
      if (i % 3 === 2) {
        requires = [
          { plant: hybrid(1 + ((i - 96) % 8)), count: 1 },
          { plant: plant(fam, tier), count },
        ];
      } else {
        requires = [{ plant: plant(fam, tier), count }];
      }
    }

    // Rising reward curve: moondew 20 -> ~8,850; stardust 0 -> ~574; renown 1 -> 25.
    let moondew, stardust, renown;
    if (phase === 'A') {
      moondew = 20 + i * 10;
      stardust = i < 10 ? 0 : 2 + Math.floor((i - 10) / 2);
      renown = 1 + Math.floor(i / 8);
    } else if (phase === 'B') {
      moondew = 260 + (i - 24) * 18;
      stardust = 10 + (i - 24);
      renown = 4 + Math.floor((i - 24) / 9);
    } else if (phase === 'C') {
      moondew = 920 + (i - 60) * 60;
      stardust = 50 + (i - 60) * 3;
      renown = 8 + Math.floor((i - 60) / 6);
    } else {
      moondew = 3100 + (i - 96) * 250;
      stardust = 160 + (i - 96) * 18;
      renown = 14 + Math.floor((i - 96) / 2);
    }
    moondew = Math.round(moondew / 5) * 5;

    // Every 6th wish grants a cutting of the next tier (same family), when one exists.
    let cutting = null;
    const first = requires[0].plant;
    if (!first.startsWith('hybrid_') && i % 6 === 5) {
      const m = first.match(/^([a-z]+)_t(\d)$/);
      const tierN = parseInt(m[2], 10);
      if (tierN < 8) cutting = `${m[1]}_t${tierN + 1}`;
    }

    wishes.push({
      id: 'wish_' + String(n).padStart(3, '0'),
      spirit,
      text,
      requires,
      rewards: { moondew, stardust, renown },
      cutting,
    });
  }
  return wishes;
}

function buildUpgrades() {
  const defs = [
    { id: 'raincaller', name: 'Raincaller Charm', desc: 'A storm-bell charm that hurries the wish-pods along. Each level cuts pod cooldown by 4%.', base: 100, mult: 1.5, pctPerLevel: 4 },
    { id: 'moths', name: 'Moon Moths', desc: 'A loyal flutter of moon moths that dust every harvest with extra moondew. Each level raises grove yield by 8%.', base: 150, mult: 1.6, pctPerLevel: 8 },
    { id: 'starpots', name: 'Star Pots', desc: 'Clay pots glazed with crushed starlight. Each level raises pot capacity and yield by 6%.', base: 120, mult: 1.55, pctPerLevel: 6 },
  ];
  return {
    lines: defs.map((d) => ({
      id: d.id,
      name: d.name,
      desc: d.desc,
      levels: Array.from({ length: 10 }, (_, k) => {
        const level = k + 1;
        return {
          level,
          costMoondew: Math.round(d.base * Math.pow(d.mult, k)),
          effectPct: d.pctPerLevel * level,
        };
      }),
    })),
  };
}

fs.writeFileSync(path.join(DIR, 'wishes.json'), JSON.stringify({ wishes: buildWishes() }, null, 2) + '\n');
fs.writeFileSync(path.join(DIR, 'upgrades.json'), JSON.stringify(buildUpgrades(), null, 2) + '\n');
console.log('wrote wishes.json + upgrades.json');
