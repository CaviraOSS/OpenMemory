"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stop_user_summary_reflection = exports.start_user_summary_reflection = exports.auto_update_user_summaries = exports.update_user_summary = exports.gen_user_summary_async = void 0;
const db_1 = require("../core/db");
const cfg_1 = require("../core/cfg");
const cos = (a, b) => {
    let d = 0, ma = 0, mb = 0;
    for (let i = 0; i < a.length; i++) {
        d += a[i] * b[i];
        ma += a[i] * a[i];
        mb += b[i] * b[i];
    }
    return d / (Math.sqrt(ma) * Math.sqrt(mb));
};
const gen_user_summary = (mems) => {
    if (!mems.length)
        return "User profile initializing... (No memories recorded yet)";
    const recent = mems.slice(0, 10);
    const projects = new Set();
    const languages = new Set();
    const files = new Set();
    let events = 0;
    let saves = 0;
    for (const m of mems) {
        if (m.meta) {
            try {
                const meta = typeof m.meta === 'string' ? JSON.parse(m.meta) : m.meta;
                if (meta.ide_project_name)
                    projects.add(meta.ide_project_name);
                if (meta.language)
                    languages.add(meta.language);
                if (meta.ide_file_path)
                    files.add(meta.ide_file_path.split(/[\\/]/).pop());
                if (meta.ide_event_type === 'save')
                    saves++;
            }
            catch (e) { /* ignore */ }
        }
        events++;
    }
    const project_str = projects.size > 0 ? Array.from(projects).join(", ") : "Unknown Project";
    const lang_str = languages.size > 0 ? Array.from(languages).join(", ") : "General";
    const recent_files = Array.from(files).slice(0, 3).join(", ");
    const last_active = mems[0].created_at ? new Date(mems[0].created_at).toLocaleString() : "Recently";
    return `Active in ${project_str} using ${lang_str}. Focused on ${recent_files || "various files"}. (${mems.length} memories, ${saves} saves). Last active: ${last_active}.`;
};
const gen_user_summary_async = async (user_id) => {
    const mems = await db_1.q.all_mem_by_user.all(user_id, 100, 0);
    return gen_user_summary(mems);
};
exports.gen_user_summary_async = gen_user_summary_async;
const update_user_summary = async (user_id) => {
    try {
        const summary = await (0, exports.gen_user_summary_async)(user_id);
        const now = Date.now();
        const existing = await db_1.q.get_user.get(user_id);
        if (!existing) {
            await db_1.q.ins_user.run(user_id, summary, 0, now, now);
        }
        else {
            await db_1.q.upd_user_summary.run(user_id, summary, now);
        }
    }
    catch (e) {
        console.error(`[USER_SUMMARY] Fatal error for ${user_id}:`, e);
    }
};
exports.update_user_summary = update_user_summary;
const auto_update_user_summaries = async () => {
    const all_mems = await db_1.q.all_mem.all(10000, 0);
    const user_ids = new Set(all_mems.map((m) => m.user_id).filter(Boolean));
    let updated = 0;
    for (const uid of user_ids) {
        try {
            await (0, exports.update_user_summary)(uid);
            updated++;
        }
        catch (e) {
            console.error(`[USER_SUMMARY] Failed for ${uid}:`, e);
        }
    }
    return { updated };
};
exports.auto_update_user_summaries = auto_update_user_summaries;
let timer = null;
const start_user_summary_reflection = () => {
    if (timer)
        return;
    const int = (cfg_1.env.user_summary_interval || 30) * 60000;
    timer = setInterval(() => (0, exports.auto_update_user_summaries)().catch((e) => console.error("[USER_SUMMARY]", e)), int);
};
exports.start_user_summary_reflection = start_user_summary_reflection;
const stop_user_summary_reflection = () => {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
};
exports.stop_user_summary_reflection = stop_user_summary_reflection;
