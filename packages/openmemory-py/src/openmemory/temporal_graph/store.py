import time
import uuid
import json
import logging
from typing import List, Dict, Any, Optional

from ..core.db import q, db, transaction

logger = logging.getLogger("temporal")

async def insert_fact(subject: str, predicate: str, subject_object: str, valid_from: int = None, confidence: float = 1.0, metadata: Dict[str, Any] = None, user_id: Optional[str] = None) -> str:
    fact_id = str(uuid.uuid4())
    now = int(time.time() * 1000)
    valid_from_ts = valid_from if valid_from is not None else now
    existing = db.fetchall("SELECT id, valid_from FROM temporal_facts WHERE subject=? AND predicate=? AND valid_to IS NULL ORDER BY valid_from DESC", (subject, predicate))

    for old in existing:
        if old["valid_from"] < valid_from_ts:
            db.execute("UPDATE temporal_facts SET valid_to=? WHERE id=?", (valid_from_ts - 1, old["id"]))

    meta_json = json.dumps(metadata) if metadata else None
    if user_id:
        md = metadata or {}
        md["user_id"] = user_id
        meta_json = json.dumps(md)

    db.execute("INSERT INTO temporal_facts(id, subject, predicate, object, valid_from, valid_to, confidence, last_updated, metadata) VALUES (?,?,?,?,?,NULL,?,?,?)",
               (fact_id, subject, predicate, subject_object, valid_from_ts, confidence, now, meta_json))

    db.commit()
    return fact_id

async def update_fact(fact_id: str, confidence: Optional[float] = None, metadata: Optional[Dict[str, Any]] = None):
    updates = []
    params = []

    if confidence is not None:
        updates.append("confidence=?")
        params.append(confidence)

    if metadata is not None:
        updates.append("metadata=?")
        params.append(json.dumps(metadata))

    if not updates: return

    updates.append("last_updated=?")
    params.append(int(time.time() * 1000))
    params.append(fact_id)

    sql = f"UPDATE temporal_facts SET {', '.join(updates)} WHERE id=?"
    db.execute(sql, tuple(params))
    db.commit()

async def invalidate_fact(fact_id: str, valid_to: int = None):
    ts = valid_to if valid_to is not None else int(time.time() * 1000)
    db.execute("UPDATE temporal_facts SET valid_to=?, last_updated=? WHERE id=?", (ts, int(time.time() * 1000), fact_id))
    db.commit()

async def delete_fact(fact_id: str):
    db.execute("DELETE FROM temporal_facts WHERE id=?", (fact_id,))
    db.commit()

async def insert_edge(source_id: str, target_id: str, relation_type: str, valid_from: int = None, weight: float = 1.0, metadata: Dict[str, Any] = None) -> str:
    edge_id = str(uuid.uuid4())
    now = int(time.time() * 1000)
    valid_from_ts = valid_from if valid_from is not None else now
    meta_json = json.dumps(metadata) if metadata else None

    db.execute("INSERT INTO temporal_edges(id, source_id, target_id, relation_type, valid_from, valid_to, weight, metadata) VALUES (?,?,?,?,?,NULL,?,?)",
               (edge_id, source_id, target_id, relation_type, valid_from_ts, weight, meta_json))
    db.commit()
    return edge_id

async def invalidate_edge(edge_id: str, valid_to: int = None):
    ts = valid_to if valid_to is not None else int(time.time() * 1000)
    db.execute("UPDATE temporal_edges SET valid_to=? WHERE id=?", (ts, edge_id))
    db.commit()

async def batch_insert_facts(facts: List[Dict[str, Any]]) -> List[str]:
    ids = []
    try:
        db.execute("BEGIN")

        now = int(time.time()*1000)

        for f in facts:
            fid = str(uuid.uuid4())
            sub, pred, obj = f["subject"], f["predicate"], f["object"]
            vf = f.get("valid_from", now)
            conf = f.get("confidence", 1.0)
            meta = f.get("metadata")
            existing = db.conn.execute("SELECT id, valid_from FROM temporal_facts WHERE subject=? AND predicate=? AND valid_to IS NULL", (sub, pred)).fetchall()
            for old in existing:
                 if old["valid_from"] < vf:
                     db.conn.execute("UPDATE temporal_facts SET valid_to=? WHERE id=?", (vf - 1, old["id"]))

            db.conn.execute("INSERT INTO temporal_facts(id, subject, predicate, object, valid_from, valid_to, confidence, last_updated, metadata) VALUES (?,?,?,?,?,NULL,?,?,?)",
               (fid, sub, pred, obj, vf, conf, now, json.dumps(meta) if meta else None))
            ids.append(fid)

        db.execute("COMMIT")
        return ids
    except Exception as e:
        db.execute("ROLLBACK")
        raise e

async def apply_confidence_decay(decay_rate: float = 0.01) -> int:
    now = int(time.time() * 1000)
    one_day = 86400000
    sql = """
        UPDATE temporal_facts
        SET confidence = MAX(0.1, confidence * (1 - ? * ((? - valid_from) / ?)))
        WHERE valid_to IS NULL AND confidence > 0.1
    """
    db.execute(sql, (decay_rate, now, one_day))
    db.commit()
    return db.conn.total_changes
