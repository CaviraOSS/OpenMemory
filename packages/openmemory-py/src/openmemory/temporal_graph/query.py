import time
import json
from typing import List, Dict, Any, Optional

from ..core.db import db

async def query_facts_at_time(subject: Optional[str] = None, predicate: Optional[str] = None, subject_object: Optional[str] = None, at: int = None, min_confidence: float = 0.1) -> List[Dict[str, Any]]:
    ts = at if at is not None else int(time.time()*1000)
    conds = ["(valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?))"]
    params = [ts, ts]

    if subject:
        conds.append("subject = ?")
        params.append(subject)
    if predicate:
        conds.append("predicate = ?")
        params.append(predicate)
    if subject_object:
        conds.append("object = ?")
        params.append(subject_object)
    if min_confidence > 0:
        conds.append("confidence >= ?")
        params.append(min_confidence)

    sql = f"""
        SELECT id, subject, predicate, object, valid_from, valid_to, confidence, last_updated, metadata
        FROM temporal_facts
        WHERE {' AND '.join(conds)}
        ORDER BY confidence DESC, valid_from DESC
    """
    rows = db.fetchall(sql, tuple(params))
    return [format_fact(r) for r in rows]

async def get_current_fact(subject: str, predicate: str) -> Optional[Dict[str, Any]]:
    sql = """
        SELECT id, subject, predicate, object, valid_from, valid_to, confidence, last_updated, metadata
        FROM temporal_facts
        WHERE subject = ? AND predicate = ? AND valid_to IS NULL
        ORDER BY valid_from DESC
        LIMIT 1
    """
    row = db.fetchone(sql, (subject, predicate))
    if not row: return None
    return format_fact(row)

async def query_facts_in_range(subject: str = None, predicate: str = None, start: int = None, end: int = None, min_confidence: float = 0.1) -> List[Dict[str, Any]]:
    conds = []
    params = []

    if start is not None and end is not None:
        conds.append("((valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?)) OR (valid_from >= ? AND valid_from <= ?))")
        params.extend([end, start, start, end])
    elif start is not None:
        conds.append("valid_from >= ?")
        params.append(start)
    elif end is not None:
        conds.append("valid_from <= ?")
        params.append(end)

    if subject:
        conds.append("subject = ?")
        params.append(subject)
    if predicate:
        conds.append("predicate = ?")
        params.append(predicate)
    if min_confidence > 0:
        conds.append("confidence >= ?")
        params.append(min_confidence)

    where = f"WHERE {' AND '.join(conds)}" if conds else ""
    sql = f"""
        SELECT id, subject, predicate, object, valid_from, valid_to, confidence, last_updated, metadata
        FROM temporal_facts
        {where}
        ORDER BY valid_from DESC
    """
    rows = db.fetchall(sql, tuple(params))
    return [format_fact(r) for r in rows]

async def find_conflicting_facts(subject: str, predicate: str, at: int = None) -> List[Dict[str, Any]]:
    ts = at if at is not None else int(time.time()*1000)
    sql = """
        SELECT id, subject, predicate, object, valid_from, valid_to, confidence, last_updated, metadata
        FROM temporal_facts
        WHERE subject = ? AND predicate = ?
        AND (valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?))
        ORDER BY confidence DESC
    """
    rows = db.fetchall(sql, (subject, predicate, ts, ts))
    return [format_fact(r) for r in rows]

async def get_facts_by_subject(subject: str, at: int = None, include_historical: bool = False) -> List[Dict[str, Any]]:
    params = [subject]
    if include_historical:
        sql = """
            SELECT id, subject, predicate, object, valid_from, valid_to, confidence, last_updated, metadata
            FROM temporal_facts
            WHERE subject = ?
            ORDER BY predicate ASC, valid_from DESC
        """
    else:
        ts = at if at is not None else int(time.time()*1000)
        sql = """
            SELECT id, subject, predicate, object, valid_from, valid_to, confidence, last_updated, metadata
            FROM temporal_facts
            WHERE subject = ?
            AND (valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?))
            ORDER BY predicate ASC, confidence DESC
        """
        params.extend([ts, ts])

    rows = db.fetchall(sql, tuple(params))
    return [format_fact(r) for r in rows]

async def search_facts(pattern: str, field: str = "subject", at: int = None) -> List[Dict[str, Any]]:
    ts = at if at is not None else int(time.time()*1000)
    search_pat = f"%{pattern}%"
    if field not in ["subject", "predicate", "object"]: field = "subject"

    sql = f"""
        SELECT id, subject, predicate, object, valid_from, valid_to, confidence, last_updated, metadata
        FROM temporal_facts
        WHERE {field} LIKE ?
        AND (valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?))
        ORDER BY confidence DESC, valid_from DESC
        LIMIT 100
    """
    rows = db.fetchall(sql, (search_pat, ts, ts))
    return [format_fact(r) for r in rows]

async def get_related_facts(fact_id: str, relation_type: str = None, at: int = None) -> List[Dict[str, Any]]:
    ts = at if at is not None else int(time.time()*1000)
    conds = ["(e.valid_from <= ? AND (e.valid_to IS NULL OR e.valid_to >= ?))"]
    params = [ts, ts]

    if relation_type:
        conds.append("e.relation_type = ?")
        params.append(relation_type)

    sql = f"""
        SELECT f.*, e.relation_type, e.weight
        FROM temporal_edges e
        JOIN temporal_facts f ON e.target_id = f.id
        WHERE e.source_id = ?
        AND {' AND '.join(conds)}
        AND (f.valid_from <= ? AND (f.valid_to IS NULL OR f.valid_to >= ?))
        ORDER BY e.weight DESC, f.confidence DESC
    """
    params.insert(0, fact_id)
    params.extend([ts, ts])

    rows = db.fetchall(sql, tuple(params))
    return [{
        "fact": format_fact(r),
        "relation": r["relation_type"],
        "weight": r["weight"]
    } for r in rows]

def format_fact(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "subject": row["subject"],
        "predicate": row["predicate"],
        "object": row["object"],
        "valid_from": row["valid_from"],
        "valid_to": row["valid_to"],
        "confidence": row["confidence"],
        "last_updated": row["last_updated"],
        "metadata": json.loads(row["metadata"]) if row["metadata"] else None
    }
