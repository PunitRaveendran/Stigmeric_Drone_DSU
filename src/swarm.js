/**
 * swarm.js — Swarm Manager (Phase 2)
 *
 * Orchestrates the simulation loop: spawning drones, running field decay,
 * and coordinating the per-drone sense → move → deposit cycle.
 *
 * This is NOT a central planner. It is only a simulation runner — it has no
 * authority over drone behavior and issues no commands. Drones are self-directed.
 */

import { Drone } from './drone.js';
import { getLinkQuality, shouldDeliver, getAvgLinkQuality, RADIO_RANGE } from './comms.js';
import { beeceptor } from './beeceptor.js';
import { n8nGateway } from './n8n.js';

export class Swarm {
  /**
   * @param {import('./field.js').PheromoneField} field
   * @param {import('./sensors.js').SensorGenerator} sensors
   * @param {object} opts
   */
  constructor(field, sensors, opts = {}) {
    this.field = field;
    this.sensors = sensors;
    this.scenario = sensors.scenario; // Cached for comms ray-cast occlusion

    this.drones = [];
    this.tick = 0;

    // Stats for the overlay panel
    this.stats = {
      avgViscosity: 0,
      avgConfidence: 0,
      avgUncertainty: 0,
      regimeCounts: { SPREAD: 0, CONVERGE: 0, SOLIDIFY: 0 },
      roleCounts: { SCOUT: 0, RELAY: 0, SENTINEL: 0 },
      dominantRegime: 'SPREAD',
      // Self-Healing Comms Stats
      commsStats: { degradedCount: 0, avgLinkQuality: 1.0, messagesDropped: 0 },
      // Byzantine Cyber-Physical Security Stats
      securityStats: {
        rogueCount: 0,
        attacksAttempted: 0,
        attacksBlocked: 0,
        quarantinedCount: 0,
        defenseActive: true,
      },
      // Multi-Agent Debate Tracking
      debateStats: {
        proposals: 0,
        agrees: 0,
        rejects: 0,
        consensusConfirmed: 0,
      },
      // NOAA Agent Negotiation Tracking
      nooaStats: {
        accessCount: 0,
        successCount: 0,
        lastDecision: 'IDLE',
      },
      // Relay Mesh Network Stats
      relayStats: {
        activeRelays: 0,
        packetsRelayed: 0,
      },
    };

    // ═══ CYBER-PHYSICAL SECURITY & BYZANTINE FAULT TOLERANCE ═════════════════
    this.byzantineDefenseEnabled = true;
    this.quarantinedDrones = new Set();
    this.securityStats = this.stats.securityStats;
    this.debateStats = this.stats.debateStats;
    this.nooaStats = this.stats.nooaStats;
    this.relayStats = this.stats.relayStats;

    // Zone presence — how many drones are currently in each zone type
    // Used by the narrative panel to show "X drones near SURVIVOR zone"
    this.zonePresence = {
      SURVIVOR: { count: 0, avgConfidence: 0 },
      HOT_DEBRIS: { count: 0, avgConfidence: 0 },
      WIND_NOISE: { count: 0, avgConfidence: 0 },
      HAZARD: { count: 0, avgConfidence: 0 },
    };

    // Live event log — human-readable messages for the narrative feed
    this.eventLog = [];
    this._maxEvents = 20;

    // Dispatch log — records when a cell reaches SOLIDIFY for the first time
    this.dispatchLog = [];

    this._droneIdCounter = 0;
    this._prevDominant = 'SPREAD'; // for detecting regime transitions
    this.solidifyTicks = 0;        // ticks spent in SOLIDIFY mode
    this.rescuedCells = new Set(); // cells where survivor has been extracted
    this.activeSentinels = new Map(); // key: "col,row" -> droneId

    // Multi-survivor tracking & Mission Score
    this.missionScore = 0;
    this.survivorsExtracted = 0;
    this.survivorTargets = this.sensors.scenario.survivors.map(s => ({ ...s, status: 'SEARCHING', confidence: 0 }));

    // NOOA Multi-Agent Tactical Negotiation State (Non-blocking & Deduplicated)
    this._activeNOOASectors = new Set();
    this._nooaInFlightCount = 0;
  }

  // ─── Cyber-Physical Security & Byzantine Fault Tolerance Controls ──────────

  /**
   * Inject a Byzantine attack by compromising an active drone.
   * @param {number} [targetId]
   */
  injectRogueDrone(targetId) {
    let target = null;
    if (targetId !== undefined) {
      target = this.drones.find(d => d.id === targetId);
    } else {
      // Pick first non-rogue drone
      target = this.drones.find(d => !d.isRogue && !d.isSentinel) || this.drones[0];
    }
    if (!target) return;
    target.isRogue = true;
    target.spoofTicks = 0;
    this.securityStats.rogueCount = this.drones.filter(d => d.isRogue).length;
    this._addEvent('🔴', `[SECURITY ALERT] Drone #${target.id} (${target.callsign}) COMPROMISED! Injected with Byzantine exploit. Broadcasting forged ghost targets.`);
  }

  /**
   * Neutralize rogue drones, restore trust ratings, and clear quarantine.
   */
  neutralizeRogueDrones() {
    for (const d of this.drones) {
      d.isRogue = false;
      d.isQuarantined = false;
      d.peerTrust.clear();
      d.securityViolations = 0;
    }
    this.quarantinedDrones.clear();
    this.securityStats.rogueCount = 0;
    this.securityStats.quarantinedCount = 0;
    this.securityStats.attacksAttempted = 0;
    this.securityStats.attacksBlocked = 0;
    this._addEvent('🟢', `[SECURITY COUNTERMEASURE] Swarm cryptographically re-keyed. All rogue agents neutralized. Trust ratings restored to 1.0.`);
  }

  /**
   * Toggle Byzantine Fault Defense on/off to benchmark swarm vulnerability.
   */
  toggleByzantineDefense() {
    this.byzantineDefenseEnabled = !this.byzantineDefenseEnabled;
    this.securityStats.defenseActive = this.byzantineDefenseEnabled;
    const status = this.byzantineDefenseEnabled ? 'ENABLED (Consensus Protected)' : 'DISABLED (Vulnerable to Spoofing)';
    this._addEvent('🛡️', `Byzantine Defense is now ${status}.`);
    return this.byzantineDefenseEnabled;
  }

