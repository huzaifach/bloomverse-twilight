// UI kit: panels, buttons, pills, counters from packed atlases + fonts.
import Phaser from 'phaser';
import { PALETTE } from './config.js';

export const F_DISPLAY = 'CinzelDecorative';
export const F_UI = 'Baloo2';
export const F_BODY = 'Nunito';
export const F_NUM = 'Fredoka';

/** frame basename -> atlas texture key (built in BootScene). */
const frameAtlas: Record<string, string> = {};
export function registerAtlasFrames(atlasKey: string, frames: Record<string, unknown>): void {
  if (!frames || typeof frames !== 'object')
    throw new Error(`atlas frames missing for ${atlasKey} (boot would stall)`);
  for (const f of Object.keys(frames)) frameAtlas[f] = atlasKey;
}
function tex(frame: string): [string, string] {
  const a = frameAtlas[frame];
  if (!a) throw new Error(`frame not registered: ${frame}`);
  return [a, frame];
}
/** Atlas texture key holding a frame. */
export function atlasFor(frame: string): string {
  const [t] = tex(frame);
  return t;
}
export function img(scene: Phaser.Scene, frame: string, x = 0, y = 0): Phaser.GameObjects.Image {
  const [t, f] = tex(frame);
  return scene.add.image(x, y, t, f);
}

export function fmt(n: number): string {
  if (n < 1000) return String(Math.floor(n));
  if (n < 1_000_000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return (n / 1_000_000).toFixed(2).replace(/\.00$/, '') + 'M';
}

/** Nine-sliced panel from atlas-ui frames. */
export function panel(scene: Phaser.Scene, w: number, h: number,                      dark = false, corner = 56): Phaser.GameObjects.NineSlice {
  const [t, f] = tex(dark ? 'panel-umbral.png' : 'panel-parchment.png');
  return scene.add.nineslice(0, 0, t, f, w, h, corner, corner, corner, corner);
}

export interface ButtonOpts {
  w?: number; h?: number; fontSize?: number;
  font?: string; color?: string;
}

/** Chunky amber button with press squash.
 * Uses an EXPLICIT hit-area (NineSlice auto hit-areas are unreliable) and
 * fires on pointerup; pass fireOnDown for instant response (tutorial). */
export function button(scene: Phaser.Scene, label: string,
                       cb: () => void, o: ButtonOpts & { fireOnDown?: boolean } = {}): Phaser.GameObjects.Container {
  const w = o.w ?? 280, h = o.h ?? 96;
  const c = scene.add.container(0, 0);
  const [t, f] = tex('button-amber.png');
  const bg = scene.add.nineslice(0, 0, t, f, w, h, 40, 40, 40, 40);
  const txt = scene.add.text(0, -2, label, {
    fontFamily: o.font ?? F_UI, fontSize: `${o.fontSize ?? 34}px`,
    color: o.color ?? '#3A2410', fontStyle: '800',
  }).setOrigin(0.5);
  c.add([bg, txt]);
  const fire = (): void => { c.setScale(1); cb(); };
  bg.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
    Phaser.Geom.Rectangle.Contains);
  if (bg.input) bg.input.cursor = 'pointer';
  bg.on('pointerdown', () => { c.setScale(0.94); if (o.fireOnDown) fire(); });
  bg.on('pointerup', () => { if (!o.fireOnDown) fire(); else c.setScale(1); });
  bg.on('pointerout', () => c.setScale(1));
  return c;
}

export function iconButton(scene: Phaser.Scene, icon: string, size: number,
                           cb: () => void): Phaser.GameObjects.Container {
  const c = scene.add.container(0, 0);
  const [t, f] = tex('button-amber.png');
  const bg = scene.add.nineslice(0, 0, t, f, size, size, 30, 30, 30, 30);
  const ic = img(scene, icon).setDisplaySize(size * 0.55, size * 0.55);
  c.add([bg, ic]);
  bg.setInteractive(new Phaser.Geom.Rectangle(-size / 2, -size / 2, size, size),
    Phaser.Geom.Rectangle.Contains);
  if (bg.input) bg.input.cursor = 'pointer';
  bg.on('pointerdown', () => c.setScale(0.9));
  bg.on('pointerup', () => { c.setScale(1); cb(); });
  bg.on('pointerout', () => c.setScale(1));
  return c;
}

