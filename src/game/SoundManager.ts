export class SoundManager {
  private static audioCtx: AudioContext | null = null;
  private static masterGain: GainNode | null = null;
  private static initialized = false;
  private static sharedNoiseBuffer: AudioBuffer | null = null;
  private static cachedDistortionCurve: Float32Array | null = null;

  static init() {
    if (this.initialized) return;
    try {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = 0.4; // Global volume
      this.masterGain.connect(this.audioCtx.destination);
      this.getSharedNoiseBuffer(this.audioCtx);
      this.getDistortionCurve();
      this.initialized = true;
    } catch (e) {
      console.warn("AudioContext not supported", e);
    }
  }

  private static getSharedNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.sharedNoiseBuffer) {
      const bufferSize = ctx.sampleRate * 2.0; // 2 seconds pre-baked noise
      this.sharedNoiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = this.sharedNoiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }
    return this.sharedNoiseBuffer;
  }

  private static createNoiseSource(ctx: AudioContext): AudioBufferSourceNode {
    const source = ctx.createBufferSource();
    source.buffer = this.getSharedNoiseBuffer(ctx);
    source.loop = true;
    return source;
  }

  static playExplosion(size: 'small' | 'medium' | 'large', pitchShift: number = 1.0) {
    if (!this.audioCtx || !this.masterGain) return;
    
    const t = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    
    // Reuse pre-allocated shared noise buffer
    const noiseSource = this.createNoiseSource(this.audioCtx);
    
    // Filter for noise to make it bassy/crunchy
    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    
    // Characteristics based on size
    let duration = 0.3;
    let baseFreq = 100;
    let filterFreq = 800;
    let volumeMult = 1.0;
    
    if (size === 'large') {
      duration = 1.5;
      baseFreq = 30;
      filterFreq = 2000; // Harsher
      volumeMult = 2.5; // Louder
      osc.type = 'sawtooth'; // More aggressive thump
    } else if (size === 'small') {
      duration = 0.15;
      baseFreq = 250;
      filterFreq = 1500;
      osc.type = 'sine';
    } else {
      osc.type = 'sine';
    }
    
    // Add some random variation
    duration *= 0.8 + Math.random() * 0.4;
    baseFreq *= (0.9 + Math.random() * 0.2) * pitchShift;
    filterFreq *= (0.9 + Math.random() * 0.2) * pitchShift;
    
    filter.frequency.setValueAtTime(filterFreq, t);
    filter.frequency.exponentialRampToValueAtTime(10 * pitchShift, t + duration);
    
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(1 * pitchShift, t + duration);
    
    const thumpGain = this.audioCtx.createGain();
    thumpGain.gain.setValueAtTime(1 * volumeMult, t);
    thumpGain.gain.exponentialRampToValueAtTime(0.01, t + duration * 0.5);
    
    gain.gain.setValueAtTime(1 * volumeMult, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + duration);
    
    // Distortion for large explosion
    if (size === 'large') {
      const distortion = this.audioCtx.createWaveShaper();
      distortion.curve = this.makeDistortionCurve(400); // Heavy distortion
      distortion.oversample = '4x';
      
      osc.connect(thumpGain);
      thumpGain.connect(distortion);
      
      noiseSource.connect(filter);
      filter.connect(distortion);
      
      distortion.connect(gain);
    } else {
      osc.connect(thumpGain);
      thumpGain.connect(gain);
      
      noiseSource.connect(filter);
      filter.connect(gain);
    }
    
    gain.connect(this.masterGain);
    
    osc.start(t);
    osc.stop(t + duration);
    noiseSource.start(t);
    noiseSource.stop(t + duration);
  }
  
  static playPlayerExplosion() {
    if (!this.audioCtx || !this.masterGain) return;
    
    const t = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    
    const bufferSize = this.audioCtx.sampleRate * 4.0;
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noiseSource = this.audioCtx.createBufferSource();
    noiseSource.buffer = buffer;
    
    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    
    // Very dramatic and long
    let duration = 3.0;
    
    filter.frequency.setValueAtTime(3000, t);
    filter.frequency.exponentialRampToValueAtTime(10, t + duration);
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(50, t);
    osc.frequency.exponentialRampToValueAtTime(1, t + duration);
    
    const thumpGain = this.audioCtx.createGain();
    thumpGain.gain.setValueAtTime(4.0, t);
    thumpGain.gain.exponentialRampToValueAtTime(0.01, t + duration * 0.4);
    
    gain.gain.setValueAtTime(3.0, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + duration);
    
    const distortion = this.audioCtx.createWaveShaper();
    distortion.curve = this.makeDistortionCurve(600); // Extremely heavy distortion
    distortion.oversample = '4x';
    
    osc.connect(thumpGain);
    thumpGain.connect(distortion);
    
    noiseSource.connect(filter);
    filter.connect(distortion);
    
    distortion.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(t);
    osc.stop(t + duration);
    noiseSource.start(t);
    noiseSource.stop(t + duration);
  }

  static playShieldHit() {
    if (!this.audioCtx || !this.masterGain) return;
    
    const t = this.audioCtx.currentTime;
    
    // Power down wobbly synth
    const osc = this.audioCtx.createOscillator();
    const lfo = this.audioCtx.createOscillator();
    const lfoGain = this.audioCtx.createGain();
    const gain = this.audioCtx.createGain();
    const filter = this.audioCtx.createBiquadFilter();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.6);
    
    // Add LFO for a "failing" wobbly effect
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(30, t);
    lfo.frequency.linearRampToValueAtTime(2, t + 0.6);
    
    lfoGain.gain.setValueAtTime(100, t);
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3000, t);
    filter.frequency.exponentialRampToValueAtTime(100, t + 0.6);
    
    gain.gain.setValueAtTime(1.0, t);
    gain.gain.linearRampToValueAtTime(0.01, t + 0.6);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(t);
    lfo.start(t);
    osc.stop(t + 0.6);
    lfo.stop(t + 0.6);
    
    // Add static/shatter noise
    const noise = this.createNoiseSource(this.audioCtx);
    const noiseFilter = this.audioCtx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 800;
    
    const noiseGain = this.audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.8, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
    
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noise.start(t);
    noise.stop(t + 0.4);
  }

  private static makeDistortionCurve(amount: number) {
    const k = typeof amount === 'number' ? amount : 50,
      n_samples = 44100,
      curve = new Float32Array(n_samples),
      deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = i * 2 / n_samples - 1;
      curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  private static getDistortionCurve(): Float32Array {
    if (!this.cachedDistortionCurve) {
      this.cachedDistortionCurve = this.makeDistortionCurve(50);
    }
    return this.cachedDistortionCurve;
  }

  static playMissile() {
    if (!this.audioCtx || !this.masterGain) return;
    
    const t = this.audioCtx.currentTime;
    const gain = this.audioCtx.createGain();
    const osc = this.audioCtx.createOscillator();
    
    // Shared noise buffer for whoosh
    const noiseSource = this.createNoiseSource(this.audioCtx);
    
    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, t);
    filter.frequency.exponentialRampToValueAtTime(1500, t + 0.3);
    
    // Bold whoosh sound
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.3);
    
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(1.5, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
    
    noiseSource.connect(filter);
    filter.connect(gain);
    osc.connect(gain);
    
    gain.connect(this.masterGain);
    
    noiseSource.start(t);
    noiseSource.stop(t + 0.4);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  static playPlayerFire(pitchShift: number = 1.0) {
    if (!this.audioCtx || !this.masterGain) return;
    const t = this.audioCtx.currentTime;

    // 1. Heavy mechanical low-frequency thud / motor punch (sawtooth pitch drop)
    const osc = this.audioCtx.createOscillator();
    const oscGain = this.audioCtx.createGain();

    osc.type = 'sawtooth';
    const startFreq = (360 + Math.random() * 40) * pitchShift;
    const endFreq = (55 + Math.random() * 10) * pitchShift;
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + 0.09);

    // Lowpass filter for deep mechanical gun weight
    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1600 * pitchShift, t);
    filter.frequency.exponentialRampToValueAtTime(220 * pitchShift, t + 0.09);

    oscGain.gain.setValueAtTime(0.5, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    // 2. Muzzle burst / Ballistic crack (shared noise through bandpass filter)
    const noise = this.createNoiseSource(this.audioCtx);

    const noiseFilter = this.audioCtx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.Q.value = 1.8;
    noiseFilter.frequency.setValueAtTime((1800 + Math.random() * 300) * pitchShift, t);
    noiseFilter.frequency.exponentialRampToValueAtTime(350 * pitchShift, t + 0.08);

    const noiseGain = this.audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.4, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    // 3. Metallic breach / action snap (square wave transient)
    const snapOsc = this.audioCtx.createOscillator();
    const snapGain = this.audioCtx.createGain();
    snapOsc.type = 'square';
    snapOsc.frequency.setValueAtTime(850 * pitchShift, t);
    snapOsc.frequency.exponentialRampToValueAtTime(140 * pitchShift, t + 0.03);
    snapGain.gain.setValueAtTime(0.25, t);
    snapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

    // Waveshaper for aggressive mechanical bite - uses pre-cached curve
    const waveShaper = this.audioCtx.createWaveShaper();
    waveShaper.curve = this.getDistortionCurve() as any;

    osc.connect(filter);
    filter.connect(oscGain);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);

    snapOsc.connect(snapGain);

    oscGain.connect(waveShaper);
    noiseGain.connect(waveShaper);
    snapGain.connect(waveShaper);

    const mainGain = this.audioCtx.createGain();
    mainGain.gain.setValueAtTime(0.55, t);

    waveShaper.connect(mainGain);
    mainGain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.09);

    noise.start(t);
    noise.stop(t + 0.08);

    snapOsc.start(t);
    snapOsc.stop(t + 0.03);
  }

  static playEnemyFire(pitchShift: number = 1.0) {
    if (!this.audioCtx || !this.masterGain) return;
    const t = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(800 * pitchShift, t);
    osc.frequency.exponentialRampToValueAtTime(100 * pitchShift, t + 0.15);
    
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(t);
    osc.stop(t + 0.15);
  }

  static playTurretFire(pitchShift: number = 1.0) {
    if (!this.audioCtx || !this.masterGain) return;
    const t = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400 * pitchShift, t);
    osc.frequency.exponentialRampToValueAtTime(50 * pitchShift, t + 0.25);
    
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(t);
    osc.stop(t + 0.25);
  }

  static playBloop(pitchShift: number = 1.0) {
    if (!this.audioCtx || !this.masterGain) return;
    const t = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400 * pitchShift, t);
    osc.frequency.exponentialRampToValueAtTime(800 * pitchShift, t + 0.1);
    
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(t);
    osc.stop(t + 0.1);
  }

  static playPowerup() {
    if (!this.audioCtx || !this.masterGain) return;
    
    const t = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    
    osc.type = 'sine';
    // Arpeggio
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.setValueAtTime(554.37, t + 0.05); // C#
    osc.frequency.setValueAtTime(659.25, t + 0.1);  // E
    osc.frequency.setValueAtTime(880, t + 0.15);    // A
    
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.setValueAtTime(0.5, t + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(t);
    osc.stop(t + 0.4);
  }

  static playLaunchMission() {
    if (!this.audioCtx || !this.masterGain) return;
    const t = this.audioCtx.currentTime;
    
    // Main engine roar (Noise)
    const roarGain = this.audioCtx.createGain();
    const noiseSource = this.createNoiseSource(this.audioCtx);
    
    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(100, t);
    filter.frequency.exponentialRampToValueAtTime(4000, t + 2.0); // Filter opens up as it launches
    
    roarGain.gain.setValueAtTime(0, t);
    roarGain.gain.linearRampToValueAtTime(1.5, t + 0.5);
    roarGain.gain.exponentialRampToValueAtTime(0.01, t + 3.0);
    
    noiseSource.connect(filter);
    filter.connect(roarGain);
    roarGain.connect(this.masterGain);
    
    // Rising pitch thruster whine (Oscillators)
    const whineGain = this.audioCtx.createGain();
    whineGain.gain.setValueAtTime(0, t);
    whineGain.gain.linearRampToValueAtTime(0.8, t + 0.8);
    whineGain.gain.exponentialRampToValueAtTime(0.01, t + 3.0);

    const osc1 = this.audioCtx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(50, t);
    osc1.frequency.exponentialRampToValueAtTime(800, t + 2.0); // Rising pitch

    const osc2 = this.audioCtx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(51, t); // Slight detune
    osc2.frequency.exponentialRampToValueAtTime(810, t + 2.0);

    osc1.connect(whineGain);
    osc2.connect(whineGain);
    whineGain.connect(this.masterGain);

    noiseSource.start(t);
    osc1.start(t);
    osc2.start(t);

    noiseSource.stop(t + 3.0);
    osc1.stop(t + 3.0);
    osc2.stop(t + 3.0);
  }

  static playHyperspace() {
    if (!this.audioCtx || !this.masterGain) return;
    const t = this.audioCtx.currentTime;
    const gain = this.audioCtx.createGain();
    
    // Sci-fi hyperspace zoom
    const osc = this.audioCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(50, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 1.0);
    
    const noiseSource = this.createNoiseSource(this.audioCtx);
    
    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 5;
    filter.frequency.setValueAtTime(200, t);
    filter.frequency.exponentialRampToValueAtTime(4000, t + 1.0);
    
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(1.5, t + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 1.5);
    
    osc.connect(gain);
    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(t);
    osc.stop(t + 1.5);
    noiseSource.start(t);
    noiseSource.stop(t + 1.5);
  }
}
