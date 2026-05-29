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

import type { DurableSource, ExtractionCandidateInput } from "./repository";
import { enrichDurableMetadata } from "./metadata";

const FACET_PATTERNS: Record<string, RegExp[]> = {
  episodic: [
    /\b(today|yesterday|tomorrow|last|next|when|met|visited|attended|happened)\b/i,
  ],
  semantic: [
    /\b(is|are|means|defined|fact|data|api|contract|learned|knowledge)\b/i,
  ],
  procedural: [
    /\b(how to|step|steps|process|procedure|install|run|build|deploy|fix(ed)?|configure)\b/i,
  ],
  emotional: [
    /\b(feel|felt|happy|sad|angry|excited|worried|frustrated|love|hate)\b/i,
  ],
  reflective: [
    /\b(learned|realized|insight|reflection|takeaway|understand|understood)\b/i,
  ],
};

export type ExtractDurableFacetsInput = {
  content: string;
  source?: DurableSource;
};

export function extractDurableFacets(input: ExtractDurableFacetsInput) {
  const content = input.content || "";
  const facets: Record<string, unknown> = {};
  for (const [facet, patterns] of Object.entries(FACET_PATTERNS)) {
    if (patterns.some((pattern) => pattern.test(content))) {
      facets[facet] = true;
    }
  }
  if (!Object.keys(facets).length) {
    facets.semantic = true;
  }
  if (input.source?.kind) {
    facets.source_kind = input.source.kind;
  }
  return facets;
}

export type BuildExtractionCandidateInput = {
  event_id: string;
  user_id?: string;
  project_id?: string;
  content: string;
  source?: DurableSource;
  metadata?: Record<string, unknown>;
  contracts?: Record<string, unknown>;
};

export function buildExtractionCandidateInput(
  input: BuildExtractionCandidateInput,
): ExtractionCandidateInput {
  return {
    event_id: input.event_id,
    user_id: input.user_id,
    project_id: input.project_id,
    content: input.content,
    facets: extractDurableFacets({
      content: input.content,
      source: input.source,
    }),
    entities: [],
    edges: [],
    contracts: input.contracts,
    metadata: enrichDurableMetadata(input.content, input.metadata),
    confidence: 0.6,
  };
}
