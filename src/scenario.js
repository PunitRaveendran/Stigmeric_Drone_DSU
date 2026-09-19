/**
 * scenario.js — Disaster Floorplan + Survivor Placement (Phase 3)
 *
 * Defines synthetic disaster scenarios as 2D grids of cell types.
 * These grids are the ground truth that the sensor generators sample from.
 * Drones do NOT see this directly — they only see the noisy sensor readings.
 */

// ─── Cell types ──────────────────────────────────────────────────────────────

export const CELL = {
  CLEAR:      'CLEAR',
  RUBBLE:     'RUBBLE',
  SURVIVOR:   'SURVIVOR',
  HOT_DEBRIS: 'HOT_DEBRIS',
  WIND_NOISE: 'WIND_NOISE',
  HAZARD:     'HAZARD',
};

// ─── Visual colors for the scenario overlay ──────────────────────────────────
// These are drawn ON TOP of the pheromone heatmap with semi-transparency.
// Fill alpha is high enough to be clearly visible through orange/white heatmap.

export const CELL_COLORS = {
  CLEAR:      null,                          // no overlay
  RUBBLE:     null,                          // no overlay (background)
  SURVIVOR:   'rgba(60,  220, 100, 0.38)',   // green fill
  HOT_DEBRIS: 'rgba(255, 110, 20,  0.40)',  // orange fill
  WIND_NOISE: 'rgba(60,  160, 255, 0.40)',  // blue fill
  HAZARD:     'rgba(200, 40,  220, 0.40)',  // purple fill
};

// Border strokes for each zone — always crisp and visible
export const CELL_BORDERS = {
  SURVIVOR:   '#3ddc68',
  HOT_DEBRIS: '#ff7020',
  WIND_NOISE: '#4ab0ff',
  HAZARD:     '#d030e0',
};

/**
 * Fill a rect in a grid with a cell type.
 */
function fillRect(grid, cols, type, c0, r0, c1, r1) {
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (c >= 0 && c < cols && r >= 0 && r < grid.length / cols) {
        grid[r * cols + c] = type;
      }
    }
  }
}

/**
 * Fill a circular/radial plume in a grid.
 */
function fillCircle(grid, cols, rows, type, centerCol, centerRow, radius) {
  const rSq = radius * radius;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const dx = c - centerCol;
      const dy = r - centerRow;
      if (dx * dx + dy * dy <= rSq) {
        grid[r * cols + c] = type;
      }
    }
  }
}

/**
 * Fill an organic irregular zone patch.
 */
function fillIrregularZone(grid, cols, rows, type, centerCol, centerRow, points) {
  for (const [dc, dr] of points) {
    const c = centerCol + dc;
    const r = centerRow + dr;
    if (c >= 0 && c < cols && r >= 0 && r < rows) {
      grid[r * cols + c] = type;
    }
  }
}

// ─── NATO Phonetic Alphabet for survivor callsigns ──────────────────────────
const NATO_ALPHABET = [
  'ALPHA','BRAVO','CHARLIE','DELTA','ECHO','FOXTROT','GOLF','HOTEL',
  'INDIA','JULIET','KILO','LIMA','MIKE','NOVEMBER','OSCAR','PAPA',
  'QUEBEC','ROMEO','SIERRA','TANGO','UNIFORM','VICTOR','WHISKEY',
  'XRAY','YANKEE','ZULU',
];

const SECTOR_NAMES = [
  'NE TOWER SECTOR','SW RUINS SECTOR','NW STRUCTURAL GAP','SE VAULT SECTOR',
  'CENTER CORRIDOR','NORTH CONCOURSE','WEST OVERPASS','EAST METRO TERMINAL',
  'NW COLLAPSED ATRIUM','NE LOGISTICS HUB','SW RESIDENTIAL BLOCK','SE SUBSTATION',
  'NORTH PLAZA','SOUTH ARCADE','WEST ANNEX','EAST BRIDGE','CENTRAL ATRIUM',
  'METRO UNDERPASS','PARKING DECK','SERVICE TUNNEL','ROOFTOP ACCESS','BASEMENT LEVEL',
  'LOADING DOCK','UTILITY CORRIDOR','EMERGENCY EXIT','STAIRWELL ALPHA','STAIRWELL BRAVO',
  'MEZZANINE LEVEL','SKYBRIDGE JUNCTION','MAINTENANCE SHAFT',
];

