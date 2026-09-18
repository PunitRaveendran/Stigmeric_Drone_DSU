/**
 * uncertainty.js — Gradient Agent / Uncertainty + Viscosity Functions
 *
 * Deterministic code only. Takes sensor readings and produces:
 *   - uncertainty: how ambiguous is this location? (0=certain nothing, 1=maximum ambiguity)
 *   - viscosity:   what behavioral regime should drones enter?  (0=spread, 1=solidify)
 *
 * The viscosity curve is the single scalar governing ALL swarm behavior.
 * High uncertainty → low viscosity → drones spread and search.
 * Low uncertainty with weak signal → mid viscosity → drones converge and re-verify.
 * Low uncertainty with strong, consistent signal → high viscosity → trail solidifies.
 */

// ─── Regime constants ───────────────────────────────────────────────────────

export const REGIME_SPREAD    = 'SPREAD';     // viscosity < SPREAD_MAX
export const REGIME_CONVERGE  = 'CONVERGE';   // SPREAD_MAX <= v < SOLIDIFY_MIN
export const REGIME_SOLIDIFY  = 'SOLIDIFY';   // viscosity >= SOLIDIFY_MIN

export const SPREAD_MAX    = 0.30;
export const SOLIDIFY_MIN  = 0.68;

// Channel weights — Tri-modal sensor fusion weights (YOLO Camera 40%, YAMNet Audio 40%, Thermal/Passive 20%)
const W_CAMERA  = 0.40; // YOLO Human Detector (Y)
const W_AUDIO   = 0.40; // YAMNet Audio Classifier (A)
const W_THERMAL = 0.20; // Passive Thermal/Gas (P)

// ─── Core functions ─────────────────────────────────────────────────────────

/**
 * Compute a raw confidence score from sensor readings.
 * All sensor values are expected in [0, 1] range.
 * C = (0.40 * Y) + (0.40 * A) + (0.20 * P)
 *
 * @param {{ thermal: number, audio: number, camera?: number, gas?: number }} readings
 * @returns {number} confidence 0–1
 */
export function computeConfidence(readings) {
  const { thermal = 0, audio = 0, camera = 0, gas = 0 } = readings;

  // Tri-modal weighted combination
  const passive = Math.max(thermal, gas);
  const raw = W_CAMERA * camera + W_AUDIO * audio + W_THERMAL * passive;

  // Active channels above noise threshold (0.28)
  const channels = [camera, audio, passive];
  const activeChannels = channels.filter(v => v > 0.28).length;

  let consistency = 0.45;
  if (activeChannels === 1)  consistency = 0.55;  // single-channel signal (hot debris / wind noise / mannequin) -> capped
  if (activeChannels === 2)  consistency = 0.95;  // two channels -> candidate signal
  if (activeChannels >= 3)  consistency = 1.25;  // all three channels agree -> confirmed multi-modal lock

  const C = Math.min(1.0, Math.max(0.0, raw * consistency));
  return C;
}

/**
 * Classify overall confidence into decision text.
 * @param {number} C
 * @returns {"NO HUMAN" | "VERIFY WITH OTHER DRONES" | "HIGH-CONFIDENCE HUMAN"}
 */
export function getConfidenceDecision(C) {
  if (C < 0.40) return "NO HUMAN";
  if (C < 0.75) return "VERIFY WITH OTHER DRONES";
  return "HIGH-CONFIDENCE HUMAN";
}

export function computeUncertainty(readings) {
  const { thermal = 0, audio = 0, camera = 0, gas = 0 } = readings;
  const passive = Math.max(thermal, gas);

  const vals = [camera, audio, passive];
  const mean = (camera + audio + passive) / 3;
  const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / 3;
  const stdDev = Math.sqrt(variance);

  const activeChannels = vals.filter(v => v > 0.28).length;

  // High uncertainty when only 1 channel active (uncorroborated false positive risk)
  let channelAmbiguity = 0.80;
  if (activeChannels === 1) channelAmbiguity = 0.55; // single channel is uncertain
  if (activeChannels === 2) channelAmbiguity = 0.20; // 2 channels moderate ambiguity
  if (activeChannels >= 3) channelAmbiguity = 0.04; // 3 channels unambiguous

  return Math.min(1.0, Math.max(0.0, 0.35 * stdDev + 0.65 * channelAmbiguity));
}

export function computeViscosity(uncertainty, confidence) {
  const clarity = Math.max(0, 1 - uncertainty);
  // Viscosity requires BOTH high confidence AND high clarity (low uncertainty).
  // Single-channel false positives have high uncertainty, suppressing viscosity into SPREAD range (<0.30).
  // Multi-channel survivor signals have high confidence + low uncertainty, yielding high viscosity (CONVERGE/SOLIDIFY).
  const rawViscosity = confidence * Math.pow(clarity, 1.8);
  return smoothstep(0, 1, rawViscosity);
}

/**
 * Smooth cubic interpolation, mirroring GLSL smoothstep.
 * Reduces jitter at regime boundaries.
 */
export function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Classify a viscosity value into a named regime.
 * @param {number} viscosity  0–1
 * @returns {'SPREAD'|'CONVERGE'|'SOLIDIFY'}
 */
export function classifyRegime(viscosity) {
  if (viscosity >= SOLIDIFY_MIN) return REGIME_SOLIDIFY;
  if (viscosity >= SPREAD_MAX)   return REGIME_CONVERGE;
  return REGIME_SPREAD;
}

/**
 * Diagnostic sweep — useful for browser-console verification.
 * Logs a table of uncertainty × confidence → viscosity → regime.
 * Call: window.protoplasm.runSweep()
 */
export function runSweep() {
  console.group('Viscosity sweep (uncertainty × confidence)');
  console.table(
    [0, 0.25, 0.5, 0.75, 1.0].flatMap(u =>
      [0, 0.25, 0.5, 0.75, 1.0].map(c => {
        const v = computeViscosity(u, c);
        return {
          uncertainty: u.toFixed(2),
          confidence:  c.toFixed(2),
          viscosity:   v.toFixed(3),
          regime:      classifyRegime(v),
        };
      })
    )
  );
  console.groupEnd();
}
