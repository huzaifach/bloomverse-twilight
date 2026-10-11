import Phaser from 'phaser';
import { audio, coverBg, data, lay, state } from '../ctx.js';
import { applyCommand, groveRate, plantTierOf, potsUnlocked } from '../sim.js';
import { plantById } from '../data.js';
import { saveGame } from '../save.js';
import { button, dimmer, F_BODY, F_NUM, F_UI, iconButton, img, panel,
         titleText, levelPips, Pill, fmt, atlasFor } from '../ui.js';
import { fanfare, openSettings, plantInfo } from './overlays.js';
import { navDock } from './navdock.js';

export class GroveScene extends Phaser.Scene {
  private pills!: { moondew: Pill };
  private collectBtn!: Phaser.GameObjects.Container;
  private collectLabel!: Phaser.GameObjects.Text;

  constructor() { super('grove'); }

  create(): void {
    const { w, h, cx } = lay(this);
    coverBg(this, 'bg-grove-night');
    this.add.rectangle(0, 0, w, h, 0x12101d, 0.25).setOrigin(0);

    this.pills = { moondew: new Pill(this, 'icon-moondew.png', 210) };
    this.pills.moondew.setPosition(120, 44);
    const gear = iconButton(this, 'icon-gear.png', 72, () => {
      audio().play('click');
      openSettings(this, () => this.refresh());
    });
    gear.setPosition(w - 52, 44);
    titleText(this, cx, 44, 'MOONWELL GROVE', 40);

    this.buildPots(w, h, cx);
    this.buildCollect(w, h, cx);
    this.buildUpgrades(w, h, cx);
    navDock(this, 'grove');
    this.refresh();
  }

  private buildPots(w: number, h: number, cx: number): void {
    const s = state(), d = data();
    const unlocked = potsUnlocked(d, s);
    const rows = [5, 3];
    let pot = 0;
    rows.forEach((count, r) => {
      const y = h * (r === 0 ? 0.60 : 0.42);
      const pw = Math.min(w * 0.92, 640) / count;
      for (let c = 0; c < count; c++, pot++) {
        const x = cx - (count - 1) * pw / 2 + c * pw;
        const idx = pot;
        const cont = this.add.container(x, y).setDepth(2);
        if (idx >= unlocked) {
          const lock = this.add.text(0, 0, '🔒', { fontSize: '54px' }).setOrigin(0.5).setAlpha(0.7);
          const lb = this.add.text(0, 52, 'Astral Dome', {
            fontFamily: F_BODY, fontSize: '20px', color: '#B9A7E6',
          }).setOrigin(0.5);
          cont.add([lock, lb]);
          continue;
        }
        const potImg = img(this, 'star-pot.png')
          .setDisplaySize(pw * 0.72, pw * 0.72);
        if (r === 1) potImg.setAlpha(0.85).setScale(0.85);
        cont.add(potImg);
        const planted = s.grove.pots[idx];
        if (planted) {
          const pid: string = planted;
          const t = plantById(d, pid);
          const pl = this.add.image(0, -pw * 0.42, atlasFor(t.art), t.art)
            .setDisplaySize(pw * 0.62, pw * 0.62);
          if (r === 1) pl.setScale(0.85).setAlpha(0.85);
          const rate = this.add.text(0, pw * 0.44, `+${fmt(t.moondewPerHour)}/hr`, {
            fontFamily: F_NUM, fontSize: '22px', color: '#F5E6C8', fontStyle: '700',
          }).setOrigin(0.5);
          cont.add([pl, rate]);
          potImg.setInteractive({ useHandCursor: true })
            .on('pointerup', () => plantInfo(this, pid));
        } else {
          const add = this.add.text(0, -10, '＋', {
            fontFamily: F_UI, fontSize: '56px', color: '#E8A87C', fontStyle: '800',
          }).setOrigin(0.5);
          cont.add(add);
          potImg.setInteractive({ useHandCursor: true })
            .on('pointerup', () => this.openPicker(idx));
        }
      }
    });
    void w;
  }

