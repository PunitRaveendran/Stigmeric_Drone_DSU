import React from 'react';
import { ShieldAlert, ShieldCheck, AlertTriangle, CheckCircle2, Radio } from 'lucide-react';
import { useSimStore } from '../store/simStore.js';
import { Badge } from '../ui/Badge.jsx';

export function AlertSlot({ onNeutralizeRogue }) {
  const alert = useSimStore((s) => s.alert);
  const rogueCount = useSimStore((s) => s.rogueCount);
  const quarantinedCount = useSimStore((s) => s.quarantinedCount);
  const attacksBlocked = useSimStore((s) => s.attacksBlocked);
  const bftQuorumSafe = useSimStore((s) => s.bftQuorumSafe);
  const bftEnabled = useSimStore((s) => s.bftEnabled);

  // If no active alerts and no rogue activity, takes zero space (§3)
  if (!alert && rogueCount === 0 && quarantinedCount === 0) {
    return null;
  }

  // Rogue Byzantine attack alert gets highest visual priority
  if (rogueCount > 0 || quarantinedCount > 0) {
    return (
      <div className="alert-slot alert-slot-danger">
        <div className="alert-slot-header">
          <ShieldAlert size={16} className="alert-icon" />
          <strong className="alert-title">
            {quarantinedCount > 0 ? 'BFT QUARANTINE ACTIVE' : 'BYZANTINE INTRUSION DETECTED'}
          </strong>
          <Badge tone={bftQuorumSafe ? 'accent' : 'alert'} variant="solid">
            {bftQuorumSafe ? '>2/3 QUORUM' : '<2/3 RISK'}
          </Badge>
        </div>

        <p className="alert-desc">
          {quarantinedCount > 0
            ? `${quarantinedCount} rogue agent(s) isolated from mesh consensus.`
            : `${rogueCount} rogue drone(s) broadcasting falsified telemetry.`}
        </p>

        <div className="alert-meta-grid">
          <div className="alert-meta-item">
            <span className="meta-label">BLOCKED:</span>
            <strong className="meta-val mono-num">{attacksBlocked}</strong>
          </div>
          <div className="alert-meta-item">
            <span className="meta-label">ISOLATED:</span>
            <strong className="meta-val mono-num">{quarantinedCount}</strong>
          </div>
          <div className="alert-meta-item">
            <span className="meta-label">DEFENSE:</span>
            <strong className="meta-val">{bftEnabled ? 'ACTIVE' : 'OFF'}</strong>
          </div>
        </div>

        {rogueCount > 0 && onNeutralizeRogue && (
          <button
            type="button"
            className="alert-action-btn"
            onClick={onNeutralizeRogue}
          >
            <ShieldCheck size={14} />
            <span>Neutralize Rogue Agents</span>
          </button>
        )}
      </div>
    );
  }

  // General alert fallback
  const Icon = alert.tone === 'alert' ? AlertTriangle
             : alert.tone === 'warning' ? Radio
             : CheckCircle2;

  return (
    <div className={`alert-slot alert-slot-${alert.tone || 'info'}`}>
      <div className="alert-slot-header">
        <Icon size={16} className="alert-icon" />
        <strong className="alert-title">{alert.title}</strong>
      </div>
      {alert.desc && <p className="alert-desc">{alert.desc}</p>}
    </div>
  );
}
