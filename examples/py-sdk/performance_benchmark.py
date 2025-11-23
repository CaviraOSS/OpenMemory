#!/usr/bin/env python3

import sys
import os
import time
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'sdk-py', 'src'))

from openmemory import OpenMemory

def benchmark():
    print('🧠 OpenMemory Python SDK - Performance Benchmark')
    print('================================================')
    
    mem = OpenMemory(
        path='./data/benchmark.sqlite',
        tier='fast',
        embeddings={'provider': 'synthetic'}
    )
    
    print('✅ OpenMemory initialized\n')
    
    # Benchmark 1: Add performance
    print('1️⃣  ADD PERFORMANCE')
    num_memories = 100
    start = time.time()
    
    for i in range(num_memories):
        mem.add(f"Test memory number {i} with some additional content to make it realistic")
    
    end = time.time()
    add_time = end - start
    print(f'   ✅ Added {num_memories} memories in {add_time:.2f}s')
    print(f'   ✅ Average: {add_time/num_memories*1000:.2f}ms per memory\n')
    
    # Benchmark 2: Query performance
    print('2️⃣  QUERY PERFORMANCE')
    queries = [
        "test memory",
        "additional content",
        "realistic data",
        "number memory",
        "content test"
    ]
    
    query_times = []
    for query in queries:
        start = time.time()
        results = mem.query(query, limit=10)
        end = time.time()
        query_times.append(end - start)
    
    avg_query_time = sum(query_times) / len(query_times)
    print(f'   ✅ Ran {len(queries)} queries')
    print(f'   ✅ Average query time: {avg_query_time*1000:.2f}ms\n')
    
    # Benchmark 3: GetAll performance
    print('3️⃣  GETALL PERFORMANCE')
    start = time.time()
    all_mems = mem.getAll()
    end = time.time()
    getall_time = end - start
    print(f'   ✅ Retrieved {len(all_mems)} memories in {getall_time*1000:.2f}ms\n')
    
    # Benchmark 4: Delete performance
    print('4️⃣  DELETE PERFORMANCE')
    memories_to_delete = all_mems[:20]  # Delete first 20
    start = time.time()
    
    for m in memories_to_delete:
        mem.delete(m['id'])
    
    end = time.time()
    delete_time = end - start
    print(f'   ✅ Deleted {len(memories_to_delete)} memories in {delete_time*1000:.2f}ms')
    print(f'   ✅ Average: {delete_time/len(memories_to_delete)*1000:.2f}ms per delete\n')
    
    # Summary
    print('📊 SUMMARY')
    print(f'   Total memories added: {num_memories}')
    print(f'   Add throughput: {num_memories/add_time:.2f} memories/sec')
    print(f'   Query latency: {avg_query_time*1000:.2f}ms')
    print(f'   GetAll latency: {getall_time*1000:.2f}ms')
    
    print('\n✨ Benchmark complete!')
    mem.close()

if __name__ == '__main__':
    benchmark()