# Core Concepts

OpenMemory differs from a standard Vector DB by implementing a cognitive architecture inspired by human memory systems.

## Memory Architecture

1.  **Episodic Memory**: Stores specific events and interactions.
2.  **Semantic Memory**: Stores generalized facts and knowledge derived from episodes.
3.  **Procedural Memory**: (Planned) Stores "how-to" knowledge and tools.

## The Hierarchical Storage Graph (HSG)

Data is not just dumped into a flat index. It is organized hierarchically:

*   **Sectors**: High-level domains (e.g., "Personal", "Work", "Code").
*   **Nodes**: Individual memory units.
*   **Edges**: Relationships between memories (temporal, semantic, or explicit entities).

## Temporal Graph

Time is a first-class citizen. OpenMemory tracks:

*   **Creation Time**: When the memory was formed.
*   **Last Access**: When it was last retrieved (used for decay).
*   **Sequence**: The causal chain of events (Chat History is a temporal chain).

This allows for queries like *"What did we talk about last week?"* or *"What happened before I mentioned the bug?"*.

## Retrieval Dynamics (Scoring)

When you call `search()`, memories are scored based on three factors:

1.  **Relevance (Vector Similarity)**: How semantically similar is the query?
2.  **Recency**: Recent memories are weighted higher (decay function).
3.  **Importance**: "Core" memories (often retrieved) gain persistence.

`Score = (Similarity * alpha) + (Recency * beta) + (Importance * gamma)`

## User Partitioning

All memories are strictly partitioned by `user_id`. This ensures that in multi-user applications (like a SaaS bot), User A never sees User B's memories.
