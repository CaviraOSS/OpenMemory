import { exec } from "child_process";
import { promisify } from "util";
import mammoth from "mammoth";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import ffmpeg from "fluent-ffmpeg";
import OpenAI from "openai";
const TurndownService = require("turndown");

const execAsync = promisify(exec);

export interface ExtractionResult {
    text: string;
    metadata: {
        content_type: string;
        char_count: number;
        estimated_tokens: number;
        extraction_method: string;
        [key: string]: any;
    };
}

function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

export async function extractPDF(buffer: Buffer): Promise<ExtractionResult> {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const textResult = await parser.getText();
    const infoResult = await parser.getInfo();

    return {
        text: textResult.text,
        metadata: {
            content_type: "pdf",
            char_count: textResult.text.length,
            estimated_tokens: estimateTokens(textResult.text),
            extraction_method: "pdf-parse",
            pages: textResult.total,
            info: infoResult,
        },
    };
}

export async function extractDOCX(buffer: Buffer): Promise<ExtractionResult> {
    const result = await mammoth.extractRawText({ buffer });

    return {
        text: result.value,
        metadata: {
            content_type: "docx",
            char_count: result.value.length,
            estimated_tokens: estimateTokens(result.value),
            extraction_method: "mammoth",
            messages: result.messages,
        },
    };
}

export async function extractHTML(html: string): Promise<ExtractionResult> {
    const turndown = new TurndownService({
        headingStyle: "atx",
        codeBlockStyle: "fenced",
    });

    const markdown = turndown.turndown(html);

    return {
        text: markdown,
        metadata: {
            content_type: "html",
            char_count: markdown.length,
            estimated_tokens: estimateTokens(markdown),
            extraction_method: "turndown",
            original_html_length: html.length,
        },
    };
}

export async function extractURL(url: string): Promise<ExtractionResult> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();

    const turndown = new TurndownService({
        headingStyle: "atx",
        codeBlockStyle: "fenced",
    });

    const markdown = turndown.turndown(html);

    return {
        text: markdown,
        metadata: {
            content_type: "url",
            char_count: markdown.length,
            estimated_tokens: estimateTokens(markdown),
            extraction_method: "node-fetch+turndown",
            source_url: url,
            fetched_at: new Date().toISOString(),
        },
    };
}

export async function extractAudio(
    buffer: Buffer,
    mimeType: string,
): Promise<ExtractionResult> {
    const apiKey = process.env.OPENAI_API_KEY || process.env.OM_OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error(
            "OpenAI API key required for audio transcription. Set OPENAI_API_KEY in .env",
        );
    }


    const maxSize = 25 * 1024 * 1024;
    if (buffer.length > maxSize) {
        throw new Error(
            `Audio file too large: ${(buffer.length / 1024 / 1024).toFixed(2)}MB. Maximum size is 25MB.`,
        );
    }


    const tempDir = os.tmpdir();
    const ext = getAudioExtension(mimeType);
    const tempFilePath = path.join(tempDir, `audio-${Date.now()}${ext}`);

    try {

        fs.writeFileSync(tempFilePath, buffer);


        const openai = new OpenAI({ apiKey });


        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempFilePath),
            model: "whisper-1",
            response_format: "verbose_json",
        });

        const text = transcription.text;

        return {
            text,
            metadata: {
                content_type: "audio",
                char_count: text.length,
                estimated_tokens: estimateTokens(text),
                extraction_method: "whisper",
                audio_format: ext.replace(".", ""),
                file_size_bytes: buffer.length,
                file_size_mb: (buffer.length / 1024 / 1024).toFixed(2),
                duration_seconds: (transcription as any).duration || null,
                language: (transcription as any).language || null,
            },
        };
    } catch (error: any) {
        console.error("[EXTRACT] Audio transcription failed:", error);
        throw new Error(`Audio transcription failed: ${error.message}`);
    } finally {

        try {
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
        } catch (e) {
            console.warn("[EXTRACT] Failed to clean up temp file:", e);
        }
    }
}

