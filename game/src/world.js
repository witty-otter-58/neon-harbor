// Game state and rules: player, cars, pedestrians, police, wanted level,
// missions. No browser APIs here — a headless Node test imports this file.
import { CFG } from './config.js';
import { mulberry32 } from './random.js';
import { buildCity, onRoad } from './city.js';
import {
  sfxShot, sfxHit, sfxPickup, sfxCash, sfxJingle, sfxCrash,
  sfxBusted, sfxReload, sfxDoor, sfxSirenBlip, startSiren, stopSiren,
} from './audio.js';

export const PHASE = {
  TITLE: 'title', PLAY: 'play', PAUSE: 'pause',
  BUSTED: 'busted', WASTED: 'wasted', COMPLETE: 'complete',
};

const TRAFFIC_COLORS = ['#c23b2e', '#2e6fc2', '#e8c832', '#3fae5a', '#8a5ac2', '#e8e8e8', '#2a2a2a', '#d97b2e'];
const PED_COLORS = ['#e8a87c', '#7fa3b8', '#b87fa3', '#a8b87f', '#d9d9d9', '#8f7fb8'];
const LOOPS = [
  [[300, 300], [2100, 300], [2100, 1500], [300, 1500]],
  [[900, 300], [1500, 300], [1500, 1500], [900, 1500]],
  [[300, 300], [300, 1500], [1500, 1500], [1500, 300]],
];

export function newState(seed = 7) {
  const rng = mulberry32(seed);
  const city = buildCity(seed);
  const state = {
    seed, rng, city,
    time: 0,
    phase: PHASE.TITLE,
    prevPhase: PHASE.TITLE,
    player: {
      x: CFG.PLAYER_START.x, y: CFG.PLAYER_START.y, angle: -Math.PI / 2, r: CFG.PLAYER.r,
      health: CFG.PLAYER.health, money: 0, mag: CFG.PISTOL.magSize, reserve: CFG.PISTOL.reserveStart,
      reloadT: 0, shootCd: 0, ramImmune: 0, inCar: null, aimAngle: -Math.PI / 2, vx: 0, vy: 0,
    },
    cars: [],
    peds: [],
    officers: [],
    bullets: [],
    particles: [],
    wanted: 0,
    crimeT: 0,
    mission: 0,
    missionTimer: 0,
    marker: { x: CFG.DOCKS_PACKAGE.x, y: CFG.DOCKS_PACKAGE.y },
    packageTaken: false,
    pickups: [],
    camera: { x: CFG.PLAYER_START.x, y: CFG.PLAYER_START.y },
    toast: '', toastT: 0,
    titleT: 0,
    bustedCount: 0,
    wastedCount: 0,
    carsStolen: 0,
    pedsDown: 0,
    shotsFired: 0,
    saveDirty: false,
    stuckT: 0,
    reverseT: 0,
    fleeTarget: null,
    fleeT: 0,
    driveRoute: null,
    driveRouteT: 0,
    demoTarget: null,
  };
  // The player's own car, parked by the safehouse.
  state.cars.push({
    id: 0, kind: 'own', x: CFG.OWN_CAR.x, y: CFG.OWN_CAR.y, angle: CFG.OWN_CAR.angle,
    speed: 0, color: '#2ec8b8', hp: 100, disabled: false, ramCd: 0, parked: true,
  });
  // A few stealable parked cars on the streets.
  const parkedSpots = [
    { x: 300, y: 1200, angle: Math.PI / 2 }, { x: 1500, y: 1200, angle: -Math.PI / 2 },
    { x: 2100, y: 600, angle: Math.PI / 2 }, { x: 900, y: 600, angle: -Math.PI / 2 },
  ];
  parkedSpots.forEach((s, i) => {
    state.cars.push({
      id: 1 + i, kind: 'parked', x: s.x, y: s.y, angle: s.angle,
      speed: 0, color: TRAFFIC_COLORS[(i + 2) % TRAFFIC_COLORS.length], hp: 100,
      disabled: false, ramCd: 0, parked: true,
    });
  });
  // Traffic cars on rectangular loops.
  let id = 10;
  for (let l = 0; l < LOOPS.length; l++) {
    for (let k = 0; k < 4; k++) {
      const loop = LOOPS[l];
      const wp = Math.floor(rng() * loop.length);
      const [wx, wy] = loop[wp];
      state.cars.push({
        id: id++, kind: 'traffic', x: wx + (rng() - 0.5) * 40, y: wy + (rng() - 0.5) * 40,
        angle: 0, speed: 0, color: TRAFFIC_COLORS[Math.floor(rng() * TRAFFIC_COLORS.length)],
        hp: 100, disabled: false, ramCd: 0, parked: false,
        loop, wp, cruise: 130 + rng() * 60, reverse: l % 2 === 1,
      });
    }
  }
  // Pedestrians on the sidewalks.
  for (let i = 0; i < CFG.PED_COUNT; i++) {
    state.peds.push(spawnPed(state, true));
  }
  // Pickups: one health at the hospital, ammo at four fixed spots.
  state.pickups.push({ kind: 'health', x: CFG.HEALTH_SPOT.x, y: CFG.HEALTH_SPOT.y, taken: false, respawnT: 0 });
  for (const s of CFG.AMMO_SPOTS) {
    state.pickups.push({ kind: 'ammo', x: s.x, y: s.y, taken: false, respawnT: 0 });
  }
  return state;
}

function spawnPed(state, anywhere = false) {
  const rng = state.rng;
  const vertical = rng() < 0.5;
  let x = 0, y = 0, angle = 0;
  if (vertical) {
    const ax = CFG.AVENUES[Math.floor(rng() * CFG.AVENUES.length)];
    const off = (rng() < 0.5 ? -1 : 1) * (CFG.ROAD_W / 2 + 12);
    x = ax + off;
    y = anywhere ? rng() * CFG.WORLD.h : (rng() < 0.5 ? -20 : CFG.WORLD.h + 20);
    angle = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    const sy = CFG.STREETS[Math.floor(rng() * CFG.STREETS.length)];
    const off = (rng() < 0.5 ? -1 : 1) * (CFG.ROAD_W / 2 + 12);
    y = sy + off;
    x = anywhere ? rng() * CFG.WORLD.w : (rng() < 0.5 ? -20 : CFG.WORLD.w + 20);
    angle = rng() < 0.5 ? 0 : Math.PI;
  }
  return {
    x, y, angle, speed: 42 + rng() * 28, r: 9,
    state: 'walk', fleeT: 0, color: PED_COLORS[Math.floor(rng() * PED_COLORS.length)],
    dead: false, fadeT: 0,
  };
}