/** Pill counter: icon + number, updates only when changed. */
export class Pill extends Phaser.GameObjects.Container {
  private label: Phaser.GameObjects.Text;
  private lastText = '';
  constructor(scene: Phaser.Scene, icon: string, w = 200) {
    super(scene, 0, 0);
    const [t, f] = tex('pill-label.png');
    const bg = scene.add.nineslice(0, 0, t, f, w, 64, 28, 28, 28, 28);
    const ic = img(scene, icon).setDisplaySize(40, 40);
    ic.setPosition(-w / 2 + 36, 0);
    this.label = scene.add.text(8, 0, '0', {
      fontFamily: F_NUM, fontSize: '30px', color: '#3A2410', fontStyle: '700',
    }).setOrigin(0, 0.5);
    this.add([bg, ic, this.label]);
    scene.add.existing(this);
  }
  setValue(n: number): void {
    const s = fmt(n);
    if (s !== this.lastText) { this.lastText = s; this.label.setText(s); }
  }
}

export function dimmer(scene: Phaser.Scene, alpha = 0.6): Phaser.GameObjects.Rectangle {
  const { width, height } = scene.scale;
  return scene.add.rectangle(0, 0, width, height, 0x0a0812, alpha).setOrigin(0);
}

export function titleText(scene: Phaser.Scene, x: number, y: number, s: string,
                          size: number, color: string = PALETTE.css.parchment): Phaser.GameObjects.Text {
  return scene.add.text(x, y, s, {
    fontFamily: F_DISPLAY, fontSize: `${size}px`, color, fontStyle: '900',
  }).setOrigin(0.5);
}

export function levelPips(scene: Phaser.Scene, x: number, y: number,
                          level: number, max: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  for (let i = 0; i < max; i++) {
    const dot = scene.add.circle(-((max - 1) * 22) / 2 + i * 22, 0, 9,
      i < level ? PALETTE.ember : 0x5a4a6a);
    if (i < level) dot.setStrokeStyle(2, 0xf5e6c8);
    c.add(dot);
  }
  return c;
}

/** Shared HUD: currency pills + settings. Returns update fn. */
export interface Hud {
  root: Phaser.GameObjects.Container;
  refresh: () => void;
}

/** Amber name pill (pill-amber nineslice) sized to its text. Mockup contract. */
export function namePill(scene: Phaser.Scene, text: string,
                         fontSize = 22): Phaser.GameObjects.Container {
  const c = scene.add.container(0, 0);
  const t = scene.add.text(0, 0, text, {
    fontFamily: F_UI, fontSize: `${fontSize}px`, color: '#3A2410', fontStyle: '800',
  }).setOrigin(0.5);
  const w = Math.max(96, t.width + 56), h = fontSize + 26;
  const [at, fr] = tex('pill-amber.png');
  const bg = scene.add.nineslice(0, 0, at, fr, w, h, 40, 40, 30, 30);
  c.add([bg, t]);
  c.setSize(w, h);
  return c;
}

/** Square amber button with an icon (mockup HUD buttons). */
export function squareBtn(scene: Phaser.Scene, icon: string, size: number,
                          cb: () => void): Phaser.GameObjects.Container {
  const c = scene.add.container(0, 0);
  const [at, fr] = tex('button-amber.png');
  const bg = scene.add.nineslice(0, 0, at, fr, size, size, 60, 60, 60, 60);
  const ic = img(scene, icon).setDisplaySize(size * 0.56, size * 0.56);
  c.add([bg, ic]);
  bg.setInteractive(new Phaser.Geom.Rectangle(-size / 2, -size / 2, size, size),
    Phaser.Geom.Rectangle.Contains);
  if (bg.input) bg.input.cursor = 'pointer';
  bg.on('pointerdown', () => {
    scene.tweens.add({ targets: c, scale: 0.92, duration: 70, yoyo: true });
    cb();
  });
  c.setSize(size, size);
  return c;
}

/** Rounded inset cell behind a HUD icon (mockup currency cells). */
export function insetCell(scene: Phaser.Scene, w: number, h: number,
                          color: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(color, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 18);
  g.lineStyle(3, 0xf5e6c8, 0.85);
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, 18);
  return g;
}

/** Small colored rate pill (+N/h) for grove pots. */
export function ratePill(scene: Phaser.Scene, text: string,
                         bg: number): Phaser.GameObjects.Container {
  const c = scene.add.container(0, 0);
  const t = scene.add.text(0, 0, text, {
    fontFamily: F_NUM, fontSize: '20px', color: '#241a10', fontStyle: '800',
  }).setOrigin(0.5);
  const w = Math.max(84, t.width + 32), h = 38;
  const r = scene.add.graphics();
  r.fillStyle(bg, 1);
  r.fillRoundedRect(-w / 2, -h / 2, w, h, 19);
  r.lineStyle(2, 0xffffff, 0.5);
  r.strokeRoundedRect(-w / 2, -h / 2, w, h, 19);
  c.add([r, t]);
  c.setSize(w, h);
  return c;
}
