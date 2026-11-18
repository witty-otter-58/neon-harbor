// Shell: game loop, overlays, save/load, pause, screenshot staging.
import { CFG } from './config.js';
import { PHASE, newState, startGame, step, autopilot } from './world.js';
import { render } from './render.js';
import { createInput } from './input.js';
import { applyShot } from './shots.js';
import { ensureAudio, toggleMute, setEngine, stopEngine } from './audio.js';

const SAVE_KEY = 'neon-harbor-save';
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = createInput(canvas);
const state = newState(7);

const $ = (id) => document.getElementById(id);
const overlays = {
  title: $('ov-title'), pause: $('ov-pause'),
  busted: $('ov-busted'), wasted: $('ov-wasted'),
};

function show(name) {
  for (const [k, el] of Object.entries(overlays)) el.classList.toggle('show', k === name);
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: state.player.money,
      mission: state.mission,
      x: Math.round(state.player.x),
      y: Math.round(state.player.y),
      health: state.player.health,
    }));
  } catch { /* private mode */ }
}

// Continue is only offered when a save exists.
const save = loadSave();
if (!save) $('btn-continue').style.display = 'none';

function launch(fresh) {
  ensureAudio();
  startGame(state, fresh ? null : loadSave());
  show(null);
}

$('btn-start').addEventListener('click', () => launch(true));
$('btn-continue').addEventListener('click', () => launch(false));
$('btn-resume').addEventListener('click', () => {
  state.phase = PHASE.PLAY;
  show(null);
});
$('btn-busted').addEventListener('click', () => {
  state.phase = PHASE.PLAY;
  show(null);
});
$('btn-wasted').addEventListener('click', () => {
  state.phase = PHASE.PLAY;
  show(null);
});

input.onKey = (code) => {
  if (code === 'KeyM') {
    const m = toggleMute();
    document.querySelector('.sub').textContent = m ? 'muted — press M to unmute' : 'an open-world crime story · drive, steal, run';
  }
  if (code === 'KeyP') {
    if (state.phase === PHASE.PLAY) { state.phase = PHASE.PAUSE; show('pause'); }
    else if (state.phase === PHASE.PAUSE) { state.phase = PHASE.PLAY; show(null); }
  }
  if (code === 'Enter' && state.phase === PHASE.TITLE) launch(true);
  if (code === 'Enter' && (state.phase === PHASE.BUSTED || state.phase === PHASE.WASTED)) {
    state.phase = PHASE.PLAY;
    show(null);
  }
  if (code === 'KeyR' && state.phase === PHASE.PLAY && state.mission === 3) launch(true);
};

// Screenshot staging: ?shot=title|drive|chase|mission runs the real game fast.
const shot = new URLSearchParams(location.search).get('shot');
let staged = false;
let freezeAfterStage = false;
if (shot) {
  try {
    applyShot(state, input, shot);
    staged = true;
    freezeAfterStage = shot === 'mission';
    if (state.phase === PHASE.PLAY) show(null);
  } catch (err) {
    console.error('shot staging failed', err);
  }
}

let last = performance.now();
let prevPhase = state.phase;
let saveT = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state.phase === PHASE.TITLE) {
    step(state, input, dt);
  } else if (state.phase === PHASE.PLAY) {
    if (staged && !freezeAfterStage) {
      autopilot(state, input);
      step(state, input, dt);
    } else if (!staged) {
      step(state, input, dt);
    }
    // Periodic autosave while playing.
    saveT += dt;
    if (saveT > 10 || state.saveDirty) {
      saveT = 0;
      state.saveDirty = false;
      saveGame();
    }
    // Engine hum follows the driven car.
    const car = state.player.inCar;
    setEngine(car ? Math.abs(car.speed) / CFG.CAR.maxSpeed : 0);
  } else {
    stopEngine();
  }
  if (state.phase !== prevPhase) {
    if (state.phase === PHASE.BUSTED) show('busted');
    else if (state.phase === PHASE.WASTED) show('wasted');
    else if (state.phase === PHASE.PAUSE) show('pause');
    else if (state.phase === PHASE.PLAY) show(null);
    prevPhase = state.phase;
  }
  render(ctx, state);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
