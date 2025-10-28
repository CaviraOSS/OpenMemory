import { addHSGMemory } from '../hsg'
import { q, transaction } from '../utils/database'
import { rid, now, j } from '../utils'
import { extractText, ExtractionResult } from './extractors'

const LARGE_DOC_THRESHOLD = 8000
const SECTION_SIZE = 3000

export interface IngestionConfig {
    forceRootChild?: boolean
    sectionSize?: number
    largeDocThreshold?: number
}

export interface IngestionResult {
    root_memory_id: string
    child_count: number
    total_tokens: number
    strategy: 'single' | 'root-child'
    extraction: ExtractionResult['metadata']
}

function splitIntoSections(text: string, sectionSize: number): string[] {
    if (text.length <= sectionSize) {
        return [text]
    }

    const sections: string[] = []
    const paragraphs = text.split(/\n\n+/)

    let currentSection = ''

    for (const para of paragraphs) {
        if (currentSection.length + para.length > sectionSize && currentSection.length > 0) {
            sections.push(currentSection.trim())
            currentSection = para
        } else {
            currentSection += (currentSection ? '\n\n' : '') + para
        }
    }

    if (currentSection.trim()) {
        sections.push(currentSection.trim())
    }

    return sections
}

async function createRootMemory(
    originalText: string,
    extraction: ExtractionResult,
    metadata?: Record<string, unknown>
): Promise<string> {
    const summary = originalText.length > 500
        ? originalText.slice(0, 500) + '...'
        : originalText

    const rootContent = `[Document: ${extraction.metadata.content_type.toUpperCase()}]\n\n${summary}\n\n[Full content split across ${Math.ceil(originalText.length / SECTION_SIZE)} sections]`

    const rootId = rid()
    const created = now()

    await transaction.begin()
    try {
        await q.ins_mem.run(
            rootId,
            rootContent,
            'reflective',
            j([]),
            j({
                ...metadata,
                ...extraction.metadata,
                is_root: true,
                ingestion_strategy: 'root-child',
                ingested_at: created
            }),
            created,
            created,
            created,
            1.0,
            0.1,
            1,
            null,
            null
        )

        await transaction.commit()
        return rootId
    } catch (error) {
        console.error('[ERROR] Failed to create root memory:', error)
        await transaction.rollback()
        throw error
    }
}

async function createChildMemory(
    sectionText: string,
    sectionIndex: number,
    totalSections: number,
    rootId: string,
    metadata?: Record<string, unknown>
): Promise<string> {
    const childMetadata = {
        ...metadata,
        is_child: true,
        section_index: sectionIndex,
        total_sections: totalSections,
        parent_id: rootId
    }

    const result = await addHSGMemory(sectionText, j([]), childMetadata)
    return result.id
}

async function linkRootToChild(rootId: string, childId: string, sectionIndex: number): Promise<void> {
    const created = now()

    await transaction.begin()
    try {
        await q.ins_waypoint.run(
            rootId,
            childId,
            1.0,
            created,
            created
        )
        await transaction.commit()
        console.log(`🔗 Waypoint created: ${rootId.slice(0, 8)} → ${childId.slice(0, 8)} (section ${sectionIndex})`)
    } catch (error) {
        await transaction.rollback()
        console.error(`❌ Failed to create waypoint for section ${sectionIndex}:`, error)
        throw error
    }
}

