import { PheromoneField } from './src/field.js';
import { DisasterScenario } from './src/scenario.js';
import { SensorGenerator } from './src/sensors.js';
import { Swarm } from './src/swarm.js';

const GRID_COLS = 22;
const GRID_ROWS = 18;
const MAX_TICKS = 8000;

function runTrial(nDrones, mode, killRate = 0) {
  const scenario = new DisasterScenario(GRID_COLS, GRID_ROWS, 'disaster-zone');
  const field = new PheromoneField(GRID_COLS, GRID_ROWS);
  const sensors = new SensorGenerator(scenario);
  const swarm = new Swarm(field, sensors);
  
  swarm.spawn(nDrones);

  // Single-sensor ablation study
  if (mode === 'vision-only') {
    const originalGet = sensors.getLocalReadings.bind(sensors);
    sensors.getLocalReadings = function(c, r, t, d) {
      const vals = originalGet(c, r, t, d);
      vals.audio = 0.05;
      vals.thermal = 0.05;
      vals.gas = 0.05;
      return vals;
    };
  }

  // Override movement for baseline modes
  for (const drone of swarm.drones) {
    drone.originalMove = drone.move;
    drone.move = function(f, ctx) {
      if (mode === 'lawnmower') {
        let r = (this.id % GRID_ROWS) + 1; 
        if (r >= GRID_ROWS - 1) r = GRID_ROWS - 2; 
        
        if (this._lmDir === undefined) {
          this._lmDir = this.id % 2 === 0 ? 1 : -1;
          this.y = r; this.row = r;
          this.x = 1 + Math.random()*(GRID_COLS-2);
        }
        this.vx = this._lmDir * 0.45;
        this.vy = 0;
        let nx = this.x + this.vx;
        if (nx < 1.5 || nx > f.cols - 1.5) {
          this._lmDir *= -1;
          nx = Math.max(1.5, Math.min(nx, f.cols - 1.5));
          this.y += 0.5; // shift down slightly at edges to cover more
          if (this.y > f.rows - 1) this.y = 1;
        }
        this.x = nx;
        this.col = Math.floor(nx);
        this.row = Math.floor(this.y);
      } 
      else if (mode === 'centralized') {
        let bestDist = Infinity, bestT = null;
        for (const st of scenario.survivors) {
          if (!swarm.isSurvivorExtracted(st.col, st.row)) {
             const dist = Math.hypot(st.col - this.col, st.row - this.row);
             if (dist < bestDist) { bestDist = dist; bestT = st; }
          }
        }
        if (bestT) {
           const dx = (bestT.col + 0.5) - this.x;
           const dy = (bestT.row + 0.5) - this.y;
           const dist = Math.hypot(dx, dy);
           if (dist > 1.5) {
              this.vx = (dx/dist) * 0.45;
              this.vy = (dy/dist) * 0.45;
           } else {
              this.vx = 0.1 * (Math.random()-0.5); this.vy = 0.1 * (Math.random()-0.5);
           }
           this.x += this.vx; this.y += this.vy;
           this.col = Math.max(0, Math.min(f.cols-1, Math.floor(this.x)));
           this.row = Math.max(0, Math.min(f.rows-1, Math.floor(this.y)));
        } else {
           // fallback to spread if all extracted
           this.regime = 'SPREAD'; this.originalMove(f, ctx);
        }
      }
      else if (mode === 'random') {
         this.regime = 'SPREAD'; 
         this._headingBias += (Math.random() - 0.5) * 0.1;
         let rx = Math.cos(this._headingBias);
         let ry = Math.sin(this._headingBias);
         
         if (this.x < 1.5) rx += (1.5 - this.x) * 0.5;
         if (this.x > f.cols - 1.5) rx -= (this.x - (f.cols - 1.5)) * 0.5;
         if (this.y < 1.5) ry += (1.5 - this.y) * 0.5;
         if (this.y > f.rows - 1.5) ry -= (this.y - (f.rows - 1.5)) * 0.5;
         
         const mag = Math.sqrt(rx*rx + ry*ry) || 1;
         rx /= mag; ry /= mag;
         
         this.vx = 0.5 * this.vx + 0.5 * rx * 0.45;
         this.vy = 0.5 * this.vy + 0.5 * ry * 0.45;
         
         this.x += this.vx * 0.25; this.y += this.vy * 0.25;
         this.col = Math.max(0, Math.min(f.cols-1, Math.floor(this.x)));
         this.row = Math.max(0, Math.min(f.rows-1, Math.floor(this.y)));
      }
      else {
        this.originalMove(f, ctx);
      }
    };
  }

  // Tracking metrics
  let metrics = {
    tp: 0, fp: 0, fn: 0,
    locErrors: [],
    timeToDetect: [],
    timeToRescue: [],
    proposals: [], // { conf, isTrue }
  };
  
  let groundTruth = new Set(scenario.survivors.map(s => `${s.col},${s.row}`));
  let discovered = new Set();
  let extracted = new Set();
  
  let ticks = 0;
  let killed = false;

  while (ticks < MAX_TICKS) {
    swarm.step();
    ticks++;
    
    // Fault Tolerance Kill-off
    if (killRate > 0 && !killed && ticks === 200) {
      killed = true;
      const killCount = Math.floor(swarm.drones.length * killRate);
      for (let i = 0; i < killCount; i++) {
         const idx = Math.floor(Math.random() * swarm.drones.length);
         swarm.drones.splice(idx, 1);
      }
    }

    // Telemetry tracking
    for (const drone of swarm.drones) {
       // Proposals for calibration
       if (drone.lastDebateSpeech && drone.lastDebateSpeech.tick === ticks && drone.lastDebateSpeech.type === 'CANDIDATE_PROPOSAL') {
          // Check if near ground truth
          const isTrue = scenario.survivors.some(s => Math.hypot(s.col - drone.col, s.row - drone.row) <= 3);
          metrics.proposals.push({ conf: drone.confidence, isTrue });
       }
    }

    // Detect / Rescue events tracking
    for (const st of swarm.survivorTargets) {
       const key = `${st.col},${st.row}`;
       if (st.status === 'CONVERGING' || st.status === 'RESCUE_DISPATCH' || st.status === 'EXTRACTED') {
          if (!discovered.has(key)) {
             discovered.add(key);
             metrics.timeToDetect.push(ticks);
          }
       }
       if (st.status === 'EXTRACTED' && !extracted.has(key)) {
          extracted.add(key);
          metrics.timeToRescue.push(ticks);
          metrics.tp++; // True positive extracted
          
          // Loc error: assuming sentinel was near
          // In Centralized/Lawnmower, they might not lock properly using the protocol, 
          // but we can measure distance from the drone that caused extraction.
          let bestDroneDist = Math.min(...swarm.drones.map(d => Math.hypot(d.col - st.col, d.row - st.row)));
          metrics.locErrors.push(bestDroneDist);
       }
    }
    
    // False positives (dispatch log)
    for (const dispatch of swarm.dispatchLog) {
       const isTrue = scenario.survivors.some(s => Math.hypot(s.col - dispatch.col, s.row - dispatch.row) <= 3);
       if (!isTrue) metrics.fp++; // Only count unique dispatches, swarm.dispatchLog guarantees this
    }

    // End conditions
    if (swarm.stats.mapExploredPct >= 99 && swarm.survivorsExtracted === scenario.survivors.length) break;
    // Centralized/Lawnmower might never hit 100% map or extract due to protocol overrides
    if (['lawnmower', 'random'].includes(mode) && swarm.stats.mapExploredPct >= 99 && ticks > 1000) break;
  }
  
  metrics.fn = scenario.survivors.length - extracted.size;
  metrics.ticks = ticks;
  metrics.coveragePct = swarm.stats.mapExploredPct;
  
  // Calculate average redundancy (re-exploration)
  let totalVisits = 0, exploredCells = 0;
  for(let i=0; i<field.visitCount.length; i++) {
     if (field.explorationGrid[i] > 0) {
        exploredCells++;
        totalVisits += field.visitCount[i];
     }
  }
  metrics.redundancy = exploredCells > 0 ? (totalVisits / exploredCells) : 0;

  return metrics;
}

