import time
import math
from typing import Dict, List, Any

def calculate_score(
    relevance: float,
    created_at: int,
    last_seen_at: int,
    salience: float,
    decay_lambda: float = 0.02,
    debug: bool = False
) -> Dict[str, Any] | float:

    now = int(time.time() * 1000)
    hours_ago = max(0, (now - last_seen_at) / (1000 * 3600))
    recency = math.exp(-decay_lambda * hours_ago)

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
