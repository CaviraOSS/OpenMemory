/*
   ____                   __  __                                 
  / __ \                 |  \/  |                                
 | |  | |_ __   ___ _ __ | \  / | ___ _ __ ___   ___  _ __ _   _ 
 | |  | | '_ \ / _ \ '_ \| |\/| |/ _ \ '_ ` _ \ / _ \| '__| | | |
 | |__| | |_) |  __/ | | | |  | |  __/ | | | | | (_) | |  | |_| |
  \____/| .__/ \___|_| |_|_|  |_|\___|_| |_| |_|\___/|_|   \__, |
        | |                                                 __/ |
        |_|                                                |___/ 
  CaviraOSS @ 2026

 - filename
 - what is the file used for
*/

import { randomUUID } from "crypto";

import { scoreDurableRecall } from "./scoring";
import { computeKeywordOverlap, extractKeywords } from "../utilities/keyword";

type LocalMemory = {
  id: string;
  content: string;
  user_id: string;
  project_id: string | null;
  metadata: Record<string, unknown>;
  facets: Record<string, unknown>;
  contracts: Record<string, unknown>;
  embedding?: number[];
  status: string;
  salience: number;
  confidence: number;
  created_at: string;
  superseded_at: string | null;
};

type LocalRememberInput = {
  content: string;
  user_id?: string;
  project_id?: string;
  metadata?: Record<string, unknown>;
  facets?: Record<string, unknown>;
  contracts?: Record<string, unknown>;
  embedding?: number[];
};

type LocalRecallInput = {
  query: string;
  mode: "strict" | "historical" | "associative";
  limit?: number;
  user_id?: string;
  project_id?: string;
  embedding?: number[];
};

const memories = new Map<string, LocalMemory>();

export function rememberLocalMemory(input: LocalRememberInput): LocalMemory {
  const now = new Date().toISOString();
  const memory: LocalMemory = {
    id: randomUUID(),
    content: input.content,
    user_id: input.user_id || "anonymous",
    project_id: input.project_id || null,
    metadata: input.metadata || {},
    facets: input.facets || {},
    contracts: input.contracts || {},
    embedding: input.embedding,
    status: "active",
    salience: 0.5,
    confidence: 0.8,
    created_at: now,
    superseded_at: null,
  };
  memories.set(memory.id, memory);
  return memory;
}

export function recallLocalMemories(input: LocalRecallInput) {
  const limit = Math.max(1, Math.min(input.limit || 10, 100));
  const queryKeywords = extractKeywords(input.query);

  const results = Array.from(memories.values())
    .filter((memory) => matchesScope(memory, input))
    .filter((memory) => input.mode !== "strict" || !memory.superseded_at)
    .map((memory) => {
      const semantic = cosine(input.embedding, memory.embedding);
      const lexical = computeKeywordOverlap(
        queryKeywords,
        extractKeywords(memory.content),
      );
      const score = scoreDurableRecall({
        vector_distance: 1 - semantic,
        lexical_score: lexical,
        confidence: memory.confidence,
        salience: memory.salience,
        provenance_count: 1,
      });

      return {
        id: memory.id,
        memory_id: memory.id,
        content: memory.content,
        user_id: memory.user_id,
        project_id: memory.project_id,
        metadata: memory.metadata,
        facets: memory.facets,
        contracts: memory.contracts,
        status: memory.status,
        salience: memory.salience,
        confidence: memory.confidence,
        recorded_at: memory.created_at,
        valid_from: memory.created_at,
        valid_to: null,
        superseded_at: memory.superseded_at,
        score: score.score,
        score_components: score,
        provenance_summary: {
          count: 1,
          sources: [],
        },
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return {
    query: input.query,
    mode: input.mode,
    results,
  };
}

function matchesScope(memory: LocalMemory, input: LocalRecallInput) {
  const user = input.user_id || "anonymous";
  if (memory.user_id !== user) return false;
  if (!input.project_id) return true;
  return memory.project_id === input.project_id || memory.project_id === null;
}

function cosine(left?: number[], right?: number[]) {
  if (!left?.length || !right?.length) return 0;
  const len = Math.min(left.length, right.length);
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let i = 0; i < len; i += 1) {
    dot += left[i] * right[i];
    leftNorm += left[i] * left[i];
    rightNorm += right[i] * right[i];
  }
  if (leftNorm === 0 || rightNorm === 0) return 0;
  return Math.max(0, dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm)));
}
