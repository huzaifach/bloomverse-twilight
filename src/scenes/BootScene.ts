import Phaser from 'phaser';
import { AudioMan } from '../audio.js';
import { ctx } from '../ctx.js';
import { loadGameData } from '../data.js';
import { freshState } from '../sim.js';
import { loadGame, saveGame } from '../save.js';
import { registerAtlasFrames } from '../ui.js';

const ATLAS_PAGES: [string, number][] = [['game', 2], ['ui', 3]];
const BG_KEYS = ['bg-board-far', 'bg-board-mid', 'bg-grove-night', 'bg-astral-dome',
               'bg-title-art', 'bg-wing-root', 'bg-wing-fern', 'bg-wing-prism'];

export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

  preload(): void {
    for (const [group, pages] of ATLAS_PAGES)
      for (let i = 0; i < pages; i++)
        this.load.atlas(`atlas-${group}-${i}`,
          `assets/atlases/atlas-${group}-${i}.png`,
          `assets/atlases/atlas-${group}-${i}.json`);
    for (const k of BG_KEYS) this.load.image(k, `assets/backgrounds/${k}.webp`);
    AudioMan.queueLoader(this.load);
    // progress bar
    const { width, height } = this.scale;
    const bar = this.add.rectangle(width / 2, height / 2, 300, 18, 0xd98e4a);
    this.load.on('progress', (p: number) => bar.setScale(p, 1));
  }

  create(): void {
    for (const [group, pages] of ATLAS_PAGES)
      for (let i = 0; i < pages; i++) {
        const key = `atlas-${group}-${i}`;
        registerAtlasFrames(key, this.cache.json.get(key) as Record<string, unknown>);
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
