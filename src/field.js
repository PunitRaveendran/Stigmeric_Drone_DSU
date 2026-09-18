/**
 * field.js — Protoplasm Pheromone Field
 *
 * The shared "digital slime mold" substrate. Each cell stores pheromone
 * strength that decays over time unless reinforced by repeat drone traffic.
 * No LLM, no central planner — pure deterministic math.
 */

import { getPINNDecayRate } from './pinn.js';

export const CELL_SIZE = 24; // pixels per grid cell in the canvas renderer

export class PheromoneField {
  /**
   * @param {number} cols  Number of grid columns
   * @param {number} rows  Number of grid rows
   * @param {object} opts  Tuning knobs
   */
  constructor(cols, rows, opts = {}) {
    this.cols = cols;
    this.rows = rows;

    // Decay constants — tuned for visible narrative arc
    this.baseDecayRate    = opts.baseDecayRate    ?? 0.035;  // 3.5% lost per tick — weak trails fade visibly
    this.reinforceBonus   = opts.reinforceBonus   ?? 0.05;   // modest bonus on revisit — needs sustained traffic
    this.reinforceWindow  = opts.reinforceWindow  ?? 15;     // ticks within which a revisit counts
    this.maxStrength      = opts.maxStrength      ?? 0.85;
    this.minStrength      = opts.minStrength      ?? 0.0;

    // Flat typed arrays for performance — index = row * cols + col
    const n = cols * rows;
    this.strength         = new Float32Array(n);   // current pheromone level
    this.visitCount       = new Uint16Array(n);    // total deposits to this cell
    this.lastVisit        = new Int32Array(n).fill(-9999); // tick of last deposit
    this.uniqueDroneCount = new Uint8Array(n);     // count of unique drones that verified this cell
    this.explorationGrid  = new Float32Array(n);   // 0.0 (unexplored fog) to 1.0 (fully scanned)
    this.cellUncertainty  = new Float32Array(n).fill(0.80); // spatial uncertainty grid (0.0=unambiguous, 1.0=maximum uncertainty)
    this.cellConfidence   = new Float32Array(n);   // spatial running average confidence grid (0.0=none, 1.0=survivor lock)

    // Set array tracking unique drone IDs per cell to prevent single-drone false consensus lock-in
    this._uniqueDroneSets = Array.from({ length: n }, () => new Set());

    // Track the global tick so decay knows how much time has passed
    this._tick = 0;
  }

  // ─── Indexing helpers ────────────────────────────────────────────────────

  _idx(col, row) {
    return row * this.cols + col;
  }

