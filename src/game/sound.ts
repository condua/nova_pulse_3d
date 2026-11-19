import { MapId, WeaponId } from './types';

type MusicMode = 'NONE' | 'MENU' | 'GAMEPLAY' | 'BOSS';

/**
 * Procedural Web Audio API synthesizer with separate Music & SFX buses,
 * menu/gameplay/boss dynamic BGM loops, per-map ambient soundscapes,
 * distinct 6-weapon fire audio, and full combat/reward cues.
 */
export class SoundEngine {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private enabled = true;
  private musicVolume = 0.45;
  private sfxVolume = 0.78;

  private musicMode: MusicMode = 'NONE';
  private musicTimerId: number | null = null;
  private musicStep = 0;

  private ambientSource: AudioBufferSourceNode | null = null;
  private ambientFilter: BiquadFilterNode | null = null;
  private ambientGain: GainNode | null = null;
  private currentMap: MapId = 'FUTURE_CITY';

  public configure(enabled: boolean, musicVolume: number, sfxVolume: number): void {
    this.enabled = enabled;
    this.musicVolume = Math.max(0, Math.min(1, musicVolume));
    this.sfxVolume = Math.max(0, Math.min(1, sfxVolume));

    if (this.ctx && this.sfxGain && this.musicGain) {
      const now = this.ctx.currentTime;
      this.sfxGain.gain.setTargetAtTime(
        this.enabled ? this.sfxVolume * 0.55 : 0,
        now,
        0.02
      );
      this.musicGain.gain.setTargetAtTime(
        this.enabled ? this.musicVolume * 0.34 : 0,
        now,
        0.04
      );
    }
  }

  public unlock(): void {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    this.ensureAmbientStarted();
    if (this.musicMode !== 'NONE' && this.musicTimerId === null) {
      this.startMusicLoop();
    }
  }

  public setMusicMode(mode: MusicMode): void {
    if (this.musicMode === mode) return;
    this.musicMode = mode;
    this.musicStep = 0;
    if (this.musicTimerId !== null) {
      window.clearInterval(this.musicTimerId);
      this.musicTimerId = null;
    }
    if (mode !== 'NONE' && this.ctx) {
      this.startMusicLoop();
    }
  }

