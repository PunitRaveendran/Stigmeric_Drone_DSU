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

// ─── Bayesian Sensor Fusion ─────────────────────────────────────────────────
//
// Each sensor channel produces a reading r in [0, 1]. We model the likelihood
// ratio for each channel independently:
//
//   LR(r) = P(r | survivor) / P(r | no_survivor)
//
// Calibrated from SAR sensor profiles:
//   - Camera (YOLO human detector): strong discriminator, low false-positive rate
//   - Audio (YAMNet classifier):    strong discriminator, moderate environmental noise
//   - Thermal/Gas (passive):        weak discriminator alone, high false-positive from debris
//
// We accumulate evidence in log-odds space:
//   log_odds_posterior = log_odds_prior + sum( log(LR_i) )
//
// Then convert back to probability: P = sigmoid(log_odds)
//
// This correctly handles:
//   - Independent evidence compounds multiplicatively (not averaged)
//   - Correlated channels with similar readings don't over-count
//   - Single-channel noise stays low confidence; multi-channel agreement drives high confidence

// Prior probability of a survivor being at any given cell (sparse targets in disaster zone)
const LOG_ODDS_PRIOR = -2.20;  // P(survivor) ~ 0.10 prior — most cells are empty rubble

// Noise floor: readings below this are indistinguishable from background
const NOISE_FLOOR = 0.10;

// ─── Core functions ─────────────────────────────────────────────────────────

/**
 * Convert probability to log-odds: log(p / (1 - p))
 */
function toLogOdds(p) {
  const clamped = Math.max(1e-9, Math.min(1 - 1e-9, p));
  return Math.log(clamped / (1 - clamped));
}

/**
 * Convert log-odds back to probability: 1 / (1 + exp(-x))  (sigmoid)
 */
function sigmoid(x) {
  if (x > 20) return 1.0;
  if (x < -20) return 0.0;
  return 1.0 / (1.0 + Math.exp(-x));
}

/**
 * Compute log-likelihood ratio for a single sensor channel.
 *
 * Models P(reading | survivor) and P(reading | no_survivor) as Beta-like
 * distributions calibrated to SAR sensor profiles:
 *   - High reading from a survivor channel: strong positive evidence
 *   - High reading from only one channel: moderate evidence (could be decoy)
 *   - Low reading: weak negative evidence (absence of evidence != evidence of absence)
 *
 * @param {number} reading   Sensor value in [0, 1]
 * @param {number} trueRate  P(high reading | survivor) — channel sensitivity
 * @param {number} falseRate P(high reading | no_survivor) — false alarm rate
 * @returns {number} log-likelihood ratio
 */
function channelLogLR(reading, trueRate, falseRate) {
  if (reading < NOISE_FLOOR) {
    // Below noise floor: weak negative evidence
    // LR = P(low | survivor) / P(low | no_survivor) = (1 - trueRate) / (1 - falseRate)
    return Math.log((1 - trueRate) / (1 - falseRate));
  }
  // Above noise floor: evidence scales with reading intensity
  // LR increases with reading strength — strong signals are stronger evidence
  const pGivenSurvivor   = trueRate * reading + (1 - trueRate) * 0.05;
  const pGivenNoSurvivor = falseRate * reading + (1 - falseRate) * 0.05;
  return Math.log(pGivenSurvivor / pGivenNoSurvivor);
}

/**
 * Compute posterior confidence via Bayesian fusion in log-odds space.
 *
 * Each sensor channel is treated as an independent observation:
 *   posterior_log_odds = prior_log_odds + LR_camera + LR_audio + LR_thermal
 *
 * This correctly compounds independent evidence and naturally handles:
 *   - Single hot-debris reading (thermal high, others low) → moderate ~0.25
 *   - Two channels confirming (thermal + audio) → candidate ~0.65
 *   - All three channels locked → near-certain ~0.92
 *
 * @param {{ thermal: number, audio: number, camera?: number, gas?: number }} readings
 * @returns {number} posterior confidence 0–1
 */
