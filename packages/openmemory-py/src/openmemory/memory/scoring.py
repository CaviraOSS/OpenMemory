import time
import math
from typing import Dict, List, Any

# V2 Scoring Logic
# Components:
# - Relevance (Cosine Sim): 0-1
# - Recency (Exponential Decay): 0-1
# - Importance (Salience): 0-1+
# - Frequency (Access count): 0-1?

def calculate_score(
    relevance: float, 
    created_at: int, 
    last_seen_at: int,
    salience: float,
    decay_lambda: float = 0.02, # default half life logic
    debug: bool = False
) -> Dict[str, Any] | float:
    
    now = int(time.time() * 1000)
    
    # Recency
    # hours since last access?
    # Original backend used hours.
    hours_ago = max(0, (now - last_seen_at) / (1000 * 3600))
    # Decay function: e^(-lambda * t)
    recency = math.exp(-decay_lambda * hours_ago)
    
    # Combined
    # Score = (Relevance * alpha) + (Recency * beta) + (Salience * gamma)?
    # Or multiplicative?
    # Backend v1 was: (sim * 0.7) + (recency * 0.3) * salience?
    # Let's standardize on a V2 formula:
    
    final = (relevance * 0.6) + (recency * 0.2) + (min(salience, 1.0) * 0.2)
    
    if debug:
        return {
            "score": final,
            "components": {
                "relevance": relevance,
                "recency": recency,
                "salience": salience,
                "age_hours": hours_ago
            }
        }
    return final
