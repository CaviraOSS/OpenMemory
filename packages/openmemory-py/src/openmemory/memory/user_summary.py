import time
import json
import asyncio
from typing import Dict, Any, List

from ..core.db import q, db
from ..core.config import env

def gen_user_summary(mems: List[Dict]) -> str:
    if not mems: return "User profile initializing... (No memories recorded yet)"

    projects = set()
    languages = set()
    files = set()
    saves = 0
    events = 0

    for m in mems:
        d = dict(m)
        if d.get("meta"):
            try:
                meta = json.loads(m["meta"]) if isinstance(m["meta"], str) else m["meta"]
                if not isinstance(meta, dict): meta = {}
                if meta.get("ide_project_name"): projects.add(meta["ide_project_name"])
                if meta.get("language"): languages.add(meta["language"])
                if meta.get("ide_file_path"):
                    files.add(meta["ide_file_path"].replace("\\", "/").split("/")[-1])
                if meta.get("ide_event_type") == "save": saves += 1
            except: pass
        events += 1

    proj_str = ", ".join(projects) if projects else "Unknown Project"
    lang_str = ", ".join(languages) if languages else "General"
    recent_files = ", ".join(list(files)[:3]) if files else "various files"

    created_at = mems[0]["created_at"]
    last_active = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(created_at/1000)) if created_at else "Recently"

    return f"Active in {proj_str} using {lang_str}. Focused on {recent_files}. ({len(mems)} memories, {saves} saves). Last active: {last_active}."

async def gen_user_summary_async(user_id: str) -> str:
    rows = db.fetchall("SELECT * FROM memories WHERE user_id=? ORDER BY created_at DESC LIMIT 100 OFFSET 0", (user_id,))
    return gen_user_summary(rows)

async def update_user_summary(user_id: str):
    try:
        summary = await gen_user_summary_async(user_id)
        now = int(time.time()*1000)

        existing = db.fetchone("SELECT * FROM users WHERE user_id=?", (user_id,))
        if not existing:
             db.execute("INSERT INTO users(user_id,summary,reflection_count,created_at,updated_at) VALUES (?,?,?,?,?)",
                        (user_id, summary, 0, now, now))
        else:
             db.execute("UPDATE users SET summary=?, updated_at=? WHERE user_id=?", (summary, now, user_id))
        db.commit()
    except Exception as e:
        print(f"[USER_SUMMARY] Error for {user_id}: {e}")

async def auto_update_user_summaries():
    all_mems = db.fetchall("SELECT user_id FROM memories LIMIT 10000")
    uids = set(m["user_id"] for m in all_mems if m["user_id"])

    updated = 0
    for u in uids:
        await update_user_summary(u)
        updated += 1
    return {"updated": updated}

_timer_task = None

async def user_summary_loop():
    interval = (env.user_summary_interval or 30) * 60
    while True:
        try:
            await auto_update_user_summaries()
        except Exception as e:
            print(f"[USER_SUMMARY] Loop error: {e}")
        await asyncio.sleep(interval)

def start_user_summary_reflection():
    global _timer_task
    if _timer_task: return
    _timer_task = asyncio.create_task(user_summary_loop())

def stop_user_summary_reflection():
    global _timer_task
    if _timer_task:
        _timer_task.cancel()
        _timer_task = None
