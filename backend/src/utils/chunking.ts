/**
 * Text Chunking Utilities for Large Context Handling
 * HMD v2 Spec Section 4.1: 512-1024 tokens with 10% overlap
 */

export interface Chunk {
    text: string
    start: number
    end: number
    tokens: number
}

const CHARS_PER_TOKEN = 4

/**
 * Estimates token count from text length
 */
function estimateTokens(text: string): number {
    return Math.ceil(text.length / CHARS_PER_TOKEN)
}

/**
 * Splits text into chunks respecting sentence/paragraph boundaries
 * Per HMD v2 spec: 512-1024 tokens with 10% overlap
 */
export function chunkText(
    text: string,
    targetTokens: number = 768,
    overlapRatio: number = 0.1
): Chunk[] {
    const chunks: Chunk[] = []

    const totalTokens = estimateTokens(text)
    if (totalTokens <= targetTokens) {
        return [{
            text,
            start: 0,
            end: text.length,
            tokens: totalTokens
        }]
    }

    const targetChars = targetTokens * CHARS_PER_TOKEN
    const overlapChars = Math.floor(targetChars * overlapRatio)

    const paragraphs = text.split(/\n\n+/)

    let currentChunk = ''
    let chunkStart = 0

    for (let i = 0; i < paragraphs.length; i++) {
        const para = paragraphs[i]
        const sentences = para.split(/(?<=[.!?])\s+/)

        for (const sentence of sentences) {
            const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + sentence

            if (potentialChunk.length > targetChars && currentChunk.length > 0) {

                chunks.push({
                    text: currentChunk,
                    start: chunkStart,
                    end: chunkStart + currentChunk.length,
                    tokens: estimateTokens(currentChunk)
                })

                const overlapText = currentChunk.slice(-overlapChars)
                currentChunk = overlapText + ' ' + sentence
                chunkStart = chunkStart + currentChunk.length - overlapText.length - 1
            } else {
                currentChunk = potentialChunk
            }
        }
    }

    if (currentChunk.length > 0) {
        chunks.push({
            text: currentChunk,
            start: chunkStart,
            end: chunkStart + currentChunk.length,
            tokens: estimateTokens(currentChunk)
        })
    }

    return chunks
}

/**
 * Aggregate chunk vectors into single sector vector using mean pooling
 * Per HMD v2 spec section 4.3: mean or attention-weighted pooling
 */
export function aggregateVectors(vectors: number[][]): number[] {
    if (vectors.length === 0) throw new Error('No vectors to aggregate')
    if (vectors.length === 1) return vectors[0]

    const dim = vectors[0].length
    const result = new Array(dim).fill(0)

    for (const vector of vectors) {
        for (let i = 0; i < dim; i++) {
            result[i] += vector[i]
        }
    }

    for (let i = 0; i < dim; i++) {
        result[i] /= vectors.length
    }

    return result
}

/**
 * Combines chunks back into full text (for display/context)
 */
export function combineChunks(chunks: Chunk[]): string {
    const len = chunks.length;
    if (len === 0) return '';
    let str = chunks[0].text;
    for (let i = 1; i < len; ++i) {
        str += ' ' + chunks[i].text;
    }
    return str;
}
