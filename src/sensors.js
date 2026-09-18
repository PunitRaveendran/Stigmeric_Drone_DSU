/**
 * sensors.js — Sensor Generators with Real ML Model Integration (Phase 3)
 *
 * Generates sensor readings for each cell type in a disaster scenario.
 * When the Python ML API server is running, sensor values are based on
 * REAL YOLO and YAMNet inference outputs. All values are [0, 1] normalized.
 *
 * Cell types and their expected sensor profiles:
 *   SURVIVOR    → thermal HIGH, audio MEDIUM-HIGH, gas MEDIUM  (all channels active)
 *   HOT_DEBRIS  → thermal HIGH, audio LOW,         gas LOW     (thermal false positive)
 *   WIND_NOISE  → thermal LOW,  audio HIGH,         gas LOW    (audio false positive)
 *   HAZARD      → thermal LOW,  audio LOW,           gas HIGH  (hazard zone)
 *   RUBBLE      → all LOW with minor noise
 *   CLEAR       → all very LOW
 *
 * Real Model Integration:
 *   - YOLO (human_detector.pt): provides 'camera' channel base values
 *   - YAMNet (yamnet_binary_final): provides 'audio' channel base values
 *   - Passive Thermal: provides 'thermal' channel base values
 */

import { getPINNThermalReading } from './pinn.js';

// Noise parameter — controls how uncertain individual readings look
const NOISE_SIGMA = 0.08; // ≈ calibrated to RoboCup Rescue-style sensor variability

/**
 * Box-Muller transform for Gaussian noise.
 * @param {number} mean
 * @param {number} sigma
 * @returns {number} sample
 */
function gaussian(mean, sigma) {
  // Box-Muller — fast and adequate for simulation noise
  const u1 = Math.random();
  const u2 = Math.random();
  const z  = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
  return Math.min(1, Math.max(0, mean + sigma * z));
}

/**
 * Slow sinusoidal wobble to make readings feel "live" over time.
 * @param {number} tick
 * @param {number} freq   cycles per 100 ticks
 * @param {number} amp    amplitude of wobble
 */
function wobble(tick, freq = 1.0, amp = 0.05) {
  return amp * Math.sin((tick / 100) * freq * 2 * Math.PI);
}

// ─── Real ML Model Inference Cache ───────────────────────────────────────────
// Fetched from Python API server (/api/inference) at startup.
// Contains REAL YOLO and YAMNet outputs for each cell type.

let realModelData = null;
let modelFetchAttempted = false;

async function fetchRealModelData() {
  if (modelFetchAttempted) return;
  modelFetchAttempted = true;
  try {
    const res = await fetch('/api/inference');
    if (res.ok) {
      const data = await res.json();
      realModelData = data.inference_results;
      console.log('🧠 REAL ML MODEL DATA LOADED:', realModelData);
      console.log(`   YOLO model: ${data.models.yolo}`);
      console.log(`   YAMNet model: ${data.models.yamnet}`);
      console.log(`   Formula: ${data.formula}`);
    }
  } catch (e) {
    console.warn('⚠️ ML API server not available — using synthetic sensor profiles.');
  }
}

// Auto-fetch non-blockingly after module load
setTimeout(() => {
  fetchRealModelData();
}, 50);

/**
 * Get real model value for a cell type and channel, with fallback.
 */
function realValue(cellType, channel, fallback) {
  if (!realModelData || !realModelData[cellType]) return fallback;
  const d = realModelData[cellType];
  if (channel === 'camera') return d.yolo ?? fallback;
  if (channel === 'audio') return d.yamnet_human ?? fallback;
  if (channel === 'thermal') return d.passive_thermal ?? fallback;
  return fallback;
}

// ─── Cell-type sensor profiles (using real model outputs when available) ─────

