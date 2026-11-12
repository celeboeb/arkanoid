const NOTES = {
  tap: { f: 540, d: 0.05, slide: 640 },
  rotate: { f: 620, d: 0.07, slide: 760 },
  place: { f: 480, d: 0.08, slide: 640 },
  pour: { f: 420, d: 0.18, slide: 280 },
  push: { f: 300, d: 0.06, slide: 240 },
  undo: { f: 360, d: 0.07, slide: 280 },
  soft: { f: 240, d: 0.12, slide: 200 },
  win: { f: 523, d: 0.16, slide: 784 },
};

export function createHubAudio() {
  let ctx = null;
  let master = null;
  let enabled = true;

  function ac() {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = enabled ? 0.18 : 0;
        master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch {
      return null;
    }
  }

  function play(name) {
    if (!enabled) return;
    const note = NOTES[name] || NOTES.tap;
    const c = ac();
    if (!c || !master) return;
    const t = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    const filter = c.createBiquadFilter();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(note.f, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, note.slide), t + note.d);
    filter.type = 'lowpass';
    filter.frequency.value = 1800;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + note.d);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + note.d + 0.02);
    if (name === 'win') {
      const osc2 = c.createOscillator();
      const gain2 = c.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659, t + 0.12);
      osc2.frequency.exponentialRampToValueAtTime(880, t + 0.36);
      gain2.gain.setValueAtTime(0.0001, t + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.16, t + 0.16);
      gain2.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
      osc2.connect(gain2);
      gain2.connect(master);
      osc2.start(t + 0.12);
      osc2.stop(t + 0.46);
    }
  }

  return {
    unlock() {
      ac();
    },
    setEnabled(value) {
      enabled = Boolean(value);
      if (master) master.gain.value = enabled ? 0.18 : 0;
    },
    play,
  };
}

export function haptic(pattern, enabled) {
  if (!enabled || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* some browsers throw */
  }
}
