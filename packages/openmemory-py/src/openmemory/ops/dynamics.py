import math
import asyncio
from typing import List, Dict, Any, Optional

from ..core.db import q, db
from ..core.constants import SECTOR_CONFIGS

ALPHA_LEARNING_RATE_FOR_RECALL_REINFORCEMENT = 0.15
BETA_LEARNING_RATE_FOR_EMOTIONAL_FREQUENCY = 0.2
GAMMA_ATTENUATION_CONSTANT_FOR_GRAPH_DISTANCE = 0.35
THETA_CONSOLIDATION_COEFFICIENT_FOR_LONG_TERM = 0.4
ETA_REINFORCEMENT_FACTOR_FOR_TRACE_LEARNING = 0.18
LAMBDA_ONE_FAST_DECAY_RATE = 0.015
LAMBDA_TWO_SLOW_DECAY_RATE = 0.002
TAU_ENERGY_THRESHOLD_FOR_RETRIEVAL = 0.4

SECTORAL_INTERDEPENDENCE_MATRIX_FOR_COGNITIVE_RESONANCE = [
    [1.0, 0.7, 0.3, 0.6, 0.6],
    [0.7, 1.0, 0.4, 0.7, 0.8],
    [0.3, 0.4, 1.0, 0.5, 0.2],
    [0.6, 0.7, 0.5, 1.0, 0.8],
    [0.6, 0.8, 0.2, 0.8, 1.0],
]

SECTOR_INDEX_MAPPING_FOR_MATRIX_LOOKUP = {
    "episodic": 0,
    "semantic": 1,
    "procedural": 2,
    "emotional": 3,
    "reflective": 4,
}

async def calculateCrossSectorResonanceScore(ms: str, qs: str, bs: float) -> float:
    si = SECTOR_INDEX_MAPPING_FOR_MATRIX_LOOKUP.get(ms, 1)
    ti = SECTOR_INDEX_MAPPING_FOR_MATRIX_LOOKUP.get(qs, 1)
    return bs * SECTORAL_INTERDEPENDENCE_MATRIX_FOR_COGNITIVE_RESONANCE[si][ti]

async def applyRetrievalTraceReinforcementToMemory(mid: str, sal: float) -> float:
    return min(1.0, sal + ETA_REINFORCEMENT_FACTOR_FOR_TRACE_LEARNING * (1.0 - sal))

async def propagateAssociativeReinforcementToLinkedNodes(sid: str, ssal: float, wps: List[Dict]) -> List[Dict]:
    ups = []
    for wp in wps:
        tid = wp["target_id"]
        wt = wp["weight"]
        ld = q.get_mem(tid)
        if ld:
             curr = ld["salience"] or 0
             pr = ETA_REINFORCEMENT_FACTOR_FOR_TRACE_LEARNING * wt * ssal
             new_sal = min(1.0, curr + pr)
             ups.append({"node_id": tid, "new_salience": new_sal})

    return ups