// ─── Seeded PRNG (Mulberry32) for reproducible generation ───────────────────
function mulberry32(seed) {
  let s = seed | 0;
  return function() {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Gaussian sample from seeded PRNG ───────────────────────────────────────
function gaussianSeeded(rng, mean, sigma) {
  const u1 = rng();
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
  return mean + sigma * z;
}

// ─── DisasterScenario class ──────────────────────────────────────────────────

export class DisasterScenario {
  /**
   * @param {number} cols
   * @param {number} rows
   * @param {string} name   Preset scenario name
   * @param {object} [config]  Optional procedural generation config
   */
  constructor(cols, rows, name = 'disaster-zone', config = null) {
    this.cols = cols;
    this.rows = rows;
    this.name = name;

    // Flat array of CELL values, indexed row * cols + col
    this.grid = new Array(cols * rows).fill(CELL.CLEAR);

    // Multi-survivor targets list with metadata
    this.survivors = [];

    // Structural wall contours (for realistic disaster map rendering)
    this.structures = [];

    const radiusMap = {
      'simple': 80,
      'multi-survivor': 150,
      'disaster-zone': 200,
      'mass-casualty': 300,
      'catastrophe': 450,
    };
    this.areaRadiusMeters = (config && config.areaRadiusMeters) ? config.areaRadiusMeters : (radiusMap[name] || 200);

    if (config) {
      this._generateProceduralScenario(config);
    } else {
      this._buildScenario(name);
    }
  }

  _buildScenario(name) {
    const { cols, rows, grid } = this;
    this.survivors = [];
    this.structures = [];

    // Base floor layout — clear corridors with rubble fields
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isCorridor = (c >= 2 && c <= 19 && r >= 2 && r <= 15);
        grid[r * cols + c] = isCorridor ? CELL.CLEAR : CELL.RUBBLE;
      }
    }

    if (name === 'catastrophe') {
      // 12 SURVIVORS — Wide-Area Urban Mega Catastrophe
      const targets = [
        { id: 'ALPHA',   name: 'Survivor Alpha',   col: 16, row: 4,  sector: 'NE TOWER SECTOR' },
        { id: 'BRAVO',   name: 'Survivor Bravo',   col: 5,  row: 13, sector: 'SW RUINS SECTOR' },
        { id: 'CHARLIE', name: 'Survivor Charlie', col: 5,  row: 4,  sector: 'NW STRUCTURAL GAP' },
        { id: 'DELTA',   name: 'Survivor Delta',   col: 16, row: 13, sector: 'SE VAULT SECTOR' },
        { id: 'ECHO',    name: 'Survivor Echo',    col: 11, row: 8,  sector: 'CENTER CORRIDOR' },
        { id: 'FOXTROT', name: 'Survivor Foxtrot', col: 11, row: 3,  sector: 'NORTH CONCOURSE' },
        { id: 'GOLF',    name: 'Survivor Golf',    col: 3,  row: 8,  sector: 'WEST OVERPASS' },
        { id: 'HOTEL',   name: 'Survivor Hotel',   col: 18, row: 8,  sector: 'EAST METRO TERMINAL' },
        { id: 'INDIA',   name: 'Survivor India',   col: 8,  row: 6,  sector: 'NW COLLAPSED ATRIUM' },
        { id: 'JULIET',  name: 'Survivor Juliet',  col: 14, row: 7,  sector: 'NE LOGISTICS HUB' },
        { id: 'KILO',    name: 'Survivor Kilo',    col: 8,  row: 14, sector: 'SW RESIDENTIAL BLOCK' },
        { id: 'LIMA',    name: 'Survivor Lima',    col: 18, row: 15, sector: 'SE SUBSTATION' },
      ];

      for (const t of targets) {
        fillRect(grid, cols, CELL.SURVIVOR, t.col, t.row, t.col + 1, t.row + 1);
        this.survivors.push(t);
      }

      // Decoys & Hazards (compact 2x2 patches)
      fillRect(grid, cols, CELL.HOT_DEBRIS, 13, 10, 14, 11);
      fillRect(grid, cols, CELL.HOT_DEBRIS, 2, 2, 3, 3);
      fillRect(grid, cols, CELL.WIND_NOISE, 1, 14, 2, 15);
      fillRect(grid, cols, CELL.WIND_NOISE, 19, 2, 20, 3);
      fillRect(grid, cols, CELL.HAZARD, 9, 1, 10, 2);

      this.structures.push({ c0: 2, r0: 2, c1: 7, r1: 6, label: 'SECTOR W-1' });
      this.structures.push({ c0: 14, r0: 2, c1: 19, r1: 6, label: 'SECTOR E-1' });
      this.structures.push({ c0: 2, r0: 11, c1: 7, r1: 16, label: 'SECTOR W-2' });
      this.structures.push({ c0: 14, r0: 11, c1: 19, r1: 16, label: 'SECTOR E-2' });

    } else if (name === 'mass-casualty') {
      // 8 SURVIVORS — Mass Casualty Emergency
      const targets = [
        { id: 'ALPHA',   name: 'Survivor Alpha',   col: 16, row: 4,  sector: 'NE TOWER SECTOR' },
        { id: 'BRAVO',   name: 'Survivor Bravo',   col: 5,  row: 13, sector: 'SW RUINS SECTOR' },
        { id: 'CHARLIE', name: 'Survivor Charlie', col: 5,  row: 4,  sector: 'NW STRUCTURAL GAP' },
        { id: 'DELTA',   name: 'Survivor Delta',   col: 16, row: 13, sector: 'SE VAULT SECTOR' },
        { id: 'ECHO',    name: 'Survivor Echo',    col: 11, row: 9,  sector: 'CENTER CORRIDOR' },
        { id: 'FOXTROT', name: 'Survivor Foxtrot', col: 11, row: 3,  sector: 'NORTH CONCOURSE' },
        { id: 'GOLF',    name: 'Survivor Golf',    col: 3,  row: 8,  sector: 'WEST OVERPASS' },
        { id: 'HOTEL',   name: 'Survivor Hotel',   col: 18, row: 8,  sector: 'EAST COMMERCIAL' },
      ];

      for (const t of targets) {
        fillRect(grid, cols, CELL.SURVIVOR, t.col, t.row, t.col + 1, t.row + 1);
        this.survivors.push(t);
      }

      fillRect(grid, cols, CELL.HOT_DEBRIS, 14, 11, 15, 12);
      fillRect(grid, cols, CELL.WIND_NOISE, 3, 8, 4, 9);
      fillRect(grid, cols, CELL.HAZARD, 9, 2, 10, 3);

      this.structures.push({ c0: 2, r0: 2, c1: 7, r1: 6, label: 'SECTOR W-1' });
      this.structures.push({ c0: 14, r0: 2, c1: 19, r1: 6, label: 'SECTOR E-1' });
      this.structures.push({ c0: 2, r0: 11, c1: 7, r1: 16, label: 'SECTOR W-2' });
      this.structures.push({ c0: 14, r0: 11, c1: 19, r1: 16, label: 'SECTOR E-2' });

    } else if (name === 'disaster-zone' || name === 'ambiguous') {
      // 5 DISTINCT SURVIVORS across the disaster zone (compact 2x2 bounds)
      // 1. Survivor Alpha — Northeast Ruined Tower (Sector 16, 4)
      fillRect(grid, cols, CELL.SURVIVOR, 15, 3, 16, 4);
      this.survivors.push({ id: 'ALPHA', name: 'Survivor Alpha', col: 16, row: 4, sector: 'NE TOWER SECTOR' });

      // 2. Survivor Bravo — Southwest Collapsed Complex (Sector 5, 13)
      fillRect(grid, cols, CELL.SURVIVOR, 4, 12, 5, 13);
      this.survivors.push({ id: 'BRAVO', name: 'Survivor Bravo', col: 5, row: 13, sector: 'SW RUINS SECTOR' });

      // 3. Survivor Charlie — Northwest Hazard Perimeter (Sector 5, 4)
      fillRect(grid, cols, CELL.SURVIVOR, 4, 3, 5, 4);
      this.survivors.push({ id: 'CHARLIE', name: 'Survivor Charlie', col: 5, row: 4, sector: 'NW STRUCTURAL GAP' });

      // 4. Survivor Delta — Southeast Vault Ruin (Sector 16, 13)
      fillRect(grid, cols, CELL.SURVIVOR, 15, 12, 16, 13);
      this.survivors.push({ id: 'DELTA', name: 'Survivor Delta', col: 16, row: 13, sector: 'SE VAULT SECTOR' });

      // 5. Survivor Echo — Center Corridor Shelter (Sector 11, 9)
      fillRect(grid, cols, CELL.SURVIVOR, 10, 8, 11, 9);
      this.survivors.push({ id: 'ECHO', name: 'Survivor Echo', col: 11, row: 9, sector: 'CENTER CORRIDOR' });

      // Hazards & Thermal Debris (compact 2x2 patches in distinct non-overlapping sectors)
      fillRect(grid, cols, CELL.HOT_DEBRIS, 14, 11, 15, 12);  // Orange: Fire Debris (SE)
      fillRect(grid, cols, CELL.WIND_NOISE, 3, 8, 4, 9);       // Blue: Audio Echo Gap (West Sector)
      fillRect(grid, cols, CELL.HAZARD, 9, 2, 10, 3);          // Purple: Gas Plume (North Sector)

      // Ruined structural building footprints
      this.structures.push({ c0: 2, r0: 2, c1: 7, r1: 6, label: 'SECTOR W-1' });
      this.structures.push({ c0: 14, r0: 2, c1: 19, r1: 6, label: 'SECTOR E-1' });
      this.structures.push({ c0: 2, r0: 11, c1: 7, r1: 16, label: 'SECTOR W-2' });
      this.structures.push({ c0: 14, r0: 11, c1: 19, r1: 16, label: 'SECTOR E-2' });

    } else if (name === 'simple') {
      // The single survivor (compact 2x2 target)
      fillRect(grid, cols, CELL.SURVIVOR, 15, 3, 16, 4);
      this.survivors.push({ id: 'ALPHA', name: 'Survivor Alpha', col: 16, row: 4, sector: 'SECTOR E-1' });

      // Compact 2x2 Decoys and Hazards
      fillRect(grid, cols, CELL.HOT_DEBRIS, 4, 3, 5, 4);   // Top-left (Triggers Thermal only)
      fillRect(grid, cols, CELL.WIND_NOISE, 4, 12, 5, 13); // Bottom-left (Triggers Audio only)
      fillRect(grid, cols, CELL.HAZARD, 10, 7, 11, 8);     // Center (Triggers Gas only)
    } else if (name === 'multi-survivor') {
      fillRect(grid, cols, CELL.SURVIVOR, 15, 2, 16, 3);
      this.survivors.push({ id: 'ALPHA', name: 'Survivor Alpha', col: 16, row: 3, sector: 'NORTH SECTOR' });

      fillRect(grid, cols, CELL.SURVIVOR, 4, 11, 5, 12);
      this.survivors.push({ id: 'BRAVO', name: 'Survivor Bravo', col: 5, row: 12, sector: 'SOUTH SECTOR' });

      fillRect(grid, cols, CELL.HOT_DEBRIS, 14, 11, 15, 12);
      fillRect(grid, cols, CELL.WIND_NOISE, 4, 3, 5, 4);
    }
  }

  /**
   * Get the cell type at a grid position. Returns null for out-of-bounds.
   * @param {number} col
   * @param {number} row
   * @returns {string|null}
   */
  getCellType(col, row) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return null;
    return this.grid[row * this.cols + col];
  }

  /**
   * Return all survivor cell positions (for evaluation metrics).
   * @returns {{ col: number, row: number }[]}
   */
  getSurvivorPositions() {
    const positions = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r * this.cols + c] === CELL.SURVIVOR) {
          positions.push({ col: c, row: r });
        }
      }
    }
    return positions;
  }

  /**
   * Get available scenario names.
   */
  static getScenarioNames() {
    return ['catastrophe', 'mass-casualty', 'disaster-zone', 'multi-survivor', 'simple', 'custom'];
  }

  /**
   * Factory: Generate a procedural disaster scenario from configuration.
   *
   * @param {object} config
   * @param {number} config.survivorCount  Number of survivors (1–30)
   * @param {number} config.areaRadiusMeters  Search area radius in meters (50–500)
   * @param {number} config.spreadFactor  0.0 = tight cluster, 1.0 = wide uniform
   * @param {number} [config.seed]  Optional PRNG seed for reproducibility
   * @returns {DisasterScenario}
   */
  static generate(config = {}) {
    const {
      survivorCount = 8,
      areaRadiusMeters = 200,
      spreadFactor = 0.5,
      seed = null,
    } = config;

    // Dynamic grid sizing: each cell ≈ 8m × 8m ground truth
    const gridSize = Math.max(10, Math.min(40, Math.round(areaRadiusMeters / 8)));
    const cols = gridSize;
    const rows = gridSize;

    const scenario = new DisasterScenario(cols, rows, 'custom', {
      survivorCount: Math.max(1, Math.min(30, survivorCount)),
      spreadFactor: Math.max(0, Math.min(1, spreadFactor)),
      areaRadiusMeters: Math.max(50, Math.min(500, areaRadiusMeters)),
      cols,
      rows,
      seed: seed !== null ? seed : Math.floor(Math.random() * 2147483647),
    });
    scenario.areaRadiusMeters = Math.max(50, Math.min(500, areaRadiusMeters));

    return scenario;
  }

  /**
   * Procedural generation algorithm using Gaussian mixture model.
   * Called by constructor when config is provided.
   * @param {object} config
   */
  _generateProceduralScenario(config) {
    const { survivorCount, spreadFactor, cols, rows, seed } = config;
    const rng = mulberry32(seed);
    const grid = this.grid;

    // ─── Step 1: Base terrain — rubble perimeter + clear interior ─────
    const margin = 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isPerimeter = (c < margin || c >= cols - margin || r < margin || r >= rows - margin);
        grid[r * cols + c] = isPerimeter ? CELL.RUBBLE : CELL.CLEAR;
      }
    }

    // Add scattered interior rubble patches for realism
    const rubblePatches = Math.floor(cols * rows * 0.06);
    for (let i = 0; i < rubblePatches; i++) {
      const rc = margin + Math.floor(rng() * (cols - 2 * margin));
      const rr = margin + Math.floor(rng() * (rows - 2 * margin));
      if (grid[rr * cols + rc] === CELL.CLEAR) {
        grid[rr * cols + rc] = CELL.RUBBLE;
      }
    }

    // ─── Step 2: Gaussian mixture survivor placement ─────────────────
    const innerCols = cols - 2 * margin;
    const innerRows = rows - 2 * margin;
    const centerC = cols / 2;
    const centerR = rows / 2;

    // Number of cluster centers: more clusters = more spread-out groups
    const K = Math.max(1, Math.ceil(survivorCount / 3));

    // Generate cluster center positions
    const clusterCenters = [];
    for (let k = 0; k < K; k++) {
      // Distribute cluster centers using angular offset for good spatial coverage
      const angle = (2 * Math.PI * k / K) + rng() * 0.5;
      const maxDist = Math.min(innerCols, innerRows) * 0.35;
      const dist = maxDist * (0.3 + rng() * 0.7);
      const cc = Math.round(centerC + Math.cos(angle) * dist);
      const cr = Math.round(centerR + Math.sin(angle) * dist);
      clusterCenters.push({
        col: Math.max(margin + 1, Math.min(cols - margin - 2, cc)),
        row: Math.max(margin + 1, Math.min(rows - margin - 2, cr)),
      });
    }

    // Place survivors around cluster centers with Gaussian spread
    const placed = [];
    const minSep = 2; // minimum separation in cells
    // Sigma scales with spreadFactor: 0.0 → tight (sigma=1.5), 1.0 → wide (sigma=innerSize*0.3)
    const sigmaBase = 1.5 + spreadFactor * (Math.min(innerCols, innerRows) * 0.28);

    let attempts = 0;
    while (placed.length < survivorCount && attempts < survivorCount * 50) {
      attempts++;
      // Pick a random cluster center
      const cluster = clusterCenters[Math.floor(rng() * K)];

      // Sample position from Gaussian around cluster center
      const sc = Math.round(gaussianSeeded(rng, cluster.col, sigmaBase));
      const sr = Math.round(gaussianSeeded(rng, cluster.row, sigmaBase));

      // Bounds check (must be inside inner zone)
      if (sc < margin + 1 || sc >= cols - margin - 1 || sr < margin + 1 || sr >= rows - margin - 1) {
        continue;
      }

      // Check minimum separation from all placed survivors
      const tooClose = placed.some(p => {
        const dx = p.col - sc;
        const dy = p.row - sr;
        return (dx * dx + dy * dy) < minSep * minSep;
      });
      if (tooClose) continue;

      // Check cell isn't already occupied
      if (grid[sr * cols + sc] !== CELL.CLEAR) continue;

      // Place survivor (2×2 footprint)
      const idx = placed.length;
      const callsign = idx < NATO_ALPHABET.length ? NATO_ALPHABET[idx] : `SURVIVOR-${idx + 1}`;
      const sectorName = idx < SECTOR_NAMES.length ? SECTOR_NAMES[idx] : `SECTOR ${idx + 1}`;

      fillRect(grid, cols, CELL.SURVIVOR, sc, sr, sc + 1, sr + 1);
      this.survivors.push({
        id: callsign,
        name: `Survivor ${callsign.charAt(0) + callsign.slice(1).toLowerCase()}`,
        col: sc,
        row: sr,
        sector: sectorName,
      });
      placed.push({ col: sc, row: sr });
    }

    // ─── Step 3: Hazard / Decoy injection (proportional) ─────────────
    const hotDebrisCount = Math.max(1, Math.floor(survivorCount * 0.4));
    const windNoiseCount = Math.max(1, Math.floor(survivorCount * 0.3));
    const hazardCount = Math.max(1, Math.ceil(survivorCount * 0.15));

    const placeHazardPatch = (type, count) => {
      let placedH = 0;
      let att = 0;
      while (placedH < count && att < count * 40) {
        att++;
        const hc = margin + 1 + Math.floor(rng() * (innerCols - 2));
        const hr = margin + 1 + Math.floor(rng() * (innerRows - 2));
        // Don't place on survivors or other hazards
        if (grid[hr * cols + hc] !== CELL.CLEAR) continue;
        // Ensure minimum 3-cell distance from any survivor
        const nearSurvivor = placed.some(p => {
          const dx = p.col - hc;
          const dy = p.row - hr;
          return (dx * dx + dy * dy) < 9;
        });
        if (nearSurvivor) continue;

        fillRect(grid, cols, type, hc, hr, Math.min(cols - 1, hc + 1), Math.min(rows - 1, hr + 1));
        placedH++;
      }
    };

    placeHazardPatch(CELL.HOT_DEBRIS, hotDebrisCount);
    placeHazardPatch(CELL.WIND_NOISE, windNoiseCount);
    placeHazardPatch(CELL.HAZARD, hazardCount);

    // ─── Step 4: Generate structural footprints around cluster centers ─
    for (let k = 0; k < Math.min(K, 6); k++) {
      const cc = clusterCenters[k];
      const halfW = 2 + Math.floor(rng() * 3);
      const halfH = 2 + Math.floor(rng() * 3);
      this.structures.push({
        c0: Math.max(0, cc.col - halfW),
        r0: Math.max(0, cc.row - halfH),
        c1: Math.min(cols - 1, cc.col + halfW),
        r1: Math.min(rows - 1, cc.row + halfH),
        label: `SECTOR ${String.fromCharCode(65 + k)}-${k + 1}`,
      });
    }
  }
}
