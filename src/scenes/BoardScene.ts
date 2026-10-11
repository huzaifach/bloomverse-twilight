import Phaser from 'phaser';
import { audio, coverBg, data, lay, state } from '../ctx.js';
import { BOARD_N, PALETTE } from '../config.js';
import { applyCommand, Cell, spawnCost } from '../sim.js';
import { plantById } from '../data.js';
import { saveGame } from '../save.js';
import { button, dimmer, F_BODY, F_NUM, F_UI, iconButton, img, Pill,
         atlasFor } from '../ui.js';
import { awayPopup, fanfare, openSettings, openWishBoard, plantInfo,
         tutorialStep } from './overlays.js';

interface CellView {
  root: Phaser.GameObjects.Container;
  top: Phaser.GameObjects.Image;
  side: Phaser.GameObjects.Image;
  plant: Phaser.GameObjects.Image | null;
  kind: 'empty' | 'plant' | 'withered';
  plantId: string | null;
}

export class BoardScene extends Phaser.Scene {
  private cells: CellView[] = [];
  private tile = 120;
  private boardX = 0;
  private boardY = 0;
  private pills!: { moondew: Pill; stardust: Pill; renown: Pill };
  private podBtn!: Phaser.GameObjects.Container;
  private podLabel!: Phaser.GameObjects.Text;
  private poof!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dragFrom: number | null = null;
  private dragImg: Phaser.GameObjects.Image | null = null;
  private dragging = false;
  private downXY: { x: number; y: number } = { x: 0, y: 0 };
  private downTime = 0;
  private longPressTimer: Phaser.Time.TimerEvent | null = null;
  private selected: number | null = null;
  private selectRing: Phaser.GameObjects.Arc | null = null;
  private awayShown = false;
  private saveTimer = 0;
  private combo = 0;
  private comboTimer: Phaser.Time.TimerEvent | null = null;

  constructor() { super('board'); }

  create(): void {
    const { w, h, cx } = lay(this);
    coverBg(this, 'bg-board-mid');
    coverBg(this, 'bg-board-far').setAlpha(0.55);
    this.buildHud(w);
    this.buildBoard(w, h, cx);
    this.buildDock(w, h, cx);
    this.poof = this.add.particles(0, 0, atlasFor('fx-gold-burst.png'), {
      frame: 'fx-gold-burst.png', speed: { min: 60, max: 220 },
      lifespan: 500, scale: { start: 0.5, end: 0 }, quantity: 0,
      reserve: 120, maxParticles: 100,
    }).setDepth(60);

    this.renderBoard();
    this.refreshHud();

    // tutorial
    const s = state();
    if (s.tutorialStep < 7) {
      tutorialStep(this, s.tutorialStep, () => {
        applyCommand(data(), s, { type: 'advanceTutorial', now: Date.now() });
        saveGame(s);
        if (s.tutorialStep < 7) this.scene.restart();
      });
      return;
    }
    // away popup once per session
    if (!this.awayShown) {
      this.awayShown = true;
      const ev = applyCommand(data(), s, { type: 'collectGrove', now: Date.now() });
      const got = ev.find((e) => e.type === 'collected');
      if (got && got.type === 'collected' && got.amount >= 50) {
        saveGame(s);
        awayPopup(this, got.amount, () => this.refreshHud());
      }
    }
    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
  }

  private buildHud(w: number): void {
    const s = state();
    const y = 44;
    this.pills = {
      moondew: new Pill(this, 'icon-moondew.png', 190),
      stardust: new Pill(this, 'icon-stardust.png', 170),
      renown: new Pill(this, 'icon-renown.png', 170),
    };
    this.pills.moondew.setPosition(110, y);
    this.pills.stardust.setPosition(315, y);
    this.pills.renown.setPosition(500, y);
    const gear = iconButton(this, 'icon-gear.png', 72, () => {
      audio().play('click');
      openSettings(this, () => this.refreshHud());
    });
    gear.setPosition(w - 52, y);
    void s;
  }

  private buildBoard(w: number, h: number, cx: number): void {
    const boardW = Math.min(w * 0.94, 640);
    this.tile = boardW / BOARD_N;
    this.boardX = cx - boardW / 2;
    this.boardY = 130;
    void h;
    for (let i = 0; i < 25; i++) {
      const r = Math.floor(i / 5), c = i % 5;
      const x = this.boardX + c * this.tile + this.tile / 2;
      const y = this.boardY + r * this.tile + this.tile / 2 + r * 6;
      const sc = 1 + r * 0.012;
      const root = this.add.container(x, y).setDepth(1).setScale(sc);
      const side = img(this, 'tile-parchment.png')
        .setDisplaySize(this.tile * 0.96, this.tile * 0.96)
        .setTint(0x6a5a72).setPosition(0, 9).setAlpha(0.9);
      const top = img(this, 'tile-parchment.png')
        .setDisplaySize(this.tile * 0.96, this.tile * 0.96);
      const shadow = this.add.ellipse(0, this.tile * 0.44, this.tile * 0.8,
        this.tile * 0.2, 0x000000, 0.25);
      root.add([shadow, side, top]);
      root.setSize(this.tile, this.tile);
      this.cells.push({ root, top, side, plant: null, kind: 'empty', plantId: null });
    }
  }

