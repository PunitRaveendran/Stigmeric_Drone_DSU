import React from 'react';
import {
  Users,
  Target,
  Battery,
  Shield,
  Radio,
  Compass,
  ArrowLeft,
  X,
  Gauge as GaugeIcon,
  Activity,
  Zap,
} from 'lucide-react';
import { useSimStore } from '../store/simStore.js';
import { Badge } from '../ui/Badge.jsx';
import { Gauge } from '../ui/Gauge.jsx';
import { Metric } from '../ui/Metric.jsx';

export function RightDossierRail({ onSelectDrone, onSelectSurvivor }) {
  const rightRailTab = useSimStore((s) => s.rightRailTab);
  const setRightRailTab = useSimStore((s) => s.setRightRailTab);
  const survivorTargets = useSimStore((s) => s.survivorTargets);
  const dronesList = useSimStore((s) => s.dronesList);

  const selectedEntity = useSimStore((s) => s.selectedEntity);
  const selectedDrone = useSimStore((s) => s.selectedDroneDetail);
  const selectedSurvivor = useSimStore((s) => s.selectedSurvivorDetail);
  const setSelectedEntity = useSimStore((s) => s.setSelectedEntity);

  const handleBackToRoster = () => {
    setSelectedEntity(null);
    if (onSelectDrone) onSelectDrone(null);
  };

  return (
    <aside className="right-dossier-rail" aria-label="Mission Roster & Telemetry">
      {/* ─── Case 1: Deep-Dive Entity Inspector (When drone/survivor selected) */}
      {selectedEntity ? (
        <div className="dossier-inspector-view">
          <div className="dossier-nav-header">
            <button
              type="button"
              className="dossier-back-btn"
              onClick={handleBackToRoster}
              title="Return to fleet roster"
            >
              <ArrowLeft size={13} />
              <span>ROSTER</span>
            </button>
            <span className="dossier-nav-title">
              {selectedEntity.type === 'drone' ? 'DRONE DOSSIER' : 'CASUALTY DOSSIER'}
            </span>
            <button
              type="button"
              className="dossier-close-btn"
              onClick={handleBackToRoster}
              title="Close inspection"
            >
              <X size={14} />
            </button>
          </div>

          {/* Drone Details */}
          {selectedEntity.type === 'drone' && selectedDrone && (
            <div className="dossier-scroll-pane">
              <div className="dossier-entity-card">
                <div className="dossier-title-row">
                  <div>
                    <h3 className="dossier-callsign">{selectedDrone.callsign}</h3>
                    <span className="dossier-id mono-num">NODE #{selectedDrone.id.toString().padStart(2, '0')}</span>
                  </div>
                  <div className="dossier-badges">
                    {selectedDrone.isQuarantined ? (
                      <Badge tone="quarantine" variant="solid">QUARANTINED</Badge>
                    ) : selectedDrone.isRogue ? (
                      <Badge tone="alert" variant="solid">ROGUE</Badge>
                    ) : null}
                    <Badge tone="default">{selectedDrone.role}</Badge>
                    <Badge tone={selectedDrone.decisionMode === 'STIGMERGIC' ? 'warning' : 'success'}>
                      {selectedDrone.decisionMode === 'STIGMERGIC' ? 'STIG' : 'MESH'}
                    </Badge>
                  </div>
                </div>

                {/* Battery & Power */}
                <div className="dossier-section">
                  <div className="dossier-sec-header">
                    <span className="sec-label">POWER SUBSYSTEM</span>
                    <span className="mono-num font-semibold">{selectedDrone.battery}%</span>
                  </div>
                  <Gauge
                    value={selectedDrone.battery}
                    tone={selectedDrone.battery > 50 ? 'success' : selectedDrone.battery > 20 ? 'warning' : 'alert'}
                    height={6}
                  />
                  <div className="dossier-subline mt-1">
                    <span>ALTITUDE: <strong className="mono-num">{selectedDrone.altitude}m AGL</strong></span>
                    <span>REGIME: <strong className="mono-num">{selectedDrone.regime}</strong></span>
                  </div>
                </div>

                {/* Spatial Position */}
                <div className="dossier-section">
                  <div className="dossier-sec-header">
                    <span className="sec-label">SECTOR COORDINATES</span>
                    <span className="mono-num font-semibold">[{selectedDrone.col}, {selectedDrone.row}]</span>
                  </div>
                  <div className="stat-grid-2x mt-1">
                    <Metric
                      label="SUB-CELL (X,Y)"
                      value={`(${selectedDrone.x.toFixed(1)}, ${selectedDrone.y.toFixed(1)})`}
                      tone="default"
                    />
                    <Metric
                      label="PEER TRUST"
                      value={`${selectedDrone.trust}%`}
                      tone={selectedDrone.trust > 70 ? 'success' : selectedDrone.trust > 40 ? 'warning' : 'alert'}
                    />
                  </div>
                </div>

                {/* Kinematics */}
                <div className="dossier-section">
                  <div className="dossier-sec-header">
                    <span className="sec-label">FLIGHT KINEMATICS</span>
                  </div>
                  <div className="stat-grid-2x mt-1">
                    <Metric
                      label="GROUND SPEED"
                      value={`${selectedDrone.currentSpeed.toFixed(1)} m/s`}
                      tone="accent"
                    />
                    <Metric
                      label="TOTAL DISTANCE"
                      value={`${Math.round(selectedDrone.totalDistance)} m`}
                      tone="default"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Survivor Details */}
          {selectedEntity.type === 'survivor' && selectedSurvivor && (
            <div className="dossier-scroll-pane">
              <div className="dossier-entity-card">
                <div className="dossier-title-row">
                  <div>
                    <h3 className="dossier-callsign">{selectedSurvivor.name}</h3>
                    <span className="dossier-id mono-num">SECTOR [{selectedSurvivor.col}, {selectedSurvivor.row}]</span>
                  </div>
                  <Badge
                    tone={
                      selectedSurvivor.status === 'EXTRACTED' ? 'success' :
                      selectedSurvivor.status === 'RESCUE_DISPATCH' ? 'alert' :
                      selectedSurvivor.status === 'CONVERGING' ? 'warning' : 'default'
                    }
                    variant="solid"
                  >
                    {selectedSurvivor.status}
                  </Badge>
                </div>

                <div className="dossier-section">
                  <div className="dossier-sec-header">
                    <span className="sec-label">CONSENSUS CONFIDENCE</span>
                    <span className="mono-num font-semibold">
                      {(selectedSurvivor.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Gauge
                    value={Math.round(selectedSurvivor.confidence * 100)}
                    tone={selectedSurvivor.confidence >= 0.68 ? 'alert' : selectedSurvivor.confidence >= 0.30 ? 'warning' : 'accent'}
                    height={6}
                  />
                  <div className="dossier-subline mt-1">
                    <span>VITALS: <strong className="mono-num">{selectedSurvivor.vitals || 'DETECTED'}</strong></span>
                    <span>STATUS: <strong className="mono-num">{selectedSurvivor.status}</strong></span>
                  </div>
                </div>

                <div className="dossier-section">
                  <div className="dossier-sec-header">
                    <span className="sec-label">VERIFICATION PIPELINE</span>
                  </div>
                  <div className="verification-steps mt-1">
                    <div className="verif-step is-complete">
                      <span className="verif-dot" />
                      <span>PINN Thermal Diffusion Filter Passed</span>
                    </div>
                    <div className={`verif-step ${selectedSurvivor.confidence >= 0.30 ? 'is-complete' : ''}`}>
                      <span className="verif-dot" />
                      <span>Tri-Modal Audio/Visual Signal Detected</span>
                    </div>
                    <div className={`verif-step ${selectedSurvivor.confidence >= 0.68 ? 'is-complete' : ''}`}>
                      <span className="verif-dot" />
                      <span>Byzantine-Safe Swarm Consensus Locked</span>
                    </div>
                    <div className={`verif-step ${selectedSurvivor.status === 'EXTRACTED' ? 'is-complete' : ''}`}>
                      <span className="verif-dot" />
                      <span>Ground Medic Dispatch Completed</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ─── Case 2: Full Rosters (Survivors or Fleet Drones) ─────────────── */
        <div className="dossier-roster-view">
          {/* Tab Selector Buttons */}
          <div className="dossier-tab-bar">
            <button
              type="button"
              className={`dossier-tab-btn ${rightRailTab === 'survivors' ? 'is-active' : ''}`}
              onClick={() => setRightRailTab('survivors')}
            >
              <Target size={13} />
              <span>SURVIVORS ({survivorTargets.length})</span>
            </button>
            <button
              type="button"
              className={`dossier-tab-btn ${rightRailTab === 'drones' ? 'is-active' : ''}`}
              onClick={() => setRightRailTab('drones')}
            >
              <Radio size={13} />
              <span>FLEET ({dronesList.length})</span>
            </button>
          </div>

          {/* Tab Content 1: Survivors Roster */}
          {rightRailTab === 'survivors' && (
            <div className="dossier-scroll-pane">
              {survivorTargets.length === 0 ? (
                <div className="dossier-empty">No casualty signals registered in this sector.</div>
              ) : (
                <div className="dossier-items-list">
                  {survivorTargets.map((s, idx) => {
                    const confPct = Math.round((s.confidence || 0) * 100);
                    const statusTone = s.status === 'EXTRACTED' ? 'success'
                                     : s.status === 'RESCUE_DISPATCH' ? 'alert'
                                     : s.status === 'CONVERGING' ? 'warning'
                                     : 'default';

                    return (
                      <div
                        key={s.id !== undefined ? s.id : idx}
                        className={`dossier-card ${s.status === 'EXTRACTED' ? 'is-extracted' : ''}`}
                        onClick={() => {
                          setSelectedEntity('survivor', s.id !== undefined ? s.id : idx);
                          if (onSelectSurvivor) onSelectSurvivor(s.id !== undefined ? s.id : idx);
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="dossier-card-head">
                          <div className="dossier-card-name-row">
                            <span className="dossier-card-icon">🎯</span>
                            <span className="dossier-card-name">{s.name || `SURVIVOR-${idx + 1}`}</span>
                          </div>
                          <Badge tone={statusTone} variant={s.status === 'EXTRACTED' ? 'solid' : 'outline'}>
                            {s.status}
                          </Badge>
                        </div>

                        <div className="dossier-card-body">
                          <div className="dossier-meta-line">
                            <span>SECTOR: <strong className="mono-num">[{s.col}, {s.row}]</strong></span>
                            <span>CONFIDENCE: <strong className="mono-num font-semibold">{confPct}%</strong></span>
                          </div>
                          <Gauge
                            value={confPct}
                            tone={confPct >= 68 ? 'alert' : confPct >= 30 ? 'warning' : 'accent'}
                            height={4}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab Content 2: Drone Fleet Telemetry Roster */}
          {rightRailTab === 'drones' && (
            <div className="dossier-scroll-pane">
              {dronesList.length === 0 ? (
                <div className="dossier-empty">No active telemetry received from swarm nodes.</div>
              ) : (
                <div className="dossier-items-list">
                  {dronesList.map((d) => {
                    const batteryTone = d.battery > 50 ? 'success' : d.battery > 20 ? 'warning' : 'alert';
                    const trustTone = d.trust > 70 ? 'success' : d.trust > 40 ? 'warning' : 'alert';

                    return (
                      <div
                        key={d.id}
                        className={`dossier-card ${d.isRogue ? 'is-rogue' : ''} ${d.isQuarantined ? 'is-quarantined' : ''}`}
                        onClick={() => {
                          setSelectedEntity('drone', d.id);
                          if (onSelectDrone) onSelectDrone(d.id);
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="dossier-card-head">
                          <div className="dossier-card-name-row">
                            <span className="dossier-drone-dot" />
                            <span className="dossier-card-name font-semibold">{d.callsign}</span>
                          </div>
                          <div className="dossier-card-badges">
                            {d.isQuarantined ? (
                              <Badge tone="quarantine">QUARANTINED</Badge>
                            ) : d.isRogue ? (
                              <Badge tone="alert">ROGUE</Badge>
                            ) : (
                              <Badge tone="default">{d.role}</Badge>
                            )}
                          </div>
                        </div>

                        <div className="dossier-card-body">
                          {/* Battery row */}
                          <div className="dossier-telemetry-row">
                            <div className="telemetry-item">
                              <span className="item-label">BATT</span>
                              <span className="item-val mono-num font-semibold">{d.battery}%</span>
                            </div>
                            <div className="telemetry-gauge-col">
                              <Gauge value={d.battery} tone={batteryTone} height={4} />
                            </div>
                            <div className="telemetry-item">
                              <span className="item-label">TRUST</span>
                              <span className="item-val mono-num font-semibold">{d.trust}%</span>
                            </div>
                          </div>

                          {/* Coords & Speed row */}
                          <div className="dossier-sub-metrics">
                            <span>POS: <strong className="mono-num">[{d.col},{d.row}]</strong></span>
                            <span>ALT: <strong className="mono-num">{d.altitude}m</strong></span>
                            <span>SPD: <strong className="mono-num">{d.currentSpeed.toFixed(1)}m/s</strong></span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