export function startGame(state, save = null) {
  const keepMoney = save ? save.money : 0;
  const keepMission = save ? save.mission : 0;
  const fresh = newState(state.seed);
  Object.assign(state, fresh);
  state.phase = PHASE.PLAY;
  if (save) {
    state.player.money = keepMoney;
    state.mission = keepMission;
    state.player.x = save.x;
    state.player.y = save.y;
    if (keepMission >= 1) state.packageTaken = true;
    if (keepMission >= 2) state.missionTimer = 0;
    setMarker(state);
    if (keepMission >= 3) state.mission = 3;
  }
  setMarker(state);
}

function setMarker(state) {
  if (state.mission === 0) state.marker = { x: CFG.DOCKS_PACKAGE.x, y: CFG.DOCKS_PACKAGE.y };
  else if (state.mission === 1) state.marker = { x: CFG.LANTERN.x, y: CFG.LANTERN.y };
  else if (state.mission === 2) state.marker = { x: CFG.SAFEHOUSE.x, y: CFG.SAFEHOUSE.y };
  else state.marker = { x: CFG.SAFEHOUSE.x, y: CFG.SAFEHOUSE.y };
}

export function objectiveText(state) {
  if (state.mission === 0) return 'MISSION 1 — THE PICKUP: collect the package at the docks (south)';
  if (state.mission === 1) return `MISSION 2 — THE DELIVERY: get it to The Lantern (north-east) — ${Math.ceil(state.missionTimer)}s left`;
  if (state.mission === 2) {
    return state.wanted > 0
      ? `MISSION 3 — THE GETAWAY: lose the cops (${state.wanted}★), then reach the safehouse`
      : 'MISSION 3 — THE GETAWAY: cops lost! Reach the safehouse (west)';
  }
  return 'ALL MISSIONS COMPLETE — free roam. Press R to replay the story.';
}

function showToast(state, text, dur = 3) {
  state.toast = text;
  state.toastT = dur;
}

function addWanted(state, n) {
  if (n <= 0) return;
  state.wanted = Math.min(5, state.wanted + n);
  state.crimeT = 0;
  if (state.wanted > 0) startSiren();
}

// --- collisions -------------------------------------------------------------
function solidAt(state, x, y) {
  for (const b of state.city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  for (const c of state.city.containers) {
    if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) return c;
  }
  return null;
}

// Push a circle out of buildings/containers and the world edge. Returns true on hit.
function collideCircle(state, obj, r) {
  let hit = false;
  const solids = [...state.city.buildings, ...state.city.containers];
  for (const s of solids) {
    const nx = Math.max(s.x, Math.min(obj.x, s.x + s.w));
    const ny = Math.max(s.y, Math.min(obj.y, s.y + s.h));
    const dx = obj.x - nx, dy = obj.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        obj.x = nx + (dx / d) * r;
        obj.y = ny + (dy / d) * r;
      } else {
        // Center inside the solid: push out along the shallow axis.
        const l = obj.x - s.x, rr = s.x + s.w - obj.x;
        const t = obj.y - s.y, bb = s.y + s.h - obj.y;
        const m = Math.min(l, rr, t, bb);
        if (m === l) obj.x = s.x - r;
        else if (m === rr) obj.x = s.x + s.w + r;
        else if (m === t) obj.y = s.y - r;
        else obj.y = s.y + s.h + r;
      }
    }
  }
  if (obj.x < r) { obj.x = r; hit = true; }
  if (obj.x > CFG.WORLD.w - r) { obj.x = CFG.WORLD.w - r; hit = true; }
  if (obj.y < r) { obj.y = r; hit = true; }
  if (obj.y > CFG.WORLD.h - r) { obj.y = CFG.WORLD.h - r; hit = true; }
  return hit;
}

// Cars stay on the roads and the open docks: the city blocks are walls for
// them, on top of the buildings. A car that cuts a corner into a block
// wedges itself between buildings and never gets out, so the blocks —
// which are far bigger than any building — push it back onto the road.
// Returns { hit, nx, ny }: the push-out direction of the deepest
// collision (unit vector pointing from the wall into the car), or null
// when nothing was hit. The caller uses the normal to slide: a car
// moving parallel to a wall keeps its speed, one driving head-on into
// it loses it. Quartering the speed on every touch pinned a car against
// a block corner forever — it could never build speed to drive away.
function collideCar(state, car, r) {
  let hit = false, nx = 0, ny = 0, deepest = 0;
  const circ = collideCircle(state, car, r);
  if (circ) {
    hit = true;
    // World edge: the normal points back into the world.
    if (car.x - r < 0) { nx = 1; ny = 0; }
    else if (car.x + r > CFG.WORLD.w) { nx = -1; ny = 0; }
    else if (car.y - r < 0) { nx = 0; ny = 1; }
    else if (car.y + r > CFG.WORLD.h) { nx = 0; ny = -1; }
    deepest = 1;
  }
  for (const b of state.city.blocks) {
    const cx = Math.max(b.x, Math.min(car.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(car.y, b.y + b.h));
    const dx = car.x - cx, dy = car.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      const pen = r - Math.sqrt(d2);
      if (pen > deepest) {
        deepest = pen;
        if (d2 > 0.01) {
          const d = Math.sqrt(d2);
          nx = dx / d; ny = dy / d;
        } else {
          const l = car.x - b.x, rr = b.x + b.w - car.x;
          const t = car.y - b.y, bb = b.y + b.h - car.y;
          const m = Math.min(l, rr, t, bb);
          if (m === l) { nx = -1; ny = 0; }
          else if (m === rr) { nx = 1; ny = 0; }
          else if (m === t) { nx = 0; ny = -1; }
          else { nx = 0; ny = 1; }
        }
      }
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        car.x = cx + (dx / d) * r;
        car.y = cy + (dy / d) * r;
      } else {
        const l = car.x - b.x, rr = b.x + b.w - car.x;
        const t = car.y - b.y, bb = b.y + b.h - car.y;
        const m = Math.min(l, rr, t, bb);
        if (m === l) car.x = b.x - r;
        else if (m === rr) car.x = b.x + b.w + r;
        else if (m === t) car.y = b.y - r;
        else car.y = b.y + b.h + r;
      }
    }
  }
  return hit ? { hit: true, nx, ny } : { hit: false, nx: 0, ny: 0 };
}

