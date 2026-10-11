// Overlay panels: wish board, fanfare, away popup, settings, plant info, tutorial.
import Phaser from 'phaser';
import { audio, data, lay, state } from '../ctx.js';
import { activeWishes, applyCommand, blessingMult, offerValue } from '../sim.js';
import { blessingFor, plantById, WishDef } from '../data.js';
import { saveGame, wipeSave } from '../save.js';
import { button, dimmer, F_BODY, F_DISPLAY, F_NUM, F_UI, iconButton, img,
         levelPips, panel, titleText, fmt } from '../ui.js';
import { debugLog } from '../debug.js';

export type Refresh = () => void;

function shell(scene: Phaser.Scene, w: number, h: number, dark = false):
    { root: Phaser.GameObjects.Container; close: () => void } {
  const { w: sw, h: sh, cx } = lay(scene);
  // Clamp to the design canvas: popups can never overflow a 420px phone.
  const pw = Math.min(w, sw - 20), ph = Math.min(h, sh * 0.94);
  const root = scene.add.container(0, 0).setDepth(100);
  const dim = dimmer(scene, 0.62);
  const p = panel(scene, pw, ph, dark);
  p.setPosition(cx, sh / 2);
  const x = iconButton(scene, 'icon-gear.png', 64, () => close());
  // repurpose gear as close X via text overlay
  const xl = scene.add.text(0, 0, '✕', {
    fontFamily: F_UI, fontSize: '34px', color: '#F5E6C8', fontStyle: '800',
  }).setOrigin(0.5);
  x.add(xl);
  x.setPosition(cx + pw / 2 - 44, sh / 2 - ph / 2 + 44);
  root.add([dim, p, x]);
  dim.setInteractive().on('pointerup', () => close());
  function close(): void { root.destroy(); }
  return { root, close };
}

function spiritArt(scene: Phaser.Scene, spiritId: string, size: number):
    Phaser.GameObjects.Container {
  const d = data();
  const sp = d.spirits.find((s) => s.id === spiritId);
  const c = scene.add.container(0, 0);
  const frame = img(scene, 'frame-spirit-card.png').setDisplaySize(size, size);
  const art = sp ? img(scene, sp.art).setDisplaySize(size * 0.72, size * 0.72) : undefined;
  c.add(art ? [frame, art] : [frame]);
  return c;
}

/** Wish board overlay. onClaimed refreshes the parent scene.
 * Compact cards sized for the 420px design canvas — nothing overflows. */
export function openWishBoard(scene: Phaser.Scene, onClaimed: Refresh): void {
  const { w: sw, h, cx } = lay(scene);
  const d = data(), s = state();
  const wishes = activeWishes(d, s);
  const cw = Math.min(560, sw - 56);
  const cardH = 220, gap = 8;
  const ph = 116 + 3 * (cardH + gap) + 20;
  const { root, close } = shell(scene, cw + 60, ph);
  const phC = Math.min(ph, h * 0.94);
  const topY = h / 2 - phC / 2;

  titleText(scene, cx, topY + 50, 'WISH BOARD', 38);
  const bless = blessingFor(d, s.dayIndex);
  const blessIcon = img(scene, bless.icon).setDisplaySize(46, 46);
  blessIcon.setPosition(cx - cw / 2 + 26, topY + 94);
  const blessT = scene.add.text(cx - cw / 2 + 56, topY + 94, `✦ ${bless.name}`, {
    fontFamily: F_BODY, fontSize: '21px', color: '#B9A7E6',
  }).setOrigin(0, 0.5);
  root.add([blessT, blessIcon]);

  wishes.forEach((w: WishDef, slot: number) => {
    const y = topY + 116 + cardH / 2 + slot * (cardH + gap);
    const left = cx - cw / 2;
    const card = panel(scene, cw, cardH);
    card.setPosition(cx, y);
    const sp = spiritArt(scene, w.spirit, 62);
    sp.setPosition(left + 42, y - 66);
    const nm = scene.add.text(left + 82, y - 66, w.spirit.replace(/-/g, ' '), {
      fontFamily: F_UI, fontSize: '23px', color: '#3A2410', fontStyle: '800',
    }).setOrigin(0, 0.5);
    const tx = scene.add.text(left + 22, y - 28, w.text, {
      fontFamily: F_BODY, fontSize: '20px', color: '#5a4a3a',
      wordWrap: { width: cw - 44 },
    }).setOrigin(0, 0);
    // requirements
    let rx = left + 46;
    for (const r of w.requires) {
      const t = plantById(d, r.plant);
      const ic = img(scene, t.art).setDisplaySize(46, 46).setPosition(rx, y + 58);
      const ct = scene.add.text(rx, y + 88, `×${r.count}`, {
        fontFamily: F_NUM, fontSize: '22px', color: '#3A2410', fontStyle: '700',
      }).setOrigin(0.5);
      root.add([ic, ct]);
      rx += 68;
    }
    const rw = scene.add.text(rx + 6, y + 58,
      `❖${fmt(w.rewards.moondew)} ✦${w.rewards.stardust} ★${w.rewards.renown}` +
      (w.cutting ? ' 🌱' : ''), {
      fontFamily: F_NUM, fontSize: '20px', color: '#7a5a20', fontStyle: '700',
    }).setOrigin(0, 0.5);
    const claim = button(scene, 'Grant', () => {
      const ev = applyCommand(d, s, { type: 'claimWish', slot, now: Date.now() });
      const denied = ev.find((e) => e.type === 'denied');
      if (denied && denied.type === 'denied') {
        audio().play('error');
        scene.tweens.add({ targets: card, x: '+=10', duration: 60, yoyo: true, repeat: 3 });
      } else {
        audio().play('wish');
        audio().mergeChime(4);
        saveGame(s);
        close();
        fanfare(scene, [
          { icon: 'icon-moondew.png', label: `+${fmt(w.rewards.moondew)} Moondew` },
          { icon: 'icon-stardust.png', label: `+${w.rewards.stardust} Stardust` },
          { icon: 'icon-renown.png', label: `+${w.rewards.renown} Renown` },
        ], onClaimed);
      }
    }, { w: 128, h: 58, fontSize: 25, fireOnDown: true });
    claim.setPosition(left + cw - 74, y - 66);
    root.add([card, sp, nm, tx, rw, claim]);
  });
}

