import Phaser from 'phaser';
import { audio, coverBg, data, lay, needBg, state } from '../ctx.js';
import { attachDebug } from '../debug.js';
import { BOARD_N, PALETTE } from '../config.js';
import { applyCommand, Cell, spawnCost } from '../sim.js';
import { plantById } from '../data.js';
import { saveGame } from '../save.js';
import { button, dimmer, F_BODY, F_NUM, F_UI, fmt, img, insetCell, panel,
         squareBtn, titleText, atlasFor } from '../ui.js';
import { awayPopup, fanfare, openSettings, openWishBoard, plantInfo,
         tutorialStep } from './overlays.js';
import { navDock } from './navdock.js';

interface CellView {
  root: Phaser.GameObjects.Container;
  top: Phaser.GameObjects.Image;
  side: Phaser.GameObjects.Image;
  plant: Phaser.GameObjects.Image | null;
  heart: Phaser.GameObjects.Image;
  kind: 'empty' | 'plant' | 'withered';
  plantId: string | null;
}

export class BoardScene extends Phaser.Scene {
  private cells: CellView[] = [];
  private tile = 120;
  private boardX = 0;
  private boardY = 0;
  private hudVals: { val: Phaser.GameObjects.Text; get: () => number }[] = [];
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

  preload(): void {
    needBg(this, 'bg-board-far');
    needBg(this, 'bg-board-mid');
  }

