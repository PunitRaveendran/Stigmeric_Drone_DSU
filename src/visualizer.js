/**
 * visualizer.js — Canvas Renderer (Phase 3 — Polished)
 *
 * Render order (back → front):
 *   1. Background + procedural noise + vignette
 *   2. Pheromone heatmap (offscreen → upscaled + bloom)
 *   3. Grid lines (optional)
 *   4. Scenario zone overlay (textured, gradient fills)
 *   5. Drone trails (smoothed, longer)
 *   6. Drone markers (directional chevron, regime glow)
 *   7. Cluster rings
 *   8. Survivor-found pulse effects
 *   9. Status banner
 *  10. Grid border
 */

import { CELL_COLORS, CELL_BORDERS } from './scenario.js';
import { SPREAD_MAX, SOLIDIFY_MIN } from './uncertainty.js';

// ─── Color palette ────────────────────────────────────────────────────────────

const PALETTE = {
  bg:            '#060a14',
  field0:        [8,   18,  55],     // deep indigo (unexplored)
  field1:        [255, 100, 20],     // warm orange (medium confidence)
  field2:        [255, 240, 160],    // bright warm white (high confidence)
  gridLine:      'rgba(255,255,255,0.025)',
  regimeSpread:   '#4cc9f0',
  regimeConverge: '#ffd60a',
  regimeSolidify: '#ff4d6d',
};