  _inBounds(col, row) {
    return col >= 0 && col < this.cols && row >= 0 && row < this.rows;
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * Deposit pheromone at a grid cell.
   * Diminishing returns apply to repeated visits from the SAME drone.
   * Over-validation deposit cap applies when unique drone count >= 3 to prevent redundant clustering.
   * Records spatial cell confidence and updates cell uncertainty.
   *
   * @param {number} col
   * @param {number} row
   * @param {number} amount   Base deposit (0–1)
   * @param {number} [droneId] ID of depositing drone
   * @param {number} [confidence] Drone estimated confidence
   * @param {number} [uncertainty] Drone estimated uncertainty
   */
  deposit(col, row, amount, droneId, confidence, uncertainty) {
    if (!this._inBounds(col, row)) return;
    const i = row * this.cols + col;

    const droneSet = this._uniqueDroneSets[i];
    const isNewUniqueDrone = droneId !== undefined && !droneSet.has(droneId);

    let depositMultiplier = 1.0;
    if (droneId !== undefined) {
      if (isNewUniqueDrone) {
        droneSet.add(droneId);
        this.uniqueDroneCount[i] = droneSet.size;

        // Over-Validation Cap: If 3+ unique drones have already corroborated this cell,
        // reduce deposit multiplier to 0.15x to prevent excessive swarm over-saturation
        if (droneSet.size > 3) {
          depositMultiplier = 0.15;
        } else {
          // High information gain bonus for a NEW independent drone corroborating
          depositMultiplier = 1.35;
        }
      } else {
        // Diminishing returns on repeated visits by the SAME drone (prevents false consensus lock-in)
        depositMultiplier = 0.35;
      }
    }

    const deposit = amount * depositMultiplier;
    this.strength[i]   = Math.min(this.maxStrength, this.strength[i] + deposit);
    this.visitCount[i] += 1;
    this.lastVisit[i]  = this._tick;

    // Update running average confidence and spatial cell uncertainty
    const cVal = confidence !== undefined ? confidence : amount;
    const uVal = uncertainty !== undefined ? uncertainty : Math.max(0, 1.0 - cVal);
    this.cellConfidence[i]  = this.cellConfidence[i] * 0.70 + cVal * 0.30;
    this.cellUncertainty[i] = Math.max(0.02, this.cellUncertainty[i] * 0.75 + uVal * 0.25);
  }

  /**
   * Advance time by one tick — strength-aware decay.
   * Weak uncorroborated trails fade FAST.
   * Strong multi-drone confirmed trails fade SLOWLY and retain a protection floor.
   */
  tick() {
    this._tick++;
    const n = this.cols * this.rows;
    for (let i = 0; i < n; i++) {
      if (this.securedCells && this.securedCells.has(i)) {
        this.strength[i] = 0.0;
        continue;
      }
      if (this.strength[i] <= this.minStrength) continue;

      const s = this.strength[i];
      const age = this._tick - this.lastVisit[i];

      // Strength-aware decay rate (PINN Reaction-Diffusion Reaction Term gamma):
      // Weak signals (s < 0.35) decay fast (gamma_high) so noise clears quickly.
      // Strong multi-drone signals (s >= 0.50) decay slowly (gamma_low) so leads are preserved.
      let decayRate = getPINNDecayRate(false);
      let decayFloor = this.minStrength;

      if (s >= 0.50) {
        decayRate = getPINNDecayRate(true);
        // Decay floor ensures high-confidence survivor leads never vanish completely while swarm explores elsewhere
        decayFloor = 0.22;
      } else if (s >= 0.30) {
        decayRate = (getPINNDecayRate(false) + getPINNDecayRate(true)) * 0.5;
        decayFloor = 0.08;
      }

      // Active trail bonus if visited recently
      if (age < this.reinforceWindow) {
        decayRate *= 0.35;
      }

      this.strength[i] = Math.max(decayFloor, this.strength[i] - decayRate);
    }
  }

  /**
   * Get raw pheromone strength at a cell (0–1).
   */
  getStrength(col, row) {
    if (!this._inBounds(col, row)) return 0;
    return this.strength[row * this.cols + col];
  }

  /**
   * Get maximum pheromone strength within a local radius around (col, row).
   */
  getLocalMaxStrength(col, row, radius = 1) {
    let maxS = 0;
    for (let dc = -radius; dc <= radius; dc++) {
      for (let dr = -radius; dr <= radius; dr++) {
        const s = this.getStrength(col + dc, row + dr);
        if (s > maxS) maxS = s;
      }
    }
    return maxS;
  }

  /**
   * Get count of unique visiting drones for a grid cell.
   */
  getUniqueDroneCount(col, row) {
    if (!this._inBounds(col, row)) return 0;
    return this.uniqueDroneCount[row * this.cols + col];
  }

  /**
   * Get maximum unique visiting drones within a local radius around (col, row).
   */
  getLocalUniqueDroneCount(col, row, radius = 1) {
    let maxU = 0;
    for (let dc = -radius; dc <= radius; dc++) {
      for (let dr = -radius; dr <= radius; dr++) {
        const u = this.getUniqueDroneCount(col + dc, row + dr);
        if (u > maxU) maxU = u;
      }
    }
    return maxU;
  }

  /**
   * Get spatial cell uncertainty at a location (0–1).
   */
  getCellUncertainty(col, row) {
    if (!this._inBounds(col, row)) return 0.80;
    return this.cellUncertainty[row * this.cols + col];
  }

  /**
   * Get spatial cell running average confidence at a location (0–1).
   */
  getCellConfidence(col, row) {
    if (!this._inBounds(col, row)) return 0.0;
    return this.cellConfidence[row * this.cols + col];
  }

  /**
   * Compute the spatial uncertainty gradient direction at a cell.
   * Returns a unit vector { dx, dy } pointing toward neighbor cells with highest spatial uncertainty (curiosity frontier).
   */
  getUncertaintyGradient(col, row) {
    let dx = 0;
    let dy = 0;

    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) {
        if (dc === 0 && dr === 0) continue;
        const nc = col + dc;
        const nr = row + dr;
        const u = this._inBounds(nc, nr)
          ? this.cellUncertainty[nr * this.cols + nc]
          : 0.0;
        dx += dc * u;
        dy += dr * u;
      }
    }

