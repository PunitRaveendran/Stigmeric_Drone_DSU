/**
 * drone.js — Drone Agent (Phase 2)
 *
 * Each drone is a fully independent agent with NO access to:
 *   - Other drones' positions or states
 *   - The global field (it reads only its local neighborhood)
 *   - Ground truth scenario data
 *
 * Coordination is purely stigmergic: drones influence each other only by
 * reading and writing pheromone values via the shared PheromoneField.
 *
 * Movement rules vary by viscosity regime:
 *   SPREAD    → high randomness, weak gradient pull (exploration)
 *   CONVERGE  → moderate gradient pull, reduced randomness (re-verify)
 *   SOLIDIFY  → strong gradient pull, minimal randomness (commit/trail-follow)
 */

import {
  computeConfidence,
  computeUncertainty,
  computeViscosity,
  classifyRegime,
  SPREAD_MAX,
  SOLIDIFY_MIN,
} from './uncertainty.js';
import { getPINNBatteryDrain } from './pinn.js';

// ─── Regime movement parameters ──────────────────────────────────────────────

const REGIME_PARAMS = {
  SPREAD: {
    gradientPull:  0.0,    // Pure exploration: ignore weak trails to prevent circular tail-chasing
    randomWeight:  0.40,   // smooth wander
    speed:         0.36,   // brisk sweeping speed
    depositAmount: 0.02,   // light trail
    stepScale:     0.18,   // smooth step scale
    turnRate:      0.015,  // gentle turns — eliminates tight spinning circles
    inertia:       0.80,   // high forward momentum across grid sectors
  },
  CONVERGE: {
    gradientPull:  0.80,   // strong attraction toward survivor signal center
    randomWeight:  0.20,   // focused movement toward target
    speed:         0.20,   // slowing down as swarm re-verifies
    depositAmount: 0.12,   // heavy trail reinforcement
    stepScale:     0.09,
    turnRate:      0.03,
    inertia:       0.72,
  },
  SOLIDIFY: {
    gradientPull:  0.95,   // lock onto survivor center
    randomWeight:  0.05,   // minimal wander — swarm holds position
    speed:         0.12,   // slow hover over target
    depositAmount: 0.20,   // intense trail lock
    stepScale:     0.07,
    turnRate:      0.01,
    inertia:       0.85,
  },
  RESCUED: {
    gradientPull:  0.0,
    randomWeight:  0.0,
    speed:         0.32,   // transit RTL speed
    depositAmount: 0.0,   // no pheromone deposit during RTL flight
    stepScale:     0.13,
    turnRate:      0.02,
    inertia:       0.80,
  },
};

// ─── Drone class ─────────────────────────────────────────────────────────────