function lerpColor(c0, c1, t) {
  return [
    c0[0] + (c1[0] - c0[0]) * t,
    c0[1] + (c1[1] - c0[1]) * t,
    c0[2] + (c1[2] - c0[2]) * t,
  ];
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function rgbaStr(r, g, b, a) {
  return `rgba(${r|0}, ${g|0}, ${b|0}, ${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

// ─── Visualizer class ─────────────────────────────────────────────────────────

export class Visualizer {
  constructor(canvas, field, scenario, swarm) {
    this.canvas   = canvas;
    this.ctx      = canvas.getContext('2d');
    this.field    = field;
    this.scenario = scenario;
    this.swarm    = swarm;

    this.showScenarioOverlay = true;
    this.showFogOfWar        = true; // default: dynamic exploration mode
    this.showSatelliteMode   = true; // default: satellite aerial imagery mode
    this.showAgentComm       = true; // agent thought/speech bubbles enabled
    this.showGrid            = false;
    this.showTrails          = true;

    // Load satellite image
    this.satelliteImg = new Image();
    this.satelliteImg.src = 'satellite_bg.png';
    this.satelliteImgLoaded = false;
    this.satelliteImg.onload = () => {
      this.satelliteImgLoaded = true;
      this._satelliteCanvas = null; // invalidate cache so next render rebuilds with the actual image
      this._satelliteCanvasDirty = true;
    }; // default: agent communication display boxes ON

    this.hoveredDrone = null;
    this.selectedDroneId = null;
    this._mouseCssX   = -9999;
    this._mouseCssY   = -9999;

    this._layout = null;
    this.dpr     = window.devicePixelRatio || 1;

    // Mouse listener for drone hover telemetry
    this.canvas.addEventListener('mousemove', e => {
      const rect = this.canvas.getBoundingClientRect();
      this._mouseCssX = e.clientX - rect.left;
      this._mouseCssY = e.clientY - rect.top;
      this._updateHoveredDrone();
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.hoveredDrone = null;
      this._mouseCssX   = -9999;
      this._mouseCssY   = -9999;
    });

    // ── Offscreen heatmap canvas (4× grid resolution for smooth bilinear upscaling)
    this._heatmapScale = 4;
    this._heatmapCanvas = null;
    this._heatmapCtx    = null;

    // ── Smooth display field (lerps toward real field each frame)
    this._displayStrength = null;

    // ── Procedural noise background (generated once)
    this._noiseCanvas = null;

    // ── Survivor-found pulse effects
    this._pulseEffects = [];
    this._lastDispatchCount = 0;

    // ── Frame time for animations
    this._frameTime = 0;
  }

  resize(cssWidth, cssHeight, dpr) {
    this.dpr = dpr || window.devicePixelRatio || 1;
    this.canvas.width  = Math.round(cssWidth  * this.dpr);
    this.canvas.height = Math.round(cssHeight * this.dpr);
    this.canvas.style.width  = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
    this._layout = null;
    this._noiseCanvas = null; // regenerate on resize
    this._satelliteCanvas = null; // regenerate on resize
  }

  _getLayout() {
    if (this._layout && this._layout.cs > 0) return this._layout;
    const { cols, rows } = this.field;
    const W = this.canvas.width || 800;
    const H = this.canvas.height || 600;
    const marginPx = 16 * this.dpr;
    const availW = Math.max(10, W - marginPx * 2);
    const availH = Math.max(10, H - marginPx * 2);
    const cs = Math.max(1, Math.min(availW / cols, availH / rows));
    const ox = marginPx + (availW - cs * cols) / 2;
    const oy = marginPx + (availH - cs * rows) / 2;
    const layout = { cols, rows, cs, ox, oy };
    if (availW > 10 && availH > 10) {
      this._layout = layout;
    }
    return layout;
  }

  // ─── Main render (called every rAF frame) ─────────────────────────────────

  render(alpha = 1) {
    const { ctx, canvas } = this;
    const { cols, rows, cs, ox, oy } = this._getLayout();

    this._frameTime = performance.now() / 1000;

    // ── Check for new dispatch events → spawn pulse effects ───────────────
    this._checkDispatchEvents(cs, ox, oy);

    // ── Update smooth display field ──────────────────────────────────────
    this._updateDisplayField();

    // ── 1. Background + Satellite Imagery + Vignette ──────────────────────
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (this.showSatelliteMode) {
      this._drawSatelliteTerrain(ctx, cols, rows, cs, ox, oy);
    } else {
      this._drawNoiseBackground(ctx, canvas);
    }

    // Vignette
    const vcx = canvas.width / 2, vcy = canvas.height / 2;
    const vg = ctx.createRadialGradient(vcx, vcy, 0, vcx, vcy, Math.max(canvas.width, canvas.height) * 0.7);
    vg.addColorStop(0, 'transparent');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // ── 2. Pheromone heatmap (offscreen + bloom) ─────────────────────────
    this._drawHeatmap(ctx, cols, rows, cs, ox, oy);

    // ── 3. Grid lines (optional) ─────────────────────────────────────────
    if (this.showGrid) {
      ctx.strokeStyle = PALETTE.gridLine;
      ctx.lineWidth   = 0.5;
      ctx.beginPath();
      for (let c = 0; c <= cols; c++) {
        ctx.moveTo(ox + c * cs, oy);
        ctx.lineTo(ox + c * cs, oy + rows * cs);
      }
      for (let r = 0; r <= rows; r++) {
        ctx.moveTo(ox,           oy + r * cs);
        ctx.lineTo(ox + cols * cs, oy + r * cs);
      }
      ctx.stroke();
    }

    // ── 4. Scenario zone overlay (dynamic discovery) ─────────────────────
    if (this.showScenarioOverlay) {
      this._drawZoneOverlay(ctx, cols, rows, cs, ox, oy);
    }

    // ── 4.5. Fog of War Atmospheric Shroud ──────────────────────────────
    if (this.showFogOfWar) {
      this._drawFogOfWar(ctx, cols, rows, cs, ox, oy);
    }

    // ── 5. Drone trails ──────────────────────────────────────────────────
    if (this.showTrails) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const drone of this.swarm.drones) {
        this._drawTrail(ctx, drone, cs, ox, oy, alpha);
      }
      ctx.restore();
    }

    // ── 6. Drone markers (Chevrons & Sentinel Beacons) ───────────────────
    for (const drone of this.swarm.drones) {
      this._drawDrone(ctx, drone, cs, ox, oy, alpha);
    }

    // ── 6.1. In-Canvas Agent Communication Display Boxes & Speech Bubbles ───
    if (this.showAgentComm) {
      this._drawAgentDebateBubbles(ctx, cols, rows, cs, ox, oy, alpha);
    }

    // ── 6.5. Swarm Attention Shift Focal Line & Target Lock ──────────────
    this._drawAttentionShift(ctx, cols, rows, cs, ox, oy);

    // ── 6.6. Verifier Laser Scan Lines & RTL Base Station ─────────────────
    this._drawVerifierScanLines(ctx, cols, rows, cs, ox, oy);

    // ── 7. Cluster rings ─────────────────────────────────────────────────
    this._drawClusterRings(ctx, cs, ox, oy, alpha);

    // ── 7.5. High-Visibility Disappearing Survivor Target Icons ─────────
    this._drawSurvivorTargetIcons(ctx, cols, rows, cs, ox, oy);

    // ── 8. Survivor-found pulse effects ──────────────────────────────────
    this._drawPulseEffects(ctx);

    // ── 8.5. Interactive Drone Hover/Selected Telemetry HUD ─────────────
    const targetDrone = this.hoveredDrone || (this.selectedDroneId !== null && this.swarm ? this.swarm.drones.find(d => d.id === this.selectedDroneId) : null);
    if (targetDrone) {
      this._drawDroneTelemetryHUD(ctx, targetDrone, cs, ox, oy, alpha);
    }

    // ── 9. Status banner ─────────────────────────────────────────────────
    this._drawStatusBanner(ctx, canvas, ox, oy, cols * cs);

    // ── 10. Grid border ──────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(76,201,240,0.07)';
    ctx.lineWidth   = 1;
    ctx.strokeRect(ox, oy, cols * cs, rows * cs);
  }

  // ─── Smooth display field ─────────────────────────────────────────────────

  _updateDisplayField() {
    const n = this.field.cols * this.field.rows;
    if (!this._displayStrength || this._displayStrength.length !== n) {
      this._displayStrength = new Float32Array(n);
      // Initialize to current field values
      this._displayStrength.set(this.field.strength);
      return;
    }
    // Lerp toward real values each frame (smooth organic decay)
    const lerpRate = 0.12;
    for (let i = 0; i < n; i++) {
      this._displayStrength[i] += (this.field.strength[i] - this._displayStrength[i]) * lerpRate;
    }
  }

  // ─── Procedural noise background ──────────────────────────────────────────

  _drawNoiseBackground(ctx, canvas) {
    if (!this._noiseCanvas) {
      // Generate a small noise texture, tile it
      const nw = 128, nh = 128;
      this._noiseCanvas = document.createElement('canvas');
      this._noiseCanvas.width  = nw;
      this._noiseCanvas.height = nh;
      const nctx = this._noiseCanvas.getContext('2d');
      const imgData = nctx.createImageData(nw, nh);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = Math.random() * 18 | 0;
        d[i]     = v;
        d[i + 1] = v + (Math.random() * 4 | 0);
        d[i + 2] = v + (Math.random() * 8 | 0);
        d[i + 3] = 22;
      }
      nctx.putImageData(imgData, 0, 0);
    }
    // Tile it across the canvas
    const pat = ctx.createPattern(this._noiseCanvas, 'repeat');
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // ─── Procedural Satellite Aerial Image Renderer ───────────────────────────

  _drawSatelliteTerrain(ctx, cols, rows, cs, ox, oy) {
    const W = cols * cs;
    const H = rows * cs;

    // Cache satellite canvas at exact pixel dimensions
    if (!this._satelliteCanvas || this._satelliteCanvas.width !== Math.round(W) || this._satelliteCanvas.height !== Math.round(H)) {
      this._satelliteCanvas = document.createElement('canvas');
      this._satelliteCanvas.width  = Math.round(W);
      this._satelliteCanvas.height = Math.round(H);
      const sctx = this._satelliteCanvas.getContext('2d');

      // Draw the realistic generated satellite image
      if (this.satelliteImgLoaded && this.satelliteImg) {
        sctx.drawImage(this.satelliteImg, 0, 0, W, H);
      } else {
        // Fallback dark terrain if image hasn't loaded yet
        sctx.fillStyle = '#0b1410';
        sctx.fillRect(0, 0, W, H);
      }

      // Tactical Satellite Radar HUD Tick Marks & Telemetry Overlays
      sctx.strokeStyle = 'rgba(76, 201, 240, 0.22)';
      sctx.lineWidth = 1;
      sctx.font = `600 ${Math.max(9, cs * 0.28)}px 'Space Mono', monospace`;
      sctx.fillStyle = 'rgba(76, 201, 240, 0.45)';

      // Lat/Lon coordinate ticks along borders
      for (let c = 2; c < cols; c += 4) {
        const px = c * cs;
        sctx.beginPath();
        sctx.moveTo(px, 0); sctx.lineTo(px, 6);
        sctx.moveTo(px, H); sctx.lineTo(px, H - 6);
        sctx.stroke();
        sctx.fillText(`34°05'${10 + c}"N`, px + 2, 14);
      }
      for (let r = 2; r < rows; r += 4) {
        const py = r * cs;
        sctx.beginPath();
        sctx.moveTo(0, py); sctx.lineTo(6, py);
        sctx.moveTo(W, py); sctx.lineTo(W - 6, py);
        sctx.stroke();
        sctx.fillText(`118°24'${20 + r}"W`, 8, py - 3);
      }

      // Satellite Crosshairs in 4 corners
      const chSize = cs * 0.8;
      const corners = [
        { x: cs, y: cs },
        { x: W - cs, y: cs },
        { x: cs, y: H - cs },
        { x: W - cs, y: H - cs },
      ];
      sctx.strokeStyle = 'rgba(76, 201, 240, 0.35)';
      for (const cr of corners) {
        sctx.beginPath();
        sctx.moveTo(cr.x - chSize, cr.y); sctx.lineTo(cr.x + chSize, cr.y);
        sctx.moveTo(cr.x, cr.y - chSize); sctx.lineTo(cr.x, cr.y + chSize);
        sctx.stroke();
        sctx.beginPath();
        sctx.arc(cr.x, cr.y, Math.max(1, Math.abs(chSize * 0.5)), 0, Math.PI * 2);
        sctx.stroke();
      }

      // Satellite watermark header
      sctx.font = `700 ${Math.max(9.5, cs * 0.34)}px 'Space Mono', monospace`;
      sctx.fillStyle = 'rgba(76, 201, 240, 0.45)';
      sctx.fillText('📡 SATELLITE AERIAL RECON MODE // HIGH-RES OPTICAL FOV', cs * 0.5, H - cs * 0.4);
    }

    // Render cached satellite canvas onto main canvas
    ctx.drawImage(this._satelliteCanvas, ox, oy, W, H);
  }

  // ─── Swarm Attention Shift & Focus Target Visualizer ─────────────────────

  _drawAttentionShift(ctx, cols, rows, cs, ox, oy) {
    const activeTarget = this.swarm.stats.activeTarget;
    if (!activeTarget || activeTarget.status === 'EXTRACTED') return;

    // Target coordinates on canvas
    const tx = ox + (activeTarget.col + 0.5) * cs;
    const ty = oy + (activeTarget.row + 0.5) * cs;
    const dpr = this.dpr || 1;

    // Swarm centroid
    let sumX = 0, sumY = 0, count = 0;
    for (const d of this.swarm.drones) {
      sumX += d.x;
      sumY += d.y;
      count++;
    }
    if (count === 0) return;
    const cx = ox + (sumX / count) * cs;
    const cy = oy + (sumY / count) * cs;

    const t = this._frameTime;

    ctx.save();

    // 1. Attention Target Vector Line (dashed vector from centroid to focus target)
    ctx.strokeStyle = 'rgba(255, 214, 10, 0.65)';
    ctx.lineWidth = 1.8 * dpr;
    ctx.setLineDash([8 * dpr, 6 * dpr]);
    ctx.lineDashOffset = -t * 22 * dpr;
    ctx.shadowBlur = 10 * dpr;
    ctx.shadowColor = '#ffd60a';

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. Swarm Focus Pulse Rings around active target
    const ringR = cs * (0.75 + 0.35 * Math.sin(t * 4.5));
    ctx.strokeStyle = '#ffd60a';
    ctx.lineWidth = 2 * dpr;
    ctx.shadowBlur = 14 * dpr;
    ctx.shadowColor = '#ffd60a';
    ctx.beginPath();
    ctx.arc(tx, ty, ringR, 0, Math.PI * 2);
    ctx.stroke();

    // Corner crosshairs on focus target
    const len = cs * 0.45;
    ctx.beginPath();
    ctx.moveTo(tx - len, ty); ctx.lineTo(tx + len, ty);
    ctx.moveTo(tx, ty - len); ctx.lineTo(tx, ty + len);
    ctx.stroke();

    // 3. Floating "⚡ ACTIVE FOCUS" Badge
    ctx.font = `700 ${Math.max(9.5 * dpr, cs * 0.36)}px 'Space Mono', monospace`;
    ctx.fillStyle = '#ffd60a';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 12 * dpr;
    ctx.shadowColor = '#ffd60a';

    const pctText = `${Math.round((activeTarget.confidence || 0) * 100)}% CONF`;
    ctx.fillText(`⚡ FOCUS: ${activeTarget.name.toUpperCase()} [${pctText}]`, tx, ty + cs * 0.85);

    ctx.restore();
  }

  // ─── Verifier Laser Scan Lines & Base Station Landing Pad ────────────────

  _drawVerifierScanLines(ctx, cols, rows, cs, ox, oy) {
    const dpr = this.dpr || 1;
    const t = (performance.now() || Date.now()) * 0.001;

    // 1. Draw Base Station Landing Pad at bottom-center
    const bx = ox + (cols * 0.5) * cs;
    const by = oy + (rows * 0.85) * cs;
    ctx.save();
    ctx.strokeStyle = 'rgba(76, 201, 240, 0.45)';
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    ctx.arc(bx, by, cs * 1.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = `700 ${Math.max(9 * dpr, cs * 0.32)}px 'Space Mono', monospace`;
    ctx.fillStyle = 'rgba(76, 201, 240, 0.75)';
    ctx.textAlign = 'center';
    ctx.fillText('🚁 LAUNCH / RTL BASE', bx, by + cs * 2.2);
    ctx.restore();

    // 2. Active Sentinels Verifier Laser Scan Lines
    if (this.swarm.activeSentinels && this.swarm.activeSentinels.size > 0) {
      for (const [key, sentinelId] of this.swarm.activeSentinels.entries()) {
        const [sc, sr] = key.split(',').map(Number);
        const tx = ox + (sc + 0.5) * cs;
        const ty = oy + (sr + 0.5) * cs;

        for (const drone of this.swarm.drones) {
          const dist = Math.hypot(drone.col - sc, drone.row - sr);
          if (dist <= 3.8 && drone.id !== sentinelId) {
            const dx = ox + drone.x * cs;
            const dy = oy + drone.y * cs;

            ctx.save();
            ctx.strokeStyle = 'rgba(0, 255, 170, 0.45)';
            ctx.lineWidth = 1.2 * dpr;
            ctx.setLineDash([4 * dpr, 4 * dpr]);
            ctx.lineDashOffset = -t * 30 * dpr;
            ctx.beginPath();
            ctx.moveTo(dx, dy);
            ctx.lineTo(tx, ty);
            ctx.stroke();
            ctx.restore();
          }
        }
      }
    }
  }

  // ─── In-Canvas Agent Debate Speech Bubbles & Voting Badges ──────────────

  _drawAgentDebateBubbles(ctx, cols, rows, cs, ox, oy, alpha) {
    const dpr = this.dpr || 1;
    const currentTick = this.swarm.tick || 0;

    for (const drone of this.swarm.drones) {
      const px = ox + (lerp(drone.prevX, drone.x, alpha)) * cs;
      const py = oy + (lerp(drone.prevY, drone.y, alpha)) * cs;
      const speech = drone.lastDebateSpeech;
      const age = speech ? (currentTick - speech.tick) : 999;

      if (speech && age >= 0 && age <= 50) {
        // Render Active Debate Speech Bubble
        const opacity = Math.min(1.0, (50 - age) / 10);
        ctx.save();
        ctx.globalAlpha = opacity;

        let bg = 'rgba(0, 255, 170, 0.92)';
        let border = '#00ffaa';
        let textColor = '#051d14';
        let icon = '💬';

        if (speech.vote === 'AGREE') {
          bg = 'rgba(16, 185, 129, 0.94)'; border = '#34d399'; textColor = '#ffffff'; icon = '✅ YES';
        } else if (speech.vote === 'REJECT') {
          bg = 'rgba(239, 68, 68, 0.94)'; border = '#f87171'; textColor = '#ffffff'; icon = '❌ NO';
        } else if (speech.vote === 'PROPOSAL') {
          bg = 'rgba(245, 158, 11, 0.94)'; border = '#fbbf24'; textColor = '#000000'; icon = '📢 PROPOSAL';
        }

        const text = `${icon} ${speech.callsign}: "${speech.text}"`;
        ctx.font = `700 ${Math.max(8.5 * dpr, cs * 0.32)}px 'Space Mono', monospace`;
        const textWidth = ctx.measureText(text).width;
        const bubbleW = textWidth + 14 * dpr;
        const bubbleH = cs * 0.72;
        const bx = px - bubbleW / 2;
        const by = py - cs * 1.6;

        ctx.fillStyle = bg;
        ctx.strokeStyle = border;
        ctx.lineWidth = 1.5 * dpr;
        ctx.shadowBlur = 10 * dpr;
        ctx.shadowColor = border;

        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(bx, by, bubbleW, bubbleH, 6 * dpr);
        else ctx.rect(bx, by, bubbleW, bubbleH);
        ctx.fill(); ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(px - 4 * dpr, by + bubbleH);
        ctx.lineTo(px, by + bubbleH + 6 * dpr);
        ctx.lineTo(px + 4 * dpr, by + bubbleH);
        ctx.fill();

        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 0;
        ctx.fillText(text, px, by + bubbleH / 2);
        ctx.restore();
      } else {
        // Render Live Agent Status Box
        ctx.save();
        ctx.globalAlpha = 0.85;

        const isSentinel = drone.isSentinel;
        const isRTL = drone.regime === 'RESCUED';
        const label = isSentinel ? '📡 BEACON' : isRTL ? '🛸 RTL' : drone.regime;
        const statusText = `💬 ${drone.callsign} [${label}]`;

        ctx.font = `700 ${Math.max(7.5 * dpr, cs * 0.28)}px 'Space Mono', monospace`;
        const textWidth = ctx.measureText(statusText).width;
        const boxW = textWidth + 10 * dpr;
        const boxH = cs * 0.55;
        const bx = px - boxW / 2;
        const by = py - cs * 1.25;

        const bg = isSentinel ? 'rgba(255, 214, 10, 0.88)' : isRTL ? 'rgba(61, 220, 104, 0.88)' : 'rgba(15, 23, 42, 0.85)';
        const border = isSentinel ? '#ffd60a' : isRTL ? '#3ddc68' : 'rgba(76, 201, 240, 0.5)';
        const textClr = isSentinel ? '#000000' : isRTL ? '#000000' : '#4cc9f0';

        ctx.fillStyle = bg;
        ctx.strokeStyle = border;
        ctx.lineWidth = 1 * dpr;

        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(bx, by, boxW, boxH, 4 * dpr);
        else ctx.rect(bx, by, boxW, boxH);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = textClr;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(statusText, px, by + boxH / 2);
        ctx.restore();
      }
    }
  }

  // ─── Heatmap (offscreen canvas → upscale + bloom) ─────────────────────────

  _drawHeatmap(ctx, cols, rows, cs, ox, oy) {
    const scale = this._heatmapScale;
    const hw = cols * scale;
    const hh = rows * scale;

    // Lazily create / resize offscreen canvas
    if (!this._heatmapCanvas || this._heatmapCanvas.width !== hw || this._heatmapCanvas.height !== hh) {
      this._heatmapCanvas = document.createElement('canvas');
      this._heatmapCanvas.width  = hw;
      this._heatmapCanvas.height = hh;
      this._heatmapCtx = this._heatmapCanvas.getContext('2d');
    }

    const hctx = this._heatmapCtx;
    hctx.clearRect(0, 0, hw, hh);

    // Paint pheromone data onto the small canvas
    const imgData = hctx.createImageData(hw, hh);
    const d = imgData.data;
    const ds = this._displayStrength;

    for (let gr = 0; gr < rows; gr++) {
      for (let gc = 0; gc < cols; gc++) {
        const s = ds ? ds[gr * cols + gc] : this.field.getStrength(gc, gr);
        if (s < 0.005) continue;

        // Color from strength
        let rgb;
        if (s < 0.5) {
          rgb = lerpColor(PALETTE.field0, PALETTE.field1, s * 2);
        } else {
          rgb = lerpColor(PALETTE.field1, PALETTE.field2, (s - 0.5) * 2);
        }
        const a = Math.min(255, (0.15 + 0.85 * s) * 255) | 0;

        // Fill a scale×scale block for this grid cell
        for (let py = gr * scale; py < (gr + 1) * scale; py++) {
          for (let px = gc * scale; px < (gc + 1) * scale; px++) {
            const idx = (py * hw + px) * 4;
            d[idx]     = rgb[0] | 0;
            d[idx + 1] = rgb[1] | 0;
            d[idx + 2] = rgb[2] | 0;
            d[idx + 3] = a;
          }
        }
      }
    }
    hctx.putImageData(imgData, 0, 0);

    // Draw upscaled with bilinear interpolation (smooth gradients between cells)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this._heatmapCanvas, ox, oy, cols * cs, rows * cs);

    // Bloom pass — draw again larger and blurred for soft glow
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.filter = `blur(${Math.max(8, cs * 0.4) | 0}px)`;
    const bloomExpand = cs * 0.5;
    ctx.drawImage(
      this._heatmapCanvas,
      ox - bloomExpand, oy - bloomExpand,
      cols * cs + bloomExpand * 2, rows * cs + bloomExpand * 2
    );
    ctx.restore();

    ctx.restore();

    // Additional radial glow highlights on hot cells for extra "hero" pop
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let gr = 0; gr < rows; gr++) {
      for (let gc = 0; gc < cols; gc++) {
        const s = ds ? ds[gr * cols + gc] : this.field.getStrength(gc, gr);
        if (s < 0.25) continue; // only highlight notable cells

        const cx = ox + (gc + 0.5) * cs;
        const cy = oy + (gr + 0.5) * cs;
        const radius = cs * (0.5 + 0.5 * s);

        let rgb;
        if (s < 0.5) {
          rgb = lerpColor(PALETTE.field0, PALETTE.field1, s * 2);
        } else {
          rgb = lerpColor(PALETTE.field1, PALETTE.field2, (s - 0.5) * 2);
        }
        const r_ = rgb[0] | 0, g_ = rgb[1] | 0, b_ = rgb[2] | 0;

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        grad.addColorStop(0,   `rgba(${r_},${g_},${b_},${(0.2 + 0.4 * s).toFixed(2)})`);
        grad.addColorStop(0.5, `rgba(${r_},${g_},${b_},${(0.06 * s).toFixed(2)})`);
        grad.addColorStop(1,   'rgba(0,0,0,0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // ─── Zone overlay (textured, gradient fills) ──────────────────────────────

  _drawZoneOverlay(ctx, cols, rows, cs, ox, oy) {
    const ZONE_ICONS = {
      SURVIVOR:   '🧍',
      HOT_DEBRIS: '🔥',
      WIND_NOISE: '🌬',
      HAZARD:     '⚠',
    };

    // Gradient base colors for each zone type (top color, bottom color)
    const ZONE_GRADIENTS = {
      SURVIVOR:   { top: 'rgba(80, 240, 130, 0.32)',  bot: 'rgba(30, 160, 60, 0.42)' },
      HOT_DEBRIS: { top: 'rgba(255, 140, 40, 0.30)',  bot: 'rgba(200, 80, 10, 0.42)' },
      WIND_NOISE: { top: 'rgba(80, 180, 255, 0.30)',  bot: 'rgba(30, 100, 200, 0.42)' },
      HAZARD:     { top: 'rgba(220, 60, 240, 0.30)',  bot: 'rgba(140, 20, 180, 0.42)' },
    };

    // Animated pattern phase
    const t = this._frameTime;

    // ── Pass 0: Ruined Structural Building Walls ──────────────────────────────
    if (this.scenario.structures && this.scenario.structures.length > 0) {
      ctx.save();
      const dpr = this.dpr || 1;
      for (const str of this.scenario.structures) {
        const px = ox + str.c0 * cs;
        const py = oy + str.r0 * cs;
        const pw = (str.c1 - str.c0 + 1) * cs;
        const ph = (str.r1 - str.r0 + 1) * cs;

        // Ruined wall contour stroke
        ctx.strokeStyle = 'rgba(130, 160, 210, 0.45)';
        ctx.lineWidth = Math.max(1.5, cs * 0.05);
        ctx.setLineDash([6 * dpr, 4 * dpr]);
        ctx.strokeRect(px, py, pw, ph);
        ctx.setLineDash([]);

        // Sector label watermark
        ctx.font = `700 ${Math.max(8.5 * dpr, cs * 0.28)}px 'Space Mono', monospace`;
        ctx.fillStyle = 'rgba(140, 175, 230, 0.30)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(str.label, px + 5 * dpr, py + 5 * dpr);
      }
      ctx.restore();
    }

    // ── Pass 1: Gradient fills with subtle animated pattern per zone region ──
    // First, find zone bounding boxes for centered icon placement and gradients
    const zoneBounds = {};
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const type = this.scenario.getCellType(c, r);
        if (!CELL_COLORS[type]) continue;
        if (!zoneBounds[type]) {
          zoneBounds[type] = { minC: c, maxC: c, minR: r, maxR: r };
        } else {
          const b = zoneBounds[type];
          b.minC = Math.min(b.minC, c);
          b.maxC = Math.max(b.maxC, c);
          b.minR = Math.min(b.minR, r);
          b.maxR = Math.max(b.maxR, r);
        }
      }
    }

    // Draw gradient fills
    for (const [type, bounds] of Object.entries(zoneBounds)) {
      const gradCfg = ZONE_GRADIENTS[type];
      if (!gradCfg) continue;

      const px0 = ox + bounds.minC * cs;
      const py0 = oy + bounds.minR * cs;
      const pw  = (bounds.maxC - bounds.minC + 1) * cs;
      const ph  = (bounds.maxR - bounds.minR + 1) * cs;

      // Vertical gradient fill
      const grad = ctx.createLinearGradient(px0, py0, px0, py0 + ph);
      grad.addColorStop(0, gradCfg.top);
      grad.addColorStop(1, gradCfg.bot);

      // Fill only cells belonging to this zone
      ctx.save();
      ctx.beginPath();
      for (let r = bounds.minR; r <= bounds.maxR; r++) {
        for (let c = bounds.minC; c <= bounds.maxC; c++) {
          if (this.scenario.getCellType(c, r) === type) {
            ctx.rect(ox + c * cs, oy + r * cs, cs, cs);
          }
        }
      }
      ctx.clip();

      // Gradient base
      ctx.fillStyle = grad;
      ctx.fillRect(px0, py0, pw, ph);

      // Subtle animated pattern overlay per zone type
      ctx.globalAlpha = 0.08;
      ctx.strokeStyle = gradCfg.bot;
      ctx.lineWidth = 0.8;
      this._drawZonePattern(ctx, type, px0, py0, pw, ph, t);
      ctx.globalAlpha = 1;

      ctx.restore();
    }

    // ── Pass 2: Glowing borders on zone perimeters ──────────────────────────
    const borderW = Math.max(2, cs * 0.06);
    for (const [type, strokeColor] of Object.entries(CELL_BORDERS)) {
      ctx.save();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth   = borderW;
      ctx.shadowBlur  = cs * 0.5;
      ctx.shadowColor = strokeColor;
      ctx.beginPath();

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (this.scenario.getCellType(c, r) !== type) continue;
          const px = ox + c * cs;
          const py = oy + r * cs;
          if (this.scenario.getCellType(c,   r - 1) !== type) { ctx.moveTo(px,      py);      ctx.lineTo(px + cs, py);      }
          if (this.scenario.getCellType(c,   r + 1) !== type) { ctx.moveTo(px,      py + cs); ctx.lineTo(px + cs, py + cs); }
          if (this.scenario.getCellType(c - 1, r)   !== type) { ctx.moveTo(px,      py);      ctx.lineTo(px,      py + cs); }
          if (this.scenario.getCellType(c + 1, r)   !== type) { ctx.moveTo(px + cs, py);      ctx.lineTo(px + cs, py + cs); }
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    // ── Pass 3: Decoy Zone Icons (Hot Debris, Wind, Hazard) ─────────────────────
    const iconSizePx = Math.max(14, Math.min(24, cs * 0.7));
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    for (const [type, bounds] of Object.entries(zoneBounds)) {
      const icon = ZONE_ICONS[type];
      if (!icon || type === 'SURVIVOR') continue;

      const cx = ox + ((bounds.minC + bounds.maxC + 1) / 2) * cs;
      const cy = oy + ((bounds.minR + bounds.maxR + 1) / 2) * cs;

      // Glow backdrop circle
      ctx.save();
      const borderColor = CELL_BORDERS[type] || '#fff';
      ctx.globalAlpha = 0.15 + 0.05 * Math.sin(t * 2 + type.length);
      ctx.fillStyle = borderColor;
      ctx.shadowBlur  = cs * 0.8;
      ctx.shadowColor = borderColor;
      ctx.beginPath();
      ctx.arc(cx, cy, cs * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Icon text
      ctx.save();
      ctx.font = `${iconSizePx}px sans-serif`;
      ctx.globalAlpha = 0.9;
      ctx.fillText(icon, cx, cy);
      ctx.restore();
    }

    ctx.textAlign    = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  /**
   * Draw high-visibility individual survivor target icons ('🧍') and target HUD badges.
   * Rendered AFTER the Fog of War shroud step so icons remain 100% visible everywhere on the map.
   * Automatically DISAPPEARS when a survivor is rescued/extracted.
   */
  _drawSurvivorTargetIcons(ctx, cols, rows, cs, ox, oy) {
    if (!this.scenario.survivors || this.scenario.survivors.length === 0) return;

    const t = this._frameTime;
    const dpr = this.dpr || 1;
    const iconSizePx = Math.max(14, Math.min(24, cs * 0.7));
    const borderColor = CELL_BORDERS.SURVIVOR || '#3ddc68';

    for (const s of this.scenario.survivors) {
      const isExtracted = this.swarm.isSurvivorExtracted ? this.swarm.isSurvivorExtracted(s.col, s.row) : this.swarm.rescuedCells.has(`${s.col},${s.row}`);

      const cx = ox + (s.col + 0.5) * cs;
      const cy = oy + (s.row + 0.5) * cs;

      if (!isExtracted) {
        // 1. Glowing outer pulse halo
        const pulseR = cs * (0.65 + 0.15 * Math.sin(t * 3.5 + s.col));
        ctx.save();
        ctx.globalAlpha = 0.25 + 0.10 * Math.sin(t * 3.0 + s.col);
        ctx.fillStyle = borderColor;
        ctx.shadowBlur  = cs * 1.2;
        ctx.shadowColor = borderColor;
        ctx.beginPath();
        ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 2. Crisp target lock border ring
        ctx.save();
        ctx.strokeStyle = '#00ffaa';
        ctx.lineWidth   = 1.8 * dpr;
        ctx.shadowBlur  = 10 * dpr;
        ctx.shadowColor = '#00ffaa';
        ctx.beginPath();
        ctx.arc(cx, cy, cs * 0.60, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // 3. Standing Person Emoji ('🧍')
        ctx.save();
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `${iconSizePx}px sans-serif`;
        ctx.globalAlpha = 0.98;
        ctx.fillText('🧍', cx, cy);
        ctx.restore();
      }

      // 4. Target HUD Label (always show name, updated to [SECURED] when extracted)
      ctx.save();
      const badgeText = isExtracted ? `✅ ${s.name} [SECURED]` : `🟢 ${s.name}`;
      ctx.font = `700 ${Math.max(9 * dpr, cs * 0.36)}px 'Space Mono', monospace`;
      ctx.fillStyle = isExtracted ? '#3ddc68' : '#00ffaa';
      ctx.shadowBlur = 10 * dpr;
      ctx.shadowColor = ctx.fillStyle;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(badgeText, cx, cy - cs * 0.70);
      ctx.restore();
    }
  }

  /**
   * Draw subtle animated pattern inside a zone clip region.
   */
  _drawZonePattern(ctx, type, px, py, pw, ph, t) {
    ctx.beginPath();
    const spacing = 8;

    if (type === 'HOT_DEBRIS') {
      // Diagonal hatching (fire/heat pattern)
      for (let i = -ph; i < pw + ph; i += spacing) {
        const offset = Math.sin(t * 0.5 + i * 0.02) * 3;
        ctx.moveTo(px + i + offset, py);
        ctx.lineTo(px + i + ph + offset, py + ph);
      }
    } else if (type === 'WIND_NOISE') {
      // Horizontal wave pattern
      for (let j = 0; j < ph; j += spacing) {
        ctx.moveTo(px, py + j);
        for (let i = 0; i < pw; i += 4) {
          ctx.lineTo(px + i, py + j + Math.sin(t * 2 + i * 0.05 + j * 0.1) * 3);
        }
      }
    } else if (type === 'HAZARD') {
      // Cross-hatch (danger pattern)
      for (let i = -ph; i < pw + ph; i += spacing) {
        ctx.moveTo(px + i, py);
        ctx.lineTo(px + i + ph, py + ph);
        ctx.moveTo(px + i + ph, py);
        ctx.lineTo(px + i, py + ph);
      }
    } else if (type === 'SURVIVOR') {
      // Concentric ripples from centroid
      const cx = px + pw / 2;
      const cy = py + ph / 2;
      const maxR = Math.max(pw, ph) * 0.7;
      for (let r = 0; r < maxR; r += spacing) {
        const rippleR = r + (t * 8) % spacing;
        if (rippleR > maxR) continue;
        ctx.moveTo(cx + rippleR, cy);
        ctx.arc(cx, cy, rippleR, 0, Math.PI * 2);
      }
    }
    ctx.stroke();
  }

  // ─── Trail draw ───────────────────────────────────────────────────────────

  _drawTrail(ctx, drone, cs, ox, oy, alpha) {
    const trail = drone.trail;
    if (trail.length < 2) return;

    // Build full trail including interpolated current position
    const renderX = lerp(drone.prevX, drone.x, alpha);
    const renderY = lerp(drone.prevY, drone.y, alpha);
    const points = [...trail, { x: renderX, y: renderY }];
    const [dr, dg, db] = drone.glowRgb;

    for (let i = 1; i < points.length; i++) {
      const frac = i / points.length;
      const alpha_ = frac * frac * 0.40; // quadratic falloff
      const p = points[i - 1];
      const q = points[i];

      ctx.strokeStyle = rgbaStr(dr, dg, db, alpha_);
      ctx.lineWidth   = cs * 0.22 * frac;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(ox + p.x * cs, oy + p.y * cs);
      ctx.lineTo(ox + q.x * cs, oy + q.y * cs);
      ctx.stroke();
    }
  }

  // ─── Drone draw (directional chevron + regime glow) ───────────────────────

  // ─── Fog of War Atmospheric Shroud ───────────────────────────────────────

  _drawFogOfWar(ctx, cols, rows, cs, ox, oy) {
    if (!this.showFogOfWar) return;
    const exp = this.field.explorationGrid;
    if (!exp) return;

    ctx.save();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const explored = exp[idx];
        if (explored >= 0.96) continue; // fully revealed

        const px = ox + c * cs;
        const py = oy + r * cs;
        const alpha = Math.max(0, 0.88 * (1.0 - explored));

        ctx.fillStyle = `rgba(5, 9, 20, ${alpha.toFixed(3)})`;
        ctx.fillRect(px - 0.2, py - 0.2, cs + 0.4, cs + 0.4);
      }
    }
    ctx.restore();
  }

  // ─── Drone draw (directional chevron + regime glow + Sentinel Beacon) ───────

  _drawDrone(ctx, drone, cs, ox, oy, alpha) {
    // Interpolated position
    const rx = lerp(drone.prevX, drone.x, alpha);
    const ry = lerp(drone.prevY, drone.y, alpha);

    // Organic jitter — small noise offset based on drone ID and time
    const jt = this._frameTime;
    const jx = Math.sin(jt * 3.7 + drone.id * 2.1) * 0.03
             + Math.sin(jt * 7.3 + drone.id * 5.3) * 0.015;
    const jy = Math.cos(jt * 4.1 + drone.id * 3.7) * 0.03
             + Math.cos(jt * 6.7 + drone.id * 4.1) * 0.015;

    const px = ox + (rx + jx) * cs;
    const py = oy + (ry + jy) * cs;
    const r  = Math.max(cs * 0.28, 5);

    // Dynamic Role Indicators (Orthogonal to Regime)

    // Self-Healing Comms: STIGMERGIC mode amber warning ring
    if (drone.decisionMode === 'STIGMERGIC') {
      ctx.save();
      const stigPulse = 0.5 + 0.5 * Math.sin(jt * 5.0 + drone.id * 1.3);
      ctx.strokeStyle = '#ff9500';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.globalAlpha = 0.5 + 0.4 * stigPulse;
      ctx.beginPath();
      ctx.arc(px, py, r * (2.0 + 0.4 * stigPulse), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = `700 ${Math.max(7, cs * 0.24)}px 'Space Mono', monospace`;
      ctx.fillStyle = '#ff9500';
      ctx.textAlign = 'center';
      ctx.globalAlpha = 0.85;
      ctx.fillText('\uD83D\uDCF5 STIGMERGIC', px, py - r * 2.5);
      ctx.restore();
    }

    if (drone.role === 'RELAY') {
      ctx.save();
      const pulseRelay = 0.5 + 0.5 * Math.sin(jt * 3.0 + drone.id);
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.globalAlpha = 0.6 + 0.3 * pulseRelay;
      ctx.beginPath();
      ctx.arc(px, py, r * (1.8 + 0.3 * pulseRelay), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = `700 ${Math.max(8, cs * 0.28)}px 'Space Mono', monospace`;
      ctx.fillStyle = '#00f0ff';
      ctx.textAlign = 'center';
      ctx.fillText('\uD83D\uDCE1 RELAY', px, py - r * 2.0);
      ctx.restore();
    } else if (drone.role === 'SENTINEL') {
      ctx.save();
      ctx.strokeStyle = '#ff9e00';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, r * 1.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = `700 ${Math.max(8, cs * 0.28)}px 'Space Mono', monospace`;
      ctx.fillStyle = '#ff9e00';
      ctx.textAlign = 'center';
      ctx.fillText('\uD83D\uDD0B SENTINEL', px, py - r * 2.0);
      ctx.restore();
    } else if (drone.isSentinel) {
      // Legacy survivor lock beacon
      ctx.save();
      const waveR = cs * (0.8 + 1.2 * ((jt * 2.5) % 1));
      const waveAlpha = (1 - ((jt * 2.5) % 1)) * 0.6;
      ctx.strokeStyle = '#00ffaa';
      ctx.lineWidth   = 2;
      ctx.globalAlpha = waveAlpha;
      ctx.shadowBlur  = 12;
      ctx.shadowColor = '#00ffaa';
      ctx.beginPath();
      ctx.arc(px, py, waveR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = 0.85;
      ctx.font = `700 ${Math.max(9, cs * 0.35)}px 'Space Mono', monospace`;
      ctx.fillStyle = '#00ffaa';
      ctx.textAlign = 'center';
      ctx.fillText('\uD83C\uDFAF LOCK BEACON', px, py - r * 2.2);
      ctx.restore();
    }

    // Regime-dependent glow pulse
    let pulseFreq, pulseAmp;
    switch (drone.regime) {
      case 'SOLIDIFY':
        pulseFreq = 4.0; pulseAmp = 0.5; break;
      case 'CONVERGE':
        pulseFreq = 2.0; pulseAmp = 0.3; break;
      default:
        pulseFreq = 0.8; pulseAmp = 0.15; break;
    }
    const pulse = 1 + pulseAmp * Math.sin(jt * pulseFreq + drone.id * 0.7);
    const [dr, dg, db] = drone.glowRgb;

    ctx.save();

    // Outer glow aura (pulsing)
    const glowRadius = r * 3 * pulse;
    const grd = ctx.createRadialGradient(px, py, 0, px, py, glowRadius);
    grd.addColorStop(0,    rgbaStr(dr, dg, db, 0.35));
    grd.addColorStop(0.35, rgbaStr(dr, dg, db, 0.10 * pulse));
    grd.addColorStop(1,    'transparent');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(px, py, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // Directional chevron (rotated to heading)
    const heading = drone.heading;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(heading);

    // Shadow glow under the drone body
    ctx.shadowBlur  = r * 2.5;
    ctx.shadowColor = drone.color;

    // Chevron shape (pointing right at 0 rotation)
    ctx.fillStyle = drone.color;
    ctx.beginPath();
    ctx.moveTo(r * 1.3, 0);          // nose
    ctx.lineTo(-r * 0.7, -r * 0.8);  // top-left wing
    ctx.lineTo(-r * 0.3, 0);         // inner notch
    ctx.lineTo(-r * 0.7, r * 0.8);   // bottom-left wing
    ctx.closePath();
    ctx.fill();

    // White center highlight
    ctx.shadowBlur = 0;
    ctx.fillStyle  = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore(); // undo translate+rotate

    // Altitude Flight Layer Telemetry Tag (e.g. 15m / 25m / 35m)
    if (drone.altitude) {
      ctx.font = `600 ${Math.max(7.5, cs * 0.25)}px 'Space Mono', monospace`;
      ctx.fillStyle = 'rgba(180, 220, 255, 0.70)';
      ctx.textAlign = 'center';
      ctx.fillText(`${drone.altitude}m`, px, py + r * 1.95);
    }

    // Selected Drone Tactical Reticle Ring
    if (this.selectedDroneId === drone.id) {
      ctx.save();
      const selPulse = 1 + 0.18 * Math.sin(jt * 6);
      const ringR = r * 2.3 * selPulse;
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 2 * (this.dpr || 1);
      ctx.shadowBlur = 14 * (this.dpr || 1);
      ctx.shadowColor = '#00ffff';
      ctx.beginPath();
      ctx.arc(px, py, ringR, 0, Math.PI * 2);
      ctx.stroke();

      // Tactical bracket crosshairs
      const brLen = ringR * 0.45;
      ctx.beginPath();
      ctx.moveTo(px - ringR - brLen, py); ctx.lineTo(px - ringR + 3, py);
      ctx.moveTo(px + ringR - 3, py); ctx.lineTo(px + ringR + brLen, py);
      ctx.moveTo(px, py - ringR - brLen); ctx.lineTo(px, py - ringR + 3);
      ctx.moveTo(px, py + ringR - 3); ctx.lineTo(px, py + ringR + brLen);
      ctx.stroke();

      // Selected Tag
      ctx.font = `700 ${Math.max(8.5, cs * 0.28)}px 'Space Mono', monospace`;
      ctx.fillStyle = '#00ffff';
      ctx.textAlign = 'center';
      ctx.fillText('SELECTED', px, py - ringR - 6);
      ctx.restore();
    }

    ctx.restore(); // undo outer save
  }

  // ─── Cluster rings ────────────────────────────────────────────────────────

  _drawClusterRings(ctx, cs, ox, oy, alpha) {
    const { cols, rows } = this.field;
    const density = new Float32Array(cols * rows);
    for (const drone of this.swarm.drones) {
      const c = Math.floor(lerp(drone.prevX, drone.x, alpha));
      const r = Math.floor(lerp(drone.prevY, drone.y, alpha));
      if (c >= 0 && c < cols && r >= 0 && r < rows) {
        density[r * cols + c]++;
      }
    }

    const t = this._frameTime;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const count = density[r * cols + c];
        if (count < 2) continue;
        const px = ox + (c + 0.5) * cs;
        const py = oy + (r + 0.5) * cs;
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.1 + c * 0.7 + r * 1.1);
        const ringR = cs * (0.6 + 0.3 * pulse);
        const ringAlpha = (0.25 + 0.25 * pulse) * Math.min(1, count / 4);

        ctx.save();
        ctx.strokeStyle = `rgba(255, 214, 10, ${ringAlpha.toFixed(2)})`;
        ctx.lineWidth   = cs * 0.08;
        ctx.shadowBlur  = cs * 0.5;
        ctx.shadowColor = 'rgba(255,214,10,0.4)';
        ctx.beginPath();
        ctx.arc(px, py, ringR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // ─── Survivor-found pulse effects ─────────────────────────────────────────

  _checkDispatchEvents(cs, ox, oy) {
    const log = this.swarm.dispatchLog;
    if (log.length > this._lastDispatchCount) {
      // New dispatch events — create pulse effects for each new one
      for (let i = this._lastDispatchCount; i < log.length; i++) {
        const e = log[i];
        this._pulseEffects.push({
          cx: ox + (e.col + 0.5) * cs,
          cy: oy + (e.row + 0.5) * cs,
          startTime: this._frameTime,
          duration: 2.5,
          maxRadius: cs * 4,
          color: PALETTE.regimeSolidify,
        });
        // Add a second staggered ring
        this._pulseEffects.push({
          cx: ox + (e.col + 0.5) * cs,
          cy: oy + (e.row + 0.5) * cs,
          startTime: this._frameTime + 0.3,
          duration: 2.0,
          maxRadius: cs * 3,
          color: '#ffffff',
        });
      }
      this._lastDispatchCount = log.length;
    }
  }

  _drawPulseEffects(ctx) {
    const now = this._frameTime;
    const { cs, ox, oy } = this._getLayout();

    // Render green secured rings for rescued survivor locations
    if (this.swarm.rescuedCells && this.swarm.rescuedCells.size > 0) {
      ctx.save();
      for (const key of this.swarm.rescuedCells) {
        const [c, r] = key.split(',').map(Number);
        const cx = ox + (c + 0.5) * cs;
        const cy = oy + (r + 0.5) * cs;

        // Glowing green ring
        ctx.strokeStyle = '#3ddc68';
        ctx.lineWidth   = Math.max(2, cs * 0.08);
        ctx.shadowBlur  = cs * 0.6;
        ctx.shadowColor = '#3ddc68';
        ctx.beginPath();
        ctx.arc(cx, cy, cs * 0.7, 0, Math.PI * 2);
        ctx.stroke();

        // Checkmark icon
        ctx.font = `${Math.max(12, cs * 0.6)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✅', cx, cy);
      }
      ctx.restore();
    }

    this._pulseEffects = this._pulseEffects.filter(e => {
      const elapsed = now - e.startTime;
      if (elapsed < 0 || elapsed > e.duration) return elapsed < 0; // keep future ones, remove expired

      const progress = elapsed / e.duration;
      const radius = e.maxRadius * progress;
      const alpha = (1 - progress) * 0.6;

      ctx.save();
      ctx.strokeStyle = e.color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth   = Math.max(2, (1 - progress) * 4);
      ctx.shadowBlur  = 15;
      ctx.shadowColor = e.color;
      ctx.beginPath();
      ctx.arc(e.cx, e.cy, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Flash at the center in the first 0.3s
      if (elapsed < 0.3) {
        const flashAlpha = (1 - elapsed / 0.3) * 0.5;
        ctx.save();
        ctx.globalAlpha = flashAlpha;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(e.cx, e.cy, e.maxRadius * 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      return true;
    });
  }

  // ─── Status banner ────────────────────────────────────────────────────────

  _drawStatusBanner(ctx, canvas, ox, oy, gridW) {
    const regime  = this.swarm.stats.dominantRegime;
    const regimeCounts = this.swarm.stats.regimeCounts;
    const total   = this.swarm.drones.length || 1;

    const CONFIGS = {
      SPREAD: {
        color: '#4cc9f0',
        rgb:   [76, 201, 240],
        lines: [
          `${total} DRONES SWEEPING THE DISASTER ZONE`,
          'Depositing pheromone trails as they explore',
        ],
      },
      CONVERGE: {
        color: '#ffd60a',
        rgb:   [255, 214, 10],
        lines: [
          `SIGNALS DETECTED — ${regimeCounts.CONVERGE || 0} DRONES CONVERGING`,
          'Multiple sensors active · swarm re-verifying location',
        ],
      },
      SOLIDIFY: {
        color: '#ff4d6d',
        rgb:   [255, 77, 109],
        lines: [
          '⚡ SURVIVOR CONFIRMED — RESCUE DISPATCHED',
          'Pheromone trail locked · swarm holding position',
        ],
      },
      RESCUED: {
        color: '#3ddc68',
        rgb:   [61, 220, 104],
        lines: [
          '🟢 SURVIVOR EXTRACTED SAFELY — RESCUE COMPLETE',
          'Target secured · swarm re-deploying to patrol remaining grid',
        ],
      },
    };

    // Append comms health info to subtitle if any drones are in STIGMERGIC mode
    const commsStats = this.swarm.stats.commsStats;
    if (commsStats && commsStats.degradedCount > 0) {
      const currentCfg = CONFIGS[regime] ?? CONFIGS.SPREAD;
      currentCfg.lines[1] += ` · 📵 ${commsStats.degradedCount} drone${commsStats.degradedCount > 1 ? 's' : ''} in stigmergic fallback (avg LQ: ${commsStats.avgLinkQuality.toFixed(2)})`;
    }

    const cfg = CONFIGS[regime] ?? CONFIGS.SPREAD;
    const dpr = this.dpr || 1;

    const bannerH = Math.max(48 * dpr, 52 * dpr);
    const bx = ox;
    const by = oy - bannerH - 6 * dpr;

    if (by < 4 * dpr) return;

    ctx.save();
    const [br, bgC, bb] = cfg.rgb;
    const bg = ctx.createLinearGradient(bx, by, bx + gridW, by);
    bg.addColorStop(0,   rgbaStr(br, bgC, bb, 0.18));
    bg.addColorStop(0.5, rgbaStr(br, bgC, bb, 0.10));
    bg.addColorStop(1,   rgbaStr(br, bgC, bb, 0.04));
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(bx, by, gridW, bannerH, 6 * dpr);
    ctx.fill();

    ctx.fillStyle = cfg.color;
    ctx.shadowBlur  = 12 * dpr;
    ctx.shadowColor = cfg.color;
    ctx.fillRect(bx, by, 3 * dpr, bannerH);
    ctx.shadowBlur = 0;

    const fontSize1 = Math.max(11 * dpr, 13 * dpr);
    ctx.font = `700 ${fontSize1}px 'Outfit', sans-serif`;
    ctx.fillStyle   = cfg.color;
    ctx.shadowBlur  = 8 * dpr;
    ctx.shadowColor = cfg.color;
    ctx.textBaseline = 'top';
    ctx.fillText(cfg.lines[0], bx + 12 * dpr, by + 8 * dpr);
    ctx.shadowBlur = 0;

    const fontSize2 = Math.max(9 * dpr, 10 * dpr);
    ctx.font      = `400 ${fontSize2}px 'Outfit', sans-serif`;
    ctx.fillStyle = `rgba(200,220,255,0.55)`;
    ctx.fillText(cfg.lines[1], bx + 12 * dpr, by + 8 * dpr + fontSize1 + 4 * dpr);

    ctx.restore();
  }

  /**
   * Update which drone is currently under the mouse cursor.
   */
  _updateHoveredDrone() {
    const l = this._getLayout();
    if (!l || !this.swarm || !this.swarm.drones) return;
    const px = this._mouseCssX * this.dpr;
    const py = this._mouseCssY * this.dpr;

    let closest = null;
    let minDist = 28 * this.dpr;

    for (const drone of this.swarm.drones) {
      const dx = l.ox + drone.x * l.cs - px;
      const dy = l.oy + drone.y * l.cs - py;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        closest = drone;
      }
    }
    this.hoveredDrone = closest;
  }

  /**
   * Draw interactive floating Drone Telemetry HUD card for hovered drone.
   */
  _drawDroneTelemetryHUD(ctx, drone, cs, ox, oy, alpha) {
    const rx = lerp(drone.prevX, drone.x, alpha);
    const ry = lerp(drone.prevY, drone.y, alpha);
    const px = ox + rx * cs;
    const py = oy + ry * cs;
    const dpr = this.dpr || 1;

    ctx.save();

    // Target reticle
    const r = Math.max(cs * 0.45, 12 * dpr);
    const hudColor = drone.isSentinel ? '#00ffaa' : '#4cc9f0';
    ctx.strokeStyle = hudColor;
    ctx.lineWidth = 1.5 * dpr;
    ctx.shadowBlur = 10 * dpr;
    ctx.shadowColor = hudColor;

    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.stroke();

    // Crosshairs
    const ch = r * 0.4;
    ctx.beginPath();
    ctx.moveTo(px - r - ch, py); ctx.lineTo(px - r + 3, py);
    ctx.moveTo(px + r - 3, py); ctx.lineTo(px + r + ch, py);
    ctx.moveTo(px, py - r - ch); ctx.lineTo(px, py - 3);
    ctx.moveTo(px, py + r - 3); ctx.lineTo(px, py + r + ch);
    ctx.stroke();

    // Floating Telemetry Card
    const cardW = 216 * dpr;
    const cardH = 138 * dpr;
    let cardX = px + r + 16 * dpr;
    let cardY = py - cardH / 2;

    if (cardX + cardW > this.canvas.width - 10 * dpr) {
      cardX = px - r - 16 * dpr - cardW;
    }
    if (cardY < 10 * dpr) cardY = 10 * dpr;
    if (cardY + cardH > this.canvas.height - 10 * dpr) cardY = this.canvas.height - cardH - 10 * dpr;

    // Leader line
    ctx.strokeStyle = 'rgba(76,201,240,0.4)';
    ctx.lineWidth = 1 * dpr;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(cardX > px ? cardX : cardX + cardW, cardY + cardH / 2);
    ctx.stroke();

    // Card Glass Background
    ctx.fillStyle = 'rgba(8, 14, 32, 0.94)';
    ctx.shadowBlur = 16 * dpr;
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 6 * dpr);
    ctx.fill();

    ctx.strokeStyle = drone.isSentinel ? 'rgba(0,255,170,0.6)' : (this.selectedDroneId === drone.id ? '#00ffff' : 'rgba(76,201,240,0.3)');
    ctx.lineWidth = (this.selectedDroneId === drone.id ? 1.5 : 1) * dpr;
    ctx.stroke();

    // Text Content
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Header with callsign
    ctx.font = `700 ${10 * dpr}px 'Space Mono', monospace`;
    ctx.fillStyle = hudColor;
    const headerTag = drone.callsign ? `DRONE ${drone.callsign} [#${drone.id}]` : `DRONE #${drone.id.toString().padStart(2, '0')}`;
    ctx.fillText(`${headerTag} // TELEMETRY`, cardX + 10 * dpr, cardY + 8 * dpr);

    // Dual-Axis: Role & Regime
    ctx.font = `600 ${9 * dpr}px 'Outfit', sans-serif`;
    ctx.fillStyle = '#ffffff';
    const roleColor = drone.role === 'RELAY' ? '#00f0ff' : drone.role === 'SENTINEL' ? '#ff9e00' : '#4cc9f0';
    ctx.fillText(`ROLE: `, cardX + 10 * dpr, cardY + 23 * dpr);
    ctx.fillStyle = roleColor;
    ctx.fillText(`${drone.role || 'SCOUT'}`, cardX + 44 * dpr, cardY + 23 * dpr);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(`REGIME: ${drone.regime}`, cardX + 106 * dpr, cardY + 23 * dpr);

    // Telemetry Stats
    ctx.font = `400 ${8.5 * dpr}px 'Space Mono', monospace`;
    ctx.fillStyle = 'rgba(200,225,255,0.7)';
    const battColor = drone.battery > 50 ? '#3ddc68' : drone.battery > 20 ? '#ffd60a' : '#ff4d6d';
    ctx.fillText(`BATTERY:`, cardX + 10 * dpr, cardY + 38 * dpr);
    ctx.fillStyle = battColor;
    ctx.fillText(`${drone.battery}% 🔋`, cardX + 64 * dpr, cardY + 38 * dpr);

    ctx.fillStyle = 'rgba(200,225,255,0.7)';
    ctx.fillText(`ALT: ${drone.altitude || 25}m`, cardX + 126 * dpr, cardY + 38 * dpr);

    // Exact Coordinates & Sector
    ctx.fillStyle = 'rgba(200,225,255,0.7)';
    ctx.fillText(`POS   : (${drone.x.toFixed(1)}, ${drone.y.toFixed(1)}) · SEC: (${drone.col}, ${drone.row})`, cardX + 10 * dpr, cardY + 52 * dpr);

    // Real-Time Speed & Distance
    const spdMps = (drone.currentSpeed || 0).toFixed(1);
    const spdKmh = ((drone.currentSpeed || 0) * 3.6).toFixed(0);
    ctx.fillText(`SPEED : ${spdMps} m/s (${spdKmh} km/h)`, cardX + 10 * dpr, cardY + 66 * dpr);

    const distM = (drone.totalDistance || 0).toFixed(0);
    const baseM = (drone.distanceToBase || 0).toFixed(0);
    ctx.fillText(`DIST  : ${distM}m · BASE: ${baseM}m`, cardX + 10 * dpr, cardY + 80 * dpr);

    // Sensors
    const tVal = (drone.lastReadings?.thermal || 0).toFixed(2);
    const aVal = (drone.lastReadings?.audio || 0).toFixed(2);
    const gVal = (drone.lastReadings?.gas || 0).toFixed(2);
    ctx.fillStyle = 'rgba(160,190,240,0.6)';
    ctx.fillText(`TH:${tVal} | AU:${aVal} | GS:${gVal}`, cardX + 10 * dpr, cardY + 94 * dpr);

    // Self-Healing Comms: Link quality and decision mode
    const lqVal = (drone.linkQualityAvg || 0).toFixed(2);
    const modeLabel = drone.decisionMode === 'STIGMERGIC' ? 'STIGMERGIC' : 'FULL';
    const modeColor = drone.decisionMode === 'STIGMERGIC' ? '#ff9500' : '#3ddc68';
    ctx.fillStyle = 'rgba(200,225,255,0.7)';
    ctx.fillText(`COMMS :`, cardX + 10 * dpr, cardY + 108 * dpr);
    ctx.fillStyle = modeColor;
    ctx.fillText(`${modeLabel} (LQ: ${lqVal})`, cardX + 55 * dpr, cardY + 108 * dpr);

    ctx.restore();
  }

  /**
   * Find closest drone to a CSS pixel click position within maxDistPx.
   * @param {number} cssX
   * @param {number} cssY
   * @param {number} maxDistPx
   * @returns {import('./drone.js').Drone|null}
   */
  getDroneAtCss(cssX, cssY, maxDistPx = 24) {
    const l = this._getLayout();
    if (!l || !this.swarm || !this.swarm.drones) return null;
    const px  = cssX * this.dpr;
    const py  = cssY * this.dpr;
    let closest = null;
    let minDist = maxDistPx * this.dpr;
    for (const drone of this.swarm.drones) {
      const dx = l.ox + drone.x * l.cs - px;
      const dy = l.oy + drone.y * l.cs - py;
      const dist = Math.hypot(dx, dy);
      if (dist < minDist) {
        minDist = dist;
        closest = drone;
      }
    }
    return closest;
  }

  /**
   * Convert a CSS-pixel click position to a grid cell.
   */
  cssToCell(cssX, cssY) {
    const l = this._getLayout();
    if (!l) return null;
    const px  = cssX * this.dpr;
    const py  = cssY * this.dpr;
    const col = Math.floor((px - l.ox) / l.cs);
    const row = Math.floor((py - l.oy) / l.cs);
    if (col < 0 || col >= l.cols || row < 0 || row >= l.rows) return null;
    return { col, row };
  }
}
