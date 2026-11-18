// Every tuning number for Neon Harbor lives here.
export const CFG = {
  WORLD: { w: 2400, h: 1800 },
  VIEW: { w: 960, h: 600 },
  AVENUES: [300, 900, 1500, 2100],
  STREETS: [300, 900, 1500],
  ROAD_W: 140,
  PLAYER: { r: 12, walkSpeed: 215, health: 100 },
  CAR: {
    accel: 430, brake: 760, reverseAccel: 260,
    maxSpeed: 500, maxReverse: 170, steer: 2.5,
    r: 20, w: 46, h: 22,
  },
  PISTOL: { magSize: 12, reserveStart: 48, bulletSpeed: 950, range: 520, cooldown: 0.22, reloadTime: 1.0 },
  TRAFFIC_COUNT: 12,
  PED_COUNT: 20,
  POLICE: { baseSpeed: 300, perStar: 15, ramDamage: 4, ramCooldown: 1.0, officerSpeed: 245, bustTime: 1.0 },
  WANTED_DECAY_S: 12,
  WANTED_DECAY_RANGE: 300,
  DELIVERY_TIME_S: 90,
  REWARDS: { pickup: 200, delivery: 500, getaway: 1000 },
  BUST_FINE: 200,
  // Landmark positions (world coordinates).
  DOCKS_PACKAGE: { x: 1200, y: 1720 },
  LANTERN: { x: 2100, y: 300 },
  HOSPITAL: { x: 300, y: 1500 },
  SAFEHOUSE: { x: 900, y: 1500 },
  PLAYER_START: { x: 900, y: 1380 },
  OWN_CAR: { x: 960, y: 1500, angle: 0 },
  AMMO_SPOTS: [
    { x: 300, y: 480 }, { x: 1500, y: 480 },
    { x: 900, y: 1200 }, { x: 2100, y: 1200 },
  ],
  HEALTH_SPOT: { x: 390, y: 1500 },
  COLORS: {
    ground: '#c9b183', road: '#3a3f4a', roadLine: '#e8d44f',
    sidewalk: '#b3a06e', water: '#2e6f8e', sand: '#d9c48f',
  },
};