// Slide factor: how much speed a car keeps after hitting a wall. Moving
// parallel to the wall keeps it all; head-on keeps 25%.
function slideFactor(car, col) {
  if (!col.hit) return 1;
  const nAngle = Math.atan2(col.ny, col.nx);
  return Math.max(0.25, Math.abs(Math.sin(car.angle - nAngle)));
}

function burst(state, x, y, color, n = 8) {
  for (let i = 0; i < n; i++) {
    const a = state.rng() * Math.PI * 2;
    const sp = 60 + state.rng() * 160;
    state.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.35 + state.rng() * 0.35, color, size: 2 + state.rng() * 3 });
  }
}

function nearestEnterableCar(state) {
  const p = state.player;
  let best = null, bestD = 75;
  for (const c of state.cars) {
    if (c.kind !== 'own' && c.kind !== 'parked') continue;
    if (c.disabled) continue;
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

function enterCar(state, car) {
  const p = state.player;
  p.inCar = car;
  car.parked = false;
  car.speed = 0;
  if (car.kind === 'parked') {
    car.kind = 'stolen';
    state.carsStolen++;
    addWanted(state, 1);
    showToast(state, 'Car stolen — the cops noticed (+1★)', 2.5);
  }
  sfxDoor();
}

function exitCar(state) {
  const p = state.player;
  const car = p.inCar;
  if (!car) return;
  p.inCar = null;
  car.speed = 0;
  car.parked = true;
  // Step out beside the car, trying four sides until one is clear.
  const offs = [[0, -34], [0, 34], [-34, 0], [34, 0]];
  for (const [dx, dy] of offs) {
    const x = car.x + dx, y = car.y + dy;
    if (!solidAt(state, x, y)) { p.x = x; p.y = y; break; }
  }
  p.x = Math.max(p.r, Math.min(CFG.WORLD.w - p.r, p.x));
  p.y = Math.max(p.r, Math.min(CFG.WORLD.h - p.r, p.y));
  sfxDoor();
}

function fireShot(state) {
  const p = state.player;
  if (p.mag <= 0) {
    if (p.reloadT <= 0 && p.reserve > 0) { p.reloadT = CFG.PISTOL.reloadTime; sfxReload(); }
    return;
  }
  p.mag--;
  p.shootCd = CFG.PISTOL.cooldown;
  state.shotsFired++;
  const a = p.aimAngle;
  state.bullets.push({
    x: p.x + Math.cos(a) * 18, y: p.y + Math.sin(a) * 18,
    vx: Math.cos(a) * CFG.PISTOL.bulletSpeed, vy: Math.sin(a) * CFG.PISTOL.bulletSpeed,
    life: CFG.PISTOL.range / CFG.PISTOL.bulletSpeed, r: 3,
  });
  sfxShot();
  // Witnesses flee; a shot near police is a crime.
  for (const ped of state.peds) {
    if (!ped.dead && Math.hypot(ped.x - p.x, ped.y - p.y) < 320) {
      ped.state = 'flee';
      ped.fleeT = 3;
      ped.angle = Math.atan2(ped.y - p.y, ped.x - p.x);
    }
  }
  const nearCop = state.cars.some((c) => c.kind === 'police' && !c.disabled && Math.hypot(c.x - p.x, c.y - p.y) < 500)
    || state.officers.some((o) => Math.hypot(o.x - p.x, o.y - p.y) < 500);
  if (nearCop) addWanted(state, 1);
}

function respawn(state) {
  const p = state.player;
  if (p.inCar) { p.inCar.parked = true; p.inCar.speed = 0; p.inCar = null; }
  p.x = 330; p.y = CFG.HOSPITAL.y;
  p.health = CFG.PLAYER.health;
  p.mag = CFG.PISTOL.magSize;
  p.reloadT = 0;
  state.wanted = 0;
  state.cars = state.cars.filter((c) => c.kind !== 'police');
  state.officers = [];
  state.bullets = [];
  stopSiren();
  state.camera.x = p.x;
  state.camera.y = p.y;
}

function busted(state) {
  state.bustedCount++;
  state.player.money = Math.max(0, state.player.money - CFG.BUST_FINE);
  respawn(state);
  state.phase = PHASE.BUSTED;
  showToast(state, '', 0);
  sfxBusted();
}

function wasted(state) {
  state.wastedCount++;
  respawn(state);
  state.phase = PHASE.WASTED;
  sfxBusted();
}

function completeMission(state) {
  const p = state.player;
  if (state.mission === 0) {
    state.packageTaken = true;
    p.money += CFG.REWARDS.pickup;
    showToast(state, `MISSION COMPLETE — THE PICKUP  +$${CFG.REWARDS.pickup}`, 3);
    state.mission = 1;
    state.missionTimer = CFG.DELIVERY_TIME_S;
    sfxJingle();
  } else if (state.mission === 1) {
    p.money += CFG.REWARDS.delivery;
    showToast(state, `MISSION COMPLETE — THE DELIVERY  +$${CFG.REWARDS.delivery}`, 3);
    state.mission = 2;
    state.wanted = 3;
    state.crimeT = 0;
    startSiren();
    sfxJingle();
  } else if (state.mission === 2) {
    p.money += CFG.REWARDS.getaway;
    showToast(state, `MISSION COMPLETE — THE GETAWAY  +$${CFG.REWARDS.getaway} — ALL MISSIONS DONE!`, 4);
    state.mission = 3;
    sfxJingle();
  }
  setMarker(state);
  state.saveDirty = true;
}

// --- police -----------------------------------------------------------------
function ensurePolice(state) {
  const want = state.wanted;
  const cops = state.cars.filter((c) => c.kind === 'police');
  if (cops.length < want) {
    const p = state.player;
    const px = p.inCar ? p.inCar.x : p.x;
    const py = p.inCar ? p.inCar.y : p.y;
    for (let i = cops.length; i < want; i++) {
      // Spawn on a road 650–800 px away from the player.
      let x = px, y = py, tries = 0;
      while (tries++ < 20) {
        const a = state.rng() * Math.PI * 2;
        const d = 650 + state.rng() * 150;
        x = px + Math.cos(a) * d;
        y = py + Math.sin(a) * d;
        // Snap to the nearest road.
        let best = null, bestD = 1e9;
        for (const ax of CFG.AVENUES) { const d2 = Math.abs(x - ax); if (d2 < bestD) { bestD = d2; best = { x: ax, y }; } }
        for (const sy of CFG.STREETS) { const d2 = Math.abs(y - sy); if (d2 < bestD) { bestD = d2; best = { x, y: sy }; } }
        if (best) { x = best.x; y = best.y; }
        if (x > 40 && x < CFG.WORLD.w - 40 && y > 40 && y < CFG.WORLD.h - 40) break;
      }
      state.cars.push({
        id: 100 + i + Math.floor(state.time), kind: 'police',
        x: Math.max(40, Math.min(CFG.WORLD.w - 40, x)),
        y: Math.max(40, Math.min(CFG.WORLD.h - 40, y)),
        angle: 0, speed: 0, color: '#1a2a4a', hp: 5, disabled: false,
        ramCd: 0, parked: false, sirenT: 0,
      });
    }
  } else if (cops.length > want) {
    // Remove the farthest extra cops first.
    const p = state.player;
    const px = p.inCar ? p.inCar.x : p.x;
    const py = p.inCar ? p.inCar.y : p.y;
    cops.sort((a, b) => Math.hypot(b.x - px, b.y - py) - Math.hypot(a.x - px, a.y - py));
    for (let i = 0; i < cops.length - want; i++) {
      state.cars = state.cars.filter((c) => c !== cops[i]);
    }
  }
}

function stepPolice(state, dt) {
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  const onFoot = !p.inCar;
  for (const cop of state.cars.filter((c) => c.kind === 'police')) {
    if (cop.disabled) continue;
    if (cop.ramCd > 0) cop.ramCd -= dt;
    const dx = px - cop.x, dy = py - cop.y;
    const dist = Math.hypot(dx, dy) || 1;
    const targetAngle = Math.atan2(dy, dx);
    let diff = targetAngle - cop.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const maxSpeed = Math.min(470, CFG.POLICE.baseSpeed + CFG.POLICE.perStar * state.wanted);
    if (onFoot && dist < 130) {
      // Stop and send an officer on foot.
      cop.speed = Math.max(0, cop.speed - 500 * dt);
      let officer = state.officers.find((o) => o.cop === cop);
      if (!officer) {
        officer = { x: cop.x, y: cop.y, angle: 0, speed: CFG.POLICE.officerSpeed, touchT: 0, r: 11, cop };
        state.officers.push(officer);
      }
    } else {
      cop.angle += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
      cop.speed = Math.min(maxSpeed, cop.speed + 350 * dt);
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
      const col = collideCar(state, cop, CFG.CAR.r);
      if (col.hit) cop.speed *= Math.max(0.3, slideFactor(cop, col));
    }
    cop.sirenT -= dt;
    if (cop.sirenT <= 0) { cop.sirenT = 2.5 + state.rng() * 2; sfxSirenBlip(); }
    // Ram the player's car, or the player on foot. One ram grants a short
    // immunity so three cops together cannot shred the player in seconds.
    if (dist < CFG.CAR.r + (onFoot ? p.r : CFG.CAR.r) + 4 && cop.ramCd <= 0 && p.ramImmune <= 0) {
      cop.ramCd = CFG.POLICE.ramCooldown;
      p.ramImmune = 2.5;
      p.health -= onFoot ? 15 : CFG.POLICE.ramDamage;
      burst(state, px, py, '#ffb347', 10);
      sfxCrash();
      if (p.inCar) {
        const push = Math.atan2(py - cop.y, px - cop.x);
        p.inCar.x += Math.cos(push) * 14;
        p.inCar.y += Math.sin(push) * 14;
      }
      if (p.health <= 0) { wasted(state); return; }
    }
  }
  // Officers chase the player on foot.
  for (let i = state.officers.length - 1; i >= 0; i--) {
    const o = state.officers[i];
    if (p.inCar) {
      // Player drove off — the officer gives up.
      if (Math.hypot(o.x - px, o.y - py) > 500) { state.officers.splice(i, 1); continue; }
    }
    const dx = p.x - o.x, dy = p.y - o.y;
    const dist = Math.hypot(dx, dy) || 1;
    o.angle = Math.atan2(dy, dx);
    o.x += Math.cos(o.angle) * o.speed * dt;
    o.y += Math.sin(o.angle) * o.speed * dt;
    if (dist < 26) {
      o.touchT += dt;
      if (o.touchT >= CFG.POLICE.bustTime) { busted(state); return; }
    } else {
      o.touchT = Math.max(0, o.touchT - dt);
    }
  }
}

// --- main step --------------------------------------------------------------
export function step(state, input, dt) {
  if (state.phase === PHASE.TITLE) {
    state.time += dt;
    state.titleT += dt;
    stepTraffic(state, dt);
    stepPeds(state, dt);
    // Slow cinematic pan across the city.
    state.camera.x = 1200 + Math.sin(state.titleT * 0.07) * 550;
    state.camera.y = 900 + Math.cos(state.titleT * 0.05) * 350;
    return;
  }
  if (state.phase !== PHASE.PLAY) return;
  state.time += dt;
  const p = state.player;

  if (state.toastT > 0) state.toastT -= dt;
  if (p.shootCd > 0) p.shootCd -= dt;
  if (p.ramImmune > 0) p.ramImmune -= dt;

  // --- aim (mouse in world coordinates) ---
  if (input.mouseX !== null && input.mouseX !== undefined && !p.inCar) {
    const wx = state.camera.x - CFG.VIEW.w / 2 + input.mouseX;
    const wy = state.camera.y - CFG.VIEW.h / 2 + input.mouseY;
    p.aimAngle = Math.atan2(wy - p.y, wx - p.x);
  }

  // --- enter / exit car ---
  if (input.interact) {
    input.interact = false;
    if (p.inCar) exitCar(state);
    else {
      const car = nearestEnterableCar(state);
      if (car) enterCar(state, car);
    }
  }

  // --- reload ---
  if (input.reload) {
    input.reload = false;
    if (p.mag < CFG.PISTOL.magSize && p.reserve > 0 && p.reloadT <= 0) {
      p.reloadT = CFG.PISTOL.reloadTime;
      sfxReload();
    }
  }
  if (p.reloadT > 0) {
    p.reloadT -= dt;
    if (p.reloadT <= 0) {
      const need = CFG.PISTOL.magSize - p.mag;
      const take = Math.min(need, p.reserve);
      p.mag += take;
      p.reserve -= take;
    }
  }
  if (p.mag === 0 && p.reserve > 0 && p.reloadT <= 0) {
    p.reloadT = CFG.PISTOL.reloadTime;
    sfxReload();
  }

  // --- shooting ---
  if ((input.action || input.mouseDown) && !p.inCar) fireShot(state);

  // --- movement ---
  if (p.inCar) {
    const car = p.inCar;
    const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    if (input.up) car.speed = Math.min(CFG.CAR.maxSpeed, car.speed + CFG.CAR.accel * dt);
    else if (input.down) {
      if (car.speed > 5) car.speed = Math.max(0, car.speed - CFG.CAR.brake * dt);
      else car.speed = Math.max(-CFG.CAR.maxReverse, car.speed - CFG.CAR.reverseAccel * dt);
    } else {
      car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 260 * dt);
    }
    const spdRaw = Math.max(-1, Math.min(1, car.speed / 300));
    // A car that is barely moving still needs to turn — with steering
    // proportional to speed alone, a car at 2 px/s turns 0.017 rad/s and
    // can never swing around after bumping a wall. Keep 35% bite at low
    // speed (none at a dead stop).
    const spd = Math.sign(spdRaw) * Math.max(0.35, Math.abs(spdRaw));
    // Steering bites less at high speed — a car at full throttle cannot
    // spin 250 degrees in two seconds.
    const grip = 1 - 0.55 * Math.min(1, Math.abs(car.speed) / CFG.CAR.maxSpeed);
    car.angle += steer * spd * CFG.CAR.steer * grip * dt;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    const col = collideCar(state, car, CFG.CAR.r);
    if (col.hit) {
      car.speed *= slideFactor(car, col);
      if (Math.abs(car.speed) > 200) sfxCrash();
    }
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    // Running over a pedestrian is a crime.
    for (const ped of state.peds) {
      if (!ped.dead && Math.hypot(ped.x - car.x, ped.y - car.y) < CFG.CAR.r + ped.r) {
        ped.dead = true;
        ped.fadeT = 4;
        state.pedsDown++;
        burst(state, ped.x, ped.y, '#c23b2e', 12);
        addWanted(state, 1);
        showToast(state, 'You ran over a pedestrian! (+1★)', 2);
        sfxHit();
      }
    }
  } else {
    let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx /= len; my /= len;
      p.x += mx * CFG.PLAYER.walkSpeed * dt;
      p.y += my * CFG.PLAYER.walkSpeed * dt;
      p.angle = Math.atan2(my, mx);
    }
    collideCircle(state, p, p.r);
    p.vx = mx * CFG.PLAYER.walkSpeed;
    p.vy = my * CFG.PLAYER.walkSpeed;
  }

  // --- bullets ---
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && solidAt(state, b.x, b.y)) { burst(state, b.x, b.y, '#e8d44f', 4); dead = true; }
    if (!dead) {
      for (const ped of state.peds) {
        if (!ped.dead && Math.hypot(ped.x - b.x, ped.y - b.y) < ped.r + b.r) {
          ped.dead = true; ped.fadeT = 4;
          state.pedsDown++;
          burst(state, ped.x, ped.y, '#c23b2e', 12);
          addWanted(state, 1);
          sfxHit();
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const o of state.officers) {
        if (Math.hypot(o.x - b.x, o.y - b.y) < o.r + b.r) {
          state.officers = state.officers.filter((x) => x !== o);
          burst(state, o.x, o.y, '#1a2a4a', 12);
          addWanted(state, 1);
          sfxHit();
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const c of state.cars) {
        if (c.kind !== 'police' || c.disabled || c === p.inCar) continue;
        if (Math.hypot(c.x - b.x, c.y - b.y) < CFG.CAR.r + b.r) {
          c.hp -= 1;
          burst(state, b.x, b.y, '#e8d44f', 6);
          addWanted(state, 1);
          sfxHit();
          if (c.hp <= 0) {
            c.disabled = true;
            c.speed = 0;
            burst(state, c.x, c.y, '#555', 20);
          }
          dead = true;
          break;
        }
      }
    }
    if (dead) state.bullets.splice(i, 1);
  }

  // --- particles ---
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const pt = state.particles[i];
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
    if (pt.life <= 0) state.particles.splice(i, 1);
  }

  stepTraffic(state, dt);
  stepPeds(state, dt);
  if (state.phase !== PHASE.PLAY) return;

  // --- pickups ---
  for (const pk of state.pickups) {
    if (pk.taken) {
      pk.respawnT -= dt;
      if (pk.respawnT <= 0) pk.taken = false;
      continue;
    }
    if (Math.hypot(pk.x - p.x, pk.y - p.y) < 34) {
      pk.taken = true;
      pk.respawnT = pk.kind === 'health' ? 20 : 15;
      if (pk.kind === 'health') p.health = Math.min(100, p.health + 50);
      else p.reserve += 24;
      sfxPickup();
      showToast(state, pk.kind === 'health' ? 'Health +50' : 'Ammo +24', 1.5);
    }
  }

  // --- missions ---
  if (state.mission === 0) {
    if (!p.inCar && Math.hypot(p.x - CFG.DOCKS_PACKAGE.x, p.y - CFG.DOCKS_PACKAGE.y) < 45) {
      completeMission(state);
    }
  } else if (state.mission === 1) {
    state.missionTimer -= dt;
    if (Math.hypot(p.x - CFG.LANTERN.x, p.y - CFG.LANTERN.y) < 55) {
      completeMission(state);
    } else if (state.missionTimer <= 0) {
      state.missionTimer = CFG.DELIVERY_TIME_S;
      showToast(state, 'Too slow — the buyer walked. Try again!', 2.5);
    }
  } else if (state.mission === 2) {
    if (state.wanted === 0 && Math.hypot(p.x - CFG.SAFEHOUSE.x, p.y - CFG.SAFEHOUSE.y) < 55) {
      completeMission(state);
    }
  }

  // --- wanted decay ---
  state.crimeT += dt;
  if (state.wanted > 0) {
    const px = p.inCar ? p.inCar.x : p.x;
    const py = p.inCar ? p.inCar.y : p.y;
    const nearCop = state.cars.some((c) => c.kind === 'police' && !c.disabled && Math.hypot(c.x - px, c.y - py) < CFG.WANTED_DECAY_RANGE);
    if (state.crimeT >= CFG.WANTED_DECAY_S && !nearCop) {
      state.wanted--;
      state.crimeT = 0;
      if (state.wanted === 0) stopSiren();
    }
  }

  ensurePolice(state);
  stepPolice(state, dt);
  if (state.phase !== PHASE.PLAY) return;

  // --- camera follows the player ---
  const cx = p.inCar ? p.inCar.x : p.x;
  const cy = p.inCar ? p.inCar.y : p.y;
  state.camera.x += (cx - state.camera.x) * Math.min(1, dt * 6);
  state.camera.y += (cy - state.camera.y) * Math.min(1, dt * 6);
  state.camera.x = Math.max(CFG.VIEW.w / 2, Math.min(CFG.WORLD.w - CFG.VIEW.w / 2, state.camera.x));
  state.camera.y = Math.max(CFG.VIEW.h / 2, Math.min(CFG.WORLD.h - CFG.VIEW.h / 2, state.camera.y));

  if (p.health <= 0) wasted(state);
}