export async function extractVideo(
    buffer: Buffer,
): Promise<ExtractionResult> {

    const tempDir = os.tmpdir();
    const videoPath = path.join(
        tempDir,
        `video-${Date.now()}.mp4`,
    );
    const audioPath = path.join(
        tempDir,
        `audio-${Date.now()}.mp3`,
    );

    try {

        fs.writeFileSync(videoPath, buffer);


        await new Promise<void>((resolve, reject) => {
            ffmpeg(videoPath)
                .output(audioPath)
                .noVideo()
                .audioCodec("libmp3lame")
                .on("end", () => resolve())
                .on("error", (err: Error) => reject(err))
                .run();
        });


        const audioBuffer = fs.readFileSync(audioPath);


        const result = await extractAudio(audioBuffer, "audio/mpeg");


        result.metadata.content_type = "video";
        result.metadata.extraction_method = "ffmpeg+whisper";
        result.metadata.video_file_size_bytes = buffer.length;
        result.metadata.video_file_size_mb = (
            buffer.length /
            1024 /
            1024
        ).toFixed(2);

        return result;
    } catch (error: any) {
        if (error.message?.includes("ffmpeg")) {
            throw new Error(
                "FFmpeg not found. Please install FFmpeg to process video files. Visit: https://ffmpeg.org/download.html",
            );
        }
        console.error("[EXTRACT] Video processing failed:", error);
        throw new Error(`Video processing failed: ${error.message}`);
    } finally {

        try {
            if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
            if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
        } catch (e) {
            console.warn("[EXTRACT] Failed to clean up temp files:", e);
        }
    }
}

function getAudioExtension(mimeType: string): string {
    const mimeMap: Record<string, string> = {
        "audio/mpeg": ".mp3",
        "audio/mp3": ".mp3",
        "audio/wav": ".wav",
        "audio/wave": ".wav",
        "audio/x-wav": ".wav",
        "audio/mp4": ".m4a",
        "audio/m4a": ".m4a",
        "audio/x-m4a": ".m4a",
        "audio/webm": ".webm",
        "audio/ogg": ".ogg",
    };
    return mimeMap[mimeType.toLowerCase()] || ".mp3";
}

export async function extractText(
    contentType: string,
    data: string | Buffer,
): Promise<ExtractionResult> {
    const type = contentType.toLowerCase();


    if (
        type === "mp3" ||
        type === "audio" ||
        type === "audio/mpeg" ||
        type === "audio/mp3" ||
        type === "audio/wav" ||
        type === "audio/wave" ||
        type === "audio/x-wav" ||
        type === "wav" ||
        type === "m4a" ||
        type === "audio/mp4" ||
        type === "audio/m4a" ||
        type === "audio/x-m4a" ||
        type === "webm" ||
        type === "audio/webm" ||
        type === "ogg" ||
        type === "audio/ogg"
    ) {
        const buffer = Buffer.isBuffer(data)
            ? data
            : Buffer.from(data as string, "base64");
        return extractAudio(buffer, type.startsWith("audio/") ? type : `audio/${type}`);
    }


    if (
        type === "mp4" ||
        type === "video" ||
        type === "video/mp4" ||
        type === "video/webm" ||
        type === "video/mpeg" ||
        type === "avi" ||
        type === "video/avi" ||
        type === "mov" ||
        type === "video/quicktime"
    ) {
        const buffer = Buffer.isBuffer(data)
            ? data
            : Buffer.from(data as string, "base64");
        return extractVideo(buffer);
    }

    switch (type) {
        case "pdf":
            return extractPDF(
                Buffer.isBuffer(data)
                    ? data
                    : Buffer.from(data as string, "base64"),
            );

        case "docx":
        case "doc":
            return extractDOCX(
                Buffer.isBuffer(data)
                    ? data
                    : Buffer.from(data as string, "base64"),
            );

        case "html":
        case "htm":
            return extractHTML(data.toString());

        case "md":
        case "markdown": {
            const text = data.toString();
            return {
                text,
                metadata: {
                    content_type: "markdown",
                    char_count: text.length,
                    estimated_tokens: estimateTokens(text),
                    extraction_method: "passthrough",
                },
            };
        }

        case "txt":
        case "text": {
            const text = data.toString();
            return {
                text,
                metadata: {
                    content_type: "txt",
                    char_count: text.length,
                    estimated_tokens: estimateTokens(text),
                    extraction_method: "passthrough",
                },
            };
        }

        default:
            throw new Error(`Unsupported content type: ${contentType}`);
    }
}
