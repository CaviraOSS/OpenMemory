from typing import TypedDict, Optional, Any, Dict

class TemporalFact(TypedDict):
    id: str
    subject: str
    predicate: str
    object: str
    valid_from: int
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
    change_type: str

class TemporalQuery(TypedDict, total=False):
    subject: Optional[str]
    predicate: Optional[str]
    object: Optional[str]
    at: Optional[int]
    start: Optional[int]
    end: Optional[int]
    min_confidence: Optional[float]
