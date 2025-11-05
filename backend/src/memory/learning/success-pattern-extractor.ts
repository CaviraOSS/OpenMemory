/**
 * Success Pattern Extractor (Continuous Learning)
 *
 * Automatically extracts reusable patterns from successful actions and sequences.
 * Learns from what works and creates pattern memories for future reuse.
 */

import { hsg_query, reinforce_memory } from '../hsg';
import { all_async, run_async } from '../../core/db';
import { add_hsg_memory } from '../hsg';
import { j } from '../../utils';

export interface ExtractedPattern {
  pattern_id: string;
  pattern_name: string;
  pattern_type: 'SEQUENCE' | 'APPROACH' | 'TECHNIQUE' | 'ARCHITECTURE';
  description: string;
  example: string;
  confidence: number;
  frequency: number;
  success_rate: number;
  contexts: string[];
  source_actions: Array<{
    id: string;
    timestamp: number;
  }>;
}

export interface PatternExtractionReport {
  timestamp: number;
  project_name: string;
  user_id: string;
  actions_analyzed: number;
  patterns_extracted: number;
  high_confidence_patterns: number;
  patterns: ExtractedPattern[];
}

/**
 * Extract success patterns from project history
 */
export async function extractSuccessPatterns(
  project_name: string,
  user_id: string,
  lookback_days: number = 30
): Promise<PatternExtractionReport> {
  const cutoffTime = Date.now() - (lookback_days * 86400000);

  // Get all successful actions
  const successfulActions = await all_async(
    `SELECT id, content, metadata, created_at
     FROM memories
     WHERE primary_sector = 'episodic'
     AND tags LIKE ?
     AND user_id = ?
     AND created_at > ?
     ORDER BY created_at ASC`,
    [`%${project_name}%`, user_id, cutoffTime]
  );

  const successActions = successfulActions.filter(action => {
    const meta = action.metadata ? JSON.parse(action.metadata) : {};
    return meta.outcome === 'success';
  });

  const patterns: ExtractedPattern[] = [];

  // 1. Extract sequence patterns
  const sequencePatterns = await extractSequencePatterns(successActions, project_name, user_id);
  patterns.push(...sequencePatterns);

  // 2. Extract approach patterns
  const approachPatterns = await extractApproachPatterns(successActions, project_name, user_id);
  patterns.push(...approachPatterns);

  // 3. Extract technique patterns
  const techniquePatterns = await extractTechniquePatterns(successActions, project_name, user_id);
  patterns.push(...techniquePatterns);

  // Store extracted patterns as procedural memories
  for (const pattern of patterns) {
    if (pattern.confidence >= 0.6 && pattern.frequency >= 2) {
      await add_hsg_memory(
        `Pattern: ${pattern.pattern_name}\n\n` +
        `${pattern.description}\n\n` +
        `Example:\n${pattern.example}\n\n` +
        `Success Rate: ${(pattern.success_rate * 100).toFixed(0)}%\n` +
        `Observed in ${pattern.frequency} instances\n` +
        `Contexts: ${pattern.contexts.join(', ')}`,
        j(['extracted-pattern', 'auto-learned', project_name]),
        {
          project_name,
          pattern_name: pattern.pattern_name,
          pattern_type: pattern.type,
          confidence: pattern.confidence,
          frequency: pattern.frequency,
          success_rate: pattern.success_rate,
          auto_extracted: true,
          timestamp: new Date().toISOString(),
        },
        user_id,
        'procedural'
      );

      // Link pattern to source actions
      const result = await all_async(
        `SELECT id FROM memories
         WHERE content LIKE ?
         AND user_id = ?
         AND primary_sector = 'procedural'
         ORDER BY created_at DESC
         LIMIT 1`,
        [`%${pattern.pattern_name}%`, user_id]
      );

      if (result.length > 0) {
        pattern.pattern_id = result[0].id;

        // Create waypoints to source actions
        for (const source of pattern.source_actions) {
          await run_async(
            `INSERT OR IGNORE INTO waypoints (src_id, dst_id, weight, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)`,
            [pattern.pattern_id, source.id, 0.75, Date.now(), Date.now()]
          );
        }
      }
    }
  }

  const report: PatternExtractionReport = {
    timestamp: Date.now(),
    project_name,
    user_id,
    actions_analyzed: successActions.length,
    patterns_extracted: patterns.length,
    high_confidence_patterns: patterns.filter(p => p.confidence >= 0.8).length,
    patterns,
  };

  // Store extraction report
  await storeExtractionReport(report);

  return report;
}

/**
 * Extract sequence patterns (A → B → C sequences)
 */
