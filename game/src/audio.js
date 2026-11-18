// Synthesized sound effects with WebAudio — no audio files needed.
// Every function is a no-op when there is no window (headless Node tests).
let ctx = null;
let muted = false;
let engineNodes = null;

export function ensureAudio() {
  if (typeof window === 'undefined') return;
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

export function toggleMute() { muted = !muted; return muted; }
export function isMuted() { return muted; }

function tone(freq, dur, type, vol, slideTo, delay = 0) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, vol, filterFreq, delay = 0) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = filterFreq;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(t);
}

export function sfxShot() { noise(0.12, 0.25, 1800); tone(160, 0.08, 'square', 0.12, 60); }
export function sfxHit() { tone(220, 0.07, 'sawtooth', 0.08, 110); }
export function sfxPickup() { tone(660, 0.09, 'sine', 0.09, 990); }
export function sfxCash() { tone(880, 0.1, 'sine', 0.09); tone(1320, 0.14, 'sine', 0.09, null, 0.09); }
export function sfxJingle() { tone(523, 0.12, 'sine', 0.09); tone(659, 0.12, 'sine', 0.09, null, 0.11); tone(784, 0.22, 'sine', 0.09, null, 0.22); }
export function sfxCrash() { noise(0.25, 0.3, 500); tone(90, 0.2, 'sawtooth', 0.12, 40); }
export function sfxBusted() { tone(330, 0.3, 'sawtooth', 0.1, 165); tone(220, 0.5, 'sawtooth', 0.1, 110, 0.25); }
export function sfxSirenBlip() { tone(700, 0.18, 'sine', 0.05, 950); }
export function sfxReload() { tone(440, 0.06, 'square', 0.05); tone(550, 0.06, 'square', 0.05, null, 0.08); }
export function sfxDoor() { tone(180, 0.08, 'square', 0.07, 120); }

// A two-tone police siren loop, started/stopped with the wanted level.
let sirenTimer = null;
export function startSiren() {
  if (typeof window === 'undefined' || !ctx || sirenTimer) return;
  let high = true;
  sirenTimer = setInterval(() => {
    if (muted) return;
    tone(high ? 750 : 950, 0.4, 'sine', 0.028);
    high = !high;
  }, 400);
}
export function stopSiren() {
  if (sirenTimer) { clearInterval(sirenTimer); sirenTimer = null; }
}

// A low engine hum whose pitch follows the player's car speed.
export function setEngine(speedNorm) {
  if (typeof window === 'undefined' || !ctx || muted) { stopEngine(); return; }
  if (!engineNodes) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.value = 55;
    g.gain.value = 0;
    o.connect(g).connect(ctx.destination);
    o.start();
    engineNodes = { o, g };
  }
  engineNodes.o.frequency.value = 55 + speedNorm * 90;
  engineNodes.g.gain.value = speedNorm > 0.02 ? 0.02 + speedNorm * 0.02 : 0;
}
export function stopEngine() {
  if (engineNodes) {
    try { engineNodes.o.stop(); } catch { /* already stopped */ }
    engineNodes = null;
  }
}
