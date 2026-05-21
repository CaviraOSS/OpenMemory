export const DURABLE_RECALL_SCORE_WEIGHTS = {
  semantic: 0.4,
  confidence: 0.25,
  salience: 0.15,
  provenance: 0.2,
  lexical: 0.1,
  contradiction_penalty: 0.35,
  contract_penalty: 1,
} as const;

export interface DurableRecallScoreInput {
  confidence?: number;
  salience?: number;
  provenance_count?: number;
  contradiction_count?: number;
  recall_allowed?: boolean;
  vector_distance?: number | null;
  text_match?: boolean;
  lexical_score?: number;
}

export interface DurableRecallScore {
  confidence: number;
  salience: number;
  provenance: number;
  semantic: number;
  lexical: number;
  contradiction_penalty: number;
  contract_penalty: number;
  score: number;
}

const clamp01 = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(value, 1)) : 0;

export function scoreDurableRecall(
  input: DurableRecallScoreInput,
): DurableRecallScore {
  const confidence = clamp01(input.confidence ?? 0);
  const salience = clamp01(input.salience ?? 0);
  const provenance =
    input.provenance_count && input.provenance_count > 0 ? 1 : 0;
  const lexical = clamp01(input.lexical_score ?? 0);
  const semantic =
    input.vector_distance === undefined || input.vector_distance === null
      ? input.text_match === false
        ? 0
        : 1
      : clamp01(1 - input.vector_distance);
  const contradiction_penalty =
    input.contradiction_count && input.contradiction_count > 0
      ? DURABLE_RECALL_SCORE_WEIGHTS.contradiction_penalty
      : 0;
  const contract_penalty =
    input.recall_allowed === false
      ? DURABLE_RECALL_SCORE_WEIGHTS.contract_penalty
      : 0;
  const weighted =
    semantic * DURABLE_RECALL_SCORE_WEIGHTS.semantic +
    confidence * DURABLE_RECALL_SCORE_WEIGHTS.confidence +
    salience * DURABLE_RECALL_SCORE_WEIGHTS.salience +
    provenance * DURABLE_RECALL_SCORE_WEIGHTS.provenance +
    lexical * DURABLE_RECALL_SCORE_WEIGHTS.lexical -
    contradiction_penalty -
    contract_penalty;

  return {
    confidence,
    salience,
    provenance,
    semantic,
    lexical,
    contradiction_penalty,
    contract_penalty,
    score: clamp01(weighted),
  };
}
