<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : docs/matrix-retrieval-redesign.md
 usage : documents LongMemory matrix retrieval redesign
-->

# Matrix Retrieval Redesign

## Measured diagnosis

The completed 33-question run and a direct `conv-50:qa:66` probe isolate two
independent forms of dilution.

### Ranking dilution

The current direct seed score is

$$
d_i = 0.50v_i + 0.35\ell_i + 0.15e_i
$$

and every candidate with $d_i > 0.05$ becomes a graph seed. On the 568-node
`conv-50` corpus, 567 nodes became seeds. After two diffusion steps, normalized
activation entropy was 0.994 and peak probability was 0.0031. The graph stage
therefore smoothed an almost uniform signal instead of expanding a selective
neighbourhood.

Across 147 stored top-five candidates, mean relevant versus irrelevant feature
values were:

| Signal     | Relevant | Irrelevant | Separation |
| ---------- | -------: | ---------: | ---------: |
| Vector     |    0.554 |      0.505 |     +0.049 |
| Lexical    |    0.774 |      0.699 |     +0.075 |
| Entity     |    0.463 |      0.613 |     -0.149 |
| Activation |    0.465 |      0.300 |     +0.165 |
| Spread     |    0.469 |      0.492 |     -0.023 |
| Emotional  |    0.000 |      0.080 |     -0.080 |
| Speaker    |    0.618 |      0.186 |     +0.432 |

Spread is correlated with vector (0.429), lexical (0.481), and entity (0.615).
The fixed sum therefore double-counts correlated popularity while entity,
spread, and emotional boosts contribute more to noise than to evidence.
Entity identity is mainly a constraint: adding the same `Dave = 1` value to
all Dave memories does not distinguish the failed restoration event.

### Evidence dilution

`memory_evidence_text()` previously selected only claims sharing query terms
whenever one such claim existed. This dropped complementary clauses, including
"Maybe we can have a beer somewhere?" from the rank-one Starbucks evidence.
The renderer now keeps matching claims first and fills the remaining claim
budget with source-order complementary claims.

A separate unresolved case is cross-turn reference. Melanie's "we just did it"
requires a preceding conversational turn. Sequential `refers_to` edges exist,
but context construction does not expand a selected result into an evidence
bundle.

## Proposed model

### 1. Calibrated feature matrix

For $n$ candidates and $m$ direct signals, construct

$$
X = [\mathbf v,\boldsymbol\ell,\mathbf a,\mathbf s,\mathbf t,
     \mathbf p] \in \mathbb R^{n\times m}
$$

where columns represent semantic similarity, lexical relevance, ACT-R
activation, speaker attribution, temporal agreement, and polarity/exception
agreement. Entity agreement is removed from additive relevance and used as a
constraint gate.

Calibrate each continuous column within the query candidate population using a
robust z-score:

$$
Z_{ij} = \frac{X_{ij} - \operatorname{median}(X_{:j})}
 {1.4826\,\operatorname{MAD}(X_{:j}) + \epsilon}
$$

Use empirical percentiles for binary or zero-MAD columns. This expands narrow
cosine bands and prevents max-normalized BM25 from owning the score scale.

Estimate regularized covariance:

$$
\Sigma = \frac{Z^\top Z}{n-1} + \lambda I
$$

and whiten the feature matrix:

$$
Y = Z\Sigma^{-1/2}
$$

Because $m$ is small, the eigendecomposition costs $O(m^3)$ and candidate
projection costs $O(nm^2)$. Whitening prevents graph spread, lexical overlap,
and vector similarity from receiving multiple votes for the same information.

Fuse independent evidence with a weighted log-sum-exp rather than an arithmetic
mean:

$$
r_i = g_i\,\tau\log\left(\sum_{j=1}^{m}\pi_j
             \exp\left(\frac{Y_{ij}}{\tau}\right)\right)
$$

where $\sum_j\pi_j=1$. A low $\tau$ approaches a maximum and preserves a strong
single channel; a larger $\tau$ rewards agreement. The entity/permission gate is

$$
g_i = \prod_c \sigma\left(\beta_c(C_{ic}-\theta_c)\right)
$$

for hard query constraints $C$, rather than a positive bonus shared by hundreds
of same-person memories.

### 2. Sparse typed-graph diffusion

Create relation-specific adjacency matrices for sequential conversation,
support, supersession, contradiction, and entity co-reference edges:

$$
P_r = D_r^{-1/2}A_rD_r^{-1/2}
$$

Symmetric normalization reduces high-degree hub domination. Combine only
relations useful for the parsed query:

$$
P(q) = \sum_r \rho_r(q)P_r
$$

Seed only the strongest direct candidates:

$$
s_i = \max(0, r_i-Q_{0.90}(\mathbf r)),\qquad
\hat{\mathbf s}=\frac{\mathbf s}{\|\mathbf s\|_1}
$$

with an absolute cap such as 32 seeds. Use truncated personalized PageRank:

$$
\mathbf h=(1-\alpha)\sum_{t=0}^{H}\alpha^tP(q)^t\hat{\mathbf s}
$$