/** Generic reward fanfare. */
export function fanfare(scene: Phaser.Scene,
                        items: { icon: string; label: string }[],
                        done: Refresh): void {
  const { w: sw, h, cx } = lay(scene);
  const pw = Math.min(560, sw - 20);
  const { root, close } = shell(scene, pw, 420 + items.length * 10);
  titleText(scene, cx, h / 2 - 170, '✦ REWARD ✦', 44);
  items.forEach((it, i) => {
    const y = h / 2 - 70 + i * 76;
    const ic = img(scene, it.icon).setDisplaySize(56, 56).setPosition(cx - pw / 2 + 52, y);
    const lb = scene.add.text(cx - pw / 2 + 90, y, it.label, {
      fontFamily: F_UI, fontSize: '28px', color: '#3A2410', fontStyle: '800',
    }).setOrigin(0, 0.5);
    root.add([ic, lb]);
  });
  const b = button(scene, 'Lovely!', () => { audio().play('click'); close(); done(); },
    { w: 260, h: 90, fontSize: 34, fireOnDown: true });
  b.setPosition(cx, h / 2 + 150);
  root.add(b);
  root.setScale(0.7).setAlpha(0);
  scene.tweens.add({ targets: root, scale: 1, alpha: 1, duration: 320,
                     ease: 'Back.easeOut' });
}

/** "While you were away" popup. */
export function awayPopup(scene: Phaser.Scene, amount: number, done: Refresh): void {
  const { h, cx } = lay(scene);
  const { root, close } = shell(scene, 560, 520);
  const moon = img(scene, 'icon-sleeping-moon.png').setDisplaySize(130, 130);
  moon.setPosition(cx, h / 2 - 160);
  titleText(scene, cx, h / 2 - 60, 'While you were away…', 40);
  const lb = scene.add.text(cx, h / 2 + 10,
    `Your grove gathered\n+${fmt(amount)} Moondew`, {
    fontFamily: F_UI, fontSize: '34px', color: '#3A2410', fontStyle: '800',
    align: 'center', lineSpacing: 8,
  }).setOrigin(0.5);
  const b = button(scene, 'Collect', () => { audio().play('collect'); close(); done(); },
    { w: 300, h: 96, fontSize: 36 });
  b.setPosition(cx, h / 2 + 170);
  root.add([moon, lb, b]);
}

