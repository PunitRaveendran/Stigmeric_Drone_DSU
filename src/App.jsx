import React, { useRef, useEffect } from 'react';
import { useSimStore } from './store/simStore.js';
import { useRafTelemetryRefs } from './hooks/useRafValue.js';
import { useSimLoop } from './hooks/useSimLoop.js';
import { Toolbar } from './components/Toolbar.jsx';
import { MapCanvas } from './components/MapCanvas.jsx';
import { StatusRail } from './components/StatusRail.jsx';
import { RightDossierRail } from './components/RightDossierRail.jsx';
import { ConsoleDrawer } from './components/ConsoleDrawer.jsx';
import { ErrorBoundary } from './ui/ErrorBoundary.jsx';
import { n8nGateway } from './n8n.js';

export function App() {
  const canvasRef = useRef(null);
  const telemetryRefs = useRafTelemetryRefs();

  // Reference for direct DOM updates
  const updateTelemetryRef = useRef(telemetryRefs.updateTelemetry);
  updateTelemetryRef.current = telemetryRefs.updateTelemetry;

  const {
    start,
    pause,
    reset,
    injectRogue,
    neutralizeRogue,
    toggleBft,
    forceRTL,
    selectDrone,
    instances,
  } = useSimLoop(canvasRef, updateTelemetryRef);

  const isRunning = useSimStore((s) => s.isRunning);
  const toggleMode = useSimStore((s) => s.toggleMode);
  const setSimSpeed = useSimStore((s) => s.setSimSpeed);
  const toggleDrawer = useSimStore((s) => s.toggleDrawer);
  const setSelectedEntity = useSimStore((s) => s.setSelectedEntity);

  // ─── Keyboard Shortcuts (§7) ─────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore keystrokes when focused in an input or select element
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          isRunning ? pause() : start();
          break;
        case 'KeyR':
          e.preventDefault();
          reset();
          break;
        case 'Digit1':
          setSimSpeed(1);
          break;
        case 'Digit2':
          setSimSpeed(2);
          break;
        case 'Digit3':
          setSimSpeed(4);
          break;
        case 'Digit4':
          setSimSpeed(8);
          break;
        case 'KeyF':
          toggleMode('fog');
          break;
        case 'KeyS':
          toggleMode('satellite');
          break;
        case 'KeyB':
          toggleBft();
          break;
        case 'KeyO':
          toggleMode('overlay');
          break;
        case 'KeyC':
          toggleMode('speech');
          break;
        case 'Escape':
          setSelectedEntity(null);
          selectDrone(null);
          break;
        case 'Backquote':
          toggleDrawer();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRunning, start, pause, reset, setSimSpeed, toggleMode, toggleBft, toggleDrawer, setSelectedEntity, selectDrone]);

  // ─── Test n8n Webhook Trigger ─────────────────────────────────────────────
  const handleTestN8n = async () => {
    const testData = {
      col: 14,
      row: 22,
      confidence: 0.942,
      readings: { camera: 0.95, audio: 0.91, thermal: 0.88, gas: 0.04 },
      leadAgent: 'OPERATOR-MANUAL-PING',
      name: 'TEST-CASUALTY-ALPHA',
    };
    if (instances?.swarm) {
      instances.swarm._addEvent('n8n', 'Triggering test webhook to n8n cloud triage pipeline...');
    }
    await n8nGateway.triggerSARDispatch(testData);
  };

  return (
    <div className="mission-control-app">
      {/* ─── Top Floating Mission Controls Toolbar ──────────────────────── */}
      <Toolbar
        onPlay={start}
        onPause={pause}
        onReset={reset}
        onInjectRogue={injectRogue}
        onToggleBft={toggleBft}
        onForceRtl={forceRTL}
        onTestN8n={handleTestN8n}
      />

      {/* ─── Main Viewport Area ─────────────────────────────────────────── */}
      <main className="mission-workspace">
        {/* Full-Bleed Map & Simulation Canvas */}
        <MapCanvas
          canvasRef={canvasRef}
          onSelectDrone={selectDrone}
          instances={instances}
        />

        {/* Fixed Left Status Rail (Live Flight Telemetry + Mission Phase + Fleet Metrics) */}
        <ErrorBoundary name="StatusRail">
          <StatusRail
            telemetryRefs={telemetryRefs}
            onNeutralizeRogue={neutralizeRogue}
          />
        </ErrorBoundary>

        {/* Persistent Right Dossier Rail (Survivors Roster, Fleet Drones Telemetry, Deep Inspector) */}
        <ErrorBoundary name="RightDossierRail">
          <RightDossierRail
            onSelectDrone={selectDrone}
            onSelectSurvivor={setSelectedEntity}
          />
        </ErrorBoundary>
      </main>

      {/* ─── Collapsible Bottom Console Drawer ──────────────────────────── */}
      <ErrorBoundary name="ConsoleDrawer">
        <ConsoleDrawer />
      </ErrorBoundary>
    </div>
  );
}
