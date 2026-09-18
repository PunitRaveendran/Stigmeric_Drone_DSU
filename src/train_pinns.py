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
    g, m, rho0, H0, A_disk, CdA, eta, E_cap = 1.0, 1.0, 1.0, 8.0, 0.3, 0.15, 0.78, 1.0
    rho = rho0 * torch.exp(-z / H0)
    P_ind = (m * g) ** 1.5 / torch.sqrt(2 * rho * A_disk + 1e-6)
    P_par = 0.5 * CdA * rho * (v ** 3)
    P_base = 0.12
    payload = torch.zeros_like(v)
    payload = torch.where(role_idx == 0, torch.full_like(v, 0.18), payload)  # Scout
    payload = torch.where(role_idx == 1, torch.full_like(v, 0.22), payload)  # Relay
    payload = torch.where(role_idx == 2, torch.full_like(v, 0.04), payload)  # Sentinel
    return (P_ind + P_par + P_base + payload) / (E_cap * eta)


def train_battery(epochs=2500, n_collocation=3000, lr=1e-3):
    print("\n=== Training Battery PINN ===")
    model = BatteryPINN().to(DEVICE)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)

    for ep in range(epochs):
        t = torch.rand(n_collocation, 1, device=DEVICE, requires_grad=True)
        v = torch.rand(n_collocation, 1, device=DEVICE) * 1.5
        z = torch.rand(n_collocation, 1, device=DEVICE) * 0.6 + 0.1
        role_idx = torch.randint(0, 3, (n_collocation, 1), device=DEVICE)
        role_onehot = torch.zeros(n_collocation, 3, device=DEVICE)
        role_onehot.scatter_(1, role_idx, 1.0)

        B = model(t, v, z, role_onehot)
        dB_dt = torch.autograd.grad(B, t, grad_outputs=torch.ones_like(B), create_graph=True)[0]
        residual = dB_dt + physical_power(v, z, role_idx.float())
        loss_ode = torch.mean(residual ** 2)

        t0 = torch.zeros_like(t)
        loss_ic = torch.mean((model(t0, v, z, role_onehot) - 1.0) ** 2)

        loss = loss_ode + 0.8 * loss_ic
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

        if (ep + 1) % 500 == 0:
            print(f"  Epoch {ep+1:4d} | Loss {loss.item():.6f}")

    path = OUTPUT_DIR / "pinn_battery.pt"
    torch.save(model.state_dict(), path)
    print(f"Saved → {path}")
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
            "approx_drain_per_tick": {
                "Scout": 0.028,
                "Relay": 0.031,
                "Sentinel": 0.011,
                "default": 0.022
            }
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
    print("Protoplasm PINN Trainer")
    print("=" * 50)
    train_pheromone()
    train_battery()
    train_thermal()
    export_calibration()
    print("\n✅ All files saved successfully.")
