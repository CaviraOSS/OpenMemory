import { normalizeAnswer } from "./text";

export interface AnswerScore {
  exact_match: number;
  f1: number;
  substring_match: number;
  rouge_l_f1?: number;
  parsed_output?: string | null;
}

export function scoreAnswer(
  prediction: string,
  answers: string[],
  datasetName = "",
): AnswerScore {
  const parsed = parseOutput(prediction);
  if (answers.length === 0) {
    const abstained = normalizeAnswer(parsed ?? prediction) === "";
    return {
      exact_match: abstained ? 1 : 0,
      f1: abstained ? 1 : 0,
      substring_match: abstained ? 1 : 0,
      parsed_output: parsed,
    };
  }

  const best = answers
    .flatMap((answer) => [
      scoreSingleAnswer(prediction, answer, datasetName),
      ...(parsed ? [scoreSingleAnswer(parsed, answer, datasetName)] : []),
    ])
    .reduce((best, next) => (next.f1 > best.f1 ? next : best));
  return { ...best, parsed_output: parsed };
}

function scoreSingleAnswer(
  prediction: string,
  answer: string,
  datasetName: string,
): AnswerScore {
  const normalizedPrediction = normalizeAnswer(prediction);
  const normalizedAnswer = normalizeAnswer(answer);

  const score: AnswerScore = {
    exact_match: normalizedPrediction === normalizedAnswer ? 1 : 0,
    f1: tokenF1(normalizedPrediction, normalizedAnswer),
    substring_match:
      normalizedAnswer.length > 0 &&
      normalizedPrediction.includes(normalizedAnswer)
        ? 1
        : 0,
  };
  if (datasetName.includes("sum") || prediction.length > 500 || answer.length > 500) {
    score.rouge_l_f1 = rougeL(prediction, answer);
  }
  return score;
}

function tokenF1(prediction: string, answer: string): number {
  const predictionTokens = prediction.split(" ").filter(Boolean);
  const answerTokens = answer.split(" ").filter(Boolean);
  if (predictionTokens.length === 0 || answerTokens.length === 0) {
    return predictionTokens.length === answerTokens.length ? 1 : 0;
  }

  const answerCounts = new Map<string, number>();
  for (const token of answerTokens) {
    answerCounts.set(token, (answerCounts.get(token) ?? 0) + 1);
  }

  let overlap = 0;
  for (const token of predictionTokens) {
    const count = answerCounts.get(token) ?? 0;
    if (count > 0) {
      overlap += 1;
      answerCounts.set(token, count - 1);
    }
  }

  if (overlap === 0) {
    return 0;
  }

  const precision = overlap / predictionTokens.length;
  const recall = overlap / answerTokens.length;
  return (2 * precision * recall) / (precision + recall);
}

export function parseOutput(output: string, answerPrefix = "Answer:"): string | null {
  const trimmed = output.trim();
  if (!trimmed) {
    return "";
  }
  const prefixIndex = trimmed.toLowerCase().lastIndexOf(answerPrefix.toLowerCase());
  if (prefixIndex >= 0) {
    return trimmed.slice(prefixIndex + answerPrefix.length).trim();
  }
  const firstLine = trimmed.split(/\r?\n/).find((line) => line.trim());
  return firstLine?.trim() ?? null;
}

function rougeL(prediction: string, answer: string): number {
  const predictionTokens = normalizeAnswer(prediction).split(" ").filter(Boolean);
  const answerTokens = normalizeAnswer(answer).split(" ").filter(Boolean);
  if (predictionTokens.length === 0 || answerTokens.length === 0) {
    return predictionTokens.length === answerTokens.length ? 1 : 0;
  }
  const lcs = longestCommonSubsequence(predictionTokens, answerTokens);
  if (lcs === 0) {
    return 0;
  }
  const precision = lcs / predictionTokens.length;
  const recall = lcs / answerTokens.length;
  return (2 * precision * recall) / (precision + recall);
}

function longestCommonSubsequence(left: string[], right: string[]): number {
  const previous = new Array(right.length + 1).fill(0);
  const current = new Array(right.length + 1).fill(0);
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      current[j] =
        left[i - 1] === right[j - 1]
          ? previous[j - 1] + 1
          : Math.max(previous[j], current[j - 1]);
    }
    previous.splice(0, previous.length, ...current);
    current.fill(0);
  }
  return previous[right.length];
}
