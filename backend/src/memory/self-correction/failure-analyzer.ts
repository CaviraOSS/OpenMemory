/**
 * Failure Analyzer & Learner
 *
 * Analyzes failed actions to identify root causes, learns from mistakes,
 * and automatically adjusts confidence in patterns/decisions that led to failures.
 */

import { hsg_query, reinforce_memory } from '../hsg';
import { all_async, run_async } from '../../core/db';
import { add_hsg_memory } from '../hsg';
import { j } from '../../utils';

export interface FailureAnalysis {
  failure_id: string;
  action_text: string;
  agent_name: string;
  failed_at: number;
  root_cause: 'PATTERN_FAILURE' | 'DECISION_FAILURE' | 'MISSING_CONTEXT' | 'EXTERNAL_FACTOR' | 'UNKNOWN';
  related_pattern_id?: string;
  related_pattern_name?: string;
  related_decision_id?: string;
  related_decision_text?: string;
  context: string;
  recommendation: string;
  lessons_learned: string;
}

export interface FailureReport {
  timestamp: number;
  project_name: string;
  user_id: string;
  failures_analyzed: number;
  root_causes: Record<string, number>;
  analyses: FailureAnalysis[];
  auto_actions_taken: number;
  lessons_created: number;
}

/**
 * Analyze failures for a project
 */
export async function analyzeFailures(
  project_name: string,
  user_id: string,
  lookback_days: number = 30
): Promise<FailureReport> {
  const cutoffTime = Date.now() - (lookback_days * 86400000);

  // Get all failed actions
  const failedActions = await all_async(
    `SELECT id, content, metadata, created_at
     FROM memories
     WHERE primary_sector = 'episodic'
     AND tags LIKE ?
     AND user_id = ?
     AND created_at > ?
     ORDER BY created_at DESC`,
    [`%${project_name}%`, user_id, cutoffTime]
  );

  const analyses: FailureAnalysis[] = [];
  let autoActionsTaken = 0;
  let lessonsCreated = 0;
  const rootCauseCounts: Record<string, number> = {
    PATTERN_FAILURE: 0,
    DECISION_FAILURE: 0,
    MISSING_CONTEXT: 0,
    EXTERNAL_FACTOR: 0,
    UNKNOWN: 0,
  };

  for (const action of failedActions) {
    const metadata = action.metadata ? JSON.parse(action.metadata) : {};

    // Only analyze failures and errors
    if (metadata.outcome !== 'failure' && metadata.outcome !== 'error') continue;

    const actionText = extractActionText(action.content);
    const agentName = metadata.agent_name || 'unknown';

    // Check if this action used a pattern (via waypoint)
    const usedPatterns = await all_async(
      `SELECT m.id, m.content, m.metadata
       FROM memories m
       JOIN waypoints w ON w.src_id = m.id
       WHERE w.dst_id = ?
       AND m.primary_sector = 'procedural'`,
      [action.id]
    );

    // Check if this action was based on a decision (via waypoint)
    const basedOnDecisions = await all_async(
      `SELECT m.id, m.content, m.metadata
       FROM memories m
       JOIN waypoints w ON w.src_id = m.id
       WHERE w.dst_id = ?
       AND m.primary_sector = 'reflective'`,
      [action.id]
    );

    // Analyze root cause
    let rootCause: FailureAnalysis['root_cause'];
    let relatedPatternId: string | undefined;
    let relatedPatternName: string | undefined;
    let relatedDecisionId: string | undefined;
    let relatedDecisionText: string | undefined;
    let recommendation: string;
    let lessonsLearned: string;

    if (usedPatterns.length > 0) {
      // Pattern failure: the pattern used didn't work
      rootCause = 'PATTERN_FAILURE';
      const pattern = usedPatterns[0];
      const patternMeta = pattern.metadata ? JSON.parse(pattern.metadata) : {};
      relatedPatternId = pattern.id;
      relatedPatternName = patternMeta.pattern_name || extractPatternName(pattern.content);

      recommendation = `Pattern "${relatedPatternName}" led to failure. Consider alternatives or improve the pattern.`;
      lessonsLearned = `Pattern "${relatedPatternName}" failed when: ${actionText}. Context: ${metadata.context || 'N/A'}`;

      // Auto-action: Reduce confidence in this pattern
      await run_async(
        'UPDATE memories SET salience = MAX(0.2, salience - ?) WHERE id = ?',
        [0.25, pattern.id]
      );
      autoActionsTaken++;

      // Create warning memory about this pattern
      await add_hsg_memory(
        `⚠️ Pattern Failure: "${relatedPatternName}"\n\n` +
        `Action: ${actionText}\n` +
        `Outcome: ${metadata.outcome}\n` +
        `Context: ${metadata.context || 'N/A'}\n\n` +
        `This pattern led to a failure. Review and consider alternatives.`,
        j(['pattern-failure', 'warning', project_name]),
        {
          pattern_id: pattern.id,
          pattern_name: relatedPatternName,
          failed_action_id: action.id,
          timestamp: new Date().toISOString(),
        },
        user_id,
        'reflective'
      );
      autoActionsTaken++;

    } else if (basedOnDecisions.length > 0) {
      // Decision failure: the decision led to a failed action
      rootCause = 'DECISION_FAILURE';
      const decision = basedOnDecisions[0];
      relatedDecisionId = decision.id;
      relatedDecisionText = extractDecisionText(decision.content);

      recommendation = `Decision "${relatedDecisionText}" led to failure. Reconsider this architectural choice.`;
      lessonsLearned = `Decision "${relatedDecisionText}" resulted in failure when: ${actionText}. Context: ${metadata.context || 'N/A'}`;

      // Auto-action: Reduce confidence in this decision
      await run_async(
        'UPDATE memories SET salience = MAX(0.3, salience - ?) WHERE id = ?',
        [0.20, decision.id]
      );
      autoActionsTaken++;

    } else if (!metadata.context || metadata.context.trim().length < 10) {
      // Missing context: action performed without sufficient context
      rootCause = 'MISSING_CONTEXT';
      recommendation = `Action performed without sufficient context. Ensure proper planning before execution.`;
      lessonsLearned = `Insufficient context led to failure in: ${actionText}. Always gather context before acting.`;

    } else {
      // Could be external factor or unknown
      const errorKeywords = ['network', 'timeout', 'connection', 'unavailable', 'not found', 'permission'];
      const hasExternalError = errorKeywords.some(kw =>
        actionText.toLowerCase().includes(kw) ||
        (metadata.context || '').toLowerCase().includes(kw)
      );

      if (hasExternalError) {
        rootCause = 'EXTERNAL_FACTOR';
        recommendation = `External factor caused failure (network, permissions, etc). Implement retry logic.`;
        lessonsLearned = `External failure in: ${actionText}. Consider adding error handling and retries.`;
      } else {
        rootCause = 'UNKNOWN';
        recommendation = `Unknown failure cause. Investigate further or add better error reporting.`;
        lessonsLearned = `Unknown failure in: ${actionText}. Need better diagnostics.`;
      }
    }

    rootCauseCounts[rootCause]++;

    analyses.push({
      failure_id: action.id,
      action_text: actionText,
      agent_name: agentName,
      failed_at: action.created_at,
      root_cause: rootCause,
      related_pattern_id: relatedPatternId,
      related_pattern_name: relatedPatternName,
      related_decision_id: relatedDecisionId,
      related_decision_text: relatedDecisionText,
      context: metadata.context || 'N/A',
      recommendation,
      lessons_learned: lessonsLearned,
    });

    // Create lesson-learned memory for significant failures
    if (rootCause !== 'UNKNOWN' && rootCause !== 'EXTERNAL_FACTOR') {
      await add_hsg_memory(
        `Lesson Learned: ${lessonsLearned}\n\n` +
        `Root Cause: ${rootCause}\n` +
        `Recommendation: ${recommendation}`,
        j(['lesson-learned', 'failure-analysis', project_name]),
        {
          project_name,
          root_cause: rootCause,
          failed_action_id: action.id,
          related_pattern_id: relatedPatternId,
          related_decision_id: relatedDecisionId,
          timestamp: new Date().toISOString(),
        },
        user_id,
        'reflective'
      );
      lessonsCreated++;
      autoActionsTaken++;
    }
  }

  const report: FailureReport = {
    timestamp: Date.now(),
    project_name,
    user_id,
    failures_analyzed: analyses.length,
    root_causes: rootCauseCounts,
    analyses,
    auto_actions_taken: autoActionsTaken,
    lessons_created: lessonsCreated,
  };

  // Store failure report
  await storeFailureReport(report);

  return report;
}

