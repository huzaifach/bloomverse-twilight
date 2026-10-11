import Phaser from 'phaser';
import { audio, coverBg, data, lay, needBg, state } from '../ctx.js';
import { attachDebug } from '../debug.js';
import { F_BODY, F_NUM, F_UI, iconButton, img, Pill, titleText,
         atlasFor } from '../ui.js';
import { openSettings, plantInfo } from './overlays.js';
import { navDock } from './navdock.js';

export class AtlasScene extends Phaser.Scene {
  constructor() { super('atlas'); }

  preload(): void {
    needBg(this, 'bg-astral-dome');
  }

  create(): void {
    const { w, h, cx } = lay(this);
    coverBg(this, 'bg-astral-dome');
    this.add.rectangle(0, 0, w, h, 0x12101d, 0.35).setOrigin(0);

    const s = state(), d = data();
    const moondew = new Pill(this, 'icon-moondew.png', 150);
    moondew.setPosition(83, 42);
    moondew.setValue(s.currencies.moondew);
    const gear = iconButton(this, 'icon-gear.png', 52, () => {
      audio().play('click');
      openSettings(this, () => undefined);
    });
    gear.setPosition(w - 30, 42);
    titleText(this, cx, 102, 'STAR ATLAS', 32);

    // entries: 40 plants + 8 hybrids
    const entries: { id: string; name: string; art: string }[] = [];
    for (const f of d.families)
      for (const t of f.tiers) entries.push({ id: t.id, name: t.name, art: t.art });
    for (const hb of d.hybrids) entries.push({ id: hb.id, name: hb.name, art: hb.art });

    const found = entries.filter((e) => s.discovered.includes(e.id)).length;
    this.add.text(cx, 100, `${found} / ${entries.length} discovered`, {
      fontFamily: F_NUM, fontSize: '28px', color: '#B9A7E6', fontStyle: '700',
    }).setOrigin(0.5);

    // scrollable grid
    const cols = 4, cellW = Math.min(w * 0.9, 620) / cols, cellH = 190;
    const rows = Math.ceil(entries.length / cols);
    const gridH = rows * cellH;
    const viewY = 150, viewH = h - 150 - 200;
    const content = this.add.container(cx, viewY);
    entries.forEach((e, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      const x = (c - (cols - 1) / 2) * cellW, y = r * cellH + 80;
      const known = s.discovered.includes(e.id);
      const card = this.add.container(x, y);
      if (known) {
        const im = this.add.image(0, -24, atlasFor(e.art), e.art)
          .setDisplaySize(120, 120);
        const nm = this.add.text(0, 52, e.name, {
          fontFamily: F_BODY, fontSize: '20px', color: '#F5E6C8', align: 'center',
          wordWrap: { width: cellW - 8 },
        }).setOrigin(0.5, 0);
        card.add([im, nm]);
        im.setInteractive({ useHandCursor: true })
          .on('pointerup', () => { audio().play('click'); plantInfo(this, e.id); });
      } else {
        const im = this.add.image(0, -24, atlasFor(e.art), e.art)
          .setDisplaySize(120, 120).setTintFill(0x0e0c18);
        const q = this.add.text(0, -24, '?', {
          fontFamily: F_UI, fontSize: '52px', color: '#B9A7E6', fontStyle: '800',
        }).setOrigin(0.5);
        const nm = this.add.text(0, 52, '??? veiled', {
          fontFamily: F_BODY, fontSize: '20px', color: '#6E5A7E',
        }).setOrigin(0.5, 0);
        card.add([im, q, nm]);
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
