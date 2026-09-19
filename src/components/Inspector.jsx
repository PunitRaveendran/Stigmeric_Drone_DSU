import React from 'react';
import {
  X,
  Battery,
  Navigation,
  Shield,
  Radio,
  Gauge as GaugeIcon,
  Compass,
  Zap,
} from 'lucide-react';
import { useSimStore } from '../store/simStore.js';
import { Badge } from '../ui/Badge.jsx';
import { Gauge } from '../ui/Gauge.jsx';
import { Metric } from '../ui/Metric.jsx';

export function Inspector({ onClose }) {
  const selectedEntity = useSimStore((s) => s.selectedEntity);
  const drone = useSimStore((s) => s.selectedDroneDetail);
  const survivor = useSimStore((s) => s.selectedSurvivorDetail);

  if (!selectedEntity) return null;

  return (
    <aside className="inspector-panel" aria-label="Entity Inspector">
      <div className="inspector-header">
        <span className="inspector-badge">INSPECTOR</span>
        <button
          type="button"
          className="inspector-close-btn"
          onClick={onClose}
          title="Close Inspector (Esc)"
          aria-label="Close"
        >
          <X size={15} />
        </button>
      </div>

      {/* ─── Drone Dossier ──────────────────────────────────────────────── */}
      {selectedEntity.type === 'drone' && drone && (
        <div className="inspector-body">
          <div className="dossier-title-row">
            <div>
              <h3 className="dossier-callsign">{drone.callsign}</h3>
              <span className="dossier-id mono-num">ID #{drone.id.toString().padStart(2, '0')}</span>
            </div>
            <div className="dossier-badges">
              {drone.isQuarantined ? (
                <Badge tone="quarantine" variant="solid">QUARANTINED</Badge>
              ) : drone.isRogue ? (
                <Badge tone="alert" variant="solid">ROGUE</Badge>
              ) : null}
              <Badge tone="default">{drone.role}</Badge>
              <Badge tone={drone.decisionMode === 'STIGMERGIC' ? 'warning' : 'success'}>
                {drone.decisionMode === 'STIGMERGIC' ? 'STIG' : 'FULL MESH'}
              </Badge>
            </div>
          </div>

          {/* Battery & Altitude */}
          <div className="dossier-section">
            <div className="dossier-sec-header">
              <span className="sec-label">POWER & ELEVATION</span>
              <span className="mono-num font-semibold">{drone.battery}%</span>
            </div>
            <Gauge
              value={drone.battery}
              tone={drone.battery > 50 ? 'success' : drone.battery > 20 ? 'warning' : 'alert'}
              height={5}
            />
            <div className="dossier-subline mt-1">
              <span>ALTITUDE: <strong className="mono-num">{drone.altitude}m AGL</strong></span>
              <span>STATE: <strong className="mono-num">{drone.regime}</strong></span>
            </div>
          </div>

          {/* Spatial Coordinates */}
          <div className="dossier-section">
            <div className="dossier-sec-header">
              <span className="sec-label">SPATIAL POSITION</span>
              <span className="mono-num font-semibold">[{drone.col}, {drone.row}]</span>
            </div>
            <div className="stat-grid-2x mt-1">
              <Metric
                label="SUB-CELL COORDS"
                value={`(${drone.x.toFixed(1)}, ${drone.y.toFixed(1)})`}
                tone="default"
              />
              <Metric
                label="PEER TRUST"
                value={`${drone.trust}%`}
                tone={drone.trust > 70 ? 'success' : drone.trust > 40 ? 'warning' : 'alert'}
              />
            </div>
          </div>

          {/* Flight Dynamics */}
          <div className="dossier-section">
            <div className="dossier-sec-header">
              <span className="sec-label">FLIGHT DYNAMICS</span>
            </div>
            <div className="stat-grid-3x mt-1">
              <Metric label="SPEED" value={drone.currentSpeed.toFixed(1)} unit="m/s" tone="default" />
              <Metric label="DISTANCE" value={Math.round(drone.totalDistance)} unit="m" tone="default" />
              <Metric label="TO BASE" value={Math.round(drone.distanceToBase)} unit="m" tone="default" />
            </div>
          </div>
        </div>
      )}

      {/* ─── Survivor Target Dossier ────────────────────────────────────── */}
      {selectedEntity.type === 'survivor' && survivor && (
        <div className="inspector-body">
          <div className="dossier-title-row">
            <div>
              <h3 className="dossier-callsign">{survivor.name}</h3>
              <span className="dossier-id mono-num">{survivor.sector || 'DISASTER SECTOR'}</span>
            </div>
            <Badge
              tone={
                survivor.status === 'EXTRACTED' ? 'success'
                : survivor.status === 'RESCUE_DISPATCH' ? 'alert'
                : survivor.status === 'CONVERGING' ? 'warning'
                : 'default'
              }
              variant="solid"
            >
              {survivor.status}
            </Badge>
          </div>

          {/* Confidence Meter */}
          <div className="dossier-section">
            <div className="dossier-sec-header">
              <span className="sec-label">AI RECOGNITION CONFIDENCE</span>
              <span className="mono-num font-semibold">
                {Math.round((survivor.confidence || 0) * 100)}%
              </span>
            </div>
            <Gauge
              value={(survivor.confidence || 0) * 100}
              tone={
                survivor.status === 'EXTRACTED' ? 'success'
                : survivor.status === 'RESCUE_DISPATCH' ? 'alert'
                : 'accent'
              }
              height={5}
            />
          </div>

          {/* Target Location */}
          <div className="dossier-section">
            <div className="dossier-sec-header">
              <span className="sec-label">TARGET GRID SECTOR</span>
              <span className="mono-num font-semibold">[{survivor.col}, {survivor.row}]</span>
            </div>
            <div className="stat-grid-2x mt-1">
              <Metric label="COLUMN" value={survivor.col} tone="default" />
              <Metric label="ROW" value={survivor.row} tone="default" />
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
