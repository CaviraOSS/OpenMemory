def chunk_text(text, max_tokens=500):
    # Simple character-based chunking for now
    # 1 token ~= 4 chars
    chunk_size = max_tokens * 4
    chunks = []
    for i in range(0, len(text), chunk_size):
        chunks.append(text[i:i+chunk_size])
    return chunks
