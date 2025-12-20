from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from enum import Enum
from datetime import datetime

class ProviderType(Enum):
    ZEP = "zep"
    MEM0 = "mem0"
    SUPERMEMORY = "supermemory"

@dataclass
class MigrationConfig:
    provider: ProviderType
    api_key: str
    source_url: Optional[str] = None
    output_dir: str = "./exports"
    batch_size: int = 1000
    rate_limit: float = 1.0
    openmemory_url: str = "http://localhost:8080"
    openmemory_key: str = ""
    verify: bool = False
    resume: bool = False

@dataclass
class MigrationRecord:
    id: str
    uid: str
    content: str
    tags: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: int = 0
    last_seen: int = 0
    embedding: Optional[List[float]] = None

@dataclass
class MigrationStats:
    total_records: int = 0
    imported: int = 0
    failed: int = 0
    duplicates: int = 0
    start_time: float = 0
    end_time: float = 0

    @property
    def duration(self) -> float:
        return self.end_time - self.start_time if self.end_time > 0 else 0