  private openPicker(pot: number): void {
    const { w, h, cx } = lay(this);
    const s = state(), d = data();
    const cands: { cell: number; plant: string }[] = [];
    s.board.forEach((cell, i) => {
      if (cell && cell.kind === 'plant' && plantTierOf(cell.plant) >= 4)
        cands.push({ cell: i, plant: cell.plant });
    });
    const root = this.add.container(0, 0).setDepth(120);
    const dim = dimmer(this, 0.6);
    const p = panel(this, Math.min(600, w * 0.9), Math.min(560, h * 0.6));
    p.setPosition(cx, h / 2);
    root.add([dim, p]);
    dim.setInteractive().on('pointerup', () => root.destroy());
    titleText(this, cx, h / 2 - 220, 'CHOOSE A PLANT', 36);
    if (cands.length === 0) {
      const t = this.add.text(cx, h / 2 - 40,
        'No Tier 4+ plants on the board yet.\nMerge plants on the Blooming Circle first!', {
        fontFamily: F_BODY, fontSize: '26px', color: '#5a4a3a', align: 'center',
      }).setOrigin(0.5);
      root.add(t);
    }
    cands.slice(0, 12).forEach((cd, i) => {
      const col = i % 4, row = Math.floor(i / 4);
      const x = cx - 195 + col * 130, y = h / 2 - 100 + row * 130;
      const t = plantById(d, cd.plant);
      const im = this.add.image(x, y, atlasFor(t.art), t.art)
        .setDisplaySize(104, 104);
      im.setInteractive({ useHandCursor: true }).on('pointerup', () => {
        const ev = applyCommand(d, s, { type: 'transplant', cell: cd.cell, pot, now: Date.now() });
        if (!ev.some((e) => e.type === 'denied')) {
          audio().play('wish');
          saveGame(s);
        } else audio().play('error');
        root.destroy();
        this.scene.restart();
      });
      root.add(im);
    });
    const close = button(this, 'Close', () => root.destroy(), { w: 220, h: 76, fontSize: 30 });
    close.setPosition(cx, h / 2 + 220);
    root.add(close);
  }

  private buildCollect(w: number, h: number, cx: number): void {
    const y = h * 0.76;
    this.collectBtn = this.add.container(cx, y).setDepth(5);
    this.collectLabel = this.add.text(0, 0, '', {
      fontFamily: F_UI, fontSize: '32px', color: '#3A2410', fontStyle: '800',
    }).setOrigin(0.5);
    const bg = this.add.nineslice(0, 0, atlasFor('button-amber.png'), 'button-amber.png',
      420, 92, 40, 40, 40, 40);
    this.collectBtn.add([bg, this.collectLabel]);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerup', () => {
      const s = state(), d = data();
      const ev = applyCommand(d, s, { type: 'collectGrove', now: Date.now() });
      const got = ev.find((e) => e.type === 'collected');
      if (got && got.type === 'collected' && got.amount > 0) {
        audio().play('collect');
        saveGame(s);
        fanfare(this, [{ icon: 'icon-moondew.png', label: `+${fmt(got.amount)} Moondew` }],
          () => this.refresh());
      } else audio().play('error');
    });
    void w;
  }

  private buildUpgrades(w: number, h: number, cx: number): void {
    const d = data(), s = state();
    const y0 = h * 0.84;
    d.upgrades.forEach((line, i) => {
      const y = y0 + i * 96;
      const lvl = s.grove.upgrades[line.id] ?? 0;
      const nm = this.add.text(24, y, line.name, {
        fontFamily: F_UI, fontSize: '26px', color: '#F5E6C8', fontStyle: '800',
      }).setOrigin(0, 0.5);
      this.add.existing(levelPips(this, 330, y + 26, lvl, 10));
      const next = line.levels[lvl];
      if (next) {
        const b = button(this, `${fmt(next.costMoondew)} ☾`, () => {
          const ev = applyCommand(d, s, { type: 'buyUpgrade', line: line.id, now: Date.now() });
          if (ev.some((e) => e.type === 'upgradeBought')) {
            audio().play('wish');
            saveGame(s);
            this.scene.restart();
          } else audio().play('error');
        }, { w: 170, h: 66, fontSize: 26 });
        b.setPosition(w - 110, y);
      } else {
        const mx = this.add.text(w - 110, y, 'MAX', {
          fontFamily: F_UI, fontSize: '26px', color: '#B9A7E6', fontStyle: '800',
        }).setOrigin(0.5);
        void mx;
      }
      void nm;
    });
    void cx;
  }

  private refresh(): void {
    const s = state(), d = data();
    this.pills.moondew.setValue(s.currencies.moondew);
    const rate = groveRate(d, s);
    this.collectLabel.setText(`Collect · +${fmt(rate)}/hr`);
  }
}