  public setMapAmbience(mapId: MapId): void {
    this.currentMap = mapId;
    if (!this.ambientFilter || !this.ambientGain || !this.ctx) return;
    const now = this.ctx.currentTime;
    switch (mapId) {
      case 'DESERT_BASE':
        // Warm wind sweep
        this.ambientFilter.type = 'bandpass';
        this.ambientFilter.frequency.setTargetAtTime(420, now, 0.25);
        this.ambientFilter.Q.setTargetAtTime(1.4, now, 0.25);
        this.ambientGain.gain.setTargetAtTime(0.08, now, 0.25);
        break;
      case 'SPACE_STATION':
        // Deep low orbital hull hum
        this.ambientFilter.type = 'lowpass';
        this.ambientFilter.frequency.setTargetAtTime(160, now, 0.25);
        this.ambientFilter.Q.setTargetAtTime(3.2, now, 0.25);
        this.ambientGain.gain.setTargetAtTime(0.11, now, 0.25);
        break;
      case 'JUNGLE_FACILITY':
        // Soft rushing waterfall & canopy breeze
        this.ambientFilter.type = 'bandpass';
        this.ambientFilter.frequency.setTargetAtTime(760, now, 0.25);
        this.ambientFilter.Q.setTargetAtTime(0.7, now, 0.25);
        this.ambientGain.gain.setTargetAtTime(0.075, now, 0.25);
        break;
      case 'CYBER_ARENA':
        // Energetic crisp high-tech room shimmer
        this.ambientFilter.type = 'bandpass';
        this.ambientFilter.frequency.setTargetAtTime(300, now, 0.25);
        this.ambientFilter.Q.setTargetAtTime(2.6, now, 0.25);
        this.ambientGain.gain.setTargetAtTime(0.07, now, 0.25);
        break;
      default:
        // FUTURE_CITY distant skyline hum
        this.ambientFilter.type = 'lowpass';
        this.ambientFilter.frequency.setTargetAtTime(240, now, 0.25);
        this.ambientFilter.Q.setTargetAtTime(1.2, now, 0.25);
        this.ambientGain.gain.setTargetAtTime(0.07, now, 0.25);
        break;
    }
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.enabled ? this.sfxVolume * 0.55 : 0;
      this.sfxGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.enabled ? this.musicVolume * 0.34 : 0;
      this.musicGain.connect(this.ctx.destination);

      this.noiseBuffer = this.createNoiseBuffer(this.ctx, 2.0);
    }
    return this.ctx;
  }

  private createNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private ensureAmbientStarted(): void {
    if (!this.ctx || !this.musicGain || !this.noiseBuffer || this.ambientSource) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    gain.gain.value = 0.06;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    src.start();

    this.ambientSource = src;
    this.ambientFilter = filter;
    this.ambientGain = gain;
    this.setMapAmbience(this.currentMap);
  }

  private startMusicLoop(): void {
    if (this.musicTimerId !== null) {
      window.clearInterval(this.musicTimerId);
      this.musicTimerId = null;
    }
    if (this.musicMode === 'NONE') return;

    const stepMs =
      this.musicMode === 'MENU' ? 360 : this.musicMode === 'BOSS' ? 145 : 175;

    this.musicTimerId = window.setInterval(() => {
      if (!this.enabled || !this.ctx || !this.musicGain || this.ctx.state !== 'running') {
        return;
      }
      if (this.musicVolume <= 0.01) return;
      this.playMusicStep();
    }, stepMs);
  }

  private playMusicStep(): void {
    if (!this.ctx || !this.musicGain) return;
    const now = this.ctx.currentTime;
    const step = this.musicStep++;

    if (this.musicMode === 'MENU') {
      // Calm futuristic ambient arpeggio (A minor 9th sci-fi vibe)
      const notes = [220, 261.63, 329.63, 392, 493.88, 392, 329.63, 293.66];
      const freq = notes[step % notes.length];
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.14, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(now);
      osc.stop(now + 0.58);

      if (step % 8 === 0) {
        const pad = this.ctx.createOscillator();
        const pGain = this.ctx.createGain();
        pad.type = 'triangle';
        pad.frequency.setValueAtTime(step % 16 === 0 ? 110 : 87.31, now);
        pGain.gain.setValueAtTime(0.001, now);
        pGain.gain.linearRampToValueAtTime(0.16, now + 0.35);
        pGain.gain.exponentialRampToValueAtTime(0.001, now + 2.4);
        pad.connect(pGain);
        pGain.connect(this.musicGain);
        pad.start(now);
        pad.stop(now + 2.5);
      }
      return;
    }

    // Driving sci-fi action bassline + synth lead for Gameplay & Boss
    const isBoss = this.musicMode === 'BOSS';
    const bassSeq = isBoss
      ? [73.42, 73.42, 87.31, 73.42, 65.41, 65.41, 98.0, 82.41]
      : [110, 110, 130.81, 110, 98, 98, 146.83, 130.81];
    const bassFreq = bassSeq[step % bassSeq.length];

    const bass = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const bGain = this.ctx.createGain();
    bass.type = 'sawtooth';
    bass.frequency.setValueAtTime(bassFreq, now);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(isBoss ? 520 : 380, now);
    filter.frequency.exponentialRampToValueAtTime(140, now + 0.14);
    bGain.gain.setValueAtTime(0.001, now);
    bGain.gain.linearRampToValueAtTime(isBoss ? 0.24 : 0.17, now + 0.01);
    bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    bass.connect(filter);
    filter.connect(bGain);
    bGain.connect(this.musicGain);
    bass.start(now);
    bass.stop(now + 0.16);

    // Subtle lead accent every 2nd or 4th beat
    if (step % 2 === 0) {
      const leadNotes = isBoss
        ? [293.66, 349.23, 329.63, 440, 392, 349.23]
        : [440, 523.25, 659.25, 587.33, 523.25, 392];
      const lFreq = leadNotes[(step / 2) % leadNotes.length];
      const lead = this.ctx.createOscillator();
      const lGain = this.ctx.createGain();
      lead.type = 'triangle';
      lead.frequency.setValueAtTime(lFreq, now);
      lGain.gain.setValueAtTime(0.001, now);
      lGain.gain.linearRampToValueAtTime(0.08, now + 0.01);
      lGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      lead.connect(lGain);
      lGain.connect(this.musicGain);
      lead.start(now);
      lead.stop(now + 0.15);
    }

    // Crisp rhythmic pulse kick on downbeats
    if (step % 4 === 0) {
      const kick = this.ctx.createOscillator();
      const kGain = this.ctx.createGain();
      kick.type = 'sine';
      kick.frequency.setValueAtTime(135, now);
      kick.frequency.exponentialRampToValueAtTime(42, now + 0.09);
      kGain.gain.setValueAtTime(0.24, now);
      kGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      kick.connect(kGain);
      kGain.connect(this.musicGain);
      kick.start(now);
      kick.stop(now + 0.11);
    }
  }

  public playWeaponFire(weaponId: WeaponId): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const now = ctx.currentTime;

    if (weaponId === 'LASER') {
      // Crisp high-frequency laser beam slice
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2200, now);
      osc.frequency.exponentialRampToValueAtTime(480, now + 0.17);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.32, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.2);
      return;
    }

    if (weaponId === 'PULSE') {
      // Deep resonant energy shockwave cannon
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'triangle';
      sub.frequency.setValueAtTime(260, now);
      sub.frequency.exponentialRampToValueAtTime(46, now + 0.24);
      subGain.gain.setValueAtTime(0.42, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      sub.connect(subGain);
      subGain.connect(this.sfxGain);
      sub.start(now);
      sub.stop(now + 0.28);

      const over = ctx.createOscillator();
      const oGain = ctx.createGain();
      over.type = 'sawtooth';
      over.frequency.setValueAtTime(640, now);
      over.frequency.exponentialRampToValueAtTime(120, now + 0.18);
      oGain.gain.setValueAtTime(0.18, now);
      oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
      over.connect(oGain);
      oGain.connect(this.sfxGain);
      over.start(now);
      over.stop(now + 0.2);
      return;
    }

    if (weaponId === 'RAPID') {
      // Short snappy light bolt
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(980 + Math.random() * 140, now);
      osc.frequency.exponentialRampToValueAtTime(240, now + 0.065);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 2200;
      gain.gain.setValueAtTime(0.19, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.075);
      return;
    }

    if (weaponId === 'FROST') {
      // Crystalline icy chime + breathy burst
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1650, now);
      osc.frequency.exponentialRampToValueAtTime(840, now + 0.15);
      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.17);
      this.playNoiseBurst(0.14, 3400, 0.12);
      return;
    }

    if (weaponId === 'ELECTRIC') {
      // Crackling electric arc zap
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1500, now);
      osc.frequency.setValueAtTime(720, now + 0.03);
      osc.frequency.setValueAtTime(1880, now + 0.06);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.14);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.16);
      this.playNoiseBurst(0.15, 4200, 0.09);
      return;
    }

    // Default PLASMA blaster
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1180 + Math.random() * 90, now);
    osc.frequency.exponentialRampToValueAtTime(175, now + 0.11);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(380, now + 0.11);
    filter.Q.value = 1.8;

    oscGain.gain.setValueAtTime(0.001, now);
    oscGain.gain.linearRampToValueAtTime(0.3, now + 0.006);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(filter);
    filter.connect(oscGain);
    oscGain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.13);
    this.playNoiseBurst(0.12, 2600, 0.05);
  }

  private playNoiseBurst(gainAmt: number, hpFreq: number, dur: number): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = hpFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainAmt, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start(now);
    noise.stop(now + dur + 0.01);
  }

  public playHit(combo: number, killed: boolean, shielded = false): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    if (shielded) {
      // Metallic deflected energy ping
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.1);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.12);
      return;
    }

    const pitchScale = Math.min(1.65, 1 + Math.max(0, combo - 1) * 0.055);
    const baseFreq = (killed ? 620 : 480) * pitchScale;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = killed ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.18, now + 0.12);
    gain.gain.setValueAtTime(0.26, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (killed ? 0.2 : 0.09));
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.22);

    if (killed) {
      // Bright confirmation harmonic + shatter pop
      const hi = ctx.createOscillator();
      const hiG = ctx.createGain();
      hi.type = 'sine';
      hi.frequency.setValueAtTime(baseFreq * 1.5, now + 0.03);
      hiG.gain.setValueAtTime(0.2, now + 0.03);
      hiG.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      hi.connect(hiG);
      hiG.connect(this.sfxGain);
      hi.start(now + 0.03);
      hi.stop(now + 0.26);
    }
  }

  public playPickup(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const notes = [587.33, 783.99, 1174.66];
    notes.forEach((f, idx) => {
      const t = now + idx * 0.055;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(g);
      g.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  }

  public playBossSpawn(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    // Dramatic deep sci-fi brass/synth warning horn
    const freqs = [92.5, 138.59, 185];
    freqs.forEach((f) => {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.linearRampToValueAtTime(f * 0.94, now + 1.1);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(220, now);
      filter.frequency.linearRampToValueAtTime(980, now + 0.45);
      filter.frequency.exponentialRampToValueAtTime(180, now + 1.15);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.2, now + 0.22);
      g.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      osc.connect(filter);
      filter.connect(g);
      g.connect(this.sfxGain!);
      osc.start(now);
      osc.stop(now + 1.25);
    });
  }

  public playPlayerHit(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(62, now + 0.16);
    g.gain.setValueAtTime(0.24, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  public playRicochet(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(920 + Math.random() * 240, now);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.065);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playJump(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(360, now + 0.1);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  public playLand(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.07);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playMissionComplete(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((freq, i) => {
      const start = now + i * 0.075;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.24, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.36);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(start);
      osc.stop(start + 0.38);
    });
  }

  public playTick(urgent: boolean): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(urgent ? 900 : 660, now);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  public playGameOver(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const notes = [523.25, 440, 392, 329.63];
    notes.forEach((freq, i) => {
      const start = now + i * 0.1;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.22, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.42);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(start);
      osc.stop(start + 0.45);
    });
  }

  public playUiClick(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(740, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.04);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  public dispose(): void {
    if (this.musicTimerId !== null) {
      window.clearInterval(this.musicTimerId);
      this.musicTimerId = null;
    }
    if (this.ambientSource) {
      try {
        this.ambientSource.stop();
      } catch {
        // Ignore
      }
      this.ambientSource = null;
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
      this.sfxGain = null;
      this.musicGain = null;
      this.noiseBuffer = null;
    }
  }
}
