# 🧫 PROTOPLASM — Mathematical, Probabilistic & Sensor Fusion Deep-Dive
> **Decentralized Multi-Agent Autonomous Search & Rescue (SAR) Swarm**  
> *Track: Agentic AI / Decentralized Multi-Agent Autonomous Systems — DSU DEVHACK 3.0*

---

## 📑 Table of Contents

1. [Executive Overview: What Kind of Model Is This?](#1-executive-overview-what-kind-of-model-is-this)
   - [1.1 The Fundamental Philosophical & Engineering Dilemma](#11-the-fundamental-philosophical--engineering-dilemma)
   - [1.2 The Hybrid Architecture: Deterministic Control over a Probabilistic Substrate](#12-the-hybrid-architecture-deterministic-control-over-a-probabilistic-substrate)
   - [1.3 Comparative Taxonomy: Pure Stochastic vs Pure Deterministic vs Protoplasm Hybrid](#13-comparative-taxonomy-pure-stochastic-vs-pure-deterministic-vs-protoplasm-hybrid)
   - [1.4 Why Mission-Critical SAR Demands This Exact Duality](#14-why-mission-critical-sar-demands-this-exact-duality)
2. [Data Acquisition: Simulation (Now) vs Real-Time Physical Hardware (Real World)](#2-data-acquisition-simulation-now-vs-real-time-physical-hardware-real-world)
   - [2.1 How We Ingest & Synthesize Data in the Simulation Right Now](#21-how-we-ingest--synthesize-data-in-the-simulation-right-now)
     - [Scenario Grid Typology & Cell Profiles](#scenario-grid-typology--cell-profiles)
     - [The Real ML Inference Bridge (`api_server.py`)](#the-real-ml-inference-bridge-api_serverpy)
     - [Stochastic Noise & Temporal Wobble Simulation](#stochastic-noise--temporal-wobble-simulation)
     - [Spatial Vantage & 3D Aerial Geometry Modeling](#spatial-vantage--3d-aerial-geometry-modeling)
     - [PINN Physical Cooling Integration (Distinguishing Live Humans from Debris)](#pinn-physical-cooling-integration-distinguishing-live-humans-from-debris)
   - [2.2 How the System Must Function in Real-Time Physical Deployment](#22-how-the-system-must-function-in-real-time-physical-deployment)
     - [Edge Compute Architecture on Physical UAVs](#edge-compute-architecture-on-physical-uavs)
     - [Physical Sensor Hardware Pipeline](#physical-sensor-hardware-pipeline)
     - [Real-Time Latency Budgets & Execution Frequency](#real-time-latency-budgets--execution-frequency)
     - [Ad-Hoc Wireless Mesh Protocol (802.11ah HaLow / LoRa)](#ad-hoc-wireless-mesh-protocol-80211ah-halow--lora)
3. [The Three Sensor Modalities: Strengths, Weaknesses & Failure Modes](#3-the-three-sensor-modalities-strengths-weaknesses--failure-modes)
   - [3.1 Optical / Vision Channel (YOLOv8)](#31-optical--vision-channel-yolov8)
   - [3.2 Acoustic Channel (YAMNet)](#32-acoustic-channel-yamnet)
   - [3.3 Passive Infrared & Gas Modality](#33-passive-infrared--gas-modality)
   - [3.4 The False-Positive Trap: Real Disaster Failure Cases](#34-the-false-positive-trap-real-disaster-failure-cases)
4. [Tri-Modal Sensor Fusion: How Three Channels Become One Number](#4-tri-modal-sensor-fusion-how-three-channels-become-one-number)
   - [4.1 Track A: Bayesian Evidence Accumulation in Log-Odds Space](#41-track-a-bayesian-evidence-accumulation-in-log-odds-space)
     - [Prior Probability & The Disaster Sparsity Assumption](#prior-probability--the-disaster-sparsity-assumption)
     - [Channel Likelihood Ratios (LR)](#channel-likelihood-ratios-lr)
     - [Log-Odds Space Addition & Sigmoid Conversion](#log-odds-space-addition--sigmoid-conversion)
   - [4.2 Track B: Weighted Linear Fusion with Non-Linear Consistency Multipliers](#42-track-b-weighted-linear-fusion-with-non-linear-consistency-multipliers)
     - [Active Channel Counting & Consistency Multiplier $\kappa_{\text{consistency}}$](#active-channel-counting--consistency-multiplier-kappa_textconsistency)
   - [4.3 Concrete Numerical Walkthroughs: Three Disaster Scenarios](#43-concrete-numerical-walkthroughs-three-disaster-scenarios)
     - [Scenario 1: True Survivor Trapped Under Concrete](#scenario-1-true-survivor-trapped-under-concrete)
     - [Scenario 2: Hot Iron Rebar / Sun-Baked Sheet Metal (Thermal Decoy)](#scenario-2-hot-iron-rebar--sun-baked-sheet-metal-thermal-decoy)
     - [Scenario 3: High Wind Whistling Through Broken Pipes (Acoustic Decoy)](#scenario-3-high-wind-whistling-through-broken-pipes-acoustic-decoy)
5. [Information-Theoretic Uncertainty: Shannon Entropy as an Ambiguity Detector](#5-information-theoretic-uncertainty-shannon-entropy-as-an-ambiguity-detector)
   - [5.1 Why Confidence Alone Fails in Ambiguous Environments](#51-why-confidence-alone-fails-in-ambiguous-environments)
   - [5.2 Formulating the Discrete Hypothesis Space](#52-formulating-the-discrete-hypothesis-space)
   - [5.3 Shannon Entropy Equation & Maximum Normalization](#53-shannon-entropy-equation--maximum-normalization)
   - [5.4 Multi-Modal Variance & Epistemic Uncertainty](#54-multi-modal-variance--epistemic-uncertainty)
   - [5.5 How Uncertainty Drives Autonomous Swarm Curiosity](#55-how-uncertainty-drives-autonomous-swarm-curiosity)
6. [Viscosity: The Phase Transition Scalar Field](#6-viscosity-the-phase-transition-scalar-field)
   - [6.1 Physical Metaphor: From Fluid Exploration to Crystalline Commitment](#61-physical-metaphor-from-fluid-exploration-to-crystalline-commitment)
   - [6.2 The Arrhenius-Inspired Activation Energy Formulation](#62-the-arrhenius-inspired-activation-energy-formulation)
   - [6.3 Cubic Smoothstep Clamping](#63-cubic-smoothstep-clamping)
   - [6.4 The Three Swarm Behavioral Regimes](#64-the-three-swarm-behavioral-regimes)
7. [Swarm Aggregation: Stigmergic Pheromones & Continuous Field Dynamics](#7-swarm-aggregation-stigmergic-pheromones--continuous-field-dynamics)
   - [7.1 Biological Stigmergy (*Physarum polycephalum*)](#71-biological-stigmergy-physarum-polycephalum)
   - [7.2 Pheromone Deposition & Unique Corroboration Sets](#72-pheromone-deposition--unique-corroboration-sets)
   - [7.3 Continuous 2D Reaction-Diffusion PDE (Governed by PINN)](#73-continuous-2d-reaction-diffusion-pde-governed-by-pinn)
   - [7.4 Dynamic Strength-Aware Decay & Decoy Bleaching](#74-dynamic-strength-aware-decay--decoy-bleaching)
   - [7.5 Spatial Gradient Computation & Vector Field Flight Dynamics](#75-spatial-gradient-computation--vector-field-flight-dynamics)
8. [Multi-Agent Deliberation: Distributed RF Debate & Consensus Protocol](#8-multi-agent-deliberation-distributed-rf-debate--consensus-protocol)
   - [8.1 When Stigmergy Meets Radio: The Ambiguous Band ($0.40 \le C < 0.75$)](#81-when-stigmergy-meets-radio-the-ambiguous-band-040-le-c--075)
   - [8.2 Distributed Consensus Finite State Machine](#82-distributed-consensus-finite-state-machine)
   - [8.3 Angular Diversity Requirement ($\Delta\theta \ge 30^\circ$)](#83-angular-diversity-requirement-deltatheta-ge-30circ)
   - [8.4 Byzantine Fault Tolerance & Rogue Drone Quarantining](#84-byzantine-fault-tolerance--rogue-drone-quarantining)
   - [8.5 Self-Healing Graceful Degradation (Radio Failure $\to$ Pure Stigmergy)](#85-self-healing-graceful-degradation-radio-failure-to-pure-stigmergy)
9. [Summary Mathematical Reference & Parameter Directory](#9-summary-mathematical-reference--parameter-directory)

---

## 1. Executive Overview: What Kind of Model Is This?

### 1.1 The Fundamental Philosophical & Engineering Dilemma

When designing an autonomous robotic swarm for disaster response, engineers face a fundamental systems question:

> *"Is our decision and motion model **probabilistic**, **deterministic**, or **neither**?"*

* If a system is **purely probabilistic** (e.g., end-to-end Reinforcement Learning, stochastic policy gradients, Markov Decision Processes with randomized action sampling):
  * **Pro:** It handles continuous environmental noise well.
  * **Con:** It is fundamentally non-reproducible, prone to unexplainable catastrophic edge-case failures, unprovable under safety standards, and computationally hazardous in life-or-death missions.
* If a system is **purely deterministic** (e.g., hardcoded if-else threshold state machines, static geometric grid path planners):
  * **Pro:** Predictable, easily auditable, low computational overhead.
  * **Con:** It shatters when exposed to real-world sensor noise, sensor drift, false-positive decoys, partial occlusions, and chaotic environmental decay.

### 1.2 The Hybrid Architecture: Deterministic Control over a Probabilistic Substrate

**Protoplasm is neither a purely stochastic model nor a naive deterministic script.**

Instead, Protoplasm is engineered as a **Cyber-Physical Hybrid: A Deterministic Neuro-Symbolic State Machine operating on top of an Information-Theoretic Probabilistic Belief Substrate.**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       THE PROTOPLASM HYBRID DUALITY                         │
└─────────────────────────────────────────────────────────────────────────────┘

  LEVEL 1: PERCEPTION & BELIEF SUBSTRATE  ──►  PROBABILISTIC (STOCHASTIC)
  ──────────────────────────────────────────────────────────────────────────
  • Raw sensor readings modeled as continuous random variables: r ~ N(μ, σ²)
  • Multi-channel sensor fusion via Bayesian Log-Odds Evidence Accumulation
  • Epistemic ambiguity quantified via Shannon Information Entropy H(X)
  • Dynamic observation updates via recursive Bayes: P(H | E) = [P(E|H)P(H)] / P(E)
  • Grounded in probability density distributions across hypotheses

                                       │
                         Fused Posterior Probability (C)
                         Shannon Information Entropy (U)
                                       │
                                       ▼

  LEVEL 2: COGNITIVE & KINETIC CONTROL   ──►  DETERMINISTIC (ANALYTICAL)
  ──────────────────────────────────────────────────────────────────────────
  • Phase transition scalar (Viscosity V) computed via closed-form Arrhenius equations
  • Behavioral regimes (SPREAD, CONVERGE, SOLIDIFY) bounded by strict mathematical thresholds
  • Spatial flight kinetics driven by analytical Artificial Potential Vector Fields
  • Continuous pheromone dispersion governed by closed-form PINN Reaction-Diffusion PDEs
  • P2P Swarm Debate consensus resolved by deterministic multi-agent voting quorums
```

In mathematical terms, the dual-layer architecture is formalized as:

$$\begin{aligned}
\text{\bf Perception Layer (Probabilistic)}: \quad & \mathbf{z}_t \sim p(\mathbf{z}_t \mid \mathbf{x}_t, \mathbf{w}_t) \quad \implies \quad \text{Belief } b(\mathbf{x}_t) = P(\text{Survivor} \mid \mathbf{z}_{1:t}) \\
\text{\bf Action Layer (Deterministic)}: \quad & \mathbf{u}_t = \mathbf{f}_{\text{deterministic}}\big(b(\mathbf{x}_t), \, H(b), \, \nabla S(\mathbf{x}_t)\big)
\end{aligned}$$

#### Exhaustive Mathematical Breakdown of the Perception & Action Equations

##### 1. The Perception Layer: $\mathbf{z}_t \sim p(\mathbf{z}_t \mid \mathbf{x}_t, \mathbf{w}_t) \implies b(\mathbf{x}_t) = P(\text{Survivor} \mid \mathbf{z}_{1:t})$

This equation formalizes how the drone observes a noisy, uncertain world and transforms chaotic physical signals into a coherent mathematical belief:

* **$\mathbf{x}_t \in \mathbb{R}^3 \times \mathcal{S}$ (True State):** The compound ground-truth physical state at time step $t$. This includes the drone's own kinematic coordinates $(x, y, z)$, its spatial sector $(c, r)$, and the environmental reality $\mathcal{S} \in \{\text{Survivor Present}, \text{Empty/Decoy}\}$. In real disaster rubble, this true state is **hidden (latent)** and cannot be observed directly.
* **$\mathbf{w}_t \sim \mathcal{D}$ (Stochastic Disturbance & Noise Vector):** Environmental and hardware disturbances operating at time $t$. This encompasses atmospheric wind gusts shaking the gimbal, thermal shot noise in the infrared microbolometer, acoustic propeller blade wash, concrete dust scattering optical photons, and varying line-of-sight occlusions.
* **$\mathbf{z}_t = [r_{\text{cam}}, \, r_{\text{aud}}, \, r_{\text{pas}}]^T \in [0, 1]^3$ (Observation Vector):** The raw scalar readings captured across all onboard sensor channels at time $t$.
* **$\mathbf{z}_t \sim p(\mathbf{z}_t \mid \mathbf{x}_t, \mathbf{w}_t)$ (Observation Likelihood Density):** The sensor reading $\mathbf{z}_t$ is not a fixed scalar; it is a **stochastic sample drawn from a conditional probability density function**. For instance, if a true survivor is present ($\mathbf{x}_t$), optical camera readings follow a Gaussian distribution centered at high confidence: $r_{\text{cam}} \sim \mathcal{N}(\mu=0.88, \, \sigma=0.08)$, modulated by the drone's approach angle $\Delta\theta$.
* **$\mathbf{z}_{1:t} = \{\mathbf{z}_1, \mathbf{z}_2, \dots, \mathbf{z}_t\}$ (Observation History):** The complete chronological sequence of sensor measurements acquired by the drone over its flight path up to the current tick $t$.
* **$b(\mathbf{x}_t) = P(\text{Survivor} \mid \mathbf{z}_{1:t}) \in [0, 1]$ (Bayesian Belief State):** The drone does not make a brittle boolean guess ("yes" or "no"). Instead, it tracks an internal **belief state** $b(\mathbf{x}_t)$, which is the exact Bayesian posterior probability that a living survivor is present given all evidence accumulated so far:
  $$b(\mathbf{x}_t) = \sigma\left( \mathcal{L}_{\text{prior}} + \sum_{k=1}^t \sum_{i \in \{\text{cam}, \text{aud}, \text{pas}\}} \ln \left[ \frac{P(z_{k, i} \mid \text{Survivor})}{P(z_{k, i} \mid \neg\text{Survivor})} \right] \right)$$
  This turns raw, noisy, intermittent observations into a smooth, mathematically sound probability scalar $C = b(\mathbf{x}_t)$.

---

##### 2. The Action Layer: $\mathbf{u}_t = \mathbf{f}_{\text{deterministic}}\big(b(\mathbf{x}_t), \, H(b), \, \nabla S(\mathbf{x}_t)\big)$

Once the probabilistic perception layer produces the belief state, the drone must decide **how to fly, how much pheromone to deposit, and how to vote in multi-agent debate**. This action selection is **strictly deterministic**:

* **$\mathbf{u}_t$ (Control Action Vector):** The complete kinematic and cognitive output executed by the drone at tick $t$:
  $$\mathbf{u}_t = \big[ \mathbf{v}_{t+1} \in \mathbb{R}^2, \;\; \theta_{t+1} \in [-\pi, \pi], \;\; \Delta S_t \in [0, 0.85], \;\; \text{Regime} \in \{\text{SPREAD}, \text{CONVERGE}, \text{SOLIDIFY}\}, \;\; \text{Vote} \in \{\text{AGREE}, \text{REJECT}\} \big]$$
* **The Three Deterministic Inputs:**
  1. **$b(\mathbf{x}_t) = C$ (Belief / Confidence):** The scalar posterior probability derived by the perception layer.
  2. **$H(b) = U$ (Shannon Information Entropy):** The uncertainty/ambiguity of the belief distribution across the 4 hypotheses:
     $$H(b) = -\sum_{i=1}^4 p_i \log_2(p_i) \quad \implies \quad U = \frac{H(b)}{\log_2(4)} \in [0, 1]$$
     This tells the controller whether a high reading represents unanimous agreement ($U \approx 0$) or a severe inter-sensor contradiction ($U \approx 1$).
  3. **$\nabla S(\mathbf{x}_t) \in \mathbb{R}^2$ (Spatial Stigmergic Gradient):** The 2D spatial gradient of the continuous pheromone field at the drone's position, computed deterministically via an 8-neighborhood kernel over the grid:
     $$\nabla S(\mathbf{x}_t) = \left( \sum \Delta c \cdot S(c+\Delta c, r+\Delta r), \; \sum \Delta r \cdot S(c+\Delta c, r+\Delta r) \right)$$
* **$\mathbf{f}_{\text{deterministic}}(\dots)$ (Closed-Form Analytical Operator):**
  Unlike a stochastic neural policy that draws actions randomly via softmax ($\pi(a \mid s)$), $\mathbf{f}_{\text{deterministic}}$ is a **system of closed-form, deterministic mathematical functions**:
  1. **Viscosity Mapping:**
     $$V = \text{smoothstep}\Big(0, 1, \; \sigma\big(k \cdot (C \cdot (1 - U) - E_{\text{act}})\big)\Big), \quad E_{\text{act}} = 0.45, \; k = 8.0$$
  2. **Regime Transition:**
     $$\text{Regime} = \begin{cases} \text{SOLIDIFY} & \text{if } V \ge 0.68 \\ \text{CONVERGE} & \text{if } 0.30 \le V < 0.68 \\ \text{SPREAD} & \text{if } V < 0.30 \end{cases}$$
  3. **Superimposed Vector Field Flight Dynamics:**
     $$\mathbf{F}_{\text{net}} = \frac{w_g \frac{\nabla S}{\|\nabla S\|} + w_u \frac{\nabla U}{\|\nabla U\|} + \mathbf{f}_{\text{collision}} + \mathbf{f}_{\text{boundary}} + \mathbf{f}_{\text{beacon}}}{\|\dots\|_2}$$
     $$\mathbf{v}_{t+1} = \gamma \cdot \mathbf{v}_t + (1 - \gamma) \cdot \mathbf{F}_{\text{net}} \cdot s_{\text{speed}}$$
  4. **Pheromone Trail Deposition:**
     $$\Delta S_t = \text{depositAmount}(\text{Regime}) \cdot (0.3 + 0.7 C) \cdot M_{\text{deposit}}$$
  5. **P2P Quorum Voting:**
     $$\text{Vote} = \begin{cases} \text{AGREE} & \text{if } C \ge 0.30 \\ \text{REJECT} & \text{if } C < 0.30 \end{cases}$$

---

##### 3. The Physical Significance of this Separation

Why is this duality vital for Search and Rescue?
* **Noise Absorption without Jitter:** Sensor glitches and smoke gusts cause fluctuations in $\mathbf{z}_t$, but the recursive belief accumulator $b(\mathbf{x}_t)$ and smoothstep filter prevent instantaneous flight spasms or erratic drone behavior.
* **Safety & Auditability:** Given identical sensor histories $\mathbf{z}_{1:t}$ and pheromone field states $S$, the control output $\mathbf{u}_t$ is **100% deterministic, mathematically bounded, collision-free, and provable**.
* If a rescue team or accident investigator asks: *"Why did Drone #3 turn North at tick 412 and declare a survivor?"*, every step can be traced back to exact, non-random mathematical formulas—without any black-box stochastic mystery.

Given an identical belief distribution $b(\mathbf{x})$ and field state $S(\mathbf{x})$, the system's control output $\mathbf{u}_t$ is **100% deterministic, mathematically bounded, provable, and reproducible**.

### 1.3 Comparative Taxonomy: Pure Stochastic vs Pure Deterministic vs Protoplasm Hybrid

| Architectural Dimension | Purely Stochastic Model (e.g., Pure RL / Markov) | Purely Deterministic Model (e.g., Rule-Based Expert System) | Protoplasm Hybrid Architecture |
| :--- | :--- | :--- | :--- |
| **Input Ingestion** | Stochastic state sampling | Hard discrete threshold checks | Continuous Likelihood Ratios ($LR$) with Gaussian noise filtering |
| **Sensor Uncertainty** | Hidden Markov latent states | Ignored or binary noise band | Shannon Entropy $H(X)$ over hypothesis distribution |
| **State Transitions** | Softmax probabilistic sampling $P(s_{t+1} \mid s_t)$ | Rigid Boolean if-else ladders | Smoothstep Arrhenius Phase Transition Equations |
| **Motion Planning** | Stochastic exploration policies | Fixed raster / lawnmower paths | Superimposed Vector Potential Fields ($\mathbf{F}_{\text{net}}$) |
| **Decoy Rejection** | Requires millions of training episodes | Hardcoded rules prone to blindspots | Multi-modal log-odds suppression + Pheromone bleaching |
| **Multi-Agent Coordination**| Emergent, unpredictable policies | Central master-worker planner (SPOF) | Decentralized Stigmergy ($Physarum$) + Typed RF P2P Debate |
| **Auditability & Safety** | Black-box; impossible to formally certify | Auditable but brittle | **Fully auditable; formal mathematical bounds at every step** |

### 1.4 Why Mission-Critical SAR Demands This Exact Duality

Search and Rescue in disaster zones (collapsed concrete structures, earthquake rubble, chemical plant explosions) involves extreme physical hazards. A drone cannot afford to "roll dice" to decide whether to fly into a wall or whether to report a human survivor to emergency first responders.

1. **Safety Certifiability:** Aviation authorities and emergency disaster agencies require provable collision avoidance bounds, guaranteed flight ceilings, and deterministic return-to-land (RTL) battery thresholds.
2. **Elimination of "Hallucinated" Rescues:** In real disasters, dispatching heavy search-and-rescue squads with hydraulic excavators to a false alarm wastes the critical "Golden 72 Hours." The probabilistic layer filters out raw sensor noise; the deterministic voting quorum ensures no alarm is sounded without multi-drone verification.

---

## 2. Data Acquisition: Simulation (Now) vs Real-Time Physical Hardware (Real World)

A frequent point of confusion is: *How is data being produced in the current simulator versus how will physical sensors deliver it on actual drones?*

### 2.1 How We Ingest & Synthesize Data in the Simulation Right Now

In the current codebase (`Stigmeric_Drone_DSU`), simulation data generation is structured as a **realistic hardware-in-the-loop emulation harness**, not a simplistic random number generator.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CURRENT SIMULATION DATA PIPELINE                         │
└─────────────────────────────────────────────────────────────────────────────┘

 [Disaster Scenario Grid] (Col, Row)
        │
        ├── Type: SURVIVOR, HOT_DEBRIS, WIND_NOISE, MANNEQUIN, HAZARD, RUBBLE, CLEAR
        │
        ▼
 [Python ML Server: api_server.py]
        │
        ├── Phase 1 (Vision): Real YOLOv8 (human_detector.pt) CPU forward pass
        ├── Phase 2 (Audio): Real TensorFlow YAMNet (yamnet_binary_final) waveform pass
        ├── Phase 3 (Thermal): PINN Homeostatic vs Debris Cooling Equation
        │
        ▼
 [Base Calibration Profiles via /api/inference]
        │
        ├── SURVIVOR:   YOLO=0.880, YAMNet=0.750, PassiveThermal=0.780
        ├── HOT_DEBRIS: YOLO=0.020, YAMNet=0.070, PassiveThermal=0.820
        ├── WIND_NOISE: YOLO=0.030, YAMNet=0.780, PassiveThermal=0.100
        └── CLEAR:      YOLO=0.020, YAMNet=0.050, PassiveThermal=0.050
        │
        ▼
 [Frontend Simulation Engine: sensors.js]
        │
        ├── Box-Muller Gaussian Perturbation: N(μ, σ = 0.08)
        ├── Dynamic Temporal Wobble: 0.05 · sin(2π · freq · t)
        ├── 3D Vantage-Point Modulation: (0.88 + 0.24 cos|θ_drone - θ_cell|) · AltitudeFactor
        └── 3×3 Local Spatial Neighborhood Averaging (Emulating Sensor Optical FOV)
```

#### Scenario Grid Typology & Cell Profiles
The environment is partitioned into discrete spatial sectors $(c, r) \in \mathbb{Z}^2$. Each cell possesses a ground-truth physical nature:
* `SURVIVOR`: Living human trapped in rubble. High visual silhouette probability, vocal groans/taps, constant physiological body temperature ($37^\circ\text{C}$), moderate CO₂/respiration gas.
* `HOT_DEBRIS`: Sun-baked sheet metal or burning wooden beam. High thermal infrared emission, zero vocalization, zero human visual geometry.
* `WIND_NOISE`: Aerodynamic acoustic vortex through ruptured pipes or rubble voids. Loud broadband audio acoustic energy, zero thermal anomaly, zero human visual geometry.
* `MANNEQUIN`: Inanimate visual decoy (clothing, debris silhouette resembling limbs). High optical visual confidence, zero body heat, zero vocalization.
* `HAZARD`: Ruptured industrial gas line or caustic pool. High VOC/toxic gas concentration, lethal to responders.
* `RUBBLE` / `CLEAR`: Background collapsed concrete or clear asphalt.

#### The Real ML Inference Bridge (`api_server.py`)
Rather than fabricating synthetic numbers from imagination, the backend server executes forward inference passes using **actual deep neural network weights**:
1. **Vision Inference:** The server loads `src/human_detector.pt` (a custom PyTorch YOLOv8 model). It passes image arrays of survivors and decoys to compute real softmax bounding box confidences.
2. **Acoustic Inference:** The server loads `src/yamnet_binary_final` (a fine-tuned TensorFlow SavedModel). It synthesizes 16kHz audio waveforms with formant frequencies ($150\text{Hz}, 300\text{Hz}, 450\text{Hz}$) corresponding to human vocal distress calls, and evaluates acoustic spectrogram tensors.
3. **HTTP Distribution:** The resulting inference values are served via the REST API endpoint `/api/inference`, populating the frontend runtime cache.

#### Stochastic Noise & Temporal Wobble Simulation
Physical sensors never output flat, static numbers. In `src/sensors.js`, the simulation injects realistic physical perturbations:
1. **Box-Muller Gaussian Noise:**
   $$z = \sqrt{-2 \ln(u_1)} \cos(2\pi u_2), \quad u_1, u_2 \sim \mathcal{U}(0, 1)$$
   $$r_{\text{noisy}} = \text{clamp}\big(\mu_{\text{model}} + \sigma \cdot z, \; 0, \; 1\big), \quad \sigma = 0.08$$
   This simulates sensor electronic read noise, thermal shot noise, and atmospheric scattering.
2. **Organic Sinusoidal Wobble:**
   $$w(t) = A \cdot \sin\left(\frac{2\pi \cdot f \cdot t}{100}\right)$$
   Where acoustic channels oscillate faster ($f=1.3$) to emulate fluctuating vocal cadence and wind turbulence, while thermal channels oscillate slowly ($f=0.7$) to emulate environmental convective air currents.

#### Spatial Vantage & 3D Aerial Geometry Modeling
In the real world, a drone's perspective dictates what its sensors can register. Looking at a survivor from behind a concrete slab hides their face; flying directly overhead provides an unobstructed view. In `sensors.js`:
$$\text{VantageFactor} = \underbrace{\big(0.88 + 0.24 \cos|\theta_{\text{heading}} - \theta_{\text{target}}|\big)}_{\text{Directional Approach Angle Modulation}} \;\times\; \underbrace{\big(0.92 + 0.16 \sin(0.15 t + \text{drone\_id})\big)}_{\text{Altitude Range Wobble}}$$
A reading taken head-on yields an amplification factor of up to $1.12 \times 1.08 = 1.21$, whereas an oblique or receding angle degrades the reading to $0.64 \times 0.76 = 0.49$.

#### PINN Physical Cooling Integration (Distinguishing Live Humans from Debris)
In `src/pinn.js` and `api_server.py`, a Physics-Informed Neural Network evaluates Newton’s Law of Cooling for thermal signatures:
$$\frac{dT}{dt} = -k (T - T_{\text{ambient}})$$
* **Hot Debris:** Unpowered, inert mass cools exponentially with decay constant $k_{\text{debris}} \approx 0.045$. Over $75$ ticks ($4$ seconds), its thermal signature drops by more than $50\%$.
* **Living Survivor:** A human body is homeostatic ($k_{\text{biological}} \approx 0.001$), continuously generating metabolic heat ($\approx 100\text{W}$ basal metabolic rate). The reading remains persistent over time, allowing the swarm to mathematically distinguish living bodies from cooling fires.

---

### 2.2 How the System Must Function in Real-Time Physical Deployment

When transitioning Protoplasm from the browser simulation to an operational swarm of physical quadcopters deployed over an earthquake zone, the computational architecture maps directly to physical hardware:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       REAL-TIME PHYSICAL UAV STACK                          │
└─────────────────────────────────────────────────────────────────────────────┘

 [Physical Quadcopter Airframe] (e.g., Holybro S500 / ModalAI VOXL 2)
  │
  ├── Flight Controller: Pixhawk 6C / ArduPilot / PX4 (MAVLink at 50Hz)
  │
  └── Edge AI Companion Computer: NVIDIA Jetson Orin Nano (8GB / 40 TOPS)
       │
       ├── Sensor Ingestion Pipeline (MIPI CSI / USB 3.0 / I2S / UART)
       │    ├── 1. RGB Camera (Sony IMX477): 1080p @ 30 FPS
       │    ├── 2. LWIR Thermal Camera (FLIR Lepton 3.5): 160×120 Radiometric @ 9 FPS
       │    ├── 3. MEMS Microphone Array (I2S): 4-channel 16kHz audio stream
       │    └── 4. Gas Sensor (Figaro MOX / Electrochemical): 10Hz UART
       │
       ├── Real-Time Edge Neural Inference Engines
       │    ├── YOLOv8 Nano (TensorRT FP16): ~11ms forward pass
       │    └── YAMNet Spectrogram Classifier (ONNX Runtime): ~6ms forward pass
       │
       ├── Mathematical Core (C++ / Rust / Python)
       │    ├── Bayesian Log-Odds Fusion (<0.1ms)
       │    ├── Shannon Information Entropy Calculation (<0.05ms)
       │    ├── Arrhenius Viscosity & Regime State Machine (<0.05ms)
       │    └── Vector Potential Field Kinetic Command Generator (<0.2ms)
       │
       └── RF Mesh Transceiver: 802.11ah Wi-Fi HaLow / LoRa 868MHz
            └── Broadcasts Compact Binary P2P Packets (<64 Bytes)
```

#### Edge Compute Architecture on Physical UAVs
Each drone carries a companion computer (such as an NVIDIA Jetson Orin Nano or Raspberry Pi 5 paired with a Hailo-8 M.2 AI accelerator). 
* The companion computer handles computer vision, audio classification, sensor fusion, stigmergic field tracking, and swarm debate.
* The low-level flight controller (PX4/ArduPilot running on an STM32H7) handles motor PID loops, IMU state estimation, and optical flow / GPS-denied SLAM station-keeping.
* Communication between companion and flight controller uses high-speed MAVLink over UART (`/dev/ttyTHS1` at 921,600 baud).

#### Physical Sensor Hardware Pipeline
1. **Optical Camera:** A global-shutter RGB/NIR camera mounted on a vibration-damped 2-axis brushless gimbal. Frames are ingested via MIPI-CSI direct memory access (DMA). YOLOv8 runs in FP16 precision via TensorRT, outputting bounding boxes and `person` class confidence scores.
2. **Acoustic Array:** An array of 4 Knowles digital I2S MEMS microphones with acoustic foam wind baffles. Propeller noise cancellation is achieved via spectral subtraction: because quadcopter motor RPM is known via ESC telemetry (DShot bidirectional feedback), motor blade-pass fundamental frequencies and harmonics ($f_{\text{motor}} = \frac{\text{RPM} \times \text{blades}}{60}$) are notched out before computing Mel-frequency cepstral coefficients (MFCCs). The audio frame is fed into YAMNet every $500\text{ms}$.
3. **Radiometric Thermal Camera:** A FLIR Lepton 3.5 long-wave infrared (LWIR) core operating at $8\mu\text{m} - 14\mu\text{m}$. It outputs raw temperature kelvin arrays per pixel. Any contiguous blob exhibiting human skin/clothed surface temperatures ($28^\circ\text{C} - 38^\circ\text{C}$) against ambient disaster background temperature yields the thermal confidence signal.
4. **Toxic / Volatile Gas Sensor:** Electrochemical MOX sensors sampling air via an internal intake tube, outputting parts-per-million (PPM) readings over UART.

#### Real-Time Latency Budgets & Execution Frequency
In physical robotics, timing guarantees are paramount. Protoplasm operates on a **hierarchical multi-rate execution loop**:

| Subsystem Loop | Execution Rate | Max Allowed Latency | Computational Platform |
| :--- | :--- | :--- | :--- |
| **Low-Level Motor Control** | 400 Hz | 2.5 ms | Flight Controller (STM32 MCU) |
| **State Estimation & SLAM** | 50 Hz | 20 ms | Flight Controller / Optical Flow |
| **Optical Vision (YOLOv8)** | 20 Hz | 35 ms | Jetson Orin Nano (TensorRT) |
| **Acoustic Audio (YAMNet)**| 2 Hz | 50 ms | Jetson Orin Nano (ONNX Runtime) |
| **Bayesian Fusion & Viscosity**| 10 Hz | 2 ms | Companion CPU (C++ / Python) |
| **P2P RF Debate & Comms** | 5 Hz | 15 ms | Wi-Fi HaLow / LoRa Radio |
| **Stigmergic Field Evaporation**| 1 Hz | 10 ms | Spatial Grid Memory Matrix |

Total sensor-to-motor latency is **under 45ms**, easily satisfying the Nyquist stability criterion for autonomous flight at $3 - 5\text{ m/s}$.

#### Ad-Hoc Wireless Mesh Protocol (802.11ah HaLow / LoRa)
In disaster zones, cellular towers and satellite GPS are destroyed or heavily attenuated by concrete rubble.
* Real drones cannot stream heavy raw video feeds to each other—radio bandwidth in rubble is tiny ($\approx 50 - 250\text{ kbps}$).
* Instead, Protoplasm drones transmit **compact binary telemetry packets (under 64 bytes)** containing only:
  `[MsgType (1B) | DroneID (1B) | Sector_X (2B) | Sector_Y (2B) | Conf (2B) | Heading (2B) | CRC (2B)]`.
* Using Wi-Fi HaLow (sub-1GHz 802.11ah), communication penetrates through up to 4 layers of collapsed concrete over a range of several hundred meters without infrastructure.

---

## 3. The Three Sensor Modalities: Strengths, Weaknesses & Failure Modes

Understanding sensor fusion requires understanding why single sensors fail in disaster environments.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   TRI-MODAL SENSOR DIVERSITY & ORTHOGONALITY                │
└─────────────────────────────────────────────────────────────────────────────┘

  1. CAMERA (YOLOv8)               2. ACOUSTIC (YAMNet)         3. THERMAL / GAS
  ──────────────────               ───────────────────          ────────────────
  • High Spatial Resolution         • Non-Line-of-Sight (NLOS)   • Night/Smoke Invariant
  • Posture & Shape Recognition     • Penetrates Dense Rubble    • Detects Metabolic Heat
  
  ✖ FAILS IN:                      ✖ FAILS IN:                  ✖ FAILS IN:
    Smoke, Dust Clouds, Darkness,    High Wind Gusts, Drone       Sunlit Metal, Fires,
    Complete Rubble Burial           Propeller Wash, Collapses    Hot Engines, Steam Pipes
```

### 3.1 Optical / Vision Channel (YOLOv8)
* **Mathematical Role:** High-specificity discriminator ($w_Y = 0.40$).
* **Sensitivity ($P(\text{high} \mid \text{survivor})$):** $0.85$.
* **False Alarm Rate ($P(\text{high} \mid \neg\text{survivor})$):** $0.08$.
* **Strengths:** Precision identification of human limbs, faces, and clothing silhouettes.
* **Weaknesses:** Completely blind when survivors are buried under $2\text{ meters}$ of collapsed concrete, or when heavy smoke/dust obscures line of sight.

### 3.2 Acoustic Channel (YAMNet)
* **Mathematical Role:** Non-line-of-sight penetration discriminator ($w_A = 0.40$).
* **Sensitivity ($P(\text{high} \mid \text{survivor})$):** $0.80$.
* **False Alarm Rate ($P(\text{high} \mid \neg\text{survivor})$):** $0.15$.
* **Strengths:** Sound waves diffract around structural obstacles and propagate through rubble voids. Cries for help, groaning, or rhythmic tapping on pipes travel where cameras cannot see.
* **Weaknesses:** Drone propeller acoustic wash, turbulent wind whistling through structural rebar, and shifting rubble create acoustic false alarms.

### 3.3 Passive Infrared & Gas Modality
* **Mathematical Role:** Environmental anomaly indicator ($w_P = 0.20$).
* **Sensitivity ($P(\text{high} \mid \text{survivor})$):** $0.70$.
* **False Alarm Rate ($P(\text{high} \mid \neg\text{survivor})$):** $0.30$.
* **Strengths:** Radiometric LWIR thermal signatures operate equally in pitch-black subterranean darkness or dense dust clouds.
* **Weaknesses:** High false-alarm rate. Solar-heated asphalt, smoldering building debris, running electrical transformers, and hot vehicle engine blocks produce strong thermal false positives.

### 3.4 The False-Positive Trap: Real Disaster Failure Cases

To demonstrate why simple sensor averaging fails, consider three standard disaster decoys:
1. **The Hot Sheet Metal Decoy:** Sunlight reflects off a corrugated iron roof fragment. A thermal camera reads $0.85$ confidence. If an autonomous drone only had a thermal camera, it would halt exploration, declare a survivor, and hover uselessly until its battery died.
2. **The Wind Gust Decoy:** Wind howling through a sheared ventilation pipe generates resonance at $250\text{ Hz}$. A naive acoustic detector triggers at $0.80$.
3. **The Mannequin / Clothing Decoy:** A department store mannequin or discarded winter jacket lies in the rubble. A camera registers a human shape with $0.85$ confidence, but thermal is zero and audio is zero.

**Averaging these signals creates catastrophic errors.** A true survivor must be confirmed through mathematically rigorous sensor fusion.

---

## 4. Tri-Modal Sensor Fusion: How Three Channels Become One Number

Protoplasm implements two complementary fusion formulations: **Track A** (Bayesian log-odds evidence accumulation in `src/uncertainty.js`) and **Track B** (Weighted linear fusion with non-linear consistency multipliers in `src/api_server.py` and `src/swarm.js`).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      TRI-MODAL SENSOR FUSION PIPELINE                       │
└─────────────────────────────────────────────────────────────────────────────┘

  Raw Readings:
  • Camera  r_cam ∈ [0, 1] ──┐
  • Audio   r_aud ∈ [0, 1] ──┼──►  [Likelihood Ratio Evaluator LR(r_i)]
  • Passive r_pas ∈ [0, 1] ──┘                 │
                                               ▼
                              [Log-Odds Accumulator]
                              L_post = L_prior + ln(LR_cam) + ln(LR_aud) + ln(LR_pas)
                                               │
                                               ▼
                              [Sigmoid Inverse Transform]
                              Confidence C = 1 / (1 + exp(-L_post))
                                               │
                                               ▼
                              [Consistency Penalty Multiplier]
                              C_final = C · κ_consistency (Active Channels)
```

---

### 4.1 Track A: Bayesian Evidence Accumulation in Log-Odds Space

In Bayesian probability, we seek the posterior probability that a survivor is present ($S$) given vector observation $\mathbf{r} = [r_{\text{cam}}, r_{\text{aud}}, r_{\text{pas}}]$:
$$P(S \mid \mathbf{r}) = \frac{P(\mathbf{r} \mid S) P(S)}{P(\mathbf{r})}$$

Assuming sensor channels are conditionally independent given the ground truth state:
$$P(\mathbf{r} \mid S) = \prod_{i \in \{\text{cam}, \text{aud}, \text{pas}\}} P(r_i \mid S)$$

#### Prior Probability & The Disaster Sparsity Assumption
In a disaster zone spanning hundreds of thousands of square meters, human survivors are spatially sparse. Most cells contain only shattered concrete:
$$P(S) = 0.10 \quad (\text{Prior Survivor Probability})$$
Converting prior probability to **odds**:
$$\text{Odds}(S) = \frac{P(S)}{1 - P(S)} = \frac{0.10}{0.90} \approx 0.1111$$
In **log-odds (logit)** space:
$$\mathcal{L}_{\text{prior}} = \ln\left(\frac{0.10}{0.90}\right) = \ln\left(\frac{1}{9}\right) \approx -2.1972 \approx \mathbf{-2.20}$$

#### Channel Likelihood Ratios (LR)
For each sensor channel $i$, we define:
* Sensitivity (True Positive Rate): $T_i = P(\text{high reading} \mid S)$
* False Alarm Rate (False Positive Rate): $F_i = P(\text{high reading} \mid \neg S)$

The **Likelihood Ratio** $LR_i(r)$ measures how much more probable observation $r$ is if a survivor is present versus absent:
$$LR_i(r) = \frac{P(r_i \mid S)}{P(r_i \mid \neg S)}$$

In `src/uncertainty.js`, channel evidence is modeled piecewise against a noise floor $\tau_{\text{noise}} = 0.10$:
1. **Below Noise Floor ($r_i < 0.10$):** The sensor detects nothing above ambient noise. This provides weak negative evidence:
   $$LR_i(r) = \frac{1 - T_i}{1 - F_i} \quad \implies \quad \ln(LR_i) = \ln\left(\frac{1 - T_i}{1 - F_i}\right) < 0$$
2. **Above Noise Floor ($r_i \ge 0.10$):** Evidence scales directly with reading magnitude:
   $$P(r_i \mid S) = T_i \cdot r_i + (1 - T_i) \cdot 0.05$$
   $$P(r_i \mid \neg S) = F_i \cdot r_i + (1 - F_i) \cdot 0.05$$
   $$LR_i(r) = \frac{T_i \cdot r_i + 0.05(1 - T_i)}{F_i \cdot r_i + 0.05(1 - F_i)}$$

Calibrated channel parameters:
* **Camera ($Y$):** $T_{\text{cam}} = 0.85$, $F_{\text{cam}} = 0.08$ (Strong discriminator)
* **Audio ($A$):** $T_{\text{aud}} = 0.80$, $F_{\text{aud}} = 0.15$ (Moderate environmental noise)
* **Passive Thermal/Gas ($P$):** $T_{\text{pas}} = 0.70$, $F_{\text{pas}} = 0.30$ (High false alarm rate from debris)

#### Log-Odds Space Addition & Sigmoid Conversion
Why do we perform fusion in log-odds space instead of multiplying probabilities directly?
1. **Numerical Stability:** Multiplying small probabilities causes floating-point underflow. In log space, multiplication becomes simple, fast addition:
   $$\mathcal{L}_{\text{posterior}} = \mathcal{L}_{\text{prior}} + \ln\big(LR_{\text{cam}}(r_{\text{cam}})\big) + \ln\big(LR_{\text{aud}}(r_{\text{aud}})\big) + \ln\big(LR_{\text{pas}}(r_{\text{pas}})\big)$$
2. **Symmetric Evidence Accumulation:** Positive evidence adds to $\mathcal{L}$; negative evidence subtracts from $\mathcal{L}$.
3. **Conversion Back to Posterior Probability:** The inverse logit function is the mathematical **sigmoid**:
   $$P(S \mid \mathbf{r}) = \sigma(\mathcal{L}_{\text{posterior}}) = \frac{1}{1 + e^{-\mathcal{L}_{\text{posterior}}}}$$

---

### 4.2 Track B: Weighted Linear Fusion with Non-Linear Consistency Multipliers

In the real-time API server (`api_server.py`) and swarm tactical layer (`swarm.js`), raw linear fusion is augmented by a **consistency multiplier**:
$$C_{\text{raw}} = w_{\text{cam}} \cdot r_{\text{cam}} + w_{\text{aud}} \cdot r_{\text{aud}} + w_{\text{pas}} \cdot r_{\text{pas}}$$
$$w_{\text{cam}} = 0.40, \quad w_{\text{aud}} = 0.40, \quad w_{\text{pas}} = 0.20$$

#### Active Channel Counting & Consistency Multiplier $\kappa_{\text{consistency}}$
A reading is counted as "active" if it exceeds the significance threshold $\tau = 0.28$:
$$N_{\text{active}} = \sum_{k \in \{\text{cam}, \text{aud}, \text{pas}\}} \mathbb{I}(r_k > 0.28)$$

The consistency multiplier $\kappa_{\text{consistency}}$ penalizes single-channel anomalies and rewards multi-modal consensus:
$$\kappa_{\text{consistency}} = \begin{cases}
0.55 & \text{if } N_{\text{active}} = 1 \quad \text{(Severe Penalty: single-channel false alarm)} \\
0.95 & \text{if } N_{\text{active}} = 2 \quad \text{(Moderate Candidate: requires peer verification)} \\
1.25 & \text{if } N_{\text{active}} \ge 3 \quad \text{(Multi-Modal Confirmed Lock: all channels corroborate)}
\end{cases}$$

Final Fused Confidence:
$$C = \min\big(1.0, \; \max(0.0, \; C_{\text{raw}} \cdot \kappa_{\text{consistency}})\big)$$

---

### 4.3 Concrete Numerical Walkthroughs: Three Disaster Scenarios

Let us compute the exact mathematical output for three concrete cases to see how Protoplasm inherently rejects false alarms:

#### Scenario 1: True Survivor Trapped Under Concrete
* **Sensor Inputs:** Camera $r_{\text{cam}} = 0.88$, Audio $r_{\text{aud}} = 0.75$, Passive Thermal $r_{\text{pas}} = 0.82$.
* **Bayesian Step-by-Step:**
  1. $\mathcal{L}_{\text{prior}} = -2.20$
  2. Camera: $P(\text{cam} \mid S) = 0.85(0.88) + 0.05(0.15) = 0.7555$; $P(\text{cam} \mid \neg S) = 0.08(0.88) + 0.05(0.92) = 0.1164$
     $$LR_{\text{cam}} = \frac{0.7555}{0.1164} \approx 6.4905 \quad \implies \quad \ln(LR_{\text{cam}}) = \mathbf{+1.870}$$
  3. Audio: $P(\text{aud} \mid S) = 0.80(0.75) + 0.05(0.20) = 0.6100$; $P(\text{aud} \mid \neg S) = 0.15(0.75) + 0.05(0.85) = 0.1550$
     $$LR_{\text{aud}} = \frac{0.6100}{0.1550} \approx 3.9355 \quad \implies \quad \ln(LR_{\text{aud}}) = \mathbf{+1.370}$$
  4. Thermal: $P(\text{pas} \mid S) = 0.70(0.82) + 0.05(0.30) = 0.5890$; $P(\text{pas} \mid \neg S) = 0.30(0.82) + 0.05(0.70) = 0.2810$
     $$LR_{\text{pas}} = \frac{0.5890}{0.2810} \approx 2.0961 \quad \implies \quad \ln(LR_{\text{pas}}) = \mathbf{+0.740}$$
  5. Accumulate Log-Odds:
     $$\mathcal{L}_{\text{post}} = -2.20 + 1.870 + 1.370 + 0.740 = \mathbf{+1.780}$$
  6. Sigmoid Conversion:
     $$P(S \mid \mathbf{r}) = \frac{1}{1 + e^{-1.780}} = \frac{1}{1 + 0.1686} = \mathbf{0.8557 \approx 86\%}$$
* **Linear Track Step-by-Step:**
  $$C_{\text{raw}} = 0.40(0.88) + 0.40(0.75) + 0.20(0.82) = 0.352 + 0.300 + 0.164 = 0.816$$
  All 3 channels $> 0.28 \implies N_{\text{active}} = 3 \implies \kappa = 1.25$:
  $$C = \min(1.0, \; 0.816 \times 1.25) = \mathbf{1.00} \quad \implies \quad \textbf{HIGH-CONFIDENCE HUMAN}$$

---

#### Scenario 2: Hot Iron Rebar / Sun-Baked Sheet Metal (Thermal Decoy)
* **Sensor Inputs:** Camera $r_{\text{cam}} = 0.02$, Audio $r_{\text{aud}} = 0.07$, Passive Thermal $r_{\text{pas}} = 0.82$.
* **Bayesian Step-by-Step:**
  1. $\mathcal{L}_{\text{prior}} = -2.20$
  2. Camera ($r_{\text{cam}} = 0.02 < 0.10$ noise floor):
     $$LR_{\text{cam}} = \frac{1 - 0.85}{1 - 0.08} = \frac{0.15}{0.92} \approx 0.1630 \quad \implies \quad \ln(LR_{\text{cam}}) = \mathbf{-1.814}$$
  3. Audio ($r_{\text{aud}} = 0.07 < 0.10$ noise floor):
     $$LR_{\text{aud}} = \frac{1 - 0.80}{1 - 0.15} = \frac{0.20}{0.85} \approx 0.2353 \quad \implies \quad \ln(LR_{\text{aud}}) = \mathbf{-1.447}$$
  4. Thermal ($r_{\text{pas}} = 0.82$):
     $$LR_{\text{pas}} \approx 2.0961 \quad \implies \quad \ln(LR_{\text{pas}}) = \mathbf{+0.740}$$
  5. Accumulate Log-Odds:
     $$\mathcal{L}_{\text{post}} = -2.20 - 1.814 - 1.447 + 0.740 = \mathbf{-4.721}$$
  6. Sigmoid Conversion:
     $$P(S \mid \mathbf{r}) = \frac{1}{1 + e^{4.721}} = \frac{1}{1 + 112.28} = \mathbf{0.0088 \approx 0.9\%}$$
* **Linear Track Step-by-Step:**
  $$C_{\text{raw}} = 0.40(0.02) + 0.40(0.07) + 0.20(0.82) = 0.008 + 0.028 + 0.164 = 0.200$$
  Only thermal $> 0.28 \implies N_{\text{active}} = 1 \implies \kappa = 0.55$:
  $$C = 0.200 \times 0.55 = \mathbf{0.110} \quad \implies \quad \textbf{NO HUMAN (Decoy Successfully Purged)}$$

---

#### Scenario 3: High Wind Whistling Through Broken Pipes (Acoustic Decoy)
* **Sensor Inputs:** Camera $r_{\text{cam}} = 0.03$, Audio $r_{\text{aud}} = 0.78$, Passive Thermal $r_{\text{pas}} = 0.10$.
* **Linear Track Step-by-Step:**
  $$C_{\text{raw}} = 0.40(0.03) + 0.40(0.78) + 0.20(0.10) = 0.012 + 0.312 + 0.020 = 0.344$$
  Only audio $> 0.28 \implies N_{\text{active}} = 1 \implies \kappa = 0.55$:
  $$C = 0.344 \times 0.55 = \mathbf{0.189} \quad \implies \quad \textbf{NO HUMAN (Acoustic Noise Filtered)}$$

> **Key Takeaway:** The mathematical formulation makes it impossible for single-sensor false alarms to fool the system. The log-odds penalties and consistency multipliers actively suppress single-channel spikes.

---

## 5. Information-Theoretic Uncertainty: Shannon Entropy as an Ambiguity Detector

### 5.1 Why Confidence Alone Fails in Ambiguous Environments

In classic robotics, many systems rely solely on confidence: $C \in [0, 1]$. But confidence alone cannot distinguish between:
* **Clear Absence:** "I am $100\%$ certain there is nothing here" ($C = 0$).
* **Total Ambiguity:** "The sensors conflict violently; thermal is screaming hot but vision sees nothing; I don't know what is here" ($C \approx 0.5$).

If an autonomous drone treats $C \approx 0.5$ as merely "medium interest," it will behave indecisively. **Protoplasm treats ambiguity as an explicit physical quantity: Information Entropy.**

### 5.2 Formulating the Discrete Hypothesis Space

In `src/uncertainty.js`, the local sensor vector $[r_{\text{cam}}, r_{\text{aud}}, r_{\text{pas}}]$ is projected onto four mutually exclusive hypotheses:
$$\mathcal{H} = \{ H_{\text{survivor}}, \; H_{\text{hot\_debris}}, \; H_{\text{wind\_noise}}, \; H_{\text{empty}} \}$$

With a regularizing epsilon $\epsilon = 0.01$:
1. $P(H_{\text{survivor}}) \propto (r_{\text{cam}} + \epsilon)(r_{\text{aud}} + \epsilon)(r_{\text{pas}} + \epsilon)$ (all channels active in agreement)
2. $P(H_{\text{hot\_debris}}) \propto (r_{\text{pas}} + \epsilon)(1 - r_{\text{cam}} + \epsilon)(1 - r_{\text{aud}} + \epsilon)$ (thermal dominance)
3. $P(H_{\text{wind\_noise}}) \propto (r_{\text{aud}} + \epsilon)(1 - r_{\text{cam}} + \epsilon)(1 - r_{\text{pas}} + \epsilon)$ (audio dominance)
4. $P(H_{\text{empty}}) \propto (1 - r_{\text{cam}} + \epsilon)(1 - r_{\text{aud}} + \epsilon)(1 - r_{\text{pas}} + \epsilon)$ (all channels quiescent)

Normalizing by total partition function $Z = \sum_{k=1}^4 P(H_k)$:
$$p_i = \frac{P(H_i)}{Z}, \quad \sum_{i=1}^4 p_i = 1.0$$

### 5.3 Shannon Entropy Equation & Maximum Normalization

We calculate the classical **Shannon Information Entropy** of this distribution:
$$H(\mathcal{H}) = - \sum_{i=1}^N p_i \log_2(p_i)$$

Since there are $N = 4$ hypotheses, the maximum theoretical entropy (achieved when all hypotheses are equally likely, $p_i = 0.25$) is:
$$H_{\max} = \log_2(4) = 2.0 \text{ bits}$$

Normalizing to the unit interval $U \in [0, 1]$:
$$U = \frac{H(\mathcal{H})}{H_{\max}} = \frac{- \sum_{i=1}^4 p_i \log_2(p_i)}{2.0}$$

* **$U \to 0$ (Zero Ambiguity):** All evidence points definitively to a single hypothesis (either definitely a survivor or definitely clean rubble).
* **$U \to 1$ (Maximum Ambiguity):** Readings are contradictory and uniform. The drone has maximum epistemic uncertainty.

### 5.4 Multi-Modal Variance & Epistemic Uncertainty

In the spatial grid field (`src/field.js`), spatial uncertainty combines channel variance and active channel deficiency:
$$\sigma_{\text{modal}} = \sqrt{\frac{1}{3} \sum_{k \in \{\text{cam}, \text{aud}, \text{pas}\}} (r_k - \bar{r})^2}$$
$$\alpha_{\text{channel}} = \begin{cases}
0.80 & \text{if } N_{\text{active}} = 0 \quad \text{(No data; complete fog of war)} \\
0.55 & \text{if } N_{\text{active}} = 1 \quad \text{(Single sensor outlier)} \\
0.20 & \text{if } N_{\text{active}} = 2 \quad \text{(Corroboration candidate)} \\
0.04 & \text{if } N_{\text{active}} \ge 3 \quad \text{(Full tri-modal lock)}
\end{cases}$$
$$U_{\text{spatial}} = \min\big(1.0, \; \max(0.0, \; 0.35 \cdot \sigma_{\text{modal}} + 0.65 \cdot \alpha_{\text{channel}})\big)$$

### 5.5 How Uncertainty Drives Autonomous Swarm Curiosity

Uncertainty is not just an indicator; it generates an **Artificial Potential Field**:
$$\mathbf{f}_{\text{curiosity}} = w_u \cdot \frac{\nabla U}{\|\nabla U\| + \epsilon}$$
Drones in exploration mode (`SPREAD`) are pulled along the positive gradient of uncertainty ($\nabla U$), automatically repelling them from already-mapped clear ground and drawing them into unexplored sectors.

---

## 6. Viscosity: The Phase Transition Scalar Field

### 6.1 Physical Metaphor: From Fluid Exploration to Crystalline Commitment

In fluid dynamics and statistical thermodynamics, **viscosity** measures a substance's resistance to flow:
* Water has low viscosity ($10^{-3} \text{ Pa}\cdot\text{s}$) — it flows freely and disperses rapidly.
* Molten glass or crystalizing polymer has high viscosity ($>10^3 \text{ Pa}\cdot\text{s}$) — it solidifies into a rigid lattice.

Protoplasm maps this physical phenomenon directly into multi-agent swarm kinetics:
* **Low Viscosity ($V < 0.30$):** Drones act like high-temperature gas particles, spreading rapidly, performing random walks, and maximizing search area.
* **Medium Viscosity ($0.30 \le V < 0.68$):** When an anomaly is detected, local viscosity rises. Drones slow down, turn toward the source, and begin corroboration.
* **High Viscosity ($V \ge 0.68$):** When multi-modal confidence is established, viscosity solidifies. Drones transition from motion into a stable spatial formation, locking the target coordinates.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    VISCOSITY PHASE TRANSITION DYNAMICS                      │
└─────────────────────────────────────────────────────────────────────────────┘

  Confidence C ──┐
                 ├──►  Evidence Energy: E = C · (1 - U)
  Uncertainty U ─┘           │
                             ▼
              [Arrhenius Activation Barrier: E_act = 0.45]
                             │
                             ▼
              Raw Viscosity: V_raw = σ(k · (E - E_act)),  k = 8.0
                             │
                             ▼
              Cubic Smoothstep Filter: V = 3t² - 2t³
                             │
                             ▼
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
     V < 0.30        0.30 ≤ V < 0.68         V ≥ 0.68
    [ SPREAD ]        [ CONVERGE ]        [ SOLIDIFY ]
   Fluid Sweep      Multi-Agent Verify    Target Locked
```

### 6.2 The Arrhenius-Inspired Activation Energy Formulation

To prevent the swarm from prematurely committing to false alarms, the phase transition equation is modeled after the **Arrhenius chemical reaction rate equation**:
$$\text{Clarity} = \max(0, \; 1 - U)$$
$$\text{Evidence Energy} = C \times \text{Clarity}$$

Notice that for Evidence Energy to be high, **both Confidence must be high AND Uncertainty must be low**.
* If $C = 0.85$ but $U = 0.80$ (contradictory decoy), $\text{Energy} = 0.85 \times 0.20 = \mathbf{0.17}$ (Low).
* If $C = 0.90$ and $U = 0.10$ (solid survivor), $\text{Energy} = 0.90 \times 0.90 = \mathbf{0.81}$ (High).

The raw viscosity follows a steep sigmoidal barrier with activation energy $E_{\text{act}} = 0.45$ and steepness $k = 8.0$:
$$V_{\text{raw}} = \frac{1}{1 + \exp\big(-k \cdot (\text{Evidence Energy} - E_{\text{act}})\big)}$$

### 6.3 Cubic Smoothstep Clamping

To ensure continuity and prevent robotic motor jitter at regime boundaries, $V_{\text{raw}}$ passes through a cubic **Hermite smoothstep function** (borrowed from computer graphics shaders):
$$t = \text{clamp}(V_{\text{raw}}, \; 0, \; 1)$$
$$V = 3t^2 - 2t^3$$
This guarantees that $\frac{dV}{dt} = 0$ at both boundaries $t=0$ and $t=1$, producing completely smooth flight deceleration.

### 6.4 The Three Swarm Behavioral Regimes

| Regime | Viscosity Range | Flight Velocity | Turning Rate | Pheromone Deposit | Swarm Tactical Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`SPREAD`** | $V < 0.30$ | High ($5.5\text{ m/s}$) | High random walk | Low ($0.08$) | Rapid area coverage; curiosity gradient ascent |
| **`CONVERGE`**| $0.30 \le V < 0.68$| Med ($2.5\text{ m/s}$) | Damped turn | Med ($0.25$) | Drones attracted along pheromone gradient to inspect candidate |
| **`SOLIDIFY`**| $V \ge 0.68$ | Low/Hover ($0.5\text{ m/s}$)| Tight lock | High ($0.65$) | Fixed beacon hover; initiates rescue dispatch protocol |

---

## 7. Swarm Aggregation: Stigmergic Pheromones & Continuous Field Dynamics

### 7.1 Biological Stigmergy (*Physarum polycephalum*)

How do hundreds of independent drones coordinate without a central server?
Protoplasm uses **Stigmergy**—indirect communication mediated by modifying the environment, inspired by the true slime mold *Physarum polycephalum*.

Drones do not tell each other where to fly. Instead:
1. When a drone discovers promising signals, it deposits digital "pheromones" into the spatial matrix $S(c, r)$.
2. Surrounding drones sense the pheromone gradient $\nabla S$ and are physically drawn toward it.
3. If new drones confirm the signal from different angles, they reinforce the deposit.
4. If new drones discover the signal was a decoy, they actively bleach the deposit.
5. Inconsequential traces evaporate over time.

### 7.2 Pheromone Deposition & Unique Corroboration Sets

To prevent a single rogue drone or a single drone spinning in circles from creating an artificial pheromone peak, each cell $(c, r)$ tracks its **unique corroborating drone set** $\mathcal{D}(c, r) \subset \mathbb{N}$.

The deposit multiplier $M_{\text{deposit}}$ enforces diminishing returns on revisits:
$$M_{\text{deposit}} = \begin{cases}
1.35 & \text{if drone } i \notin \mathcal{D}(c, r) \text{ and } |\mathcal{D}| \le 3 \quad \text{(High Information Gain: New Observer)} \\
0.15 & \text{if drone } i \notin \mathcal{D}(c, r) \text{ and } |\mathcal{D}| > 3 \quad \text{(Over-Validation Cap: Sufficient Verifiers)} \\
0.35 & \text{if drone } i \in \mathcal{D}(c, r) \quad \text{(Self-Revisit Penalty: Prevents Echo Chambers)}
\end{cases}$$

Deposit equation:
$$S_{t+1}(c, r) = \min\big(0.85, \; S_t(c, r) + A_{\text{base}} \cdot (0.3 + 0.7 C) \cdot M_{\text{deposit}}\big)$$

### 7.3 Continuous 2D Reaction-Diffusion PDE (Governed by PINN)

Digital pheromone dispersion across complex disaster rubble is governed by the continuous **Reaction-Diffusion Partial Differential Equation (PDE)**:
$$\frac{\partial P}{\partial t} = D \left( \frac{\partial^2 P}{\partial x^2} + \frac{\partial^2 P}{\partial y^2} \right) - \gamma(C) P$$

Where:
* $D = 0.05$ is the spatial diffusion tensor (simulating how physical scent, thermal plumes, and RF beacon footprints bleed into adjacent sectors).
* $\nabla^2 P = \frac{\partial^2 P}{\partial x^2} + \frac{\partial^2 P}{\partial y^2}$ is the Laplace operator computed via a discrete 8-neighborhood kernel:
  $$\nabla^2 P(x, y) \approx \sum_{\Delta x, \Delta y \in \{-1, 0, 1\}} w_{\Delta x, \Delta y} P(x+\Delta x, y+\Delta y) - 8 P(x, y)$$
* $\gamma(C)$ is the state-dependent evaporation rate governed by our trained Physics-Informed Neural Network (`src/pinn_pheromone.pt`).

### 7.4 Dynamic Strength-Aware Decay & Decoy Bleaching

Decay is non-linear and conditional on signal corroboration:
$$\Delta S(c, r) = \begin{cases}
0.045 & \text{if } S < 0.30 \quad \text{(Fast Evaporation: uncorroborated noise wiped in $\approx 7$ seconds)} \\
0.022 & \text{if } 0.30 \le S < 0.50 \quad \text{(Moderate Decay: active candidate lead)} \\
0.008 & \text{if } S \ge 0.50 \quad \text{(Long-Term Memory: confirmed lead preserved, floor } S_{\min} = 0.22\text{)}
\end{cases}$$

**Active Bleaching:** When peer drones vote to reject a candidate cell (e.g., confirming a decoy), the swarm executes an active negative deposit:
$$S_{\text{bleached}}(c + \Delta c, r + \Delta r) = \max\big(0.0, \; S(c + \Delta c, r + \Delta r) - 0.50\big), \quad \forall \sqrt{\Delta c^2 + \Delta r^2} \le 3.0$$
The false trail is erased immediately, instantly releasing helper drones back into exploration mode.

### 7.5 Spatial Gradient Computation & Vector Field Flight Dynamics

Each drone samples the local pheromone field using an 8-cell Sobel-like gradient kernel:
$$\nabla S(c, r) = \left( \sum_{\Delta c = -1}^1 \sum_{\Delta r = -1}^1 \Delta c \cdot S(c+\Delta c, r+\Delta r), \; \sum_{\Delta c = -1}^1 \sum_{\Delta r = -1}^1 \Delta r \cdot S(c+\Delta c, r+\Delta r) \right)$$
Unit Gradient Heading:
$$\hat{\mathbf{g}} = \frac{\nabla S}{\|\nabla S\|_2 + \epsilon}$$

Total drone kinetic acceleration combines 6 superimposed potential field vectors:
$$\mathbf{F}_{\text{net}} = \frac{\mathbf{f}_{\text{grad}} + \mathbf{f}_{\text{curiosity}} + \mathbf{f}_{\text{collision}} + \mathbf{f}_{\text{boundary}} + \mathbf{f}_{\text{sentinel}} + \mathbf{f}_{\text{rescued}}}{\|\dots\|_2}$$

Kinetic update with momentum inertia ($\gamma = 0.65$ in SPREAD, $\gamma = 0.88$ in CONVERGE):
$$\mathbf{v}_{t+1} = \gamma \cdot \mathbf{v}_t + (1 - \gamma) \cdot \mathbf{F}_{\text{net}} \cdot s_{\text{speed}}$$
$$\mathbf{x}_{t+1} = \mathbf{x}_t + \mathbf{v}_{t+1} \cdot \Delta t$$

---

## 8. Multi-Agent Deliberation: Distributed RF Debate & Consensus Protocol

### 8.1 When Stigmergy Meets Radio: The Ambiguous Band ($0.40 \le C < 0.75$)

While pure stigmergy works everywhere, radio communication allows drones within line-of-sight ($R_{\text{radio}} = 6.0\text{ units} \approx 16.8\text{ meters}$) to conduct explicit peer-to-peer deliberation.

When a drone encounters a signal in the **ambiguous confidence band ($0.40 \le C < 0.75$)**, it does not guess. It triggers the **NOOA (NVIDIA Object-Oriented Agent) Multi-Agent Debate Protocol**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 DISTRIBUTED P2P DEBATE & CONSENSUS FLOW                     │
└─────────────────────────────────────────────────────────────────────────────┘

  Drone A (Proposer)           Peer Drone B (Verifier)      Peer Drone C (Verifier)
  ──────────────────           ───────────────────────      ───────────────────────
          │                               │                            │
  C ≥ 0.25 detected                       │                            │
  Broadcasts PROPOSAL ───────────────────►│───────────────────────────►│
  ⟨Sector, Conf, Readings, Heading⟩       │                            │
          │                               │                            │
          │                       Flies to Sector              Flies to Sector
          │                       Inspects from Angle θ_B      Inspects from Angle θ_C
          │                               │                            │
          │◄────────────────────── VOTE_CAST (AGREE)                   │
          │                       ⟨C_local ≥ 0.30, Δθ ≥ 30°⟩           │
          │                                                            │
          │◄──────────────────────────────────────────────────── VOTE_CAST (AGREE)
          │                                                     ⟨C_local ≥ 0.30, Δθ ≥ 30°⟩
          │
  Quorum Reached!
  (Agrees ≥ 3)
          │
  Broadcasts CONSENSUS_CONFIRMED ────────►│───────────────────────────►│
  Dispatch Rescue Teams!                  │                            │
```

### 8.2 Distributed Consensus Finite State Machine

1. **Candidate Proposal:** Drone $A$ encounters $C \ge 0.25$ and broadcasts:
   $$\text{Msg}_{\text{PROPOSAL}} = \langle \text{PROPOSAL}, \; \text{id}_A, \; c, \; r, \; C_A, \; \mathbf{readings}_A, \; \theta_A, \; t \rangle$$
2. **Quorum Solicitation:** Nearby peer drones receive the message and evaluate sender trust. If $\text{Trust}(A) \ge 0.35$, peers within $2.5\text{ units}$ converge on $(c, r)$.
3. **Independent Vantage Inspection:** Each peer drone takes an independent reading from its own flight position and heading $\theta_{\text{peer}}$.
4. **Vote Casting:**
   $$\text{Vote} = \begin{cases}
   \text{AGREE} & \text{if } C_{\text{local}} \ge 0.30 \\
   \text{REJECT} & \text{if } C_{\text{local}} < 0.30 \\
   \text{ABSTAIN} & \text{if distance to sector } > 2.5\text{ units}
   \end{cases}$$
5. **Consensus Resolution:**
   * **Confirmed Lock:** $\sum \text{AGREE} \ge 3 \implies \text{CONSENSUS\_CONFIRMED}$. The location is permanently marked as a confirmed human survivor; a sentinel drone hovers as an RF beacon; emergency ground extraction is signaled.
   * **Decoy Rejection:** $\sum \text{REJECT} \ge 2 \implies \text{CONSENSUS\_REJECTED}$. The candidate is declared a false-positive decoy. The local pheromone trail is bleached, and peers scatter.

### 8.3 Angular Diversity Requirement ($\Delta\theta \ge 30^\circ$)

A critical failure in visual/acoustic inspection is the **correlated perspective fallacy**: if three drones fly in a tight single file, they all have the same obstructed angle of view. If one drone's camera is fooled by a shadow, all three will be fooled.

In `src/nooa_agent.py` and `swarm.js`, votes are evaluated for **geometric angular diversity**:
$$\Delta\theta = \min_{i \ne j} |\theta_i - \theta_j| \pmod{2\pi}$$
A consensus proposal is strictly rejected unless at least two validating drones observe the target with an angular separation:
$$\Delta\theta \ge 30^\circ \quad \left(\frac{\pi}{6} \text{ radians}\right)$$
This enforces genuine multi-angle stereoscopic corroboration.

### 8.4 Byzantine Fault Tolerance & Rogue Drone Quarantining

In real disaster deployments, drones can suffer hardware damage (e.g., shattered camera lenses, clogged microphone ports, short-circuited ADC converters) or adversarial cyber tampering. A damaged drone transmitting false data could corrupt the entire swarm.

Protoplasm integrates **Byzantine Fault Tolerant Peer Reputation**:
* Each drone tracks an independent peer trust score $\mathcal{T}(j) \in [0, 1]$ initialized at $1.0$.
* If drone $j$ proposes a candidate that is subsequently rejected by the multi-agent quorum as a decoy, its peer trust decays:
  $$\mathcal{T}_{t+1}(j) = \mathcal{T}_t(j) \times 0.65$$
* When $\mathcal{T}(j) < 0.35$, drone $j$ is **quarantined**:
  * Its radio packets are dropped by all peer inboxes.
  * Its pheromone deposits are rejected by the spatial substrate.
  * The damaged drone is mathematically isolated from influencing swarm decisions.

### 8.5 Self-Healing Graceful Degradation (Radio Failure $\to$ Pure Stigmergy)

What happens if intense electromagnetic interference, collapsed metal decks, or distance cuts the radio link entirely?

In `src/drone.js`:
* Drones continuously calculate their Average Link Quality:
  $$\text{LQ}_i = \frac{1}{|\mathcal{N}_i|} \sum_{j \in \mathcal{N}_i} \max\left(0, \; 1 - \frac{\text{dist}_{ij}}{R_{\text{radio}}}\right)$$
* If $\text{LQ} < 0.15$ or no peer radio heartbeat is received for $45$ ticks, the drone switches its decision mode:
  $$\text{Mode: } \text{RADIO\_DEBATE} \quad \longrightarrow \quad \text{Mode: } \textbf{STIGMERGIC}$$
* In `STIGMERGIC` mode:
  * Radio transmissions are powered down to conserve energy.
  * The drone increases its pheromone deposit strength by $1.4\times$ ($+40\%$).
  * Coordination seamlessly reverts to pure biological slime-mold trail following.
* **The system never crashes or halts due to communication loss.** When RF connectivity returns, radio debate automatically reactivates.

---

## 9. Summary Mathematical Reference & Parameter Directory

For quick reference during implementation, testing, or code review, the key mathematical constants and equations are indexed below:

| Symbol | Mathematical Description | Value / Equation | Code Location |
| :--- | :--- | :--- | :--- |
| $\mathcal{L}_{\text{prior}}$ | Prior log-odds of survivor presence | $-2.20 \quad (P_0 \approx 0.10)$ | `src/uncertainty.js:46` |
| $\tau_{\text{noise}}$ | Sensor channel noise floor threshold | $0.10$ | `src/uncertainty.js:49` |
| $T_{\text{cam}}, F_{\text{cam}}$ | YOLOv8 Sensitivity / False Alarm | $T = 0.85, \; F = 0.08$ | `src/uncertainty.js:119` |
| $T_{\text{aud}}, F_{\text{aud}}$ | YAMNet Sensitivity / False Alarm | $T = 0.80, \; F = 0.15$ | `src/uncertainty.js:122` |
| $T_{\text{pas}}, F_{\text{pas}}$ | Passive Thermal Sensitivity / False Alarm| $T = 0.70, \; F = 0.30$ | `src/uncertainty.js:125` |
| $w_Y, w_A, w_P$ | Tri-modal linear fusion weights | $0.40, \; 0.40, \; 0.20$ | `src/api_server.py:208` |
| $\kappa_{\text{consistency}}$ | Consistency multiplier based on $N_{\text{active}}$ | $\{1: 0.55, \; 2: 0.95, \; 3: 1.25\}$ | `absolute_README.md:163` |
| $H(\mathcal{H})$ | Discrete Shannon Information Entropy | $-\sum p_i \log_2(p_i) / \log_2(4)$ | `src/uncertainty.js:186` |
| $E_{\text{act}}$ | Arrhenius phase transition activation energy | $0.45$ | `src/uncertainty.js:221` |
| $k$ | Sigmoidal phase transition steepness | $8.0$ | `src/uncertainty.js:222` |
| $V$ | Behavioral kinetic viscosity | $\text{smoothstep}\big(0, 1, \sigma(k(E - E_{\text{act}}))\big)$ | `src/uncertainty.js:223` |
| $V_{\text{spread\_max}}$ | Maximum viscosity for `SPREAD` regime | $0.30$ | `src/uncertainty.js:20` |
| $V_{\text{solid\_min}}$ | Minimum viscosity for `SOLIDIFY` regime | $0.68$ | `src/uncertainty.js:21` |
| $D$ | Spatial diffusion constant (PINN PDE) | $0.05$ | `src/api_server.py:56` |
| $\gamma_{\text{high}}, \gamma_{\text{low}}$ | Uncorroborated vs Corroborated decay | $\gamma_{\text{high}} = 0.055, \; \gamma_{\text{low}} = 0.010$ | `src/api_server.py:56` |
| $R_{\text{radio}}$ | Peer-to-peer radio communication range | $6.0\text{ grid units } (16.8\text{ meters})$ | `src/swarm.js:312` |
| $\text{Cell Scale}$ | Tactical grid distance conversion | $1\text{ cell } = 2.8\text{ meters}$ | `src/drone.js:632` |
| $\Delta\theta_{\min}$ | Minimum angular diversity for consensus | $30^\circ \quad (\pi / 6 \text{ rad})$ | `src/nooa_agent.py:165` |
| Quorum Rules | Consensus confirmation vs rejection | $\ge 3 \text{ AGREE} \implies \text{LOCK}, \; \ge 2 \text{ REJECT} \implies \text{BLEACH}$ | `src/drone.js:769` |

---

### Conclusion & System Verifiability

Protoplasm achieves what neither a purely stochastic neural agent nor a rigid deterministic script can achieve alone: **it maintains formal mathematical safety bounds and deterministic auditability while operating fluidly over the noisy, stochastic, and incomplete reality of real-world disaster zones.**

* For execution instructions, refer to `absolute_README.md`.
* For backend API calibration, refer to `src/api_server.py`.
* For mathematical source code, inspect `src/uncertainty.js`, `src/sensors.js`, and `src/field.js`.