    const mag = Math.sqrt(dx * dx + dy * dy);
    if (mag < 1e-6) return { dx: 0, dy: 0 };
    return { dx: dx / mag, dy: dy / mag };
  }

  /**
   * Compute the gradient direction at a cell by comparing neighbor strengths.
   * Returns a unit-ish vector { dx, dy } pointing toward steepest ascent.
   * Returns { dx:0, dy:0 } if perfectly flat.
   */
  getGradient(col, row) {
    let dx = 0;
    let dy = 0;

    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) {
        if (dc === 0 && dr === 0) continue;
        const nc = col + dc;
        const nr = row + dr;
        const s = this._inBounds(nc, nr)
          ? this.strength[nr * this.cols + nc]
          : 0;
        dx += dc * s;
        dy += dr * s;
      }
    }

    const mag = Math.sqrt(dx * dx + dy * dy);
    if (mag < 1e-6) return { dx: 0, dy: 0 };
    return { dx: dx / mag, dy: dy / mag };
  }

  /**
   * Mark cells around a given location as explored (clears Fog of War).
   * @param {number} col
   * @param {number} row
   * @param {number} radius
   */
  markExplored(col, row, radius = 2.0) {
    const minC = Math.max(0, Math.floor(col - radius));
    const maxC = Math.min(this.cols - 1, Math.ceil(col + radius));
    const minR = Math.max(0, Math.floor(row - radius));
    const maxR = Math.min(this.rows - 1, Math.ceil(row + radius));
    const rSq = radius * radius;

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const distSq = (c - col) * (c - col) + (r - row) * (r - row);
        if (distSq <= rSq) {
          const idx = r * this.cols + c;
          const factor = Math.max(0.4, 1.0 - (distSq / (rSq * 1.5)));
          this.explorationGrid[idx] = Math.min(1.0, this.explorationGrid[idx] + factor * 0.4);
          
          // Also clear spatial uncertainty radially (so unreachable edges don't pull drones forever)
          this.cellUncertainty[idx] = Math.max(0.05, this.cellUncertainty[idx] - factor * 0.05);
        }
      }
    }
  }

  /**
   * Clear local pheromone attraction peak.
   * If isSecured === true (survivor extracted), sets uncertainty to 0 and adds to securedCells to repel swarm toward remaining targets.
   * If isSecured === false (decoy rejected), clears pheromone strength/confidence but allows drones to freely explore through.
   * @param {number} col
   * @param {number} row
   * @param {number} radius
   * @param {boolean} [isSecured=true]
   */
  clearLocalAttraction(col, row, radius = 4.5, isSecured = true) {
    if (!this.securedCells) this.securedCells = new Set();

    const minC = Math.max(0, Math.floor(col - radius));
    const maxC = Math.min(this.cols - 1, Math.ceil(col + radius));
    const minR = Math.max(0, Math.floor(row - radius));
    const maxR = Math.min(this.rows - 1, Math.ceil(row + radius));
    const rSq = radius * radius;

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const distSq = (c - col) * (c - col) + (r - row) * (r - row);
        if (distSq <= rSq) {
          const idx = r * this.cols + c;
          this.strength[idx] = 0.0;
          this.cellConfidence[idx] = 0.0;
          if (isSecured) {
            this.cellUncertainty[idx] = 0.0; // uncertainty=0 means NO exploration pull here
            this.securedCells.add(idx);
          }
        }
      }
    }
  }

  /**
   * Return average strength across all cells (useful for stats overlay).
   */
  averageStrength() {
    const n = this.cols * this.rows;
    let sum = 0;
    for (let i = 0; i < n; i++) sum += this.strength[i];
    return sum / n;
  }

  /**
   * Reset the entire field to zero.
   */
  reset() {
    this.strength.fill(0);
    this.visitCount.fill(0);
    this.lastVisit.fill(-9999);
    this.uniqueDroneCount.fill(0);
    this.explorationGrid.fill(0);
    this.cellUncertainty.fill(0.80);
    this.cellConfidence.fill(0.0);
    for (const s of this._uniqueDroneSets) s.clear();
    this._tick = 0;
  }
}
