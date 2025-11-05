/**
 * Pattern Effectiveness Tracker
 *
 * Tracks success/failure rates of patterns, calculates effectiveness scores,
 * and automatically reinforces or downgrades patterns based on outcomes.
 */

import { hsg_query, reinforce_memory } from '../hsg';
import { all_async, run_async } from '../../core/db';
import { add_hsg_memory } from '../hsg';
import { j } from '../../utils';

export interface PatternEffectiveness {
  pattern_id: string;
  pattern_name: string;
  total_uses: number;
  successes: number;
  failures: number;
  success_rate: number;
  avg_confidence: number;
  effectiveness_score: number;
  status: 'EXCELLENT' | 'GOOD' | 'MEDIOCRE' | 'FAILING';
  recommendation: string;
  recent_outcomes: Array<{ action: string; outcome: string; timestamp: number }>;
}

export interface EffectivenessReport {
  timestamp: number;
  project_name: string;
  user_id: string;
  patterns_analyzed: number;
  excellent_patterns: number;
  failing_patterns: number;
  effectiveness: PatternEffectiveness[];
  auto_actions_taken: number;
}

/**
 * Track pattern effectiveness for a project
 */
export async function trackPatternEffectiveness(
  project_name: string,
  user_id: string
): Promise<EffectivenessReport> {
  const patterns = await all_async(
    `SELECT id, content, meta, salience, coactivations
     FROM memories
     WHERE primary_sector = 'procedural'
     AND tags LIKE ?
     AND user_id = ?
     ORDER BY created_at DESC`,
    [`%${project_name}%`, user_id]
  );

  const effectiveness: PatternEffectiveness[] = [];
  let autoActionsTaken = 0;

  for (const pattern of patterns) {
    const metadata = pattern.meta ? JSON.parse(pattern.meta) : {};
    const patternName = metadata.pattern_name || extractPatternName(pattern.content);

    // Get all actions that used this pattern (via waypoints)
    const actions = await all_async(
      `SELECT m.id, m.content, m.meta, m.created_at
       FROM memories m
       JOIN waypoints w ON w.dst_id = m.id
       WHERE w.src_id = ?
       AND m.primary_sector = 'episodic'
       ORDER BY m.created_at DESC`,
      [pattern.id]
    );

    let successes = 0;
    let failures = 0;
    let totalConfidence = 0;
    let confidenceCount = 0;
    const recentOutcomes: Array<{ action: string; outcome: string; timestamp: number }> = [];

    for (const action of actions) {
      const actionMeta = action.meta ? JSON.parse(action.meta) : {};
      const outcome = actionMeta.outcome;

      if (outcome === 'success') successes++;
      else if (outcome === 'failure' || outcome === 'error') failures++;

      // Get emotions linked to this action for confidence
      const emotions = await all_async(
        `SELECT m.meta
         FROM memories m
         JOIN waypoints w ON w.src_id = ?
         WHERE w.dst_id = m.id
         AND m.primary_sector = 'emotional'
         LIMIT 1`,
        [action.id]
      );

      if (emotions.length > 0) {
        const emotionMeta = emotions[0].meta ? JSON.parse(emotions[0].meta) : {};
        if (emotionMeta.confidence !== undefined) {
          totalConfidence += emotionMeta.confidence;
          confidenceCount++;
        }
      }

      // Track recent outcomes
      if (recentOutcomes.length < 5) {
        recentOutcomes.push({
          action: extractActionText(action.content),
          outcome: outcome || 'unknown',
          timestamp: action.created_at,
        });
      }
    }

    const totalUses = successes + failures;
    if (totalUses === 0) continue; // Skip unused patterns

    const successRate = totalUses > 0 ? successes / totalUses : 0;
    const avgConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0.5;

    // Effectiveness score: success_rate * confidence * log(uses + 1)
    const effectivenessScore = successRate * avgConfidence * Math.log(totalUses + 1);

    // Determine status and recommendation
    let status: 'EXCELLENT' | 'GOOD' | 'MEDIOCRE' | 'FAILING';
    let recommendation: string;

    if (successRate >= 0.90 && totalUses >= 3) {
      status = 'EXCELLENT';
      recommendation = 'Highly effective pattern. Continue using.';

      // Auto-action: Boost this pattern
      await reinforce_memory(pattern.id, 0.25);
      autoActionsTaken++;

    } else if (successRate >= 0.70 && totalUses >= 2) {
      status = 'GOOD';
      recommendation = 'Solid pattern. Continue using with confidence.';

    } else if (successRate >= 0.50) {
      status = 'MEDIOCRE';
      recommendation = 'Inconsistent results. Consider improvements or alternatives.';

    } else {
      status = 'FAILING';
      recommendation = `⚠️ AVOID: Low success rate (${(successRate * 100).toFixed(0)}%). Use alternatives.`;

      // Auto-action: Downgrade this pattern
      await run_async(
        'UPDATE memories SET salience = MAX(0.2, salience - ?) WHERE id = ?',
        [0.4, pattern.id]
      );
      autoActionsTaken++;

      // Create warning memory
      await add_hsg_memory(
        `⚠️ Pattern Warning: "${patternName}"\n\n` +
        `Performance: ${(successRate * 100).toFixed(0)}% success rate\n` +
        `Usage: ${successes} successes, ${failures} failures in ${totalUses} uses\n` +
        `Recommendation: Avoid this pattern. Seek alternatives.\n\n` +
        `Recent outcomes:\n${recentOutcomes.map(o => `• ${o.outcome}: ${o.action}`).join('\n')}`,
        j(['pattern-warning', 'avoid', project_name]),
        {
          pattern_id: pattern.id,
          pattern_name: patternName,
          success_rate: successRate,
          total_uses: totalUses,
          status: 'FAILING',
          timestamp: new Date().toISOString(),
        },
        user_id,
        'reflective'
      );
      autoActionsTaken++;
    }

    effectiveness.push({
      pattern_id: pattern.id,
      pattern_name: patternName,
      total_uses: totalUses,
      successes,
      failures,
      success_rate: successRate,
      avg_confidence: avgConfidence,
      effectiveness_score: effectivenessScore,
      status,
      recommendation,
      recent_outcomes: recentOutcomes,
    });
  }

  // Sort by effectiveness score
  effectiveness.sort((a, b) => b.effectiveness_score - a.effectiveness_score);

  const report: EffectivenessReport = {
    timestamp: Date.now(),
    project_name,
    user_id,
    patterns_analyzed: effectiveness.length,
    excellent_patterns: effectiveness.filter(e => e.status === 'EXCELLENT').length,
    failing_patterns: effectiveness.filter(e => e.status === 'FAILING').length,
    effectiveness,
    auto_actions_taken: autoActionsTaken,
  };

  // Store effectiveness report
  await storeEffectivenessReport(report);

  return report;
}