async function extractSequencePatterns(
  actions: any[],
  project_name: string,
  user_id: string
): Promise<ExtractedPattern[]> {
  const patterns: ExtractedPattern[] = [];
  const sequences = new Map<string, any>();

  // Look for 3-step sequences
  for (let i = 0; i < actions.length - 2; i++) {
    const step1 = normalizeAction(actions[i].content);
    const step2 = normalizeAction(actions[i + 1].content);
    const step3 = normalizeAction(actions[i + 2].content);

    const key = `${step1} → ${step2} → ${step3}`;

    if (!sequences.has(key)) {
      sequences.set(key, {
        steps: [step1, step2, step3],
        instances: [],
        contexts: new Set<string>(),
      });
    }

    const seq = sequences.get(key)!;
    seq.instances.push({
      ids: [actions[i].id, actions[i + 1].id, actions[i + 2].id],
      timestamps: [actions[i].created_at, actions[i + 1].created_at, actions[i + 2].created_at],
    });

    const meta = actions[i].metadata ? JSON.parse(actions[i].metadata) : {};
    if (meta.context) seq.contexts.add(meta.context);
  }

  // Convert sequences to patterns
  for (const [key, seq] of sequences.entries()) {
    if (seq.instances.length >= 2) {
      // Pattern observed at least twice
      patterns.push({
        pattern_id: '',
        pattern_name: `Success Sequence: ${seq.steps[0]} + ${seq.steps[1]}`,
        pattern_type: 'SEQUENCE',
        description: `Successful 3-step sequence observed ${seq.instances.length} times`,
        example: seq.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'),
        confidence: Math.min(0.95, 0.5 + (seq.instances.length * 0.1)),
        frequency: seq.instances.length,
        success_rate: 1.0, // All instances were successful
        contexts: Array.from(seq.contexts),
        source_actions: seq.instances.flatMap((inst: any) =>
          inst.ids.map((id: string, idx: number) => ({
            id,
            timestamp: inst.timestamps[idx],
          }))
        ),
      });
    }
  }

  return patterns;
}

/**
 * Extract approach patterns (general methodologies)
 */
async function extractApproachPatterns(
  actions: any[],
  project_name: string,
  user_id: string
): Promise<ExtractedPattern[]> {
  const patterns: ExtractedPattern[] = [];

  // Look for common approaches
  const approaches = {
    'test-driven': {
      keywords: ['test', 'write test', 'add test', 'test case'],
      name: 'Test-Driven Development',
      description: 'Writing tests before or alongside implementation',
    },
    'incremental': {
      keywords: ['incremental', 'step by step', 'gradually', 'small change'],
      name: 'Incremental Development',
      description: 'Making small, iterative changes rather than large rewrites',
    },
    'refactor-first': {
      keywords: ['refactor', 'cleanup', 'reorganize', 'simplify'],
      name: 'Refactor Before Feature',
      description: 'Cleaning up code before adding new features',
    },
  };

  for (const [key, approach] of Object.entries(approaches)) {
    const matchingActions = actions.filter(action => {
      const content = action.content.toLowerCase();
      return approach.keywords.some(kw => content.includes(kw));
    });

    if (matchingActions.length >= 3) {
      patterns.push({
        pattern_id: '',
        pattern_name: approach.name,
        pattern_type: 'APPROACH',
        description: approach.description,
        example: `Observed in ${matchingActions.length} successful actions:\n${matchingActions.slice(0, 3).map((a, i) => `${i + 1}. ${normalizeAction(a.content)}`).join('\n')}`,
        confidence: Math.min(0.90, 0.6 + (matchingActions.length * 0.05)),
        frequency: matchingActions.length,
        success_rate: 1.0,
        contexts: matchingActions.map(a => {
          const meta = a.metadata ? JSON.parse(a.metadata) : {};
          return meta.context || 'general';
        }).filter((c: string, i: number, arr: string[]) => arr.indexOf(c) === i),
        source_actions: matchingActions.map((a: any) => ({
          id: a.id,
          timestamp: a.created_at,
        })),
      });
    }
  }

  return patterns;
}

/**
 * Extract technique patterns (specific technical patterns)
 */
