import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { promisify } from 'node:util';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import TurndownService from 'turndown';

const exec_file = promisify(execFile);

export type extraction_page = { number: number; text: string };
export type extraction_result = {
    text: string;
    metadata: {
        content_type: string;
        char_count: number;
        estimated_tokens: number;
        extraction_method: string;
        pages?: extraction_page[];
        [key: string]: unknown;
    };
};

export type extraction_input = {
    data: Uint8Array | string;
    content_type?: string;
    filename?: string;
    source_url?: string;
    fetch?: typeof fetch;
    openai_api_key?: string;
    openai_base_url?: string;
    transcription_model?: string;
    ffmpeg_path?: string;
};

const bytes = (data: extraction_input['data']) => typeof data === 'string' ? Buffer.from(data) : Buffer.from(data);
const estimate_tokens = (text: string) => Math.ceil(text.length / 4);
const result = (text: string, content_type: string, extraction_method: string, metadata: Record<string, unknown> = {}): extraction_result => ({
    text: text.trim(),
    metadata: { content_type, char_count: text.trim().length, estimated_tokens: estimate_tokens(text), extraction_method, ...metadata },
});

const extension_type = (filename = '') => extname(filename).slice(1).toLowerCase();

export function detect_content_type(filename = '', mime_type = ''): string {
    const mime = mime_type.split(';')[0].toLowerCase();
    if (mime.includes('pdf')) return 'pdf';
    if (mime.includes('wordprocessingml') || mime.includes('msword')) return 'docx';
    if (mime.includes('html')) return 'html';
    if (mime.startsWith('audio/')) return 'audio';
    if (mime.startsWith('video/')) return 'video';
    const ext = extension_type(filename);
    if (['pdf'].includes(ext)) return 'pdf';
    if (['doc', 'docx'].includes(ext)) return 'docx';
    if (['html', 'htm'].includes(ext)) return 'html';
    if (['mp3', 'wav', 'm4a', 'webm', 'ogg', 'flac'].includes(ext)) return 'audio';
    if (['mp4', 'mov', 'avi', 'mkv', 'mpeg', 'mpg'].includes(ext)) return 'video';
    if (['md', 'mdx', 'markdown'].includes(ext)) return 'markdown';
    return 'text';
}

async function extract_pdf(data: Uint8Array): Promise<extraction_result> {
    const parser = new PDFParse({ data: Buffer.from(data) });
    try {
        const [text, info] = await Promise.all([parser.getText(), parser.getInfo()]);
        return result(text.text, 'pdf', 'pdf-parse', {
            page_count: text.total,
            pages: text.pages.map((page) => ({ number: page.num, text: page.text })),
            info: info.info ?? {},
            metadata: info.metadata ?? {},
        });
    } finally {
        await parser.destroy();
    }
}

async function extract_docx(data: Uint8Array): Promise<extraction_result> {
    const extracted = await mammoth.extractRawText({ buffer: Buffer.from(data) });
    return result(extracted.value, 'docx', 'mammoth', { messages: extracted.messages });
}

const extract_html = (data: Uint8Array | string): extraction_result => {
    const html = typeof data === 'string' ? data : Buffer.from(data).toString('utf8');
    const markdown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' }).turndown(html);
    return result(markdown, 'html', 'turndown', { original_html_length: html.length });
};

async function extract_audio(input: extraction_input): Promise<extraction_result> {
    const api_key = input.openai_api_key ?? process.env.OPENAI_API_KEY ?? process.env.OM_OPENAI_API_KEY;
    if (!api_key) throw new Error('audio transcription requires OPENAI_API_KEY or openai_api_key');
    const data = bytes(input.data);
    if (data.length > 25 * 1024 * 1024) throw new Error('audio transcription input exceeds 25 MiB');
    const form = new FormData();
    form.set('file', new Blob([data]), input.filename || 'audio.mp3');
    form.set('model', input.transcription_model ?? 'whisper-1');
    form.set('response_format', 'verbose_json');
    const fetcher = input.fetch ?? fetch;
    const base = (input.openai_base_url ?? process.env.OM_OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    const response = await fetcher(`${base}/audio/transcriptions`, { method: 'POST', headers: { authorization: `Bearer ${api_key}` }, body: form });
    if (!response.ok) throw new Error(`audio transcription failed: ${response.status} ${(await response.text()).slice(0, 500)}`);
    const payload = await response.json() as { text?: string; duration?: number; language?: string };
    if (!payload.text?.trim()) throw new Error('audio transcription returned no text');
    return result(payload.text, 'audio', 'openai-transcription', { duration_seconds: payload.duration ?? null, language: payload.language ?? null, file_size_bytes: data.length });
}

async function extract_video(input: extraction_input): Promise<extraction_result> {
    const directory = await mkdtemp(join(tmpdir(), 'openmemory-media-'));
    const video = join(directory, `input${extname(input.filename ?? '') || '.mp4'}`);
    const audio = join(directory, 'audio.mp3');
    try {
        await writeFile(video, bytes(input.data));
        try {
            await exec_file(input.ffmpeg_path ?? process.env.FFMPEG_PATH ?? 'ffmpeg', ['-y', '-i', video, '-vn', '-acodec', 'libmp3lame', audio], { windowsHide: true });
        } catch (error) {
            throw new Error(`video extraction requires ffmpeg: ${error instanceof Error ? error.message : String(error)}`);
        }
        const extracted = await extract_audio({ ...input, data: await readFile(audio), filename: 'audio.mp3', content_type: 'audio' });
        return result(extracted.text, 'video', 'ffmpeg+openai-transcription', { ...extracted.metadata, content_type: 'video', source_file_size_bytes: bytes(input.data).length });
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
}

export async function extract_content(input: extraction_input): Promise<extraction_result> {
    const type = input.content_type ?? detect_content_type(input.filename);
    if (type === 'pdf') return extract_pdf(bytes(input.data));
    if (type === 'docx') return extract_docx(bytes(input.data));
    if (type === 'html') return extract_html(input.data);
    if (type === 'audio') return extract_audio(input);
    if (type === 'video') return extract_video(input);
    const text = typeof input.data === 'string' ? input.data : Buffer.from(input.data).toString('utf8');
    return result(text, type === 'markdown' ? 'markdown' : 'text', 'utf8');
}

export async function extract_url(url: string, options: Omit<extraction_input, 'data' | 'source_url'> = {}): Promise<extraction_result> {
    const fetcher = options.fetch ?? fetch;
    const response = await fetcher(url);
    if (!response.ok) throw new Error(`content fetch failed: ${response.status} ${response.statusText}`);
    const content_type = detect_content_type(new URL(url).pathname, response.headers.get('content-type') ?? '');
    const data = new Uint8Array(await response.arrayBuffer());
    const extracted = await extract_content({ ...options, data, content_type, filename: new URL(url).pathname.split('/').pop(), source_url: url });
    extracted.metadata.source_url = url;
    extracted.metadata.fetched_at = Date.now();
    return extracted;
}