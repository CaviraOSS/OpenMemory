<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : docs/compression.md
 usage : documents LongMemory compression
-->

# Compression and sketch layer

Hydrograph sketches are bounded summaries for scalability. They help candidate
selection, salience estimation, world concept compression, and drift tracking,
but they are never a source of truth. Durable nodes, edges, contracts,
bitemporal state, contradictions, and grounding remain authoritative.

## Count-Min Sketch

`CountMinSketch` approximates frequencies for:

- entities;
- tags;
- relation types;
- world activity; and
- repeated patterns.

The sketch has a fixed `width × depth` table. `add(key, count)` increments one
cell per row and `estimate(key)` returns the minimum row count. Estimates may
overcount because of collisions, but do not undercount before uint32 saturation.

Sketches with identical dimensions and seeds can be merged. `serialize()` emits
a versioned JSON payload and `CountMinSketch.deserialize()` restores it exactly.

## Frequent Directions

`FrequentDirections` stores a bounded matrix for world-level concept
compression. Each vector update adds one row. When the row budget is exceeded,
the sketch eigendecomposes its small row Gram matrix and shrinks retained
singular directions by the discarded singular value.

The matrix therefore always satisfies:

$$
\text{matrix rows} \leq \text{maxRows}
$$

`conceptVector()` returns the normalized dominant compressed direction. Matrix
sketches support update, merge, serialization, and deserialization.

## Oja drift tracking

`OjaTracker` follows a lightweight online principal concept with Oja's rule:

$$
w_{t+1} = w_t + \eta y_t(x_t - y_t w_t), \qquad y_t = w_t^\top x_t
$$

The configurable learning rate keeps changes gradual. Trackers are normalized
by default and support merge and versioned serialization.

## Combined sketch layer

`MemorySketches` combines five Count-Min domains with per-world Frequent
Directions matrices and per-concept Oja trackers. It supports:

- `add(domain, key, count)` and `estimate(domain, key)`;
- `updateWorld(worldId, vector)`;
- `updateDrift(conceptId, vector)`;
- `rankCandidates()` and `pruneCandidates()`;
- complete layer merge; and
- complete serialization/deserialization.

Candidate objects retain their original `valid` metadata. Ranking and pruning
never modify validity.

## Strict recall boundary

Strict recall accepts an optional `sketchRelevanceOf(node, queryTerms)` callback.
It is evaluated only after temporal, contract, contradiction, grounding, and
confidence gates have accepted a node. The resulting score boost is clamped to
`0.2`.

This ordering means an approximate sketch can reorder valid survivors, but it
cannot:

1. create a factual claim;
2. override strict validity;
3. resurrect a superseded memory;
4. bypass contradiction or grounding gates; or
5. scan or rewrite cold history.

## Benchmark

The `compression` benchmark constructs 100 candidates where the relevant item
is absent from the baseline top 10. Repeated-pattern frequency moves it into the
sketch-pruned top 10 while reducing the candidate set by 90%.

The benchmark also gates:

- Count-Min merge accuracy;
- Frequent Directions row bounds;
- Oja concept movement; and
- zero strict stale-fact leakage under a deliberately adversarial sketch score.

Run it with:

```powershell
pnpm exec tsx benchmarks/src/cli.ts --quick --only=compression --ci
```