  private buildDock(w: number, h: number, cx: number): void {
    const y = h - 92;
    // wish pod (spawner)
    this.podBtn = this.add.container(86, y - 40).setDepth(10);
    const pod = img(this, 'wish-pod.png').setDisplaySize(110, 110);
    this.podLabel = this.add.text(0, 62, '', {
      fontFamily: F_NUM, fontSize: '22px', color: '#F5E6C8', fontStyle: '700',
    }).setOrigin(0.5);
    this.podBtn.add([pod, this.podLabel]);
    pod.setInteractive({ useHandCursor: true });
    pod.on('pointerup', () => this.trySpawn());
    // nav
    const mk = (i: number, label: string, icon: string, go: string, active: boolean) => {
      const b = this.add.container(cx - 195 + i * 130, y).setDepth(10);
      const bg = this.add.circle(0, -14, 40, active ? PALETTE.ember : 0x2a2438, active ? 1 : 0.85);
      const ic = img(this, icon).setDisplaySize(52, 52).setPosition(0, -14);
      const lb = this.add.text(0, 34, label, {
        fontFamily: F_UI, fontSize: '22px', color: '#F5E6C8', fontStyle: '800',
      }).setOrigin(0.5);
      b.add([bg, ic, lb]);
      if (!active) bg.setInteractive({ useHandCursor: true })
        .on('pointerup', () => { audio().play('click'); this.scene.start(go); });
      return b;
    };
    mk(0, 'Board', 'tile-parchment.png', 'board', true);
    mk(1, 'Grove', 'star-pot.png', 'grove', false);
    mk(2, 'Atlas', 'icon-stardust.png', 'atlas', false);
    mk(3, 'Wings', 'icon-renown.png', 'wings', false);
    // wish board button
    const wb = button(this, '☁ Wishes', () => {
      audio().play('click');
      openWishBoard(this, () => { this.renderBoard(); this.refreshHud(); });
    }, { w: 190, h: 78, fontSize: 30 });
    wb.setPosition(w - 120, y - 120);
    void w;
  }

  private cellAt(x: number, y: number): number {
    for (let i = 0; i < 25; i++) {
      const v = this.cells[i] as CellView;
      const dx = Math.abs(x - v.root.x), dy = Math.abs(y - v.root.y);
      if (dx < this.tile / 2 && dy < this.tile / 2) return i;
    }
    return -1;
  }

  private onDown(p: Phaser.Input.Pointer): void {
    audio().unlock();
    const i = this.cellAt(p.x, p.y);
    this.downXY = { x: p.x, y: p.y };
    this.downTime = this.time.now;
    this.dragging = false;
    if (i >= 0) {
      const c = state().board[i] as Cell;
      if (c && c.kind === 'plant') {
        this.dragFrom = i;
        this.longPressTimer = this.time.delayedCall(550, () => {
          if (!this.dragging && this.dragFrom === i) {
            const cc = state().board[i] as Cell;
            if (cc && cc.kind === 'plant')
              plantInfo(this, cc.plant, i, () => {
                this.renderBoard();
                this.refreshHud();
              });
            this.dragFrom = null;
          }
        });
      }
    }
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (this.dragFrom === null || !p.isDown) return;
    const moved = Math.hypot(p.x - this.downXY.x, p.y - this.downXY.y);
    if (!this.dragging && moved > 14) {
      this.dragging = true;
      this.longPressTimer?.remove();
      const c = state().board[this.dragFrom] as Cell;
      if (c && c.kind === 'plant') {
        const t = plantById(data(), c.plant);
        this.dragImg = img(this, t.art)
          .setDisplaySize(this.tile * 0.9, this.tile * 0.9)
          .setDepth(70).setAlpha(0.95);
      }
    }
    if (this.dragging && this.dragImg) this.dragImg.setPosition(p.x, p.y);
  }

