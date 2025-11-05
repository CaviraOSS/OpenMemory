/**
 * Decision Quality Assessor
 *
 * Evaluates the quality of architectural decisions by tracking adherence,
 * consistency, and outcomes. Automatically boosts validated decisions and
 * marks low-quality or ignored decisions.
 */

import { hsg_query, reinforce_memory } from '../hsg';
import { all_async, run_async } from '../../core/db';
import { add_hsg_memory } from '../hsg';
import { j } from '../../utils';

export interface DecisionQuality {
  decision_id: string;
  decision_text: string;
  quality_score: number;
  adherence_rate: number;
  was_reversed: boolean;
  reversal_decision_id?: string;
  actions_following: number;
  successful_actions: number;
  failed_actions: number;
  status: 'VALIDATED' | 'SOLID' | 'QUESTIONABLE' | 'IGNORED' | 'REVERSED';
  recommendation: string;
  created_at: number;
  age_days: number;
}

export interface QualityReport {
  timestamp: number;
  project_name: string;
  user_id: string;
  decisions_assessed: number;
  validated_decisions: number;
  ignored_decisions: number;
  reversed_decisions: number;
  quality_assessments: DecisionQuality[];
  auto_actions_taken: number;
}

/**
 * Assess decision quality for a project
 */
export async function assessDecisionQuality(
  project_name: string,
  user_id: string
): Promise<QualityReport> {
  const decisions = await all_async(
    `SELECT id, content, meta, salience, created_at
     FROM memories
     WHERE primary_sector = 'reflective'
     AND tags LIKE ?
     AND user_id = ?
     ORDER BY created_at DESC`,
    [`%${project_name}%`, user_id]
  );

  const assessments: DecisionQuality[] = [];
  let autoActionsTaken = 0;

  for (const decision of decisions) {
    const metadata = decision.meta ? JSON.parse(decision.meta) : {};
    const decisionText = extractDecisionText(decision.content);
    const ageMs = Date.now() - decision.created_at;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    // Skip very recent decisions (< 1 day old, not enough data)
    if (ageDays < 1) continue;

    // Get all actions that reference this decision
    const actions = await all_async(
      `SELECT m.id, m.content, m.meta, m.created_at
       FROM memories m
       JOIN waypoints w ON w.dst_id = m.id
       WHERE w.src_id = ?
       AND m.primary_sector = 'episodic'
       ORDER BY m.created_at ASC`,
      [decision.id]
    );

    // Check if decision was reversed by a later decision
    const laterDecisions = await all_async(
      `SELECT id, content, meta, created_at
       FROM memories
       WHERE primary_sector = 'reflective'
       AND tags LIKE ?
       AND user_id = ?
       AND created_at > ?
       ORDER BY created_at ASC`,
      [`%${project_name}%`, user_id, decision.created_at]
    );

    let wasReversed = false;
    let reversalDecisionId: string | undefined;

    for (const laterDecision of laterDecisions) {
      if (isReversal(decision.content, laterDecision.content)) {
        wasReversed = true;
        reversalDecisionId = laterDecision.id;
        break;
      }
    }

    // Count successful vs failed actions
    let successfulActions = 0;
    let failedActions = 0;

    for (const action of actions) {
      const actionMeta = action.meta ? JSON.parse(action.meta) : {};
      if (actionMeta.outcome === 'success') successfulActions++;
      else if (actionMeta.outcome === 'failure' || actionMeta.outcome === 'error') failedActions++;
    }

    // Calculate adherence rate (% of time decision was followed)
    const totalActions = actions.length;
    const adherenceRate = totalActions > 0 ? successfulActions / totalActions : 0;

    // Calculate quality score
    // Base: adherence_rate (0-1)
    // Penalty: -0.5 if reversed
    // Penalty: -0.3 if ignored (no actions)
    // Bonus: +0.2 if many successful actions (10+)
    let qualityScore = adherenceRate;

    if (wasReversed) {
      qualityScore -= 0.5;
    }

    if (totalActions === 0 && ageDays > 7) {
      // Decision ignored for over a week
      qualityScore -= 0.3;
    }

    if (successfulActions >= 10) {
      qualityScore += 0.2;
    }

    // Normalize to 0-1 range
    qualityScore = Math.max(0, Math.min(1, qualityScore));

    // Determine status
    let status: 'VALIDATED' | 'SOLID' | 'QUESTIONABLE' | 'IGNORED' | 'REVERSED';
    let recommendation: string;

    if (wasReversed) {
      status = 'REVERSED';
      recommendation = `⚠️ Decision was reversed. Original decision may have been incorrect. Review rationale.`;

      // Auto-action: Reduce confidence on reversed decision
      await run_async(
        'UPDATE memories SET salience = MAX(0.2, salience - ?) WHERE id = ?',
        [0.5, decision.id]
      );
      autoActionsTaken++;

      // Link reversal to original decision
      if (reversalDecisionId) {
        await run_async(
          `INSERT OR IGNORE INTO waypoints (src_id, dst_id, weight, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          [decision.id, reversalDecisionId, 0.9, Date.now(), Date.now()]
        );
      }

    } else if (totalActions === 0 && ageDays > 7) {
      status = 'IGNORED';
      recommendation = `⚠️ IGNORED: Decision made ${ageDays.toFixed(0)} days ago but never followed. Consider if still relevant.`;

      // Auto-action: Reduce confidence on ignored decision
      await run_async(
        'UPDATE memories SET salience = MAX(0.2, salience - ?) WHERE id = ?',
        [0.4, decision.id]
      );
      autoActionsTaken++;

      // Create warning memory
      await add_hsg_memory(
        `⚠️ Ignored Decision: "${decisionText}"\n\n` +
        `Made ${ageDays.toFixed(0)} days ago but never implemented.\n` +
        `Consider: Is this decision still relevant? Should it be revised or cancelled?\n` +
        `Recommendation: Review and either implement or formally abandon this decision.`,
        j(['decision-warning', 'ignored', project_name]),
        {
          decision_id: decision.id,
          decision_text: decisionText,
          status: 'IGNORED',
          age_days: ageDays,
          timestamp: new Date().toISOString(),
        },
        user_id,
        'reflective'
      );
      autoActionsTaken++;

    } else if (qualityScore >= 0.8 && totalActions >= 5) {
      status = 'VALIDATED';
      recommendation = `✓ Excellent decision. Consistently followed with high success rate (${(adherenceRate * 100).toFixed(0)}%).`;

      // Auto-action: Boost validated decision
      await reinforce_memory(decision.id, 0.3);
      autoActionsTaken++;

    } else if (qualityScore >= 0.6) {
      status = 'SOLID';
      recommendation = `Good decision. Followed with reasonable success (${(adherenceRate * 100).toFixed(0)}%).`;

    } else {
      status = 'QUESTIONABLE';
      recommendation = `⚠️ Low quality decision. ${failedActions} failures out of ${totalActions} actions. Review and consider alternatives.`;

      // Auto-action: Reduce confidence on questionable decision
      await run_async(
        'UPDATE memories SET salience = MAX(0.3, salience - ?) WHERE id = ?',
        [0.3, decision.id]
      );
      autoActionsTaken++;
    }

    assessments.push({
      decision_id: decision.id,
      decision_text: decisionText,
      quality_score: qualityScore,
      adherence_rate: adherenceRate,
      was_reversed: wasReversed,
      reversal_decision_id: reversalDecisionId,
      actions_following: totalActions,
      successful_actions: successfulActions,
      failed_actions: failedActions,
      status,
      recommendation,
      created_at: decision.created_at,
      age_days: ageDays,
    });
  }

  // Sort by quality score (lowest first, so we see problems)
  assessments.sort((a, b) => a.quality_score - b.quality_score);

  const report: QualityReport = {
    timestamp: Date.now(),
    project_name,
    user_id,
    decisions_assessed: assessments.length,
    validated_decisions: assessments.filter(a => a.status === 'VALIDATED').length,
    ignored_decisions: assessments.filter(a => a.status === 'IGNORED').length,
    reversed_decisions: assessments.filter(a => a.status === 'REVERSED').length,
    quality_assessments: assessments,
    auto_actions_taken: autoActionsTaken,
  };

  // Store quality report
  await storeQualityReport(report);

  return report;
}

/**
 * Get quality assessment for a single decision
 */
export async function getDecisionQuality(
  decision_id: string
): Promise<DecisionQuality | null> {
  const decision = await all_async(
    'SELECT * FROM memories WHERE id = ? LIMIT 1',
    [decision_id]
  );

  if (decision.length === 0) return null;

  const metadata = decision[0].meta ? JSON.parse(decision[0].meta) : {};
  const project_name = metadata.project_name || 'unknown';
  const user_id = decision[0].user_id || 'unknown';

  const report = await assessDecisionQuality(project_name, user_id);
  return report.quality_assessments.find(a => a.decision_id === decision_id) || null;
}

/**
 * Extract decision text from content
 */
function extractDecisionText(content: string): string {
  const match = content.match(/Decision:\\s*(.+?)(\\n|$)/i);
  if (match) return match[1].trim();

  // Try "Decided to"
  const decidedMatch = content.match(/Decided to\\s*(.+?)(\\n|$)/i);
  if (decidedMatch) return decidedMatch[1].trim();

  return content.substring(0, 80);
}

/**
 * Check if decision2 reverses decision1
 */
function isReversal(decision1: string, decision2: string): boolean {
  const d1Lower = decision1.toLowerCase();
  const d2Lower = decision2.toLowerCase();

  // Check for explicit reversal language
  const reversalPhrases = [
    'reverse',
    'undo',
    'abandon',
    'cancel',
    'revert',
    'switch from',
    'change from',
    'no longer',
    'instead of',
  ];

  for (const phrase of reversalPhrases) {
    if (d2Lower.includes(phrase) && d2Lower.includes(d1Lower.substring(0, 30))) {
      return true;
    }
  }

  // Check for contradicting technology choices
  const contradictions = [
    { a: /use\s+postgresql/i, b: /use\s+mongodb/i },
    { a: /use\s+mongodb/i, b: /use\s+postgresql/i },
    { a: /use\s+typescript/i, b: /use\s+javascript/i },
    { a: /use\s+react/i, b: /use\s+vue/i },
    { a: /use\s+rest\s+api/i, b: /use\s+graphql/i },
    { a: /use\s+graphql/i, b: /use\s+rest/i },
    { a: /use\s+docker/i, b: /use\s+kubernetes/i },
    { a: /microservices/i, b: /monolith/i },
    { a: /monolith/i, b: /microservices/i },
  ];

  for (const { a, b } of contradictions) {
    if (a.test(d1Lower) && b.test(d2Lower)) {
      return true;
    }
  }

  return false;
}

/**
 * Store quality report
 */
async function storeQualityReport(report: QualityReport): Promise<void> {
  await run_async(
    `INSERT INTO decision_quality_reports (project_name, user_id, timestamp, decisions_assessed, report_data)
     VALUES (?, ?, ?, ?, ?)`,
    [
      report.project_name,
      report.user_id,
      report.timestamp,
      report.decisions_assessed,
      JSON.stringify(report),
    ]
  ).catch(async (err: any) => {
    // Create table if it doesn't exist
    if (err.message.includes('no such table')) {
      await run_async(`
        CREATE TABLE IF NOT EXISTS decision_quality_reports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_name TEXT NOT NULL,
          user_id TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          decisions_assessed INTEGER NOT NULL,
          report_data TEXT NOT NULL
        )
      `);
      // Retry
      await run_async(
        `INSERT INTO decision_quality_reports (project_name, user_id, timestamp, decisions_assessed, report_data)
         VALUES (?, ?, ?, ?, ?)`,
        [
          report.project_name,
          report.user_id,
          report.timestamp,
          report.decisions_assessed,
          JSON.stringify(report),
        ]
      );
    }
  });
}