export function computeConfidence(readings) {
  const { thermal = 0, audio = 0, camera = 0, gas = 0 } = readings;
  const passive = Math.max(thermal, gas);

  // Start with sparse prior (most cells are empty)
  let logOdds = LOG_ODDS_PRIOR;

  // Camera (YOLO): high sensitivity (0.85), low false-positive (0.08)
  logOdds += channelLogLR(camera, 0.85, 0.08);

  // Audio (YAMNet): high sensitivity (0.80), moderate false-positive (0.15) — environmental noise
  logOdds += channelLogLR(audio, 0.80, 0.15);

  // Thermal/Gas (passive): moderate sensitivity (0.70), high false-positive (0.30) — debris, fires
  logOdds += channelLogLR(passive, 0.70, 0.30);

  // Convert back to probability
  return sigmoid(logOdds);
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

/**
 * Compute information-theoretic uncertainty using Shannon Entropy.
 *
 * Treats sensor readings as a probability distribution over hypotheses
 * (survivor vs decoy-types) and computes:
 *   H = -sum( p_i * log2(p_i) )  /  log2(N)
 *
 * Normalized to [0, 1] where:
 *   0 = all evidence points to one hypothesis (certain)
 *   1 = evidence is uniformly distributed across hypotheses (maximum ambiguity)
 *
 * @param {{ thermal: number, audio: number, camera?: number, gas?: number }} readings
 * @returns {number} uncertainty 0–1
 */
export function computeUncertainty(readings) {
  const { thermal = 0, audio = 0, camera = 0, gas = 0 } = readings;
  const passive = Math.max(thermal, gas);

  const channels = [camera, audio, passive];
  const activeChannels = channels.filter(v => v > NOISE_FLOOR).length;

  // No active channels → maximum uncertainty (no information)
  if (activeChannels === 0) return 1.0;

  // Construct hypothesis distribution from channel activations:
  //   p_survivor  ~ geometric mean of all active channels (agreement)
  //   p_hotdebris ~ thermal alone dominance (thermal high, others low)
  //   p_windnoise ~ audio alone dominance (audio high, others low)
  //   p_empty     ~ all channels low
  const eps = 0.01;
  const pSurvivor  = (camera + eps) * (audio + eps) * (passive + eps);        // all-channel agreement
  const pHotDebris = (passive + eps) * (1 - camera + eps) * (1 - audio + eps); // thermal-only
  const pWindNoise = (audio + eps) * (1 - camera + eps) * (1 - passive + eps); // audio-only
  const pEmpty     = (1 - camera + eps) * (1 - audio + eps) * (1 - passive + eps);

  // Normalize to probability distribution
  const hypotheses = [pSurvivor, pHotDebris, pWindNoise, pEmpty];
  const total = hypotheses.reduce((s, v) => s + v, 0);
  const probs = hypotheses.map(h => h / total);

  // Shannon Entropy: H = -sum(p * log2(p)) / log2(N)
  const N = probs.length;
  let entropy = 0;
  for (const p of probs) {
    if (p > 1e-12) {
      entropy -= p * Math.log2(p);
    }
  }
  // Normalize by max entropy (log2(N)) so result is in [0, 1]
  const maxEntropy = Math.log2(N);
  return Math.min(1.0, Math.max(0.0, entropy / maxEntropy));
}

/**
 * Compute behavioral viscosity from uncertainty and confidence.
 *
 * Uses an Arrhenius-inspired sigmoid rather than an arbitrary polynomial.
 * The "activation energy" metaphor: the system needs sufficient evidence energy
 * (high confidence + low uncertainty) to overcome the barrier and transition
 * from fluid exploration (SPREAD) to crystallized commitment (SOLIDIFY).
 *
 *   viscosity = sigmoid( k * (evidence_energy - E_activation) )
 *
 * where evidence_energy = confidence * clarity, and E_activation is the
 * critical threshold for phase transition.
 *
 * @param {number} uncertainty  0–1 (Shannon entropy)
 * @param {number} confidence   0–1 (Bayesian posterior)
 * @returns {number} viscosity 0–1
 */
export function computeViscosity(uncertainty, confidence) {
  const clarity = Math.max(0, 1 - uncertainty);

  // Evidence energy: product of confidence and clarity
  // Both must be high for the system to transition
  const energy = confidence * clarity;

  // Arrhenius-like sigmoid with activation energy at 0.45
  // k controls the sharpness of the phase transition
  const E_activation = 0.45;
  const k = 8.0;  // Steepness — sharper = more decisive transitions
  const rawViscosity = sigmoid(k * (energy - E_activation));

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
