/**
 * pinn.js — Physics-Informed Neural Network (PINN) Substrate Client
 * Fetches and applies calibrated physics parameters for:
 *   1. Pheromone Reaction-Diffusion PDE (Continuous field decay & diffusion)
 *   2. Drone Aerodynamics & Battery Power Dynamics ODE (Velocity, Altitude, Role-based drain)
 */

export const CONFIG = {
  ENABLE_PINN_PHEROMONE: true,
  ENABLE_PINN_BATTERY: true,
  ENABLE_PINN_THERMAL: true,
};

// Physics defaults (matching trained PINN solution)
let pheromonePhysics = {
  D: 0.05,
  gamma_low: 0.010,   // Corroborated / persistent
  gamma_high: 0.055,  // Uncorroborated / fast decay
};

let batteryPhysics = {
  roles: ["Scout", "Relay", "Sentinel"],
  approx_drain_per_tick: {
    Scout: 0.028,
    Relay: 0.031,
    Sentinel: 0.011,
    default: 0.022,
  },
  // Aerodynamic drag ODE parameters (V^3 cubic power law: P = P_payload + P_hover + P_parasitic)
  v_ref: 3.5,            // reference cruise speed (m/s)
  k_aero: 0.012,         // parasitic aerodynamic drag coefficient (scales as (v/v_ref)^3)
  k_hover: 0.014,        // base hover power requirement for multirotor thrust
  k_alt: 0.004,          // altitude wind shear/thinning factor per meter above 15m
  payload_power: {
    Scout: 0.008,        // NPU inference (YOLO/YAMNet) + multi-spectral sensor rig
    Relay: 0.012,        // High-power RF mesh amplification & forwarding
    Sentinel: 0.002,     // Ultra-low-power radio beacon & station-keeping
    Default: 0.006,
  },
};

let thermalPhysics = {
  k_debris: 0.045,
  k_biological: 0.001,
  T_ambient: 0.15,
  cooling_half_life_ticks: 75,
  persistence_threshold: 0.65,
};

let fetched = false;

export async function initPINN() {
  if (fetched) return;
  fetched = true;

  try {
    const resPheromone = await fetch('/api/pinn/pheromone');
    if (resPheromone.ok) {
      pheromonePhysics = await resPheromone.json();
      console.log('⚛️ [PINN] Pheromone Reaction-Diffusion PDE parameters loaded:', pheromonePhysics);
    }
  } catch (e) {
    console.info('ℹ️ [PINN] Using offline Pheromone PDE calibration');
  }

  try {
    const resBattery = await fetch('/api/pinn/battery');
    if (resBattery.ok) {
      const data = await resBattery.json();
      batteryPhysics = { ...batteryPhysics, ...data };
      console.log('⚡ [PINN] Battery Aerodynamics & Payload ODE parameters loaded:', batteryPhysics);
    }
  } catch (e) {
    console.info('ℹ️ [PINN] Using offline Battery ODE calibration');
  }

  try {
    const resThermal = await fetch('/api/pinn/thermal');
    if (resThermal.ok) {
      thermalPhysics = await resThermal.json();
      console.log('🌡️ [PINN] Thermal Newtonian Cooling & Homeostasis ODE loaded:', thermalPhysics);
    }
  } catch (e) {
    console.info('ℹ️ [PINN] Using offline Thermal ODE calibration');
  }
}

// Auto-fetch non-blockingly
if (typeof window !== 'undefined') {
  setTimeout(initPINN, 100);
}

/**
 * Get PINN pheromone decay rate.
 * @param {boolean} isCorroborated
 * @returns {number} decay rate per tick
 */
export function getPINNDecayRate(isCorroborated) {
  if (!CONFIG.ENABLE_PINN_PHEROMONE) {
    return isCorroborated ? 0.008 : 0.045;
  }
  return isCorroborated ? (pheromonePhysics.gamma_low ?? 0.010) : (pheromonePhysics.gamma_high ?? 0.055);
}

/**
 * Get PINN battery drain per 30-tick cycle governed by Aerodynamic Drag & Payload ODE.
 *
 * Physical power formulation for multirotor UAV:
 *   P_total = P_payload(role) + P_hover(altitude) + P_parasitic(velocity)
 *
 * Where:
 *   1. P_payload:   Compute/avionics/sensor payload (Scout: NPU+sensors, Relay: mesh RF, Sentinel: beacon)
 *   2. P_hover:     Base thrust power to hover mg = T, scaled with air density / wind shear at altitude
 *   3. P_parasitic: Parasitic fuselage drag scaling with the CUBE of velocity:
 *                   P_parasitic = 0.5 * rho * C_d * A * v^3 = k_aero * (v / v_ref)^3
 *
 * @param {string|object} role  'SCOUT'|'RELAY'|'SENTINEL' or drone instance { role, currentSpeed, altitude }
 * @param {number} [speed=0]     Flight velocity in m/s (from drone telemetry)
 * @param {number} [altitude=15] Flight altitude tier in meters (15, 25, 35)
 * @returns {number} battery drain percentage per 30-tick evaluation period
 */
