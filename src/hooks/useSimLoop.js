import { useEffect, useRef, useCallback } from 'react';
import { PheromoneField } from '../field.js';
import { DisasterScenario } from '../scenario.js';
import { SensorGenerator } from '../sensors.js';
import { Swarm } from '../swarm.js';
import { Visualizer } from '../visualizer.js';
import { useSimStore } from '../store/simStore.js';

const GRID_COLS = 22;
const GRID_ROWS = 18;
const SIM_TICK_MS = 62; // base interval per tick (~16 ticks/sec at 1x)

export function useSimLoop(canvasRef, updateTelemetryRef) {
  const instancesRef = useRef({
    field: null,
    scenario: null,
    sensors: null,
    swarm: null,
    visualizer: null,
  });

  const loopStateRef = useRef({
    isRunning: false,
    rafHandle: null,
    lastTime: 0,
    simAccum: 0,
    realElapsedMs: 0,
    lastUiFlushTime: 0,
    lastEventCount: 0,
    falsePositives: 0,
  });

  // ─── Build / Reset Simulation Core ───────────────────────────────────────
  const buildSimulation = useCallback(() => {
    const { scenario: scenarioName, droneCount, bftEnabled, customConfig } = useSimStore.getState();
    const inst = instancesRef.current;

    // ─── Dynamic grid: custom scenarios derive cols/rows from config ─────
    if (scenarioName === 'custom') {
      inst.scenario = DisasterScenario.generate(customConfig);
    } else {
      inst.scenario = new DisasterScenario(GRID_COLS, GRID_ROWS, scenarioName);
    }

    const cols = inst.scenario.cols;
    const rows = inst.scenario.rows;

    inst.field = new PheromoneField(cols, rows);
    inst.sensors = new SensorGenerator(inst.scenario);
    inst.swarm = new Swarm(inst.field, inst.sensors);

    // Apply BFT configuration
    if (typeof inst.swarm.toggleByzantineDefense === 'function' && inst.swarm.byzantineDefenseEnabled !== bftEnabled) {
      inst.swarm.toggleByzantineDefense();
    }

    inst.swarm.spawn(Math.max(2, droneCount || 16));

    if (inst.visualizer) {
      inst.visualizer.field = inst.field;
      inst.visualizer.scenario = inst.scenario;
      inst.visualizer.swarm = inst.swarm;

      // Re-derive layout for new grid dimensions
      const canvas = inst.visualizer.canvas;
      const parent = canvas?.parentElement;
      if (parent) {
        const dpr = window.devicePixelRatio || 1;
        inst.visualizer.resize(parent.clientWidth, parent.clientHeight, dpr);
      }
    }

    loopStateRef.current.realElapsedMs = 0;
    loopStateRef.current.simAccum = 0;
    loopStateRef.current.lastEventCount = 0;
    loopStateRef.current.falsePositives = 0;

    // Reset store data
    useSimStore.getState().updateStatusRail({
      dominantRegime: 'SPREAD',
      certainty: 0,
      survivorsFound: 0,
      survivorsTotal: inst.scenario.survivors ? inst.scenario.survivors.length : 5,
      survivorsExtracted: 0,
      mapExploredPct: 0,
      fleetActive: inst.swarm.drones.length,
      fleetRelays: 0,
      fleetSentinels: 0,
      fleetDegraded: 0,
      linkQualityPct: 100,
      falsePositives: 0,
      alert: null,
      rogueCount: 0,
      attacksBlocked: 0,
      quarantinedCount: 0,
      bftQuorumSafe: true,
      debateStats: { proposals: 0, agrees: 0, rejects: 0, consensusConfirmed: 0 },
    });

    useSimStore.getState().setDebateFeed([]);
    useSimStore.getState().setSelectedEntity(null);
  }, []);

  // ─── Simulation Step & Telemetry Harvesting ──────────────────────────────
  const flushTelemetry = useCallback((stepped) => {
    const inst = instancesRef.current;
    if (!inst.swarm) return;

    const { swarm, scenario } = inst;
    const { tick, stats, drones, zonePresence, eventLog, survivorsExtracted, survivorTargets } = swarm;
    const { avgViscosity, clusterCertainty, dominantRegime } = stats;

    const realSec = Math.floor(loopStateRef.current.realElapsedMs / 1000);
    const simSec = Math.floor(tick * 0.062);

    // 1. Direct DOM writes (10 Hz)
    if (updateTelemetryRef && updateTelemetryRef.current) {
      updateTelemetryRef.current({
        tick,
        realSec,
        simSec,
        avgSpeed: stats.fleetAvgSpeed || 0,
        totalDist: stats.fleetTotalDistance || 0,
      });
    }

    if (!stepped) return;

    // 2. False Positives
    if (zonePresence && tick % 25 === 0) {
      const debrisCount = zonePresence.HOT_DEBRIS ? zonePresence.HOT_DEBRIS.count : 0;
      const windCount = zonePresence.WIND_NOISE ? zonePresence.WIND_NOISE.count : 0;
      loopStateRef.current.falsePositives += debrisCount + windCount;
    }

    // 3. StatusRail Slice (5 Hz)
    const certainty = Math.round((clusterCertainty !== undefined ? clusterCertainty : avgViscosity) * 100);
    const commsStats = stats.commsStats || {};
    const lqPct = Math.round((commsStats.avgLinkQuality || 0) * 100);

    const totalTargets = survivorTargets ? survivorTargets.length : (scenario?.survivors?.length || 5);
    const foundTargets = survivorTargets
      ? survivorTargets.filter(t => t.status === 'EXTRACTED' || t.status === 'RESCUE_DISPATCH' || t.status === 'CONVERGING' || (t.confidence >= 0.35)).length
      : 0;

    const secStats = swarm.securityStats || {};
    const commsDegradedCount = commsStats.degradedCount || 0;

    // Determine highest priority alert
    let currentAlert = null;
    if (secStats.quarantinedCount > 0) {
      currentAlert = {
        type: 'rogue',
        title: 'ROGUE NODE QUARANTINED',
        desc: `${secStats.quarantinedCount} compromised agent(s) isolated from consensus mesh.`,
        tone: 'alert',
      };
    } else if (secStats.rogueCount > 0) {
      currentAlert = {
        type: 'rogue',
        title: 'BYZANTINE INTRUSION DETECTED',
        desc: `${secStats.rogueCount} rogue drone(s) broadcasting falsified coordinates.`,
        tone: 'alert',
      };
    } else if (commsDegradedCount > 0) {
      currentAlert = {
        type: 'comms',
        title: 'COMMS LINK DEGRADATION',
        desc: `${commsDegradedCount} drone(s) operating on fallback stigmergic navigation.`,
        tone: 'warning',
      };
    } else if (dominantRegime === 'RESCUED') {
      currentAlert = {
        type: 'complete',
        title: 'MISSION SUCCESS',
        desc: 'All survivors secured. Swarm returned to launch pad.',
        tone: 'info',
      };
    }

    useSimStore.getState().updateStatusRail({
      dominantRegime,
      certainty,
      survivorsFound: foundTargets,
      survivorsTotal: totalTargets,
      survivorsExtracted: survivorsExtracted || 0,
      mapExploredPct: stats.mapExploredPct || 0,
      fleetActive: drones.length,
      fleetRelays: stats.roleCounts?.RELAY || drones.filter(d => d.role === 'RELAY').length,
      fleetSentinels: stats.roleCounts?.SENTINEL || drones.filter(d => d.role === 'SENTINEL').length,
      fleetDegraded: commsDegradedCount,
      linkQualityPct: lqPct,
      falsePositives: loopStateRef.current.falsePositives,
      alert: currentAlert,
      rogueCount: secStats.rogueCount || 0,
      attacksBlocked: secStats.attacksBlocked || 0,
      quarantinedCount: secStats.quarantinedCount || 0,
      bftQuorumSafe: ((drones.length - (secStats.rogueCount || 0)) >= Math.floor((drones.length * 2) / 3) + 1),
      debateStats: { ...(swarm.debateStats || {}) },
    });

    // 4. Update entities dossier data
    useSimStore.getState().updateEntities({
      targets: (survivorTargets || []).map((t, idx) => ({
        id: t.id !== undefined ? t.id : idx,
        name: t.name || `SURVIVOR-${idx + 1}`,
        col: t.col,
        row: t.row,
        confidence: typeof t.confidence === 'number' ? t.confidence : 0,
        status: t.status || 'SEARCHING',
        vitals: t.vitals || 'STABLE',
        solidifyTicks: t.solidifyTicks || 0,
        isExtracted: t.status === 'EXTRACTED',
      })),
      drones: drones.map(d => ({
        id: d.id,
        callsign: d.callsign || `DRONE-${d.id}`,
        role: d.role,
        battery: d.battery,
        altitude: d.altitude || 25,
        col: d.col,
        row: d.row,
        x: d.x,
        y: d.y,
        currentSpeed: d.currentSpeed || 0,
        totalDistance: d.totalDistance || 0,
        distanceToBase: d.distanceToBase || 0,
        regime: d.regime,
        decisionMode: d.decisionMode,
        isRogue: !!d.isRogue,
        isQuarantined: !!d.isQuarantined,
        trust: typeof swarm.getAverageTrust === 'function' ? Math.round(swarm.getAverageTrust(d.id) * 100) : 100,
      })),
    });

    // 5. Authoritative Swarm Debate Feed sync
    if (swarm.debateFeed && swarm.debateFeed.length > 0) {
      useSimStore.getState().setDebateFeed([...swarm.debateFeed]);
    }

    // 6. Event Log sync (uses monotonic sequence counter to detect new events)
    const swarmSeq = swarm._eventSeq || 0;
    if (eventLog && swarmSeq !== loopStateRef.current.lastEventCount) {
      // Push the entire current eventLog snapshot (it's already capped at 20 items)
      loopStateRef.current.lastEventCount = swarmSeq;
      useSimStore.getState().pushEvents([...eventLog]);
    }
  }, [updateTelemetryRef]);

  // ─── The Main 60 FPS Animation Loop (Fixed Timestep Interpolated) ──────────
  const loop = useCallback((timestamp) => {
    const loopState = loopStateRef.current;
    if (!loopState.lastTime) loopState.lastTime = timestamp;
    const dt = Math.min(timestamp - loopState.lastTime, 100);
    loopState.lastTime = timestamp;
    loopState.realElapsedMs += dt;

    const { simSpeed } = useSimStore.getState();
    const tickInterval = SIM_TICK_MS / Math.max(1, simSpeed);
    loopState.simAccum += dt;

    let stepped = false;
    const inst = instancesRef.current;

    while (loopState.simAccum >= tickInterval) {
      if (inst.swarm) {
        inst.swarm.step();
        stepped = true;
      }
      loopState.simAccum -= tickInterval;
    }

    // Fixed-timestep interpolation factor alpha (0.0 -> 1.0)
    const alpha = Math.min(1, loopState.simAccum / tickInterval);

    // 60 FPS Render
    if (inst.visualizer) {
      inst.visualizer.render(alpha);
    }

    // Rate-limited telemetry flush (~5-10 Hz)
    if (timestamp - loopState.lastUiFlushTime >= 100) {
      loopState.lastUiFlushTime = timestamp;
      flushTelemetry(stepped);
    }

    if (loopState.isRunning) {
      loopState.rafHandle = requestAnimationFrame(loop);
    }
  }, [flushTelemetry]);

  // ─── Play / Pause / Reset Handlers ───────────────────────────────────────
  const start = useCallback(() => {
    if (loopStateRef.current.isRunning) return;
    loopStateRef.current.isRunning = true;
    loopStateRef.current.lastTime = 0;
    loopStateRef.current.simAccum = 0;
    useSimStore.getState().setIsRunning(true);
    loopStateRef.current.rafHandle = requestAnimationFrame(loop);
  }, [loop]);

  const pause = useCallback(() => {
    if (!loopStateRef.current.isRunning) return;
    loopStateRef.current.isRunning = false;
    useSimStore.getState().setIsRunning(false);
    cancelAnimationFrame(loopStateRef.current.rafHandle);
  }, []);

  const reset = useCallback(() => {
    pause();
    buildSimulation();
    start();
  }, [pause, buildSimulation, start]);

  // ─── Canvas Mounting & Visualizer Attachment ─────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;

    buildSimulation();

    const inst = instancesRef.current;
    inst.visualizer = new Visualizer(canvas, inst.field, inst.scenario, inst.swarm);

    // Initial resize to parent container
    const parent = canvas.parentElement;
    if (parent) {
      inst.visualizer.resize(parent.clientWidth, parent.clientHeight, dpr);
    }

    // Initial visualizer mode flags matching store
    const { modes } = useSimStore.getState();
    inst.visualizer.showSatelliteMode = modes.satellite;
    inst.visualizer.showFogOfWar = modes.fog;
    inst.visualizer.showScenarioOverlay = modes.overlay;
    inst.visualizer.showAgentComm = modes.speech;

    inst.visualizer.render(1);
    start();

    return () => {
      pause();
    };
  }, [canvasRef, buildSimulation, start, pause]);

  // ─── Dynamic Scenario & Radius Live Adaptation ───────────────────────────
  const customConfig = useSimStore((s) => s.customConfig);
  const scenario = useSimStore((s) => s.scenario);
  const isInitialMountRef = useRef(true);

  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    if (scenario === 'custom') {
      const timer = setTimeout(() => {
        const wasRunning = loopStateRef.current.isRunning;
        buildSimulation();
        if (wasRunning) {
          start();
        } else {
          instancesRef.current.visualizer?.render(1);
        }
      }, 75);
      return () => clearTimeout(timer);
    }
  }, [
    scenario,
    customConfig.areaRadiusMeters,
    customConfig.survivorCount,
    customConfig.spreadFactor,
    buildSimulation,
    start,
  ]);

  // ─── Subscribed Actions triggered from UI ────────────────────────────────
  const injectRogue = useCallback(() => {
    const inst = instancesRef.current;
    if (inst.swarm && typeof inst.swarm.injectRogueDrone === 'function') {
      inst.swarm.injectRogueDrone();
    }
  }, []);

  const neutralizeRogue = useCallback(() => {
    const inst = instancesRef.current;
    if (inst.swarm && typeof inst.swarm.neutralizeRogueDrones === 'function') {
      inst.swarm.neutralizeRogueDrones();
    }
  }, []);

  const toggleBft = useCallback(() => {
    const inst = instancesRef.current;
    if (inst.swarm && typeof inst.swarm.toggleByzantineDefense === 'function') {
      const active = inst.swarm.toggleByzantineDefense();
      useSimStore.getState().setBftEnabled(active);
    }
  }, []);

  const forceRTL = useCallback(() => {
    const inst = instancesRef.current;
    if (inst.swarm) {
      inst.swarm.isMissionComplete = true;
      inst.swarm.stats.dominantRegime = 'RESCUED';
      inst.swarm._hasLoggedRTL = true;
      inst.swarm._addEvent('[RTL]', 'MANUAL OVERRIDE: Return-To-Launch (RTL) initiated by operator.');
    }
  }, []);

  const selectDrone = useCallback((id) => {
    const inst = instancesRef.current;
    if (inst.visualizer) {
      inst.visualizer.selectedDroneId = id;
      inst.visualizer.render(1);
    }
    useSimStore.getState().setSelectedEntity(id !== null ? 'drone' : null, id);
  }, []);

  const selectSurvivor = useCallback((id) => {
    useSimStore.getState().setSelectedEntity(id !== null ? 'survivor' : null, id);
  }, []);

  return {
    start,
    pause,
    reset,
    injectRogue,
    neutralizeRogue,
    toggleBft,
    forceRTL,
    selectDrone,
    selectSurvivor,
    instances: instancesRef.current,
  };
}
