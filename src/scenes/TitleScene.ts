import Phaser from 'phaser';
import { audio, coverBg, lay, state } from '../ctx.js';
import { button, F_BODY, img, titleText } from '../ui.js';
import { saveGame } from '../save.js';

export class TitleScene extends Phaser.Scene {
  constructor() { super('title'); }

  create(): void {
    const { w, h, cx } = lay(this);
    coverBg(this, 'bg-title-art');
    this.add.rectangle(0, 0, w, h, 0x12101d, 0.25).setOrigin(0);

    const ribbon = img(this, 'ribbon-banner.png');
    ribbon.setDisplaySize(Math.min(w * 0.86, 620), 120);
    ribbon.setPosition(cx, h * 0.30);
    titleText(this, cx, h * 0.30 - 2, 'BLOOMVERSE', 54);
    titleText(this, cx, h * 0.30 + 52, '✦ Twilight Haven ✦', 30, '#E8A87C');

    this.add.text(cx, h * 0.44,
      'Restore the withered conservatory.\nGrant the spirits\' wishes.\nGrow your moonlit grove.', {
      fontFamily: F_BODY, fontSize: '28px', color: '#F5E6C8', align: 'center',
      lineSpacing: 10,
    }).setOrigin(0.5);

    const s = state();
    const label = s.stats.playSeconds > 60 || s.wishDeckIndex > 0 ? 'Continue' : 'Begin';
    const b = button(this, label, () => {
      audio().unlock();
      audio().play('click');
      audio().startAmbient();
      this.scene.start('board');
    }, { w: 320, h: 104, fontSize: 38 });
    b.setPosition(cx, h * 0.62);

    this.add.text(cx, h * 0.94, 'a cozy fantasy merge tale · v1.0', {
      fontFamily: F_BODY, fontSize: '20px', color: '#B9A7E6',
    }).setOrigin(0.5);

    saveGame(s);
  }
}
