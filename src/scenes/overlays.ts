// Overlay panels: wish board, fanfare, away popup, settings, plant info, tutorial.
import Phaser from 'phaser';
import { audio, data, lay, state } from '../ctx.js';
import { activeWishes, applyCommand, blessingMult, offerValue } from '../sim.js';
import { blessingFor, plantById, WishDef } from '../data.js';
import { saveGame, wipeSave } from '../save.js';
import { button, dimmer, F_BODY, F_DISPLAY, F_NUM, F_UI, iconButton, img,
         levelPips, namePill, panel, squareBtn, titleText, fmt } from '../ui.js';
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

/** Wish board overlay — mockup contract: parchment panel, wooden sign header,
 *  spirit portrait medallions, amber name pills, required strip, rewards + claim.
 *  Cards scroll inside the fixed panel. */
export function openWishBoard(scene: Phaser.Scene, onClaimed: Refresh): void {
  const { w: sw, h, cx } = lay(scene);
  const d = data(), s = state();
  const wishes = activeWishes(d, s);
  const pw = Math.min(424, sw - 20), ph = Math.min(865, h * 0.94);
  const { root, close } = shell(scene, pw, ph);
  const topY = h / 2 - ph / 2;

  // header: wooden sign + subtitle
  const ribbon = img(scene, 'ribbon-banner.png');
  ribbon.setDisplaySize(300, 300 * (239 / 629)).setPosition(cx, topY + 62);
  const rTitle = scene.add.text(cx, topY + 58, 'WISH BOARD', {
    fontFamily: F_DISPLAY, fontSize: '34px', color: '#F5E6C8', fontStyle: '700',
  }).setOrigin(0.5);
  const sub = scene.add.text(cx, topY + 128,
    `Active Wishes • ${wishes.length}/3`, {
    fontFamily: F_BODY, fontSize: '21px', color: '#6b5a48',
  }).setOrigin(0.5);
  // gear next to the close X (mockup has both)
  const gear = squareBtn(scene, 'icon-gear.png', 52, () => {
    audio().play('click');
    openSettings(scene, () => undefined);
  });
  gear.setPosition(cx + pw / 2 - 108, topY + 44);
  root.add([ribbon, rTitle, sub, gear]);

  // scrollable cards
  const viewY = topY + 162, viewH = ph - 162 - 52;
  const content = scene.add.container(cx, viewY);
  const cw = Math.min(360, pw - 40);
  const cardH = 250, gap = 12;
  let cy = cardH / 2;
  wishes.forEach((w: WishDef, slot: number) => {
    const card = scene.add.container(0, cy);
    const left = -cw / 2;
    const bg = panel(scene, cw, cardH);
    card.add(bg);
    // spirit medallion: gold ring + art
    const ring = scene.add.graphics();
    ring.lineStyle(5, 0xd98e4a, 1);
    ring.strokeCircle(left + 64, -24, 48);
    ring.lineStyle(2, 0xf5e6c8, 0.7);
    ring.strokeCircle(left + 64, -24, 42);
    const spDef = d.spirits.find((x) => x.id === w.spirit);
    const art = spDef ? img(scene, spDef.art).setDisplaySize(80, 80) : undefined;
    if (art) art.setPosition(left + 64, -24);
    card.add(art ? [ring, art] : [ring]);
    // name pill
    const np = namePill(scene, w.spirit.replace(/-/g, ' '), 21);
    np.setPosition(left + 128 + np.width / 2, -98);
    card.add(np);
    // quest text — measured at runtime; strip/rewards flow below it
    const tx = scene.add.text(left + 128, -70, w.text, {
      fontFamily: F_BODY, fontSize: '20px', color: '#5a4a3a',
      wordWrap: { width: cw - 156 },
    }).setOrigin(0, 0);
    // shrink worst-case long texts so strip+rewards stay inside the card
    let fs = 20;
    while (fs > 14 && (-70 + tx.height + 116) > 96) { fs -= 1; tx.setFontSize(fs); }
    card.add(tx);
    const stripY = -70 + tx.height + 14 + 25;
    // required strip
    const strip = scene.add.graphics();
    strip.fillStyle(0xe4d3ac, 1);
    strip.fillRoundedRect(left + 128, stripY - 25, cw - 140, 50, 12);
    const rq = scene.add.text(left + 138, stripY, 'Required:', {
      fontFamily: F_UI, fontSize: '17px', color: '#6b5a48', fontStyle: '800',
    }).setOrigin(0, 0.5);
    card.add([strip, rq]);
    let ix = left + 218;
    for (const r of w.requires) {
      const t = plantById(d, r.plant);
      const ic = img(scene, t.art).setDisplaySize(36, 36).setPosition(ix, stripY);
      const ct = scene.add.text(ix + 20, stripY, `×${r.count}`, {
        fontFamily: F_NUM, fontSize: '19px', color: '#3A2410', fontStyle: '700',
      }).setOrigin(0, 0.5);
      card.add([ic, ct]);
      ix += 62;
    }
    // rewards + claim
    const rwY = stripY + 25 + 14 + 20;
    const mI = img(scene, 'icon-moondew.png').setDisplaySize(24, 24)
      .setPosition(left + 140, rwY);
    const mT = scene.add.text(left + 156, rwY, `×${fmt(w.rewards.moondew)}`, {
      fontFamily: F_NUM, fontSize: '20px', color: '#3A2410', fontStyle: '700',
    }).setOrigin(0, 0.5);
    const sI = img(scene, 'icon-stardust.png').setDisplaySize(24, 24)
      .setPosition(left + 204, rwY);
    const sT = scene.add.text(left + 220, rwY, `×${w.rewards.stardust}`, {
      fontFamily: F_NUM, fontSize: '20px', color: '#3A2410', fontStyle: '700',
    }).setOrigin(0, 0.5);
    card.add([mI, mT, sI, sT]);
    const claim = button(scene, 'CLAIM', () => {
      if (scene.time.now - lastScrollT < 300) return; // was a scroll-drag
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
    }, { w: 100, h: 56, fontSize: 24, fireOnDown: true });
    claim.setPosition(left + cw - 58, rwY);
    card.add(claim);
    content.add(card);
    cy += cardH + gap;
  });
  const gridH = cy;
  const maskShape = scene.add.rectangle(cx, viewY + viewH / 2, pw, viewH, 0xffffff)
    .setVisible(false);
  content.setMask(maskShape.createGeometryMask());
  let dragging = false, lastY = 0, offY = 0, downY = 0;
  let lastScrollT = -9999;
  const maxOff = Math.max(0, gridH - viewH + 20);
  scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
    if (p.y > viewY && p.y < viewY + viewH) { dragging = true; lastY = p.y; downY = p.y; }
  });
  scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
    if (!dragging || !p.isDown) return;
    offY = Phaser.Math.Clamp(offY + (p.y - lastY), -maxOff, 0);
    lastY = p.y;
    content.setY(viewY + offY);
  });
  scene.input.on('pointerup', (p: Phaser.Input.Pointer) => {
    if (dragging && Math.abs(p.y - downY) > 14) lastScrollT = scene.time.now;
    dragging = false;
  });
  root.add(content);

  // footer (mockup)
  const foot = scene.add.text(cx, topY + ph - 26, '• Quests refresh at dawn •', {
    fontFamily: F_BODY, fontSize: '20px', color: '#6b5a48',
  }).setOrigin(0.5);
  root.add(foot);
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
