
import asyncio
import time
import random
import argparse
from openmemory.client import Memory

# ==================================================================================
# BENCHMARK TOOL
# ==================================================================================
# Stress tests the OpenMemory instance.
# - Insert Throughput
# - Search Latency
# - Concurrent Load
# ==================================================================================

async def worker_insert(mode_id: int, count: int):
    mem = Memory()
    times = []
    
    for i in range(count):
        start = time.time()
        txt = f"benchmark_data_{mode_id}_{i}_{random.random()}"
        await mem.add(txt, user_id=f"bench_user_{mode_id}")
        dur = time.time() - start
        times.append(dur)
        
    return times

async def worker_search(mode_id: int, count: int):
    mem = Memory()
    times = []
    
    for i in range(count):
        start = time.time()
        await mem.search(f"benchmark_data_{mode_id}", user_id=f"bench_user_{mode_id}", limit=5)
        dur = time.time() - start
        times.append(dur)
        
    return times

async def run_bench(workers: int, ops_per_worker: int, mode: str):
    print(f"-> Starting {mode.upper()} benchmark:")
    print(f"   Workers: {workers}")
    print(f"   Ops/Worker: {ops_per_worker}")
    print(f"   Total Ops: {workers * ops_per_worker}")
    
    start_total = time.time()
    
    tasks = []
    for w in range(workers):
        if mode == 'insert':
            tasks.append(worker_insert(w, ops_per_worker))
        else:
            tasks.append(worker_search(w, ops_per_worker))
            
    results = await asyncio.gather(*tasks)
    
    total_dur = time.time() - start_total
    
    # Flatten times
    all_times = [t for worker_times in results for t in worker_times]
    avg_lat = sum(all_times) / len(all_times)
    min_lat = min(all_times)
    max_lat = max(all_times)
    throughput = len(all_times) / total_dur
    
    print("\n[Results]")
    print(f" Total Time: {total_dur:.3f}s")
    print(f" Throughput: {throughput:.2f} ops/sec")
    print(f" Latency (Avg): {avg_lat*1000:.2f}ms")
    print(f" Latency (Min): {min_lat*1000:.2f}ms")
    print(f" Latency (Max): {max_lat*1000:.2f}ms")
    print("------------------------------------------------")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--workers', type=int, default=4)
    parser.add_argument('--count', type=int, default=50) # ops per worker
    parser.add_argument('--mode', choices=['insert', 'search', 'both'], default='both')
    
    args = parser.parse_args()
    
    if args.mode in ['insert', 'both']:
        asyncio.run(run_bench(args.workers, args.count, 'insert'))
        
    if args.mode in ['search', 'both']:
         # small pause
        time.sleep(1)
        asyncio.run(run_bench(args.workers, args.count, 'search'))
