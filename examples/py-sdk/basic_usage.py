#!/usr/bin/env python3

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'sdk-py', 'src'))

from openmemory import OpenMemory

def basic_example():
    print('🧠 OpenMemory Python SDK - Basic Example')
    print('=========================================')
    
    # Initialize with local-first configuration
    mem = OpenMemory(
        path='./data/demo.sqlite',
        tier='fast',
        embeddings={
            'provider': 'synthetic'  # Use 'openai', 'gemini', 'ollama', or 'synthetic'
        }
    )
    
    print('✅ OpenMemory initialized (local-first mode)')
    
    # Add some memories
    print('\n1. Adding memories...')
    mem1 = mem.add("I went to Paris yesterday and loved the Eiffel Tower", 
                   tags=["travel", "paris"],
                   metadata={"location": "Paris, France"})
    print(f"✅ Episodic memory stored: {mem1['id']}")
    
    mem2 = mem.add("I feel really excited about the new AI project",
                   tags=["emotion", "ai"])
    print(f"✅ Emotional memory stored: {mem2['id']}")
    
    mem3 = mem.add("My morning routine: coffee, then check emails, then code",
                   tags=["routine", "procedural"])
    print(f"✅ Procedural memory stored: {mem3['id']}")
    
    # Query memories
    print('\n2. Querying memories...')
    results = mem.query("Paris travel experience")
    print(f"✅ Found {len(results)} matching memories:")
    
    for i, match in enumerate(results):
        content_preview = match['content'][:50] + "..." if len(match['content']) > 50 else match['content']
        score = match.get('score', 0)
        print(f"   {i+1}. [score: {score:.3f}] {content_preview}")
    
    # Get all memories
    print('\n3. Listing all memories...')
    all_mems = mem.getAll(limit=10)
    print(f"✅ Total memories: {len(all_mems)}")
    
    # Delete a memory
    if results:
        print('\n4. Deleting a memory...')
        mem.delete(results[-1]['id'])
        print('✅ Memory deleted')
    
    print('\n✨ Example completed!')
    mem.close()

if __name__ == '__main__':
    basic_example()