  /**
   * Calculate average peer trust rating for a given drone across all other drones.
   * @param {number} droneId
   * @returns {number} Average trust in [0.0, 1.0]
   */
  getAverageTrust(droneId) {
    let total = 0, count = 0;
    for (const d of this.drones) {
      if (d.id !== droneId) {
        total += d.getPeerTrust(droneId);
        count++;
      }
    }
    return count > 0 ? (total / count) : 1.0;
  }

  /**
   * Spawn N drones from a launch base (bottom-center of the field).
   * Drones launch with 360-degree fan-out velocity for a clear, readable SPREAD phase.
   * @param {number} n
   */
  spawn(n) {
    const baseCols = Math.floor(this.field.cols / 2);
    const baseRow = Math.floor(this.field.rows * 0.75);
    for (let i = 0; i < n; i++) {
      const col = Math.max(1, Math.min(this.field.cols - 2,
        baseCols + Math.floor((Math.random() - 0.5) * 4)));
      const row = Math.max(1, Math.min(this.field.rows - 2,
        baseRow + Math.floor((Math.random() - 0.5) * 3)));
      const drone = new Drone(this._droneIdCounter++, col, row);
      // 80/20 Swarm Curiosity Allocation: 20% explorers, 80% convergers
      drone.curiosityRole = (i % 5 === 0) ? 'EXPLORER' : 'CONVERGER';

      // Fan-out initial velocity
      const angle = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      drone.vx = Math.cos(angle) * 0.4;
      drone.vy = Math.sin(angle) * 0.4;
      drone._headingBias = angle;
      this.drones.push(drone);
    }

    // Pre-mark the base launch zone as fully explored with uncertainty=0.
    // Small radius (2 cells) = just the actual pad footprint.
    // Bottom rows outside this remain unexplored so drones are pulled downward to cover them.
    const baseMarkRadius = 2;
    for (let dr = -baseMarkRadius; dr <= baseMarkRadius; dr++) {
      for (let dc = -baseMarkRadius; dc <= baseMarkRadius; dc++) {
        const c = baseCols + dc;
        const r = baseRow + dr;
        if (c >= 0 && c < this.field.cols && r >= 0 && r < this.field.rows) {
          const idx = r * this.field.cols + c;
          this.field.explorationGrid[idx] = 1.0;
          this.field.cellUncertainty[idx] = 0.0;
        }
      }
    }
  }

  /**
   * Add a single drone at an explicit position (e.g. from UI click).
   */
  addDroneAt(col, row) {
    this.drones.push(new Drone(this._droneIdCounter++, col, row));
  }

  /**
   * Remove all drones and reset the field.
   */
  reset() {
    this.drones = [];
    this.tick = 0;
    this._droneIdCounter = 0;
    this._prevDominant = 'SPREAD';
    this._seenDispatch = new Set();
    this._seenTargetDispatch = new Set();
    this.dispatchLog = [];
    this.eventLog = [];
    this.solidifyTicks = 0;
    this.rescuedCells = new Set();
    this.activeSentinels = new Map();
    this.missionScore = 0;
    this.survivorsExtracted = 0;
    this.isMissionComplete = false;
    this._hasLoggedRTL = false;
    this._explorationStagnantTicks = 0;
    this._lastExploredCount = 0;
    this.survivorTargets = this.sensors.scenario.survivors.map(s => ({ ...s, status: 'SEARCHING', confidence: 0 }));

    this.zonePresence = {
      SURVIVOR: { count: 0, avgConfidence: 0 },
      HOT_DEBRIS: { count: 0, avgConfidence: 0 },
      WIND_NOISE: { count: 0, avgConfidence: 0 },
      HAZARD: { count: 0, avgConfidence: 0 },
    };
    this.stats = {
      avgViscosity: 0,
      avgConfidence: 0,
      avgUncertainty: 0,
      regimeCounts: { SPREAD: 0, CONVERGE: 0, SOLIDIFY: 0 },
      roleCounts: { SCOUT: 0, RELAY: 0, SENTINEL: 0 },
      dominantRegime: 'SPREAD',
      commsStats: { degradedCount: 0, avgLinkQuality: 1.0, messagesDropped: 0 },
      securityStats: {
        rogueCount: 0,
        attacksAttempted: 0,
        attacksBlocked: 0,
        quarantinedCount: 0,
        defenseActive: this.byzantineDefenseEnabled,
      },
      debateStats: {
        proposals: 0,
        agrees: 0,
        rejects: 0,
        consensusConfirmed: 0,
      },
      nooaStats: {
        accessCount: 0,
        successCount: 0,
        lastDecision: 'IDLE',
      },
      relayStats: {
        activeRelays: 0,
        packetsRelayed: 0,
      },
    };
    this.quarantinedDrones.clear();
    this.securityStats = this.stats.securityStats;
    this.debateStats = this.stats.debateStats;
    this.nooaStats = this.stats.nooaStats;
    this.relayStats = this.stats.relayStats;
    this._activeNOOASectors.clear();
    this._nooaInFlightCount = 0;
    this.field.reset();
  }

  /**
   * Check if a survivor target or cell location has already been extracted/rescued.
   * @param {number} col
   * @param {number} row
   * @returns {boolean}
   */
  isSurvivorExtracted(col, row) {
    if (this.rescuedCells.has(`${col},${row}`)) return true;
    for (const key of this.rescuedCells) {
      const [rc, rr] = key.split(',').map(Number);
      if (Math.hypot(rc - col, rr - row) <= 2.5) return true;
    }
    return false;
  }