const PROFILES = {
  SURVIVOR: (tick) => ({
    thermal: gaussian(getPINNThermalReading(true, tick, realValue('SURVIVOR', 'thermal', 0.82)) + wobble(tick, 0.7, 0.04), NOISE_SIGMA),
    audio:   gaussian(realValue('SURVIVOR', 'audio', 0.75)   + wobble(tick, 1.3, 0.08), NOISE_SIGMA * 1.2),
    camera:  gaussian(realValue('SURVIVOR', 'camera', 0.88)  + wobble(tick, 0.5, 0.05), NOISE_SIGMA * 0.8),
    gas:     gaussian(0.45 + wobble(tick, 0.4, 0.03), NOISE_SIGMA),
  }),

  HOT_DEBRIS: (tick) => ({
    thermal: gaussian(getPINNThermalReading(false, tick, realValue('HOT_DEBRIS', 'thermal', 0.82)) + wobble(tick, 0.3, 0.03), NOISE_SIGMA * 0.7),
    audio:   gaussian(realValue('HOT_DEBRIS', 'audio', 0.07),                              NOISE_SIGMA * 0.6),
    camera:  gaussian(realValue('HOT_DEBRIS', 'camera', 0.02),                              NOISE_SIGMA * 0.4),
    gas:     gaussian(0.12, NOISE_SIGMA * 0.8),
  }),

  WIND_NOISE: (tick) => ({
    thermal: gaussian(realValue('WIND_NOISE', 'thermal', 0.10),                              NOISE_SIGMA * 0.5),
    audio:   gaussian(realValue('WIND_NOISE', 'audio', 0.78)   + wobble(tick, 3.1, 0.15), NOISE_SIGMA * 1.5),
    camera:  gaussian(realValue('WIND_NOISE', 'camera', 0.03),                              NOISE_SIGMA * 0.4),
    gas:     gaussian(0.08, NOISE_SIGMA * 0.4),
  }),

  MANNEQUIN: (tick) => ({
    thermal: gaussian(0.10,                            NOISE_SIGMA * 0.5),
    audio:   gaussian(0.05,                            NOISE_SIGMA * 0.5),
    camera:  gaussian(0.85 + wobble(tick, 0.2, 0.04), NOISE_SIGMA * 0.8),
    gas:     gaussian(0.04,                            NOISE_SIGMA * 0.4),
  }),

  HAZARD: (tick) => ({
    thermal: gaussian(0.18 + wobble(tick, 0.5, 0.02), NOISE_SIGMA),
    audio:   gaussian(0.06,                            NOISE_SIGMA * 0.5),
    camera:  gaussian(0.02,                            NOISE_SIGMA * 0.4),
    gas:     gaussian(0.88 + wobble(tick, 0.2, 0.02), NOISE_SIGMA * 0.6),
  }),

  RUBBLE: (_tick) => ({
    thermal: gaussian(realValue('EMPTY', 'thermal', 0.18), NOISE_SIGMA * 1.1),
    audio:   gaussian(realValue('EMPTY', 'audio', 0.12),   NOISE_SIGMA * 1.3),
    camera:  gaussian(realValue('EMPTY', 'camera', 0.05),  NOISE_SIGMA * 1.1),
    gas:     gaussian(0.10, NOISE_SIGMA),
  }),

  CLEAR: (_tick) => ({
    thermal: gaussian(realValue('EMPTY', 'thermal', 0.06), NOISE_SIGMA * 0.5),
    audio:   gaussian(realValue('EMPTY', 'audio', 0.05),   NOISE_SIGMA * 0.5),
    camera:  gaussian(realValue('EMPTY', 'camera', 0.02),  NOISE_SIGMA * 0.4),
    gas:     gaussian(0.04, NOISE_SIGMA * 0.4),
  }),
};

// ─── SensorGenerator class ───────────────────────────────────────────────────

export class SensorGenerator {
  /**
   * @param {import('./scenario.js').DisasterScenario} scenario
   */
  constructor(scenario) {
    this.scenario = scenario;
  }

  /**
   * Get a sensor reading at grid position (col, row) at the given tick.
   * Returns null for out-of-bounds cells.
   *
   * @param {number} col
   * @param {number} row
   * @param {number} tick
   * @returns {{ thermal: number, audio: number, camera: number, gas: number } | null}
   */
  getSensorAt(col, row, tick) {
    const cellType = this.scenario.getCellType(col, row);
    if (!cellType) return null;

    const profile = PROFILES[cellType] ?? PROFILES.CLEAR;
    return profile(tick);
  }

  /**
   * Get readings in a local neighborhood (3×3) and return the average.
   * Modulates readings by drone approach angle and distance/range (vantage point matters).
   *
   * @param {number} col
   * @param {number} row
   * @param {number} tick
   * @param {import('./drone.js').Drone} [drone]
   * @returns {{ thermal: number, audio: number, camera: number, gas: number, vantageFactor: number }}
   */
  getLocalReadings(col, row, tick, drone) {
    let thermal = 0, audio = 0, camera = 0, gas = 0, count = 0;

    // Calculate drone approach angle & distance modulation factor
    let vantageFactor = 1.0;
    if (drone) {
      const droneHeading = drone.heading || 0;
      const dx = (col + 0.5) - drone.x;
      const dy = (row + 0.5) - drone.y;
      const cellAngle = Math.atan2(dy, dx);
      // Directional factor: sensor sensitivity varies slightly by approach vector
      const angleDiff = Math.abs(droneHeading - cellAngle);
      const angleFactor = 0.88 + 0.24 * Math.cos(angleDiff);
      // Distance/altitude range wobble
      const distanceFactor = 0.92 + 0.16 * Math.sin(tick * 0.15 + drone.id);
      vantageFactor = angleFactor * distanceFactor;
    }

    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) {
        const reading = this.getSensorAt(col + dc, row + dr, tick);
        if (!reading) continue;
        thermal += reading.thermal;
        audio   += reading.audio;
        camera  += reading.camera || 0;
        gas     += reading.gas;
        count++;
      }
    }

    if (count === 0) return { thermal: 0, audio: 0, camera: 0, gas: 0, vantageFactor: 1.0 };
    return {
      thermal: Math.min(1.0, Math.max(0.0, (thermal / count) * vantageFactor)),
      audio:   Math.min(1.0, Math.max(0.0, (audio   / count) * vantageFactor)),
      camera:  Math.min(1.0, Math.max(0.0, (camera  / count) * vantageFactor)),
      gas:     Math.min(1.0, Math.max(0.0, (gas     / count) * vantageFactor)),
      vantageFactor,
    };
  }
}
