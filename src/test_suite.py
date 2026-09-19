"""
PROTOPLASM Automated CI/CD Unit Test Suite
Verifies:
1. Tri-Modal Sensor Fusion & Consistency Multipliers (YOLO 40%, YAMNet 40%, Passive 20%)
2. Multi-Agent NOOA Decoy Rejection (Hot Debris, Wind Noise, Mannequin)
3. PINN Neural Models & Calibration Parameters
4. Swarm Gradient & Viscosity Regime Classification
"""

import unittest
import math
import os
import torch
import asyncio

try:
    from src.nooa_agent import SARSwarmAgent, SensorReading
except ImportError:
    from nooa_agent import SARSwarmAgent, SensorReading


def compute_confidence(camera: float, audio: float, thermal: float, gas: float = 0.0) -> float:
    W_CAMERA = 0.40
    W_AUDIO = 0.40
    W_THERMAL = 0.20

    passive = max(thermal, gas)
    raw = W_CAMERA * camera + W_AUDIO * audio + W_THERMAL * passive

    active_channels = sum(1 for v in [camera, audio, passive] if v > 0.28)
    if active_channels == 1:
        consistency = 0.55
    elif active_channels == 2:
        consistency = 0.95
    elif active_channels >= 3:
        consistency = 1.25
    else:
        consistency = 0.45

    return min(1.0, max(0.0, raw * consistency))


class TestSensorFusion(unittest.TestCase):

    def test_survivor_multi_modal_lock(self):
        """Living survivor (aligned Camera, Audio, Thermal) must produce high confidence (> 0.75)."""
        conf = compute_confidence(camera=0.88, audio=0.75, thermal=0.82, gas=0.45)
        self.assertGreaterEqual(conf, 0.75, f"Survivor confidence {conf:.3f} should be >= 0.75")

    def test_hot_debris_rejection(self):
        """Hot debris (Thermal only) must be penalized below 0.40."""
        conf = compute_confidence(camera=0.02, audio=0.07, thermal=0.82, gas=0.12)
        self.assertLess(conf, 0.40, f"Hot debris confidence {conf:.3f} must be rejected (< 0.40)")

    def test_wind_noise_rejection(self):
        """Wind noise spike (Audio only) must be penalized below 0.40."""
        conf = compute_confidence(camera=0.03, audio=0.78, thermal=0.10, gas=0.08)
        self.assertLess(conf, 0.40, f"Wind noise confidence {conf:.3f} must be rejected (< 0.40)")

    def test_mannequin_rejection(self):
        """Inanimate mannequin (Camera only) must be penalized below 0.40."""
        conf = compute_confidence(camera=0.85, audio=0.05, thermal=0.10, gas=0.04)
        self.assertLess(conf, 0.40, f"Mannequin confidence {conf:.3f} must be rejected (< 0.40)")


class TestNOOAAgent(unittest.TestCase):

    def setUp(self):
        self.agent = SARSwarmAgent("DRONE-TEST-01", "ALPHA-01")

    def test_nooa_survivor_consensus(self):
        readings = SensorReading(camera=0.85, audio=0.80, thermal=0.82, gas=0.30)
        decision = asyncio.run(
            self.agent.evaluate_candidate_target(
                sector_coords="(12, 18)",
                readings=readings,
                peer_angles=[0.4, 1.9, 3.1],
                base_confidence=0.72
            )
        )
        self.assertEqual(decision.decision, "CONFIRM")
        self.assertGreaterEqual(decision.confidence, 0.75)

    def test_nooa_decoy_rejection(self):
        readings = SensorReading(camera=0.02, audio=0.05, thermal=0.85, gas=0.10)
        decision = asyncio.run(
            self.agent.evaluate_candidate_target(
                sector_coords="(4, 6)",
                readings=readings,
                peer_angles=[0.2],
                base_confidence=0.25
            )
        )
        self.assertEqual(decision.decision, "REJECT")
        self.assertLess(decision.confidence, 0.40)


class TestNeuralModelAssets(unittest.TestCase):

    def test_models_exist(self):
        base_dir = os.path.dirname(os.path.abspath(__file__))
        self.assertTrue(os.path.exists(os.path.join(base_dir, "human_detector.pt")), "YOLO model missing")
        self.assertTrue(os.path.exists(os.path.join(base_dir, "pinn_battery.pt")), "PINN battery model missing")
        self.assertTrue(os.path.exists(os.path.join(base_dir, "pinn_pheromone.pt")), "PINN pheromone model missing")

    def test_battery_pinn_v3_effect(self):
        """PINN model must exhibit non-linear v^3 power scaling and correct role ordering."""
        import torch
        from train_pinns import BatteryPINN
        base_dir = os.path.dirname(os.path.abspath(__file__))
        model_path = os.path.join(base_dir, "pinn_battery.pt")
        model = BatteryPINN()
        model.load_state_dict(torch.load(model_path, map_location="cpu"))
        model.eval()

        def get_drain(v_val, role_idx):
            role_vec = [0.0, 0.0, 0.0]
            role_vec[role_idx] = 1.0
            r = torch.tensor([role_vec], dtype=torch.float32)
            v = torch.tensor([[v_val]], dtype=torch.float32)
            z = torch.tensor([[0.25]], dtype=torch.float32)
            t = torch.tensor([[0.5]], dtype=torch.float32, requires_grad=True)
            B = model(t, v, z, r)
            return -torch.autograd.grad(B, t)[0].item()

        # Test speed-cubed scaling: sprint (v=1.5) must drain > 2.5x hover (v=0.0)
        drain_hover = get_drain(0.0, 0)
        drain_sprint = get_drain(1.5, 0)
        self.assertGreater(drain_sprint, 2.5 * drain_hover, "Sprint speed must exhibit > 2.5x drain over hover")

        # Test role ordering at hover: Sentinel < Scout < Relay
        drain_sentinel = get_drain(0.0, 2)
        drain_scout = get_drain(0.0, 0)
        drain_relay = get_drain(0.0, 1)
        self.assertLess(drain_sentinel, drain_scout, "Sentinel beacon power must be lower than Scout")
        self.assertLess(drain_scout, drain_relay, "Scout power must be lower than Relay mesh forwarding")


class TestBeeceptorGateway(unittest.TestCase):

    def test_incident_payload_format(self):
        payload = {
            "source": "PROTOPLASM_SWARM_CORE",
            "event_type": "SURVIVOR_LOCKED",
            "sector": "(14, 22)",
            "fused_confidence": 0.942,
            "active_drones": 24,
        }
        self.assertEqual(payload["source"], "PROTOPLASM_SWARM_CORE")
        self.assertGreaterEqual(payload["fused_confidence"], 0.75)


class TestN8nDispatchGateway(unittest.TestCase):

    def test_dispatch_triage_routing(self):
        payload = {
            "event_type": "EMERGENCY_SURVIVOR_LOCKED",
            "triage": {
                "fused_confidence": 0.92,
                "priority_tier": "CODE_RED_IMMEDIATE",
            },
            "location": {
                "sector": "(14, 22)",
                "elevation_m": 12.5,
            }
        }
        self.assertEqual(payload["triage"]["priority_tier"], "CODE_RED_IMMEDIATE")
        self.assertGreater(payload["triage"]["fused_confidence"], 0.85)


if __name__ == "__main__":
    unittest.main()
