# Memory Registration Guide (OpenMemory Fork)

## Memory Types

**Episodic**: Specific events with temporal context
- *Register*: Stories, dated events, "what happened"
- *Salience factors*: Recency, uniqueness, user emphasis

**Semantic**: Facts, preferences, general knowledge
- *Register*: Beliefs, opinions, identity, likes/dislikes
- *Salience factors*: Frequency mentioned, confidence level, contradicts prior knowledge

**Procedural**: Processes, workflows, habits
- *Register*: How-to knowledge, routines, repeated patterns
- *Salience factors*: Frequency of use, complexity, success rate

**Emotional**: Feelings and emotional associations
- *Register*: Strong emotions, reactions, stress/joy points
- *Salience factors*: Intensity, valence (positive/negative), physiological impact

**Reflective**: Patterns, insights, meta-learnings
- *Register*: Cross-memory patterns, behavior trends, evolution
- *Salience factors*: Number of supporting memories, insight depth, actionability

## Decision Logic

1. **Specific event?** → Episodic
2. **Timeless fact/preference?** → Semantic
3. **Process/habit?** → Procedural
4. **Emotional content?** → Emotional
5. **Synthesized pattern?** → Reflective

**Multi-category**: Register separately in each type (allows independent decay/reinforcement)

## Salience Scoring (0.0-1.0)

**High salience (0.7-1.0)** - Resists decay, critical for future:
- Emotionally charged content
- Repeated/reinforced information
- User explicitly emphasized ("important", "remember this")
- Core identity/preferences
- Recent significant events

**Medium salience (0.4-0.6)** - Normal decay:
- Standard interactions
- Casual preferences
- Routine procedural knowledge
- Moderate emotional content

**Low salience (0.1-0.3)** - Fast decay acceptable:
- Trivial details
- Transient context
- Low-confidence inferences
- Redundant with higher-salience memories

## Decay Considerations

**Slower decay needed**:
- Semantic facts (stable over time)
- Core procedural knowledge
- Strong emotional memories
- Reflective insights with broad applicability

**Faster decay acceptable**:
- Episodic details (unless reinforced)
- Temporal context beyond immediate relevance
- Superseded information

## Reinforcement Triggers

Mark memories for reinforcement when:
- Recalled in current interaction (increments retrieval count)
- Related to ongoing conversation topic
- User validates/confirms the memory
- Connected to new memories being formed

## Cross-Linking Strategy

**Link memories when**:
- Emotional memory connects to triggering event (Emotional ↔ Episodic)
- Reflective insight synthesizes multiple episodics
- Procedural knowledge derived from repeated episodics
- Semantic preference explains emotional reaction
- New information contradicts/updates existing memory

**Link types**:
- `supports`: Reinforces related memory
- `contradicts`: Flags for resolution/decay
- `derives_from`: Parent-child relationship
- `relates_to`: Contextual association

## Registration Criteria

**Always register**:
- High emotional intensity
- Explicit user requests to remember
- Core identity information
- Repeated patterns (3+ occurrences)

**Register selectively**:
- Casual mentions (assess future utility)
- Redundant information (link instead)
- Low-confidence inferences (mark for validation)

**Skip**:
- Pure small talk without substance
- Already captured with sufficient detail
- Transient session context

## Output Format

```json
{
  "memory_type": "type",
  "content": "concise description",
  "salience": 0.0-1.0,
  "metadata": {
    "timestamp": "ISO 8601",
    "confidence": "high|medium|low",
    "emotional_intensity": 0.0-1.0,
    "tags": [],
    "links": [
      {"target_id": "mem_123", "type": "supports|contradicts|derives_from|relates_to"}
    ]
  },
  "decay_modifier": "slow|normal|fast",
  "reasoning": "brief justification"
}
```

## Examples

```json
{
  "memory_type": "emotional",
  "content": "User frustrated with micromanaging boss",
  "salience": 0.8,
  "metadata": {
    "emotional_intensity": 0.75,
    "tags": ["work", "management", "stress"],
    "links": [{"target_id": "ep_042", "type": "relates_to"}]
  },
  "decay_modifier": "slow"
}
```

```json
{
  "memory_type": "reflective",
  "content": "User seeks validation before major decisions",
  "salience": 0.7,
  "metadata": {
    "confidence": "high",
    "tags": ["decision-making", "personality"],
    "links": [
      {"target_id": "ep_015", "type": "derives_from"},
      {"target_id": "ep_028", "type": "derives_from"},
      {"target_id": "ep_039", "type": "derives_from"}
    ]
  },
  "decay_modifier": "slow"
}
```