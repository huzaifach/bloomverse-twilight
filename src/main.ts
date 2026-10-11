import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { BoardScene } from './scenes/BoardScene.js';
import { GroveScene } from './scenes/GroveScene.js';
import { AtlasScene } from './scenes/AtlasScene.js';
import { WingsScene } from './scenes/WingsScene.js';
import { PERF } from './config.js';

// DPR cap for Mali-class GPUs: Phaser reads window.devicePixelRatio once at
// boot, so clamp it just for construction, then restore.
const rawDpr = window.devicePixelRatio || 1;
const cappedDpr = Math.min(rawDpr, PERF.maxDpr);
try {
  Object.defineProperty(window, 'devicePixelRatio', { value: cappedDpr, configurable: true });
} catch { /* non-configurable — accept native DPR */ }

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#12101D',
  scale: {
    // Fixed portrait design canvas: identical layout on every phone.
    // 420x920 covers 360–420px devices via uniform FIT scaling.
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 420,
    height: 920,
  },
  render: { antialias: false, pixelArt: false },
  fps: { target: 60, min: 30 },
  disableContextMenu: true,
  scene: [BootScene, TitleScene, BoardScene, GroveScene, AtlasScene, WingsScene],
};

// Landscape hint
function checkRotate(): void {
  const el = document.getElementById('rotate-hint');
  if (!el) return;
  const land = window.innerWidth > window.innerHeight * 1.2;
  el.style.display = land ? 'flex' : 'none';
}
window.addEventListener('resize', checkRotate);
checkRotate();

new Phaser.Game(config);