  private onUp(p: Phaser.Input.Pointer): void {
    this.longPressTimer?.remove();
    const s = state(), d = data();
    if (this.dragging && this.dragFrom !== null) {
      const to = this.cellAt(p.x, p.y);
      const from = this.dragFrom;
      this.dragImg?.destroy();
      this.dragImg = null;
      this.dragFrom = null;
      this.dragging = false;
      if (to >= 0 && to !== from) this.doMove(from, to);
      return;
    }
    // tap (no drag): tap-tap select + merge
    const quick = this.time.now - this.downTime < 350;
    const i = this.cellAt(p.x, p.y);
    if (quick && i >= 0 && this.dragFrom !== null) {
      const from = this.dragFrom;
      this.dragFrom = null;
      const c = s.board[from] as Cell;
      if (!(c && c.kind === 'plant')) { this.clearSelect(); return; }
      if (this.selected === null) {
        this.selected = i;
        this.showSelect(i);
        audio().play('click');
      } else if (this.selected === i) {
        this.clearSelect();
        audio().play('click');
      } else {
        const f2 = this.selected;
        this.clearSelect();
        this.doMove(f2, i);
      }
      return;
    }
    this.dragFrom = null;
    void d;
  }

  private showSelect(i: number): void {
    this.clearSelect();
    const v = this.cells[i] as CellView;
    this.selectRing = this.add.circle(v.root.x, v.root.y, this.tile * 0.52)
      .setStrokeStyle(6, PALETTE.ember).setDepth(5);
  }
  private clearSelect(): void {
    this.selected = null;
    this.selectRing?.destroy();
    this.selectRing = null;
  }

  private doMove(from: number, to: number): void {
    const s = state(), d = data();
    const ev = applyCommand(d, s, { type: 'move', from, to, now: Date.now() });
    let merged = false;
    for (const e of ev) {
      if (e.type === 'merged') {
        merged = true;
        const v = this.cells[e.at] as CellView;
        this.poof.explode(14, v.root.x, v.root.y);
        this.combo++;
        this.comboTimer?.remove();
        this.comboTimer = this.time.delayedCall(2000, () => { this.combo = 0; });
        audio().mergeChime(this.combo);
        audio().play('merge');
        this.tweens.add({ targets: v.root, scale: '+=0.18', duration: 130, yoyo: true });
      } else if (e.type === 'denied') {
        audio().play('error');
      } else if (e.type === 'achievement') {
        const a = d.achievements.find((x) => x.id === e.id);
        if (a) fanfare(this, [{ icon: 'icon-renown.png', label: a.name }],
          () => this.refreshHud());
      }
    }
    if (merged || ev.some((e) => e.type === 'moved')) {
      this.renderBoard();
      this.refreshHud();
      saveGame(s);
    }
  }

  private trySpawn(): void {
    const s = state(), d = data();
    const now = Date.now();
    if (now < s.podReadyAt) {
      audio().play('error');
      return;
    }
    const ev = applyCommand(d, s, { type: 'spawn', now });
    const ok = ev.some((e) => e.type === 'spawned');
    if (ok) {
      audio().play('merge');
      const sp = ev.find((e) => e.type === 'spawned');
      if (sp && sp.type === 'spawned') {
        const v = this.cells[sp.at] as CellView;
        this.poof.explode(8, v.root.x, v.root.y);
      }
      this.renderBoard();
      this.refreshHud();
      saveGame(s);
    } else {
      audio().play('error');
    }
  }

  private renderBoard(): void {
    const s = state(), d = data();
    s.board.forEach((c: Cell, i: number) => {
      const v = this.cells[i] as CellView;
      const kind = !c ? 'empty' : c.kind;
      const plantId = c && c.kind === 'plant' ? c.plant : null;
      v.top.setTexture(atlasFor(kind === 'withered' ? 'tile-withered.png' : 'tile-parchment.png'),
        kind === 'withered' ? 'tile-withered.png' : 'tile-parchment.png');
      if (v.plant && plantId === v.plantId) return;
      v.plant?.destroy();
      v.plant = null;
      v.plantId = null;
      if (plantId) {
        const t = plantById(d, plantId);
        v.plant = this.add.image(0, -this.tile * 0.06, atlasFor(t.art), t.art)
          .setDisplaySize(this.tile * 0.8, this.tile * 0.8);
        v.root.add(v.plant);
        v.plantId = plantId;
      }
    });
  }

  private refreshHud(): void {
    const s = state();
    this.pills.moondew.setValue(s.currencies.moondew);
    this.pills.stardust.setValue(s.currencies.stardust);
    this.pills.renown.setValue(s.currencies.renown);
  }

  update(_t: number, dt: number): void {
    // pod cooldown label ~2Hz
    this.saveTimer += dt;
    const s = state(), d = data();
    const ms = s.podReadyAt - Date.now();
    const cost = spawnCost(d, s);
    this.podLabel.setText(ms > 0 ? `${Math.ceil(ms / 1000)}s` : `${cost} ☾`);
    if (this.saveTimer > 30000) {
      this.saveTimer = 0;
      applyCommand(d, s, { type: 'tick', dt: 30, now: Date.now() });
      saveGame(s);
    }
  }
}
