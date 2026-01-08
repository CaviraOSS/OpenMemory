import sqlite3
import time
import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional, Union
from .config import env
from .types import MemRow
logger = logging.getLogger("db")
logger.setLevel(logging.INFO)

class DB:
    def __init__(self):
        self.conn: Optional[sqlite3.Connection] = None

    def connect(self):
        if self.conn: return
        url = env.database_url
        if url.startswith("sqlite:///"):
            path = Path(url.replace("sqlite:///", ""))
            if not path.parent.exists():
                path.parent.mkdir(parents=True, exist_ok=True)
            logger.info(f"[DB] Connecting to {path}")
            self.conn = sqlite3.connect(str(path), check_same_thread=False, isolation_level=None)
            self.conn.row_factory = sqlite3.Row
            self.conn.execute("PRAGMA journal_mode=WAL")
            self.conn.execute("PRAGMA synchronous=NORMAL")
            self.conn.execute("PRAGMA cache_size=-8000")
            self.conn.execute("PRAGMA foreign_keys=OFF")
        else:
            raise ValueError(f"Unsupported database URL schema: {url}. Only sqlite:/// is supported currently.")

        self.run_migrations()

    def run_migrations(self):
        c = self.conn
        c.execute("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER)")
        files = []
        try:
            from importlib import resources
            files = [p.name for p in resources.files('openmemory.migrations').iterdir() if p.name.endswith(".sql")]
        except (ImportError, TypeError, AttributeError):
            import os
            mig_path = Path(__file__).parent.parent / "migrations"
            if mig_path.exists():
                files = [f for f in os.listdir(mig_path) if f.endswith(".sql")]

        files.sort()

        for f in files:
            if not self.fetchone("SELECT 1 FROM _migrations WHERE name=?", (f,)):
                logger.info(f"[DB] Applying migration {f}")
                try:
                    sql = None
                    try:
                        from importlib import resources
                        sql = resources.files('openmemory.migrations').joinpath(f).read_text(encoding='utf-8')
                    except:
                        pass
                    if not sql:
                        sql = (Path(__file__).parent.parent / "migrations" / f).read_text(encoding="utf-8")
                    c.executescript(sql)
                    c.execute("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)", (f, int(time.time())))
                except Exception as e:
                    logger.error(f"[DB] Migration {f} failed: {e}")
                    raise e

    def init_schema(self):
         self.run_migrations()

    def execute(self, sql: str, params: tuple = ()) -> sqlite3.Cursor:
        self.connect()
        return self.conn.execute(sql, params)

    def fetchall(self, sql: str, params: tuple = ()) -> List[sqlite3.Row]:
        self.connect()
        return self.conn.execute(sql, params).fetchall()

    def fetchone(self, sql: str, params: tuple = ()) -> Optional[sqlite3.Row]:
        self.connect()
        return self.conn.execute(sql, params).fetchone()

    def commit(self):
        if self.conn: self.conn.commit()
db = DB()
class Queries:
    def ins_mem(self, **k):
        sql = """
        INSERT INTO memories(id, user_id, segment, content, simhash, primary_sector, tags, meta, created_at, updated_at, last_seen_at, salience, decay_lambda, version, mean_dim, mean_vec, compressed_vec, feedback_score)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET
        user_id=excluded.user_id, segment=excluded.segment, content=excluded.content, simhash=excluded.simhash, primary_sector=excluded.primary_sector,
        tags=excluded.tags, meta=excluded.meta, created_at=excluded.created_at, updated_at=excluded.updated_at, last_seen_at=excluded.last_seen_at,
        salience=excluded.salience, decay_lambda=excluded.decay_lambda, version=excluded.version, mean_dim=excluded.mean_dim,
        mean_vec=excluded.mean_vec, compressed_vec=excluded.compressed_vec, feedback_score=excluded.feedback_score
        """
        vals = (
            k.get("id"), k.get("user_id"), k.get("segment", 0), k.get("content"), k.get("simhash"),
            k.get("primary_sector"), k.get("tags"), k.get("meta"), k.get("created_at"), k.get("updated_at"),
            k.get("last_seen_at"), k.get("salience", 1.0), k.get("decay_lambda", 0.02), k.get("version", 1),
            k.get("mean_dim"), k.get("mean_vec"), k.get("compressed_vec"), k.get("feedback_score", 0)
        )
        db.execute(sql, vals)
        db.commit()

    def get_mem(self, mid: str):
        return db.fetchone("SELECT * FROM memories WHERE id=?", (mid,))

    def all_mem(self, limit=10, offset=0):
        return db.fetchall("SELECT * FROM memories ORDER BY created_at DESC LIMIT ? OFFSET ?", (limit, offset))
    def ins_log(self, id: str, model: str, status: str, ts: int, err: Optional[str] = None):
        db.execute("INSERT INTO embed_logs(id, model, status, ts, err) VALUES (?,?,?,?,?)", (id, model, status, ts, err))
        db.commit()

    def upd_log(self, id: str, status: str, err: Optional[str] = None):
        db.execute("UPDATE embed_logs SET status=?, err=? WHERE id=?", (status, err, id))
        db.commit()

    def all_mem_by_user(self, user_id: str, limit=10, offset=0):
        return db.fetchall("SELECT * FROM memories WHERE user_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?", (user_id, limit, offset))

    def get_waypoints_by_src(self, src_id: str):
        return db.fetchall("SELECT * FROM waypoints WHERE src_id=?", (src_id,))

    def del_mem(self, mid: str):
        db.execute("DELETE FROM memories WHERE id=?", (mid,))
        db.execute("DELETE FROM vectors WHERE id=?", (mid,))
        db.execute("DELETE FROM waypoints WHERE src_id=? OR dst_id=?", (mid, mid))
        db.commit()

    def del_mem_by_user(self, uid: str):
        db.execute("DELETE FROM vectors WHERE id IN (SELECT id FROM memories WHERE user_id=?)", (uid,))
        db.execute("DELETE FROM waypoints WHERE src_id IN (SELECT id FROM memories WHERE user_id=?) OR dst_id IN (SELECT id FROM memories WHERE user_id=?)", (uid, uid))
        db.execute("DELETE FROM memories WHERE user_id=?", (uid,))
        db.commit()

q = Queries()

def transaction():
    return db.conn
