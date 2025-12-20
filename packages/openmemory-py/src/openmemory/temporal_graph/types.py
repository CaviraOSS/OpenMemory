from typing import TypedDict, Optional, Any, Dict

# Port of backend/src/temporal_graph/types.ts

class TemporalFact(TypedDict):
    id: str
    subject: str
    predicate: str
    object: str
    valid_from: int # TS uses Date, we use ms timestamp
    valid_to: Optional[int]
    confidence: float
    last_updated: int
    metadata: Optional[Dict[str, Any]]

class TemporalEdge(TypedDict):
    id: str
    source_id: str
    target_id: str
    relation_type: str
    valid_from: int
    valid_to: Optional[int]
    weight: float
    metadata: Optional[Dict[str, Any]]

class TimelineEntry(TypedDict):
    timestamp: int
    subject: str
    predicate: str
    object: str
    confidence: float
    change_type: str # 'created' | 'updated' | 'invalidated'

class TemporalQuery(TypedDict, total=False):
    subject: Optional[str]
    predicate: Optional[str]
    object: Optional[str]
    at: Optional[int]
    start: Optional[int] # from
    end: Optional[int] # to
    min_confidence: Optional[float]