/** Settings overlay: toggles, share, new game. */
export function openSettings(scene: Phaser.Scene, onShare: Refresh): void {
  const { w: sw, h, cx } = lay(scene);
  const s = state(), d = data();
  const pw = Math.min(560, sw - 20);
  const { root, close } = shell(scene, pw, 640, true);
  void d;
  titleText(scene, cx, h / 2 - 240, 'SETTINGS', 42);
  const mk = (y: number, label: string, get: () => boolean, tog: () => boolean) => {
    const t = scene.add.text(cx - pw / 2 + 28, y, label, {
      fontFamily: F_UI, fontSize: '28px', color: '#F5E6C8', fontStyle: '800',
    }).setOrigin(0, 0.5);
    const b = button(scene, get() ? 'ON' : 'OFF', () => {
      audio().play('click');
      (b.list[1] as Phaser.GameObjects.Text).setText(tog() ? 'ON' : 'OFF');
    }, { w: 140, h: 68, fontSize: 26, fireOnDown: true });
    b.setPosition(cx + pw / 2 - 28 - 70, y);
    root.add([t, b]);
  };
  mk(h / 2 - 150, 'Music', () => audio().musicEnabled, () => audio().toggleMusic());
  mk(h / 2 - 60, 'Sound', () => audio().sfxEnabled, () => audio().toggleSfx());
  const btnW = Math.min(380, pw - 48);
  const share = button(scene, '☁ Share Grove', () => {
    const today = Math.floor(Date.now() / 86400000);
    if (s.shareDay !== today) {
      s.shareDay = today;
      s.currencies.moondew += 1000;
      const empty = s.board.findIndex((c) => c === null);
      if (empty >= 0) {
        const next = s.discovered.length > 0 ? 'sylvani_t2' : 'sylvani_t1';
        s.board[empty] = { kind: 'plant', plant: next };
      }
      saveGame(s);
      audio().play('wish');
    }
    const url = 'https://huzaifach.github.io/bloomverse-twilight/';
    const text = 'My Twilight Haven grove is blooming! 🌙';
    if (navigator.share) navigator.share({ title: 'Twilight Haven', text, url }).catch(() => undefined);
    else if (navigator.clipboard) navigator.clipboard.writeText(`${text} ${url}`).catch(() => undefined);
    onShare();
  }, { w: btnW, h: 88, fontSize: 32, fireOnDown: true });
  share.setPosition(cx, h / 2 + 60);
  const wipe = button(scene, 'New Game', () => {
    wipeSave();
    window.location.reload();
  }, { w: btnW, h: 88, fontSize: 32, fireOnDown: true });
  wipe.setPosition(cx, h / 2 + 170);
  const ver = scene.add.text(cx, h / 2 + 250, 'Twilight Haven v1.0 · cozy build', {
    fontFamily: F_BODY, fontSize: '20px', color: '#B9A7E6',
  }).setOrigin(0.5);
  root.add([share, wipe, ver]);
}

/** Plant info popup (long-press). Buttons stack vertically — no overflow. */
export function plantInfo(scene: Phaser.Scene, plantId: string,
                        cell?: number, onOffered?: Refresh): void {
  const { w: sw, h, cx } = lay(scene);
  const d = data(), s = state();
  const t = plantById(d, plantId);
  const pw = Math.min(520, sw - 20);
  const { root, close } = shell(scene, pw, 600);
  const art = img(scene, t.art).setDisplaySize(180, 180).setPosition(cx, h / 2 - 150);
  titleText(scene, cx, h / 2 - 20, t.name, 34);
  const sub = scene.add.text(cx, h / 2 + 28,
    `Tier ${t.tier} · wish value ${fmt(t.wishValue)}` +
    (t.moondewPerHour > 0 ? `\nGrove: ${t.moondewPerHour}/hr` : ''), {
    fontFamily: F_BODY, fontSize: '25px', color: '#5a4a3a', align: 'center',
  }).setOrigin(0.5);
  root.add([art, sub]);
  if (cell !== undefined && onOffered) {
    const val = offerValue(d, s, plantId);
    const offer = button(scene, `Offer +${fmt(val)} ☾`, () => {
      const ev = applyCommand(d, s, { type: 'offer', cell, now: Date.now() });
      if (ev.some((e) => e.type === 'offered')) {
        audio().play('collect');
        saveGame(s);
        close();
        onOffered();
      } else audio().play('error');
    }, { w: Math.min(300, pw - 48), h: 84, fontSize: 30, fireOnDown: true });
    offer.setPosition(cx, h / 2 + 125);
    const b = button(scene, 'Close', () => { audio().play('click'); close(); },
      { w: 220, h: 80, fontSize: 30, fireOnDown: true });
    b.setPosition(cx, h / 2 + 220);
    root.add([offer, b]);
  } else {
    const b = button(scene, 'Close', () => { audio().play('click'); close(); },
      { w: 220, h: 80, fontSize: 30, fireOnDown: true });
    b.setPosition(cx, h / 2 + 170);
    root.add(b);
  }
}

const TUTORIAL: { title: string; body: string }[] = [
  { title: 'Welcome, Star Gardener',
    body: 'This conservatory has withered. Tap Got it below, then tap the glowing Wish Pod to sprout a Star Sprout.' },
  { title: 'Merge to grow',
    body: 'Drag a sprout onto its twin to merge them into a stronger plant.' },
  { title: 'Restore the dark',
    body: 'Merging beside withered tiles restores them — dark turns to warm.' },
  { title: 'Spirits await',
    body: 'Open the Wish Board. Forest spirits leave wishes for specific plants.' },
  { title: 'Grant wishes',
    body: 'Grant a wish to earn Moondew, Stardust and Renown.' },
  { title: 'The Moonwell Grove',
    body: 'Transplant Tier 4+ plants to the grove — they earn Moondew even while you rest.' },
  { title: 'You are ready',
    body: 'Restore every tile. The Haven is yours, Gardener. 🌙' },
];

