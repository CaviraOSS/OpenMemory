import { addHSGMemory } from '../hsg'
import { q, transaction } from '../database'
import { rid, now, j } from '../utils'
import { extractText, ExtractionResult } from './extractors'

const LG = 8000, SEC = 3000

export interface IngestionConfig { forceRootChild?: boolean; sectionSize?: number; largeDocThreshold?: number }
export interface IngestionResult {
    root_memory_id: string
    child_count: number
    total_tokens: number
    strategy: 'single' | 'root-child'
    extraction: ExtractionResult['metadata']
}

const split = (t: string, sz: number): string[] => {
    if (t.length <= sz) return [t]
    const secs: string[] = []
    const paras = t.split(/\n\n+/)
    let cur = ''
    for (const p of paras) {
        if (cur.length + p.length > sz && cur.length > 0) { secs.push(cur.trim()); cur = p }
        else cur += (cur ? '\n\n' : '') + p
    }
    if (cur.trim()) secs.push(cur.trim())
    return secs
}

const mkRoot = async (txt: string, ex: ExtractionResult, meta?: Record<string, unknown>) => {
    const sum = txt.length > 500 ? txt.slice(0, 500) + '...' : txt
    const cnt = `[Document: ${ex.metadata.content_type.toUpperCase()}]\n\n${sum}\n\n[Full content split across ${Math.ceil(txt.length / SEC)} sections]`
    const id = rid(), ts = now()
    await transaction.begin()
    try {
        await q.ins_mem.run(id, cnt, 'reflective', j([]), j({ ...meta, ...ex.metadata, is_root: true, ingestion_strategy: 'root-child', ingested_at: ts }), ts, ts, ts, 1.0, 0.1, 1, null, null)
        await transaction.commit()
        return id
    } catch (e) {
        console.error('[ERROR] Root failed:', e)
        await transaction.rollback()
        throw e
    }
}

const mkChild = async (txt: string, idx: number, tot: number, rid: string, meta?: Record<string, unknown>) => {
    const r = await addHSGMemory(txt, j([]), { ...meta, is_child: true, section_index: idx, total_sections: tot, parent_id: rid })
    return r.id
}

const link = async (rid: string, cid: string, idx: number) => {
    const ts = now()
    await transaction.begin()
    try {
        await q.ins_waypoint.run(rid, cid, 1.0, ts, ts)
        await transaction.commit()
        console.log(`🔗 Link: ${rid.slice(0, 8)} → ${cid.slice(0, 8)} (${idx})`)
    } catch (e) {
        await transaction.rollback()
        console.error(`❌ Link failed for ${idx}:`, e)
        throw e
    }
}

export async function ingestDocument(t: string, data: string | Buffer, meta?: Record<string, unknown>, cfg?: IngestionConfig): Promise<IngestionResult> {
    const th = cfg?.largeDocThreshold || LG, sz = cfg?.sectionSize || SEC
    const ex = await extractText(t, data)
    const { text, metadata: exMeta } = ex
    const useRC = cfg?.forceRootChild || exMeta.estimated_tokens > th

    if (!useRC) {
        const r = await addHSGMemory(text, j([]), { ...meta, ...exMeta, ingestion_strategy: 'single', ingested_at: now() })
        return { root_memory_id: r.id, child_count: 0, total_tokens: exMeta.estimated_tokens, strategy: 'single', extraction: exMeta }
    }

    const secs = split(text, sz)
    console.log(`📄 Large doc: ${exMeta.estimated_tokens} tokens`)
    console.log(`📑 Split into ${secs.length} sections`)

    let rid: string
    const cids: string[] = []

    try {
        rid = await mkRoot(text, ex, meta)
        console.log(`📝 Root: ${rid}`)
        for (let i = 0; i < secs.length; i++) {
            try {
                const cid = await mkChild(secs[i], i, secs.length, rid, meta)
                cids.push(cid)
                await link(rid, cid, i)
                console.log(`✅ Section ${i + 1}/${secs.length}: ${cid}`)
            } catch (e) {
                console.error(`❌ Section ${i + 1}/${secs.length} failed:`, e)
                throw e
            }
        }
        console.log(`🎉 Done: ${cids.length} sections → ${rid}`)
        return { root_memory_id: rid, child_count: secs.length, total_tokens: exMeta.estimated_tokens, strategy: 'root-child', extraction: exMeta }
    } catch (e) {
        console.error('❌ Ingestion failed:', e)
        throw e
    }
}

export async function ingestURL(url: string, meta?: Record<string, unknown>, cfg?: IngestionConfig): Promise<IngestionResult> {
    const { extractURL } = await import('./extractors')
    const ex = await extractURL(url)
    const th = cfg?.largeDocThreshold || LG, sz = cfg?.sectionSize || SEC
    const useRC = cfg?.forceRootChild || ex.metadata.estimated_tokens > th

    if (!useRC) {
        const r = await addHSGMemory(ex.text, j([]), { ...meta, ...ex.metadata, ingestion_strategy: 'single', ingested_at: now() })
        return { root_memory_id: r.id, child_count: 0, total_tokens: ex.metadata.estimated_tokens, strategy: 'single', extraction: ex.metadata }
    }

    const secs = split(ex.text, sz)
    console.log(`🌐 Large URL: ${ex.metadata.estimated_tokens} tokens`)
    console.log(`📑 Split into ${secs.length} sections`)

    let rid: string
    const cids: string[] = []

    try {
        rid = await mkRoot(ex.text, ex, { ...meta, source_url: url })
        console.log(`📝 Root for URL: ${rid}`)
        for (let i = 0; i < secs.length; i++) {
            try {
                const cid = await mkChild(secs[i], i, secs.length, rid, { ...meta, source_url: url })
                cids.push(cid)
                await link(rid, cid, i)
                console.log(`✅ URL section ${i + 1}/${secs.length}: ${cid}`)
            } catch (e) {
                console.error(`❌ URL section ${i + 1}/${secs.length} failed:`, e)
                throw e
            }
        }
        console.log(`🎉 URL done: ${cids.length} sections → ${rid}`)
        return { root_memory_id: rid, child_count: secs.length, total_tokens: ex.metadata.estimated_tokens, strategy: 'root-child', extraction: ex.metadata }
    } catch (e) {
        console.error('❌ URL ingestion failed:', e)
        throw e
    }
}
