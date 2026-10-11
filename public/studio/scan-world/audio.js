/**
 * Optional, voice-free procedural sound for the scanner world.
 *
 * const sound = new ScannerAudio(); // Silent: does not create an AudioContext.
 * soundButton.onclick = async () => { await sound.enable(); };
 * sound.update({ mode: 'world', speed: 0.4, scale: 1, scan: 0.5, time: seconds });
 * sound.cue('hop');
 *
 * Call enable() directly from an explicit sound-toggle gesture. It resolves to
 * false when Web Audio is unavailable or the browser cannot resume audio.
 * scale runs from 0 (desk size) to 1 (microscopic); speed and scan are 0..1.
 * update() is safe to call each animation frame, including while disabled.
 * disable() fades out then suspends; dispose() fades out and releases resources.
 * No recording, downloads, dependencies, or automatic audio permission prompts.
 */

const clamp = (value, min = 0, max = 1) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

const CUE_GAP = {
  enter: 1.7, exit: 1.4, hop: 0.18, land: 0.13, landmark: 2.2, shutter: 0.16,
};

export class ScannerAudio {
  constructor() {
    this.enabled = false;
    this._context = null;
    this._disposed = false;
    this._generation = 0;
    this._suspendTimer = null;
    this._loops = [];
    this._voices = new Set();
    this._lastCue = new Map();
    this._state = { mode: 'home', speed: 0, scale: 0, scan: 0, time: 0 };
    this._lastUpdate = null;
    this._stepDistance = 0;
    this._stepSide = 1;
  }

