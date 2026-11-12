const VOICES = {
  neon: { type: 'sawtooth', peak: 0.07, filter: 1400, q: 0.7 },
  classic: { type: 'square', peak: 0.05, filter: 2800, q: 0.4 },
  space: { type: 'triangle', peak: 0.08, filter: 900, q: 0.6 },
  minimal: { type: 'sine', peak: 0.06, filter: 2200, q: 0.2 },
};

const NOTES = {
  launch: { f: 420, d: 0.14, slide: 720 },
  paddle: { f: 560, d: 0.05, slide: 320 },
  break: { f: 740, d: 0.09, slide: 240 },
  hit: { f: 520, d: 0.045, slide: 460 },
  metal: { f: 160, d: 0.08, slide: 90 },
  explode: { f: 120, d: 0.24, slide: 48, noise: 0.35 },
  power: { f: 660, d: 0.18, slide: 1040 },
  bad: { f: 280, d: 0.2, slide: 110 },
  laser: { f: 980, d: 0.045, slide: 1500 },
  life: { f: 523, d: 0.2, slide: 880 },
  die: { f: 240, d: 0.32, slide: 70 },
  clear: { f: 523, d: 0.28, slide: 1046 },
  wall: { f: 280, d: 0.035, slide: 220 },
};

export function createAudio() {
  let ctx = null;
  let master = null;
  let noise = null;
  let theme = 'neon';
  let enabled = true;
  let volume = 0.7;
  let lastWall = 0;
  let lastLaser = 0;

  function ac() {
    try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = enabled ? volume : 0;
      master.connect(ctx.destination);
      const len = Math.floor(ctx.sampleRate * 0.25);
      noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
    } catch {
      return null;
    }
  }

  function play(name) {
    if (!enabled || volume <= 0.001) return;
    const note = NOTES[name];
    if (!note) return;
    const c = ac();
    if (!c || !master) return;
    const nowMs = performance.now();
    if (name === 'wall' && nowMs - lastWall < 45) return;
    if (name === 'laser' && nowMs - lastLaser < 80) return;
    if (name === 'wall') lastWall = nowMs;
    if (name === 'laser') lastLaser = nowMs;

    const voice = VOICES[theme] || VOICES.neon;
    const now = c.currentTime;
    const dur = theme === 'minimal' ? note.d * 1.15 : theme === 'classic' ? note.d * 0.8 : note.d;
    const peak = voice.peak * (name === 'wall' || name === 'laser' ? 0.55 : 1);
    const gain = c.createGain();
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(voice.filter, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, voice.filter * (theme === 'neon' ? 0.45 : 0.75)), now + dur);
    filter.Q.value = voice.q;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    filter.connect(gain);
    gain.connect(master);

    const osc = c.createOscillator();
    osc.type = voice.type;
    osc.frequency.setValueAtTime(note.f, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, note.slide), now + dur);
    osc.connect(filter);
    osc.start(now);
    osc.stop(now + dur + 0.02);

    if (theme === 'space' && (name === 'power' || name === 'clear' || name === 'launch')) {
      const osc2 = c.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(note.f * 1.5, now);
      const g2 = c.createGain();
      g2.gain.setValueAtTime(peak * 0.35, now);
      g2.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc2.connect(g2);
      g2.connect(master);
      osc2.start(now);
      osc2.stop(now + dur + 0.02);
    }

    if ((theme === 'classic' && (name === 'break' || name === 'explode' || name === 'die')) || note.noise) {
      const src = c.createBufferSource();
      src.buffer = noise;
      const ng = c.createGain();
      const npeak = (note.noise || 0.2) * (theme === 'classic' ? 0.28 : 0.16);
      ng.gain.setValueAtTime(npeak, now);
      ng.gain.exponentialRampToValueAtTime(0.0001, now + dur * 0.7);
      const hp = c.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = theme === 'classic' ? 900 : 400;
      src.connect(hp);
      hp.connect(ng);
      ng.connect(master);
      src.start(now);
      src.stop(now + dur);
    }
  }

  return {
    unlock() {
      try {
        ac();
      } catch {
        /* autoplay block */
      }
    },
    setTheme(next) {
      theme = next;
    },
    setEnabled(next) {
      enabled = next;
      if (master) master.gain.value = next ? volume : 0;
    },
    setVolume(next) {
      volume = next;
      if (master && enabled) master.gain.value = next;
    },
    play,
  };
}