function stepTraffic(state, dt) {
  for (const c of state.cars) {
    if (c.kind !== 'traffic' || c.disabled) continue;
    const target = c.loop[c.wp];
    const dx = target[0] - c.x, dy = target[1] - c.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 24) {
      c.wp = c.reverse ? (c.wp - 1 + c.loop.length) % c.loop.length : (c.wp + 1) % c.loop.length;
      continue;
    }
    const want = Math.atan2(dy, dx);
    let diff = want - c.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    c.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    c.speed = c.cruise;
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    // Running over a pedestrian (traffic does it too, but no wanted for it).
    for (const ped of state.peds) {
      if (!ped.dead && Math.hypot(ped.x - c.x, ped.y - c.y) < CFG.CAR.r + ped.r) {
        ped.dead = true;
        ped.fadeT = 4;
        burst(state, ped.x, ped.y, '#c23b2e', 10);
      }
    }
  }
  // Keep the player's car and police out of traffic cars (soft push).
  const movers = state.cars.filter((c) => c.kind === 'police' || c === state.player.inCar);
  for (const m of movers) {
    for (const t of state.cars) {
      if (t.kind !== 'traffic') continue;
      const dx = m.x - t.x, dy = m.y - t.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.01 && d < CFG.CAR.r * 2) {
        const push = (CFG.CAR.r * 2 - d) / 2;
        m.x += (dx / d) * push;
        m.y += (dy / d) * push;
        t.x -= (dx / d) * push;
        t.y -= (dy / d) * push;
      }
    }
  }
}