// Configuration
const NUM_TRIALS = 100;
const DRONES_STD = 16;
const results = {};

const conditions = [
  { id: 'protoplasm', drones: DRONES_STD, mode: 'protoplasm', kill: 0 },
  { id: 'lawnmower', drones: DRONES_STD, mode: 'lawnmower', kill: 0 },
  { id: 'centralized', drones: DRONES_STD, mode: 'centralized', kill: 0 },
  { id: 'random', drones: DRONES_STD, mode: 'random', kill: 0 },
  { id: 'vision-only', drones: DRONES_STD, mode: 'vision-only', kill: 0 },
  // Fault Tolerance
  { id: 'protoplasm-kill20', drones: DRONES_STD, mode: 'protoplasm', kill: 0.20 },
  { id: 'protoplasm-kill50', drones: DRONES_STD, mode: 'protoplasm', kill: 0.50 },
  // Scalability
  { id: 'protoplasm-d5', drones: 5, mode: 'protoplasm', kill: 0 },
  { id: 'protoplasm-d50', drones: 50, mode: 'protoplasm', kill: 0 },
];

function mean(arr) { return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0; }
function std(arr) { const m = mean(arr); return arr.length ? Math.sqrt(arr.reduce((a,b)=>a+(b-m)**2,0)/arr.length) : 0; }

