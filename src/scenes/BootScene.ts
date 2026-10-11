import Phaser from 'phaser';
import { AudioMan } from '../audio.js';
import { ctx } from '../ctx.js';
import { loadGameData } from '../data.js';
import { freshState } from '../sim.js';
import { loadGame, saveGame } from '../save.js';
import { registerAtlasFrames } from '../ui.js';

const ATLAS_PAGES: [string, number][] = [['game', 2], ['ui', 3]];
// Boot loads ONLY what the title screen needs. Everything else (other
// backgrounds, all audio) lazy-loads later — keeps the first paint fast.
const BG_KEYS = ['bg-title-art'];

const TIPS = [
  'Tip: drag a sprout onto its twin to merge them.',
  'Tip: merging beside withered tiles restores them.',
  'Tip: Tier 4+ plants earn Moondew in the Moonwell Grove.',
  'Tip: forest spirits leave wishes on the Wish Board.',
];

export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

  preload(): void {
    for (const [group, pages] of ATLAS_PAGES)
      for (let i = 0; i < pages; i++)
        this.load.atlas(`atlas-${group}-${i}`,
          `assets/atlases/atlas-${group}-${i}.webp`,
          `assets/atlases/atlas-${group}-${i}.json`);
    for (const k of BG_KEYS) this.load.image(k, `assets/backgrounds/${k}.webp`);
    this.buildLoader();
  }

  /** A real loading screen: art-tinted, titled, with tips. Never black+bar. */
  private buildLoader(): void {
    const w = 420, h = 920, cx = 210;
    this.add.rectangle(0, 0, w, h, 0x12101d).setOrigin(0);
    // soft vignette glows (cheap shapes, no textures needed)
    const glow = this.add.circle(cx, h * 0.34, 190, 0x4a3b6b, 0.55);
    const glow2 = this.add.circle(cx, h * 0.34, 120, 0xb9a7e6, 0.25);
    void glow; void glow2;
    this.add.text(cx, h * 0.30, 'BLOOMVERSE', {
      fontFamily: 'Georgia, serif', fontSize: '52px', color: '#F5E6C8',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add.text(cx, h * 0.36, '✦ Twilight Haven ✦', {
      fontFamily: 'Georgia, serif', fontSize: '24px', color: '#E8A87C',
    }).setOrigin(0.5);
    // progress track + bar
    const bw = 300, bx = cx - bw / 2, by = h * 0.52;
    this.add.rectangle(cx, by, bw + 8, 26, 0x4a3b6b).setOrigin(0.5);
    const bar = this.add.rectangle(bx, by, 4, 16, 0xd98e4a).setOrigin(0, 0.5);
    // deterministic tip (time-sliced, not random)
    const tip = TIPS[Math.floor(Date.now() / 5000) % TIPS.length] ?? TIPS[0] ?? '';
    const tipT = this.add.text(cx, h * 0.62, tip, {
      fontFamily: 'Georgia, serif', fontSize: '20px', color: '#B9A7E6',
      align: 'center', wordWrap: { width: 360 },
    }).setOrigin(0.5, 0);
    this.load.on('progress', (p: number) => bar.setDisplaySize(Math.max(4, bw * p), 16));
    this.load.on('complete', () => tipT.setAlpha(0.4));
  }

  create(): void {
    for (const [group, pages] of ATLAS_PAGES)
      for (let i = 0; i < pages; i++) {
        const key = `atlas-${group}-${i}`;
        // NOTE: Phaser's atlas loader does NOT put the JSON in cache.json —
        // frame names must come from the TextureManager.
        const tex = this.textures.get(key);
        const names: string[] = (tex && typeof (tex as unknown as { getFrameNames?: unknown }).getFrameNames === 'function')
          ? (tex as unknown as { getFrameNames(): string[] }).getFrameNames() : [];
        const frames: Record<string, unknown> = {};
        for (const n of names) frames[n] = true;
        registerAtlasFrames(key, frames);
      }
    ctx.audio = new AudioMan(this);
    void this.finishBoot();
  }

  private async finishBoot(): Promise<void> {
    // 1. data (authored JSON -> adapted + validated)
    ctx.data = await loadGameData('');
    // 2. save
    const now = Date.now();
    const { state } = loadGame(now);
    state.dayIndex = Math.floor(now / 86400000);
    ctx.state = state;
    saveGame(state);
    // 3. fonts (bounded wait)
    try {
      await Promise.race([
        document.fonts.ready,
        new Promise((res) => setTimeout(res, 2500)),
      ]);
    } catch { /* text still renders with fallback */ }
    this.scene.start('title');
  }
}
