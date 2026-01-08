import time
import json
from typing import List, Dict, Any, Optional

from ..core.db import db
from .query import query_facts_at_time

async def get_subject_timeline(subject: str, predicate: str = None) -> List[Dict[str, Any]]:
    conds = ["subject = ?"]
    params = [subject]

    if predicate:
        conds.append("predicate = ?")
        params.append(predicate)

    sql = f"""
        SELECT subject, predicate, object, confidence, valid_from, valid_to
        FROM temporal_facts
        WHERE {' AND '.join(conds)}
        ORDER BY valid_from ASC
    """
    rows = db.fetchall(sql, tuple(params))
    timeline = []

    for row in rows:
        timeline.append({
            "timestamp": row["valid_from"],
            "subject": row["subject"],
            "predicate": row["predicate"],
            "object": row["object"],
            "confidence": row["confidence"],
            "change_type": "created"
        })
        if row["valid_to"]:
            timeline.append({
                "timestamp": row["valid_to"],
                "subject": row["subject"],
                "predicate": row["predicate"],
                "object": row["object"],
                "confidence": row["confidence"],
                "change_type": "invalidated"
            })

    timeline.sort(key=lambda x: x["timestamp"])
    return timeline

async def get_predicate_timeline(predicate: str, start: int = None, end: int = None) -> List[Dict[str, Any]]:
    conds = ["predicate = ?"]
    params = [predicate]

    if start is not None:
        conds.append("valid_from >= ?")
        params.append(start)
    if end is not None:
        conds.append("valid_from <= ?")
        params.append(end)

    sql = f"""
        SELECT subject, predicate, object, confidence, valid_from, valid_to
        FROM temporal_facts
        WHERE {' AND '.join(conds)}
        ORDER BY valid_from ASC
    """
    rows = db.fetchall(sql, tuple(params))
    timeline = []
    for row in rows:
        timeline.append({
            "timestamp": row["valid_from"],
            "subject": row["subject"],
            "predicate": row["predicate"],
            "object": row["object"],
            "confidence": row["confidence"],
            "change_type": "created"
        })
        if row["valid_to"]:
            timeline.append({
                "timestamp": row["valid_to"],
                "subject": row["subject"],
                "predicate": row["predicate"],
                "object": row["object"],
                "confidence": row["confidence"],
                "change_type": "invalidated"
            })

    timeline.sort(key=lambda x: x["timestamp"])
    return timeline

async def get_changes_in_window(start: int, end: int, subject: str = None) -> List[Dict[str, Any]]:
    conds = []
    params = [start, end, start, end]

    if subject:
        conds.append("subject = ?")
        params.append(subject)

    where_sub = f"AND {' AND '.join(conds)}" if conds else ""

    sql = f"""
        SELECT subject, predicate, object, confidence, valid_from, valid_to
        FROM temporal_facts
        WHERE ((valid_from >= ? AND valid_from <= ?) OR (valid_to >= ? AND valid_to <= ?))
        {where_sub}
        ORDER BY valid_from ASC
    """
    rows = db.fetchall(sql, tuple(params))
    timeline = []

    for row in rows:
        if row["valid_from"] >= start and row["valid_from"] <= end:
            timeline.append({
                "timestamp": row["valid_from"],
                "subject": row["subject"],
                "predicate": row["predicate"],
                "object": row["object"],
                "confidence": row["confidence"],
                "change_type": "created"
            })
        if row["valid_to"] and row["valid_to"] >= start and row["valid_to"] <= end:
             timeline.append({
                "timestamp": row["valid_to"],
                "subject": row["subject"],
                "predicate": row["predicate"],
                "object": row["object"],
                "confidence": row["confidence"],
                "change_type": "invalidated"
            })

    timeline.sort(key=lambda x: x["timestamp"])
    return timeline

def _row_to_fact(row: Dict[str, Any]) -> Dict[str, Any]:
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

async def compare_time_points(subject: str, t1: int, t2: int) -> Dict[str, List[Dict[str, Any]]]:

    sql1 = """
        SELECT id, subject, predicate, object, valid_from, valid_to, confidence, last_updated, metadata
        FROM temporal_facts
        WHERE subject = ?
        AND valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?)
    """
    f1 = db.fetchall(sql1, (subject, t1, t1))
    f2 = db.fetchall(sql1, (subject, t2, t2))

    m1 = {r["predicate"]: r for r in f1}
    m2 = {r["predicate"]: r for r in f2}

    added = []
    removed = []
    changed = []
    unchanged = []

    for pred, fact2 in m2.items():
        fact1 = m1.get(pred)
        if not fact1:
            added.append(_row_to_fact(fact2))
        elif fact1["object"] != fact2["object"] or fact1["id"] != fact2["id"]:
            changed.append({
                "before": _row_to_fact(fact1),
                "after": _row_to_fact(fact2)
            })
        else:
            unchanged.append(_row_to_fact(fact2))

    for pred, fact1 in m1.items():
        if pred not in m2:
            removed.append(_row_to_fact(fact1))

    return {"added": added, "removed": removed, "changed": changed, "unchanged": unchanged}

async def get_change_frequency(subject: str, predicate: str, window_days: int = 30) -> Dict[str, Any]:
    now = int(time.time()*1000)
    start = now - (window_days * 86400000)

    sql = """
        SELECT valid_from, valid_to
        FROM temporal_facts
        WHERE subject = ? AND predicate = ?
        AND valid_from >= ?
        ORDER BY valid_from ASC
    """
    rows = db.fetchall(sql, (subject, predicate, start))

    total_changes = len(rows)
    total_dur = 0
    valid_count = 0

    for r in rows:
        if r["valid_to"]:
            total_dur += (r["valid_to"] - r["valid_from"])
            valid_count += 1

    avg_dur = total_dur / valid_count if valid_count > 0 else 0
    rate = total_changes / window_days

    return {
        "predicate": predicate,
        "total_changes": total_changes,
        "avg_duration_ms": avg_dur,
        "change_rate_per_day": rate
    }

async def get_volatile_facts(subject: str = None, limit: int = 10) -> List[Dict[str, Any]]:
    where = "WHERE subject = ?" if subject else ""
    params = [subject] if subject else []

    sql = f"""
        SELECT subject, predicate, COUNT(*) as change_count, AVG(confidence) as avg_confidence
        FROM temporal_facts
        {where}
        GROUP BY subject, predicate
        HAVING change_count > 1
        ORDER BY change_count DESC, avg_confidence ASC
        LIMIT ?
    """
    rows = db.fetchall(sql, tuple(params + [limit]))
    return rows