async function extractTechniquePatterns(
  actions: any[],
  project_name: string,
  user_id: string
): Promise<ExtractedPattern[]> {
  const patterns: ExtractedPattern[] = [];

  // Look for technical techniques
  const techniques = {
    'error-handling': {
      keywords: ['try.*catch', 'error handling', 'exception', 'handle error'],
      name: 'Robust Error Handling',
      description: 'Implementing comprehensive error handling',
    },
    'validation': {
      keywords: ['validate', 'validation', 'check input', 'sanitize'],
      name: 'Input Validation',
      description: 'Validating and sanitizing inputs',
    },
    'logging': {
      keywords: ['log', 'logging', 'debug', 'trace'],
      name: 'Comprehensive Logging',
      description: 'Adding logging for debugging and monitoring',
    },
    'documentation': {
      keywords: ['document', 'comment', 'docstring', 'readme'],
      name: 'Documentation First',
      description: 'Documenting code and decisions',
    },
  };

  for (const [key, technique] of Object.entries(techniques)) {
    const regex = new RegExp(technique.keywords.join('|'), 'i');
    const matchingActions = actions.filter(action =>
      regex.test(action.content)
    );

    if (matchingActions.length >= 2) {
      patterns.push({
        pattern_id: '',
        pattern_name: technique.name,
        pattern_type: 'TECHNIQUE',
        description: technique.description,
        example: `Successful implementations:\n${matchingActions.slice(0, 2).map((a, i) => `${i + 1}. ${normalizeAction(a.content)}`).join('\n')}`,
        confidence: Math.min(0.85, 0.5 + (matchingActions.length * 0.08)),
        frequency: matchingActions.length,
        success_rate: 1.0,
        contexts: matchingActions.map(a => {
          const meta = a.metadata ? JSON.parse(a.metadata) : {};
          return meta.context || 'general';
        }).filter((c: string, i: number, arr: string[]) => arr.indexOf(c) === i),
        source_actions: matchingActions.map((a: any) => ({
          id: a.id,
          timestamp: a.created_at,
        })),
      });
    }
  }

  return patterns;
}

/**
 * Normalize action text for pattern matching
 */
function normalizeAction(content: string): string {
  // Extract the action part
  const match = content.match(/performed:\s*(.+?)(\n|$)/i);
  if (match) {
    const action = match[1].trim();
    // Simplify for pattern matching
    return action
      .replace(/\b\d+\b/g, 'N') // Replace numbers with N
      .replace(/['"].*?['"]/g, 'X') // Replace strings with X
      .substring(0, 80);
  }
  return content.substring(0, 60);
}

/**
 * Get learning statistics
 */
export async function getLearningStats(
  project_name: string,
  user_id: string
): Promise<any> {
  const extractedPatterns = await all_async(
    `SELECT COUNT(*) as count FROM memories
     WHERE primary_sector = 'procedural'
     AND tags LIKE ?
     AND tags LIKE ?
     AND user_id = ?`,
    [`%extracted-pattern%`, `%${project_name}%`, user_id]
  );

  const manualPatterns = await all_async(
    `SELECT COUNT(*) as count FROM memories
     WHERE primary_sector = 'procedural'
     AND tags LIKE ?
     AND tags NOT LIKE ?
     AND user_id = ?`,
    [`%${project_name}%`, `%extracted-pattern%`, user_id]
  );

  const lessonsLearned = await all_async(
    `SELECT COUNT(*) as count FROM memories
     WHERE primary_sector = 'reflective'
     AND tags LIKE ?
     AND tags LIKE ?
     AND user_id = ?`,
    [`%lesson-learned%`, `%${project_name}%`, user_id]
  );

  return {
    extracted_patterns: extractedPatterns[0]?.count || 0,
    manual_patterns: manualPatterns[0]?.count || 0,
    total_patterns: (extractedPatterns[0]?.count || 0) + (manualPatterns[0]?.count || 0),
    lessons_learned: lessonsLearned[0]?.count || 0,
    auto_learning_rate: (extractedPatterns[0]?.count || 0) / Math.max(1, (extractedPatterns[0]?.count || 0) + (manualPatterns[0]?.count || 0)),
  };
}

/**
 * Store pattern extraction report
 */
async function storeExtractionReport(report: PatternExtractionReport): Promise<void> {
  await run_async(
    `INSERT INTO pattern_extraction_reports (project_name, user_id, timestamp, patterns_extracted, report_data)
     VALUES (?, ?, ?, ?, ?)`,
    [
      report.project_name,
      report.user_id,
      report.timestamp,
      report.patterns_extracted,
      JSON.stringify(report),
    ]
  ).catch(async (err: any) => {
    // Create table if it doesn't exist
    if (err.message.includes('no such table')) {
      await run_async(`
        CREATE TABLE IF NOT EXISTS pattern_extraction_reports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_name TEXT NOT NULL,
          user_id TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          patterns_extracted INTEGER NOT NULL,
          report_data TEXT NOT NULL
        )
      `);
      // Retry
      await run_async(
        `INSERT INTO pattern_extraction_reports (project_name, user_id, timestamp, patterns_extracted, report_data)
         VALUES (?, ?, ?, ?, ?)`,
        [
          report.project_name,
          report.user_id,
          report.timestamp,
          report.patterns_extracted,
          JSON.stringify(report),
        ]
      );
    }
  });
}