export class Drone {
  /**
   * @param {number} id
   * @param {number} startCol
   * @param {number} startRow
   */
  constructor(id, startCol, startRow) {
    this.id  = id;
    this.col = startCol;
    this.row = startRow;

    // Continuous sub-cell position for smooth rendering
    this.x = startCol + 0.5;
    this.y = startRow + 0.5;

    // Previous position for frame interpolation (set each move())
    this.prevX = this.x;
    this.prevY = this.y;

    // Velocity vector (in grid units/tick)
    this.vx = (Math.random() - 0.5) * 0.5;
    this.vy = (Math.random() - 0.5) * 0.5;

    // Current behavioral state
    this.regime     = 'SPREAD';
    this.viscosity  = 0;
    this.confidence = 0;
    this.uncertainty = 1;

    // Last sensor readings (for display / debugging)
    this.lastReadings = { thermal: 0, audio: 0, camera: 0, gas: 0 };

    // Trail history for rendering
    this.trail = [];
    this.maxTrailLength = 28;

    // Confidence accumulator — smooths out single-tick spikes
    this._smoothedConfidence = 0;
    this._smoothAlpha = 0.15;  // EMA factor — responsive sensor adaptation

    // Smooth visual heading angle (in radians)
    this._headingAngle = Math.random() * 2 * Math.PI;
    this._headingBias = this._headingAngle;

    // Dual-Axis Autonomy: Role Layer (Orthogonal to Regime)
    // Values: 'SCOUT' (default), 'RELAY' (mesh topology bridge), 'SENTINEL' (low battery station)
    this.role = 'SCOUT';

    // Tactical SAR Telemetry & Sentinel State
    this.isSentinel = false;
    this.sentinelTargetCol = null;
    this.sentinelTargetRow = null;
    this.battery = 94 + Math.floor(Math.floor(Math.random() * 6)); // 94–99% telemetry
    this.batteryFloat = this.battery;
    
    // Flight Altitude Band (15m, 25m, 35m tiers for multi-layer 3D flight spacing)
    this.altitude = 15 + (id % 3) * 10;

    // Flight Physical Telemetry (1 grid cell = 10m scale)
    this.totalDistance = 0;       // Total distance flown (meters)
    this.currentSpeed = 0;        // Current smoothed flight speed (m/s)
    this.distanceToBase = 0;      // Distance to launch pad (meters)

    // 80/20 Swarm Curiosity Allocation (20% pure explorers, 80% convergers)
    this.curiosityRole = (id % 5 === 0) ? 'EXPLORER' : 'CONVERGER';

    // ═══ SELF-HEALING COMMS: Autonomous Decision Mode ══════════════════════
    // Agent perceives its own RF link quality and autonomously switches modes:
    //   'FULL'       — normal operation (stigmergy + radio debate + NOOA)
    //   'STIGMERGIC' — degraded comms (pheromone-only, no radio messages)
    this.decisionMode = 'FULL';
    this.linkQualityAvg = 1.0;        // rolling average link quality to neighbors
    this._commsDegradedTicks = 0;     // consecutive ticks below threshold
    this._commsRecoveryTicks = 0;     // consecutive ticks above recovery threshold

    // ═══ MULTI-AGENT SYSTEM: Autonomous Agent State ═══════════════════════════
    // Each drone is an independent agent with its own beliefs, inbox, and voting state.
    // No drone has access to ground truth or other drones' internal states.

    // Personal Belief Map: what THIS agent thinks about each cell it has observed.
    // Key: "col,row" → { confidence, readings, tick, visitCount }
    this.beliefs = new Map();

    // Known Explored Map Belief Set: sectors this agent knows are already mapped (shared via peer radio)
    this.knownExploredSectors = new Set();

    // Agent Radio Inbox: messages received from nearby peer agents
    this.inbox = [];

    // Agent Radio Outbox: messages this agent wants to broadcast
    this.outbox = [];

    // Debate State: tracks votes this agent has cast and received for candidate cells
    this.votesReceived = new Map(); // "col,row" → [{ fromId, vote: 'AGREE'|'REJECT', confidence, angle }]
    this.votesCast = new Set();     // "col,row" keys this agent has already voted on
    // Agent callsign for readable debate logs
    const callsigns = ['ALPHA','BRAVO','CHARLIE','DELTA','ECHO','FOXTROT','GOLF','HOTEL',
                        'INDIA','JULIET','KILO','LIMA','MIKE','NOVEMBER','OSCAR','PAPA'];
    this.callsign = callsigns[id % callsigns.length] + '-' + Math.floor(id / callsigns.length);

    // ═══ CYBER-PHYSICAL SECURITY & BYZANTINE FAULT TOLERANCE ═════════════════
    // State for adversary injection, mutual peer trust scoring, and BFT quarantine
    this.isRogue = false;          // True if compromised/injected with Byzantine fault
    this.isQuarantined = false;    // True if blacklisted by multi-agent swarm consensus
    this.peerTrust = new Map();    // Peer ID -> trust score in [0.0, 1.0] (starts at 1.0)
    this.spoofTicks = 0;           // Timer for rogue spoofed broadcasts
    this.securityViolations = 0;   // Tracked adversarial infractions
  }

  /**
   * Get this drone's trust rating for a peer agent.
   * @param {number} peerId
   * @returns {number} Trust score in [0.0, 1.0] (defaults to 1.0)
   */
  getPeerTrust(peerId) {
    return this.peerTrust.has(peerId) ? this.peerTrust.get(peerId) : 1.0;
  }

  /**
   * Penalize a peer's trust rating following detected Byzantine deviation or sensor mismatch.
   * @param {number} peerId
   * @param {number} penalty
   * @returns {number} updated trust
   */
  penalizePeer(peerId, penalty = 0.50) {
    const curr = this.getPeerTrust(peerId);
    const updated = Math.max(0.0, curr - penalty);
    this.peerTrust.set(peerId, updated);
    return updated;
  }

  /**
   * Reward a peer's trust rating following verified corroboration.
   * @param {number} peerId
   * @param {number} reward
   * @returns {number} updated trust
   */
  rewardPeer(peerId, reward = 0.05) {
    const curr = this.getPeerTrust(peerId);
    const updated = Math.min(1.0, curr + reward);
    this.peerTrust.set(peerId, updated);
    return updated;
  }


  // ─── Dual-Axis Role Determination ──────────────────────────────────────────

