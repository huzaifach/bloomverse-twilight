// Shared bottom nav dock.
import Phaser from 'phaser';
import { audio, lay } from '../ctx.js';
import { PALETTE } from '../config.js';
import { F_UI, img } from '../ui.js';

export type NavKey = 'board' | 'grove' | 'atlas' | 'wings';

export function navDock(scene: Phaser.Scene, active: NavKey): void {
  const { w, h, cx } = lay(scene);
  const y = h - 92;
  const items: [NavKey, string, string][] = [
    ['board', 'Board', 'tile-parchment.png'],
    ['grove', 'Grove', 'star-pot.png'],
    ['atlas', 'Atlas', 'icon-stardust.png'],
    ['wings', 'Wings', 'icon-renown.png'],
  ];
  items.forEach(([key, label, icon], i) => {
    const b = scene.add.container(cx - 195 + i * 130, y).setDepth(10);
    const isA = key === active;
    const bg = scene.add.circle(0, -14, 40, isA ? PALETTE.ember : 0x2a2438, isA ? 1 : 0.85);
    const ic = img(scene, icon).setDisplaySize(52, 52).setPosition(0, -14);
    const lb = scene.add.text(0, 34, label, {
      fontFamily: F_UI, fontSize: '22px', color: '#F5E6C8', fontStyle: '800',
    }).setOrigin(0.5);
    b.add([bg, ic, lb]);
    if (!isA) bg.setInteractive({ useHandCursor: true })
      .on('pointerup', () => { audio().play('click'); scene.scene.start(key); });
  });
  void w;
}
