// Shared mutable game context (set once by BootScene).
import { AudioMan } from './audio.js';
import { GameData } from './data.js';
import { GameState } from './sim.js';

export const ctx: {
  data: GameData | null;
  state: GameState | null;
  audio: AudioMan | null;
} = { data: null, state: null, audio: null };

export function data(): GameData {
  if (!ctx.data) throw new Error('data not loaded');
  return ctx.data;
}
export function state(): GameState {
  if (!ctx.state) throw new Error('state not loaded');
  return ctx.state;
}
export function audio(): AudioMan {
  if (!ctx.audio) throw new Error('audio not ready');
  return ctx.audio;
}

/** Responsive layout helpers (RESIZE mode, full-screen). */
export function lay(scene: Phaser.Scene): { w: number; h: number; cx: number } {
  const w = scene.scale.width, h = scene.scale.height;
  return { w, h, cx: w / 2 };
}

/** Cover-fit a background image to the screen. */
export function coverBg(scene: Phaser.Scene, key: string): Phaser.GameObjects.Image {
  const { w, h } = lay(scene);
  const bg = scene.add.image(w / 2, h / 2, key);
  const s = Math.max(w / bg.width, h / bg.height);
  bg.setScale(s).setDepth(-10);
  return bg;
}

/**
 * Queue a background for lazy loading in a scene's preload().
 * Backgrounds are NOT preloaded at boot (keeps initial load light);
 * each scene ensures its own art before create().
 */
export function needBg(scene: Phaser.Scene, key: string): void {
  if (!scene.textures.exists(key))
    scene.load.image(key, `assets/backgrounds/${key}.webp`);
}