Graph gain should admit unseeded neighbours, not add a near-constant value to
all direct candidates. Reject or bypass diffusion when seed density exceeds
0.15 or normalized entropy remains above 0.90.

### 3. Matrix evidence-set selection

Top-K answer quality is a set problem, especially for multi-hop and exception
questions. Let $A\in[0,1]^{n\times q}$ encode candidate coverage of query
aspects and let $S=EE^\top$ be the candidate semantic-similarity matrix.
Choose binary vector $\mathbf x$ by maximizing

$$
F(\mathbf x)=\mathbf r^\top\mathbf x
 +\lambda\sum_{j=1}^{q}w_j\left(1-e^{-(A^\top\mathbf x)_j}\right)
 -\frac{\gamma}{2}\mathbf x^\top S\mathbf x
$$

subject to

$$
\mathbf 1^\top\mathbf x\le K,\qquad
\mathbf c^\top\mathbf x\le B
$$

where $\mathbf c$ is evidence token cost and $B$ is the context budget. Greedy
marginal-gain selection gives a bounded approximation for the coverage term and
replaces the current positional MMR, which was measured as a no-op.

For quantifiers such as `all`, `always`, and `ever`, add positive and negative
polarity aspects. The set objective must reward retrieving at least one
counterexample. This directly targets Dave's failed restoration case.

### 4. Conversational evidence bundles

Let $C$ be the ordered same-session adjacency matrix. Expand selected anchors
with bounded neighbours:

$$
\mathbf b=\min\left(\mathbf 1,
 (I+C+C^\top+C^2+(C^\top)^2)\mathbf x\right)
$$

The expansion remains subordinate to the token constraint. It supplies
antecedents for pronouns and elliptical replies while preserving source order.
The answer context should include speaker, timestamp, exact source text, and
structured claims; claims are an index, not a replacement for evidence.

## Delivery order

1. Keep the complementary-claim rendering fix and add regression cases for
   Starbucks and other multi-clause turns.
2. Persist compact seed density, entropy, and peak diagnostics in benchmark
   artifacts.
3. Implement sparse typed diffusion behind a benchmarkable configuration and
   require seed density at most 0.15.
4. Implement query-local feature calibration and covariance whitening over the
   shortlist; compare it with the current linear score without changing
   embeddings.
5. Replace positional MMR with token-constrained aspect coverage and explicit
   polarity coverage.
6. Add ordered neighbour bundles for selected anchors.
7. Run retrieval-only A/B first, then a fresh Copilot-judged scorecard.

## Acceptance gates

- LongMemEval Answer@5 remains at least 88.9%.
- LoCoMo Answer@5 reaches at least 60% in the first iteration.
- LoCoMo Hit@5 reaches at least 70%.
- Context recall reaches at least 75% and evidence completeness at least 65%.
- Diffusion seed density is at most 0.15 and normalized entropy at most 0.90
  when graph expansion is active.
- Gold-present answer failures fall from four to at most one.
- p50 retrieval remains at most 600 ms and p95 at most 900 ms.

Do not re-enable RRF or RM3 and do not increase the current lexical reranker
weights. Prior controlled A/B runs showed those changes regress retrieval.

## Implementation status

Implemented in the associative recall path:

- robust median/MAD feature calibration;
- regularized feature covariance and inverse-square-root whitening diagnostics;
- covariance-adjusted, direction-preserving log-sum-exp fusion;
- top-quantile graph seeds capped at 32 and 15% density;
- typed symmetric graph normalization and truncated personalized PageRank;
- high-entropy diffusion bypass;
- exception-aware polarity scoring and token-constrained evidence selection;
- exact-source predecessor bundles for explicit elliptical turns;
- query-conditioned complementary claim rendering;
- compact matrix, diffusion, and bundle diagnostics in benchmark hits;
- `OM_MATRIX_RETRIEVAL=0` as the legacy A/B path.

Matrix rank intervention is deliberately targeted to universal/exception
queries. Applying it to every query improved precision but slightly reduced
recall; ordinary queries retain the established scorer while still benefiting
from bounded evidence rendering.

The complete deterministic K=5 retrieval A/B (`matrix-retrieval-v5`) improved:

| Metric                  | Previous | Implemented |
| ----------------------- | -------: | ----------: |
| Context recall          |    60.9% |       62.6% |
| Rank-weighted precision |    49.6% |       50.4% |
| Evidence completeness   |    46.7% |       46.7% |
| p50 retrieval           | 527.7 ms |    540.3 ms |
| p95 retrieval           | 774.2 ms |    693.3 ms |

Only `conv-50:qa:66` changed evidence recall: 0% to 50%, with no case-level
retrieval regressions. Its targeted seed density was 5.6%, replacing the prior
99.8% dense seed field, and the decisive failed Mustang restoration entered
top five.

Three complete Copilot Luna judged reruns produced unstable LongMemEval and
knowledge-update scores despite identical deterministic retrieval. LoCoMo
ranged from 53.3% to 60.0% after implementation, versus 40.0% before; the
system consistently fixed Melanie's elliptical trail-walk answer, the
Starbucks/beer clause, and Dave's failed restoration answer in diagnostic
runs. Judged results should therefore be repeated or use a deterministic model
endpoint before treating one run as a release gate.