export async function ingestDocument(
    contentType: string,
    data: string | Buffer,
    metadata?: Record<string, unknown>,
    config?: IngestionConfig
): Promise<IngestionResult> {
    const threshold = config?.largeDocThreshold || LARGE_DOC_THRESHOLD
    const sectionSize = config?.sectionSize || SECTION_SIZE

    const extraction = await extractText(contentType, data)
    const { text, metadata: extractionMeta } = extraction

    const shouldUseRootChild = config?.forceRootChild || extractionMeta.estimated_tokens > threshold

    if (!shouldUseRootChild) {
        const result = await addHSGMemory(text, j([]), {
            ...metadata,
            ...extractionMeta,
            ingestion_strategy: 'single',
            ingested_at: now()
        })

        return {
            root_memory_id: result.id,
            child_count: 0,
            total_tokens: extractionMeta.estimated_tokens,
            strategy: 'single',
            extraction: extractionMeta
        }
    }

    const sections = splitIntoSections(text, sectionSize)

    console.log(`📄 Large document detected: ${extractionMeta.estimated_tokens} tokens`)
    console.log(`📑 Splitting into ${sections.length} sections (root+child strategy)`)

    let rootId: string
    const childIds: string[] = []

    try {
        rootId = await createRootMemory(text, extraction, metadata)
        console.log(`📝 Root memory created: ${rootId}`)

        for (let i = 0; i < sections.length; i++) {
            try {
                const childId = await createChildMemory(
                    sections[i],
                    i,
                    sections.length,
                    rootId,
                    metadata
                )
                childIds.push(childId)

                await linkRootToChild(rootId, childId, i)

                console.log(`✅ Section ${i + 1}/${sections.length} created: ${childId}`)
            } catch (error) {
                console.error(`❌ Failed to process section ${i + 1}/${sections.length}:`, error)
                throw error
            }
        }

        console.log(`🎉 Document ingestion complete: ${childIds.length} sections linked to root ${rootId}`)

        return {
            root_memory_id: rootId,
            child_count: sections.length,
            total_tokens: extractionMeta.estimated_tokens,
            strategy: 'root-child',
            extraction: extractionMeta
        }
    } catch (error) {
        console.error('❌ Document ingestion failed:', error)
        throw error
    }
}

export async function ingestURL(
    url: string,
    metadata?: Record<string, unknown>,
    config?: IngestionConfig
): Promise<IngestionResult> {
    const { extractURL } = await import('./extractors')
    const extraction = await extractURL(url)

    const threshold = config?.largeDocThreshold || LARGE_DOC_THRESHOLD
    const sectionSize = config?.sectionSize || SECTION_SIZE

    const shouldUseRootChild = config?.forceRootChild || extraction.metadata.estimated_tokens > threshold

    if (!shouldUseRootChild) {
        const result = await addHSGMemory(extraction.text, j([]), {
            ...metadata,
            ...extraction.metadata,
            ingestion_strategy: 'single',
            ingested_at: now()
        })

        return {
            root_memory_id: result.id,
            child_count: 0,
            total_tokens: extraction.metadata.estimated_tokens,
            strategy: 'single',
            extraction: extraction.metadata
        }
    }

    const sections = splitIntoSections(extraction.text, sectionSize)

    console.log(`🌐 Large URL content detected: ${extraction.metadata.estimated_tokens} tokens`)
    console.log(`📑 Splitting into ${sections.length} sections (root+child strategy)`)

    let rootId: string
    const childIds: string[] = []

    try {
        rootId = await createRootMemory(extraction.text, extraction, {
            ...metadata,
            source_url: url
        })
        console.log(`📝 Root memory created for URL: ${rootId}`)

        for (let i = 0; i < sections.length; i++) {
            try {
                const childId = await createChildMemory(
                    sections[i],
                    i,
                    sections.length,
                    rootId,
                    { ...metadata, source_url: url }
                )
                childIds.push(childId)

                await linkRootToChild(rootId, childId, i)

                console.log(`✅ URL section ${i + 1}/${sections.length} created: ${childId}`)
            } catch (error) {
                console.error(`❌ Failed to process URL section ${i + 1}/${sections.length}:`, error)
                throw error
            }
        }

        console.log(`🎉 URL ingestion complete: ${childIds.length} sections linked to root ${rootId}`)

        return {
            root_memory_id: rootId,
            child_count: sections.length,
            total_tokens: extraction.metadata.estimated_tokens,
            strategy: 'root-child',
            extraction: extraction.metadata
        }
    } catch (error) {
        console.error('❌ URL ingestion failed:', error)
        throw error
    }
}
