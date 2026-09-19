import { useRef } from 'react';

/**
 * useRafTelemetryRefs — Bypasses React state for high-frequency telemetry counters.
 * Elements register their DOM ref here; the simulation loop writes to el.textContent directly.
 * Zero React re-renders for tick, clock, speed, and distance values.
 */
export function useRafTelemetryRefs() {
  const tickRef = useRef(null);
  const realTimeRef = useRef(null);
  const simTimeRef = useRef(null);
  const speedRef = useRef(null);
  const distRef = useRef(null);

  const updateTelemetry = ({ tick, realSec, simSec, avgSpeed, totalDist }) => {
    if (tickRef.current) {
      tickRef.current.textContent = tick.toString().padStart(6, '0');
    }
    if (realTimeRef.current) {
      const rM = Math.floor(realSec / 60).toString().padStart(2, '0');
      const rS = (realSec % 60).toString().padStart(2, '0');
      realTimeRef.current.textContent = `${rM}:${rS}`;
    }
    if (simTimeRef.current) {
      const sM = Math.floor(simSec / 60).toString().padStart(2, '0');
      const sS = (simSec % 60).toString().padStart(2, '0');
      simTimeRef.current.textContent = `${sM}:${sS}`;
    }
    if (speedRef.current) {
      speedRef.current.textContent = `${(avgSpeed || 0).toFixed(1)} m/s`;
    }
    if (distRef.current) {
      distRef.current.textContent = totalDist >= 1000
        ? `${(totalDist / 1000).toFixed(2)} km`
        : `${Math.round(totalDist || 0)} m`;
    }
  };

  return {
    tickRef,
    realTimeRef,
    simTimeRef,
    speedRef,
    distRef,
    updateTelemetry,
  };
}
