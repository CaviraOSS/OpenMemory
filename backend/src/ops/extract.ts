import { exec } from 'child_process'
import { promisify } from 'util'
import mammoth from 'mammoth'
const TurndownService = require('turndown')

const execAsync = promisify(exec)

export interface ExtractionResult {
    text: string
    metadata: {
        content_type: string
        char_count: number
        estimated_tokens: number
        extraction_method: string
        [key: string]: any
    }
}

function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
}

export async function extractPDF(buffer: Buffer): Promise<ExtractionResult> {
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: buffer })
    const textResult = await parser.getText()
    const infoResult = await parser.getInfo()

    return {
        text: textResult.text,
        metadata: {
            content_type: 'pdf',
            char_count: textResult.text.length,
            estimated_tokens: estimateTokens(textResult.text),
            extraction_method: 'pdf-parse',
            pages: textResult.total,
            info: infoResult
        }
    }
}

export async function extractDOCX(buffer: Buffer): Promise<ExtractionResult> {
    const result = await mammoth.extractRawText({ buffer })

    return {
        text: result.value,
        metadata: {
            content_type: 'docx',
            char_count: result.value.length,
            estimated_tokens: estimateTokens(result.value),
            extraction_method: 'mammoth',
            messages: result.messages
        }
    }
}

export async function extractHTML(html: string): Promise<ExtractionResult> {

    const turndown = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced'
    })

    const markdown = turndown.turndown(html)

    return {
        text: markdown,
        metadata: {
            content_type: 'html',
            char_count: markdown.length,
            estimated_tokens: estimateTokens(markdown),
            extraction_method: 'turndown',
            original_html_length: html.length
        }
    }
}

export async function extractURL(url: string): Promise<ExtractionResult> {
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()

    const turndown = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced'
    })

    const markdown = turndown.turndown(html)

    return {
        text: markdown,
        metadata: {
            content_type: 'url',
            char_count: markdown.length,
            estimated_tokens: estimateTokens(markdown),
            extraction_method: 'node-fetch+turndown',
            source_url: url,
            fetched_at: new Date().toISOString()
        }
    }
}

export async function extractText(contentType: string, data: string | Buffer): Promise<ExtractionResult> {
    switch (contentType.toLowerCase()) {
        case 'pdf':
            return extractPDF(Buffer.isBuffer(data) ? data : Buffer.from(data as string, 'base64'))

        case 'docx':
        case 'doc':
            return extractDOCX(Buffer.isBuffer(data) ? data : Buffer.from(data as string, 'base64'))

        case 'html':
        case 'htm':
            return extractHTML(data.toString())

        case 'md':
        case 'markdown': {
            const text = data.toString()
            return {
                text,
                metadata: {
                    content_type: 'markdown',
                    char_count: text.length,
                    estimated_tokens: estimateTokens(text),
                    extraction_method: 'passthrough'
                }
            }
        }

        case 'txt':
        case 'text': {
            const text = data.toString()
            return {
                text,
                metadata: {
                    content_type: 'txt',
                    char_count: text.length,
                    estimated_tokens: estimateTokens(text),
                    extraction_method: 'passthrough'
                }
            }
        }

        default:
            throw new Error(`Unsupported content type: ${contentType}`)
    }
}
