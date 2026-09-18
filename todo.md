# Protoplasm — 28-Hour Build Plan
**Track: Agentic AI. Everything must trace back to autonomous reasoning/decision-making, not just clever robotics.**

Scope reality: the full wishlist (NOOA + role-switching + 4 PINNs + self-healing + all prior upgrades) is a multi-day build. This plan is tiered so you always have something demo-ready, no matter where the clock runs out.

- **MUST** — build these in order. If only MUST gets done, you still have a strong, coherent, agentic submission.
- **STRETCH** — only start these once every MUST item is integrated AND tested, not just "written."
- **CUT** — explicitly deferred. Mention in the pitch as future work, don't apologize for not building it.

---

## TIER 0 — Housekeeping (30 min)
- [ ] Confirm current `/api/inference` payload: is YOLO/YAMNet doing a real forward pass on synthetic input, or is the score decorative? (Answers the "is this real AI" question before a judge asks it.)
- [ ] Decide final pitch framing: **agentic reasoning layer (NOOA + role-switching) is the headline; PINN physics and self-healing are supporting infrastructure; security is one hardening sentence.**

---

## TIER 1 — MUST BUILD (agentic core — ~14-16 hrs)

### 1. Sparse LLM reasoning via NOOA (6-7 hrs)
- [ ] Set up NOOA (`nooa`) with LiteLLM pointed at Anthropic API — confirm sandboxed execution works before building on top of it
- [ ] Model `Drone` as a Python object per NOOA's pattern: fields = state (position, battery, trust scores, role), deterministic methods = movement/pheromone deposit, ellipsis-body method = `assess_threat(sensor_data) -> Decision`
- [ ] Trigger the LLM-completed method **only** when a drone enters VERIFY state (0.40 ≤ C < 0.75) — never every tick, never for the whole fleet at once
- [ ] Scope reasoning calls to the local 2-4 drone VERIFY cluster only — no fleet-wide call, no central resolver
- [ ] Test latency with a simulated 8-12 drone cluster before assuming it'll hold at higher counts

### 2. Dynamic role switching (3-4 hrs)
- [ ] Define role set: Scout (default sweep), Verifier (joins VERIFY cluster), Relay (bridges comms gap between clusters), Beacon (locks onto SOLIDIFY target)
- [ ] Role transitions are agent-decided (via a NOOA method), triggered by local state — not assigned by any central dispatcher
- [ ] Make role switching visible in the UI (small icon/label per drone) — this is a highly demoable "the swarm is reorganizing itself" moment

### 3. PINN — Pheromone field (3-4 hrs)
- [ ] Train offline: PINN solving 2D diffusion-decay PDE for pheromone concentration — bake weights before integration, ship forward-pass only
- [ ] Replace current ad-hoc pheromone math with PINN-generated continuous field
- [ ] Verify it degrades gracefully (no NaNs/blowups) at grid edges and under sparse drone coverage

### 4. PINN — Battery/thermal (choose ONE, 3-4 hrs)
- [ ] **Battery drain PINN**: model drain as a function of role, movement, distance from base — feeds directly into role-switching and market-style resource decisions
- [ ] OR **Thermal decay PINN**: Newtonian cooling PDE, gives physically grounded rejection of "hot rubble" false positives (higher payoff for judges, higher integration risk with existing confidence fusion)
- [ ] Pick based on which one you're more confident training in the time box — don't attempt both here, that's what STRETCH is for

### 5. Self-healing network / comms degradation (2 hrs)
- [ ] Packet-loss probability as a function of inter-drone distance + rubble occlusion
- [ ] When language-negotiation channel unavailable, agent autonomously falls back to pure numeric stigmergy — frame explicitly as "agent perceives degraded environment, revises its own decision mode" (this is what makes it agentic, not just networking)
- [ ] Relay-role drones (from #2) should visibly patch gaps in the mesh — ties role-switching and self-healing into one demoable story

---

## TIER 2 — STRETCH (only if Tier 1 is fully integrated + tested — ~6-8 hrs)

### 6. Rogue drone + trust-weighted defense (4-5 hrs)
- [ ] Inject one compromised drone broadcasting fabricated detections/pheromone
- [ ] Each drone maintains a private, pairwise trust score of peers, updated from resolved VERIFY outcomes — reused directly by role-switching (low-trust drones get deprioritized for Verifier role)
- [ ] Live toggle in demo: "inject rogue drone" button, show swarm isolate it in real time

### 7. NL rescue handoff (2 hrs)
- [ ] One triggered LLM call on SOLIDIFY lock, producing a short natural-language SITREP for ground team
- [ ] Cheapest high-payoff item on this whole list — do not skip if any time remains

### 8. Second PINN domain (acoustic propagation) (3-4 hrs)
- [ ] Only attempt if #4 went smoothly and you have real hours left
- [ ] Models sound attenuation through rubble — feeds into acoustic sensor confidence instead of flat noise

---

## TIER 3 — CUT unless everything above is done early
- [ ] Message signing / integrity check on inter-drone messages (1-2 hrs, real value, but security not agentic — one sentence in pitch, not a build priority)
- [ ] Tamper-evident hash-chained mission log (2 hrs)
- [ ] Live real-YOLO-on-real-photo demo moment, separate from sim (1 hr — nice honesty signal but lowest priority now that role-switching + NOOA carry the "is this real AI" argument)
- [ ] Market-based (Contract Net) task allocation — least visually dramatic, skip

---

## Pitch framing (write this before demo, not during)
1. **Headline**: agentic reasoning is sparse and local — drones reason (via NOOA) only when ambiguous, only with nearby peers, no central controller.
2. **Physical grounding**: pheromone/battery/thermal fields are physics-informed (PINN), not scripted noise.
3. **Resilience**: agents autonomously detect degraded comms and revise their own decision mode — self-healing is a property of individual agent reasoning, not a network ops feature.
4. **Honesty line, said first, unprompted**: sensor *input* is synthetic (no physical rubble field to stage); sensor fusion models and reasoning loop are real.
5. Security (signing, tamper-evident log) gets one sentence as "additional hardening," never a headline.
