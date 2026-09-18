/**
 * comms.js — RF Link Quality Model (Self-Healing Network Layer)
 *
 * Computes probabilistic link quality between any two drones based on:
 *   1. Distance decay — exponential falloff beyond half of radio range
 *   2. Rubble occlusion — Bresenham ray-cast through scenario grid;
 *      each RUBBLE cell attenuates signal by 15%
 *
 * This module is used by the swarm message router to probabilistically
 * drop messages, and by each drone to assess its own comms health.
 */

// ─── Constants ───────────────────────────────────────────────────────────────

export const RADIO_RANGE = 6.0;                // Max RF range in grid units
const DISTANCE_HALF_RANGE = RADIO_RANGE / 2;   // Decay onset distance
const DISTANCE_DECAY_RATE = 2.0;               // Exponential decay steepness
const RUBBLE_ATTENUATION = 0.85;               // Per-rubble-cell signal retention (15% loss)

// ─── Bresenham Ray-Cast ──────────────────────────────────────────────────────

/**
 * Bresenham's line algorithm to enumerate all grid cells along a ray
 * from (x0,y0) to (x1,y1). Returns array of {col, row} integer positions.
 */
function bresenhamRay(x0, y0, x1, y1) {
  const cells = [];
  let cx = Math.floor(x0);
  let cy = Math.floor(y0);
  const ex = Math.floor(x1);
  const ey = Math.floor(y1);

  const dx = Math.abs(ex - cx);
  const dy = Math.abs(ey - cy);
  const sx = cx < ex ? 1 : -1;
  const sy = cy < ey ? 1 : -1;
  let err = dx - dy;

  while (true) {
    cells.push({ col: cx, row: cy });
    if (cx === ex && cy === ey) break;

    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; cx += sx; }
    if (e2 < dx)  { err += dx; cy += sy; }
  }
  return cells;
}

// ─── Link Quality Computation ────────────────────────────────────────────────

/**
 * Compute RF link quality between two drones.
 *
 * @param {import('./drone.js').Drone} droneA
 * @param {import('./drone.js').Drone} droneB
 * @param {import('./scenario.js').DisasterScenario} scenario
 * @returns {number} Link quality in [0, 1] — 1.0 = perfect, 0.0 = no signal
 */
export function getLinkQuality(droneA, droneB, scenario) {
  const dist = Math.hypot(droneA.x - droneB.x, droneA.y - droneB.y);

  // Beyond radio range → no link at all
  if (dist > RADIO_RANGE) return 0;

  // 1. Distance decay factor: perfect until HALF_RANGE, then exponential falloff
  const distFactor = dist <= DISTANCE_HALF_RANGE
    ? 1.0
    : Math.exp(-DISTANCE_DECAY_RATE * (dist - DISTANCE_HALF_RANGE) / RADIO_RANGE);

  // 2. Rubble occlusion: ray-cast through scenario grid
  let rubbleCount = 0;
  if (scenario) {
    const rayCells = bresenhamRay(droneA.x, droneA.y, droneB.x, droneB.y);
    for (const cell of rayCells) {
      const cellType = scenario.getCellType(cell.col, cell.row);
      if (cellType === 'RUBBLE') {
        rubbleCount++;
      }
    }
  }

  const occlusionFactor = Math.pow(RUBBLE_ATTENUATION, rubbleCount);

  // 3. Final link quality
  return Math.max(0, Math.min(1, distFactor * occlusionFactor));
}

/**
 * Probabilistic delivery gate: returns true if a message should be delivered.
 *
 * @param {number} linkQuality — value from getLinkQuality()
 * @returns {boolean}
 */
export function shouldDeliver(linkQuality) {
  return Math.random() < linkQuality;
}

/**
 * Compute average link quality for a drone to all its neighbors within radio range.
 *
 * @param {import('./drone.js').Drone} drone
 * @param {import('./drone.js').Drone[]} allDrones
 * @param {import('./scenario.js').DisasterScenario} scenario
 * @returns {number} Average link quality in [0, 1]
 */
export function getAvgLinkQuality(drone, allDrones, scenario) {
  let sum = 0;
  let count = 0;

  for (const other of allDrones) {
    if (other.id === drone.id) continue;
    const dist = Math.hypot(drone.x - other.x, drone.y - other.y);
    if (dist <= RADIO_RANGE) {
      sum += getLinkQuality(drone, other, scenario);
      count++;
    }
  }

  return count > 0 ? sum / count : 0;
}
