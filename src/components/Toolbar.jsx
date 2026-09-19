import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Satellite,
  CloudFog,
  Layers,
  MessageSquare,
  Shield,
  ShieldAlert,
  Home,
  ExternalLink,
  Send,
  Zap,
} from 'lucide-react';
import { useSimStore } from '../store/simStore.js';
import { IconButton } from '../ui/IconButton.jsx';

export function Toolbar({
  onPlay,
  onPause,
  onReset,
  onInjectRogue,
  onToggleBft,
  onForceRtl,
  onTestN8n,
}) {
  const isRunning = useSimStore((s) => s.isRunning);
  const simSpeed = useSimStore((s) => s.simSpeed);
  const scenario = useSimStore((s) => s.scenario);
  const droneCount = useSimStore((s) => s.droneCount);
  const modes = useSimStore((s) => s.modes);
  const bftEnabled = useSimStore((s) => s.bftEnabled);

  const setSimSpeed = useSimStore((s) => s.setSimSpeed);
  const setScenario = useSimStore((s) => s.setScenario);
  const setDroneCount = useSimStore((s) => s.setDroneCount);
  const toggleMode = useSimStore((s) => s.toggleMode);

  return (
    <header className="mission-toolbar" role="toolbar" aria-label="Simulation Controls">
      {/* ─── ROW 1: Brand & Primary Simulation Controls ───────────────────── */}
      <div className="toolbar-row toolbar-row-primary">
        <div className="toolbar-brand">
          <Zap size={14} className="brand-icon" />
          <span className="brand-name">PROTOPLASM</span>
          <span className="brand-sub">SAR SWARM</span>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <IconButton
            icon={isRunning ? Pause : Play}
            label={isRunning ? 'Pause' : 'Play'}
            tone={isRunning ? 'accent' : 'default'}
            onClick={isRunning ? onPause : onPlay}
            size="sm"
            title="Play / Pause (Space)"
          />
          <IconButton
            icon={RotateCcw}
            label="Reset"
            onClick={onReset}
            size="sm"
            title="Reset Simulation (R)"
          />
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <label className="toolbar-control-label" htmlFor="speed-slider">
            SPEED
          </label>
          <input
            id="speed-slider"
            type="range"
            min="1"
            max="12"
            step="1"
            value={simSpeed}
            onChange={(e) => setSimSpeed(parseInt(e.target.value, 10))}
            className="toolbar-range-input"
          />
          <span className="toolbar-value-pill mono-num">{simSpeed}×</span>
        </div>

        <div className="toolbar-group">
          <label className="toolbar-control-label" htmlFor="drone-count-input">
            DRONES
          </label>
          <input
            id="drone-count-input"
            type="number"
            min="2"
            max="60"
            value={droneCount}
            onChange={(e) => {
              const count = Math.max(2, parseInt(e.target.value, 10) || 2);
              setDroneCount(count);
              onReset();
            }}
            className="toolbar-number-input mono-num"
          />
        </div>

        <div className="toolbar-group">
          <label className="toolbar-control-label" htmlFor="scenario-select">
            SCENARIO
          </label>
          <select
            id="scenario-select"
            value={scenario}
            onChange={(e) => {
              setScenario(e.target.value);
              onReset();
            }}
            className="toolbar-select-input"
          >
            <option value="disaster-zone">Disaster Zone (5 Survivors)</option>
            <option value="mass-casualty">Mass Casualty (8 Survivors)</option>
            <option value="catastrophe">Mega Catastrophe (12 Survivors)</option>
            <option value="multi-survivor">Multi-Survivor (2 Targets)</option>
            <option value="simple">Single Survivor (1 Target)</option>
          </select>
        </div>
      </div>

      {/* ─── ROW 2: Toggles, Cyber-Defense & Integrations ─────────────────── */}
      <div className="toolbar-row toolbar-row-secondary">
        {/* Visual Layer Toggles */}
        <div className="toolbar-group">
          <IconButton
            icon={Satellite}
            label="Satellite"
            active={modes.satellite}
            onClick={() => toggleMode('satellite')}
            size="sm"
            title="Toggle Satellite Basemap (S)"
          />
          <IconButton
            icon={CloudFog}
            label="Fog"
            active={modes.fog}
            onClick={() => toggleMode('fog')}
            size="sm"
            title="Toggle Fog of War (F)"
          />
          <IconButton
            icon={Layers}
            label="Overlay"
            active={modes.overlay}
            onClick={() => toggleMode('overlay')}
            size="sm"
            title="Toggle Zone Overlay (O)"
          />
          <IconButton
            icon={MessageSquare}
            label="Debate"
            active={modes.speech}
            onClick={() => toggleMode('speech')}
            size="sm"
            title="Toggle Speech Bubbles (C)"
          />
        </div>

        <div className="toolbar-divider" />

        {/* Cyber-Defense & Flight Ops */}
        <div className="toolbar-group">
          <IconButton
            icon={ShieldAlert}
            label="Inject Rogue"
            tone="alert"
            onClick={onInjectRogue}
            size="sm"
            title="Simulate Byzantine Compromise Drill"
          />
          <IconButton
            icon={Shield}
            label="BFT Defense"
            active={bftEnabled}
            tone={bftEnabled ? 'accent' : 'default'}
            onClick={onToggleBft}
            size="sm"
            title="Toggle Byzantine Fault Defense (B)"
          />
          <IconButton
            icon={Home}
            label="Force RTL"
            onClick={onForceRtl}
            size="sm"
            title="Command Swarm Return-To-Launch"
          />
        </div>

        <div className="toolbar-divider" />

        {/* Cloud Webhook Integrations */}
        <div className="toolbar-group">
          <a
            href="https://beeceptor.com/console/stigmericdrone"
            target="_blank"
            rel="noopener noreferrer"
            className="toolbar-link-badge"
            title="Open Beeceptor HIL Traffic Console"
          >
            <span>Beeceptor</span>
            <ExternalLink size={10} />
          </a>
          <a
            href="https://dronedsu.app.n8n.cloud"
            target="_blank"
            rel="noopener noreferrer"
            className="toolbar-link-badge"
            title="Open n8n Cloud Triage Engine"
          >
            <span>n8n Cloud</span>
            <ExternalLink size={10} />
          </a>
          <IconButton
            icon={Send}
            label="Test Webhook"
            size="sm"
            onClick={onTestN8n}
            title="Send test emergency dispatch to n8n Cloud"
          />
        </div>
      </div>
    </header>
  );
}
