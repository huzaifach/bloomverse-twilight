import Phaser from 'phaser';
import { audio, coverBg, data, lay, state } from '../ctx.js';
import { applyCommand, medalMultiplier } from '../sim.js';
import { saveGame } from '../save.js';
import { button, F_BODY, F_NUM, F_UI, iconButton, img, panel, titleText,
         levelPips, Pill, fmt } from '../ui.js';
import { fanfare, openSettings } from './overlays.js';
import { navDock } from './navdock.js';

export class WingsScene extends Phaser.Scene {
  constructor() { super('wings'); }

  create(): void {
    const { w, h, cx } = lay(this);
    coverBg(this, 'bg-board-far');
    this.add.rectangle(0, 0, w, h, 0x12101d, 0.45).setOrigin(0);

    const s = state(), d = data();
    const pills = {
      moondew: new Pill(this, 'icon-moondew.png', 190),
      renown: new Pill(this, 'icon-renown.png', 190),
    };
    pills.moondew.setPosition(110, 44);
    pills.renown.setPosition(315, 44);
    pills.moondew.setValue(s.currencies.moondew);
    pills.renown.setValue(s.currencies.renown);
    const gear = iconButton(this, 'icon-gear.png', 72, () => {
      audio().play('click');
      openSettings(this, () => this.scene.restart());
    });
    gear.setPosition(w - 52, 44);
    titleText(this, cx, 110, 'GREENHOUSE WINGS', 38);

    const WING_BG: Record<string, string> = {
      'root-cellar': 'bg-wing-root', 'fern-sanctum': 'bg-wing-fern',
      'prism-grotto': 'bg-wing-prism', 'astral-dome': 'bg-astral-dome',
    };
    d.wings.forEach((wing, i) => {
      const y = 220 + i * 168;
      const cw = Math.min(640, w * 0.92);
      // wing identity background with dark overlay for legibility
      const bg = this.add.image(cx, y, WING_BG[wing.id] ?? 'bg-board-far');
      const bgs = Math.max(cw / bg.width, 150 / bg.height);
      bg.setScale(bgs).setDepth(1);
      const maskShape = this.add.rectangle(cx, y, cw, 150, 0xffffff).setVisible(false);
      bg.setMask(maskShape.createGeometryMask());
      const shade = this.add.rectangle(cx, y, cw, 150, 0x12101d, 0.62).setDepth(2);
      const frame = this.add.rectangle(cx, y, cw, 150)
        .setStrokeStyle(3, 0xd98e4a, 0.8).setDepth(3);
      void shade; void frame;
      const lvl = s.wings[wing.id] ?? 0;
      const nm = this.add.text(cx - 290, y - 48, wing.name, {
        fontFamily: F_UI, fontSize: '30px', color: '#F5E6C8', fontStyle: '800',
      }).setOrigin(0, 0.5).setDepth(4);
      const ds = this.add.text(cx - 290, y - 12, wing.levels[lvl]?.effect ?? wing.desc, {
        fontFamily: F_BODY, fontSize: '22px', color: '#EDE6D6',
        wordWrap: { width: 380 },
      }).setOrigin(0, 0.5).setDepth(4);
      const pips = levelPips(this, cx - 160, y + 44, lvl, 5);
      pips.setDepth(4);
      this.add.existing(pips);
      const next = wing.levels[lvl];
      if (s.currencies.renown < wing.renownRequired) {
        const rq = this.add.text(cx + 200, y, `★ ${wing.renownRequired} renown`, {
          fontFamily: F_NUM, fontSize: '24px', color: '#B9A7E6', fontStyle: '700',
        }).setOrigin(0.5).setDepth(4);
        void rq;
      } else if (next) {
        const b = button(this, `${fmt(next.costMoondew)} ☾`, () => {
          const ev = applyCommand(d, s, { type: 'buyWing', wing: wing.id, now: Date.now() });
          if (ev.some((e) => e.type === 'wingBought')) {
            audio().play('tierup');
            saveGame(s);
            this.scene.restart();
          } else audio().play('error');
        }, { w: 180, h: 72, fontSize: 26 });
        b.setPosition(cx + 200, y).setDepth(4);
      } else {
        this.add.text(cx + 200, y, 'MAX', {
          fontFamily: F_UI, fontSize: '28px', color: '#7FB069', fontStyle: '800',
        }).setOrigin(0.5).setDepth(4);
      }
      void nm; void ds;
    });

    // Starfall Rebirth (prestige)
    const ry = 220 + 4 * 168 + 10;
    const rp = panel(this, Math.min(640, w * 0.92), 200, true);
    rp.setPosition(cx, ry);
    const mi = img(this, 'medal-star-prestige.png').setDisplaySize(72, 72);
    mi.setPosition(cx - 250, ry - 62);
    titleText(this, cx + 20, ry - 62, '✦ STARFALL REBIRTH ✦', 32, '#B9A7E6');
    const medals = s.stats.highestTier >= 7 ? (s.stats.highestTier >= 8 ? 3 : 2) : 0;
    const medalIcon = medals >= 3 ? 'medal-gold.png' : 'medal-silver.png';
    this.add.text(cx, ry - 12,
      `Reset board, wishes & upgrades — keep Atlas & medals.\n` +
      `Each medal: +5% Moondew forever (now ×${medalMultiplier(s).toFixed(2)}).`, {
      fontFamily: F_BODY, fontSize: '23px', color: '#EDE6D6', align: 'center',
      lineSpacing: 6,
    }).setOrigin(0.5);
    if (s.currencies.starMedals > 0) {
      const earned = img(this, 'medal-bronze.png').setDisplaySize(56, 56);
      earned.setPosition(cx - 120, ry + 62);
      this.add.text(cx - 80, ry + 62, `×${s.currencies.starMedals} earned`, {
        fontFamily: F_NUM, fontSize: '24px', color: '#B9A7E6', fontStyle: '700',
      }).setOrigin(0, 0.5);
    }
    if (medals > 0) {
      const b = button(this, `Rebirth · +${medals} medals`, () => {
        const ev = applyCommand(d, s, { type: 'rebirth', now: Date.now() });
        if (ev.some((e) => e.type === 'reborn')) {
          audio().play('tierup');
          saveGame(s);
          fanfare(this, [{ icon: medalIcon, label: `+${medals} Star Medals` }],
            () => this.scene.start('board'));
        } else audio().play('error');
      }, { w: 360, h: 84, fontSize: 30 });
      b.setPosition(cx + 60, ry + 62);
      const mb = img(this, medalIcon).setDisplaySize(64, 64);
      mb.setPosition(cx - 150, ry + 62);
    } else {
      this.add.text(cx, ry + 58, 'Reach Tier 7 to rebirth', {
        fontFamily: F_BODY, fontSize: '24px', color: '#6E5A7E',
      }).setOrigin(0.5);
    }
    void h;
    navDock(this, 'wings');
    // keep medallion icon used
    void img;
  }
}
