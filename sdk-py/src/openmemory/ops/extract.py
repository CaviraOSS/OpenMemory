async def extract_text(t, data):
    # Placeholder
    return {
        "text": t,
        "metadata": {
            "content_type": "text/plain",
            "estimated_tokens": len(t) // 4
        }
    }

async def extract_url(url):
    # Placeholder
    return {
        "text": f"Content from {url}",
        "metadata": {
            "content_type": "text/html",
            "estimated_tokens": 100,
            "source_url": url
        }
    }
