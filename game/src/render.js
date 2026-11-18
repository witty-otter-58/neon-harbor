// Canvas drawing: the city, cars, people, HUD and minimap.
import { CFG } from './config.js';
import { PHASE, objectiveText } from './world.js';

const MM = { x: 960 - 190, y: 10, w: 180, h: 135, s: 180 / CFG.WORLD.w };

export function render(ctx, state) {
  const cam = state.camera;
  const ox = CFG.VIEW.w / 2 - cam.x;
  const oy = CFG.VIEW.h / 2 - cam.y;
  ctx.fillStyle = '#1a2030';
  ctx.fillRect(0, 0, CFG.VIEW.w, CFG.VIEW.h);
  ctx.save();
  ctx.translate(ox, oy);

  // Ground, harbor sand and water.
  ctx.fillStyle = CFG.COLORS.ground;
  ctx.fillRect(0, 0, CFG.WORLD.w, CFG.WORLD.h);
  ctx.fillStyle = CFG.COLORS.sand;
  ctx.fillRect(0, 1650, CFG.WORLD.w, 110);
  ctx.fillStyle = CFG.COLORS.water;
  ctx.fillRect(0, 1760, CFG.WORLD.w, 40);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (let x = 40; x < CFG.WORLD.w; x += 160) ctx.fillRect(x, 1772, 70, 3);

  // Sidewalks then roads.
  for (const ax of CFG.AVENUES) {
    ctx.fillStyle = CFG.COLORS.sidewalk;
    ctx.fillRect(ax - CFG.ROAD_W / 2 - 10, 0, CFG.ROAD_W + 20, CFG.WORLD.h);
  }
  for (const sy of CFG.STREETS) {
    ctx.fillStyle = CFG.COLORS.sidewalk;
    ctx.fillRect(0, sy - CFG.ROAD_W / 2 - 10, CFG.WORLD.w, CFG.ROAD_W + 20);
  }
  for (const r of state.city.roads) {
    ctx.fillStyle = CFG.COLORS.road;
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  // Dashed center lines.
  ctx.fillStyle = CFG.COLORS.roadLine;
  for (const ax of CFG.AVENUES) {
    for (let y = 10; y < CFG.WORLD.h; y += 44) ctx.fillRect(ax - 2, y, 4, 22);
  }
  for (const sy of CFG.STREETS) {
    for (let x = 10; x < CFG.WORLD.w; x += 44) ctx.fillRect(x, sy - 2, 22, 4);
  }

  // Shipping containers in the docks.
  for (const c of state.city.containers) {
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(c.x, c.y + c.h - 6, c.w, 6);
  }

  // Trees.
  for (const t of state.city.trees) {
    ctx.fillStyle = '#3f7a3a';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5a9a4a';
    ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2); ctx.fill();
  }

  // Buildings with a darker roof edge for a 2.5D feel.
  for (const b of state.city.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, 5);
    if (b.landmark === 'lantern') {
      ctx.fillStyle = '#ff4fd8';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('THE LANTERN', b.x + b.w / 2, b.y + b.h / 2 - 4);
      ctx.fillStyle = '#39e6ff';
      ctx.font = '11px sans-serif';
      ctx.fillText('CLUB', b.x + b.w / 2, b.y + b.h / 2 + 14);
    } else if (b.landmark === 'hospital') {
      ctx.fillStyle = '#c23b2e';
      ctx.fillRect(b.x + b.w / 2 - 5, b.y + 14, 10, 26);
      ctx.fillRect(b.x + b.w / 2 - 14, b.y + 23, 28, 10);
      ctx.fillStyle = '#333';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('HOSPITAL', b.x + b.w / 2, b.y + b.h - 12);
    } else if (b.landmark === 'safehouse') {
      ctx.fillStyle = '#1e4a2e';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SAFEHOUSE', b.x + b.w / 2, b.y + b.h / 2 + 4);
    }
  }

  // Mission marker: pulsing yellow diamond + beacon.
  const m = state.marker;
  if (state.mission < 3) {
    const pulse = 1 + 0.15 * Math.sin(state.time * 4);
    ctx.fillStyle = 'rgba(255,215,0,0.25)';
    ctx.beginPath(); ctx.arc(m.x, m.y, 34 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd700';
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-11, -11, 22, 22);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,215,0,0.12)';
    ctx.fillRect(m.x - 3, m.y - 220, 6, 220);
  }

  // The glowing package (mission 1).
  if (state.mission === 0 && !state.packageTaken) {
    const p = CFG.DOCKS_PACKAGE;
    const pulse = 1 + 0.25 * Math.sin(state.time * 5);
    ctx.fillStyle = 'rgba(255,215,0,0.35)';
    ctx.beginPath(); ctx.arc(p.x, p.y, 26 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(p.x - 10, p.y - 8, 20, 16);
    ctx.fillStyle = '#8a6d00';
    ctx.fillRect(p.x - 10, p.y - 2, 20, 4);
  }

  // Pickups.
  for (const pk of state.pickups) {
    if (pk.taken) continue;
    const bob = Math.sin(state.time * 3 + pk.x) * 2;
    if (pk.kind === 'health') {
      ctx.fillStyle = '#2ecc71';
      ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(pk.x - 3, pk.y + bob - 8, 6, 16);
      ctx.fillRect(pk.x - 8, pk.y + bob - 3, 16, 6);
    } else {
      ctx.fillStyle = '#ff8c2e';
      ctx.fillRect(pk.x - 11, pk.y + bob - 9, 22, 18);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('AMMO', pk.x, pk.y + bob + 4);
    }
  }

  // Pedestrians.
  for (const ped of state.peds) {
    if (ped.dead) {
      ctx.globalAlpha = Math.max(0, ped.fadeT / 4) * 0.7;
      ctx.fillStyle = ped.color;
      ctx.beginPath(); ctx.ellipse(ped.x, ped.y, 12, 6, ped.angle, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      continue;
    }
    ctx.fillStyle = ped.color;
    ctx.beginPath(); ctx.arc(ped.x, ped.y, ped.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(ped.x + Math.cos(ped.angle) * 3, ped.y + Math.sin(ped.angle) * 3, 4, 0, Math.PI * 2); ctx.fill();
  }

  // Cars.
  for (const c of state.cars) drawCar(ctx, c, state.time);

  // Police officers on foot.
  for (const o of state.officers) {
    ctx.fillStyle = '#1a2a4a';
    ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd700';
    ctx.beginPath(); ctx.arc(o.x, o.y - 3, 5, 0, Math.PI * 2); ctx.fill();
  }

  // The player.
  const p = state.player;
  if (p.inCar) {
    // Highlight the driven car.
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.inCar.x, p.inCar.y, CFG.CAR.r + 6, 0, Math.PI * 2); ctx.stroke();
  } else {
    ctx.fillStyle = '#ff7b2e';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(p.x + Math.cos(p.aimAngle) * 4, p.y + Math.sin(p.aimAngle) * 4, 5, 0, Math.PI * 2); ctx.fill();
    // Gun barrel.
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.aimAngle) * 8, p.y + Math.sin(p.aimAngle) * 8);
    ctx.lineTo(p.x + Math.cos(p.aimAngle) * 20, p.y + Math.sin(p.aimAngle) * 20);
    ctx.stroke();
  }

  // Bullets.
  ctx.fillStyle = '#ffe14d';
  for (const b of state.bullets) {
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
  }

  // Particles.
  for (const pt of state.particles) {
    ctx.globalAlpha = Math.max(0, pt.life * 2);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;

  ctx.restore();

  // ---- screen-space HUD ----
  if (state.phase === PHASE.PLAY || state.phase === PHASE.PAUSE) {
    // Health bar.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(12, 12, 190, 26);
    ctx.fillStyle = p.health > 30 ? '#2ecc71' : '#e74c3c';
    ctx.fillRect(14, 14, 186 * Math.max(0, p.health / 100), 10);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`JUNO  ${Math.ceil(p.health)}`, 16, 33);
    // Money + ammo.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(12, 44, 190, 22);
    ctx.fillStyle = '#7ee787';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`$${p.money.toLocaleString()}`, 18, 60);
    ctx.fillStyle = '#ffd700';
    ctx.textAlign = 'right';
    ctx.fillText(`AMMO ${p.mag}/${p.reserve}${p.reloadT > 0 ? ' …' : ''}`, 196, 60);
    ctx.textAlign = 'left';
    // Wanted stars.
    ctx.font = 'bold 20px sans-serif';
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < state.wanted ? '★' : '☆';
    ctx.fillStyle = state.wanted > 0 ? '#ff5a4d' : 'rgba(255,255,255,0.6)';
    ctx.fillText(stars, 12, 96);
    // Objective line.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const obj = objectiveText(state);
    ctx.font = '13px sans-serif';
    const ow = ctx.measureText(obj).width + 20;
    ctx.fillRect((CFG.VIEW.w - ow) / 2, 12, ow, 24);
    ctx.fillStyle = '#ffd700';
    ctx.textAlign = 'center';
    ctx.fillText(obj, CFG.VIEW.w / 2, 29);
    ctx.textAlign = 'left';
    // Toast.
    if (state.toastT > 0 && state.toast) {
      ctx.globalAlpha = Math.min(1, state.toastT);
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      const tw = ctx.measureText(state.toast).width + 28;
      ctx.fillRect((CFG.VIEW.w - tw) / 2, 46, tw, 28);
      ctx.fillStyle = '#7ee787';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(state.toast, CFG.VIEW.w / 2, 65);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }
    drawMinimap(ctx, state);
  }
}

