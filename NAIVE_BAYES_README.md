# 📐 The Naive Bayes Model: Mathematical Foundations, Component Derivations & Theoretical Validity
> **Autonomous Multi-Agent Search & Rescue (SAR) Swarm — Protoplasm**  
> *Core Probabilistic Engine: `src/uncertainty.js` & `src/sensors.js`*

---

## 📑 Table of Contents
1. [Executive Summary: Why Naive Bayes for Mission-Critical SAR?](#1-executive-summary-why-naive-bayes-for-mission-critical-sar)
2. [Axiomatic Foundations of Probability](#2-axiomatic-foundations-of-probability)
3. [Step-by-Step Derivation of Bayes' Theorem](#3-step-by-step-derivation-of-bayes-theorem)
4. [Deep-Dive into the Four Mathematical Components](#4-deep-dive-into-the-four-mathematical-components)
   - [4.1 Prior Probability $P(y)$](#41-prior-probability-py)
   - [4.2 Class-Conditional Likelihood $P(\mathbf{x} \mid y)$](#42-class-conditional-likelihood-pmathbfx-mid-y)
   - [4.3 Marginal Likelihood / Evidence $P(\mathbf{x})$](#43-marginal-likelihood--evidence-pmathbfx)
   - [4.4 Posterior Probability $P(y \mid \mathbf{x})$](#44-posterior-probability-py-mid-mathbfx)
5. [The "Naive" Conditional Independence Assumption](#5-the-naive-conditional-independence-assumption)
6. [Log-Odds (Logit) Space & Analytical Sigmoid Derivation](#6-log-odds-logit-space--analytical-sigmoid-derivation)
7. [Calibrated Sensor Likelihood Curves in Protoplasm](#7-calibrated-sensor-likelihood-curves-in-protoplasm)
8. [Theoretical Proof of Validity (Why It Works Despite Violating Independence)](#8-theoretical-proof-of-validity-why-it-works-despite-violating-independence)
9. [End-to-End Concrete Numerical Traces](#9-end-to-end-concrete-numerical-traces)
10. [Direct Code Architecture Mapping (`src/uncertainty.js`)](#10-direct-code-architecture-mapping-srcuncertaintyjs)

---

## 1. Executive Summary: Why Naive Bayes for Mission-Critical SAR?

In an aerial Search & Rescue (SAR) mission, micro-UAVs navigate through dust, smoke, fire, and structural rubble. Drones carry three fundamentally different sensor modalities:
1. **Optical Camera:** Custom PyTorch YOLOv8 (`src/human_detector.pt`)
2. **MEMS Microphone Array:** Fine-tuned TensorFlow YAMNet (`src/yamnet_binary_final`)
3. **Passive Infrared (LWIR) / Gas Sensors:** Radiometric thermal & volatile organic compound sensors

Each sensor is inherently fallible:
- Sun-baked sheet metal generates intense thermal signatures without human presence (**thermal decoy**).
- Wind whistling through broken concrete pipes mimics human distress cries (**acoustic decoy**).
- Blankets, clothes, or mannequins trigger optical detectors (**visual decoy**).

**The Naive Bayes model** provides the formal mathematical substrate to continuously fuse these three noisy sensor channels into a single calibrated posterior confidence score $P(\text{Survivor} \mid \mathbf{r}) \in [0, 1]$.

---

## 2. Axiomatic Foundations of Probability

Every probabilistic component in Naive Bayes originates from the three **Kolmogorov Axioms** defined over a sample space $\Omega$ and event space $\mathcal{F}$:

1. **Axiom 1 (Non-Negativity):** For any event $A \in \mathcal{F}$:
   $$P(A) \ge 0$$
2. **Axiom 2 (Unit Measure):** The probability of the entire sample space is unity:
   $$P(\Omega) = 1$$
3. **Axiom 3 (Countable Additivity):** For any sequence of mutually disjoint events $A_1, A_2, \dots$:
   $$P\left(\bigcup_{i=1}^\infty A_i\right) = \sum_{i=1}^\infty P(A_i)$$

### Conditional Probability & The Product Rule
The conditional probability of an event $A$ given that event $B$ has occurred ($P(B) > 0$) is defined as:
$$P(A \mid B) \triangleq \frac{P(A \cap B)}{P(B)}$$

Multiplying by $P(B)$ gives the **Product Rule**:
$$P(A \cap B) = P(A \mid B) P(B)$$

Because set intersection is commutative ($A \cap B = B \cap A$):
$$P(A \cap B) = P(B \mid A) P(A)$$

---

## 3. Step-by-Step Derivation of Bayes' Theorem

Equating both expressions for the joint probability $P(A \cap B)$:
$$P(A \mid B) P(B) = P(B \mid A) P(A)$$

Dividing both sides by $P(B)$:
$$\mathbf{P(A \mid B) = \frac{P(B \mid A) P(A)}{P(B)}}$$

### Mapping to Pattern Recognition & Sensor Fusion
Let:
- $y \in \{S, \neg S\}$ represent the true hidden state ($S = \text{Survivor Present}$, $\neg S = \text{No Survivor}$).
- $\mathbf{x} = [x_1, x_2, \dots, x_n]^T$ represent the multi-dimensional observation vector (e.g., $[r_{\text{camera}}, r_{\text{audio}}, r_{\text{thermal}}]$).

Substituting $y$ and $\mathbf{x}$ into Bayes' formulation:
$$\mathbf{P(y \mid \mathbf{x}) = \frac{P(\mathbf{x} \mid y) P(y)}{P(\mathbf{x})}}$$

---

## 4. Deep-Dive into the Four Mathematical Components

| Component | Mathematical Term | Operational Meaning | Where Does It Come From? | How Is It Computed? |
| :--- | :--- | :--- | :--- | :--- |
| **$P(y)$** | **Prior Probability** | Background probability of the state *before* seeing sensor data. | Environmental spatial target density or historical class prevalence. | Physical disaster area ratio $\frac{\text{target area}}{\text{total area}}$ or MLE frequency $\frac{N_c}{N}$. |
| **$P(\mathbf{x} \mid y)$** | **Class-Conditional Likelihood** | Probability of observing sensor profile $\mathbf{x}$ given state $y$. | Controlled sensor calibration, confusion matrices, and physical response curves. | Product of 1D likelihoods $\prod_{i} P(x_i \mid y)$ (Gaussian PDF, Bernoulli, or calibrated curves). |
| **$P(\mathbf{x})$** | **Marginal Likelihood (Evidence)** | Total probability of observing $\mathbf{x}$ across all possible realities. | Law of Total Probability (normalizing constant). | Weighted average across all hypotheses: $\sum_{k} P(\mathbf{x} \mid y_k) P(y_k)$. |
| **$P(y \mid \mathbf{x})$** | **Posterior Probability** | Updated belief about true state *after* observing sensor evidence $\mathbf{x}$. | Direct synthesis of prior belief and empirical sensory observation. | Division $\frac{P(\mathbf{x} \mid y)P(y)}{P(\mathbf{x})}$ or Sigmoid transform $\sigma(\mathcal{L}_{\text{prior}} + \sum \ln LR_i)$. |

---

### 4.1 Prior Probability $P(y)$

#### Where Does It Come From?
$P(y)$ represents the base rate of the phenomenon before collecting any live sensor readings.
- In generic machine learning, it is the empirical frequency of classes in training data.
- In disaster search and rescue, it is derived from **spatial target sparsity**. In a $100{,}000\,\text{m}^2$ disaster quadrant, living human victims occupy $<10\%$ of spatial cells; $>90\%$ of cells are rubble, shattered masonry, or open space.

#### How Is It Computed?
1. **Empirical Maximum Likelihood Estimation (MLE) with Laplace Smoothing:**
   $$P(y = c) = \frac{N_c + \alpha}{N + K\alpha}$$
   *(where $N_c$ is class sample count, $N$ is total samples, $K$ is number of classes, and $\alpha \ge 0$ prevents zero-frequency collapse).*
2. **Disaster Spatial Density (in `src/uncertainty.js`):**
   $$P(S) = 0.10, \quad P(\neg S) = 0.90$$
   Converted to log-odds (logit):
   $$\mathcal{L}_{\text{prior}} = \ln\left(\frac{P(S)}{P(\neg S)}\right) = \ln\left(\frac{0.10}{0.90}\right) = \ln\left(\frac{1}{9}\right) \approx \mathbf{-2.1972 \approx -2.20}$$

---

### 4.2 Class-Conditional Likelihood $P(\mathbf{x} \mid y)$

#### Where Does It Come From?
$P(\mathbf{x} \mid y)$ represents the **generative physical model**: *if reality is in state $y$, what distribution of sensor signals does it produce?*
It comes from empirical sensor characterization in wind tunnels, thermal chambers, acoustic echo chambers, and benchmark confusion matrices.

#### How Is It Computed?
Under the conditional independence assumption:
$$P(\mathbf{x} \mid y) = \prod_{i=1}^n P(x_i \mid y)$$

Depending on the feature data type:

1. **Continuous Real-Valued Signals (Gaussian Naive Bayes):**
   $$P(x_i \mid y) = \frac{1}{\sqrt{2\pi \sigma_{y, i}^2}} \exp\left(-\frac{(x_i - \mu_{y, i})^2}{2\sigma_{y, i}^2}\right)$$
   Where sample mean $\mu_{y,i} = \frac{1}{N_y}\sum x_i$ and sample variance $\sigma_{y,i}^2 = \frac{1}{N_y}\sum (x_i - \mu_{y,i})^2$.

2. **Binary Detection Events (Bernoulli Naive Bayes):**
   $$P(x_i \mid y) = \theta_{y, i}^{x_i} (1 - \theta_{y, i})^{1 - x_i}, \quad x_i \in \{0, 1\}$$

3. **Continuous Bounded Sensor Readings $r_i \in [0, 1]$ (as in `src/uncertainty.js`):**
   Using channel Sensitivity (True Positive Rate $T_i$) and False Alarm Rate $F_i$:
   - For $r_i \ge \tau_{\text{noise}} = 0.10$:
     $$P(r_i \mid S) = T_i \cdot r_i + 0.05(1 - T_i)$$
     $$P(r_i \mid \neg S) = F_i \cdot r_i + 0.05(1 - F_i)$$
   - For $r_i < \tau_{\text{noise}} = 0.10$ (Below Noise Floor):
     $$P(r_i < 0.10 \mid S) = 1 - T_i, \quad P(r_i < 0.10 \mid \neg S) = 1 - F_i$$

---

### 4.3 Marginal Likelihood / Evidence $P(\mathbf{x})$

#### Where Does It Come From?
$P(\mathbf{x})$ is the total probability of observing feature vector $\mathbf{x}$ across all possible states of the universe. It is derived directly from the **Law of Total Probability**:
$$\sum_{k=1}^K P(y_k \mid \mathbf{x}) = 1$$

To guarantee that posterior probabilities over mutually exclusive, collectively exhaustive hypotheses sum to $1$, the denominator must be:
$$P(\mathbf{x}) = \sum_{k=1}^K P(\mathbf{x} \cap y_k) = \sum_{k=1}^K P(\mathbf{x} \mid y_k) P(y_k)$$

#### How Is It Computed?
For binary hypothesis testing ($S$ vs $\neg S$):
$$P(\mathbf{x}) = \underbrace{P(\mathbf{x} \mid S) P(S)}_{\text{Joint with Survivor}} + \underbrace{P(\mathbf{x} \mid \neg S) P(\neg S)}_{\text{Joint with No Survivor}}$$

Expanding using independent channels:
$$P(\mathbf{x}) = P(S)\prod_{i=1}^n P(x_i \mid S) \;+\; P(\neg S)\prod_{i=1}^n P(x_i \mid \neg S)$$

> **Why $P(\mathbf{x})$ Cancels Out in Practice:**
> 1. **Classification ($\arg\max$):** Because $P(\mathbf{x})$ is strictly positive and identical for all candidate classes, it does not change the argmax ranking: $\arg\max_y \frac{P(\mathbf{x}\mid y)P(y)}{P(\mathbf{x})} = \arg\max_y [P(\mathbf{x}\mid y)P(y)]$.
> 2. **Odds Formulation:** Dividing $P(S \mid \mathbf{x})$ by $P(\neg S \mid \mathbf{x})$ cancels $P(\mathbf{x})$ algebraically.

---

### 4.4 Posterior Probability $P(y \mid \mathbf{x})$

#### Where Does It Come From?
$P(y \mid \mathbf{x})$ is the operational objective of the algorithm: the updated, mathematically sound probability that a victim is present at spatial coordinates $(x, y)$, given all aerial sensor measurements.

#### How Is It Computed?
1. **Direct Normalization:**
   $$P(y = c \mid \mathbf{x}) = \frac{P(y = c)\prod_{i=1}^n P(x_i \mid y = c)}{\sum_{k=1}^K P(y = k)\prod_{i=1}^n P(x_i \mid y = k)}$$
2. **Log-Odds & Sigmoid (as implemented in `src/uncertainty.js`):**
   $$\mathcal{L}_{\text{post}} = \mathcal{L}_{\text{prior}} + \sum_{i=1}^n \ln\left(\frac{P(x_i \mid S)}{P(x_i \mid \neg S)}\right)$$
   $$P(S \mid \mathbf{x}) = \sigma(\mathcal{L}_{\text{post}}) = \frac{1}{1 + e^{-\mathcal{L}_{\text{post}}}}$$

---

## 5. The "Naive" Conditional Independence Assumption

### The Combinatorial Explosion Problem
Without independence, modeling $n$ continuous or multi-state features requires an $n$-dimensional joint density:
$$P(x_1, x_2, \dots, x_n \mid y)$$
For $n$ features with $K$ quantization bins, this requires estimating $\mathcal{O}(K^n)$ parameters per class. On an embedded drone companion computer (e.g., Jetson Orin / Raspberry Pi 5), estimating and storing this joint distribution is mathematically and computationally intractable.

### The Formal Assumption
The Naive Bayes model assumes that each feature $x_i$ is conditionally independent of every other feature $x_j$ ($i \ne j$), given class $y$:
$$P(x_i \mid y, x_j) = P(x_i \mid y) \quad \forall \; i \ne j$$

By the chain rule of probability:
$$P(x_1, \dots, x_n \mid y) = P(x_1 \mid y) \cdot P(x_2 \mid y, x_1) \cdots P(x_n \mid y, x_1, \dots, x_{n-1})$$

Applying conditional independence simplifies this to a direct product of $n$ one-dimensional densities:
$$\mathbf{P(x_1, \dots, x_n \mid y) = \prod_{i=1}^n P(x_i \mid y)}$$

This reduces parameter complexity from **$\mathcal{O}(K^n)$ to $\mathcal{O}(Kn)$**, turning an intractable problem into an instantaneous $\mathcal{O}(n)$ computation.

---

## 6. Log-Odds (Logit) Space & Analytical Sigmoid Derivation

### The Numerical Underflow Dilemma
In physical sensor fusion, computing raw products $\prod_{i=1}^n P(x_i \mid y)$ leads to severe IEEE-754 floating-point underflow when probabilities are small ($10^{-5} \times 10^{-7} \times 10^{-6} \to 0$).

### Derivation of the Odds Formulation
Take the ratio of posterior probabilities for binary classes $S$ and $\neg S$:
$$\frac{P(S \mid \mathbf{x})}{P(\neg S \mid \mathbf{x})} = \frac{\frac{P(\mathbf{x} \mid S)P(S)}{P(\mathbf{x})}}{\frac{P(\mathbf{x} \mid \neg S)P(\neg S)}{P(\mathbf{x})}}$$

The marginal evidence $P(\mathbf{x})$ cancels:
$$\underbrace{\frac{P(S \mid \mathbf{x})}{P(\neg S \mid \mathbf{x})}}_{\text{Posterior Odds}} = \underbrace{\frac{P(S)}{P(\neg S)}}_{\text{Prior Odds}} \times \prod_{i=1}^n \underbrace{\frac{P(x_i \mid S)}{P(x_i \mid \neg S)}}_{\text{Likelihood Ratio } LR_i(x_i)}$$

### Log-Odds Transformation (Logit)
Taking the natural logarithm of both sides converts multiplication into stable linear addition:
$$\ln\left(\frac{P(S \mid \mathbf{x})}{P(\neg S \mid \mathbf{x})}\right) = \ln\left(\frac{P(S)}{P(\neg S)}\right) + \sum_{i=1}^n \ln\left(\frac{P(x_i \mid S)}{P(x_i \mid \neg S)}\right)$$

Defining logit $\mathcal{L} \triangleq \ln\left(\frac{p}{1 - p}\right)$:
$$\mathbf{\mathcal{L}_{\text{post}} = \mathcal{L}_{\text{prior}} + \sum_{i=1}^n \ln\big(LR_i(x_i)\big)}$$

### Algebraic Proof of the Inverse Logit (Sigmoid)
To convert the log-odds scalar $\mathcal{L}_{\text{post}}$ back to a bounded probability $p \in [0, 1]$:

$$\mathcal{L} = \ln\left(\frac{p}{1 - p}\right)$$
$$e^\mathcal{L} = \frac{p}{1 - p}$$
$$e^\mathcal{L}(1 - p) = p$$
$$e^\mathcal{L} - p \, e^\mathcal{L} = p$$
$$e^\mathcal{L} = p(1 + e^\mathcal{L})$$
$$p = \frac{e^\mathcal{L}}{1 + e^\mathcal{L}}$$

Dividing both numerator and denominator by $e^\mathcal{L}$:
$$\mathbf{p = \frac{1}{1 + e^{-\mathcal{L}}} \equiv \sigma(\mathcal{L})}$$

This proves that the standard logistic sigmoid $\sigma(\mathcal{L})$ is the exact mathematical inverse of log-odds.

---

## 7. Calibrated Sensor Likelihood Curves in Protoplasm

In `src/uncertainty.js`, the log-likelihood ratio $\ln\big(LR_i(r_i)\big)$ is computed via `channelLogLR(reading, trueRate, falseRate)`.

```
                  ┌────────────────────────────────────────────────────────┐
                  │          PIECEWISE CHANNEL LIKELIHOOD RATIO            │
                  └────────────────────────────────────────────────────────┘

    r_i < 0.10 (Below Noise Floor)               r_i ≥ 0.10 (Signal Detected)
   ──────────────────────────────────           ─────────────────────────────
    Weak Negative Evidence                       Positive Scaling Evidence
    LR = (1 - TrueRate) / (1 - FalseRate)        P(r|S)  = TrueRate · r + 0.05(1 - TrueRate)
    ln(LR) < 0                                   P(r|¬S) = FalseRate · r + 0.05(1 - FalseRate)
    (Absence of signal penalizes belief)         LR = P(r|S) / P(r|¬S)
```

### Channel Calibration Parameters
1. **Optical Camera (YOLOv8 Human Detector):**
   - True Positive Rate $T_{\text{cam}} = 0.85$ (High sensitivity to human geometry)
   - False Positive Rate $F_{\text{cam}} = 0.08$ (Low false alarm rate)
   - **Role:** Primary positive discriminator.
2. **Acoustic Sensor (YAMNet Classifier):**
   - True Positive Rate $T_{\text{aud}} = 0.80$ (Sensitive to vocal groans/shouts)
   - False Positive Rate $F_{\text{aud}} = 0.15$ (Moderate environmental noise from wind/rotors)
   - **Role:** Confirms life signs when victims are visually obscured under debris.
3. **Passive Thermal / Gas Channel:**
   - True Positive Rate $T_{\text{pas}} = 0.70$ (Detects body heat and respiratory CO₂)
   - False Positive Rate $F_{\text{pas}} = 0.30$ (High false alarm from fires, sun-baked rebar)
   - **Role:** Supporting evidence; cannot declare a survivor alone.

---

## 8. Theoretical Proof of Validity (Why It Works Despite Violating Independence)

In real physical environments, sensor channels are partially correlated (e.g., a warm body generates both optical contours and thermal signatures). **Why does Naive Bayes remain optimal even when the conditional independence assumption is mathematically violated?**

Three foundational theorems prove its validity:

### 1. Zero-One Loss Invariance (Domingos & Pazzani, 1997; Zhang, 2004)
A classifier's accuracy is judged by whether it selects the correct class ($\hat{y} = y^*$), not whether its probability estimate matches the true underlying distribution.

Let $\mathcal{L}^*$ be the true log-odds and $\mathcal{L}_{\text{naive}}$ be the Naive Bayes log-odds. The optimal binary decision rule is:
$$\hat{y} = \begin{cases} S & \text{if } \mathcal{L} > 0 \\ \neg S & \text{if } \mathcal{L} \le 0 \end{cases}$$

Even if correlated features double-count evidence and scale $\mathcal{L}$ from $+1.4$ to $+2.9$:
$$\text{sign}(\mathcal{L}_{\text{naive}}) = \text{sign}(\mathcal{L}^*) = +1$$
The classification decision is **100% invariant** to the correlation distortion.

### 2. The Bias-Variance Tradeoff in Finite Datasets
- A fully correlated model (estimating full covariance matrices $\mathbf{\Sigma}$) has zero independence bias, but suffers from **catastrophically high estimation variance** when data is noisy or sparse.
- Naive Bayes sets all off-diagonal covariance elements to zero. While this introduces an asymptotic bias, it **completely eliminates estimation variance for covariance parameters**.
- In noisy disaster conditions, the dramatic reduction in variance significantly outweighs the minor increase in bias, producing lower overall mean squared error (MSE).

### 3. Asymptotic Convergence Rate (Ng & Jordan, 2001)
Andrew Ng and Michael Jordan proved that the generative Naive Bayes model reaches its asymptotic error threshold in:
$$\mathcal{O}(\log N)$$
training samples, whereas its discriminative counterpart (Logistic Regression) requires:
$$\mathcal{O}(N)$$
samples. In low-latency aerial edge computing, Naive Bayes converges significantly faster.

---

## 9. End-to-End Concrete Numerical Traces

### Scenario A: Confirmed Survivor (Tri-Modal Consensus)
- **Sensor Inputs:** Camera $r_{\text{cam}} = 0.85$, Audio $r_{\text{aud}} = 0.75$, Thermal $r_{\text{pas}} = 0.80$
- **Prior:** $P(S) = 0.10 \implies \mathcal{L}_{\text{prior}} = \ln(0.10 / 0.90) = \mathbf{-2.197}$

1. **Camera Evaluation:**
   $$P(r_{\text{cam}} \mid S) = 0.85(0.85) + 0.05(0.15) = 0.730$$
   $$P(r_{\text{cam}} \mid \neg S) = 0.08(0.85) + 0.05(0.92) = 0.114$$
   $$LR_{\text{cam}} = \frac{0.730}{0.114} \approx 6.404 \implies \ln(LR_{\text{cam}}) = \mathbf{+1.857}$$
2. **Audio Evaluation:**
   $$P(r_{\text{aud}} \mid S) = 0.80(0.75) + 0.05(0.20) = 0.610$$
   $$P(r_{\text{aud}} \mid \neg S) = 0.15(0.75) + 0.05(0.85) = 0.155$$
   $$LR_{\text{aud}} = \frac{0.610}{0.155} \approx 3.935 \implies \ln(LR_{\text{aud}}) = \mathbf{+1.370}$$
3. **Thermal Evaluation:**
   $$P(r_{\text{pas}} \mid S) = 0.70(0.80) + 0.05(0.30) = 0.575$$
   $$P(r_{\text{pas}} \mid \neg S) = 0.30(0.80) + 0.05(0.70) = 0.275$$
   $$LR_{\text{pas}} = \frac{0.575}{0.275} \approx 2.091 \implies \ln(LR_{\text{pas}}) = \mathbf{+0.738}$$
4. **Log-Odds Accumulation:**
   $$\mathcal{L}_{\text{post}} = -2.197 + 1.857 + 1.370 + 0.738 = \mathbf{+1.768}$$
5. **Posterior Confidence (Sigmoid):**
   $$P(S \mid \mathbf{r}) = \frac{1}{1 + e^{-1.768}} = \frac{1}{1 + 0.1707} \approx \mathbf{0.854 \quad (85.4\%)}$$
- **Swarm Action:** Exceeds Solidification threshold ($C \ge 0.75$). Swarm initiates physical convergence.

---

### Scenario B: Hot Debris Decoy (Single Thermal Anomaly)
- **Sensor Inputs:** Camera $r_{\text{cam}} = 0.02$, Audio $r_{\text{aud}} = 0.04$, Thermal $r_{\text{pas}} = 0.85$
- **Prior:** $\mathcal{L}_{\text{prior}} = \mathbf{-2.197}$

1. **Thermal Channel:** $r_{\text{pas}} \ge 0.10 \implies \ln(LR_{\text{pas}}) \approx \mathbf{+0.814}$
2. **Camera Channel (Below Noise Floor):**
   $$LR_{\text{cam}} = \frac{1 - T_{\text{cam}}}{1 - F_{\text{cam}}} = \frac{1 - 0.85}{1 - 0.08} = \frac{0.15}{0.92} \approx 0.163 \implies \ln(LR_{\text{cam}}) = \mathbf{-1.814}$$
3. **Audio Channel (Below Noise Floor):**
   $$LR_{\text{aud}} = \frac{1 - T_{\text{aud}}}{1 - F_{\text{aud}}} = \frac{1 - 0.80}{1 - 0.15} = \frac{0.20}{0.85} \approx 0.235 \implies \ln(LR_{\text{aud}}) = \mathbf{-1.448}$$
4. **Log-Odds Accumulation:**
   $$\mathcal{L}_{\text{post}} = -2.197 + 0.814 - 1.814 - 1.448 = \mathbf{-4.645}$$
5. **Posterior Confidence (Sigmoid):**
   $$P(S \mid \mathbf{r}) = \frac{1}{1 + e^{-(-4.645)}} = \frac{1}{1 + 104.06} \approx \mathbf{0.0095 \quad (< 1.0\%)}$$
- **Swarm Action:** Decoy rejected immediately. Drones do not waste operational flight battery.

---

## 10. Direct Code Architecture Mapping (`src/uncertainty.js`)

Here is how the theoretical equations map line-by-line to the codebase:

```javascript
// Prior: P(S) = 0.10 in Log-Odds space
const LOG_ODDS_PRIOR = -2.20;
const NOISE_FLOOR = 0.10;

// Analytical Sigmoid: σ(L) = 1 / (1 + exp(-L))
function sigmoid(x) {
  if (x > 20) return 1.0;
  if (x < -20) return 0.0;
  return 1.0 / (1.0 + Math.exp(-x));
}

// Likelihood Ratio: LR(r) = P(r | S) / P(r | ¬S)
function channelLogLR(reading, trueRate, falseRate) {
  if (reading < NOISE_FLOOR) {
    // Below noise floor: Absence of evidence penalizes belief
    return Math.log((1 - trueRate) / (1 - falseRate));
  }
  // Above noise floor: Evidence scales with signal intensity
  const pGivenSurvivor   = trueRate * reading + (1 - trueRate) * 0.05;
  const pGivenNoSurvivor = falseRate * reading + (1 - falseRate) * 0.05;
  return Math.log(pGivenSurvivor / pGivenNoSurvivor);
}

// Full Naive Bayes Pipeline: L_post = L_prior + Σ ln(LR_i)
export function computeConfidence(readings) {
  const { thermal = 0, audio = 0, camera = 0, gas = 0 } = readings;
  const passive = Math.max(thermal, gas);

  let logOdds = LOG_ODDS_PRIOR;
  logOdds += channelLogLR(camera, 0.85, 0.08); // YOLOv8
  logOdds += channelLogLR(audio, 0.80, 0.15);  // YAMNet
  logOdds += channelLogLR(passive, 0.70, 0.30);// FLIR Thermal / MOX Gas

  return sigmoid(logOdds);
}
```

---

## 11. Conclusion

The Naive Bayes model in Protoplasm is not a black-box heuristic:
1. It is derived directly from **Kolmogorov’s Axioms** and the **Product Rule of Probability**.
2. It solves the curse of dimensionality by factoring an intractable $\mathcal{O}(K^n)$ joint distribution into $n$ independent $\mathcal{O}(K)$ marginal likelihoods.
3. It operates in **Log-Odds space** with an analytical **Sigmoid inverse**, eliminating floating-point underflow.
4. It correctly models **negative evidence** (absence of signal).
5. It is theoretically proven to preserve the **optimal Bayes decision boundary** under zero-one loss even when sensor modalities exhibit natural physical correlations.
