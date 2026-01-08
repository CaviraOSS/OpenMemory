import os
import time
import json
import logging
import asyncio
import tempfile
import re
from typing import Dict, Any, Union

import httpx
from pypdf import PdfReader
import mammoth
from markdownify import markdownify as md
from openai import AsyncOpenAI
from ..core.config import env

def estimate_tokens(text: str) -> int:
    return int(len(text) / 4) + 1

async def extract_pdf(data: bytes) -> Dict[str, Any]:
    import io
    reader = PdfReader(io.BytesIO(data))
    text = ""
    for page in reader.pages:
        text += page.extract_text() + "\n"

    return {
        "text": text,
        "metadata": {
            "content_type": "pdf",
            "char_count": len(text),
            "estimated_tokens": estimate_tokens(text),
            "extraction_method": "pypdf",
            "pages": len(reader.pages)
        }
    }

async def extract_docx(data: bytes) -> Dict[str, Any]:
    import io
    result = mammoth.extract_raw_text(io.BytesIO(data))
    text = result.value
    return {
        "text": text,
        "metadata": {
            "content_type": "docx",
            "char_count": len(text),
            "estimated_tokens": estimate_tokens(text),
            "extraction_method": "mammoth",
            "messages": [str(m) for m in result.messages]
        }
    }

async def extract_html(html: str) -> Dict[str, Any]:
    text = md(html, heading_style="ATX", code_language="")
    return {
        "text": text,
        "metadata": {
            "content_type": "html",
            "char_count": len(text),
            "estimated_tokens": estimate_tokens(text),
            "extraction_method": "markdownify",
            "original_html_length": len(html)
        }
    }

async def extract_url(url: str) -> Dict[str, Any]:
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, follow_redirects=True)
        resp.raise_for_status()
        html = resp.text

    return await extract_html(html)

async def extract_audio(data: bytes, mime_type: str) -> Dict[str, Any]:
    api_key = env.openai_api_key or os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OpenAI API key required for audio transcription")

    if len(data) > 25 * 1024 * 1024:
        raise ValueError("Audio file too large (max 25MB)")

    ext = ".mp3"
    if "wav" in mime_type: ext = ".wav"
    elif "m4a" in mime_type: ext = ".m4a"
    elif "ogg" in mime_type: ext = ".ogg"
    elif "webm" in mime_type: ext = ".webm"

    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name

    try:
        client = AsyncOpenAI(api_key=api_key)
        with open(tmp_path, "rb") as f:
            transcription = await client.audio.transcriptions.create(
                file=f,
                model="whisper-1",
                response_format="verbose_json"
            )

        text = transcription.text
        return {
            "text": text,
            "metadata": {
                "content_type": "audio",
                "char_count": len(text),
                "estimated_tokens": estimate_tokens(text),
                "extraction_method": "whisper",
                "audio_format": ext.replace(".", ""),
                "file_size_bytes": len(data),
                "duration_seconds": getattr(transcription, "duration", None),
                "language": getattr(transcription, "language", None)
            }
        }
    except Exception as e:
        print(f"[EXTRACT] Audio failed: {e}")
        raise e
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)

async def extract_video(data: bytes) -> Dict[str, Any]:
    import subprocess

    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as vid_tmp:
        vid_tmp.write(data)
        vid_path = vid_tmp.name

    audio_path = vid_path.replace(".mp4", ".mp3")

    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", vid_path, "-vn", "-acodec", "libmp3lame", audio_path],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )

        with open(audio_path, "rb") as f:
            audio_data = f.read()

        res = await extract_audio(audio_data, "audio/mp3")
        res["metadata"]["content_type"] = "video"
        res["metadata"]["extraction_method"] = "ffmpeg+whisper"
        res["metadata"]["video_size"] = len(data)
        return res

    except FileNotFoundError:
        raise RuntimeError("FFmpeg not found")
    except Exception as e:
        print(f"[EXTRACT] Video failed: {e}")
        raise e
    finally:
        if os.path.exists(vid_path): os.unlink(vid_path)
        if os.path.exists(audio_path): os.unlink(audio_path)

async def extract_text(content_type: str, data: Union[str, bytes]) -> Dict[str, Any]:
    ctype = content_type.lower()
    if any(x in ctype for x in ["audio", "mp3", "wav", "m4a", "ogg", "webm"]) and "video" not in ctype:
        buf = data if isinstance(data, bytes) else data.encode("utf-8")
        return await extract_audio(buf, ctype)

    if any(x in ctype for x in ["video", "mp4", "avi", "mov"]):
        buf = data if isinstance(data, bytes) else data.encode("utf-8")
        return await extract_video(buf)

    if "pdf" in ctype:
        buf = data if isinstance(data, bytes) else data.encode("utf-8")
        return await extract_pdf(buf)

    if "docx" in ctype or ctype.endswith(".doc") or "msword" in ctype:
        buf = data if isinstance(data, bytes) else data.encode("utf-8")
        return await extract_docx(buf)

    if "html" in ctype or "htm" in ctype:
        s = data.decode("utf-8") if isinstance(data, bytes) else data
        return await extract_html(s)

    if "markdown" in ctype or "md" in ctype or "txt" in ctype or "text" in ctype:
        s = data.decode("utf-8") if isinstance(data, bytes) else data
        return {
            "text": s,
            "metadata": {
                "content_type": ctype,
                "char_count": len(s),
                "estimated_tokens": estimate_tokens(s),
                "extraction_method": "passthrough"
            }
        }

    raise ValueError(f"Unsupported content type: {content_type}")
