import { create } from 'zustand';

export const useSimStore = create((set, get) => ({
  // ─── Simulation Runtime Configuration ──────────────────────────────────
  isRunning: false,
  simSpeed: 1,
  scenario: 'disaster-zone',
  droneCount: 16,
  modes: {
    satellite: true,
    fog: true,
    overlay: false,
    speech: true,
  },
  bftEnabled: true,

  // ─── Custom Scenario Generation Config ────────────────────────────────
  customConfig: {
    survivorCount: 8,
    areaRadiusMeters: 200,
    spreadFactor: 0.5,
  },

  // ─── Selected Entity (Single Right-Side Inspector Dossier) ───────────────
  selectedEntity: null, // { type: 'drone' | 'survivor', id: number | string } | null
  selectedDroneDetail: null,
  selectedSurvivorDetail: null,

  // ─── StatusRail Always-On Values (Low-Frequency 5 Hz Slice) ────────────
  dominantRegime: 'SPREAD',
  certainty: 0,
  survivorsFound: 0,
  survivorsTotal: 5,
  survivorsExtracted: 0,
  mapExploredPct: 0,
  fleetActive: 16,
  fleetRelays: 0,
  fleetSentinels: 0,
  fleetDegraded: 0,
  linkQualityPct: 100,
  falsePositives: 0,

  // ─── AlertSlot (Event-Driven / Conditional) ─────────────────────────────
  alert: null, // { type: 'rogue' | 'battery' | 'comms' | 'complete', title: string, desc: string, tone: 'alert' | 'warning' | 'info' }
  rogueCount: 0,
  attacksBlocked: 0,
  quarantinedCount: 0,
  bftQuorumSafe: true,

  // ─── Console Drawer (On-Demand Bottom Drawer) ───────────────────────────
  drawerOpen: false,
  drawerTab: 'debate', // 'debate' | 'events'
  debateStats: {
    proposals: 0,
    agrees: 0,
    rejects: 0,
    consensusConfirmed: 0,
  },
  debateFeed: [], // capped at 100
  eventLog: [],   // capped at 500

  // ─── Entities Summary (For selection lookup & inspector) ────────────────
  survivorTargets: [],
  dronesList: [],
  rightRailTab: 'survivors', // 'survivors' | 'drones'
  rightRailOpen: true,

  // ─── Actions ───────────────────────────────────────────────────────────
  setIsRunning: (isRunning) => set({ isRunning }),
  setSimSpeed: (simSpeed) => set({ simSpeed }),
  setScenario: (scenario) => set({ scenario }),
  setDroneCount: (droneCount) => set({ droneCount }),
  toggleMode: (key) => set((state) => ({
    modes: { ...state.modes, [key]: !state.modes[key] },
  })),
  setBftEnabled: (bftEnabled) => set({ bftEnabled }),
  setCustomConfig: (patch) => set((s) => ({
    customConfig: { ...s.customConfig, ...patch },
  })),

  setSelectedEntity: (type, id) => {
    if (!type || id === null || id === undefined) {
      set({ selectedEntity: null, selectedDroneDetail: null, selectedSurvivorDetail: null });
      return;
    }
    const state = get();
    let droneDetail = null;
    let survivorDetail = null;
    if (type === 'drone') {
      droneDetail = state.dronesList.find((d) => d.id === id) || null;
    } else if (type === 'survivor') {
      survivorDetail = state.survivorTargets.find((s) => s.id === id) || null;
    }
    set({
      selectedEntity: { type, id },
      selectedDroneDetail: droneDetail,
      selectedSurvivorDetail: survivorDetail,
    });
  },

  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
  toggleDrawer: () => set((state) => ({ drawerOpen: !state.drawerOpen })),
  setDrawerTab: (drawerTab) => set({ drawerTab }),

  // ─── Sliced Batch Telemetry Updates from Sim Loop (5 Hz) ────────────────
  updateStatusRail: (patch) => set(patch),

  updateEntities: ({ targets, drones }) => {
    const state = get();
    let nextSelectedDrone = state.selectedDroneDetail;
    let nextSelectedSurvivor = state.selectedSurvivorDetail;

    if (state.selectedEntity) {
      if (state.selectedEntity.type === 'drone') {
        nextSelectedDrone = drones.find((d) => d.id === state.selectedEntity.id) || nextSelectedDrone;
      } else if (state.selectedEntity.type === 'survivor') {
        nextSelectedSurvivor = targets.find((t) => t.id === state.selectedEntity.id) || nextSelectedSurvivor;
      }
    }

    set({
      survivorTargets: targets,
      dronesList: drones,
      selectedDroneDetail: nextSelectedDrone,
      selectedSurvivorDetail: nextSelectedSurvivor,
    });
  },

  setRightRailTab: (rightRailTab) => set({ rightRailTab }),
  setRightRailOpen: (rightRailOpen) => set({ rightRailOpen }),
  toggleRightRail: () => set((s) => ({ rightRailOpen: !s.rightRailOpen })),

  setDebateFeed: (feed) => set({ debateFeed: feed }),

  pushDebateMessages: (newMsgs) => {
    if (!newMsgs || newMsgs.length === 0) return;
    set((state) => ({
      debateFeed: [...newMsgs, ...state.debateFeed].slice(0, 150),
    }));
  },

  pushEvents: (newEvents) => {
    if (!newEvents || newEvents.length === 0) return;
    set((state) => ({
      eventLog: [...newEvents, ...state.eventLog].slice(0, 500),
    }));
  },
}));
