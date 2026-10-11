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

    d.wings.forEach((wing, i) => {
      const y = 220 + i * 168;
      const card = panel(this, Math.min(640, w * 0.92), 150);
      card.setPosition(cx, y);
      const lvl = s.wings[wing.id] ?? 0;
      const nm = this.add.text(cx - 290, y - 48, wing.name, {
        fontFamily: F_UI, fontSize: '30px', color: '#3A2410', fontStyle: '800',
      }).setOrigin(0, 0.5);
      const ds = this.add.text(cx - 290, y - 12, wing.levels[lvl]?.effect ?? wing.desc, {
        fontFamily: F_BODY, fontSize: '22px', color: '#5a4a3a',
        wordWrap: { width: 380 },
      }).setOrigin(0, 0.5);
      this.add.existing(levelPips(this, cx - 160, y + 44, lvl, 5));
      const next = wing.levels[lvl];
      if (s.currencies.renown < wing.renownRequired) {
        const rq = this.add.text(cx + 200, y, `★ ${wing.renownRequired} renown`, {
          fontFamily: F_NUM, fontSize: '24px', color: '#8a6a9a', fontStyle: '700',
        }).setOrigin(0.5);
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
        b.setPosition(cx + 200, y);
      } else {
        this.add.text(cx + 200, y, 'MAX', {
          fontFamily: F_UI, fontSize: '28px', color: '#7FB069', fontStyle: '800',
        }).setOrigin(0.5);
      }
      void nm; void ds;
    });

    // Starfall Rebirth (prestige)
    const ry = 220 + 4 * 168 + 10;
    const rp = panel(this, Math.min(640, w * 0.92), 190, true);
    rp.setPosition(cx, ry);
    titleText(this, cx, ry - 62, '✦ STARFALL REBIRTH ✦', 32, '#B9A7E6');
    const medals = s.stats.highestTier >= 7 ? (s.stats.highestTier >= 8 ? 3 : 2) : 0;
    this.add.text(cx, ry - 12,
      `Reset board, wishes & upgrades — keep Atlas & medals.\n` +
      `Each medal: +5% Moondew forever (now ×${medalMultiplier(s).toFixed(2)}).`, {
      fontFamily: F_BODY, fontSize: '23px', color: '#EDE6D6', align: 'center',
      lineSpacing: 6,
    }).setOrigin(0.5);
    if (medals > 0) {
      const b = button(this, `Rebirth · +${medals} medals`, () => {
        const ev = applyCommand(d, s, { type: 'rebirth', now: Date.now() });
        if (ev.some((e) => e.type === 'reborn')) {
          audio().play('tierup');
          saveGame(s);
          fanfare(this, [{ icon: 'icon-renown.png', label: `+${medals} Star Medals` }],
            () => this.scene.start('board'));
        } else audio().play('error');
      }, { w: 360, h: 84, fontSize: 30 });
      b.setPosition(cx, ry + 62);
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
