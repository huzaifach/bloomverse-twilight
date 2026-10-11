// Overlay panels: wish board, fanfare, away popup, settings, plant info, tutorial.
import Phaser from 'phaser';
import { audio, data, lay, state } from '../ctx.js';
import { activeWishes, applyCommand, blessingMult, offerValue } from '../sim.js';
import { blessingFor, plantById, WishDef } from '../data.js';
import { saveGame, wipeSave } from '../save.js';
import { button, dimmer, F_BODY, F_DISPLAY, F_NUM, F_UI, iconButton, img,
         levelPips, panel, titleText, fmt } from '../ui.js';

export type Refresh = () => void;

function shell(scene: Phaser.Scene, w: number, h: number, dark = false):
    { root: Phaser.GameObjects.Container; close: () => void } {
  const { w: sw, h: sh, cx } = lay(scene);
  const root = scene.add.container(0, 0).setDepth(100);
  const dim = dimmer(scene, 0.62);
  const p = panel(scene, w, h, dark);
  p.setPosition(cx, sh / 2);
  const x = iconButton(scene, 'icon-gear.png', 64, () => close());
  // repurpose gear as close X via text overlay
  const xl = scene.add.text(0, 0, '✕', {
    fontFamily: F_UI, fontSize: '34px', color: '#F5E6C8', fontStyle: '800',
  }).setOrigin(0.5);
  x.add(xl);
  x.setPosition(cx + w / 2 - 44, sh / 2 - h / 2 + 44);
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

/** Wish board overlay. onClaimed refreshes the parent scene. */
export function openWishBoard(scene: Phaser.Scene, onClaimed: Refresh): void {
  const { h, cx } = lay(scene);
  const d = data(), s = state();
  const wishes = activeWishes(d, s);
  const { root, close } = shell(scene, 640, Math.min(980, h * 0.86));
  titleText(scene, cx, h / 2 - Math.min(980, h * 0.86) / 2 + 64, 'WISH BOARD', 44);
  const bless = blessingFor(d, s.dayIndex);
  const blessT = scene.add.text(cx, h / 2 - Math.min(980, h * 0.86) / 2 + 108,
    `✦ ${bless.name}: ${bless.desc}`, {
      fontFamily: F_BODY, fontSize: '22px', color: '#B9A7E6',
    }).setOrigin(0.5);
  root.add(blessT);

  wishes.forEach((w: WishDef, slot: number) => {
    const y = h / 2 - 240 + slot * 290;
    const card = panel(scene, 580, 268);
    card.setPosition(cx, y);
    const sp = spiritArt(scene, w.spirit, 120);
    sp.setPosition(cx - 210, y - 40);
    const nm = scene.add.text(cx - 130, y - 118, w.spirit.replace(/-/g, ' '), {
      fontFamily: F_UI, fontSize: '28px', color: '#3A2410', fontStyle: '800',
    }).setOrigin(0, 0.5);
    const tx = scene.add.text(cx - 130, y - 78, w.text, {
      fontFamily: F_BODY, fontSize: '22px', color: '#5a4a3a',
      wordWrap: { width: 360 },
    }).setOrigin(0, 0.5);
    // requirements
    let rx = cx - 130;
    for (const r of w.requires) {
      const t = plantById(d, r.plant);
      const ic = img(scene, t.art).setDisplaySize(56, 56).setPosition(rx + 28, y + 10);
      const ct = scene.add.text(rx + 28, y + 44, `×${r.count}`, {
        fontFamily: F_NUM, fontSize: '24px', color: '#3A2410', fontStyle: '700',
      }).setOrigin(0.5);
      root.add([ic, ct]);
      rx += 84;
    }
    // rewards
    const rw = scene.add.text(cx - 130, y + 84,
      `❖ ${fmt(w.rewards.moondew)}   ✦ ${w.rewards.stardust}   ★ ${w.rewards.renown}` +
      (w.cutting ? '   🌱 cutting' : ''), {
      fontFamily: F_NUM, fontSize: '24px', color: '#7a5a20', fontStyle: '700',
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
    }, { w: 170, h: 76, fontSize: 30 });
    claim.setPosition(cx + 190, y + 84);
    root.add([card, sp, nm, tx, rw, claim]);
  });
}

/** Generic reward fanfare. */
export function fanfare(scene: Phaser.Scene,
                        items: { icon: string; label: string }[],
                        done: Refresh): void {
  const { h, cx } = lay(scene);
  const { root, close } = shell(scene, 560, 420 + items.length * 10);
  titleText(scene, cx, h / 2 - 170, '✦ REWARD ✦', 48);
  items.forEach((it, i) => {
    const y = h / 2 - 70 + i * 76;
    const ic = img(scene, it.icon).setDisplaySize(56, 56).setPosition(cx - 180, y);
    const lb = scene.add.text(cx - 130, y, it.label, {
      fontFamily: F_UI, fontSize: '30px', color: '#3A2410', fontStyle: '800',
    }).setOrigin(0, 0.5);
    root.add([ic, lb]);
  });
  const b = button(scene, 'Lovely!', () => { audio().play('click'); close(); done(); },
    { w: 260, h: 90, fontSize: 34 });
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
  const { h, cx } = lay(scene);
  const s = state(), d = data();
  const { root, close } = shell(scene, 560, 640, true);
  titleText(scene, cx, h / 2 - 240, 'SETTINGS', 44);
  const mk = (y: number, label: string, get: () => boolean, tog: () => boolean) => {
    const t = scene.add.text(cx - 200, y, label, {
      fontFamily: F_UI, fontSize: '30px', color: '#F5E6C8', fontStyle: '800',
    }).setOrigin(0, 0.5);
    const b = button(scene, get() ? 'ON' : 'OFF', () => {
      audio().play('click');
      (b.list[1] as Phaser.GameObjects.Text).setText(tog() ? 'ON' : 'OFF');
    }, { w: 150, h: 72, fontSize: 28 });
    b.setPosition(cx + 150, y);
    root.add([t, b]);
  };
  mk(h / 2 - 150, 'Music', () => audio().musicEnabled, () => audio().toggleMusic());
  mk(h / 2 - 60, 'Sound', () => audio().sfxEnabled, () => audio().toggleSfx());
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
  }, { w: 380, h: 88, fontSize: 32 });
  share.setPosition(cx, h / 2 + 60);
  const wipe = button(scene, 'New Game', () => {
    wipeSave();
    window.location.reload();
  }, { w: 380, h: 88, fontSize: 32 });
  wipe.setPosition(cx, h / 2 + 170);
  const ver = scene.add.text(cx, h / 2 + 250, 'Twilight Haven v1.0 · cozy build', {
    fontFamily: F_BODY, fontSize: '20px', color: '#B9A7E6',
  }).setOrigin(0.5);
  root.add([share, wipe, ver]);
}

