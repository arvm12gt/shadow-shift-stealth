// Shadow Shift — tuning and the three levels. Tiles are 40 px; every map is
// 24 columns by 15 rows. Legend: # wall, . floor, P player start, I intel,
// K keycard, E exit. Guards patrol the listed tile waypoints in order.
export const TILE = 40;
export const COLS = 24;
export const ROWS = 15;
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 12,
  walk: 140,
  run: 235,
  sneak: 72,
  noiseWalk: 26,
  noiseRun: 125,
  noiseSneak: 0,
};

export const GUARD = {
  radius: 13,
  patrol: 68,
  investigate: 95,
  chase: 158,
  viewRange: 178,
  viewHalfAngle: 0.62,
  sneakRangeFactor: 0.62,
  // Detection rises this fast (per second) when the player is dead-centre
  // in view; it scales down with distance and stance.
  detectRate: 95,
  detectDecay: 26,
  suspiciousAt: 30,
  catchDistance: 22,
};

export const LEVELS = [
  {
    name: 'LEVEL 1 — OFFICE FLOOR',
    hint: 'Lift 3 intel files, then slip out the east exit.',
    map: [
      '########################',
      '#P......#.......#......#',
      '#.......#...I...#...E..#',
      '#.......#.......#......#',
      '#..##...#.......#..##..#',
      '#..##.......#.......#..#',
      '#.......#.......#......#',
      '#...I...#...#...#......#',
      '#.......#.......#......#',
      '#..##...#...I...#..##..#',
      '#.......#.......#......#',
      '#....#......#.......#..#',
      '#....#..#.......#......#',
      '#.......#.......#......#',
      '########################',
    ],
    guards: [
      { waypoints: [[2, 1], [14, 1], [14, 5], [6, 5]] },
      { waypoints: [[20, 2], [20, 12], [10, 12], [10, 2]] },
    ],
  },
  {
    name: 'LEVEL 2 — WAREHOUSE',
    hint: 'Grab the keycard and 3 intel files, then reach the exit.',
    map: [
      '########################',
      '#P....#........#.......#',
      '#.....#...I....#...K...#',
      '#..#..#........#.......#',
      '#..#.....###.......#...#',
      '#.....#.....#...#......#',
      '#.#####..#..#...#..##..#',
      '#.....#..#.....#.......#',
      '#..I..#.....#....#..E..#',
      '#.....#..#..#...#......#',
      '#..#.....#.....#...#...#',
      '#..#..##....#......#...#',
      '#.....#..I.....#.......#',
      '#.....#........#.......#',
      '########################',
    ],
    guards: [
      { waypoints: [[2, 1], [5, 1], [5, 3], [2, 3]] },
      { waypoints: [[12, 2], [18, 2], [18, 8], [13, 8]] },
      { waypoints: [[2, 10], [5, 10], [5, 12], [2, 12]] },
    ],
  },
  {
    name: 'LEVEL 3 — VAULT LEVEL',
    hint: 'Three intel files guard the vault. One clean run wins it.',
    map: [
      '########################',
      '#P...#......#.....#....#',
      '#....#..I...#..#..#.E..#',
      '#....#......#.....#....#',
      '#.##...##...#..#.......#',
      '#....#....#....#..##...#',
      '#..I....#..#..#........#',
      '#....#..#.....#...#....#',
      '#.##....#..##....#.....#',
      '#....#..#..#..#..#..#..#',
      '#..#....#.....#....#...#',
      '#..#..#...#...#..#.....#',
      '#....#..I....#..#..#...#',
      '#....#.......#.....#...#',
      '########################',
    ],
    guards: [
      { waypoints: [[2, 1], [4, 1], [4, 3], [2, 3]] },
      { waypoints: [[10, 2], [13, 2], [13, 6], [10, 6]] },
      { waypoints: [[17, 4], [21, 4], [21, 7], [17, 7]] },
      { waypoints: [[6, 10], [6, 13], [16, 13], [16, 10]] },
    ],
  },
];

export const BEST_KEY = 'shadow-shift-best-ms';
