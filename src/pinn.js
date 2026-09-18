/**
 * pinn.js — Physics-Informed Neural Network (PINN) Substrate Client
 * Fetches and applies calibrated physics parameters for:
 *   1. Pheromone Reaction-Diffusion PDE (Continuous field decay & diffusion)
 *   2. Drone Aerodynamics & Battery Power Dynamics ODE (Velocity, Altitude, Role-based drain)
 */

export const CONFIG = {
  ENABLE_PINN_PHEROMONE: true,
  ENABLE_PINN_BATTERY: true,
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
      batteryPhysics = await resBattery.json();
      console.log('⚡ [PINN] Battery Aerodynamics & Payload ODE parameters loaded:', batteryPhysics);
    }
  } catch (e) {
    console.info('ℹ️ [PINN] Using offline Battery ODE calibration');
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
 * Get PINN battery drain per tick based on drone role.
 * @param {string} role ('SCOUT', 'RELAY', 'SENTINEL')
 * @returns {number} battery drain percentage per tick
 */
export function getPINNBatteryDrain(role) {
  if (!CONFIG.ENABLE_PINN_BATTERY) {
    return 0.022; // baseline
  }
  const roleName = role ? (role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()) : 'Default';
  return (
    batteryPhysics.approx_drain_per_tick?.[roleName] ??
    batteryPhysics.approx_drain_per_tick?.default ??
    0.022
  );
}
