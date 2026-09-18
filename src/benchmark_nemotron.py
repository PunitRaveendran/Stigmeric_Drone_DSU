import asyncio
import time

try:
    from src.nooa_agent import SARSwarmAgent, SensorReading
except ImportError:
    from nooa_agent import SARSwarmAgent, SensorReading

async def main():
    agent = SARSwarmAgent("DRONE-LEAD-01", "ALPHA-LEAD")
    readings = SensorReading(camera=0.82, audio=0.74, thermal=0.80, gas=0.05)
    
    print("Executing NOOA evaluate_candidate_target with live NVIDIA Nemotron...")
    t0 = time.perf_counter()
    decision = await agent.evaluate_candidate_target(
        sector_coords="(14, 22)",
        readings=readings,
        peer_angles=[0.5, 1.8, 3.2],
        base_confidence=0.68
    )
    t1 = time.perf_counter()
    
    print("=" * 60)
    print(f"Total Inference Time: {(t1 - t0) * 1000:.2f} ms ({(t1 - t0):.3f}s)")
    print(f"Decision:             {decision.decision}")
    print(f"Fused Confidence:     {decision.confidence}")
    print(f"Channel Alignment:    {decision.channel_alignment}")
    print(f"LLM Reasoning:        {decision.reasoning}")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