function drawCar(ctx, c, time) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle);
  if (c.disabled) {
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#888';
    ctx.beginPath(); ctx.arc(0, -14, 8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-CFG.CAR.w / 2 + 3, -CFG.CAR.h / 2 + 4, CFG.CAR.w, CFG.CAR.h);
  ctx.fillStyle = c.color;
  ctx.beginPath();
  ctx.roundRect(-CFG.CAR.w / 2, -CFG.CAR.h / 2, CFG.CAR.w, CFG.CAR.h, 6);
  ctx.fill();
  // Windshield + rear window.
  ctx.fillStyle = 'rgba(180,220,255,0.85)';
  ctx.fillRect(4, -CFG.CAR.h / 2 + 3, 10, CFG.CAR.h - 6);
  ctx.fillRect(-16, -CFG.CAR.h / 2 + 3, 7, CFG.CAR.h - 6);
  // Headlights.
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(CFG.CAR.w / 2 - 2, -CFG.CAR.h / 2 + 2, 3, 5);
  ctx.fillRect(CFG.CAR.w / 2 - 2, CFG.CAR.h / 2 - 7, 3, 5);
  if (c.kind === 'police') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-8, -CFG.CAR.h / 2 + 2, 16, CFG.CAR.h - 4);
    ctx.fillStyle = '#1a2a4a';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 3);
    // Flashing light bar.
    const on = Math.floor(time * 3) % 2 === 0;
    ctx.fillStyle = on ? '#ff2e2e' : '#2e6fff';
    ctx.fillRect(-4, -CFG.CAR.h / 2 - 4, 8, 4);
    ctx.fillStyle = on ? '#2e6fff' : '#ff2e2e';
    ctx.fillRect(-4, CFG.CAR.h / 2, 8, 4);
  }
  if (c.kind === 'own') {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('JR', 0, 3);
  }
  ctx.restore();
}