/** Plant info popup (long-press). */
export function plantInfo(scene: Phaser.Scene, plantId: string,
                        cell?: number, onOffered?: Refresh): void {
  const { h, cx } = lay(scene);
  const d = data(), s = state();
  const t = plantById(d, plantId);
  const { root, close } = shell(scene, 520, 580);
  const art = img(scene, t.art).setDisplaySize(190, 190).setPosition(cx, h / 2 - 140);
  titleText(scene, cx, h / 2 - 10, t.name, 36);
  const sub = scene.add.text(cx, h / 2 + 36,
    `Tier ${t.tier} \u00b7 wish value ${fmt(t.wishValue)}` +
    (t.moondewPerHour > 0 ? `\nGrove: ${t.moondewPerHour}/hr` : ''), {
    fontFamily: F_BODY, fontSize: '26px', color: '#5a4a3a', align: 'center',
  }).setOrigin(0.5);
  root.add([art, sub]);
  if (cell !== undefined && onOffered) {
    const val = offerValue(d, s, plantId);
    const offer = button(scene, `Offer +${fmt(val)} \u263e`, () => {
      const ev = applyCommand(d, s, { type: 'offer', cell, now: Date.now() });
      if (ev.some((e) => e.type === 'offered')) {
        audio().play('collect');
        saveGame(s);
        close();
        onOffered();
      } else audio().play('error');
    }, { w: 300, h: 84, fontSize: 30 });
    offer.setPosition(cx - 140, h / 2 + 160);
    const b = button(scene, 'Close', () => { audio().play('click'); close(); },
      { w: 220, h: 84, fontSize: 30 });
    b.setPosition(cx + 150, h / 2 + 160);
    root.add([offer, b]);
  } else {
    const b = button(scene, 'Close', () => { audio().play('click'); close(); },
      { w: 220, h: 80, fontSize: 30 });
    b.setPosition(cx, h / 2 + 160);
    root.add(b);
  }
}

const TUTORIAL: { title: string; body: string }[] = [
  { title: 'Welcome, Star Gardener',
    body: 'This conservatory has withered. Tap the glowing Wish Pod to sprout a Star Sprout.' },
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

/** Tutorial coach-mark. Calls done() which should advanceTutorial + refresh. */
export function tutorialStep(scene: Phaser.Scene, step: number, done: Refresh): void {
  const t = TUTORIAL[step];
  if (!t) { done(); return; }
  const { w, h, cx } = lay(scene);
  const root = scene.add.container(0, 0).setDepth(200);
  const dim = dimmer(scene, 0.55);
  const hand = img(scene, 'coach-hand.png').setDisplaySize(150, 170);
  hand.setPosition(cx + 120, h * 0.62);
  scene.tweens.add({ targets: hand, y: '-=24', duration: 600, yoyo: true, repeat: -1 });
  const p = panel(scene, Math.min(620, w * 0.9), 330);
  p.setPosition(cx, h * 0.32);
  titleText(scene, cx, h * 0.32 - 100, t.title, 36);
  const body = scene.add.text(cx, h * 0.32 - 30, t.body, {
    fontFamily: F_BODY, fontSize: '27px', color: '#5a4a3a', align: 'center',
    wordWrap: { width: 540 },
  }).setOrigin(0.5, 0);
  const b = button(scene, step === TUTORIAL.length - 1 ? 'Begin!' : 'Got it',
    () => { audio().play('click'); root.destroy(); done(); },
    { w: 260, h: 88, fontSize: 32 });
  b.setPosition(cx, h * 0.32 + 110);
  const n = scene.add.text(cx, h * 0.32 + 160, `${step + 1} of ${TUTORIAL.length}`, {
    fontFamily: F_NUM, fontSize: '24px', color: '#B9A7E6', fontStyle: '700',
  }).setOrigin(0.5);
  root.add([dim, hand, p, body, b, n]);
}
