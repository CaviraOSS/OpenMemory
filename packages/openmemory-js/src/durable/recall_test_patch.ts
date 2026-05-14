export type RecallMode = "strict" | "historical" | "associative";

export interface DurableRecallInput {
  query: string;
  mode?: RecallMode;
  at_time?: string | number | Date;
  limit?: number;
  user_id?: string;
  project_id?: string;
}

export interface DurableRecallResult {
  id: string;
  content: string;
  score: number;
  facets: string[];
  primary_facet: string | null;
  salience: number;
  last_seen_at: number;
}
