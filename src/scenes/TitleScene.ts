import Phaser from 'phaser';
import { audio, coverBg, lay, state } from '../ctx.js';
import { button, F_BODY, img, titleText } from '../ui.js';
import { saveGame } from '../save.js';
import { attachDebug } from '../debug.js';

// Fixed 420x920 design canvas (FIT scale): every element owns a
// non-overlapping vertical slot — overlap is impossible by construction.
const RIBBON_NATIVE = 629 / 239;

export class TitleScene extends Phaser.Scene {
  constructor() { super('title'); }

  create(): void {
    const { w, h, cx } = lay(this);
    coverBg(this, 'bg-title-art');
    this.add.rectangle(0, 0, w, h, 0x12101d, 0.25).setOrigin(0);

    // Slot 1: ribbon + game title (y 150–300)
    const rw = Math.min(370, w - 50);
    const rh = rw / RIBBON_NATIVE;
    const ribbon = img(this, 'ribbon-banner.png');
    ribbon.setDisplaySize(rw, rh);
    ribbon.setPosition(cx, 225);
    const title = titleText(this, cx, 222, 'BLOOMVERSE', 52);
    if (title.width > rw - 40) title.setFontSize(52 * ((rw - 40) / title.width));
    titleText(this, cx, 222 + rh / 2 + 26, '✦ Twilight Haven ✦', 26, '#E8A87C');

    // Slot 2: tagline (y 400–500)
    this.add.text(cx, 450,
      'Restore the withered conservatory.\nGrant the spirits\' wishes.\nGrow your moonlit grove.', {
      fontFamily: F_BODY, fontSize: '25px', color: '#F5E6C8', align: 'center',
      lineSpacing: 10,
    }).setOrigin(0.5);

    // Slot 3: action button (y 600–700)
    const s = state();
    const label = s.stats.playSeconds > 60 || s.wishDeckIndex > 0 ? 'Continue' : 'Begin';
    const b = button(this, label, () => {
      audio().unlock();
      audio().ensureBank();
      audio().play('click');
      this.scene.start('board');
    }, { w: 300, h: 100, fontSize: 38 });
    b.setPosition(cx, 650);

    // Slot 4: footer (y 880)
    this.add.text(cx, 890, 'a cozy fantasy merge tale · v1.1', {
      fontFamily: F_BODY, fontSize: '19px', color: '#B9A7E6',
    }).setOrigin(0.5);

    saveGame(s);
    attachDebug(this);
  }
}
