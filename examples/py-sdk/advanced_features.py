#!/usr/bin/env python3

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'sdk-py', 'src'))

from openmemory import OpenMemory

def advanced_example():
    print('🧠 OpenMemory Python SDK - Advanced Features')
    print('============================================')
    
    # Initialize with advanced configuration
    mem = OpenMemory(
        path='./data/advanced-demo.sqlite',
        tier='smart',  # 'fast' | 'smart' | 'deep' | 'hybrid'
        embeddings={
            'provider': 'synthetic',
            'mode': 'advanced',
            'dimensions': 768
        },
        decay={
            'intervalMinutes': 5,
            'reinforceOnQuery': True,
            'coldThreshold': 0.1
        },
        compression={
            'enabled': True,
            'algorithm': 'semantic',
            'minLength': 100
        },
        reflection={
            'enabled': True,
            'intervalMinutes': 10,
            'minMemories': 5
        }
    )
    
    print('✅ OpenMemory initialized with advanced features')
    
    # Multi-sector memories
    print('\n1. Adding multi-sector memories...')
    
    mem.add("Yesterday I learned how to implement binary search trees while feeling slightly frustrated",
            tags=["learning", "coding", "emotion"],
            metadata={"difficulty": "medium", "mood": "frustrated"})
    
    mem.add("The capital of France is Paris, located on the Seine river",
            tags=["geography", "facts"],
            metadata={"type": "factual"})
    
    mem.add("To make coffee: 1) Heat water to 200°F, 2) Add 2 tbsp grounds, 3) Pour slowly",
            tags=["coffee", "procedure"],
            metadata={"category": "cooking"})
    
    mem.add("I'm thinking about why certain algorithms are more efficient than others",
            tags=["reflection", "metacognition"],
            metadata={"type": "reflective"})
    
    print('✅ Added 4 memories across different sectors')
    
    # Cross-sector query
    print('\n2. Cross-sector query...')
    results = mem.query("learning and emotions", limit=3)
    print(f"✅ Found {len(results)} cross-sector matches")
    for i, r in enumerate(results):
        print(f"   {i+1}. {r['content'][:60]}...")
    
    # Sector-specific query
    print('\n3. Sector-specific queries...')
    procedural = mem.getBySector('procedural', limit=5)
    print(f"✅ Procedural memories: {len(procedural)}")
    
    semantic = mem.getBySector('semantic', limit=5)
    print(f"✅ Semantic memories: {len(semantic)}")
    
    # Memory with custom decay
    print('\n4. Adding memory with custom decay...')
    mem.add("This is a short-lived thought",
            decayLambda=0.5,  # Fast decay
            metadata={"temporary": True})
    print('✅ Memory added with fast decay')
    
    # Bulk operations
    print('\n5. Bulk adding memories...')
    memories = [
        "Machine learning is transforming healthcare",
        "I enjoy hiking in the mountains on weekends",
        "Quantum computing uses qubits instead of classical bits"
    ]
    
    for content in memories:
        mem.add(content)
    print(f"✅ Added {len(memories)} memories in bulk")
    
    # Get statistics
    print('\n6. Memory statistics...')
    all_mems = mem.getAll()
    print(f"✅ Total memories: {len(all_mems)}")
    
    print('\n✨ Advanced features demonstrated!')
    mem.close()

if __name__ == '__main__':
    advanced_example()