export function getPINNBatteryDrain(role, speed = 0, altitude = 15) {
  if (typeof role === 'object' && role !== null) {
    speed = role.currentSpeed ?? role.speed ?? 0;
    altitude = role.altitude ?? 15;
    role = role.role;
  }

  if (!CONFIG.ENABLE_PINN_BATTERY) {
    return 0.022; // baseline fallback
  }

  const roleName = role ? (role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()) : 'Default';

  // 1. Avionics & Payload Base Power
  const payloadDrain =
    batteryPhysics.payload_power?.[roleName] ??
    batteryPhysics.payload_power?.Default ??
    0.008;

  // 2. Hover Thrust Power (scaled with altitude air thinning and wind shear)
  const kHover = batteryPhysics.k_hover ?? 0.014;
  const kAlt = batteryPhysics.k_alt ?? 0.004;
  const altDelta = Math.max(0, (altitude || 15) - 15);
  const hoverDrain = kHover * (1.0 + kAlt * altDelta);

  // 3. Parasitic Aerodynamic Drag (Cubic Power Law: P ∝ V^3)
  const v = Math.max(0, Number(speed) || 0);
  const vRef = batteryPhysics.v_ref ?? 3.5;
  const kAero = batteryPhysics.k_aero ?? 0.012;
  const aeroDrain = kAero * Math.pow(v / vRef, 3);

  // Total drain per 30-tick evaluation period
  const totalDrain = payloadDrain + hoverDrain + aeroDrain;

  // Guard against negative drain (Finding L4), zero, or NaN
  if (isNaN(totalDrain) || totalDrain <= 0) {
    return 0.010;
  }

  return totalDrain;
}

/**
 * Compute PINN thermal dissipation / persistence over elapsed observation ticks.
 * For inanimate debris, heat decays according to Newton's Law of Cooling ODE:
 *   T(t) = T_ambient + (T0 - T_ambient) * exp(-k_debris * t)
 * For biological survivors, metabolic homeostasis maintains constant thermal signature:
 *   T(t) ≈ T0
 *
 * @param {boolean} isBiological True if survivor, false if inanimate debris
 * @param {number} elapsedTicks Ticks elapsed since first observed
 * @param {number} initialThermal Initial normalized thermal reading [0, 1]
 * @returns {number} Decayed/persistent thermal confidence [0, 1]
 */
export function getPINNThermalReading(isBiological, elapsedTicks = 0, initialThermal = 0.82) {
  if (!CONFIG.ENABLE_PINN_THERMAL) {
    return initialThermal;
  }
  const T_ambient = thermalPhysics.T_ambient ?? 0.15;
  const k = isBiological
    ? (thermalPhysics.k_biological ?? 0.001)
    : (thermalPhysics.k_debris ?? 0.045);

  // Analytical solution from trained Thermal PINN ODE
  const cooled = T_ambient + (initialThermal - T_ambient) * Math.exp(-k * (elapsedTicks * 0.15));
  return Math.min(1.0, Math.max(0.0, cooled));
}

/**
 * Get current thermal physics parameters.
 */
export function getThermalPhysics() {
  return thermalPhysics;
}

/**
 * Get current battery physics parameters.
 */
export function getBatteryPhysics() {
  return batteryPhysics;
}

/**
 * Asynchronously query the real-time PINN PyTorch model running on the API server.
 * Returns neural prediction from pinn_battery.pt if server is reachable, or null.
 *
 * @param {string} role ('SCOUT'|'RELAY'|'SENTINEL')
 * @param {number} [speed=0] Flight speed in m/s
 * @param {number} [altitude=15] Altitude in meters
 * @returns {Promise<{ predicted_drain_rate: number, battery_remaining: number, model: string } | null>}
 */
export async function queryPINNBatteryPredict(role = 'Scout', speed = 0, altitude = 15) {
  try {
    const res = await fetch(`/api/pinn/battery/predict?role=${encodeURIComponent(role)}&v=${speed}&z=${altitude}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    // Graceful offline fallback
  }
  return null;
}