async function main() {
  console.log(`Starting Benchmarks (${NUM_TRIALS} trials per condition)...`);
  
  for (const cond of conditions) {
     console.log(`Running ${cond.id}...`);
     let tTicks = [], tCoverage = [], tRedundancy = [], tLoc = [], tDetect = [], tRescue = [];
     let totalTP = 0, totalFP = 0, totalFN = 0;
     let successCount = 0;
     let calibBins = { '0.5-0.7': { total: 0, true: 0 }, '0.7-0.9': { total: 0, true: 0 }, '>0.9': { total: 0, true: 0 }};

     for (let i = 0; i < NUM_TRIALS; i++) {
        process.stdout.write(".");
        const res = runTrial(cond.drones, cond.mode, cond.kill);
        
        tTicks.push(res.ticks);
        tCoverage.push(res.coveragePct);
        tRedundancy.push(res.redundancy);
        tLoc.push(...res.locErrors);
        tDetect.push(...res.timeToDetect);
        tRescue.push(...res.timeToRescue);
        
        totalTP += res.tp;
        totalFP += res.fp;
        totalFN += res.fn;
        
        if (res.fn === 0 && res.coveragePct >= 99) successCount++;

        for (const p of res.proposals) {
           let bin = null;
           if (p.conf >= 0.5 && p.conf < 0.7) bin = '0.5-0.7';
           else if (p.conf >= 0.7 && p.conf < 0.9) bin = '0.7-0.9';
           else if (p.conf >= 0.9) bin = '>0.9';
           
           if (bin) {
              calibBins[bin].total++;
              if (p.isTrue) calibBins[bin].true++;
           }
        }
     }
     console.log("\nDone.\n");
     
     const precision = totalTP / (totalTP + totalFP || 1);
     const recall = totalTP / (totalTP + totalFN || 1);
     const f1 = 2 * (precision * recall) / (precision + recall || 1);
     
     results[cond.id] = {
        successRate: (successCount / NUM_TRIALS) * 100,
        ticks: { mean: mean(tTicks), std: std(tTicks) },
        coverage: { mean: mean(tCoverage), std: std(tCoverage) },
        redundancy: { mean: mean(tRedundancy), std: std(tRedundancy) },
        locError: { mean: mean(tLoc), std: std(tLoc) },
        detectTime: { mean: mean(tDetect), std: std(tDetect) },
        rescueTime: { mean: mean(tRescue), std: std(tRescue) },
        accuracy: { precision, recall, f1, tp: totalTP, fp: totalFP, fn: totalFN },
        calibration: calibBins
     };
  }

  // Write results to JSON
  const fs = await import('fs');
  fs.writeFileSync('benchmark_raw_results.json', JSON.stringify(results, null, 2));
  console.log("Benchmarks complete. Results saved to benchmark_raw_results.json.");
}

main().catch(console.error);
