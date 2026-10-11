import Phaser from 'phaser';
import { audio, coverBg, data, lay, needBg, state } from '../ctx.js';
import { attachDebug } from '../debug.js';
import { applyCommand, medalMultiplier } from '../sim.js';
import { saveGame } from '../save.js';
import { button, F_BODY, F_NUM, F_UI, iconButton, img, panel, titleText,
         levelPips, Pill, fmt } from '../ui.js';
import { fanfare, openSettings } from './overlays.js';
import { navDock } from './navdock.js';

export class WingsScene extends Phaser.Scene {
  constructor() { super('wings'); }

  preload(): void {
    needBg(this, 'bg-board-far');
    needBg(this, 'bg-wing-root');
    needBg(this, 'bg-wing-fern');
    needBg(this, 'bg-wing-prism');
    needBg(this, 'bg-astral-dome');
  }

  create(): void {
    const { w, h, cx } = lay(this);
    coverBg(this, 'bg-board-far');
    this.add.rectangle(0, 0, w, h, 0x12101d, 0.45).setOrigin(0);

    const s = state(), d = data();
    const pills = {
      moondew: new Pill(this, 'icon-moondew.png', 150),
      renown: new Pill(this, 'icon-renown.png', 130),
    };
    pills.moondew.setPosition(83, 42);
    pills.renown.setPosition(238, 42);
    pills.moondew.setValue(s.currencies.moondew);
    pills.renown.setValue(s.currencies.renown);
    const gear = iconButton(this, 'icon-gear.png', 52, () => {
      audio().play('click');
      openSettings(this, () => this.scene.restart());
    });
    gear.setPosition(w - 30, 42);
    titleText(this, cx, 102, 'GREENHOUSE WINGS', 30);

    const WING_BG: Record<string, string> = {
      'root-cellar': 'bg-wing-root', 'fern-sanctum': 'bg-wing-fern',
      'prism-grotto': 'bg-wing-prism', 'astral-dome': 'bg-astral-dome',
    };
    // Scrollable wing cards + rebirth (drag pattern like Atlas).
    const viewY = 150, viewH = h - 150 - 200;
    const content = this.add.container(cx, viewY);
    const cw = Math.min(386, w - 34);
    const cardH = 176, gap = 14;
    let lastBuyT = -9999;
    let cy = cardH / 2;
    d.wings.forEach((wing) => {
      const card = this.add.container(0, cy);
      const left = -cw / 2;
      const bg = this.add.image(0, 0, WING_BG[wing.id] ?? 'bg-board-far');
      bg.setScale(Math.max(cw / bg.width, cardH / bg.height));
      const cardMask = this.add.rectangle(0, 0, cw, cardH, 0xffffff).setVisible(false);
      card.add(cardMask);
      bg.setMask(cardMask.createGeometryMask());
      const shade = this.add.rectangle(0, 0, cw, cardH, 0x12101d, 0.62);
      const frame = this.add.rectangle(0, 0, cw, cardH).setStrokeStyle(3, 0xd98e4a, 0.8);
      card.add([bg, shade, frame]);
      const lvl = s.wings[wing.id] ?? 0;
      const nm = this.add.text(left + 16, -58, wing.name, {
        fontFamily: F_UI, fontSize: '25px', color: '#F5E6C8', fontStyle: '800',
      }).setOrigin(0, 0.5);
      const ds = this.add.text(left + 16, -30, wing.levels[lvl]?.effect ?? wing.desc, {
        fontFamily: F_BODY, fontSize: '19px', color: '#EDE6D6',
        wordWrap: { width: cw - 36 },
      }).setOrigin(0, 0);
      const pips = levelPips(this, left + 84, 58, lvl, 5);
      this.add.existing(pips);
      const rightX = left + cw - 82;
      const next = wing.levels[lvl];
      if (s.currencies.renown < wing.renownRequired) {
        const rq = this.add.text(rightX, 30, `★ ${wing.renownRequired}`, {
          fontFamily: F_NUM, fontSize: '22px', color: '#B9A7E6', fontStyle: '700',
        }).setOrigin(0.5);
        card.add(rq);
      } else if (next) {
        const b = button(this, `${fmt(next.costMoondew)} ☾`, () => {
          if (this.time.now - lastBuyT < 300) return; // was a scroll-drag
          const ev = applyCommand(d, s, { type: 'buyWing', wing: wing.id, now: Date.now() });
          if (ev.some((e) => e.type === 'wingBought')) {
            audio().play('tierup');
            saveGame(s);
            this.scene.restart();
          } else audio().play('error');
        }, { w: 148, h: 60, fontSize: 24, fireOnDown: true });
        b.setPosition(rightX, 30);
        card.add(b);
      } else {
        const mx = this.add.text(rightX, 30, 'MAX', {
          fontFamily: F_UI, fontSize: '26px', color: '#7FB069', fontStyle: '800',
        }).setOrigin(0.5);
        card.add(mx);
      }
      card.add([nm, ds, pips]);
      content.add(card);
      cy += cardH + gap;
    });

    // Starfall Rebirth (prestige)
    const rpH = 196;
    const rp = panel(this, cw, rpH, true);
    const ry = cy + rpH / 2;
    rp.setPosition(0, ry);
    content.add(rp);
    const mi = img(this, 'medal-star-prestige.png').setDisplaySize(64, 64);
    mi.setPosition(-cw / 2 + 44, ry - 56);
    content.add(mi);
    const rt = titleText(this, -cw / 2 + 84, ry - 56, '✦ STARFALL REBIRTH ✦', 26, '#B9A7E6');
    rt.setOrigin(0, 0.5);
    content.add(rt);
    const medals = s.stats.highestTier >= 7 ? (s.stats.highestTier >= 8 ? 3 : 2) : 0;
    const medalIcon = medals >= 3 ? 'medal-gold.png' : 'medal-silver.png';
    const rd = this.add.text(0, ry + 2,
      `Reset board, wishes & upgrades — keep Atlas & medals.\n` +
      `Each medal: +5% Moondew forever (now ×${medalMultiplier(s).toFixed(2)}).`, {
      fontFamily: F_BODY, fontSize: '19px', color: '#EDE6D6', align: 'center',
      lineSpacing: 5, wordWrap: { width: cw - 40 },
    }).setOrigin(0.5);
    content.add(rd);
    if (s.currencies.starMedals > 0) {
      const er = this.add.text(cw / 2 - 16, ry - 56, `×${s.currencies.starMedals} earned`, {
        fontFamily: F_NUM, fontSize: '20px', color: '#B9A7E6', fontStyle: '700',
      }).setOrigin(1, 0.5);
      content.add(er);
    }
    if (medals > 0) {
      const b = button(this, `Rebirth · +${medals} medals`, () => {
        if (this.time.now - lastBuyT < 300) return;
        const ev = applyCommand(d, s, { type: 'rebirth', now: Date.now() });
        if (ev.some((e) => e.type === 'reborn')) {
          audio().play('tierup');
          saveGame(s);
          fanfare(this, [{ icon: medalIcon, label: `+${medals} Star Medals` }],
            () => this.scene.start('board'));
        } else audio().play('error');
      }, { w: 280, h: 68, fontSize: 27, fireOnDown: true });
      b.setPosition(10, ry + 62);
      const mb = img(this, medalIcon).setDisplaySize(54, 54);
      mb.setPosition(-cw / 2 + 44, ry + 62);
      content.add([b, mb]);
    } else {
      const hint = this.add.text(0, ry + 62, 'Reach Tier 7 to rebirth', {
        fontFamily: F_BODY, fontSize: '22px', color: '#6E5A7E',
      }).setOrigin(0.5);
      content.add(hint);
    }
    cy += rpH + gap;
    const gridH = cy;

    const maskAll = this.add.rectangle(cx, viewY + viewH / 2, w, viewH, 0xffffff).setVisible(false);
    content.setMask(maskAll.createGeometryMask());
    // drag scroll (deterministic, no inertia)
    let dragging = false, lastY = 0, offY = 0, downY = 0;
    const maxOff = Math.max(0, gridH - viewH + 40);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.y > viewY && p.y < viewH + viewY) { dragging = true; lastY = p.y; downY = p.y; }
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!dragging || !p.isDown) return;
      offY = Phaser.Math.Clamp(offY + (p.y - lastY), -maxOff, 0);
      lastY = p.y;
      content.setY(viewY + offY);
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (dragging && Math.abs(p.y - downY) > 14) lastBuyT = this.time.now;
      dragging = false;
    });
    void h;
    navDock(this, 'wings');
    attachDebug(this);
    // keep medallion icon used
    void img;
  }
}
