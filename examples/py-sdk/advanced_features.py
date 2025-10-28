#!/usr/bin/env python3

import sys
import os
import json
import time
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'SDK/python'))

from openmemory import OpenMemory

def advanced_features_example():
    print('🚀 OpenMemory Python SDK - Advanced Features Example')
    print('=====================================================')
    
    # Initialize client
    client = OpenMemory(
        base_url='http://localhost:8080',
        auth_key='your_auth_key'  # Optional authentication
    )
    
    try:
        # 1. Batch operations
        print('1. Batch memory operations...')
        batch_memories = [
            "Python is a powerful programming language",
            "I learned about neural networks today",
            "The meeting went really well this afternoon",
            "Remember to buy groceries: milk, bread, eggs",
            "I feel accomplished after finishing the project"
        ]
        
        print(f'Adding {len(batch_memories)} memories...')
        start_time = time.time()
        added = []
        for content in batch_memories:
            memory = client.add(content)
            added.append(memory)
        
        batch_time = time.time() - start_time
        print(f'✅ Added {len(added)} memories in {batch_time:.2f}s')
        
        # 2. Memory decay and reinforcement
        print('\n2. Memory decay and reinforcement...')
        first_memory = added[0]
        print(f'Original salience: {first_memory.get("salience", 1.0):.3f}')
        
        # Simulate time passing
        time.sleep(1)
        
        # Retrieve the memory again to see salience changes
        query_results = client.query(first_memory['content'][:20], k=1)
        if query_results['matches']:
            retrieved = query_results['matches'][0]
            print(f'After retrieval: {retrieved.get("salience", 1.0):.3f}')
        
        # 3. Waypoint graph traversal
        print('\n3. Waypoint graph traversal...')
        graph_query = client.query("programming", k=5, use_graph=True)
        print(f'Found {len(graph_query["matches"])} memories with graph traversal')
        
        for i, match in enumerate(graph_query['matches'][:3]):
            content_preview = match['content'][:50] + "..." if len(match['content']) > 50 else match['content']
            print(f'   {i+1}. {content_preview}')
            print(f'      Sector: {match["primary_sector"]}, Score: {match["score"]:.3f}')
            if 'path' in match and match['path']:
                path_preview = ' → '.join(match['path'][:3])
                print(f'      Path: {path_preview}{"..." if len(match["path"]) > 3 else ""}')
        
        # 4. Multi-sector queries
        print('\n4. Multi-sector targeted queries...')
        sectors_to_test = ['episodic', 'semantic', 'procedural']
        
        for sector in sectors_to_test:
            sector_results = client.query_sector("learning", sector, k=2)
            print(f'   {sector}: {len(sector_results["matches"])} matches')
            for match in sector_results['matches']:
                content_preview = match['content'][:40] + "..." if len(match['content']) > 40 else match['content']
                print(f'     - {content_preview}')
        
        # 5. Memory filtering and pagination
        print('\n5. Memory filtering and pagination...')
        
        # Get memories from last 24 hours
        recent_memories = client.list_memories(limit=10, offset=0)
        print(f'Recent memories: {len(recent_memories["items"])}')
        
        # Get emotional memories specifically
        emotional_memories = client.get_by_sector('emotional', limit=5)
        print(f'Emotional memories: {len(emotional_memories["items"])}')
        
        # 6. Health check and system status
        print('\n6. System health and statistics...')
        health = client.health_check()
        print(f'System status: {health.get("status", "unknown")}')
        print(f'Total memories: {health.get("memory_count", 0)}')
        print(f'Database size: {health.get("db_size_mb", 0):.2f} MB')
        
        # Sector statistics
        sectors_info = client.get_sectors()
        if 'stats' in sectors_info:
            print('Sector distribution:')
            for stat in sectors_info['stats']:
                percentage = (stat['count'] / health.get('memory_count', 1)) * 100
                print(f'   {stat["sector"]}: {stat["count"]} ({percentage:.1f}%)')
        
        # 7. Memory deletion (careful!)
        print('\n7. Memory management...')
        test_memory = client.add("This is a test memory that will be deleted")
        print(f'Added test memory: {test_memory["id"]}')
        
        delete_result = client.delete_memory(test_memory['id'])
        print(f'Deletion successful: {delete_result}')
        
        # 8. Embedding provider information
        print('\n8. Embedding provider information...')
        try:
            # This might not be exposed in the API, but we can infer from behavior
            embedding_test = client.add("Testing embedding provider", metadata={'test': True})
            print(f'Embedding dimensions: {len(embedding_test.get("embedding", []))}')
            print('✅ Embedding provider is working correctly')
        except Exception as e:
            print(f'❓ Embedding test: {str(e)}')
        
        print('\n🎉 Advanced features demonstration complete!')
        
    except Exception as error:
        print('❌ Error:', str(error))
        print('Make sure the OpenMemory server is running on port 8080')

if __name__ == '__main__':
    advanced_features_example()