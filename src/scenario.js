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

// ─── DisasterScenario class ──────────────────────────────────────────────────

export class DisasterScenario {
  /**
   * @param {number} cols
   * @param {number} rows
   * @param {string} name   Preset scenario name
   */
  constructor(cols, rows, name = 'disaster-zone') {
    this.cols = cols;
    this.rows = rows;
    this.name = name;

    // Flat array of CELL values, indexed row * cols + col
    this.grid = new Array(cols * rows).fill(CELL.CLEAR);

    // Multi-survivor targets list with metadata
    this.survivors = [];

    // Structural wall contours (for realistic disaster map rendering)
    this.structures = [];

    this._buildScenario(name);
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

    if (name === 'disaster-zone' || name === 'ambiguous') {
      // 5 DISTINCT SURVIVORS across the disaster zone!
      // 1. Survivor Alpha — Northeast Ruined Tower (Sector 16, 4)
      fillRect(grid, cols, CELL.SURVIVOR, 15, 3, 17, 5);
      this.survivors.push({ id: 'ALPHA', name: 'Survivor Alpha', col: 16, row: 4, sector: 'NE TOWER SECTOR' });

      // 2. Survivor Bravo — Southwest Collapsed Complex (Sector 5, 13)
      fillRect(grid, cols, CELL.SURVIVOR, 4, 12, 6, 14);
      this.survivors.push({ id: 'BRAVO', name: 'Survivor Bravo', col: 5, row: 13, sector: 'SW RUINS SECTOR' });

      // 3. Survivor Charlie — Northwest Hazard Perimeter (Sector 5, 4)
      fillRect(grid, cols, CELL.SURVIVOR, 4, 3, 6, 5);
      this.survivors.push({ id: 'CHARLIE', name: 'Survivor Charlie', col: 5, row: 4, sector: 'NW STRUCTURAL GAP' });

      // 4. Survivor Delta — Southeast Vault Ruin (Sector 16, 13)
      fillRect(grid, cols, CELL.SURVIVOR, 15, 12, 17, 14);
      this.survivors.push({ id: 'DELTA', name: 'Survivor Delta', col: 16, row: 13, sector: 'SE VAULT SECTOR' });

      // 5. Survivor Echo — Center Corridor Shelter (Sector 11, 9)
      fillRect(grid, cols, CELL.SURVIVOR, 10, 8, 12, 10);
      this.survivors.push({ id: 'ECHO', name: 'Survivor Echo', col: 11, row: 9, sector: 'CENTER CORRIDOR' });

      // Hazards & Thermal Debris (positioned in distinct non-overlapping sectors)
      fillRect(grid, cols, CELL.HOT_DEBRIS, 14, 11, 18, 15);  // Orange: Fire Debris (SE)
      fillRect(grid, cols, CELL.WIND_NOISE, 2, 8, 5, 10);      // Blue: Audio Echo Gap (West Sector)
      fillRect(grid, cols, CELL.HAZARD, 9, 2, 11, 4);          // Purple: Gas Plume (North Sector)

      // Ruined structural building footprints
      this.structures.push({ c0: 2, r0: 2, c1: 7, r1: 6, label: 'SECTOR W-1' });
      this.structures.push({ c0: 14, r0: 2, c1: 19, r1: 6, label: 'SECTOR E-1' });
      this.structures.push({ c0: 2, r0: 11, c1: 7, r1: 16, label: 'SECTOR W-2' });
      this.structures.push({ c0: 14, r0: 11, c1: 19, r1: 16, label: 'SECTOR E-2' });

    } else if (name === 'simple') {
      // The single survivor (Target)
      fillRect(grid, cols, CELL.SURVIVOR, 15, 3, 18, 6);
      this.survivors.push({ id: 'ALPHA', name: 'Survivor Alpha', col: 16, row: 4, sector: 'SECTOR E-1' });

      // Decoys and Hazards to demonstrate multi-modal sensor filtering
      fillRect(grid, cols, CELL.HOT_DEBRIS, 3, 2, 7, 6);   // Top-left (Triggers Thermal only)
      fillRect(grid, cols, CELL.WIND_NOISE, 3, 11, 7, 15); // Bottom-left (Triggers Audio only)
      fillRect(grid, cols, CELL.HAZARD, 10, 7, 12, 9);     // Center (Triggers Gas only)
    } else if (name === 'multi-survivor') {
      fillRect(grid, cols, CELL.SURVIVOR, 14, 2, 18, 5);
      this.survivors.push({ id: 'ALPHA', name: 'Survivor Alpha', col: 16, row: 3, sector: 'NORTH SECTOR' });

      fillRect(grid, cols, CELL.SURVIVOR, 3, 11, 7, 14);
      this.survivors.push({ id: 'BRAVO', name: 'Survivor Bravo', col: 5, row: 12, sector: 'SOUTH SECTOR' });

      fillRect(grid, cols, CELL.HOT_DEBRIS, 14, 11, 18, 15);
      fillRect(grid, cols, CELL.WIND_NOISE, 3, 2, 7, 6);
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
    return ['disaster-zone', 'simple', 'multi-survivor'];
  }
}