  /**
   * Determine dynamic network/resource role independently of viscosity regime.
   * - SENTINEL: battery <= 20% -> holds station, suspends active sensor sweep, power saving
   * - RELAY: mesh topology bridge node / gap -> holds station & raises altitude to bridge RF partition
   * - SCOUT: default ("no role flag set") -> standard exploration / convergence
   *
   * @param {{ neighborCount?: number, isBridge?: boolean, swarmSize?: number }} meshContext
   * @returns {'SCOUT'|'RELAY'|'SENTINEL'}
   */
  determineRole(meshContext = {}) {
    const isBridging = Boolean(meshContext.isBridge);

    // 1. Battery <= 25% overrides normal scouting
    if (this.battery <= 25) {
      this.role = isBridging ? 'RELAY' : 'SENTINEL';
      if (this.role === 'RELAY') this.altitude = 35;
      return this.role;
    }

    // 2. Mesh topology bridge (connects separated clusters)
    if (isBridging && this.curiosityRole !== 'EXPLORER') {
      this.role = 'RELAY';
      this.altitude = 35; // Elevate to top RF relay ceiling
      return this.role;
    }

    // 3. Scout is default ("no role flag set")
    this.role = 'SCOUT';
    return this.role;
  }

  // ─── Self-Healing Comms: Autonomous Mode Transition ────────────────────────

  /**
   * Update the agent's communication decision mode based on perceived link quality.
   * The agent autonomously detects degraded comms and revises its own decision mode.
   * Hysteresis prevents rapid mode flapping.
   *
   * @param {number} avgLinkQuality — average link quality to radio neighbors [0..1]
   * @returns {{ changed: boolean, prevMode: string, newMode: string }}
   */
  updateCommsMode(avgLinkQuality) {
    this.linkQualityAvg = avgLinkQuality;
    const prevMode = this.decisionMode;

    if (this.decisionMode === 'FULL') {
      // Degrade: if link quality drops below 0.35 for 5+ consecutive ticks
      if (avgLinkQuality < 0.35) {
        this._commsDegradedTicks++;
        this._commsRecoveryTicks = 0;
        if (this._commsDegradedTicks >= 5) {
          this.decisionMode = 'STIGMERGIC';
          this._commsDegradedTicks = 0;
        }
      } else {
        this._commsDegradedTicks = 0;
      }
    } else {
      // Recover: if link quality rises above 0.55 for 10+ consecutive ticks
      if (avgLinkQuality >= 0.55) {
        this._commsRecoveryTicks++;
        this._commsDegradedTicks = 0;
        if (this._commsRecoveryTicks >= 10) {
          this.decisionMode = 'FULL';
          this._commsRecoveryTicks = 0;
        }
      } else {
        this._commsRecoveryTicks = 0;
      }
    }

    return { changed: prevMode !== this.decisionMode, prevMode, newMode: this.decisionMode };
  }

  // ─── Per-tick update cycle ─────────────────────────────────────────────────

  /**
   * Step 1: Read local field gradient + sensor data & clear local Fog of War.
   * @param {import('./field.js').PheromoneField} field
   * @param {import('./sensors.js').SensorGenerator} sensors
   * @param {number} tick
   */
  sense(field, sensors, tick) {
    const col = Math.floor(this.x);
    const row = Math.floor(this.y);

    // Clear Fog of War around drone position
    field.markExplored(col, row, 3.0);

    // If Sentinel (low battery), suspend active sensing to conserve power
    if (this.role === 'SENTINEL') {
      this.lastReadings = { thermal: 0.05, audio: 0.05, camera: 0.02, gas: 0.04 };
      this.confidence = 0.05;
      this.uncertainty = 0.90;
      this.viscosity = 0.02;
      this.regime = 'SPREAD';
      return;
    }

    // Read local sensor data (modulated by drone approach angle and range/vantage point)
    this.lastReadings = sensors.getLocalReadings(col, row, tick, this);

    // Compute confidence + uncertainty from sensor readings
    const rawConfidence = computeConfidence(this.lastReadings);
    this.uncertainty    = computeUncertainty(this.lastReadings);

    // Smooth the confidence to prevent rapid jitter at ambiguous cells
    this._smoothedConfidence =
      this._smoothAlpha * rawConfidence +
      (1 - this._smoothAlpha) * this._smoothedConfidence;

    this.confidence = this._smoothedConfidence;

    // Derive viscosity and regime
    this.viscosity = computeViscosity(this.uncertainty, this.confidence);
    this.regime    = classifyRegime(this.viscosity);

    // Battery discharge governed by PINN aerodynamic V^3 & role payload ODE
    const drain = getPINNBatteryDrain(this.role, this.currentSpeed, this.altitude);
    if (tick % 30 === 0 && this.battery > 5) {
      const safeDrain = Math.max(0, drain);
      this.batteryFloat = Math.max(5, this.batteryFloat - safeDrain);
      this.battery = Math.round(this.batteryFloat);
    }
  }

