// Audio manager: Phaser sound for CC0 files + WebAudio synth for the
// parametric merge-chime pitch escalation. Never silent: synth fallback
// covers any missing file.
import Phaser from 'phaser';

export type SfxName =
  | 'click' | 'merge' | 'tierup' | 'wish' | 'collect' | 'error';

const FILES: Record<SfxName, string> = {
  click: 'click', merge: 'merge', tierup: 'tierup',
  wish: 'wish', collect: 'collect', error: 'error',
};

export class AudioMan {
  private scene: Phaser.Scene;
  private ctx: AudioContext | null = null;
  private musicOn = true;
  private sfxOn = true;
  private bankQueued = false;

  constructor(scene: Phaser.Scene) { this.scene = scene; }

  static queueLoader(load: Phaser.Loader.LoaderPlugin): void {
    for (const k of Object.keys(FILES) as SfxName[])
      load.audio(k, [`assets/audio/${FILES[k]}.ogg`, `assets/audio/${FILES[k]}.mp3`]);
    load.audio('ambient', ['assets/audio/ambient-night.ogg', 'assets/audio/ambient-night.mp3']);
    load.audio('lullaby', ['assets/audio/lullaby.ogg', 'assets/audio/lullaby.mp3']);
  }

  /**
   * Lazy-load the whole audio bank AFTER the first user gesture.
   * Audio never blocks boot: before this runs, play() falls back to synth.
   */
  ensureBank(): void {
    if (this.bankQueued) return;
    this.bankQueued = true;
    try {
      AudioMan.queueLoader(this.scene.load);
      this.scene.load.once(Phaser.Loader.Events.COMPLETE, () => this.startAmbient());
      this.scene.load.start();
    } catch { /* synth fallback covers everything */ }
  }

  unlock(): void {
    if (!this.ctx) {
      try { this.ctx = new AudioContext(); } catch { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  play(name: SfxName): void {
    if (!this.sfxOn) return;
    try {
      if (this.scene.sound.get(name)) this.scene.sound.play(name, { volume: 0.7 });
      else this.synthBlip(440);
    } catch { this.synthBlip(440); }
  }

  /** Parametric merge chime: pitch rises with combo count. Pure synth. */
  mergeChime(combo: number): void {
    if (!this.sfxOn) return;
    const base = 523.25 * Math.pow(2, Math.min(combo, 12) / 12);
    this.synthTone(base, 0.35, 'sine', 0.25);
    this.synthTone(base * 1.5, 0.3, 'sine', 0.15);
  }

  startAmbient(): void {
    try {
      if (this.scene.sound.get('ambient') && this.musicOn)
        this.scene.sound.play('ambient', { loop: true, volume: 0.25 });
      if (this.scene.sound.get('lullaby') && this.musicOn)
        this.scene.sound.play('lullaby', { loop: true, volume: 0.18 });
    } catch { /* ambient is nice-to-have */ }
  }

  toggleMusic(): boolean {
    this.musicOn = !this.musicOn;
    try {
      const s = this.scene.sound as Phaser.Sound.WebAudioSoundManager;
      s.mute = !this.musicOn && !this.sfxOn ? true : false;
    } catch { /* noop */ }
    return this.musicOn;
  }

  toggleSfx(): boolean { this.sfxOn = !this.sfxOn; return this.sfxOn; }
  get sfxEnabled(): boolean { return this.sfxOn; }
  get musicEnabled(): boolean { return this.musicOn; }

  private synthBlip(freq: number): void {
    this.synthTone(freq, 0.12, 'triangle', 0.2);
  }

  private synthTone(freq: number, dur: number, type: OscillatorType, vol: number): void {
    if (!this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + dur + 0.05);
    } catch { /* noop */ }
  }
}