function stepPeds(state, dt) {
  for (let i = state.peds.length - 1; i >= 0; i--) {
    const ped = state.peds[i];
    if (ped.dead) {
      ped.fadeT -= dt;
      if (ped.fadeT <= 0) state.peds[i] = spawnPed(state);
      continue;
    }
    if (ped.state === 'flee') {
      ped.fleeT -= dt;
      if (ped.fleeT <= 0) ped.state = 'walk';
    }
    // Step aside for a fast car bearing down — most pedestrians would
    // rather not be a statistic, and it keeps the player's wanted level
    // from climbing every time the autopilot drives down an avenue.
    // 220 px of warning: at 500 px/s a car covers 130 px in a quarter
    // of a second, which is not enough time for a pedestrian to get out
    // of the way, so the flee was triggering after the car had already
    // passed through them.
    if (ped.state !== 'flee') {
      for (const c of state.cars) {
        if (Math.abs(c.speed || 0) < 150) continue;
        const d = Math.hypot(c.x - ped.x, c.y - ped.y);
        if (d < 220) {
          ped.state = 'flee';
          ped.fleeT = 1.6;
          ped.angle = Math.atan2(ped.y - c.y, ped.x - c.x);
          break;
        }
      }
    }
    const sp = ped.state === 'flee' ? 320 : ped.speed;
    ped.x += Math.cos(ped.angle) * sp * dt;
    ped.y += Math.sin(ped.angle) * sp * dt;
    // Turn at intersections sometimes; stay in the world.
    if (onRoad(ped.x, ped.y)) {
      const nearCross = CFG.AVENUES.some((ax) => Math.abs(ped.x - ax) < 60) &&
        CFG.STREETS.some((sy) => Math.abs(ped.y - sy) < 60);
      if (nearCross && state.rng() < dt * 0.5) {
        ped.angle = [0, Math.PI / 2, Math.PI, -Math.PI / 2][Math.floor(state.rng() * 4)];
      }
    }
    if (ped.x < -30 || ped.x > CFG.WORLD.w + 30 || ped.y < -30 || ped.y > CFG.WORLD.h + 30) {
      state.peds[i] = spawnPed(state);
    }
  }
}

