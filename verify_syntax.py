import sys
import os

# Add sdk-py to path
sys.path.insert(0, r"c:\Users\bhave\OneDrive\Documents\GitHub\cavira\OpenMemory\sdk-py\src")

try:
    from openmemory.memory.embed import embed_multi_sector
    from openmemory import OpenMemory
    print("Successfully imported OpenMemory and embed_multi_sector")
except ImportError as e:
    print(f"ImportError: {e}")
except SyntaxError as e:
    print(f"SyntaxError: {e}")
except Exception as e:
    print(f"Error: {e}")
