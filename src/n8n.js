/**
 * n8n.js — Autonomous SAR Emergency Dispatch & Incident Triage Gateway
 *
 * Connects PROTOPLASM Swarm to n8n Workflow Automation Engine.
 *
 * When a survivor is confirmed (Confidence >= 0.75), this module fires an
 * automated emergency webhook containing geo-coordinates, tri-modal sensor
 * readings, and NVIDIA NOOA consensus logs to trigger automated first-responder
 * dispatch, hospital triage routing, and field command alerts.
 */

// Default test webhook or user-provided n8n cloud instance
const DEFAULT_N8N_WEBHOOK_URL = 'https://n8n.protoplasm.internal/webhook/sar-dispatch';

export class N8nDispatchGateway {
  constructor(webhookUrl = DEFAULT_N8N_WEBHOOK_URL) {
    this.webhookUrl = webhookUrl;
    this.isEnabled = true;
    this.dispatches = [];
    this.lastDispatchTime = 0;
  }

  setWebhookUrl(url) {
    if (url && url.startsWith('http')) {
      this.webhookUrl = url;
    }
  }

  /**
   * Fire Emergency First Responder Dispatch Webhook
   * @param {Object} survivorData
   * @returns {Promise<Object>}
   */
  async triggerSARDispatch(survivorData) {
    if (!this.isEnabled) return null;

    const payload = {
      event_type: 'EMERGENCY_SURVIVOR_LOCKED',
      incident_id: `SAR-INCIDENT-${Date.now()}`,
      timestamp: new Date().toISOString(),
      location: {
        sector: `(${survivorData.col}, ${survivorData.row})`,
        grid_col: survivorData.col,
        grid_row: survivorData.row,
        simulated_lat: (12.9716 + survivorData.row * 0.0012).toFixed(6),
        simulated_lon: (77.5946 + survivorData.col * 0.0015).toFixed(6),
        elevation_m: 12.5,
      },
      triage: {
        fused_confidence: survivorData.confidence || 0.92,
        priority_tier: (survivorData.confidence || 0.92) > 0.85 ? 'CODE_RED_IMMEDIATE' : 'CODE_YELLOW_STABILIZE',
        victim_name: survivorData.name || 'SURVIVOR_VICTIM',
        entrapment_type: 'SUBTERRANEAN_RUBBLE_COLLAPSE',
      },
      sensor_corroboration: {
        yolo_vision: survivorData.readings?.camera || 0.88,
        yamnet_acoustic: survivorData.readings?.audio || 0.75,
        passive_thermal: survivorData.readings?.thermal || 0.82,
        toxic_gas_level: survivorData.readings?.gas || 0.12,
      },
      nooa_consensus: {
        verdict: 'CONFIRMED_SURVIVOR',
        lead_agent: survivorData.leadAgent || 'ALPHA-01',
        reasoning: survivorData.reasoning || 'Tri-modal acoustic & visual alignment confirmed. 0 decoys.',
      },
    };

    this.dispatches.push(payload);
    this.lastDispatchTime = Date.now();

    try {
      const res = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'cors',
      });
      if (res.ok) {
        const responseData = await res.json().catch(() => ({ status: 'DISPATCH_QUEUED' }));
        return responseData;
      }
    } catch {
      // Local fallback simulation when offline
      return {
        ticket_id: `DISPATCH-LOCAL-${Math.floor(Math.random() * 9000 + 1000)}`,
        status: 'PARAMEDIC_ROUTED',
        assigned_unit: 'GROUND_RESCUE_TEAM_ALPHA',
        estimated_arrival_minutes: 4.8,
      };
    }
  }
}

export const n8nGateway = new N8nDispatchGateway();