// --- autopilot (drives the real rules; used by ?shot= staging and tests) ----
export function autopilot(state, input) {
  const p = state.player;
  input.up = false; input.down = false; input.left = false; input.right = false;
  input.action = false; input.mouseDown = false;
  if (state.phase !== PHASE.PLAY) return;

  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;

  let tx = 0, ty = 0;
  if (state.mission === 0) { tx = CFG.DOCKS_PACKAGE.x; ty = CFG.DOCKS_PACKAGE.y; }
  else if (state.mission === 1) { tx = CFG.LANTERN.x; ty = CFG.LANTERN.y; }
  else if (state.mission === 2) {
    if (state.wanted > 0) {
      // Flee from the nearest cop — but hold one flee direction for a few
      // seconds instead of jerking the wheel every step.
      state.fleeT -= 1 / 60;
      const reached = state.fleeTarget && Math.hypot(state.fleeTarget.x - px, state.fleeTarget.y - py) < 200;
      if (!state.fleeTarget || state.fleeT <= 0 || reached) {
        let nearest = null, nd = 1e9;
        for (const c of state.cars) {
          if (c.kind !== 'police' || c.disabled) continue;
          const d = Math.hypot(c.x - px, c.y - py);
          if (d < nd) { nd = d; nearest = c; }
        }
        if (nearest) {
          const ax = px - nearest.x, ay = py - nearest.y;
          const al = Math.hypot(ax, ay) || 1;
          const nx = ax / al, ny = ay / al;
          // Run along the road the player is already on, in the flee
          // direction: a straight 1500 px run outruns the cops, while a
          // diagonal target forces a turn at every intersection and the
          // cops — who just steer straight at the player — catch up.
          // At the end of a road, turn onto the nearest perpendicular
          // road and keep running instead of U-turning at the world
          // edge: a 180° U-turn at low speed is where the cops catch up
          // and ram, and ping-ponging one street re-commits the same
          // crimes (running over the same pedestrians) that keep the
          // wanted level bouncing back to 3.
          const onAve = CFG.AVENUES.find((a) => Math.abs(px - a) < CFG.ROAD_W / 2);
          const onSt = CFG.STREETS.find((s) => Math.abs(py - s) < CFG.ROAD_W / 2);
          const nearestAve = CFG.AVENUES.reduce((a, b) => Math.abs(b - px) < Math.abs(a - px) ? b : a);
          const nearestSt = CFG.STREETS.reduce((a, b) => Math.abs(b - py) < Math.abs(a - py) ? b : a);
          if (onAve !== undefined && Math.abs(ny) > Math.abs(nx)) {
            let sign = Math.sign(ny);
            const roomN = py - 120, roomS = CFG.WORLD.h - 120 - py;
            if ((sign < 0 && roomN < 400) || (sign > 0 && roomS < 400)) {
              let sSign = Math.sign(nx) || 1;
              const roomW = px - 120, roomE = CFG.WORLD.w - 120 - px;
              if ((sSign < 0 && roomW < 400) || (sSign > 0 && roomE < 400)) sSign = -sSign;
              tx = px + sSign * 1500; ty = nearestSt;
            } else { tx = onAve; ty = py + sign * 1500; }
          } else if (onSt !== undefined && Math.abs(nx) > Math.abs(ny)) {
            let sign = Math.sign(nx);
            const roomW = px - 120, roomE = CFG.WORLD.w - 120 - px;
            if ((sign < 0 && roomW < 400) || (sign > 0 && roomE < 400)) {
              let aSign = Math.sign(ny) || 1;
              const roomN = py - 120, roomS = CFG.WORLD.h - 120 - py;
              if ((aSign < 0 && roomN < 400) || (aSign > 0 && roomS < 400)) aSign = -aSign;
              tx = nearestAve; ty = py + aSign * 1500;
            } else { tx = px + sign * 1500; ty = onSt; }
          } else {
            tx = px + nx * 1500;
            ty = py + ny * 1500;
          }
        } else { tx = CFG.SAFEHOUSE.x; ty = CFG.SAFEHOUSE.y; }
        state.fleeTarget = {
          x: Math.max(120, Math.min(CFG.WORLD.w - 120, tx)),
          y: Math.max(120, Math.min(CFG.WORLD.h - 120, ty)),
        };
        // Hold one escape direction for 8 seconds: re-picking every 3 s
        // made the car zigzag and brake at every turn, and the cops —
        // who just steer straight at the player — kept catching up.
        state.fleeT = 8;
      }
      tx = state.fleeTarget.x;
      ty = state.fleeTarget.y;
    } else { tx = CFG.SAFEHOUSE.x; ty = CFG.SAFEHOUSE.y; }
  } else {
    tx = CFG.SAFEHOUSE.x; ty = CFG.SAFEHOUSE.y;
  }

  const distT = Math.hypot(tx - px, ty - py);

  if (p.inCar) {
    const car = p.inCar;
    // Exit when close to a walk-only target (the package).
    if (state.mission === 0 && distT < 70) { input.interact = true; return; }
    if (state.mission === 2 && state.wanted === 0 && distT < 70) { input.interact = true; return; }
    // Steer toward a lookahead point on the route, not the target in a
    // straight line — the blocks between the roads are solid buildings.
    const wp = pursuitTarget(state, car, tx, ty);
    const want = Math.atan2(wp.y - car.y, wp.x - car.x);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    // Stuck detection: pressing up but barely moving.
    if (input.up && Math.abs(car.speed) < 25) state.stuckT += 1 / 60;
    else state.stuckT = 0;
    if (state.stuckT > 1.2) {
      state.reverseT = 2.0;
      state.stuckT = 0;
      state.driveRouteT = 0; // re-plan the route from the new position
    }
    if (state.reverseT > 0) {
      // Back straight out the way the car came in — steering while
      // reversing only spins it deeper into the corner.
      state.reverseT -= 1 / 60;
      input.down = true;
      input.left = false;
      input.right = false;
      return;
    }
    input.left = diff < -0.1;
    input.right = diff > 0.1;
    // Final approach: brake so the car stops at the target instead of
    // overshooting it into a wall or the edge of the world. Creep to
    // within 50 px — the exit radius is 70.
    const wpDist = Math.hypot(wp.x - car.x, wp.y - car.y);
    if (wp.final && wpDist < 260) {
      if (Math.abs(car.speed) > 60) input.down = true;
      else input.up = wpDist > 50;
      return;
    }
    // Grid driving: only go fast when the car is lined up with the
    // pursuit point. For a big turn, brake to a crawl and creep around
    // it — a fast car that keeps its foot down while steering hard spins
    // out, and a car that is 2 px off the road drives straight into the
    // block wall beside it. Never reverse to turn (see above).
    if (Math.abs(diff) > 0.35) {
      if (Math.abs(car.speed) > 60) input.down = true;
      else input.up = true;
    } else {
      input.up = true;
    }
    return;
  }

  // On foot.
  const car = nearestEnterableCar(state);
  if (car && distT > 220) {
    // Walk to the car first.
    const dx = car.x - p.x, dy = car.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d < 55) { input.interact = true; return; }
    walkToward(input, dx / d, dy / d);
    return;
  }
  const dx = tx - p.x, dy = ty - p.y;
  const d = Math.hypot(dx, dy) || 1;
  walkToward(input, dx / d, dy / d);
}

