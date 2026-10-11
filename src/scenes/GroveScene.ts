import Phaser from 'phaser';
import { audio, coverBg, data, lay, needBg, state } from '../ctx.js';
import { attachDebug } from '../debug.js';
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

  preload(): void {
    needBg(this, 'bg-grove-night');
  }

  create(): void {
    const { w, h, cx } = lay(this);
    coverBg(this, 'bg-grove-night');
    this.add.rectangle(0, 0, w, h, 0x12101d, 0.25).setOrigin(0);

    this.pills = { moondew: new Pill(this, 'icon-moondew.png', 150) };
    this.pills.moondew.setPosition(83, 42);
    const gear = iconButton(this, 'icon-gear.png', 52, () => {
      audio().play('click');
      openSettings(this, () => this.refresh());
    });
    gear.setPosition(w - 30, 42);
    titleText(this, cx, 102, 'MOONWELL GROVE', 32);

    this.buildPots(w, h, cx);
    this.buildCollect(w, h, cx);
    this.buildUpgrades(w, h, cx);
    navDock(this, 'grove');
    attachDebug(this);
    this.refresh();
  }

  private buildPots(w: number, h: number, cx: number): void {
    const s = state(), d = data();
    const unlocked = potsUnlocked(d, s);
    const rows = [5, 3];
    let pot = 0;
    rows.forEach((count, r) => {
      const y = r === 0 ? 420 : 280;
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
        const potFrame = r === 0 ? 'pot-star.png' : 'pot-astral.png';
        const potImg = img(this, potFrame)
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
    const y = 560;
    this.collectBtn = this.add.container(cx, y).setDepth(5);
    this.collectLabel = this.add.text(0, 0, '', {
      fontFamily: F_UI, fontSize: '30px', color: '#3A2410', fontStyle: '800',
    }).setOrigin(0.5);
    const bg = this.add.nineslice(0, 0, atlasFor('button-amber.png'), 'button-amber.png',
      360, 88, 40, 40, 40, 40);
    this.collectBtn.add([bg, this.collectLabel]);
    bg.setInteractive(new Phaser.Geom.Rectangle(-180, -44, 360, 88),
      Phaser.Geom.Rectangle.Contains);
    if (bg.input) bg.input.cursor = 'pointer';
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
    // Compact rows that fit the 420px canvas above the dock.
    const y0 = 630, rowH = 80;
    const UPGRADE_ICON: Record<string, string> = {
      raincaller: 'charm-raincaller.png', moths: 'moth-moon.png', starpots: 'star-pot.png',
    };
    d.upgrades.forEach((line, i) => {
      const y = y0 + i * rowH;
      const lvl = s.grove.upgrades[line.id] ?? 0;
      const ic = img(this, UPGRADE_ICON[line.id] ?? 'star-pot.png').setDisplaySize(48, 48);
      ic.setPosition(38, y);
      const nm = this.add.text(70, y - 14, line.name, {
        fontFamily: F_UI, fontSize: '23px', color: '#F5E6C8', fontStyle: '800',
      }).setOrigin(0, 0.5);
      const lv = this.add.text(70, y + 16, `Lv ${lvl}/10`, {
        fontFamily: F_NUM, fontSize: '19px', color: '#B9A7E6', fontStyle: '700',
      }).setOrigin(0, 0.5);
      const next = line.levels[lvl];
      if (next) {
        const b = button(this, `${fmt(next.costMoondew)} ☾`, () => {
          const ev = applyCommand(d, s, { type: 'buyUpgrade', line: line.id, now: Date.now() });
          if (ev.some((e) => e.type === 'upgradeBought')) {
            audio().play('wish');
            saveGame(s);
            this.scene.restart();
          } else audio().play('error');
        }, { w: 140, h: 58, fontSize: 24, fireOnDown: true });
        b.setPosition(w - 82, y);
      } else {
        const mx = this.add.text(w - 82, y, 'MAX', {
          fontFamily: F_UI, fontSize: '24px', color: '#B9A7E6', fontStyle: '800',
        }).setOrigin(0.5);
        void mx;
      }
      void nm; void lv;
    });
    void cx; void h;
  }

  private refresh(): void {
    const s = state(), d = data();
    this.pills.moondew.setValue(s.currencies.moondew);
    const rate = groveRate(d, s);
    this.collectLabel.setText(`Collect · +${fmt(rate)}/hr`);
  }
}
