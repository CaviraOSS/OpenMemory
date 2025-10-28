#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'SDK/python'))

from openmemory import OpenMemory, SECTORS

def brain_sectors_example():
    print('🧠 OpenMemory Python SDK - Brain Sectors Example')
    print('=================================================')
    
    # Initialize client
    client = OpenMemory(base_url='http://localhost:8080')
    
    try:
        # Get sector information
        print('1. Getting sector information...')
        sectors = client.get_sectors()
        print('✅ Available sectors:', sectors['sectors'])
        print('✅ Sector configurations:', list(sectors.get('configs', {}).keys()))
        
        # Add memories for each sector
        print('\n2. Adding memories to different sectors...')
        test_memories = [
            {
                'content': "I went to the coffee shop this morning at 9 AM",
                'expected_sector': "episodic"
            },
            {
                'content': "Machine learning is a subset of artificial intelligence",
                'expected_sector': "semantic"
            },
            {
                'content': "First, open the terminal. Then, run pip install.",
                'expected_sector': "procedural"
            },
            {
                'content': "I feel so excited and happy about this new opportunity!",
                'expected_sector': "emotional"
            },
            {
                'content': "I wonder what the purpose of all this learning really is",
                'expected_sector': "reflective"
            }
        ]
        
        added_memories = []
        for test in test_memories:
            memory = client.add(test['content'])
            added_memories.append(memory)
            
            match = '✅' if memory['primary_sector'] == test['expected_sector'] else '❓'
            print(f"{match} \"{test['content']}\"")
            print(f"   Expected: {test['expected_sector']}, Got: {memory['primary_sector']}")
            print(f"   All sectors: [{', '.join(memory['sectors'])}]")
        
        # Query specific sectors
        print('\n3. Querying specific sectors...')
        
        episodic_results = client.query_sector("morning coffee", "episodic")
        print(f"✅ Episodic memories ({len(episodic_results['matches'])}):")
        for match in episodic_results['matches']:
            content_preview = match['content'][:60] + "..." if len(match['content']) > 60 else match['content']
            print(f"   - {content_preview}")
        
        emotional_results = client.query_sector("excited happy", "emotional")
        print(f"✅ Emotional memories ({len(emotional_results['matches'])}):")
        for match in emotional_results['matches']:
            content_preview = match['content'][:60] + "..." if len(match['content']) > 60 else match['content']
            print(f"   - {content_preview}")
        
        # Cross-sector query
        print('\n4. Cross-sector query...')
        cross_results = client.query("learning and feeling excited", k=10)
        print(f"✅ Cross-sector results ({len(cross_results['matches'])}):")
        for i, match in enumerate(cross_results['matches']):
            content_preview = match['content'][:50] + "..." if len(match['content']) > 50 else match['content']
            print(f"   {i+1}. [{match['primary_sector']}] {content_preview}")
            path_str = ' → '.join(match['path'])
            print(f"      Score: {match['score']:.3f}, Path: [{path_str}]")
        
        # Get memories by sector
        print('\n5. Getting memories by sector...')
        emotional_memories = client.get_by_sector("emotional", limit=10)
        print(f"✅ All emotional memories: {len(emotional_memories['items'])}")
        
        # Sector statistics
        print('\n6. Sector statistics...')
        if 'stats' in sectors:
            for stat in sectors['stats']:
                print(f"   {stat['sector']}: {stat['count']} memories, avg salience: {stat.get('avg_salience', 0):.3f}")
        
    except Exception as error:
        print('❌ Error:', str(error))
        print('Make sure the OpenMemory server is running on port 8080')

if __name__ == '__main__':
    brain_sectors_example()