function walkToward(input, nx, ny) {
  input.up = ny < -0.3;
  input.down = ny > 0.3;
  input.left = nx < -0.3;
  input.right = nx > 0.3;
}

// --- road navigation for driving --------------------------------------------
// The city is a grid: avenues x streets. BFS over the 12 intersections gives
// a route that stays on roads instead of ramming through buildings.
function computeRoute(car, tx, ty) {
  const axs = CFG.AVENUES, sys = CFG.STREETS;
  const node = (ai, si) => ({ x: axs[ai], y: sys[si], ai, si });
  const nearestNode = (x, y) => {
    let best = null, bd = 1e18;
    for (let ai = 0; ai < axs.length; ai++) {
      for (let si = 0; si < sys.length; si++) {
        const d = Math.abs(axs[ai] - x) + Math.abs(sys[si] - y);
        if (d < bd) { bd = d; best = node(ai, si); }
      }
    }
    return best;
  };
  // The target's nearest point on a road: the route ends there, then cuts
  // straight to the target across open ground (the docks) — never diagonally
  // across a block of buildings.
  let roadPoint = null, rd = 1e18;
  for (const ax of axs) { const d = Math.abs(tx - ax); if (d < rd) { rd = d; roadPoint = { x: ax, y: ty }; } }
  for (const sy of sys) { const d = Math.abs(ty - sy); if (d < rd) { rd = d; roadPoint = { x: tx, y: sy }; } }
  const start = nearestNode(car.x, car.y);
  // Goal: the intersection that gives the shortest whole route (car to node
  // plus node to the road point), not just the nearest node to the target —
  // a tie there used to send the car west down a street it had just come up.
  let goal = null, gc = 1e18;
  for (let ai = 0; ai < axs.length; ai++) {
    for (let si = 0; si < sys.length; si++) {
      const c = Math.abs(axs[ai] - car.x) + Math.abs(sys[si] - car.y)
        + Math.abs(axs[ai] - roadPoint.x) + Math.abs(sys[si] - roadPoint.y);
      if (c < gc) { gc = c; goal = node(ai, si); }
    }
  }
  // BFS.
  const key = (n) => `${n.ai},${n.si}`;
  const prev = new Map();
  const seen = new Set([key(start)]);
  const queue = [start];
  while (queue.length) {
    const n = queue.shift();
    if (n.ai === goal.ai && n.si === goal.si) break;
    const next = [];
    if (n.ai > 0) next.push(node(n.ai - 1, n.si));
    if (n.ai < axs.length - 1) next.push(node(n.ai + 1, n.si));
    if (n.si > 0) next.push(node(n.ai, n.si - 1));
    if (n.si < sys.length - 1) next.push(node(n.ai, n.si + 1));
    for (const m of next) {
      if (seen.has(key(m))) continue;
      seen.add(key(m));
      prev.set(key(m), n);
      queue.push(m);
    }
  }
  // Walk back from the goal.
  const path = [];
  let cur = goal;
  let guard = 0;
  while (cur && guard++ < 30) {
    path.unshift({ x: cur.x, y: cur.y });
    if (cur.ai === start.ai && cur.si === start.si) break;
    cur = prev.get(key(cur));
  }
  // If the car is off-road (docks, parking), first drive to the nearest
  // point on a road before following the intersections.
  const onRoadNow = axs.some((ax) => Math.abs(car.x - ax) < CFG.ROAD_W / 2) ||
    sys.some((sy) => Math.abs(car.y - sy) < CFG.ROAD_W / 2);
  const points = [];
  if (!onRoadNow) {
    let best = null, bd = 1e18;
    for (const ax of axs) { const d = Math.abs(car.x - ax); if (d < bd) { bd = d; best = { x: ax, y: car.y }; } }
    for (const sy of sys) { const d = Math.abs(car.y - sy); if (d < bd) { bd = d; best = { x: car.x, y: sy }; } }
    if (best) points.push(best);
  }
  for (const pt of path) {
    // Skip a path node the car has already passed — but only within 30 px:
    // a node 60–100 px away is the one that pulls the car onto the road's
    // centerline, and skipping it leaves the car 2 px off the avenue,
    // driving straight into the block wall beside it.
    if (Math.hypot(pt.x - car.x, pt.y - car.y) < 30) continue;
    points.push(pt);
  }
  points.push(roadPoint);
  points.push({ x: tx, y: ty });
  return points;
}

