// In-game DEBUG PANEL (v1.1) — the user's own diagnostic tool.
// REMOVAL: set DEBUG=false below and this file becomes a no-op (safe to
// leave). To delete the file entirely, also remove the one-line
// attachDebug(this) call in each scene (Title/Board/Grove/Atlas/Wings).
import Phaser from 'phaser';
import { data, state } from './ctx.js';
import { saveGame, wipeSave } from './save.js';
import { button, F_BODY, F_NUM, F_UI, panel, titleText } from './ui.js';

export const DEBUG = true;

const errors: string[] = [];
let hooked = false;

function stamp(): string {
  return new Date().toISOString().slice(11, 19);
}
function pushErr(msg: string): void {
  errors.push(`[${stamp()}] ${msg.slice(0, 120)}`);
  if (errors.length > 20) errors.shift();
}
/** Log a message into the debug panel's error log. */
export function debugLog(msg: string): void {
  pushErr(`LOG ${msg}`);
}

function hookErrors(): void {
  if (hooked) return;
  hooked = true;
  window.addEventListener('error', (e) => pushErr(`ERR ${(e as ErrorEvent).message || 'unknown'}`));
  window.addEventListener('unhandledrejection', (e) =>
    pushErr(`REJ ${String((e as PromiseRejectionEvent).reason).slice(0, 80)}`));
}

/** Mount the floating gear button. Call once per scene create(). */
export function attachDebug(scene: Phaser.Scene): void {
  if (!DEBUG) return;
  hookErrors();
  const w = scene.scale.width;
  const gear = scene.add.text(w - 32, 32, '⚙', {
    fontSize: '38px', color: '#F5E6C8',
    shadow: { offsetX: 0, offsetY: 2, color: '#000', blur: 6, fill: true },
  }).setOrigin(0.5).setDepth(500);
  gear.setInteractive(new Phaser.Geom.Rectangle(-26, -26, 52, 52),
    Phaser.Geom.Rectangle.Contains);
  if (gear.input) gear.input.cursor = 'pointer';
  gear.on('pointerup', () => openPanel(scene));
}

function openPanel(scene: Phaser.Scene): void {
  const w = scene.scale.width, h = scene.scale.height, cx = w / 2;
  const root = scene.add.container(0, 0).setDepth(600);
  const dim = scene.add.rectangle(0, 0, w, h, 0x0a0812, 0.72).setOrigin(0);
  dim.setInteractive();
  const pw = Math.min(384, w - 20), ph = 640;
  const p = panel(scene, pw, ph, true);
  p.setPosition(cx, h / 2);
  titleText(scene, cx, h / 2 - ph / 2 + 44, 'DEBUG', 34, '#B9A7E6');

  const s = state();
  const lines = [
    `fps: ${Math.round(scene.game.loop.actualFps)}`,
    `scene: ${scene.scene.key}`,
    `tutorialStep: ${s.tutorialStep}`,
    `moondew: ${Math.floor(s.currencies.moondew)}`,
    `stardust: ${s.currencies.stardust}  renown: ${s.currencies.renown}`,
    `board plants: ${s.board.filter((c) => c !== null).length}/25`,
    `wishes done: ${s.wishDeckIndex}`,
    `build: v1.1`,
  ];
  const info = scene.add.text(cx - pw / 2 + 28, h / 2 - ph / 2 + 84, lines, {
    fontFamily: F_NUM, fontSize: '21px', color: '#F5E6C8', lineSpacing: 6,
  }).setOrigin(0, 0);
  const errTitle = scene.add.text(cx - pw / 2 + 28, h / 2 - ph / 2 + 300, 'error log:', {
    fontFamily: F_UI, fontSize: '22px', color: '#E8A87C', fontStyle: '800',
  }).setOrigin(0, 0);
  const errText = scene.add.text(cx - pw / 2 + 28, h / 2 - ph / 2 + 330,
    errors.length ? errors.slice(-8).join('\n') : '(no errors logged)', {
    fontFamily: F_BODY, fontSize: '17px', color: '#B9A7E6',
    wordWrap: { width: pw - 56 }, lineSpacing: 4,
  }).setOrigin(0, 0);
  root.add([dim, p, info, errTitle, errText]);

  const mkBtn = (label: string, y: number, cb: () => void) => {
    const b = button(scene, label, cb, { w: 300, h: 72, fontSize: 26 });
    b.setPosition(cx, y);
    root.add(b);
  };
  const note = scene.add.text(cx, h / 2 + ph / 2 - 150, '', {
    fontFamily: F_BODY, fontSize: '18px', color: '#7FB069',
  }).setOrigin(0.5);
  root.add(note);

  mkBtn('Copy state JSON', h / 2 + ph / 2 - 210, () => {
    const json = JSON.stringify(s);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(json)
        .then(() => note.setText('copied ✓'))
        .catch(() => note.setText('copy failed'));
    } else note.setText('clipboard unavailable');
  });
  mkBtn('Skip tutorial', h / 2 + ph / 2 - 126, () => {
    try {
      s.tutorialStep = 7;
      saveGame(s);
      note.setText('tutorial skipped');
      scene.time.delayedCall(400, () => scene.scene.restart());
    } catch (e) { pushErr(`skip failed: ${String(e)}`); note.setText('skip failed'); }
  });
  mkBtn('Reset save', h / 2 + ph / 2 - 42, () => {
    try { wipeSave(); } catch { /* noop */ }
    window.location.reload();
  });
  mkBtn('Close', h / 2 + ph / 2 + 42, () => root.destroy());
  dim.on('pointerup', () => root.destroy());
}
