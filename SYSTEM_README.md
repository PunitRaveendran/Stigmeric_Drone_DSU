# 🧫 PROTOPLASM — Full System Architecture, Mathematical Mechanics & Operational Guide
> **Decentralized Multi-Agent Autonomous Search & Rescue (SAR) Swarm**  
> *Track: Agentic AI / Decentralized Multi-Agent Systems — DSU DEVHACK 3.0*  
> *Production Deployment:* `https://protoplasm-sar-swarm.onrender.com`

---

## 📑 Table of Contents
1. [Executive Overview & Biological Philosophy](#1-executive-overview--biological-philosophy)
2. [End-to-End Operational Pipeline](#2-end-to-end-operational-pipeline)
3. [Physical Environment, Sensor Pipeline & Decoy Models (`src/sensors.js`)](#3-physical-environment-sensor-pipeline--decoy-models-srcsensorsjs)
4. [Real Edge ML Inference Bridge (`src/api_server.py`)](#4-real-edge-ml-inference-bridge-srcapi_serverpy)
5. [Tri-Modal Bayesian Sensor Fusion (`src/uncertainty.js`)](#5-tri-modal-bayesian-sensor-fusion-srcuncertaintyjs)
6. [Information-Theoretic Uncertainty: Shannon Entropy](#6-information-theoretic-uncertainty-shannon-entropy)
7. [Viscosity & Arrhenius Phase Transition Dynamics](#7-viscosity--arrhenius-phase-transition-dynamics)
8. [Stigmergic Pheromone Field & PINN Physics Substrate (`src/pinn.js`)](#8-stigmergic-pheromone-field--pinn-physics-substrate-srcpinnjs)
9. [Decentralized RF Debate & Byzantine Fault Tolerance (`src/debate.js`, `src/byzantine.js`)](#9-decentralized-rf-debate--byzantine-fault-tolerance-srcdebatejs-srcbyzantinejs)
10. [Monte Carlo Statistical Benchmark Engine (`monte_carlo.js`)](#10-monte-carlo-statistical-benchmark-engine-monte_carlojs)
11. [Physical UAV Avionics & Real-World Hardware Deployment](#11-physical-uav-avionics--real-world-hardware-deployment)
12. [Cloud Production Infrastructure & Microservice Endpoints](#12-cloud-production-infrastructure--microservice-endpoints)

---

## 1. Executive Overview & Biological Philosophy

In high-consequence disaster zones (earthquakes, collapsed skyscrapers, industrial explosions), classical robotics paradigms catastrophically fail:
1. **Centralized Ground Station Failure:** Radio line-of-sight is blocked by shattered reinforced concrete, and bandwidth collapses when multiple drones stream high-definition video.
2. **GPS-Denied Dead Reckoning Drift:** Satellite signals are shielded or multipath-distorted inside debris voids.
3. **Decoy Susceptibility:** Burning embers trigger thermal alarms, wind howling through pipes mimics screams, and mannequins trigger optical detectors.

### The Biological Blueprint: Stigmergy & Quorum Sensing
Protoplasm discards rigid master-worker hierarchies in favor of **Stigmergy**—the decentralized coordination principle used by *Physarum polycephalum* (slime mold) and foraging ant colonies:
* **No drone instructs another drone what to do.**
* Drones communicate indirectly by modifying a shared spatial scalar field (**virtual pheromones**).
* Swarm behavior is governed by **phase transitions**: high uncertainty makes the swarm behave like a fluid gas (spreading out to maximize search coverage); corroborated certainty triggers crystallization (solidifying into an emergency extraction beacon).

---

## 2. End-to-End Operational Pipeline

Every tick (16.6ms / 60Hz), each autonomous drone cycles through the following deterministically bounded loop:

```
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                         PER-DRONE 60Hz FLIGHT LOOP                          │
 └─────────────────────────────────────────────────────────────────────────────┘
  1. INGEST SENSOR STREAMS
     Optical (YOLOv8) + Acoustic (YAMNet) + Radiometric LWIR Thermal / VOC Gas
  2. COMPUTE BAYESIAN SENSOR FUSION (Log-Odds Space)
     L_post = L_prior + Σ ln(LR_i) ──► Confidence C = σ(L_post)
  3. COMPUTE SHANNON ENTROPY & EPISTEMIC VARIANCE
     H = - Σ p_i log2(p_i) / log2(N)
  4. EVALUATE ARRHENIUS VISCOSITY SCALAR
     V = Smoothstep( exp(-E_a / C) · (1 - H) ) ──► Determine Regime: SPREAD, CONVERGE, SOLIDIFY
  5. STIGMERGIC PHEROMONE INTERACTION
     Sample local gradient ∇φ and deposit new pheromone S(x, y) ∝ V
  6. PEER-TO-PEER DELIBERATION (If 0.40 ≤ C < 0.75)
     Broadcast hypothesis vector h = [C, H, r_cam, r_aud, r_pas] over localized RF mesh
  7. BYZANTINE HEALTH CHECK
     Verify local consensus against neighboring drones; isolate rogue/defective sensors
  8. VECTOR POTENTIAL FIELD FLIGHT CONTROL
     F_total = F_grad + F_repulsion + F_obstacle + F_heading ──► Update drone velocity (v_x, v_y)
```

---

## 3. Physical Environment, Sensor Pipeline & Decoy Models (`src/sensors.js`)

The simulation environment generates realistic physical phenomenology across heterogeneous spatial sectors:

### Sector Typology
* `SURVIVOR`: Living trapped human ($37^\circ\text{C}$ homeostatic body heat, vocal formant frequencies $150\text{Hz}-450\text{Hz}$, optical human geometry).
* `HOT_DEBRIS` (Decoy): Sun-baked sheet metal or burning wooden beam. High thermal infrared emission, zero vocalization, zero human optical geometry.
* `WIND_NOISE` (Decoy): High acoustic energy caused by wind vortexing through broken pipes, zero thermal anomaly, zero optical geometry.
* `MANNEQUIN` (Decoy): Discarded clothing or retail mannequin resembling human contours. High visual detection, zero body heat, zero vocalization.
* `HAZARD`: Ruptured industrial gas conduits with high VOC/toxic gas concentration.

### Physical Perturbations & Degradation Models
1. **Box-Muller Gaussian Noise:**
   $$z = \sqrt{-2\ln(u_1)}\cos(2\pi u_2), \quad r_{\text{noisy}} = \text{clamp}(\mu + \sigma \cdot z, \; 0, \; 1), \quad \sigma = 0.08$$
2. **Organic Sinusoidal Wobble:**
   Acoustic channels oscillate rapidly ($f=1.3$) to mirror intermittent vocal cadence; thermal channels drift slowly ($f=0.7$) to emulate environmental convective air currents.
3. **3D Aerial Spatial Vantage Factor:**
   $$\text{VantageFactor} = \underbrace{\big(0.88 + 0.24 \cos|\theta_{\text{heading}} - \theta_{\text{target}}|\big)}_{\text{Azimuth Angle Modulation}} \;\times\; \underbrace{\big(0.92 + 0.16 \sin(0.15 t + \text{drone\_id})\big)}_{\text{Elevation Wobble}}$$
   Direct head-on inspection yields a **$+21\%$ amplification** ($1.21$), while receding oblique angles degrade signals to **$0.49$**.

---

## 4. Real Edge ML Inference Bridge (`src/api_server.py`)

Protoplasm integrates live forward inference passes over deep neural networks:

### 4.1 Vision: PyTorch YOLOv8 Nano (`src/human_detector.pt`)
* Custom PyTorch YOLOv8n single-stage convolutional detector fine-tuned on disaster search and rescue aerial imagery.
* Evaluates bounding box logits to output normalized softmax confidence:
  $$r_{\text{camera}} = \max_i \big( \text{Confidence}(\text{bbox}_i) \cdot \mathbb{I}(\text{class}_i = \text{person}) \big)$$

### 4.2 Audio: TensorFlow YAMNet (`src/yamnet_binary_final`)
* MobileNet deep architecture evaluating 16kHz audio log-mel spectrograms.
* Binary fine-tuned to classify human distress screams, groans, and rhythmic tapping against rotor wash and industrial noise:
  $$r_{\text{audio}} = P(\text{Human Distress} \mid \text{Spectrogram})$$

---

## 5. Tri-Modal Bayesian Sensor Fusion (`src/uncertainty.js`)

To prevent single-channel decoys from falsely diverting the swarm, sensor evidence is combined via **Bayesian Evidence Accumulation in Log-Odds Space**.

### Mathematical Formulation
$$\frac{P(S \mid \mathbf{r})}{P(\neg S \mid \mathbf{r})} = \frac{P(S)}{P(\neg S)} \times \prod_{i=1}^n \frac{P(r_i \mid S)}{P(r_i \mid \neg S)}$$

Taking the natural logarithm transforms multiplication into addition:
$$\mathbf{\mathcal{L}_{\text{post}} = \mathcal{L}_{\text{prior}} + \sum_{i=1}^n \ln\big(LR_i(r_i)\big)}$$

1. **Disaster Prior:** Living victims are spatially sparse ($P(S) = 0.10$):
   $$\mathcal{L}_{\text{prior}} = \ln(0.10 / 0.90) = \mathbf{-2.20}$$
2. **Channel Calibrations:**
   * Camera: Sensitivity $T_{\text{cam}} = 0.85$, False Alarm $F_{\text{cam}} = 0.08$
   * Audio: Sensitivity $T_{\text{aud}} = 0.80$, False Alarm $F_{\text{aud}} = 0.15$
   * Passive Thermal/Gas: Sensitivity $T_{\text{pas}} = 0.70$, False Alarm $F_{\text{pas}} = 0.30$
3. **Piecewise Likelihood Ratio:**
   * Below noise floor ($r_i < 0.10$): Absence of signal provides active negative evidence:
     $$LR_i = \frac{1 - T_i}{1 - F_i} < 1 \implies \ln(LR_i) < 0$$
   * Above noise floor ($r_i \ge 0.10$): Evidence scales directly with signal intensity.
4. **Analytical Sigmoid Inversion:**
   $$C = P(S \mid \mathbf{r}) = \sigma(\mathcal{L}_{\text{post}}) = \frac{1}{1 + e^{-\mathcal{L}_{\text{post}}}}$$

---

## 6. Information-Theoretic Uncertainty: Shannon Entropy

Confidence alone cannot differentiate between a clear empty sector and a sector with violently conflicting sensors. Protoplasm computes **Shannon Information Entropy**:
$$p_i = \frac{r_i}{\sum_{k=1}^N r_k + \epsilon}$$
$$H = -\frac{1}{\log_2(N)} \sum_{i=1}^N p_i \log_2(p_i)$$

* $H \to 0$: Complete unanimity among sensor modalities.
* $H \to 1$: Maximum ambiguity; sensor readings are uniformly distributed across conflicting channels.

---

## 7. Viscosity & Arrhenius Phase Transition Dynamics

Swarm behavioral state is governed by a single continuous scalar: **Viscosity ($V \in [0, 1]$)**, derived from the physical chemistry of the **Arrhenius activation energy equation**:

$$V = \text{Smoothstep}\left( A \cdot \exp\left(-\frac{E_a}{C + \epsilon}\right) \cdot (1 - H) \right)$$

Where $A = 1.0$, $E_a = 0.45$, and $\text{Smoothstep}(x) = 3x^2 - 2x^3$.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       THE THREE SWARM BEHAVIORAL REGIMES                    │
└─────────────────────────────────────────────────────────────────────────────┘
  Viscosity
   1.0 ┌──────────────────────────────────────────────────────────────────┐
       │   REGIME 3: SOLIDIFY (V ≥ 0.68)                                  │
       │   • High confidence, low entropy                                 │
       │   • Drones lock kinetic position, hover, and beam rescue signal  │
   0.68├──────────────────────────────────────────────────────────────────┤
       │   REGIME 2: CONVERGE (0.30 ≤ V < 0.68)                           │
       │   • Ambiguous target / moderate signal                           │
       │   • Drones initiate RF debate and cluster to re-verify           │
   0.30├──────────────────────────────────────────────────────────────────┤
       │   REGIME 1: SPREAD (V < 0.30)                                    │
       │   • Low confidence / empty terrain                               │
       │   • Maximum fluid dispersion and inter-drone repulsion           │
   0.0 └──────────────────────────────────────────────────────────────────┘
```

---

## 8. Stigmergic Pheromone Field & PINN Physics Substrate (`src/pinn.js`)

### 8.1 2D Continuous Reaction-Diffusion PDE
The pheromone field $\phi(x, y, t)$ continuously diffuses and decays across the disaster grid:
$$\frac{\partial \phi}{\partial t} = D \nabla^2 \phi - \gamma \phi + S(x, y, t)$$
* Spatial Diffusion ($D = 0.15$): Pheromone naturally bleeds around rubble corners.
* Half-Life Decay ($\gamma = 0.025$): Stale trails evaporate, preventing old paths from trapping drones.
* Source Deposition $S(x, y, t) = \sum_{d} V_d \cdot \delta(x - x_d, y - y_d)$: Deposition strength is directly proportional to drone viscosity.

### 8.2 PINN Newton's Law of Cooling (Decoy Bleaching)
A Physics-Informed Neural Network continuously tests thermal signatures against Newton's Law of Cooling:
$$\frac{dT}{dt} = -k(T - T_{\text{ambient}})$$
* **Smoldering Debris:** Inert mass with no internal power generation. Cools rapidly with $k_{\text{debris}} \approx 0.045$. Signature drops $>50\%$ in 4 seconds.
* **Living Survivor:** Biological homeostatic organism continuously generating $\approx 100\text{W}$ basal metabolic heat ($k_{\text{biological}} \approx 0.001$). Signature remains constant over time.

The PINN bleaches out cooling thermal false alarms, clearing the pheromone field of fake targets!

---

## 9. Decentralized RF Debate & Byzantine Fault Tolerance (`src/debate.js`, `src/byzantine.js`)

### 9.1 Localized Peer-to-Peer RF Debate
When confidence enters the ambiguous band ($0.40 \le C < 0.75$), drones within radio communication range ($R_{\text{comm}} = 120\text{m}$) broadcast hypothesis vectors $\mathbf{h} = [C, H, r_{\text{cam}}, r_{\text{aud}}, r_{\text{pas}}]^T$.
Drones compute **Cosine Agreement Similarity**:
$$\text{Agreement}(d_i, d_j) = \frac{\mathbf{h}_i \cdot \mathbf{h}_j}{\|\mathbf{h}_i\| \|\mathbf{h}_j\|}$$
If $\text{Agreement} \ge 0.82$, drones synchronize their viscosity and converge to jointly confirm the target.

### 9.2 Byzantine Fault Isolation
In real disasters, sensor hardware can fail (cracked lenses, saturated microphones) or experience adversarial RF injection. 
* If drone $d$ broadcasts $C > 0.85$ over an area where 3 neighboring drones report $C < 0.15$, its fault counter increments $\beta_d \leftarrow \beta_d + 1$.
* If $\beta_d \ge \tau_{\text{byzantine}}$, the peer mesh isolates drone $d$, revoking its pheromone deposition rights and ignoring its broadcasts.

---

## 10. Monte Carlo Statistical Benchmark Engine (`monte_carlo.js`)

`monte_carlo.js` is the offline statistical validation engine designed to evaluate Protoplasm under rigorous scientific conditions.

### 10.1 What It Does
1. **Executes 100 Simulated Missions Per Condition** ($100 \times 9 = 900$ complete missions).
2. **Pits Protoplasm Against Classic Industry Baselines:**
   * `protoplasm`: Full stigmergic, Bayesian, PINN-guided swarm.
   * `lawnmower`: Standard parallel-strip sweep used by classical SAR teams.
   * `centralized`: An omniscient central dispatcher routing nearest drones.
   * `random`: Pure random walk with wall bounces.
   * `vision-only`: Sensor ablation study (audio, thermal, and gas are zeroed out).
3. **Stress-Tests Mid-Flight Swarm Attrition (Fault Tolerance):**
   * `protoplasm-kill20`: 20% of the drone fleet is abruptly destroyed at tick 200.
   * `protoplasm-kill50`: 50% of the drone fleet is abruptly destroyed at tick 200.
4. **Scalability Studies:**
   * `protoplasm-d5` (5 drones) vs `protoplasm-d50` (50 drones).

### 10.2 Metrics Computed & Saved (`benchmark_raw_results.json`)
* **Detection & Rescue Latency:** Mean and standard deviation of ticks to detect and extract survivors.
* **Accuracy Metrics:** Precision, Recall, and F1 Score ($\frac{2 \cdot P \cdot R}{P + R}$).
* **Localization Error:** Euclidean distance error between reported rescue coordinates and true victim location.
* **Redundancy Factor:** $\frac{\text{Total Cell Visits}}{\text{Unique Explored Cells}}$ (measures wasted flight energy).
* **Empirical Probability Calibration:** Compares predicted confidence bins ($0.5-0.7, 0.7-0.9, >0.9$) against ground-truth extraction outcomes.

---

## 11. Physical UAV Avionics & Real-World Hardware Deployment

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PHYSICAL DRONE AVIONICS STACK                      │
└─────────────────────────────────────────────────────────────────────────────┘

  HOLYBRO S500 / MODALAI VOXL 2 AIRFRAME
  ├── Pixhawk 6C Flight Controller (STM32H7, PX4 Autopilot)
  │    • 50Hz Attitude PID control loops
  │    • Optical Flow / GPS-Denied SLAM State Estimation
  │    • High-speed MAVLink UART connection (921,600 baud)
  └── NVIDIA Jetson Orin Nano Companion Computer (8GB, 40 TOPS)
       ├── Ingestion: Sony IMX477 (CSI) + FLIR Lepton 3.5 (SPI) + ReSpeaker 4-Mic (I2S)
       ├── Neural Inference: TensorRT YOLOv8n (11ms) + YAMNet ONNX (6ms)
       ├── Mathematical Core: C++ / Rust Bayesian Log-Odds & 2D Reaction-Diffusion PDE
       └── Transceiver: Doodle Labs 802.11ah Wi-Fi HaLow (Long-range P2P mesh packets)
```

---

## 12. Cloud Production Infrastructure & Microservice Endpoints

* **Live URL:** `https://protoplasm-sar-swarm.onrender.com`
* **Docker Multi-Stage Container:**
  - Builds the React 19 / Vite 6 frontend into static production assets.
  - Hosts the Python FastAPI backend via Uvicorn.
* **API Endpoints:**
  - `GET /api/health` — Microservice status and ML model weight verification.
  - `POST /api/inference` — Forward batch inference through YOLOv8 and YAMNet.
  - `POST /api/pinn/pheromone` — Real-time Physics-Informed Reaction-Diffusion solver.