// Pure pursuit: steer toward a point a fixed distance ahead along the
// route polyline, instead of chasing the nearest waypoint. Chasing
// waypoints one at a time oscillated the car at every corner — brake,
// creep-turn, overshoot, repeat — and the run took minutes or ended
// wedged on a block corner. A lookahead point moves smoothly along the
// route, so the car starts its turn early and cuts corners gently.
function pursuitTarget(state, car, tx, ty) {
  const key = `${Math.round(tx / 100)},${Math.round(ty / 100)}`;
  state.driveRouteT -= 1 / 60;
  if (!state.driveRoute || state.driveRoute.key !== key || state.driveRouteT <= 0) {
    state.driveRoute = { key, points: computeRoute(car, tx, ty), idx: 0 };
    state.driveRouteT = 5;
  }
  const pts = state.driveRoute.points;
  let total = 0;
  const lens = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    lens.push(l);
    total += l;
  }
  // Closest point on the polyline to the car, as a distance along it.
  let bestD = 1e18, bestAlong = 0, along = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i].x, ay = pts[i].y, bx = pts[i + 1].x, by = pts[i + 1].y;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((car.x - ax) * dx + (car.y - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(car.x - (ax + dx * t), car.y - (ay + dy * t));
    if (d < bestD) { bestD = d; bestAlong = along + lens[i] * t; }
    along += lens[i];
  }
  const targetAlong = Math.min(total, bestAlong + 120);
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    if (acc + lens[i] >= targetAlong) {
      const t = lens[i] > 0 ? (targetAlong - acc) / lens[i] : 0;
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, y: pts[i].y + (pts[i + 1].y - pts[i].y) * t, final: targetAlong >= total - 1 };
    }
    acc += lens[i];
  }
  return { x: tx, y: ty, final: true };
}
