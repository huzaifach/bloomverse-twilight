import Phaser from 'phaser';
import { audio, coverBg, data, lay, needBg, state } from '../ctx.js';
import { attachDebug } from '../debug.js';
import { F_BODY, F_NUM, F_UI, img, namePill, panel, squareBtn, fmt,
         atlasFor } from '../ui.js';
import { openSettings, plantInfo } from './overlays.js';
import { navDock } from './navdock.js';

export class AtlasScene extends Phaser.Scene {
  constructor() { super('atlas'); }

  preload(): void {
    needBg(this, 'bg-astral-dome');
  }

  /** Split a name into two balanced lines for the card pill. */
  private twoLine(name: string): string {
    const words = name.split(' ');
    if (words.length < 2) return name;
    let best = 0, bestDiff = 1e9;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' ').length;
      const b = words.slice(i).join(' ').length;
      const diff = Math.abs(a - b);
      if (diff < bestDiff) { bestDiff = diff; best = i; }
    }
    return words.slice(0, best).join(' ') + '\n' + words.slice(best).join(' ');
  }

  create(): void {
    const { w, h, cx } = lay(this);
    coverBg(this, 'bg-astral-dome');
    this.add.rectangle(0, 0, w, h, 0x12101d, 0.35).setOrigin(0);

    const s = state(), d = data();
    // Mockup header: dark panel, back, big title, count, progress bar.
    const entries: { id: string; name: string; art: string; tier: number }[] = [];
    for (const f of d.families)
      for (const t of f.tiers) entries.push({ id: t.id, name: t.name, art: t.art, tier: t.tier });
    for (const hb of d.hybrids) entries.push({ id: hb.id, name: hb.name, art: hb.art, tier: 9 });
    const found = entries.filter((e) => s.discovered.includes(e.id)).length;
    const hp = panel(this, 404, 196, true);
    hp.setPosition(cx, 108);
    const backBg = this.add.nineslice(48, 52, atlasFor('button-amber.png'),
      'button-amber.png', 56, 56, 60, 60, 60, 60);
    const arrow = this.add.text(48, 50, '←', {
      fontFamily: F_UI, fontSize: '34px', color: '#3A2410', fontStyle: '800',
    }).setOrigin(0.5);
    backBg.setInteractive(new Phaser.Geom.Rectangle(-28, -28, 56, 56),
      Phaser.Geom.Rectangle.Contains);
    if (backBg.input) backBg.input.cursor = 'pointer';
    backBg.on('pointerdown', () => { audio().play('click'); this.scene.start('board'); });
    void arrow;
    const ttl = this.add.text(cx + 20, 52, 'STAR ATLAS', {
      fontFamily: F_UI, fontSize: '36px', color: '#F5E6C8', fontStyle: '800',
    }).setOrigin(0.5);
    void ttl;
    const prog = this.add.text(cx, 108,
      `PROGRESS • ${found}/${entries.length} DISCOVERED`, {
      fontFamily: F_UI, fontSize: '20px', color: '#B9A7E6', fontStyle: '700',
    }).setOrigin(0.5);
    void prog;
    const track = this.add.graphics();
    track.fillStyle(0x0e0c18, 1);
    track.fillRoundedRect(cx - 180, 138, 360, 26, 13);
    const fill = this.add.graphics();
    fill.fillStyle(0xb9a7e6, 1);
    const fw = Math.max(26, 360 * (entries.length ? found / entries.length : 0));
    fill.fillRoundedRect(cx - 180, 138, fw, 26, 13);
    const sub2 = this.add.text(cx, 188, `${fmt(s.currencies.moondew)} ☾ in the vault`, {
      fontFamily: F_BODY, fontSize: '19px', color: '#6E5A7E',
    }).setOrigin(0.5);
    void sub2;

    // scrollable grid — mockup: dark cards, art, name pill, locked silhouettes
    const cols = 3, cellW = Math.min(w * 0.92, 390) / cols, cellH = 216;
    const rows = Math.ceil(entries.length / cols);
    const gridH = rows * cellH;
    const viewY = 226, viewH = h - 226 - 116;
    const content = this.add.container(cx, viewY);
    entries.forEach((e, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      const x = (c - (cols - 1) / 2) * cellW, y = r * cellH + 96;
      const card = this.add.container(x, y);
      const known = s.discovered.includes(e.id);
      // dark card
      const bgc = this.add.graphics();
      bgc.fillStyle(known ? 0x241d3d : 0x141021, 0.94);
      bgc.fillRoundedRect(-cellW / 2 + 5, -100, cellW - 10, 200, 18);
      bgc.lineStyle(2, known ? 0x8f7bd8 : 0x3a2f55, 0.9);
      bgc.strokeRoundedRect(-cellW / 2 + 5, -100, cellW - 10, 200, 18);
      card.add(bgc);
      if (known) {
        const im = this.add.image(0, -28, atlasFor(e.art), e.art)
          .setDisplaySize(104, 104);
        card.add(im);
        im.setInteractive({ useHandCursor: true })
          .on('pointerup', () => { audio().play('click'); plantInfo(this, e.id); });
        const np = namePill(this, `${this.twoLine(e.name)} \u2022 T${e.tier}`, 15);
        np.setScale(Math.min(1, 110 / np.width));
        np.setPosition(0, 62);
        card.add(np);
      } else {
        const im = this.add.image(0, -28, atlasFor(e.art), e.art)
          .setDisplaySize(104, 104).setTintFill(0x0e0c18);
        const lb = this.add.text(0, 56, '??? \u2022 LOCKED', {
          fontFamily: F_UI, fontSize: '16px', color: '#6E5A7E', fontStyle: '800',
        }).setOrigin(0.5);
        card.add([im, lb]);
      }
      content.add(card);
    });
    const maskShape = this.add.rectangle(cx, viewY + viewH / 2, w, viewH, 0xffffff)
      .setVisible(false);
    content.setMask(maskShape.createGeometryMask());

    // drag scroll (deterministic, no inertia randomness)
    let dragging = false, lastY = 0, offY = 0;
    const maxOff = Math.max(0, gridH - viewH + 40);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.y > viewY && p.y < viewY + viewH) { dragging = true; lastY = p.y; }
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!dragging || !p.isDown) return;
      offY = Phaser.Math.Clamp(offY + (p.y - lastY), -maxOff, 0);
      lastY = p.y;
      content.setY(viewY + offY);
    });
    this.input.on('pointerup', () => { dragging = false; });
    void h;
    navDock(this, 'atlas');
    attachDebug(this);
  }
}
