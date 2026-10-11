// Twilight Haven — global config: palette, layout, perf budgets.
export const PALETTE = {
  nightTeal: 0x1b2a4a,
  parchment: 0xf5e6c8,
  amber: 0xe8a87c,
  moss: 0x7fb069,
  umbral: 0x12101d,
  duskViolet: 0x4a3b6b,
  spiritGlow: 0xb9a7e6,
  ember: 0xd98e4a,
  boneWhite: 0xede6d6,
  css: {
    nightTeal: '#1B2A4A',
    parchment: '#F5E6C8',
    amber: '#E8A87C',
    moss: '#7FB069',
    umbral: '#12101D',
    duskViolet: '#4A3B6B',
    spiritGlow: '#B9A7E6',
    ember: '#D98E4A',
    boneWhite: '#EDE6D6',
  },
} as const;

// Design resolution: portrait 720x1280, SCALE.RESIZE to fill real screen.
export const DESIGN_W = 720;
export const DESIGN_H = 1280;

// Perf budgets (Mali-class target, per webgame-perf skill)
export const PERF = {
  maxDpr: 1.5,
  maxParticles: 100,
  maxDrawCalls: 50,
  particleReserve: 120,
} as const;

export const SAVE_KEY = 'twilight_haven_save_v1';
export const SAVE_VERSION = 1;

export const BOARD_N = 5;
export const BOARD_CELLS = 25;
export const GROVE_POTS = 8;
export const OFFLINE_CAP_HOURS = 12;
export const WISH_DECK_SIZE = 120;
export const ACTIVE_WISHES = 3;