/**
 * Get effectiveness for a single pattern
 */
export async function getPatternEffectiveness(
  pattern_id: string
): Promise<PatternEffectiveness | null> {
  const pattern = await all_async(
    'SELECT * FROM memories WHERE id = ? LIMIT 1',
    [pattern_id]
  );

  if (pattern.length === 0) return null;

  // Use the main tracker but filter to this pattern
  const metadata = pattern[0].meta ? JSON.parse(pattern[0].meta) : {};
  const project_name = metadata.project_name || 'unknown';
  const user_id = pattern[0].user_id || 'unknown';

  const report = await trackPatternEffectiveness(project_name, user_id);
  return report.effectiveness.find(e => e.pattern_id === pattern_id) || null;
}

/**
 * Extract pattern name from content
 */
function extractPatternName(content: string): string {
  const match = content.match(/Pattern:\s*(.+?)(\n|$)/i);
  if (match) return match[1].trim();

  // Try auto-detected patterns
  const autoMatch = content.match(/Auto-detected:\s*(.+?)(\n|$)/i);
  if (autoMatch) return autoMatch[1].trim();

  return content.substring(0, 50);
}

/**
 * Extract action text from content
 */
function extractActionText(content: string): string {
  const match = content.match(/performed:\s*(.+?)(\n|$)/i);
  return match ? match[1].trim() : content.substring(0, 60);
}

/**
 * Store effectiveness report
 */
async function storeEffectivenessReport(report: EffectivenessReport): Promise<void> {
  await run_async(
    `INSERT INTO effectiveness_reports (project_name, user_id, timestamp, patterns_analyzed, report_data)
     VALUES (?, ?, ?, ?, ?)`,
    [
      report.project_name,
      report.user_id,
      report.timestamp,
      report.patterns_analyzed,
      JSON.stringify(report),
    ]
  ).catch(async (err: any) => {
    // Create table if it doesn't exist
    if (err.message.includes('no such table')) {
      await run_async(`
        CREATE TABLE IF NOT EXISTS effectiveness_reports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_name TEXT NOT NULL,
          user_id TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          patterns_analyzed INTEGER NOT NULL,
          report_data TEXT NOT NULL
        )
      `);
      // Retry
      await run_async(
        `INSERT INTO effectiveness_reports (project_name, user_id, timestamp, patterns_analyzed, report_data)
         VALUES (?, ?, ?, ?, ?)`,
        [
          report.project_name,
          report.user_id,
          report.timestamp,
          report.patterns_analyzed,
          JSON.stringify(report),
        ]
      );
    }
  });
}