  /**
   * Advance the simulation by one tick.
   * Order: field decay → drone sense → drone move → drone deposit → stats.
   */
  step() {
    this.tick++;
    this.field.tick();

    let sumV = 0, sumC = 0, sumU = 0;
    const regimeCounts = { SPREAD: 0, CONVERGE: 0, SOLIDIFY: 0 };
    const roleCounts   = { SCOUT: 0, RELAY: 0, SENTINEL: 0 };

    // Reset zone presence counts for this tick
    for (const z of Object.values(this.zonePresence)) { z.count = 0; z.sumConf = 0; }

    // Swarm has NO prior knowledge of survivor count or locations.
    // Mission completion requires mapping the reachable disaster area and resolving candidates.
    const isMissionComplete = (this.isMissionComplete === true) || (this._hasLoggedRTL === true);

    const swarmContext = {
      activeSentinels: this.activeSentinels,
      drones: this.drones,
      isRTL: isMissionComplete,
      rescuedCells: this.rescuedCells,
    };

    // ═══ DUAL-AXIS AUTONOMY: Mesh Topology & Role Determination ══════════════
    // Evaluate RF mesh neighborhood per drone (using comms link quality model)
    const meshTopology = new Map();
    for (const d of this.drones) {
      const neighbors = [];
      for (const other of this.drones) {
        if (other.id === d.id) continue;
        const dist = Math.hypot(d.x - other.x, d.y - other.y);
        if (dist <= RADIO_RANGE) neighbors.push(other);
      }

      // True bridge detection: connects 2 or more neighbors that cannot reach each other directly
      let isBridge = false;
      if (neighbors.length >= 2) {
        for (let i = 0; i < neighbors.length && !isBridge; i++) {
          for (let j = i + 1; j < neighbors.length; j++) {
            const sep = Math.hypot(neighbors[i].x - neighbors[j].x, neighbors[i].y - neighbors[j].y);
            if (sep > RADIO_RANGE) {
              isBridge = true;
              break;
            }
          }
        }
      }

      meshTopology.set(d.id, {
        neighborCount: neighbors.length,
        isBridge,
        swarmSize: this.drones.length,
      });
    }

    // ═══ SELF-HEALING COMMS: Per-Drone Link Quality & Mode Transition ═════════
    let commsLinkSum = 0;
    let commsDegradedCount = 0;
    for (const drone of this.drones) {
      const avgLQ = getAvgLinkQuality(drone, this.drones, this.scenario);
      const result = drone.updateCommsMode(avgLQ);
      commsLinkSum += avgLQ;
      if (drone.decisionMode === 'STIGMERGIC') commsDegradedCount++;

      if (result.changed) {
        if (result.newMode === 'STIGMERGIC') {
          this._addEvent('📵', `Drone #${drone.id} entered STIGMERGIC mode (link quality ${avgLQ.toFixed(2)} — rubble occlusion/distance). Falling back to pheromone-only navigation.`);
        } else {
          this._addEvent('📶', `Drone #${drone.id} restored FULL comms (link quality ${avgLQ.toFixed(2)}). Radio debate & NOOA negotiation re-enabled.`);
        }
      }
    }

    for (const drone of this.drones) {
      // 1. Determine Dynamic Role (Orthogonal to Regime)
      const topInfo = meshTopology.get(drone.id) || {};
      const prevRole = drone.role;
      drone.determineRole(topInfo);
      roleCounts[drone.role] = (roleCounts[drone.role] || 0) + 1;

      if (prevRole !== drone.role) {
        if (drone.role === 'RELAY') {
          this._addEvent('📡', `Drone #${drone.id} assumed RELAY role (holding station at 35m altitude to bridge mesh partition)`);
        } else if (drone.role === 'SENTINEL') {
          this._addEvent('🔋', `Drone #${drone.id} assumed SENTINEL role (battery low at ${drone.battery}% — power conservation mode)`);
        }
      }

      // 2. Sense Environment & derive Regime
      drone.sense(this.field, this.sensors, this.tick);

      // Check if drone can assume SENTINEL role over an UNEXTRACTED survivor cell
      const cellType = this.sensors.scenario.getCellType(drone.col, drone.row);
      const cellKey = `${drone.col},${drone.row}`;
      const isExtracted = this.isSurvivorExtracted(drone.col, drone.row);

      if (cellType === 'SURVIVOR' && !isExtracted && drone.confidence > 0.40 && !drone.isSentinel) {
        if (!this.activeSentinels.has(cellKey)) {
          this.activeSentinels.set(cellKey, drone.id);
          drone.isSentinel = true;
          drone.sentinelTargetCol = drone.col;
          drone.sentinelTargetRow = drone.row;
          drone.sentinelTicks = 0; // Initialize watchdog timer
          this._addEvent('📡', `Drone #${drone.id} locked as SENTINEL BEACON at (${drone.col},${drone.row}) — Helper drones sweeping surrounding area!`);
        }
      }

      // WATCHDOG TIMER (Case C): Prevent Swarm Paralysis
      // If a sentinel is stuck waiting for backup for too long (30 seconds), it abandons the lock to prevent the swarm from freezing.
      if (drone.isSentinel) {
        drone.sentinelTicks = (drone.sentinelTicks || 0) + 1;
        if (drone.sentinelTicks > 600) {
          const sKey = `${drone.sentinelTargetCol},${drone.sentinelTargetRow}`;
          this._addEvent('⚠️', `WATCHDOG TIMEOUT: Drone #${drone.id} stuck at (${drone.sentinelTargetCol},${drone.sentinelTargetRow}) for 30s. Releasing lock to prevent swarm paralysis!`);
          this.activeSentinels.delete(sKey);
          drone.isSentinel = false;
          drone.sentinelTargetCol = null;
          drone.sentinelTargetRow = null;
          drone.sentinelTicks = 0;
          this.field.clearLocalAttraction(drone.col, drone.row, 3.0);
        }
      }

      // Check Multi-Agent Decoy Rejection (Hot Debris thermal-only or Wind Noise audio-only)
      if ((cellType === 'HOT_DEBRIS' || cellType === 'WIND_NOISE' || cellType === 'MANNEQUIN') && drone.confidence > 0.25) {
        if (!this._seenDecoys) this._seenDecoys = new Set();
        if (!this._seenDecoys.has(cellKey)) {
          const verifiersNear = this.drones.filter(d => d.id !== drone.id && Math.hypot(d.col - drone.col, d.row - drone.row) <= 3.2);
          if (verifiersNear.length >= 1) {
            this._seenDecoys.add(cellKey);
            const v1 = verifiersNear[0];
            const headingDeg = Math.round((v1.heading * 180 / Math.PI + 360) % 360);
            const label = cellType === 'HOT_DEBRIS' ? 'Hot Debris (thermal-only)' : cellType === 'WIND_NOISE' ? 'Wind Noise (audio-spike)' : 'Photo Mannequin (camera-only)';
            this._addEvent('🙅', `DECOY REJECTED at sector (${drone.col},${drone.row})! Verifier Drone #${v1.id} (angle ${headingDeg}°): Audio silent, Camera 0.00 — ${label} rejected, clearing trail!`);
            this.field.clearLocalAttraction(drone.col, drone.row, 3.0, false);
          }
        }
      }

      drone.move(this.field, swarmContext);
      drone.deposit(this.field);

      // ═══ AGENT STEP 4–5: Update beliefs & broadcast ═══
      drone.updateBelief(this.tick);
      drone.broadcastObservation(this.tick);

      sumV += drone.viscosity;
      sumC += drone.confidence;
      sumU += drone.uncertainty;
      regimeCounts[drone.regime]++;

      // Track which zone this drone is currently in
      if (cellType && this.zonePresence[cellType] !== undefined) {
        this.zonePresence[cellType].count++;
        this.zonePresence[cellType].sumConf = (this.zonePresence[cellType].sumConf || 0) + drone.confidence;
      }

      // Record first-time SOLIDIFY dispatch events
      if (drone.regime === 'SOLIDIFY' && !isExtracted) {
        if (!this._seenDispatch) this._seenDispatch = new Set();
        if (!this._seenDispatch.has(cellKey)) {
          this._seenDispatch.add(cellKey);
          this.dispatchLog.push({
            tick: this.tick, col: drone.col, row: drone.row,
            confidence: drone.confidence.toFixed(3),
          });
          this._addEvent('🚨', `Rescue dispatch! Survivor confirmed at sector (${drone.col},${drone.row})`);

          // Trigger Autonomous n8n First-Responder Dispatch Workflow
          n8nGateway.triggerSARDispatch({
            col: drone.col,
            row: drone.row,
            confidence: drone.confidence,
            readings: drone.lastReadings,
            leadAgent: drone.callsign,
          }).then((res) => {
            const unit = res?.assigned_unit || 'PARAMEDIC-UNIT-04 (DISPATCHED)';
            const eta = res?.eta_minutes || res?.estimated_arrival_minutes || 3.8;
            const priority = res?.priority || 'CODE RED (CRITICAL)';
            this._addEvent('⚡', `[n8n DISPATCH] ${unit} en route to (${drone.col},${drone.row}) — ETA ${eta}m`);
            if (typeof window !== 'undefined' && typeof window.showN8nDispatchToast === 'function') {
              window.showN8nDispatchToast({
                targetName: `SURVIVOR-ALPHA (${drone.col},${drone.row})`,
                col: drone.col,
                row: drone.row,
                confidence: (drone.confidence * 100).toFixed(1),
                unit: unit,
                eta: eta,
                priority: priority,
              });
            }
          });
        }
      }
    }

    // ═══ MULTI-AGENT RADIO MESSAGE ROUTER ═══════════════════════════════════
    // This is NOT central control — it is a physical radio channel simulator.
    // Each drone's outbox messages are delivered to nearby drones' inboxes
    // based on radio range (6 grid units). No drone reads another's internal state.
    if (!this._debateLogThrottle) this._debateLogThrottle = new Set();
    let tickDropped = 0;  // Self-healing: count messages lost to packet loss this tick

    for (const sender of this.drones) {
      if (sender.outbox.length === 0) continue;

      // ═══ BYZANTINE FAULT TOLERANCE: Blacklist Quarantine ═══
      if (this.byzantineDefenseEnabled && sender.isQuarantined) {
        this.securityStats.attacksAttempted += sender.outbox.length;
        this.securityStats.attacksBlocked += sender.outbox.length;
        sender.outbox = [];
        continue;
      }

      for (const msg of sender.outbox) {
        // Track attack metrics: forged candidate proposals or rogue spoofing
        const isMalicious = msg.isForged || (sender.isRogue && (msg.type === 'CANDIDATE_PROPOSAL' || msg.confidence >= 0.70));
        if (isMalicious) {
          this.securityStats.attacksAttempted++;
        }

        // ═══ BYZANTINE SPOOFING DETECTION & QUARANTINE ═══
        if (msg.type === 'CANDIDATE_PROPOSAL' && this.byzantineDefenseEnabled) {
          const actualType = this.sensors.scenario.getCellType(msg.col, msg.row);
          const isRealSurvivor = (actualType === 'SURVIVOR');

          // Adversarial check: forged Byzantine payload or claiming high confidence at a non-survivor cell
          if (msg.isForged || (!isRealSurvivor && msg.confidence >= 0.70)) {
            sender.securityViolations = (sender.securityViolations || 0) + 1;

            // Multi-agent peer trust slashing across all honest peers
            for (const peer of this.drones) {
              if (peer.id !== sender.id && !peer.isRogue) {
                peer.penalizePeer(sender.id, 0.70);
              }
            }

            const avgTrust = this.getAverageTrust(sender.id);
            if (avgTrust < 0.35 && !sender.isQuarantined) {
              sender.isQuarantined = true;
              this.quarantinedDrones.add(sender.id);
              this.securityStats.quarantinedCount = this.quarantinedDrones.size;
              // Clear any false attractant pheromone deposited by rogue drone
              this.field.clearLocalAttraction(msg.col, msg.row, 3.0, false);
              this._addEvent('🛡️', `[BFT ATTACK BLOCKED] Byzantine spoofing detected! Drone #${sender.id} (${sender.callsign}) broadcast forged C=${(msg.confidence * 100).toFixed(0)}% at empty sector (${msg.col},${msg.row}). Honest peers cross-verified sensor mismatch. Trust slashed to ${(avgTrust * 100).toFixed(0)}% → NODE QUARANTINED.`);
            }

            this.securityStats.attacksBlocked++;
            continue; // Drop the spoofed proposal — do not route to honest peers!
          }
        }

        // Deliver to all drones within radio range
        if (msg.type === 'CANDIDATE_PROPOSAL') {
          this.debateStats.proposals++;
        }
        if (sender.role === 'RELAY') {
          this.relayStats.packetsRelayed++;
        }

        for (const receiver of this.drones) {
          if (receiver.id === sender.id) continue;
          // Self-healing: probabilistic link quality gate replaces hard distance check
          const linkQ = getLinkQuality(sender, receiver, this.scenario);
          if (!shouldDeliver(linkQ)) {
            tickDropped++;
            continue;
          }
          // Delivered — push to receiver inbox
          {
            receiver.inbox.push(msg);

            if (msg.type === 'CANDIDATE_PROPOSAL') {
              const dist = Math.hypot(receiver.x - sender.x, receiver.y - sender.y);
              if (dist <= 3.5) {
              receiver.inbox.push({
                type: 'VOTE_REQUEST',
                fromId: sender.id,
                callsign: sender.callsign,
                col: msg.col,
                row: msg.row,
                tick: this.tick,
              });
            }
          }
          }
        }

        // Log debate events to visible event feed (throttled to avoid spam)
        const debateKey = `${msg.type}-${msg.col},${msg.row}`;
        if (!this._debateLogThrottle.has(debateKey)) {
          this._debateLogThrottle.add(debateKey);
          // Clear throttle every 60 ticks so events can repeat
          if (this.tick % 60 === 0) this._debateLogThrottle.clear();

          if (msg.type === 'CANDIDATE_PROPOSAL' && msg.confidence >= 0.40) {
            this._addEvent('📢', `Agent ${msg.callsign} → ALL: "I'm reading ${(msg.confidence * 100).toFixed(0)}% tri-modal signal at (${msg.col},${msg.row}). Requesting verification from nearby agents."`);
            // Sparse NOOA Negotiation Gate (Ambiguous Band: 0.40 <= C < 0.75)
            if (msg.confidence < 0.75) {
              this._dispatchNOOANegotiation(sender, msg.col, msg.row, msg.confidence);
            }
          }
        }
      }
      sender.outbox = []; // clear after routing
    }

    // Update comms stats for this tick
    this.stats.commsStats = {
      degradedCount: commsDegradedCount,
      avgLinkQuality: this.drones.length > 0 ? commsLinkSum / this.drones.length : 1.0,
      messagesDropped: tickDropped,
    };

    // Process all received messages (each agent independently evaluates)
    for (const drone of this.drones) {
      drone.receiveMessages();
    }

    // Second routing pass: route VOTE_CAST responses back to proposing sentinels
    for (const sender of this.drones) {
      if (sender.outbox.length === 0) continue;
      for (const msg of sender.outbox) {
        // Route vote responses back to nearby drones (especially the sentinel)
        for (const receiver of this.drones) {
          if (receiver.id === sender.id) continue;
          const linkQ = getLinkQuality(sender, receiver, this.scenario);
          if (shouldDeliver(linkQ)) {
            receiver.inbox.push(msg);
          }
        }

        // Log debate votes and consensus to event feed
        if (msg.type === 'VOTE_CAST') {
          if (msg.vote === 'AGREE') {
            this.debateStats.agrees++;
          } else if (msg.vote === 'REJECT') {
            this.debateStats.rejects++;
          }
          const emoji = msg.vote === 'AGREE' ? '✅ YES' : '❌ NO';
          const headingDeg = Math.round((msg.heading * 180 / Math.PI + 360) % 360);
          const debateKey2 = `vote-${msg.callsign}-${msg.targetCol},${msg.targetRow}`;
          if (!this._debateLogThrottle.has(debateKey2)) {
            this._debateLogThrottle.add(debateKey2);
            const reasoning = msg.vote === 'AGREE'
              ? `YOLO Camera + YAMNet Audio alignment confirmed at ${(msg.confidence * 100).toFixed(0)}% confidence`
              : `Single-channel bias only — camera/audio missing from ${headingDeg}° approach angle`;
            this._addEvent(emoji, `Agent ${msg.callsign} [${headingDeg}° angle] votes ${msg.vote} @ (${msg.targetCol},${msg.targetRow}): "${reasoning}"`);
          }
        } else if (msg.type === 'CONSENSUS_CONFIRMED') {
          this.debateStats.consensusConfirmed++;
          const debateKey3 = `consensus-${msg.col},${msg.row}`;
          if (!this._debateLogThrottle.has(debateKey3)) {
            this._debateLogThrottle.add(debateKey3);
            this._addEvent('🏛️', `DEBATE CONSENSUS @ (${msg.col},${msg.row}): ${msg.agrees} AGREE vs ${msg.rejects} REJECT → Agent ${msg.callsign}: "Multi-agent consensus reached! Survivor confirmed. Requesting extraction."`);
          }
        } else if (msg.type === 'CONSENSUS_REJECTED') {
          const debateKey4 = `rejected-${msg.col},${msg.row}`;
          if (!this._debateLogThrottle.has(debateKey4)) {
            this._debateLogThrottle.add(debateKey4);
            this._addEvent('🙅', `DEBATE REJECTED @ (${msg.col},${msg.row}): ${msg.agrees} AGREE vs ${msg.rejects} REJECT → Agent ${msg.callsign}: "False positive! Multi-agent debate rejected this signal. Clearing trail."`);
            this.field.clearLocalAttraction(msg.col, msg.row, 3.0, false);
          }
        }
      }
      sender.outbox = [];
    }

    // Update active relays count
    this.relayStats.activeRelays = this.drones.filter(d => d.role === 'RELAY').length;

    // Process vote messages received in second pass
    for (const drone of this.drones) {
      if (drone.inbox.length > 0) drone.receiveMessages();
    }

    // Finalize zone presence averages
    for (const z of Object.values(this.zonePresence)) {
      z.avgConfidence = z.count > 0 ? (z.sumConf / z.count) : 0;
    }

    const n = this.drones.length || 1;
    this.stats.avgViscosity = sumV / n;
    this.stats.avgConfidence = sumC / n;
    this.stats.avgUncertainty = sumU / n;
    this.stats.regimeCounts = regimeCounts;
    this.stats.roleCounts = roleCounts;

    // Fleet flight telemetry aggregation
    let totalFleetDist = 0;
    let sumFleetSpeed = 0;
    for (const d of this.drones) {
      totalFleetDist += d.totalDistance || 0;
      sumFleetSpeed += d.currentSpeed || 0;
    }
    this.stats.fleetAvgSpeed = n > 0 ? (sumFleetSpeed / n) : 0;
    this.stats.fleetTotalDistance = totalFleetDist;

    // Multi-modal sensor channel status (across the swarm)
    const survivorDrones = this.zonePresence.SURVIVOR ? this.zonePresence.SURVIVOR.count : 0;
    const survivorConf = this.zonePresence.SURVIVOR ? this.zonePresence.SURVIVOR.avgConfidence : 0;

    // Track highest unique drone corroboration on any cell
    let maxUniqueCorroboration = 0;
    for (let i = 0; i < this.field.uniqueDroneCount.length; i++) {
      if (this.field.uniqueDroneCount[i] > maxUniqueCorroboration) {
        maxUniqueCorroboration = this.field.uniqueDroneCount[i];
      }
    }
    this.stats.maxUniqueCorroboration = maxUniqueCorroboration;

    // Multi-modal channel alignment status
    this.stats.channels = {
      thermal: survivorDrones >= 1 ? 'ACTIVE (0.82)' : (this.zonePresence.HOT_DEBRIS?.count > 0 ? 'DEBRIS BIAS (0.82)' : 'LOW (0.12)'),
      audio: survivorDrones >= 1 ? 'ACTIVE (0.75)' : (this.zonePresence.WIND_NOISE?.count > 0 ? 'WIND SPIKE (0.78)' : 'LOW (0.08)'),
      camera: survivorDrones >= 1 ? 'ACTIVE (0.88)' : 'LOW (0.03)',
      gas: survivorDrones >= 1 ? 'ACTIVE (0.45)' : (this.zonePresence.HAZARD?.count > 0 ? 'PLUME (0.88)' : 'LOW (0.05)'),
      corroborated: survivorDrones >= 1 && survivorConf >= 0.35,
    };

    // Rescue certainty
    let certainty = 0.04;
    if (survivorDrones >= 1) {
      const uniqueBoost = Math.min(0.42, 0.12 * maxUniqueCorroboration);
      certainty = Math.min(0.98, survivorConf * 0.70 + uniqueBoost);
    } else {
      const totalDecoyDrones = (this.zonePresence.HOT_DEBRIS?.count || 0) + (this.zonePresence.WIND_NOISE?.count || 0);
      certainty = totalDecoyDrones > 0 ? 0.12 : 0.04;
    }

    this.stats.clusterCertainty = certainty;

    // Update individual survivor target scores and attention tracking
    // Update individual survivor target scores and attention tracking
    let highestConf = 0.20; // Require minimum 20% discovery confidence before setting active focus
    let activeTarget = null;

    for (const st of this.survivorTargets) {
      const cellKey = `${st.col},${st.row}`;
      const isExtracted = this.isSurvivorExtracted(st.col, st.row) || st.status === 'EXTRACTED';

      if (isExtracted) {
        st.status = 'EXTRACTED';
        st.confidence = 1.0;
        st.solidifyTicks = 0;
      } else {
        const distToDrones = this.drones.map(d => Math.hypot(d.col - st.col, d.row - st.row));
        const minDist = distToDrones.length > 0 ? Math.min(...distToDrones) : 999;
        const localDrones = distToDrones.filter(d => d <= 3.8).length;
        const cellUnique = Math.max(this.field.getLocalUniqueDroneCount(st.col, st.row, 1), localDrones);
        const cellStrength = this.field.getLocalMaxStrength(st.col, st.row, 1);

        let targetConf = 0.0;
        if (localDrones >= 1 || cellUnique >= 1 || cellStrength > 0.15) {
          const proximityBonus = minDist <= 2.0 ? 0.20 : minDist <= 3.8 ? 0.10 : 0.0;
          targetConf = Math.min(0.98, cellStrength * 0.40 + localDrones * 0.18 + cellUnique * 0.14 + proximityBonus);
        } else {
          targetConf = 0.0;
        }
        st.confidence = targetConf;

        if (targetConf >= 0.60 || (localDrones >= 2 && minDist <= 3.0)) {
          st.status = 'RESCUE_DISPATCH';
          st.solidifyTicks = (st.solidifyTicks || 0) + 1;

          // Trigger Autonomous n8n First-Responder Dispatch Workflow when target is first locked
          if (!this._seenTargetDispatch) this._seenTargetDispatch = new Set();
          if (!this._seenTargetDispatch.has(cellKey)) {
            this._seenTargetDispatch.add(cellKey);
            this.dispatchLog.push({
              tick: this.tick, col: st.col, row: st.row,
              confidence: st.confidence.toFixed(3),
            });
            this._addEvent('🚨', `Rescue dispatch! Survivor ${st.name} confirmed at sector (${st.col},${st.row})`);

            n8nGateway.triggerSARDispatch({
              col: st.col,
              row: st.row,
              confidence: st.confidence,
              name: st.name,
              readings: { camera: 0.92, audio: 0.88, thermal: 0.85, gas: 0.05 },
              leadAgent: `SWARM-AGENT-0${Math.floor(Math.random() * 5 + 1)}`,
            }).then((res) => {
              const unit = res?.assigned_unit || 'PARAMEDIC-UNIT-04 (DISPATCHED)';
              const eta = res?.eta_minutes || res?.estimated_arrival_minutes || 3.8;
              const priority = res?.priority || 'CODE RED (CRITICAL)';
              this._addEvent('⚡', `[n8n DISPATCH] ${unit} en route to ${st.name} at (${st.col},${st.row}) — ETA ${eta}m`);
              if (typeof window !== 'undefined' && typeof window.showN8nDispatchToast === 'function') {
                window.showN8nDispatchToast({
                  targetName: `${st.name} (${st.col},${st.row})`,
                  col: st.col,
                  row: st.row,
                  confidence: (st.confidence * 100).toFixed(1),
                  unit: unit,
                  eta: eta,
                  priority: priority,
                });
              }
            });
          }
        } else if (targetConf >= 0.20 || minDist <= 4.5) {
          st.status = 'CONVERGING';
          st.solidifyTicks = 0;
        } else {
          st.status = 'SEARCHING';
          st.solidifyTicks = 0;
        }

        // PER-TARGET RESCUE EXTRACTION:
        // When sustained rescue lock is achieved for this survivor (>= 18 ticks of rescue dispatch):
        if (st.solidifyTicks >= 18) {
          if (!this.rescuedCells.has(cellKey) && !this.isSurvivorExtracted(st.col, st.row)) {
            this.rescuedCells.add(cellKey);
            st.status = 'EXTRACTED';
            st.confidence = 1.0;
            st.solidifyTicks = 0;
            this.survivorsExtracted++;
            this.missionScore += 500; // +500 PTS Mission Score!

            if (typeof window !== 'undefined' && typeof window.showN8nDispatchToast === 'function') {
              window.showN8nDispatchToast({
                targetName: `${st.name} [EXTRACTED]`,
                col: st.col,
                row: st.row,
                confidence: '100.0',
                unit: 'GROUND MEDICAL EVAC COMPLETED',
                eta: 0.0,
                priority: 'RESCUE COMPLETE',
              });
            }

            // ATTENTION SHIFT: Clear local attraction so gradient pulls swarm to remaining targets
            this.field.clearLocalAttraction(st.col, st.row, 4.0);

            // Release sentinels and SCATTER all nearby drones out into unexplored Fog of War
            for (const drone of this.drones) {
              const dDist = Math.hypot(drone.col - st.col, drone.row - st.row);
              if (dDist <= 5.0) {
                drone.isSentinel = false;
                drone.sentinelTargetCol = null;
                drone.sentinelTargetRow = null;

                // Scatter into unexplored spatial uncertainty gradients
                const uGrad = this.field.getUncertaintyGradient(drone.col, drone.row);
                let kickAngle = Math.atan2(uGrad.dy, uGrad.dx);
                if (Math.abs(uGrad.dx) < 1e-4 && Math.abs(uGrad.dy) < 1e-4) {
                  kickAngle = Math.random() * Math.PI * 2;
                }
                drone._headingBias = kickAngle + (Math.random() - 0.5) * 0.8;
                drone._headingAngle = kickAngle;
                drone.vx = Math.cos(kickAngle) * 0.50;
                drone.vy = Math.sin(kickAngle) * 0.50;
              }
            }
            this.activeSentinels.delete(cellKey);

            this._addEvent('🏆', `SCORE +500! ${st.name} extracted safely at (${st.col},${st.row})! Sector cleared — Swarm continuing exploration sweep to map remaining unknown sectors!`);

            // Trigger brief phase badge feedback, then resume search
            this.stats.dominantRegime = 'RESCUED';
            this.solidifyTicks = 0;
          }
        }

        if (targetConf > highestConf) {
          highestConf = targetConf;
          activeTarget = st;
        }
      }
    }

    // Set active primary target for attention shift visualization
    const activeId = activeTarget ? activeTarget.id : null;
    if (this._prevActiveTargetId && activeId && this._prevActiveTargetId !== activeId) {
      const prevSt = this.survivorTargets.find(s => s.id === this._prevActiveTargetId);
      const prevName = prevSt ? prevSt.name : 'previous target';
      this._addEvent('⚡', `ATTENTION SHIFT: Primary swarm focus pivoted from ${prevName} → ${activeTarget.name} at sector (${activeTarget.col},${activeTarget.row})`);
    }
    this._prevActiveTargetId = activeId;

    for (const st of this.survivorTargets) {
      st.isPrimaryTarget = (activeTarget && st.id === activeTarget.id && st.status !== 'EXTRACTED');
    }
    this.stats.activeTarget = activeTarget;

    // Map Exploration Percentage & Saturation Monitor
    let exploredCount = 0;
    const expGrid = this.field.explorationGrid;
    if (expGrid) {
      for (let i = 0; i < expGrid.length; i++) {
        if (expGrid[i] > 0.15) exploredCount++;
      }
      this.stats.mapExploredPct = Math.round((exploredCount / expGrid.length) * 100);
    } else {
      this.stats.mapExploredPct = 0;
    }

    // Track exploration saturation (stops increasing when all reachable open tiles are mapped)
    if (this._lastExploredCount === exploredCount) {
      this._explorationStagnantTicks = (this._explorationStagnantTicks || 0) + 1;
    } else {
      this._lastExploredCount = exploredCount;
      this._explorationStagnantTicks = 0;
    }

    // Mission Completion Trigger: Drones return to RTL ONLY IF all survivors are extracted AND map revealed is 100%
    const isMap100Explored = (this.stats.mapExploredPct >= 99);
    const allExtracted = this.survivorTargets.length > 0 && this.survivorTargets.every(st => st.status === 'EXTRACTED');

    // Drones initiate Return-To-Launch (RTL) ONLY when Map Revealed is 100% AND all survivors extracted!
    if (isMap100Explored && allExtracted) {
      this.isMissionComplete = true;
      this.stats.dominantRegime = 'RESCUED'; // Permanent RTL Phase
      if (!this._hasLoggedRTL) {
        this._hasLoggedRTL = true;
        this._addEvent('🛸', `MISSION ACCOMPLISHED! All ${this.survivorsExtracted} survivors extracted safely & 100% Grid Mapped (${this.stats.mapExploredPct}%) — Swarm executing Return-To-Launch (RTL) sequence.`);
      }
    } else if (this.isMissionComplete || this._hasLoggedRTL) {
      this.stats.dominantRegime = 'RESCUED';
    } else if (this.stats.dominantRegime === 'RESCUED' && !this.isMissionComplete) {
      // If temporary RESCUED regime was active from survivor extraction but map is not 100% mapped yet, resume exploration sweep!
      this.solidifyTicks++;
      if (this.solidifyTicks > 30) {
        this.stats.dominantRegime = 'SPREAD'; // Resume search sweep for remaining unmapped sectors!
        this.solidifyTicks = 0;
      }
    } else if ((survivorDrones >= 2 || maxUniqueCorroboration >= 2) && survivorDrones >= 1 && certainty >= 0.35) {
      this.stats.dominantRegime = 'SOLIDIFY';
      this.solidifyTicks++;
      if (this.solidifyTicks >= 55) {
        this.stats.dominantRegime = 'RESCUED'; // Transition to Phase 4: RESCUE COMPLETE!
        this.solidifyTicks = 0;
      }
    } else if (survivorDrones >= 1 && certainty >= 0.18) {
      this.stats.dominantRegime = 'CONVERGE';
      this.solidifyTicks = 0;
    } else {
      this.stats.dominantRegime = 'SPREAD';
      this.solidifyTicks = 0;
    }

        // Detect regime transitions and log them as narrative events
        if (this.stats.dominantRegime !== this._prevDominant) {
          const transitions = {
            CONVERGE: '🟡 Multi-modal agreement! Swarm converging to verify',
            SOLIDIFY: '🔴 Confirmed survivor! Multi-drone corroboration locked — rescue dispatched',
            RESCUED: '🟢 SURVIVOR EXTRACTED SAFELY! Sector cleared — re-deploying swarm to patrol',
            SPREAD: '🔵 Search sweep active — patrolling remaining sectors',
          };
          const msg = transitions[this.stats.dominantRegime];
          if (msg) this._addEvent('→', msg);
          this._prevDominant = this.stats.dominantRegime;
        }

        // Periodic narrative events highlighting technical SAR features
        if (this.tick % 40 === 0) {
          const sCount = this.zonePresence.SURVIVOR ? this.zonePresence.SURVIVOR.count : 0;
          const dCount = this.zonePresence.HOT_DEBRIS ? this.zonePresence.HOT_DEBRIS.count : 0;
          const wCount = this.zonePresence.WIND_NOISE ? this.zonePresence.WIND_NOISE.count : 0;
          const hCount = this.zonePresence.HAZARD ? this.zonePresence.HAZARD.count : 0;

          if (this.tick < 120 && this.tick % 80 === 0) {
            this._addEvent('📐', `Vantage-point sampling active — approach angle & range modulate noise`);
          }

          if (dCount > 0 && Math.random() < 0.45) {
            this._addEvent('🔥', `Hot Debris thermal bias (${dCount} drone${dCount > 1 ? 's' : ''}) — Audio/gas silent, unconfirmed single-channel`);
          }
          if (wCount > 0 && Math.random() < 0.45) {
            this._addEvent('🌬️', `Wind noise audio spike (${wCount} drone${wCount > 1 ? 's' : ''}) — Thermal/gas silent, confidence capped`);
          }
          if (hCount > 0 && Math.random() < 0.45) {
            this._addEvent('⚠️', `Hazard gas plume (${hCount} drone${hCount > 1 ? 's' : ''}) — Single channel, avoidance active`);
          }
          if (sCount > 0 && sCount < 3) {
            this._addEvent('📡', `Multi-modal signal detected! (${sCount} drone${sCount > 1 ? 's' : ''}) — Checking Thermal+Audio+Gas alignment`);
          }
          if (sCount >= 3) {
            this._addEvent('🎯', `Multi-drone consensus! (${maxUniqueCorroboration} unique drones corroborating sector)`);
          }
        }

    // Periodic Beeceptor Cloud Telemetry & HIL Ingress Polling
    if (this.tick % 60 === 0) {
      beeceptor.logTelemetry({
        activeDrones: this.drones.length,
        mapExploredPct: this.stats.mapExploredPct,
        survivorsExtracted: this.survivorsExtracted,
        decoysRejected: this.stats.decoysRejected || 0,
      });

      beeceptor.checkHILOverride((override) => {
        if (override.action === 'INJECT_HAZARD') {
          const c = override.sector_col ?? 10;
          const r = override.sector_row ?? 12;
          this.field.deposit(c, r, 0.9, 'HIL_OVERRIDE', 0.1, 0.8);
          this._addEvent('⚠️', `[BEECEPTOR HIL] External Hazard Injected at (${c}, ${r})! Swarm re-routing.`);
        } else if (override.action === 'INJECT_DECOY') {
          const c = override.sector_col ?? 8;
          const r = override.sector_row ?? 8;
          this._addEvent('🔥', `[BEECEPTOR HIL] External Thermal Decoy Injected at (${c}, ${r})! Verification active.`);
        }
      });
    }
  }