  create(): void {
    const { w, h, cx } = lay(this);
    coverBg(this, 'bg-board-mid');
    coverBg(this, 'bg-board-far').setAlpha(0.55);
    this.buildHud(w);
    this.buildBoard(w, h, cx);
    this.buildDock(w, h, cx);
    this.buildHintBar();
    this.poof = this.add.particles(0, 0, atlasFor('fx-gold-burst.png'), {
      frame: 'fx-gold-burst.png', speed: { min: 60, max: 220 },
      lifespan: 500, scale: { start: 0.5, end: 0 }, quantity: 0,
      reserve: 120, maxParticles: 100,
    }).setDepth(60);

    this.renderBoard();
    this.refreshHud();
    attachDebug(this);

    // tutorial
    const s = state();
    if (s.tutorialStep < 7) {
      tutorialStep(this, s.tutorialStep, () => {
        applyCommand(data(), s, { type: 'advanceTutorial', now: Date.now() });
        saveGame(s);
        // Always restart: on the final step this re-runs create() with
        // tutorialStep >= 7, which registers board input below.
        this.scene.restart();
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

  /** Mockup HUD: parchment bar, icon-in-inset currency cells, square buttons. */
  private buildHud(w: number): void {
    const cx = w / 2;
    const bar = panel(this, 404, 148);
    bar.setPosition(cx, 80);
    const cells: { icon: string; name: string; color: number; get: () => number }[] = [
      { icon: 'icon-moondew.png', name: 'Moondew', color: 0x1b6b6b,
        get: () => state().currencies.moondew },
      { icon: 'icon-stardust.png', name: 'Stardust', color: 0x3b2a6b,
        get: () => state().currencies.stardust },
      { icon: 'icon-renown.png', name: 'Renown', color: 0x4a2e5b,
        get: () => state().currencies.renown },
    ];
    this.hudVals = [];
    cells.forEach((cell, i) => {
      const x = 62 + i * 86;
      const inset = insetCell(this, 72, 54, cell.color);
      inset.setPosition(x, 50);
      const ic = img(this, cell.icon).setDisplaySize(38, 38).setPosition(x, 50);
      const nm = this.add.text(x, 88, cell.name, {
        fontFamily: F_UI, fontSize: '16px', color: '#3A2410', fontStyle: '800',
      }).setOrigin(0.5);
      const val = this.add.text(x, 110, fmt(cell.get()), {
        fontFamily: F_NUM, fontSize: '20px', color: '#3A2410', fontStyle: '800',
      }).setOrigin(0.5);
      this.hudVals.push({ val, get: cell.get });
      void nm; void ic;
    });
    const gear = squareBtn(this, 'icon-gear.png', 62, () => {
      audio().play('click');
      openSettings(this, () => this.refreshHud());
    });
    gear.setPosition(316, 80);
    const pause = squareBtn(this, 'icon-sleeping-moon.png', 62, () => {
      audio().play('click');
      this.pauseOverlay();
    });
    pause.setPosition(380, 80);
    void w;
  }

  /** Simple pause overlay (mockup has a pause button). */
  private pauseOverlay(): void {
    const { h, cx } = lay(this);
    const root = this.add.container(0, 0).setDepth(400);
    const dim = dimmer(this, 0.6);
    const p = panel(this, 320, 250);
    p.setPosition(cx, h / 2);
    root.add([dim, p]);
    dim.setInteractive().on('pointerup', () => root.destroy());
    const t = titleText(this, cx, h / 2 - 60, 'PAUSED', 44);
    root.add(t);
    const b = button(this, 'Resume', () => {
      audio().play('click');
      root.destroy();
    }, { w: 220, h: 80, fontSize: 30, fireOnDown: true });
    b.setPosition(cx, h / 2 + 50);
    root.add(b);
  }

  /** Bottom hint banner (mockup's empty parchment banner, made useful). */
  private hintText: Phaser.GameObjects.Text | null = null;

  private buildHintBar(): void {
    const y = 640;
    const p = panel(this, 244, 88);
    p.setPosition(130, y);
    this.hintText = this.add.text(130, y, '', {
      fontFamily: F_BODY, fontSize: '19px', color: '#5a4a3a', align: 'center',
      wordWrap: { width: 220 },
    }).setOrigin(0.5);
    const c1 = img(this, 'ornament-corner.png').setDisplaySize(34, 34)
      .setPosition(22, y + 30);
    const c2 = img(this, 'ornament-corner.png').setDisplaySize(34, 34)
      .setPosition(238, y + 30).setFlipX(true);
    void c1; void c2; void p;
    this.updateHint();
  }

  private updateHint(): void {
    if (!this.hintText) return;
    const s = state();
    const withered = s.board.filter((c) => c && c.kind === 'withered').length;
    const empty = s.board.filter((c) => !c).length;
    this.hintText.setText(withered > 0 ? 'Merge beside withered tiles to heal them'
      : empty > 0 ? 'Tap the wish pod to grow a sprout'
      : 'Drag a plant onto its twin to merge');
  }

  private buildBoard(w: number, h: number, cx: number): void {
    const boardW = Math.min(w * 0.94, 640);
    this.tile = boardW / BOARD_N;
    this.boardX = cx - boardW / 2;
    this.boardY = 172;
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
      const heart = img(this, 'withered-heart.png')
        .setDisplaySize(this.tile * 0.5, this.tile * 0.5)
        .setPosition(0, -this.tile * 0.05).setVisible(false);
      root.add([shadow, side, top, heart]);
      root.setSize(this.tile, this.tile);
      this.cells.push({ root, top, side, plant: null, heart, kind: 'empty', plantId: null });
    }
  }

  private buildDock(w: number, h: number, cx: number): void {
    // action row: wish pod (spawner) + wishes button, above the tab bar
    const y = 740;
    this.podBtn = this.add.container(70, y).setDepth(10);
    const pod = img(this, 'wish-pod.png').setDisplaySize(96, 96);
    this.podLabel = this.add.text(0, 58, '', {
      fontFamily: F_NUM, fontSize: '22px', color: '#F5E6C8', fontStyle: '700',
    }).setOrigin(0.5);
    this.podBtn.add([pod, this.podLabel]);
    pod.setInteractive(new Phaser.Geom.Rectangle(-48, -48, 96, 96),
      Phaser.Geom.Rectangle.Contains);
    if (pod.input) pod.input.cursor = 'pointer';
    pod.on('pointerup', () => this.trySpawn());
    const wb = button(this, '\u2601 Wishes', () => {
      audio().play('click');
      openWishBoard(this, () => { this.renderBoard(); this.refreshHud(); });
    }, { w: 170, h: 72, fontSize: 28, fireOnDown: true });
    wb.setPosition(300, y);
    navDock(this, 'board');
    void w; void cx;
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
      const wFrame = kind === 'withered' ? 'tile-withered.png' : 'tile-parchment.png';
      v.top.setTexture(atlasFor(wFrame), wFrame);
      v.side.setTexture(atlasFor(wFrame), wFrame);
      v.heart.setVisible(kind === 'withered');
      v.kind = kind;
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
    for (const h of this.hudVals) h.val.setText(fmt(h.get()));
    this.updateHint();
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