/** Skip the whole tutorial from any step. Never throws. */
function skipTutorial(scene: Phaser.Scene): void {
  try {
    const s = state();
    s.tutorialStep = TUTORIAL.length;
    saveGame(s);
  } catch (e) { debugLog(`skip save failed: ${String(e)}`); }
  try { scene.scene.restart(); }
  catch { window.location.reload(); }
}

/**
 * Tutorial coach-mark. The panel is sized to its CONTENT (measured text),
 * so nothing clips on a 420px canvas. Advancing is bulletproof: the button
 * fires on pointerdown with an explicit hit-area, the advance chain is
 * try/catch-wrapped with a force-advance fallback, and a Skip button exists
 * on every step — no soft-lock is possible.
 */
export function tutorialStep(scene: Phaser.Scene, step: number, done: Refresh): void {
  const t = TUTORIAL[step];
  if (!t) { done(); return; }
  const { w, h, cx } = lay(scene);
  const root = scene.add.container(0, 0).setDepth(200);
  const dim = dimmer(scene, 0.55);

  // Measure text first, then size the panel around it.
  const pw = Math.min(360, w - 40);
  const wrapW = pw - 76;
  const titleT = scene.add.text(0, 0, t.title, {
    fontFamily: F_UI, fontSize: '30px', color: '#3A2410', fontStyle: '800',
    align: 'center', wordWrap: { width: wrapW },
  }).setOrigin(0.5, 0);
  const bodyT = scene.add.text(0, 0, t.body, {
    fontFamily: F_BODY, fontSize: '24px', color: '#5a4a3a', align: 'center',
    wordWrap: { width: wrapW }, lineSpacing: 6,
  }).setOrigin(0.5, 0);
  const pad = 26, gap1 = 14, gap2 = 22, gap3 = 12, btnH = 96, countH = 26;
  const ph = pad + titleT.height + gap1 + bodyT.height + gap2 + btnH + gap3 + countH + pad;
  const cy = Math.min(h * 0.42, h - ph / 2 - 20);
  const topY = cy - ph / 2;
  const p = panel(scene, pw, ph);
  p.setPosition(cx, cy);
  titleT.setPosition(cx, topY + pad);
  bodyT.setPosition(cx, topY + pad + titleT.height + gap1);

  let advanced = false;
  const advance = (): void => {
    if (advanced) return;
    advanced = true;
    try { scene.tweens.killTweensOf(hand); } catch { /* noop */ }
    try { audio().play('click'); } catch (e) { debugLog(`tut audio: ${String(e)}`); }
    try { root.destroy(true); } catch (e) { debugLog(`tut destroy: ${String(e)}`); }
    try { done(); } catch (e) {
      debugLog(`tut done FAILED: ${String(e)} — force advancing`);
      skipTutorial(scene);
    }
  };

  const btnY = topY + pad + titleT.height + gap1 + bodyT.height + gap2 + btnH / 2;
  const b = button(scene, step === TUTORIAL.length - 1 ? 'Begin!' : 'Got it',
    advance, { w: 280, h: btnH, fontSize: 32, fireOnDown: true });
  b.setPosition(cx, btnY);
  const n = scene.add.text(cx, btnY + btnH / 2 + gap3, `${step + 1} of ${TUTORIAL.length}`, {
    fontFamily: F_NUM, fontSize: '24px', color: '#B9A7E6', fontStyle: '700',
  }).setOrigin(0.5, 0);

  const skip = scene.add.text(cx + pw / 2 - 14, topY + 12, 'Skip ≫', {
    fontFamily: F_UI, fontSize: '22px', color: '#8a7bb8', fontStyle: '800',
  }).setOrigin(1, 0);
  skip.setInteractive(new Phaser.Geom.Rectangle(-80, -12, 104, 48),
    Phaser.Geom.Rectangle.Contains);
  if (skip.input) skip.input.cursor = 'pointer';
  skip.on('pointerup', () => { try { root.destroy(true); } catch { /* noop */ } skipTutorial(scene); });

  const hand = img(scene, 'coach-hand.png').setDisplaySize(104, 118);
  hand.setPosition(cx + pw / 2 - 46, btnY + btnH / 2 + 66);
  scene.tweens.add({ targets: hand, y: '-=20', duration: 600, yoyo: true, repeat: -1 });

  root.add([dim, p, titleT, bodyT, b, n, skip, hand]);
}