  /** Enable only from a user's sound-toggle click, tap, or keyboard activation. */
  async enable() {
    if (this._disposed) return false;
    const version = ++this._generation;
    clearTimeout(this._suspendTimer);
    try {
      if (!this._context) {
        const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AudioContextClass) return false;
        this._context = new AudioContextClass({ latencyHint: 'interactive' });
        this._build();
      }
      await this._context.resume();
      if (this._disposed || version !== this._generation) return false;
      if (this._context.state !== 'running') return false;
      this.enabled = true;
      this._lastUpdate = null;
      this._stepDistance = 0;
      this._smooth(this._master.gain, 0.52, 0.12);
      this.update(this._state);
      return true;
    } catch {
      this.enabled = false;
      // A partial construction must not leave a live context behind.
      if (this._context && !this._glowGain) {
        this._context.close().catch(() => {});
        this._context = null;
        this._loops.length = 0;
      }
      return false;
    }
  }

  /** Fade before suspension, so toggling sound never cuts across a waveform. */
  disable() {
    this.enabled = false;
    const version = ++this._generation;
    clearTimeout(this._suspendTimer);
    if (!this._context || this._context.state === 'closed') return;
    this._smooth(this._master.gain, 0, 0.026);
    this._suspendTimer = setTimeout(() => {
      if (version !== this._generation || this._disposed) return;
      this._clearVoices();
      this._context.suspend().catch(() => {});
    }, 180);
  }

  /**
   * @param {{mode?:'home'|'entering'|'world'|'leaving', speed?:number,
   * scale?:number, scan?:number, time?:number}} state
   */
  update(state = {}) {
    this._state = { ...this._state, ...state };
    if (!this.enabled || !this._context || this._context.state !== 'running') return;

    const now = this._context.currentTime;
    const dt = this._lastUpdate === null ? 0 : clamp(now - this._lastUpdate, 0, 0.1);
    this._lastUpdate = now;
    const { mode } = this._state;
    const speed = clamp(this._state.speed);
    const depth = mode === 'home' ? 0 : mode === 'world' ? 1 : clamp(this._state.scale);
    const scan = clamp(this._state.scan);
    const time = Number.isFinite(this._state.time) ? this._state.time : now;
    const motion = 0.5 + 0.5 * Math.sin(time * 0.73);
    const sweep = 0.5 + 0.5 * Math.sin(scan * Math.PI * 2);
    const home = 1 - depth;

    // The scanner slowly becomes a distant, filtered piece of architecture.
    this._smooth(this._motorGain.gain, 0.026 * home + 0.0025 * depth, 0.2);
    this._smooth(this._motorFilter.frequency, 160 + 920 * home, 0.22);
    this._smooth(this._motor.frequency, 56 + sweep * 5 - depth * 24, 0.18);
    this._smooth(this._motorOvertone.frequency, 113 + sweep * 9 - depth * 48, 0.18);
    this._smooth(this._rasterGain.gain, home * (0.012 + sweep * 0.007), 0.14);
    this._smooth(this._rasterFilter.frequency, 470 + 1100 * sweep + depth * 160, 0.2);

    // Microscopic ambience: soft air through fibers, with barely audible glass.
    this._smooth(this._airGain.gain, depth * (0.040 + motion * 0.012 + speed * 0.009), 0.35);
    this._smooth(this._airFilter.frequency, 720 + depth * 1100 + motion * 220, 0.4);
    this._smooth(this._airPan.pan, Math.sin(time * 0.16) * 0.28, 0.5);
    this._smooth(this._roomGain.gain, depth * (0.012 + motion * 0.004), 0.45);
    this._smooth(this._roomFilter.frequency, 310 + motion * 120, 0.4);
    this._smooth(this._glowGain.gain, depth * (0.0038 + Math.sin(time * 0.29) * 0.0011), 0.55);

    // Distance-based foley, independent of frame rate. Pauses discard cadence.
    if (mode === 'world' && speed > 0.075) {
      this._stepDistance += dt * (0.24 + speed * 0.92);
      if (this._stepDistance >= 0.36) {
        this._stepDistance %= 0.36;
        this._step(speed);
      }
    } else {
      this._stepDistance = 0;
    }
  }

  /** Trigger a small, bounded one-shot; calls while disabled are ignored. */
  cue(name) {
    if (!this.enabled || !this._context || this._context.state !== 'running') return;
    if (!Object.hasOwn(CUE_GAP, name)) return;
    const now = this._context.currentTime;
    if (now - (this._lastCue.get(name) ?? -Infinity) < CUE_GAP[name]) return;
    this._lastCue.set(name, now);

    switch (name) {
      case 'enter':
        this._tone({ from: 390, to: 44, duration: 1.8, volume: 0.055, type: 'sine', attack: 0.12 });
        this._noise({ frequency: 4100, to: 370, duration: 1.65, volume: 0.090, attack: 0.25, filter: 'lowpass' });
        this._tone({ from: 1174.66, to: 587.33, delay: 0.12, duration: 1.2, volume: 0.009, attack: 0.09, pan: -0.2 });
        this._tone({ from: 1760, to: 880, delay: 0.19, duration: 1.3, volume: 0.006, attack: 0.10, pan: 0.2 });
        break;
      case 'exit':
        this._noise({ frequency: 390, to: 3300, duration: 1.2, volume: 0.065, attack: 0.22, filter: 'lowpass' });
        this._tone({ from: 62, to: 430, duration: 1.35, volume: 0.042, attack: 0.16 });
        this._tone({ from: 440, to: 880, delay: 0.18, duration: 0.9, volume: 0.007, attack: 0.16, pan: 0.12 });
        break;
      case 'hop':
        this._stepDistance = 0;
        this._noise({ frequency: 1550, to: 2700, duration: 0.16, volume: 0.051, pan: -0.06 });
        this._tone({ from: 160, to: 270, duration: 0.13, volume: 0.024 });
        break;
      case 'land':
        this._stepDistance = 0;
        this._noise({ frequency: 920, to: 440, duration: 0.19, volume: 0.072, filter: 'lowpass' });
        this._tone({ from: 118, to: 53, duration: 0.19, volume: 0.060 });
        break;
      case 'landmark':
        // A small warm major ninth, with a glass partial rather than a UI beep.
        [523.25, 783.99, 1174.66].forEach((frequency, index) => {
          this._tone({ from: frequency, delay: index * 0.115, duration: 1.7 - index * 0.18,
            volume: 0.026 - index * 0.006, attack: 0.012, pan: (index - 1) * 0.2 });
        });
        this._tone({ from: 1444, duration: 0.68, volume: 0.004, pan: -0.2 });
        break;
      case 'shutter':
        this._noise({ frequency: 1800, duration: 0.047, volume: 0.078 });
        this._noise({ frequency: 900, duration: 0.075, delay: 0.055, volume: 0.049 });
        this._tone({ from: 220, to: 98, duration: 0.09, volume: 0.026 });
        break;
    }
  }

  /** Release this instance permanently. Safe to call repeatedly. */
  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this.enabled = false;
    ++this._generation;
    clearTimeout(this._suspendTimer);
    if (!this._context || this._context.state === 'closed') return;
    this._smooth(this._master.gain, 0, 0.015);
    this._suspendTimer = setTimeout(() => {
      this._clearVoices();
      for (const source of this._loops) {
        try { source.stop(); } catch { /* Source may already have ended. */ }
        source.disconnect();
      }
      this._loops.length = 0;
      this._context.close().catch(() => {});
    }, 100);
  }

  _build() {
    const ctx = this._context;
    this._master = ctx.createGain();
    this._master.gain.value = 0;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -22;
    limiter.knee.value = 16;
    limiter.ratio.value = 3;
    limiter.attack.value = 0.009;
    limiter.release.value = 0.24;
    this._master.connect(limiter).connect(ctx.destination);

    // Seeded stereo pink-ish noise is created once; loops never align exactly.
    this._noiseBuffer = ctx.createBuffer(2, Math.floor(ctx.sampleRate * 4.7), ctx.sampleRate);
    let seed = 104729;
    for (let channel = 0; channel < 2; channel += 1) {
      const data = this._noiseBuffer.getChannelData(channel);
      let slow = 0;
      let fast = 0;
      for (let i = 0; i < data.length; i += 1) {
        seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
        const white = seed / 2147483648 - 1;
        slow = slow * 0.985 + white * 0.015;
        fast = fast * 0.7 + white * 0.3;
        data[i] = slow * 2.2 + fast * 0.5 + white * 0.055;
      }
      // Tiny edge fades remove discontinuities where the noise buffer loops.
      const seam = Math.min(256, Math.floor(data.length / 8));
      for (let i = 0; i < seam; i += 1) {
        const blend = Math.sin((i / seam) * Math.PI * 0.5);
        data[i] *= blend;
        data[data.length - 1 - i] *= blend;
      }
    }

    this._motorGain = this._gain(0);
    this._motorFilter = this._filter('lowpass', 900, 0.35);
    this._motorFilter.connect(this._motorGain).connect(this._master);
    this._motor = this._oscillator('triangle', 56, this._motorFilter);
    const overtoneGain = this._gain(0.18);
    overtoneGain.connect(this._motorFilter);
    this._motorOvertone = this._oscillator('sine', 113, overtoneGain);

    this._rasterGain = this._gain(0);
    this._rasterFilter = this._filter('bandpass', 1000, 0.65);
    this._rasterFilter.connect(this._rasterGain).connect(this._master);
    this._loopNoise(this._rasterFilter, 1.03);

    this._airGain = this._gain(0);
    this._airFilter = this._filter('bandpass', 1550, 0.45);
    this._airPan = ctx.createStereoPanner();
    this._airFilter.connect(this._airGain).connect(this._airPan).connect(this._master);
    this._loopNoise(this._airFilter, 0.71);

    this._roomGain = this._gain(0);
    this._roomFilter = this._filter('lowpass', 360, 0.4);
    this._roomFilter.connect(this._roomGain).connect(this._master);
    this._loopNoise(this._roomFilter, 0.39);

    this._glowGain = this._gain(0);
    this._glowGain.connect(this._master);
    this._oscillator('sine', 146.83, this._glowGain);
    const upperGlow = this._gain(0.28);
    upperGlow.connect(this._glowGain);
    this._oscillator('sine', 220.23, upperGlow);
  }

  _gain(volume) {
    const node = this._context.createGain();
    node.gain.value = volume;
    return node;
  }

  _filter(type, frequency, q = 0.5) {
    const filter = this._context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    return filter;
  }

  _oscillator(type, frequency, destination) {
    const oscillator = this._context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    oscillator.connect(destination);
    oscillator.start();
    this._loops.push(oscillator);
    return oscillator;
  }

  _loopNoise(destination, rate) {
    const source = this._context.createBufferSource();
    source.buffer = this._noiseBuffer;
    source.loop = true;
    source.playbackRate.value = rate;
    source.connect(destination);
    source.start();
    this._loops.push(source);
  }

  _smooth(parameter, value, seconds) {
    const now = this._context.currentTime;
    // Replacing the target avoids piling up automation during long visits.
    parameter.cancelScheduledValues(now);
    parameter.setTargetAtTime(value, now, seconds);
  }

  _step(speed) {
    this._stepSide *= -1;
    const pan = this._stepSide * 0.14;
    const variation = 0.9 + Math.random() * 0.2;
    this._noise({ frequency: 760 * variation, to: 440, duration: 0.10,
      volume: (0.028 + speed * 0.022) * variation, pan });
    this._tone({ from: 112 * variation, to: 65, duration: 0.075,
      volume: 0.015 + speed * 0.013, pan });
  }

  _envelope(gain, start, duration, volume, attack) {
    gain.setValueAtTime(0, start);
    gain.linearRampToValueAtTime(volume, start + Math.min(attack, duration * 0.25));
    gain.exponentialRampToValueAtTime(0.00001, start + duration);
    gain.linearRampToValueAtTime(0, start + duration + 0.012);
  }

  _voice(source, nodes, start, duration, offset) {
    const voice = { source, nodes };
    this._voices.add(voice);
    source.onended = () => {
      for (const node of nodes) node.disconnect();
      source.disconnect();
      this._voices.delete(voice);
    };
    if (offset === undefined) source.start(start);
    else source.start(start, offset);
    source.stop(start + duration + 0.025);
  }

  _tone({ from, to = from, duration = 0.2, volume = 0.03,
    delay = 0, attack = 0.006, type = 'sine', pan = 0 }) {
    if (this._voices.size >= 20) return;
    const ctx = this._context;
    const start = ctx.currentTime + delay;
    const source = ctx.createOscillator();
    source.type = type;
    source.frequency.setValueAtTime(from, start);
    source.frequency.exponentialRampToValueAtTime(to, start + duration);
    const gain = this._gain(0);
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    this._envelope(gain.gain, start, duration, volume, attack);
    source.connect(gain).connect(panner).connect(this._master);
    this._voice(source, [gain, panner], start, duration);
  }

  _noise({ frequency = 1000, to = frequency, duration = 0.15, volume = 0.04,
    delay = 0, attack = 0.004, filter = 'bandpass', pan = 0 }) {
    if (this._voices.size >= 20) return;
    const ctx = this._context;
    const start = ctx.currentTime + delay;
    const source = ctx.createBufferSource();
    source.buffer = this._noiseBuffer;
    source.loop = true;
    const material = this._filter(filter, frequency, 0.65);
    material.frequency.setValueAtTime(frequency, start);
    material.frequency.exponentialRampToValueAtTime(to, start + duration);
    const gain = this._gain(0);
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    this._envelope(gain.gain, start, duration, volume, attack);
    source.connect(material).connect(gain).connect(panner).connect(this._master);
    this._voice(source, [material, gain, panner], start, duration, Math.random() * 3);
  }

  _clearVoices() {
    for (const { source, nodes } of this._voices) {
      source.onended = null;
      try { source.stop(); } catch { /* Stopped during a previous fade. */ }
      source.disconnect();
      for (const node of nodes) node.disconnect();
    }
    this._voices.clear();
    this._lastCue.clear();
  }
}
