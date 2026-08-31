<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : docs/invariants.md
 usage : documents LongMemory invariants
-->

# Hydrograph invariants

1. Durable nodes are immutable.
2. Every durable node is content-addressed.
3. Every durable fact is bitemporal.
4. Edges are executable.
5. Subjective memory and external world truth are separate.
6. Worlds are recursive containers, not flat sectors.
7. Facets are cognitive attributes, not storage buckets.
8. Strict recall cannot use superseded facts.
9. Strict recall cannot use unresolved contradictions.
10. World-grounded recall requires grounding.
11. Associative recall may use superseded/emotional residue but must label it.
12. Compression cannot override truth.
13. API server and CLI must use the same createMemory engine.
14. Benchmarks define correctness.

These invariants are product constraints. Production features are incomplete until benchmarks prove they preserve them.
