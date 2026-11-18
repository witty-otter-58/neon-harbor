// The city of Neon Harbor: roads, blocks, seeded buildings, landmarks.
// Everything here is pure data built once from the seed — no browser needed.
import { CFG } from './config.js';
import { mulberry32 } from './random.js';

const PALETTE = [
  '#e8a87c', '#d9a05b', '#c97b63', '#a8b8a0', '#8fa3b8',
  '#b8a88f', '#e0c080', '#9fb8a8', '#c98f9f', '#7fa3a8',
  '#d8b48f', '#a89078', '#e8c8a0', '#b0a090',
];

export function buildCity(seed = 7) {
  const rng = mulberry32(seed);
  const buildings = [];
  const trees = [];
  const containers = [];

  // Road rectangles, for drawing and for the minimap.
  const roads = [];
  for (const x of CFG.AVENUES) roads.push({ x: x - CFG.ROAD_W / 2, y: 0, w: CFG.ROAD_W, h: CFG.WORLD.h, vertical: true });
  for (const y of CFG.STREETS) roads.push({ x: 0, y: y - CFG.ROAD_W / 2, w: CFG.WORLD.w, h: CFG.ROAD_W, vertical: false });

  // Block columns/rows: the strips between roads, plus the outer margins.
  // The minus-edges and plus-edges are built in two groups, so sort them
  // before pairing — unsorted, the pairs cut across the roads themselves
  // and buildings end up standing in the middle of avenues.
  const edgesX = [0, ...CFG.AVENUES.map((x) => x - CFG.ROAD_W / 2), ...CFG.AVENUES.map((x) => x + CFG.ROAD_W / 2), CFG.WORLD.w].sort((a, b) => a - b);
  const edgesY = [0, ...CFG.STREETS.map((y) => y - CFG.ROAD_W / 2), ...CFG.STREETS.map((y) => y + CFG.ROAD_W / 2), CFG.WORLD.h].sort((a, b) => a - b);
  const cols = [];
  const rows = [];
  for (let i = 0; i < edgesX.length - 1; i += 2) cols.push([edgesX[i], edgesX[i + 1]]);
  for (let i = 0; i < edgesY.length - 1; i += 2) rows.push([edgesY[i], edgesY[i + 1]]);
  const blocks = buildBlocks(cols, rows);

  // One or two buildings per block, with a margin from the road.
  for (const [x0, x1] of cols) {
    for (const [y0, y1] of rows) {
      const w = x1 - x0;
      const h = y1 - y0;
      if (w < 90 || h < 90) continue;
      // The bottom row is the harbor frontage — keep it open for the docks.
      if (y0 >= 1548) continue;
      const count = w > 300 && h > 300 && rng() < 0.6 ? 2 : 1;
      for (let k = 0; k < count; k++) {
        const bw = Math.min(w - 36, 110 + rng() * 130);
        const bh = Math.min(h - 36, 90 + rng() * 110);
        const bx = x0 + 18 + rng() * Math.max(1, w - 36 - bw);
        const by = y0 + 18 + rng() * Math.max(1, h - 36 - bh);
        const color = PALETTE[Math.floor(rng() * PALETTE.length)];
        buildings.push({ x: bx, y: by, w: bw, h: bh, color, roof: shade(color, -28), hgt: 8 + rng() * 22 });
      }
      // A tree or two on the block's sidewalk edge.
      if (rng() < 0.7) {
        trees.push({ x: x0 + 14 + rng() * (w - 28), y: y0 + 12, r: 9 + rng() * 5 });
      }
    }
  }

  // Landmark buildings, placed by hand so the missions always find them.
  const lantern = { x: 2190, y: 150, w: 150, h: 96, color: '#7a4a8f', roof: '#5a3568', hgt: 30, landmark: 'lantern' };
  const hospital = { x: 60, y: 1560, w: 160, h: 90, color: '#e8e8e8', roof: '#c8c8c8', hgt: 26, landmark: 'hospital' };
  const safehouse = { x: 1030, y: 1560, w: 120, h: 80, color: '#5a8a6a', roof: '#40684e', hgt: 18, landmark: 'safehouse' };
  // Drop any seeded building that would cover a landmark.
  const lm = [lantern, hospital, safehouse];
  for (let i = buildings.length - 1; i >= 0; i--) {
    const b = buildings[i];
    if (lm.some((l) => b.x < l.x + l.w + 8 && b.x + b.w > l.x - 8 && b.y < l.y + l.h + 8 && b.y + b.h > l.y - 8)) {
      buildings.splice(i, 1);
    }
  }
  buildings.push(lantern, hospital, safehouse);

  // Shipping containers in the docks (solid obstacles).
  const dockSpots = [
    [420, 1680, 90, 34], [540, 1680, 90, 34], [660, 1680, 90, 34],
    [1560, 1680, 90, 34], [1680, 1680, 90, 34], [1800, 1680, 90, 34],
    [480, 1740, 90, 34], [1620, 1740, 90, 34],
  ];
  for (const [x, y, w, h] of dockSpots) {
    containers.push({ x, y, w, h, color: ['#b8543f', '#3f7ab8', '#b8a03f', '#4a9a5a'][Math.floor(rng() * 4)] });
  }

  return { buildings, roads, trees, containers, blocks, landmarks: { lantern, hospital, safehouse } };
}

// The block rectangles (the strips between roads). Cars are confined to the
// roads and the open docks, so these are walls for cars only — a car that
// could cut a corner into a block would wedge itself in a pocket of
// buildings and never get out. The bottom row is the docks: open ground.
function buildBlocks(cols, rows) {
  const blocks = [];
  for (const [x0, x1] of cols) {
    for (const [y0, y1] of rows) {
      if (y0 >= 1548) continue;
      blocks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    }
  }
  return blocks;
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// True when a point sits on a road (used to spawn cars and peds safely).
export function onRoad(x, y) {
  for (const ax of CFG.AVENUES) if (Math.abs(x - ax) <= CFG.ROAD_W / 2 - 6) return true;
  for (const sy of CFG.STREETS) if (Math.abs(y - sy) <= CFG.ROAD_W / 2 - 6) return true;
  return false;
}
