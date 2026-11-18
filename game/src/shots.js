// ?shot=title|drive|chase|mission — stage a real scene for screenshots.
// The autopilot plays by the real rules; nothing is faked, only driven faster.
import { PHASE, newState, startGame, step, autopilot } from './world.js';
import { CFG } from './config.js';

export function applyShot(state, input, shot) {
  if (shot === 'title') {
    // Live city behind the title overlay: the TITLE phase already drifts
    // the camera and runs the traffic.
    return;
  }
  if (shot === 'drive') {
    startGame(state, null);
    runAutopilot(state, input, 12);
    return;
  }
  if (shot === 'chase') {
    startGame(state, null);
    runAutopilot(state, input, 8);
    // The heat is on: three stars, police closing in.
    state.wanted = 3;
    state.crimeT = 0;
    runAutopilot(state, input, 14);
    return;
  }
  if (shot === 'mission') {
    startGame(state, null);
    // Play the real story until the delivery lands, then stop at once so the
    // "MISSION COMPLETE" toast is still fresh when the shot is taken.
    const dt = 1 / 60;
    let guard = 0;
    while (guard++ < 150 * 60) {
      if (state.mission === 2) break;
      if (state.phase !== PHASE.PLAY) break;
      autopilot(state, input);
      step(state, input, dt);
    }
    return;
  }
}

// Drive the autopilot for up to maxSeconds of game time, several steps per
// call so a full drive finishes in well under a second of wall time.
function runAutopilot(state, input, maxSeconds) {
  const dt = 1 / 60;
  let guard = 0;
  const maxSteps = maxSeconds * 60;
  while (guard++ < maxSteps) {
    if (state.phase !== PHASE.PLAY) break;
    autopilot(state, input);
    step(state, input, dt);
  }
}