/**
 * Get lessons learned for a project
 */
export async function getLessonsLearned(
  project_name: string,
  user_id: string,
  limit: number = 20
): Promise<any[]> {
  const lessons = await all_async(
    `SELECT id, content, metadata, created_at, salience
     FROM memories
     WHERE primary_sector = 'reflective'
     AND tags LIKE ?
     AND tags LIKE ?
     AND user_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [`%lesson-learned%`, `%${project_name}%`, user_id, limit]
  );

  return lessons.map(lesson => ({
    id: lesson.id,
    content: lesson.content,
    metadata: lesson.metadata ? JSON.parse(lesson.metadata) : {},
    created_at: lesson.created_at,
    salience: lesson.salience,
  }));
}

/**
 * Extract action text from content
 */
function extractActionText(content: string): string {
  const match = content.match(/performed:\\s*(.+?)\\n/i);
  if (match) return match[1].trim();
  return content.substring(0, 80);
}

/**
 * Extract pattern name from content
 */
function extractPatternName(content: string): string {
  const match = content.match(/Pattern:\\s*(.+?)(\\n|$)/i);
  if (match) return match[1].trim();
  return content.substring(0, 50);
}

/**
 * Extract decision text from content
 */
function extractDecisionText(content: string): string {
  const match = content.match(/Decision:\\s*(.+?)(\\n|$)/i);
  if (match) return match[1].trim();
  return content.substring(0, 80);
}

/**
 * Store failure report
 */
async function storeFailureReport(report: FailureReport): Promise<void> {
  await run_async(
    `INSERT INTO failure_reports (project_name, user_id, timestamp, failures_analyzed, report_data)
     VALUES (?, ?, ?, ?, ?)`,
    [
      report.project_name,
      report.user_id,
      report.timestamp,
      report.failures_analyzed,
      JSON.stringify(report),
    ]
  ).catch(async (err: any) => {
    // Create table if it doesn't exist
    if (err.message.includes('no such table')) {
      await run_async(`
        CREATE TABLE IF NOT EXISTS failure_reports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_name TEXT NOT NULL,
          user_id TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          failures_analyzed INTEGER NOT NULL,
          report_data TEXT NOT NULL
        )
      `);
      // Retry
      await run_async(
        `INSERT INTO failure_reports (project_name, user_id, timestamp, failures_analyzed, report_data)
         VALUES (?, ?, ?, ?, ?)`,
        [
          report.project_name,
          report.user_id,
          report.timestamp,
          report.failures_analyzed,
          JSON.stringify(report),
        ]
      );
    }
  });
}
