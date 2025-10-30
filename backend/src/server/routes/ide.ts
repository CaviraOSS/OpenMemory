import { q } from '../../database'
import { addHSGMemory, hsgQuery } from '../../hsg'
import { j, p } from '../../utils'
import * as crypto from 'crypto';
export function ide(app: any) {
    app.post('/api/ide/events', async (req: any, res: any) => {
        try {
            const event_type = req.body.event_type
            const file_path = req.body.file_path || 'unknown'
            const content = req.body.content || ''
            const session_id = req.body.session_id || 'default'
            const metadata = req.body.metadata || {}

            if (!event_type) return res.status(400).json({ err: 'event_type_required' })

            const memory_content = `[${event_type}] ${file_path}\n${content}`.trim()

            const full_metadata = {
                ...metadata,
                ide_event_type: event_type,
                ide_file_path: file_path,
                ide_session_id: session_id,
                ide_timestamp: Date.now(),
                ide_mode: true
            }

            const result = await addHSGMemory(memory_content, undefined, full_metadata)

            res.json({
                success: true,
                memory_id: result.id,
                primary_sector: result.primary_sector,
                sectors: result.sectors
            })
        } catch (err) {
            console.error('Error storing IDE event:', err)
            res.status(500).json({ err: 'internal' })
        }
    })

    // POST /api/ide/context - Query relevant context
    app.post('/api/ide/context', async (req: any, res: any) => {
        try {
            const query = req.body.query
            const k = req.body.k || req.body.limit || 5
            const session_id = req.body.session_id
            const file_path = req.body.file_path

            if (!query) return res.status(400).json({ err: 'query_required' })

            const results = await hsgQuery(query, k)

            let filtered = results

            // Filter by session if provided
            if (session_id) {
                filtered = []
                for (const r of results) {
                    const mem = await q.get_mem.get(r.id)
                    if (mem) {
                        const meta = p(mem.meta)
                        if (meta && meta.ide_session_id === session_id) {
                            filtered.push(r)
                        }
                    }
                }
            }

            // Filter by file path if provided
            if (file_path) {
                filtered = filtered.filter((r: any) => r.content.includes(file_path))
            }

            const formatted = filtered.map((r: any) => ({
                memory_id: r.id,
                content: r.content,
                primary_sector: r.primary_sector,
                sectors: r.sectors,
                score: r.score,
                salience: r.salience,
                last_seen_at: r.last_seen_at,
                path: r.path
            }))

            res.json({
                success: true,
                memories: formatted,
                total: formatted.length,
                query: query
            })
        } catch (err) {
            console.error('Error retrieving IDE context:', err)
            res.status(500).json({ err: 'internal' })
        }
    })

    // POST /api/ide/session/start - Start IDE session
    app.post('/api/ide/session/start', async (req: any, res: any) => {
        try {
            const user_id = req.body.user_id || 'anonymous'
            const project_name = req.body.project_name || 'unknown'
            const ide_name = req.body.ide_name || 'unknown'

            const session_id = `session_${Date.now()}_${crypto.randomBytes(7).toString('hex')}`
            const now_ts = Date.now()

            const content = `Session started: ${user_id} in ${project_name} using ${ide_name}`

            const metadata = {
                ide_session_id: session_id,
                ide_user_id: user_id,
                ide_project_name: project_name,
                ide_name: ide_name,
                session_start_time: now_ts,
                session_type: 'ide_session',
                ide_mode: true
            }

            const result = await addHSGMemory(content, undefined, metadata)

            res.json({
                success: true,
                session_id: session_id,
                memory_id: result.id,
                started_at: now_ts,
                user_id: user_id,
                project_name: project_name,
                ide_name: ide_name
            })
        } catch (err) {
            console.error('Error starting IDE session:', err)
            res.status(500).json({ err: 'internal' })
        }
    })

    // POST /api/ide/session/end - End IDE session
    app.post('/api/ide/session/end', async (req: any, res: any) => {
        try {
            const session_id = req.body.session_id

            if (!session_id) return res.status(400).json({ err: 'session_id_required' })

            const now_ts = Date.now()

            // Get all memories from this session
            const all_memories = await q.all_mem.all(10000, 0)
            const session_memories = all_memories.filter((m: any) => {
                try {
                    const meta = p(m.meta)
                    return meta && meta.ide_session_id === session_id
                } catch {
                    return false
                }
            })

            const total_events = session_memories.length
            const sectors: Record<string, number> = {}
            const files = new Set<string>()

            for (const m of session_memories) {
                sectors[m.primary_sector] = (sectors[m.primary_sector] || 0) + 1
                try {
                    const meta = p(m.meta)
                    if (meta && meta.ide_file_path && meta.ide_file_path !== 'unknown') {
                        files.add(meta.ide_file_path)
                    }
                } catch { }
            }

            const summary = `Session ${session_id} ended. Events: ${total_events}, Files: ${files.size}, Sectors: ${j(sectors)}`

            const metadata = {
                ide_session_id: session_id,
                session_end_time: now_ts,
                session_type: 'ide_session_end',
                total_events: total_events,
                sectors_distribution: sectors,
                files_touched: Array.from(files),
                ide_mode: true
            }

            const result = await addHSGMemory(summary, undefined, metadata)

            res.json({
                success: true,
                session_id: session_id,
                ended_at: now_ts,
                summary_memory_id: result.id,
                statistics: {
                    total_events: total_events,
                    sectors: sectors,
                    unique_files: files.size,
                    files: Array.from(files)
                }
            })
        } catch (err) {
            console.error('Error ending IDE session:', err)
            res.status(500).json({ err: 'internal' })
        }
    })

    // GET /api/ide/patterns/:session_id - Get coding patterns
    app.get('/api/ide/patterns/:session_id', async (req: any, res: any) => {
        try {
            const session_id = req.params.session_id

            if (!session_id) return res.status(400).json({ err: 'session_id_required' })

            const all_memories = await q.all_mem.all(10000, 0)

            const procedural = all_memories.filter((m: any) => {
                if (m.primary_sector !== 'procedural') return false
                try {
                    const meta = p(m.meta)
                    return meta && meta.ide_session_id === session_id
                } catch {
                    return false
                }
            })

            const patterns = procedural.map((m: any) => ({
                pattern_id: m.id,
                description: m.content,
                salience: m.salience,
                detected_at: m.created_at,
                last_reinforced: m.last_seen_at
            }))

            res.json({
                success: true,
                session_id: session_id,
                pattern_count: patterns.length,
                patterns: patterns
            })
        } catch (err) {
            console.error('Error detecting patterns:', err)
            res.status(500).json({ err: 'internal' })
        }
    })
}