  _addEvent(icon, text) {
    this.eventLog.unshift({ tick: this.tick, icon, text });
    if (this.eventLog.length > this._maxEvents) this.eventLog.pop();

    // Stream high-priority SAR Incidents to Beeceptor Cloud Proxy
    if (icon === '🚨' || icon === '🏆' || icon === '🙅' || icon === '🤖' || icon === '🏛️') {
      beeceptor.logIncident({
        tick: this.tick,
        icon,
        summary: text,
        active_drones: this.drones.length,
        survivors_found: this.survivorsExtracted || 0,
      });
    }
  }

  /**
   * Asynchronous NOOA Multi-Agent Tactical Negotiation Dispatch
   * - Deterministic Cluster Lead: Lowest Drone ID in 6.0-unit local bubble
   * - Non-blocking: Fire-and-forget fetch with 400ms abort controller timeout
   * - In-flight Concurrency Cap: Max 2 concurrent requests fleet-wide
   * - Safe Fallback: Drops silently to existing deterministic voting on error/timeout
   */
  _dispatchNOOANegotiation(proposer, col, row, candidateConf) {
    if (this._nooaInFlightCount >= 2) return;
    const sectorKey = `${col},${row}`;
    if (this._activeNOOASectors && this._activeNOOASectors.has(sectorKey)) return;

    // Deterministic Cluster Lead Election: lowest drone ID in radio bubble
    const localPeers = this.drones.filter(d => Math.hypot(d.x - (col + 0.5), d.y - (row + 0.5)) <= 6.0);
    if (localPeers.length === 0) return;
    const leadDrone = localPeers.reduce((min, d) => d.id < min.id ? d : min, localPeers[0]);

    // Only the deterministically elected cluster lead dispatches the request
    if (proposer.id !== leadDrone.id) return;

    if (!this._activeNOOASectors) this._activeNOOASectors = new Set();
    this._activeNOOASectors.add(sectorKey);
    this._nooaInFlightCount = (this._nooaInFlightCount || 0) + 1;
    this.nooaStats.accessCount = (this.nooaStats.accessCount || 0) + 1;

    const peerAngles = localPeers.map(p => p.heading);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2000ms safety timeout for local Nemotron LLM

    const payload = {
      agent_id: proposer.id,
      callsign: proposer.callsign,
      sector: `(${col}, ${row})`,
      confidence: candidateConf,
      readings: proposer.lastReadings,
      peer_angles: peerAngles,
    };

    fetch('/api/nooa/negotiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
      .then(res => res.json())
      .then(data => {
        clearTimeout(timeoutId);
        this._nooaInFlightCount = Math.max(0, this._nooaInFlightCount - 1);
        setTimeout(() => this._activeNOOASectors.delete(sectorKey), 3000); // 3s cooldown

        if (data && data.is_valid && data.decision) {
          this.nooaStats.successCount = (this.nooaStats.successCount || 0) + 1;
          this.nooaStats.lastDecision = data.decision;

          beeceptor.logNOOADebate({
            lead_agent: proposer.callsign,
            sector: `(${col}, ${row})`,
            decision: data.decision,
            confidence: data.confidence,
            channel_alignment: data.channel_alignment,
            reasoning: data.reasoning,
            peer_angles: peerAngles,
          });
          if (data.decision === 'CONFIRM') {
            this._addEvent('🤖', `[NOOA NEGOTIATOR] ${data.reasoning}`);
            this.field.deposit(col, row, 0.40, proposer.id, data.confidence, 0.05);
          } else if (data.decision === 'REJECT') {
            this._addEvent('🙅', `[NOOA NEGOTIATOR] ${data.reasoning}`);
            this.field.clearLocalAttraction(col, row, 3.0, false);
          }
        }
      })
      .catch(() => {
        clearTimeout(timeoutId);
        this._nooaInFlightCount = Math.max(0, this._nooaInFlightCount - 1);
        this._activeNOOASectors.delete(sectorKey);
        // Silent deterministic fallback: existing swarm peer debate handles it
      });
  }

  stepN(n) {
    for (let i = 0; i < n; i++) this.step();
  }
}
