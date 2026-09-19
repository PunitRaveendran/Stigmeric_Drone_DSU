#!/usr/bin/env python3
"""
Protoplasm PINN Trainer - Ready for Gemini Antigravity
Trains Pheromone Field PINN + Battery Dynamics PINN offline.
Saves .pt models and calibration JSON.
"""

import torch
import torch.nn as nn
import numpy as np
import json
from pathlib import Path

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
OUTPUT_DIR = Path(__file__).parent
SEED = 42
torch.manual_seed(SEED)
np.random.seed(SEED)

print(f"Using device: {DEVICE}")


class MLP(nn.Module):
    def __init__(self, in_dim, hidden=64, out_dim=1, layers=4):
        super().__init__()
        modules = [nn.Linear(in_dim, hidden), nn.Tanh()]
        for _ in range(layers - 2):
            modules += [nn.Linear(hidden, hidden), nn.Tanh()]
        modules.append(nn.Linear(hidden, out_dim))
        self.net = nn.Sequential(*modules)

    def forward(self, x):
        return self.net(x)


# ==================== Pheromone PINN ====================
class PheromonePINN(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = MLP(in_dim=4, hidden=64, out_dim=1, layers=5)

    def forward(self, x, y, t, gamma):
        inp = torch.cat([x, y, t, gamma], dim=-1)
        return torch.sigmoid(self.net(inp))


def train_pheromone(epochs=3500, n_collocation=3500, lr=1e-3):
    print("\n=== Training Pheromone PINN ===")
    model = PheromonePINN().to(DEVICE)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    D = 0.05

    for ep in range(epochs):
        x = torch.rand(n_collocation, 1, device=DEVICE, requires_grad=True)
        y = torch.rand(n_collocation, 1, device=DEVICE, requires_grad=True)
        t = torch.rand(n_collocation, 1, device=DEVICE, requires_grad=True)
        gamma = torch.where(
            torch.rand(n_collocation, 1, device=DEVICE) > 0.5,
            torch.full((n_collocation, 1), 0.010, device=DEVICE),
            torch.full((n_collocation, 1), 0.055, device=DEVICE),
        )

        P = model(x, y, t, gamma)
        ones = torch.ones_like(P)

        dP_dt = torch.autograd.grad(P, t, grad_outputs=ones, create_graph=True)[0]
        dP_dx = torch.autograd.grad(P, x, grad_outputs=ones, create_graph=True)[0]
        dP_dy = torch.autograd.grad(P, y, grad_outputs=ones, create_graph=True)[0]
        d2P_dx2 = torch.autograd.grad(dP_dx, x, grad_outputs=ones, create_graph=True)[0]
        d2P_dy2 = torch.autograd.grad(dP_dy, y, grad_outputs=ones, create_graph=True)[0]

        residual = dP_dt - (D * (d2P_dx2 + d2P_dy2) - gamma * P)
        loss_pde = torch.mean(residual ** 2)

        t0 = torch.zeros_like(t)
        loss_ic = torch.mean(model(x, y, t0, gamma) ** 2)

        loss = loss_pde + 0.5 * loss_ic
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

        if (ep + 1) % 500 == 0:
            print(f"  Epoch {ep+1:4d} | Loss {loss.item():.6f}")

    path = OUTPUT_DIR / "pinn_pheromone.pt"
    torch.save(model.state_dict(), path)
    print(f"Saved → {path}")
    return model


# ==================== Battery PINN ====================
class BatteryPINN(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = MLP(in_dim=1 + 1 + 1 + 3, hidden=64, out_dim=1, layers=4)

    def forward(self, t, v, z, role):
        inp = torch.cat([t, v, z, role], dim=-1)
        return torch.sigmoid(self.net(inp))


def physical_power(v, z, role_idx):
    """
    Full Multirotor Aerodynamic Power Dynamics ODE:
    P_total(v, z, role) = P_hover(z) + P_payload(role) + k_aero * v^3

    Where:
      - P_hover(z): Base thrust power to hover mg = T, scaled by air density rho(z) = rho0 * exp(-z/H0)
      - P_payload(role): Avionics, NPU perception, and RF amplification power draw
      - k_aero * v^3: Parasitic aerodynamic fuselage drag scaling with the CUBE of velocity (v^3)
    """
    # 1. Altitude air density & hover power
    H0 = 8.0
    rho_ratio = torch.exp(-z / H0)
    P_hover = 0.28 / torch.sqrt(rho_ratio + 1e-6)

    # 2. Payload power by role:
    #    Scout (role 0): GPU/NPU inference (YOLO/YAMNet) + multi-spectral sensor rig (0.18)
    #    Relay (role 1): High-power RF mesh amplification & forwarding (0.25)
    #    Sentinel (role 2): Ultra-low-power radio beacon & station-keeping (0.04)
    payload = torch.zeros_like(v)
    payload = torch.where(role_idx == 0, torch.full_like(v, 0.18), payload)  # Scout
    payload = torch.where(role_idx == 1, torch.full_like(v, 0.25), payload)  # Relay
    payload = torch.where(role_idx == 2, torch.full_like(v, 0.04), payload)  # Sentinel

    # 3. Parasitic aerodynamic drag: k_aero * v^3
    k_aero = 0.35
    P_par = k_aero * (v ** 3)

    # Calibration scale factor ensuring normalized battery B(t) remains in [0.05, 1.0] across t in [0, 1]
    scale = 0.45
    return scale * (P_hover + payload + P_par)


def train_battery(epochs=3500, n_collocation=4000, lr=2e-3):
    print("\n=== Training Battery PINN (Full V³ Aerodynamic Model) ===")
    model = BatteryPINN().to(DEVICE)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

    final_residual = 0.0

    for ep in range(epochs):
        t = torch.rand(n_collocation, 1, device=DEVICE, requires_grad=True)
        v = torch.rand(n_collocation, 1, device=DEVICE) * 1.5
        z = torch.rand(n_collocation, 1, device=DEVICE) * 0.6 + 0.1
        role_idx = torch.randint(0, 3, (n_collocation, 1), device=DEVICE)
        role_onehot = torch.zeros(n_collocation, 3, device=DEVICE)
        role_onehot.scatter_(1, role_idx, 1.0)

        P = physical_power(v, z, role_idx.float())
        B = model(t, v, z, role_onehot)

        # Physics ODE loss: dB/dt = -P  =>  residual = dB/dt + P = 0
        dB_dt = torch.autograd.grad(B, t, grad_outputs=torch.ones_like(B), create_graph=True)[0]
        residual = dB_dt + P
        loss_ode = torch.mean(residual ** 2)

        # Initial condition: at t=0, battery is 100% (B = 1.0)
        t0 = torch.zeros_like(t)
        B0 = model(t0, v, z, role_onehot)
        loss_ic = torch.mean((B0 - 1.0) ** 2)

        # Analytical trajectory anchor: B*(t) = 1.0 - P * t
        B_exact = torch.clamp(1.0 - P * t, min=0.05, max=1.0)
        loss_data = torch.mean((B - B_exact) ** 2)

        loss = loss_ode + 2.0 * loss_ic + 1.0 * loss_data

        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
        scheduler.step()

        final_residual = loss_ode.item()

        if (ep + 1) % 500 == 0:
            print(f"  Epoch {ep+1:4d} | Total Loss: {loss.item():.6f} | ODE Residual: {loss_ode.item():.6f} | IC Loss: {loss_ic.item():.6f}")

    path = OUTPUT_DIR / "pinn_battery.pt"
    torch.save(model.state_dict(), path)
    print(f"Saved → {path}")

    # Evaluation & Verification across Roles and Speeds
    print("\n" + "=" * 65)
    print("BATTERY PINN VERIFICATION: ROLE & V³ AERODYNAMIC POWER COMPARISON")
    print("=" * 65)
    print(f"Final Physics Residual Loss: {final_residual:.6f} (baseline was ~1.28)")
    print("-" * 65)

    model.eval()
    test_speeds = [0.0, 0.5, 1.0, 1.5]
    roles_info = [
        ("Scout", [1.0, 0.0, 0.0], 0),
        ("Relay", [0.0, 1.0, 0.0], 1),
        ("Sentinel", [0.0, 0.0, 1.0], 2),
    ]

    results = {}
    for role_name, role_vec, role_id in roles_info:
        r_tensor = torch.tensor([role_vec], dtype=torch.float32, device=DEVICE)
        results[role_name] = []
        for v_val in test_speeds:
            v_tensor = torch.tensor([[v_val]], dtype=torch.float32, device=DEVICE)
            z_tensor = torch.tensor([[0.25]], dtype=torch.float32, device=DEVICE)
            t_test = torch.tensor([[0.5]], dtype=torch.float32, device=DEVICE, requires_grad=True)

            B_pred = model(t_test, v_tensor, z_tensor, r_tensor)
            dB_dt = torch.autograd.grad(B_pred, t_test)[0].item()
            pred_drain = -dB_dt
            true_p = physical_power(v_tensor, z_tensor, torch.tensor([[role_id]], dtype=torch.float32, device=DEVICE)).item()

            results[role_name].append((v_val, pred_drain, true_p, B_pred.item()))
            print(f"  [{role_name:8s}] v={v_val:4.1f} | PINN Drain: {pred_drain:.4f} | True P: {true_p:.4f} | B(t=0.5): {B_pred.item():.4f}")

    print("-" * 65)
    print("V³ (Speed-Cubed) Power Verification:")
    for role_name in ["Scout", "Relay", "Sentinel"]:
        hover_drain = results[role_name][0][1]
        sprint_drain = results[role_name][3][1]
        ratio = sprint_drain / hover_drain
        print(f"  {role_name:8s}: Hover (v=0.0)={hover_drain:.4f} -> Sprint (v=1.5)={sprint_drain:.4f} ({ratio:.2f}x higher drain)")

    print("=" * 65 + "\n")
    return model


# ==================== Thermal Cooling PINN (Tier 2) ====================
class ThermalPINN(nn.Module):
    def __init__(self):
        super().__init__()
        # Inputs: t, T0, k, is_bio
        self.net = MLP(in_dim=4, hidden=64, out_dim=1, layers=4)

    def forward(self, t, T0, k, is_bio):
        inp = torch.cat([t, T0, k, is_bio], dim=-1)
        return torch.sigmoid(self.net(inp))


def train_thermal(epochs=2500, n_collocation=3000, lr=1e-3):
    print("\n=== Training Thermal Cooling PINN (Tier 2) ===")
    model = ThermalPINN().to(DEVICE)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    T_ambient = 0.15

    for ep in range(epochs):
        t = torch.rand(n_collocation, 1, device=DEVICE, requires_grad=True)
        T0 = torch.rand(n_collocation, 1, device=DEVICE) * 0.5 + 0.5  # initial hot reading [0.5, 1.0]
        k = torch.rand(n_collocation, 1, device=DEVICE) * 0.05 + 0.02  # cooling rate
        is_bio = (torch.rand(n_collocation, 1, device=DEVICE) > 0.5).float()  # 1 for survivor, 0 for debris

        T = model(t, T0, k, is_bio)
        dT_dt = torch.autograd.grad(T, t, grad_outputs=torch.ones_like(T), create_graph=True)[0]

        # Biological homeostatic maintenance maintains core temp, inanimate debris cools to ambient
        q_metabolic = is_bio * (k * (T0 - T_ambient))
        residual = dT_dt + k * (T - T_ambient) - q_metabolic
        loss_ode = torch.mean(residual ** 2)

        # Initial condition: at t=0, T = T0
        t0 = torch.zeros_like(t)
        loss_ic = torch.mean((model(t0, T0, k, is_bio) - T0) ** 2)

        loss = loss_ode + 1.2 * loss_ic
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

        if (ep + 1) % 500 == 0:
            print(f"  Epoch {ep+1:4d} | Loss {loss.item():.6f}")

    path = OUTPUT_DIR / "pinn_thermal.pt"
    torch.save(model.state_dict(), path)
    print(f"Saved → {path}")
    return model


def export_calibration():
    calib = {
        "pheromone": {
            "D": 0.05,
            "gamma_low": 0.010,
            "gamma_high": 0.055
        },
        "battery": {
            "roles": ["Scout", "Relay", "Sentinel"],
            "v_ref": 3.5,
            "k_aero": 0.012,
            "k_hover": 0.014,
            "k_alt": 0.004,
            "payload_power": {
                "Scout": 0.008,
                "Relay": 0.012,
                "Sentinel": 0.002,
                "Default": 0.006
            },
            "approx_drain_per_tick": {
                "Scout": 0.028,
                "Relay": 0.031,
                "Sentinel": 0.011,
                "default": 0.022
            },
            "v3_aerodynamic_model": True
        },
        "thermal": {
            "k_debris": 0.045,
            "k_biological": 0.001,
            "T_ambient": 0.15,
            "cooling_half_life_ticks": 75,
            "persistence_threshold": 0.65,
            "description": "Newtonian Thermal Cooling & Homeostatic Biological PINN"
        }
    }
    path = OUTPUT_DIR / "pinn_calibration.json"
    with open(path, "w") as f:
        json.dump(calib, f, indent=2)
    print(f"Saved → {path}")


if __name__ == "__main__":
    import sys
    print("Protoplasm PINN Trainer")
    print("=" * 50)
    
    if len(sys.argv) > 1 and ("--battery" in sys.argv or "--battery-only" in sys.argv):
        print("Running Battery PINN training only...")
        train_battery()
        export_calibration()
    else:
        train_pheromone()
        train_battery()
        train_thermal()
        export_calibration()
    print("\n✅ All requested models trained and saved successfully.")
