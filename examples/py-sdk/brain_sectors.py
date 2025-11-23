#!/usr/bin/env python3

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'sdk-py', 'src'))

from openmemory import OpenMemory

def sector_example():
    print('🧠 OpenMemory Python SDK - Brain Sectors')
    print('=========================================')
    
    mem = OpenMemory(
        path='./data/sectors-demo.sqlite',
        tier='smart',
        embeddings={'provider': 'synthetic'}
    )
    
    print('✅ OpenMemory initialized\n')
    
    # Demonstrate each sector
    print('📝 Adding memories to different sectors...\n')
    
    # 1. Episodic (Events & Experiences)
    print('1️⃣  EPISODIC SECTOR (Events & Experiences)')
    mem.add("Last Tuesday I attended a conference on AI safety in San Francisco",
            tags=["event", "conference", "ai"],
            metadata={"date": "2024-01-15", "location": "San Francisco"})
    mem.add("I remember the first time I wrote a recursive function - it was confusing but exciting")
    print('   ✅ Time-bound experiences stored\n')
    
    # 2. Semantic (Facts & Knowledge)
    print('2️⃣  SEMANTIC SECTOR (Facts & Knowledge)')
    mem.add("Python is an interpreted, high-level programming language known for readability",
            tags=["programming", "python", "facts"])
    mem.add("The mitochondria is the powerhouse of the cell",
            tags=["biology", "facts"])
    print('   ✅ Timeless facts stored\n')
    
    # 3. Procedural (Skills & How-to)
    print('3️⃣  PROCEDURAL SECTOR (Skills & How-to)')
    mem.add("To deploy to production: 1) Run tests, 2) Build Docker image, 3) Push to registry, 4) Update k8s manifests",
            tags=["devops", "procedure"])
    mem.add("When debugging, always check: logs, network tab, console errors, and stack traces",
            tags=["debugging", "procedure"])
    print('   ✅ Procedures stored\n')
    
    # 4. Emotional (Feelings & Sentiment)
    print('4️⃣  EMOTIONAL SECTOR (Feelings & Sentiment)')
    mem.add("I'm extremely proud of finishing that complex algorithm! 🎉",
            tags=["emotion", "achievement"])
    mem.add("Feeling a bit anxious about the upcoming presentation tomorrow",
            tags=["emotion", "anxiety"])
    print('   ✅ Emotional states stored\n')
    
    # 5. Reflective (Meta-cognition & Insights)
    print('5️⃣  REFLECTIVE SECTOR (Meta-cognition & Insights)')
    mem.add("I notice I learn best when I can practice concepts immediately after learning them",
            tags=["reflection", "learning"])
    mem.add("Looking back, I realize my coding style has evolved to prioritize readability over cleverness",
            tags=["reflection", "growth"])
    print('   ✅ Reflections stored\n')
    
    # Query across sectors
    print('🔍 Querying across sectors...')
    results = mem.query("learning and programming")
    print(f"\n✅ Found {len(results)} memories across sectors:")
    for i, r in enumerate(results):
        print(f"   {i+1}. {r['content'][:70]}...")
    
    # Get memories by sector
    print('\n📊 Memories per sector:')
    sectors = ['episodic', 'semantic', 'procedural', 'emotional', 'reflective']
    for sector in sectors:
        sector_mems = mem.getBySector(sector)
        print(f"   {sector.ljust(12)}: {len(sector_mems)} memories")
    
    print('\n✨ Sector demonstration complete!')
    mem.close()

if __name__ == '__main__':
    sector_example()