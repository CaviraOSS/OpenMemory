# Frequently Asked Questions

### How does this differ from Chroma/Pinecone?
OpenMemory is an **agentic memory layer**, not just a vector database. It handles user separation, temporal tracking, and memory dynamics (decay, reinforcement) out of the box.

### Can I use it with any LLM?
Yes. OpenMemory is model-agnostic. You can use OpenAI, Anthropic, or local models (Llama 3 via Ollama).

### Is the data persistent?
Yes. By default, it uses SQLite which saves to a file. You can also configure Postgres for production scaling.