function drawMinimap(ctx, state) {
  const s = MM.s;
  ctx.fillStyle = 'rgba(5,8,16,0.8)';
  ctx.fillRect(MM.x, MM.y, MM.w, MM.h);
  ctx.strokeStyle = '#39e6ff';
  ctx.lineWidth = 1;
  ctx.strokeRect(MM.x, MM.y, MM.w, MM.h);
  // Roads.
  ctx.fillStyle = '#5a6274';
  for (const ax of CFG.AVENUES) ctx.fillRect(MM.x + ax * s - 3, MM.y, 6, MM.h);
  for (const sy of CFG.STREETS) ctx.fillRect(MM.x, MM.y + sy * s - 3, MM.w, 6);
  // Water.
  ctx.fillStyle = '#2e6f8e';
  ctx.fillRect(MM.x, MM.y + 1760 * s, MM.w, 40 * s);
  // Mission marker.
  if (state.mission < 3) {
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(MM.x + state.marker.x * s, MM.y + state.marker.y * s, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Traffic dots.
  ctx.fillStyle = '#9aa3b8';
  for (const c of state.cars) {
    if (c.kind === 'traffic') ctx.fillRect(MM.x + c.x * s - 1, MM.y + c.y * s - 1, 2, 2);
  }
  // Police dots.
  ctx.fillStyle = '#4d8dff';
  for (const c of state.cars) {
    if (c.kind === 'police' && !c.disabled) {
      ctx.beginPath(); ctx.arc(MM.x + c.x * s, MM.y + c.y * s, 3, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Player arrow.
  const p = state.player;
  ctx.save();
  ctx.translate(MM.x + p.x * s, MM.y + p.y * s);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath();
  ctx.fill();
  ctx.restore();
}