  /**
   * Step 2: Move according to regime rules & Sentinel/Explorer allocation.
   * @param {import('./field.js').PheromoneField} field
   * @param {object} [swarmContext]
   */
  move(field, swarmContext = {}) {
    const col = Math.floor(this.x);
    const row = Math.floor(this.y);
    const params = REGIME_PARAMS[this.regime] || REGIME_PARAMS.SPREAD;

    // If drone is flagged as SENTINEL (critical low battery), hold hover station
    if (this.role === 'SENTINEL') {
      this.vx *= 0.3;
      this.vy *= 0.3;
      this.prevX = this.x;
      this.prevY = this.y;
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > this.maxTrailLength) this.trail.shift();
      this.x += this.vx;
      this.y += this.vy;
      this.col = Math.floor(this.x);
      this.row = Math.floor(this.y);
      return;
    }

    // If mission is COMPLETE, fly back to BASE STATION (RTL Mode):
    if (swarmContext.isRTL) {
      this.regime = 'RESCUED';
      this.isSentinel = false;
      this.sentinelTargetCol = null;
      this.sentinelTargetRow = null;

      const baseTargetX = field.cols * 0.5;
      const baseTargetY = field.rows * 0.85;

      const dx = baseTargetX - this.x;
      const dy = baseTargetY - this.y;
      const distToBase = Math.hypot(dx, dy);

      if (distToBase > 1.2) {
        this.vx = 0.3 * this.vx + 0.7 * (dx / distToBase) * 0.45;
        this.vy = 0.3 * this.vy + 0.7 * (dy / distToBase) * 0.45;
        const targetHeading = Math.atan2(this.vy, this.vx);
        this._headingAngle = lerpAngle(this._headingAngle, targetHeading, 0.20);
      } else {
        // Touch down at base station and settle cleanly
        this.vx *= 0.3;
        this.vy *= 0.3;
        if (distToBase <= 0.6) {
          this.vx = 0;
          this.vy = 0;
        }
      }

      this.prevX = this.x;
      this.prevY = this.y;
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > this.maxTrailLength) this.trail.shift();

