"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPDF = extractPDF;
exports.extractDOCX = extractDOCX;
exports.extractHTML = extractHTML;
exports.extractURL = extractURL;
exports.extractAudio = extractAudio;
exports.extractVideo = extractVideo;
exports.extractText = extractText;
const child_process_1 = require("child_process");
const util_1 = require("util");
const mammoth_1 = __importDefault(require("mammoth"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const openai_1 = __importDefault(require("openai"));
const TurndownService = require("turndown");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
function estimateTokens(text) {
    return Math.ceil(text.length / 4);
}
async function extractPDF(buffer) {
    const { PDFParse } = await Promise.resolve().then(() => __importStar(require("pdf-parse")));
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
async function extractDOCX(buffer) {
    const result = await mammoth_1.default.extractRawText({ buffer });
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
async function extractHTML(html) {
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
async function extractURL(url) {
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
async function extractAudio(buffer, mimeType) {
    const apiKey = process.env.OPENAI_API_KEY || process.env.OM_OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error("OpenAI API key required for audio transcription. Set OPENAI_API_KEY in .env");
    }
    // Check file size (Whisper API limit is 25MB)
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (buffer.length > maxSize) {
        throw new Error(`Audio file too large: ${(buffer.length / 1024 / 1024).toFixed(2)}MB. Maximum size is 25MB.`);
    }
    // Create temporary file for Whisper API
    const tempDir = os.tmpdir();
    const ext = getAudioExtension(mimeType);
    const tempFilePath = path.join(tempDir, `audio-${Date.now()}${ext}`);
    try {
        // Write buffer to temp file
        fs.writeFileSync(tempFilePath, buffer);
        // Initialize OpenAI client
        const openai = new openai_1.default({ apiKey });
        // Transcribe audio using Whisper
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
                duration_seconds: transcription.duration || null,
                language: transcription.language || null,
            },
        };
    }
    catch (error) {
        console.error("[EXTRACT] Audio transcription failed:", error);
        throw new Error(`Audio transcription failed: ${error.message}`);
    }
    finally {
        // Clean up temp file
        try {
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
        }
        catch (e) {
            console.warn("[EXTRACT] Failed to clean up temp file:", e);
        }
    }
}
async function extractVideo(buffer) {
    // Create temporary files for video and audio
    const tempDir = os.tmpdir();
    const videoPath = path.join(tempDir, `video-${Date.now()}.mp4`);
    const audioPath = path.join(tempDir, `audio-${Date.now()}.mp3`);
    try {
        // Write video buffer to temp file
        fs.writeFileSync(videoPath, buffer);
        // Extract audio using ffmpeg
        await new Promise((resolve, reject) => {
            (0, fluent_ffmpeg_1.default)(videoPath)
                .output(audioPath)
                .noVideo()
                .audioCodec("libmp3lame")
                .on("end", () => resolve())
                .on("error", (err) => reject(err))
                .run();
        });
        // Read extracted audio
        const audioBuffer = fs.readFileSync(audioPath);
        // Transcribe extracted audio
        const result = await extractAudio(audioBuffer, "audio/mpeg");
        // Update metadata to reflect video source
        result.metadata.content_type = "video";
        result.metadata.extraction_method = "ffmpeg+whisper";
        result.metadata.video_file_size_bytes = buffer.length;
        result.metadata.video_file_size_mb = (buffer.length /
            1024 /
            1024).toFixed(2);
        return result;
    }
    catch (error) {
        if (error.message?.includes("ffmpeg")) {
            throw new Error("FFmpeg not found. Please install FFmpeg to process video files. Visit: https://ffmpeg.org/download.html");
        }
        console.error("[EXTRACT] Video processing failed:", error);
        throw new Error(`Video processing failed: ${error.message}`);
    }
    finally {
        // Clean up temp files
        try {
            if (fs.existsSync(videoPath))
                fs.unlinkSync(videoPath);
            if (fs.existsSync(audioPath))
                fs.unlinkSync(audioPath);
        }
        catch (e) {
            console.warn("[EXTRACT] Failed to clean up temp files:", e);
        }
    }
}
function getAudioExtension(mimeType) {
    const mimeMap = {
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
async function extractText(contentType, data) {
    const type = contentType.toLowerCase();
    // Audio formats
    if (type === "mp3" ||
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
        type === "audio/ogg") {
        const buffer = Buffer.isBuffer(data)
            ? data
            : Buffer.from(data, "base64");
        return extractAudio(buffer, type.startsWith("audio/") ? type : `audio/${type}`);
    }
    // Video formats
    if (type === "mp4" ||
        type === "video" ||
        type === "video/mp4" ||
        type === "video/webm" ||
        type === "video/mpeg" ||
        type === "avi" ||
        type === "video/avi" ||
        type === "mov" ||
        type === "video/quicktime") {
        const buffer = Buffer.isBuffer(data)
            ? data
            : Buffer.from(data, "base64");
        return extractVideo(buffer);
    }
    switch (type) {
        case "pdf":
            return extractPDF(Buffer.isBuffer(data)
                ? data
                : Buffer.from(data, "base64"));
        case "docx":
        case "doc":
            return extractDOCX(Buffer.isBuffer(data)
                ? data
                : Buffer.from(data, "base64"));
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
