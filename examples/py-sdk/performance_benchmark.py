#!/usr/bin/env python3

import sys
import os
import asyncio
import aiohttp
import time
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'SDK/python'))

from openmemory import OpenMemory

async def performance_benchmark():
    print('⚡ OpenMemory Python SDK - Performance Benchmark')
    print('===============================================')
    
    client = OpenMemory(base_url='http://localhost:8080')
    
    try:
        # Benchmark data
        test_memories = [
            "Machine learning algorithms process large datasets efficiently",
            "I had lunch at the Italian restaurant downtown today",
            "To install Python packages, use pip install package_name",
            "I'm feeling optimistic about the upcoming project launch",
            "What is the meaning of life and our purpose here?",
            "Neural networks consist of interconnected nodes called neurons",
            "Yesterday I met my old friend Sarah at the coffee shop",
            "First backup your data, then format the hard drive",
            "This presentation made me feel really confident and proud",
            "I often wonder about the nature of consciousness and reality"
        ]
        
        print(f'Starting benchmark with {len(test_memories)} test memories...')
        
        # 1. Addition benchmark
        print('\n1. Memory addition performance...')
        start_time = time.time()
        
        added_memories = []
        for i, content in enumerate(test_memories):
            memory = client.add(content)
            added_memories.append(memory)
            print(f'   Added memory {i+1}/{len(test_memories)} [{memory["primary_sector"]}]')
        
        add_time = time.time() - start_time
        print(f'✅ Added {len(added_memories)} memories in {add_time:.2f}s')
        print(f'   Average: {add_time/len(added_memories):.3f}s per memory')
        
        # 2. Query performance
        print('\n2. Query performance benchmark...')
        queries = [
            "machine learning",
            "lunch restaurant", 
            "install python",
            "feeling optimistic",
            "meaning of life"
        ]
        
        query_times = []
        for query in queries:
            start_time = time.time()
            results = client.query(query, k=5)
            query_time = time.time() - start_time
            query_times.append(query_time)
            
            print(f'   Query "{query}": {len(results["matches"])} results in {query_time:.3f}s')
        
        avg_query_time = sum(query_times) / len(query_times)
        print(f'✅ Average query time: {avg_query_time:.3f}s')
        
        # 3. Sector-specific performance
        print('\n3. Sector-specific query performance...')
        sectors = ['episodic', 'semantic', 'procedural', 'emotional', 'reflective']
        
        for sector in sectors:
            start_time = time.time()
            results = client.query_sector("test", sector, k=3)
            sector_time = time.time() - start_time
            
            print(f'   {sector}: {len(results["matches"])} results in {sector_time:.3f}s')
        
        # 4. Bulk operations simulation
        print('\n4. Bulk operations performance...')
        bulk_content = [
            f"Bulk test memory number {i} with some content to test" 
            for i in range(20)
        ]
        
        start_time = time.time()
        bulk_added = []
        for content in bulk_content:
            memory = client.add(content)
            bulk_added.append(memory)
        
        bulk_time = time.time() - start_time
        print(f'✅ Bulk added {len(bulk_added)} memories in {bulk_time:.2f}s')
        print(f'   Throughput: {len(bulk_added)/bulk_time:.1f} memories/second')
        
        # 5. Memory retrieval performance
        print('\n5. Memory retrieval performance...')
        memory_ids = [mem['id'] for mem in added_memories[:5]]
        
        start_time = time.time()
        retrieved = []
        for mem_id in memory_ids:
            memory = client.get_memory(mem_id)
            retrieved.append(memory)
        
        retrieval_time = time.time() - start_time
        print(f'✅ Retrieved {len(retrieved)} memories in {retrieval_time:.3f}s')
        print(f'   Average: {retrieval_time/len(retrieved):.3f}s per retrieval')
        
        # 6. System resources check
        print('\n6. System resource usage...')
        health = client.health_check()
        print(f'   Total memories in system: {health.get("memory_count", 0)}')
        print(f'   Database size: {health.get("db_size_mb", 0):.2f} MB')
        print(f'   Memory per entry: {health.get("db_size_mb", 0) * 1024 / max(health.get("memory_count", 1), 1):.2f} KB')
        
        # 7. Cleanup test memories
        print('\n7. Cleanup performance...')
        cleanup_start = time.time()
        deleted_count = 0
        
        for memory in bulk_added:
            try:
                client.delete_memory(memory['id'])
                deleted_count += 1
            except:
                pass
        
        cleanup_time = time.time() - cleanup_start
        print(f'✅ Cleaned up {deleted_count} test memories in {cleanup_time:.2f}s')
        
        # Performance summary
        print('\n📊 Performance Summary:')
        print('======================')
        print(f'Memory addition: {add_time/len(added_memories)*1000:.1f}ms per memory')
        print(f'Query performance: {avg_query_time*1000:.1f}ms average')
        print(f'Bulk throughput: {len(bulk_added)/bulk_time:.1f} memories/second')
        print(f'Memory retrieval: {retrieval_time/len(retrieved)*1000:.1f}ms per memory')
        
    except Exception as error:
        print('❌ Error:', str(error))
        print('Make sure the OpenMemory server is running on port 8080')

if __name__ == '__main__':
    asyncio.run(performance_benchmark())