      this.x += this.vx;
      this.y += this.vy;
      this.col = Math.floor(this.x);
      this.row = Math.floor(this.y);
      return;
    }

    // If drone is assigned as SENTINEL BEACON over a survivor:
    if (this.isSentinel && this.sentinelTargetCol !== null) {
      const targetX = this.sentinelTargetCol + 0.5;
      const targetY = this.sentinelTargetRow + 0.5;

      // Hover tightly over target with slight organic sine jitter
      const dx = targetX - this.x;
      const dy = targetY - this.y;
      this.vx = 0.4 * this.vx + 0.6 * dx * 0.2;
      this.vy = 0.4 * this.vy + 0.6 * dy * 0.2;

      const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      if (spd > 0.02) {
        const targetHeading = Math.atan2(this.vy, this.vx);
        this._headingAngle = lerpAngle(this._headingAngle, targetHeading, 0.15);
      }

      this.prevX = this.x;
      this.prevY = this.y;
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > this.maxTrailLength) this.trail.shift();

      this.x += this.vx;
      this.y += this.vy;
      this.col = Math.floor(this.x);
      this.row = Math.floor(this.y);
      return;
    }

    // Standard / Helper drone movement:
    // Rotate heading bias — rate controls how erratically drones change direction
    this._headingBias += (Math.random() - 0.5) * 2 * params.turnRate;

    // Random walk direction from current heading
    let rx = Math.cos(this._headingBias) * params.randomWeight;
    let ry = Math.sin(this._headingBias) * params.randomWeight;

    // ALL drones pull toward spatial uncertainty gradients to guarantee map coverage
    if (this.regime === 'SPREAD') {
      const uGrad = field.getUncertaintyGradient(col, row);
      const strength = this.curiosityRole === 'EXPLORER' ? 0.95 : 0.45;
      rx += uGrad.dx * strength;
      ry += uGrad.dy * strength;
    }

    // Inter-Drone Collision Avoidance & Dispersion Repulsion (prevents drone clustering)
    let repDroneX = 0;
    let repDroneY = 0;
    if (swarmContext.drones && swarmContext.drones.length > 1) {
      const safetyRadius = 2.5; // expanded dispersion bubble in grid units
      for (const other of swarmContext.drones) {
        if (other.id === this.id) continue;
        // Drones at different flight altitudes (>= 5m diff) can safely overlap at different heights
        const altDiff = Math.abs(this.altitude - other.altitude);
        if (altDiff >= 5) continue;

        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);

        if (dist > 1e-4 && dist < safetyRadius) {
          const overlap = (safetyRadius - dist) / safetyRadius; // 0 to 1
          const force = overlap * 0.65; // firm repulsion pushes drones to explore separate sectors
          repDroneX += (dx / dist) * force;
          repDroneY += (dy / dist) * force;
        }
      }
    }

    // Sentinel Beacon Attraction (CAPPED): only attract if fewer than 4 drones are already nearby
    if (swarmContext.activeSentinels && swarmContext.activeSentinels.size > 0) {
      for (const [key, droneId] of swarmContext.activeSentinels.entries()) {
        if (droneId !== this.id) {
          const [sc, sr] = key.split(',').map(Number);
          if (!field.securedCells || !field.securedCells.has(sr * field.cols + sc)) {
            // Count how many drones are already near this sentinel
            let nearbyCount = 0;
            for (const other of swarmContext.drones) {
              if (other.id !== this.id && Math.hypot(other.x - (sc + 0.5), other.y - (sr + 0.5)) <= 3.5) {
                nearbyCount++;
              }
            }
            
            const dx = (sc + 0.5) - this.x;
            const dy = (sr + 0.5) - this.y;
            const dist = Math.hypot(dx, dy);

            if (nearbyCount < 4 && dist > 1.5 && dist <= 8.0) {
              // Still need more verifiers — attract
              const pull = ((8.0 - dist) / 8.0) * 0.55;
                rx += (dx / dist) * pull;
                ry += (dy / dist) * pull;
            } else if (nearbyCount >= 4 && dist <= 4.0 && dist > 0.5) {
              // Enough verifiers already — push excess drones outward to search elsewhere
              const push = ((4.0 - dist) / 4.0) * 0.70;
                rx -= (dx / dist) * push;
                ry -= (dy / dist) * push;
              }
            }
          }
        }
      }

    // Unrescued Target Attraction: pull idle drones toward survivors that still need discovery
    if (swarmContext.unrescuedTargets && swarmContext.unrescuedTargets.length > 0) {
      // Find nearest unrescued target that does NOT already have a sentinel
      let bestDx = 0, bestDy = 0, bestDist = Infinity;
      for (const tgt of swarmContext.unrescuedTargets) {
        const tKey = `${tgt.col},${tgt.row}`;
        const hasSentinel = swarmContext.activeSentinels && swarmContext.activeSentinels.has(tKey);
        if (hasSentinel) continue; // skip targets that already have a sentinel — they'll attract their own helpers
        const dx = (tgt.col + 0.5) - this.x;
        const dy = (tgt.row + 0.5) - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist < bestDist) {
          bestDist = dist;
          bestDx = dx;
          bestDy = dy;
        }
      }
      // Gentle pull toward nearest unrescued unsupervised target (only when far away)
      if (bestDist > 3.0 && bestDist < 25.0) {
        const pull = 0.25;
        rx += (bestDx / bestDist) * pull;
        ry += (bestDy / bestDist) * pull;
      }
    }

    // Extracted Target Repulsion: gentle push AWAY from already-rescued sectors (radius 3.5)
    let repSecuredX = 0;
    let repSecuredY = 0;
    if (swarmContext.rescuedCells && swarmContext.rescuedCells.size > 0) {
      for (const key of swarmContext.rescuedCells) {
        const [sc, sr] = key.split(',').map(Number);
        const dx = (this.x - (sc + 0.5));
        const dy = (this.y - (sr + 0.5));
        const distSq = dx * dx + dy * dy;
        if (distSq < 12.25) { // within 3.5 cells of extracted target
          const dist = Math.sqrt(distSq) || 1;
          const force = ((3.5 - dist) / 3.5) * 0.65; // gentle local push
          repSecuredX += (dx / dist) * force;
          repSecuredY += (dy / dist) * force;
        }
      }
    }

    // Gradient pull toward pheromone trail
    const grad = field.getGradient(col, row);
    const gx   = grad.dx * params.gradientPull;
    const gy   = grad.dy * params.gradientPull;

    // Inward soft boundary potential field (steers drones away from borders BEFORE wall collision)
    let bSteerX = 0;
    let bSteerY = 0;
    const bMargin = 1.5; // small margin — just enough to prevent wall collision, not block entire bottom region
    if (this.x < bMargin)              bSteerX += (bMargin - this.x) * 2.5;
    if (this.x > field.cols - bMargin) bSteerX -= (this.x - (field.cols - bMargin)) * 2.5;
    if (this.y < bMargin)              bSteerY += (bMargin - this.y) * 2.5;
    if (this.y > field.rows - bMargin) bSteerY -= (this.y - (field.rows - bMargin)) * 2.5;

    // NOTE: Center pull removed — it biases drones away from the bottom half of the map where the spawn base is.

    // Combine random walk + gradient + same-altitude gentle repulsion + secured repulsion + inward boundary steering
    let nx = gx + rx + repDroneX + repSecuredX + bSteerX;
    let ny = gy + ry + repDroneY + repSecuredY + bSteerY;
    const mag = Math.sqrt(nx * nx + ny * ny);
    if (mag > 1e-6) { nx /= mag; ny /= mag; }

    // Apply velocity with inertia
    this.vx = params.inertia * this.vx + (1 - params.inertia) * nx * params.speed;
    this.vy = params.inertia * this.vy + (1 - params.inertia) * ny * params.speed;

    // Clamp speed
    const spd    = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    const maxSpd = params.speed * 0.85;
    if (spd > maxSpd) {
      this.vx = (this.vx / spd) * maxSpd;
      this.vy = (this.vy / spd) * maxSpd;
    }

    // Smooth heading angle update & sync heading bias to prevent circular spinning loops
    if (spd >= 0.02) {
      const targetHeading = Math.atan2(this.vy, this.vx);
      this._headingAngle = lerpAngle(this._headingAngle, targetHeading, 0.25);
      // Smoothly pull heading bias back toward actual flight trajectory
      this._headingBias = lerpAngle(this._headingBias, this._headingAngle, 0.15);
    }

    // Compute next position
    let newX = this.x + this.vx * params.stepScale;
    let newY = this.y + this.vy * params.stepScale;

    // Boundary hard clamp & smooth composite reflection
    const minB = 0.8;
    const maxBX = field.cols - 0.8;
    const maxBY = field.rows - 0.8;
    let hitWall = false;

    if (newX < minB)  { newX = minB;  this.vx =  Math.abs(this.vx) * 0.4; hitWall = true; }
    if (newX > maxBX) { newX = maxBX; this.vx = -Math.abs(this.vx) * 0.4; hitWall = true; }
    if (newY < minB)  { newY = minB;  this.vy =  Math.abs(this.vy) * 0.4; hitWall = true; }
    if (newY > maxBY) { newY = maxBY; this.vy = -Math.abs(this.vy) * 0.4; hitWall = true; }

    if (hitWall) {
      const inwardAngle = Math.atan2(this.vy, this.vx);
      this._headingAngle = lerpAngle(this._headingAngle, inwardAngle, 0.40);
      this._headingBias  = lerpAngle(this._headingBias,  inwardAngle, 0.40);
    }

    // Snapshot prev position for frame interpolation
    this.prevX = this.x;
    this.prevY = this.y;

    // Record trail BEFORE moving
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > this.maxTrailLength) this.trail.shift();

    // Physical Flight Telemetry Calculations
    // Realistic tactical SAR grid scale: 1 grid cell = 2.8 meters (standard disaster structural bay)
    // Results in realistic search velocities: 3.5–5.5 m/s (12–20 km/h) in SPREAD, 1.5–3.0 m/s in CONVERGE
    const stepDistCells = Math.hypot(newX - this.prevX, newY - this.prevY);
    const METERS_PER_CELL = 2.8;
    const stepDistMeters = stepDistCells * METERS_PER_CELL;
    this.totalDistance += stepDistMeters;

    // Instantaneous speed (m/s) with EMA smoothing (tick interval = 0.062s)
    const instSpeed = stepDistMeters / 0.062;
    this.currentSpeed = this.currentSpeed * 0.85 + instSpeed * 0.15;

    // Distance to base launch pad (approx center bottom)
    const baseCol = Math.floor(field.cols / 2);
    const baseRow = Math.floor(field.rows * 0.75);
    this.distanceToBase = Math.hypot(newX - (baseCol + 0.5), newY - (baseRow + 0.5)) * METERS_PER_CELL;

    this.x   = newX;
    this.y   = newY;
    this.col = Math.floor(this.x);
    this.row = Math.floor(this.y);
  }

  /**
   * Step 3: Deposit pheromone at current location.
   * Sentinel drones deposit stronger beacon signal.
   * @param {import('./field.js').PheromoneField} field
   */
  deposit(field) {
    if (this.isQuarantined) return; // Swarm isolates and rejects quarantined drone deposits
    if (this.role === 'SENTINEL') return; // power conservation: no pheromone deposit
    const params = REGIME_PARAMS[this.regime] || REGIME_PARAMS.SPREAD;
    let amount = params.depositAmount * (0.3 + 0.7 * this.confidence);
    if (this.isRogue) amount = 0.95; // Rogue drone attempts pheromone poisoning
    if (this.role === 'RELAY') amount *= 1.6; // RELAY drones boost pheromone as signal relay beacon
    if (this.isSentinel) amount *= 1.8; // Sentinel beacon trail
    // Self-healing: STIGMERGIC mode compensates for lost radio with stronger chemical trail
    if (this.decisionMode === 'STIGMERGIC') amount *= 1.4;
    field.deposit(this.col, this.row, amount, this.id, this.confidence, this.uncertainty);
  }

  // ═══ MULTI-AGENT SYSTEM: Agent Communication & Debate Protocol ═══════════

  /**
   * Step 4: Update this agent's personal belief about the cell it is currently on.
   * Each agent maintains its OWN belief map — no shared memory.
   * @param {number} tick
   */
  updateBelief(tick) {
    const key = `${this.col},${this.row}`;
    const existing = this.beliefs.get(key);
    const visitCount = existing ? existing.visitCount + 1 : 1;
    this.beliefs.set(key, {
      confidence: this.confidence,
      readings: { ...this.lastReadings },
      tick,
      visitCount,
    });
    this.knownExploredSectors.add(key);
  }

  /**
   * Step 5: Broadcast observations and mapped sector status to peers via radio.
   * @param {number} tick
   */
  broadcastObservation(tick) {
    this.outbox = []; // clear previous outbox

    // Byzantine Defense: Quarantined drone is blacklisted from radio broadcasts
    if (this.isQuarantined) return;

    // Self-healing: STIGMERGIC mode — radio channel unavailable, rely on pheromone only
    if (this.decisionMode === 'STIGMERGIC') return;

    // ═══ ROGUE / BYZANTINE ATTACK INJECTION ═══
    // If compromised, periodically inject a forged high-confidence proposal at an empty sector
    if (this.isRogue) {
      this.spoofTicks++;
      if (this.spoofTicks % 25 === 0) {
        const spoofCol = Math.max(1, Math.min(20, (this.col + 7) % 21));
        const spoofRow = Math.max(1, Math.min(16, (this.row + 5) % 17));
        this.lastDebateSpeech = {
          type: 'CANDIDATE_PROPOSAL',
          vote: 'PROPOSAL',
          text: `⚠️ [SPOOF] FAKE SURVIVOR @ (${spoofCol},${spoofRow}) C=98%!`,
          callsign: this.callsign,
          tick,
        };
        this.outbox.push({
          type: 'CANDIDATE_PROPOSAL',
          fromId: this.id,
          callsign: this.callsign,
          col: spoofCol,
          row: spoofRow,
          confidence: 0.98,
          isForged: true,
          readings: { camera: 0.96, audio: 0.92, thermal: 0.95, gas: 0.12 },
          heading: this._headingAngle,
          tick,
        });
        return;
      }
    }

    // Broadcast explored sector status every 15 ticks so peer agents know this area is mapped
    if (tick % 15 === 0) {
      this.outbox.push({
        type: 'SECTOR_EXPLORED',
        fromId: this.id,
        callsign: this.callsign,
        col: this.col,
        row: this.row,
        tick,
      });
    }

    if (this.confidence >= 0.25) {
      this.lastDebateSpeech = {
        type: 'CANDIDATE_PROPOSAL',
        vote: 'PROPOSAL',
        text: `📢 PROPOSING @ (${this.col},${this.row})`,
        callsign: this.callsign,
        tick,
      };

      this.outbox.push({
        type: 'CANDIDATE_PROPOSAL',
        fromId: this.id,
        callsign: this.callsign,
        col: this.col,
        row: this.row,
        confidence: this.confidence,
        readings: { ...this.lastReadings },
        heading: this._headingAngle,
        tick,
      });
    }

    // If this agent has received enough votes, broadcast a CONSENSUS result
    const cellKey = `${this.col},${this.row}`;
    const votes = this.votesReceived.get(cellKey);
    if (votes && votes.length >= 3) {
      const agrees = votes.filter(v => v.vote === 'AGREE').length;
      const rejects = votes.filter(v => v.vote === 'REJECT').length;
      if (agrees >= 3) {
        this.outbox.push({
          type: 'CONSENSUS_CONFIRMED',
          fromId: this.id,
          callsign: this.callsign,
          col: this.col,
          row: this.row,
          agrees,
          rejects,
          tick,
        });
      } else if (rejects >= 2) {
        this.outbox.push({
          type: 'CONSENSUS_REJECTED',
          fromId: this.id,
          callsign: this.callsign,
          col: this.col,
          row: this.row,
          agrees,
          rejects,
          tick,
        });
      }
    }
  }

  /**
   * Process incoming messages from peer agents.
   * Each message is evaluated independently — this agent forms its OWN opinion.
   */
  receiveMessages() {
    // Quarantined agents cannot process or participate in consensus
    if (this.isQuarantined) {
      this.inbox = [];
      return;
    }
    // Self-healing: STIGMERGIC mode — skip radio message processing entirely
    if (this.decisionMode === 'STIGMERGIC') {
      this.inbox = [];
      return;
    }
    for (const msg of this.inbox) {
      // Drop messages from untrusted peers (Trust < 0.35)
      const senderTrust = this.getPeerTrust(msg.fromId);
      if (senderTrust < 0.35) continue;

      if (msg.type === 'SECTOR_EXPLORED') {
        // Peer agent informed us that sector (msg.col, msg.row) is already mapped
        this.knownExploredSectors.add(`${msg.col},${msg.row}`);
      } else if (msg.type === 'CANDIDATE_PROPOSAL') {
        // Store peer's observation in our beliefs, weighted by peer trust
        const key = `${msg.col},${msg.row}`;
        if (!this.beliefs.has(key)) {
          this.beliefs.set(key, {
            confidence: msg.confidence * 0.6 * senderTrust,
            readings: msg.readings,
            tick: msg.tick,
            visitCount: 0,
            fromPeer: msg.callsign,
          });
        }
      } else if (msg.type === 'VOTE_REQUEST') {
        // A peer is asking us to vote on a candidate cell
        const key = `${msg.col},${msg.row}`;
        if (!this.votesCast.has(key)) {
          this.votesCast.add(key);
          // Form our OWN opinion based on our current readings at/near this cell
          const dist = Math.hypot(this.col - msg.col, this.row - msg.row);
          let vote = 'ABSTAIN';
          if (dist <= 2.5) {
            // We're close enough to have our own readings
            vote = this.confidence >= 0.30 ? 'AGREE' : 'REJECT';
          }
          if (vote !== 'ABSTAIN') {
            const speechText = vote === 'AGREE' 
              ? `YES! ${(this.confidence * 100).toFixed(0)}% Confirmed` 
              : `NO! ${(this.confidence * 100).toFixed(0)}% Decoy`;

            this.lastDebateSpeech = {
              type: 'VOTE_CAST',
              vote,
              text: speechText,
              callsign: this.callsign,
              tick: msg.tick,
            };

            this.outbox.push({
              type: 'VOTE_CAST',
              fromId: this.id,
              callsign: this.callsign,
              targetCol: msg.col,
              targetRow: msg.row,
              vote,
              confidence: this.confidence,
              heading: this._headingAngle,
              tick: msg.tick,
            });
          }
        }
      } else if (msg.type === 'VOTE_CAST') {
        // Record a vote from a peer agent
        const key = `${msg.targetCol},${msg.targetRow}`;
        if (!this.votesReceived.has(key)) this.votesReceived.set(key, []);
        const votes = this.votesReceived.get(key);
        // Prevent duplicate votes from same agent
        if (!votes.some(v => v.fromId === msg.fromId)) {
          votes.push({
            fromId: msg.fromId,
            callsign: msg.callsign,
            vote: msg.vote,
            confidence: msg.confidence,
            angle: msg.heading,
          });
        }
      }
    }
    this.inbox = []; // clear processed messages
  }

  /**
   * Get the CSS color for this drone based on its security status, regime & Sentinel status.
   */
  get color() {
    if (this.isQuarantined) return '#9d4edd'; // Violet — Quarantined / Isolated
    if (this.isRogue) return '#ff0055';       // Crimson Red — Compromised / Rogue
    if (this.decisionMode === 'STIGMERGIC') return '#ff9500'; // Amber — degraded comms
    if (this.isSentinel) return '#00ffaa';    // Bright cyan/green beacon for sentinel drone
    switch (this.regime) {
      case 'SOLIDIFY': return '#ff4d6d';  // hot red — committed
      case 'CONVERGE': return '#ffd60a';  // yellow — converging
      default:         return '#4cc9f0';  // cool blue — exploring
    }
  }

  /**
   * Get the color for this drone's glow/aura as an [R, G, B] array.
   */
  get glowRgb() {
    if (this.isQuarantined) return [157, 78, 221];
    if (this.isRogue) return [255, 0, 85];
    if (this.decisionMode === 'STIGMERGIC') return [255, 149, 0]; // Amber glow
    if (this.isSentinel) return [0, 255, 170];
    switch (this.regime) {
      case 'SOLIDIFY': return [255, 77, 109];
      case 'CONVERGE': return [255, 214, 10];
      default:         return [76, 201, 240];
    }
  }

  /**
   * Get the color for this drone's glow/aura as a CSS string.
   */
  get glowColor() {
    const [r, g, b] = this.glowRgb;
    return `rgba(${r}, ${g}, ${b}, 0.25)`;
  }

  /**
   * Get the heading angle (radians) smoothly interpolated from velocity vector.
   */
  get heading() {
    return this._headingAngle;
  }
}

/**
 * Shortest-path angular interpolation helper function.
 * Smoothly lerps an angle (in radians) across the -PI / +PI boundary without spinning 360 degrees.
 */
function lerpAngle(current, target, alpha) {
  let diff = (target - current) % (2 * Math.PI);
  if (diff < -Math.PI) diff += 2 * Math.PI;
  if (diff > Math.PI) diff -= 2 * Math.PI;
  return current + diff * alpha;
}
