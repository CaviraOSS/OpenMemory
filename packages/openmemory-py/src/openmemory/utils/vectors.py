import math
import uuid
import time
import json
import struct
import numpy as np
from typing import List, Union, Any

def now() -> int:
    return int(time.time() * 1000)

def rid() -> str:
    return str(uuid.uuid4())

def cos_sim(a: Union[List[float], np.ndarray], b: Union[List[float], np.ndarray]) -> float:
    if isinstance(a, list): a = np.array(a, dtype=np.float32)
    if isinstance(b, list): b = np.array(b, dtype=np.float32)

    dot = float(np.dot(a, b))
    na = float(np.linalg.norm(a))
    nb = float(np.linalg.norm(b))

    d = na * nb
    return dot / d if d else 0.0

def j(x: Any) -> str:
    return json.dumps(x)

def p(x: str) -> Any:
    return json.loads(x)

def vec_to_buf(v: List[float]) -> bytes:
    return struct.pack(f"{len(v)}f", *v)

def buf_to_vec(buf: bytes) -> List[float]:
    cnt = len(buf) // 4
    return list(struct.unpack(f"{cnt}f", buf))
