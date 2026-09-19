import React from 'react';
import {
  Activity,
  Radio,
  Users,
  Target,
  Shield,
  Layers,
  Clock,
  Zap,
} from 'lucide-react';
import { useSimStore } from '../store/simStore.js';
import { StatCard } from '../ui/StatCard.jsx';
import { Metric } from '../ui/Metric.jsx';
import { Badge } from '../ui/Badge.jsx';
import { Gauge } from '../ui/Gauge.jsx';
import { AlertSlot } from './AlertSlot.jsx';

const PHASE_STEPS = [
  { key: 'SPREAD', label: 'SPREAD', step: 1 },
  { key: 'CONVERGE', label: 'CONVERGE', step: 2 },
  { key: 'SOLIDIFY', label: 'RESCUE', step: 3 },
  { key: 'RESCUED', label: 'RTL', step: 4 },
];

export function StatusRail({ telemetryRefs, onNeutralizeRogue }) {
  const dominantRegime = useSimStore((s) => s.dominantRegime);
  const certainty = useSimStore((s) => s.certainty);
  const survivorsFound = useSimStore((s) => s.survivorsFound);
  const survivorsTotal = useSimStore((s) => s.survivorsTotal);
  const survivorsExtracted = useSimStore((s) => s.survivorsExtracted);
  const mapExploredPct = useSimStore((s) => s.mapExploredPct);
  const fleetActive = useSimStore((s) => s.fleetActive);
  const fleetRelays = useSimStore((s) => s.fleetRelays);
  const fleetSentinels = useSimStore((s) => s.fleetSentinels);
  const fleetDegraded = useSimStore((s) => s.fleetDegraded);
  const linkQualityPct = useSimStore((s) => s.linkQualityPct);
  const falsePositives = useSimStore((s) => s.falsePositives);

  const pctSecured = Math.round((survivorsExtracted / Math.max(1, survivorsTotal)) * 100);

  const regimeTone = dominantRegime === 'RESCUED' ? 'success'
                   : dominantRegime === 'SOLIDIFY' ? 'alert'
                   : dominantRegime === 'CONVERGE' ? 'warning'
                   : 'accent';

  const currentPhaseIndex = PHASE_STEPS.findIndex((p) => p.key === dominantRegime);

  return (
    <aside className="status-rail">
      {/* ─── Live Mission Telemetry Card (Decoupled RAF Direct DOM) ──────── */}
      <StatCard
        title="Flight Telemetry"
        icon={<Clock size={13} />}
        badge={<Badge tone="accent" variant="outline">LIVE</Badge>}
      >
        <div className="telem-grid-2x">
          <div className="telem-stat-box">
            <span className="telem-lbl">REAL TIME</span>
            <span ref={telemetryRefs?.realTimeRef} className="telem-val mono-num">00:00</span>
          </div>
          <div className="telem-stat-box">
            <span className="telem-lbl">SIM TIME</span>
            <span ref={telemetryRefs?.simTimeRef} className="telem-val mono-num">00:00</span>
          </div>
          <div className="telem-stat-box">
            <span className="telem-lbl">SIM TICK</span>
            <span ref={telemetryRefs?.tickRef} className="telem-val mono-num">000000</span>
          </div>
          <div className="telem-stat-box">
            <span className="telem-lbl">AVG SPEED</span>
            <span ref={telemetryRefs?.speedRef} className="telem-val mono-num">0.0 m/s</span>
          </div>
        </div>
        <div className="telem-stat-full mt-1">
          <span className="telem-lbl">TOTAL DISTANCE</span>
          <span ref={telemetryRefs?.distRef} className="telem-val mono-num">0 m</span>
        </div>
        {falsePositives > 0 && (
          <div className="telem-fp-row mt-1">
            <span className="telem-lbl">FP BLOCKED:</span>
            <Badge tone="accent">{falsePositives} DECOYS</Badge>
          </div>
        )}
      </StatCard>

      {/* ─── Mission Phase Stepper ────────────────────────────────────────── */}
      <StatCard
        title="Mission Phase"
        badge={<Badge tone={regimeTone} variant="outline">{dominantRegime}</Badge>}
      >
        <div className="phase-stepper-track">
          {PHASE_STEPS.map((step, idx) => {
            const isDone = idx < currentPhaseIndex;
            const isCurrent = idx === currentPhaseIndex;
            const stepClass = isDone ? 'is-done' : isCurrent ? 'is-current' : '';
            return (
              <div key={step.key} className={`phase-step-node ${stepClass}`}>
                <div className="step-indicator" />
                <span className="step-label">{step.label}</span>
              </div>
            );
          })}
        </div>
      </StatCard>

      {/* ─── Survivors Secured & Ground Truth ─────────────────────────────── */}
      <StatCard
        title="Casualty Status"
        badge={
          <Badge tone={survivorsExtracted === survivorsTotal ? 'success' : 'accent'}>
            {survivorsExtracted} / {survivorsTotal} SECURED
          </Badge>
        }
      >
        <div className="stat-grid-2x">
          <Metric label="FOUND" value={survivorsFound} tone="accent" />
          <Metric label="GROUND TRUTH" value={survivorsTotal} tone="default" />
        </div>
        <Gauge value={pctSecured} tone="success" height={4} className="mt-2" />
        <div className="metric-footnote-row">
          <span>EXTRACTED: <strong className="mono-num">{pctSecured}%</strong></span>
          <span>MAP EXPLORED: <strong className="mono-num">{mapExploredPct}%</strong></span>
        </div>
      </StatCard>

      {/* ─── Fleet Active & Degradation ───────────────────────────────────── */}
      <StatCard
        title="Fleet Status"
        badge={
          fleetDegraded > 0 ? (
            <Badge tone="warning">{fleetDegraded} STIG</Badge>
          ) : (
            <Badge tone="success">100% LINK</Badge>
          )
        }
      >
        <div className="stat-grid-3x">
          <Metric label="ACTIVE" value={fleetActive} tone="default" />
          <Metric label="RELAYS" value={fleetRelays} tone="info" />
          <Metric label="SENTINELS" value={fleetSentinels} tone="accent" />
        </div>

        <div className="status-subrow mt-2">
          <span className="subrow-label">COMMS MESH:</span>
          <Gauge value={linkQualityPct} tone="auto" height={3} className="flex-1 mx-2" />
          <span className="subrow-val mono-num">{linkQualityPct}%</span>
        </div>
      </StatCard>

      {/* ─── Rescue Certainty ─────────────────────────────────────────────── */}
      <StatCard
        title="Rescue Certainty"
        badge={<span className="mono-num font-semibold">{certainty}%</span>}
      >
        <Gauge
          value={certainty}
          thresholds={[30, 68]}
          tone={certainty >= 68 ? 'alert' : certainty >= 30 ? 'warning' : 'accent'}
          height={5}
        />
        <div className="certainty-labels-row">
          <span>SEARCH</span>
          <span>VERIFY</span>
          <span>LOCKED</span>
        </div>
      </StatCard>

      {/* ─── Conditional Alert Slot (Rogue / Battery / Comms) ──────────────── */}
      <AlertSlot onNeutralizeRogue={onNeutralizeRogue} />
    </aside>
  );
}
