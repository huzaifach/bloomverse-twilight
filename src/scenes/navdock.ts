// Shared bottom tab bar (mockup contract: dark rounded bar, 4 tabs,
// active tab amber).
import Phaser from 'phaser';
import { audio, lay } from '../ctx.js';
import { F_UI, atlasFor, img } from '../ui.js';

export type NavKey = 'board' | 'grove' | 'atlas' | 'wings';

export function navDock(scene: Phaser.Scene, active: NavKey): void {
  const { w, h, cx } = lay(scene);
  const y = h - 46;
  // dark bar
  const bar = scene.add.graphics();
  bar.fillStyle(0x1e1830, 0.94);
  bar.fillRoundedRect(cx - 202, y - 46, 404, 92, 24);
  bar.lineStyle(2, 0x4a3b6b, 0.9);
  bar.strokeRoundedRect(cx - 202, y - 46, 404, 92, 24);
  bar.setDepth(10);
  const items: [NavKey, string, string][] = [
    ['board', 'Board', 'tile-parchment.png'],
    ['grove', 'Grove', 'star-pot.png'],
    ['atlas', 'Atlas', 'icon-stardust.png'],
    ['wings', 'Wings', 'icon-renown.png'],
  ];
  items.forEach(([key, label, icon], i) => {
    const x = cx - 150 + i * 100;
    const isA = key === active;
    const tab = scene.add.container(x, y).setDepth(11);
    if (isA) {
      const bg = scene.add.nineslice(0, 0, atlasFor('button-amber.png'),
        'button-amber.png', 92, 76, 60, 60, 60, 60);
      tab.add(bg);
    }
    const ic = img(scene, icon).setDisplaySize(38, 38).setPosition(0, -14);
    if (isA) ic.setTint(0x3a2410);
    const lb = scene.add.text(0, 20, label, {
      fontFamily: F_UI, fontSize: '18px',
      color: isA ? '#3A2410' : '#B9A7E6', fontStyle: '800',
    }).setOrigin(0.5);
    tab.add([ic, lb]);
    if (!isA) {
      const hit = scene.add.zone(0, 0, 96, 84).setInteractive({ useHandCursor: true });
      tab.add(hit);
      hit.on('pointerup', () => { audio().play('click'); scene.scene.start(key); });
    }
  });
  void w;
}
