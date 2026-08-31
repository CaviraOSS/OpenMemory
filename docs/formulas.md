<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : docs/formulas.md
 usage : documents LongMemory formulas
-->

# Hydrograph formulas

Hydrograph does not average confidence, decay, or importance naively. Every
dynamic quantity has an explicit formula. This document lists them with a
plain-English explanation. The implementations live in `src/core/math`.

## Basic functions

- `sigmoid(x) = 1 / (1 + e^-x)` — squashes any real number into (0, 1).
- `logit(p) = ln(p / (1 - p))` — the inverse of sigmoid; works in log-odds.
- `clampProbability(p)` — keeps a probability just inside (0, 1) so `logit` stays
  finite.

Working in log-odds is what lets us _add_ evidence instead of averaging it.

## Evidence and confidence

Confidence updates in log-odds space:

```
logit(conf) = logit(prior)
            + sum(source_reliability * log(likelihood_ratio))
            - conflict_penalty
            - age_penalty
```

Each piece of evidence contributes `reliability * log(likelihood_ratio)`: a
reliable source with a strong likelihood ratio moves confidence a lot; a weak or
ungrounded source barely nudges it. Because the final step is a sigmoid,
**supporting evidence raises confidence but never reaches 1** (support fusion).

## Contradiction pressure

```
contradiction_pressure = max(severity * confidence * unresolved)
```

An unresolved, severe contradiction between two confident memories produces the
most pressure. Pressure lowers confidence in log-odds space
(`logit(conf) - pressure`) and, while unresolved, **blocks strict recall**.

## Decay

Decay is not a fixed half-life. Retention is a sigmoid of the things that make a
memory worth keeping:

```
retention = sigmoid(importance + surprise + grounding + emotional_intensity
                    + utility + confirmation - noise)
```

The decay rate speeds up with noise and conflict, slows down with retention and
reinforcement:

```
lambda = base_lambda * (1 + noise + conflict)
                     / (1 + retention + reinforcement)
```

And a memory's weight over time is an exponential decay plus reinforcement
pulses:

```
w(t) = w0 * exp(-lambda * dt) + sum(pulse.amplitude * exp(-lambda * (dt - pulse.at)))
```

So an important, grounded, reinforced memory decays slowly, while a
low-importance noisy one fades fast.

## Activation (ACT-R style)

Activation ranks memories for working memory and recall:

```
base_activation = ln( sum( time_since_access ^ -d ) )
activation      = base_activation
                + context_association
                + task_relevance
                + grounding_relevance
                - contradiction_penalty
```

Every access adds a decaying term to the base activation, so **more frequent and
more recent use raises activation**. Context association, task relevance, and
grounding relevance then re-rank memories for the current query.

## Surprise

```
prediction_surprise = -log P(x | model)
```

A full predictive model comes later. For now surprise is approximated by novelty
against the world/sector distribution: a memory unlike everything already seen
has low `P` and therefore high surprise. High surprise increases retention.

## Why it matters

These formulas make the memory dynamics explicit and testable. Confidence
reflects the strength and reliability of evidence; contradictions actively
suppress unreliable beliefs; decay protects important, grounded, reinforced
memories while letting noise fade; and activation keeps the most relevant
memories reachable. Formula changes must be benchmarked before production use.
