/**
 * Blocker Predictor (Proactive Intelligence)
 *
 * Predicts potential blockers before they happen by analyzing failure patterns,
 * velocity trends, missing dependencies, and early warning signs.
 */

import { hsg_query, reinforce_memory } from '../hsg';
import { all_async, run_async } from '../../core/db';
import { add_hsg_memory } from '../hsg';
import { j } from '../../utils';

export interface PredictedBlocker {
  blocker_id: string;
  type: 'DEPENDENCY_MISSING' | 'REPEATED_FAILURE' | 'VELOCITY_DROP' | 'COMPLEXITY_SPIKE' | 'KNOWLEDGE_GAP';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  probability: number; // 0-1
  impact: string;
  early_warning_signs: string[];
  prevention_steps: string[];
  related_memories: Array<{
    id: string;
    type: string;
    content_preview: string;
  }>;
}

export interface BlockerPredictionReport {
  timestamp: number;
  project_name: string;
  user_id: string;
  blockers_predicted: number;
  high_probability_blockers: number;
  warnings_created: number;
  predictions: PredictedBlocker[];
}

/**
 * Predict potential blockers
 */
export async function predictBlockers(
  project_name: string,
  user_id: string,
  lookback_days: number = 30
): Promise<BlockerPredictionReport> {
  const predictions: PredictedBlocker[] = [];
  let warningsCreated = 0;

  // 1. Check for repeated failure patterns
  const repeatedFailures = await detectRepeatedFailures(project_name, user_id, lookback_days);
  predictions.push(...repeatedFailures);

  // 2. Check for missing dependencies
  const missingDeps = await detectMissingDependencies(project_name, user_id);
  predictions.push(...missingDeps);

  // 3. Check for velocity drops
  const velocityIssues = await detectVelocityDrops(project_name, user_id, lookback_days);
  predictions.push(...velocityIssues);

  // 4. Check for complexity spikes
  const complexityIssues = await detectComplexitySpikes(project_name, user_id, lookback_days);
  predictions.push(...complexityIssues);

  // 5. Check for knowledge gaps
  const knowledgeGaps = await detectKnowledgeGaps(project_name, user_id);
  predictions.push(...knowledgeGaps);

  // Create warning memories for high-probability blockers
  for (const blocker of predictions) {
    if (blocker.probability >= 0.7) {
      await add_hsg_memory(
        `⚠️ BLOCKER PREDICTED (${(blocker.probability * 100).toFixed(0)}% probability)\n\n` +
        `${blocker.title}\n\n` +
        `${blocker.description}\n\n` +
        `Impact: ${blocker.impact}\n\n` +
        `Early Warning Signs:\n${blocker.early_warning_signs.map(s => `• ${s}`).join('\n')}\n\n` +
        `Prevention Steps:\n${blocker.prevention_steps.map(s => `• ${s}`).join('\n')}`,
        j(['blocker-prediction', 'warning', project_name]),
        {
          project_name,
          blocker_type: blocker.type,
          severity: blocker.severity,
          probability: blocker.probability,
          timestamp: new Date().toISOString(),
        },
        user_id,
        'reflective'
      );
      warningsCreated++;
    }
  }

  const report: BlockerPredictionReport = {
    timestamp: Date.now(),
    project_name,
    user_id,
    blockers_predicted: predictions.length,
    high_probability_blockers: predictions.filter(p => p.probability >= 0.7).length,
    warnings_created: warningsCreated,
    predictions,
  };

  // Store blocker prediction report
  await storeBlockerReport(report);

  return report;
}

/**
 * Detect repeated failure patterns
 */
async function detectRepeatedFailures(
  project_name: string,
  user_id: string,
  lookback_days: number
): Promise<PredictedBlocker[]> {
  const predictions: PredictedBlocker[] = [];
  const cutoffTime = Date.now() - (lookback_days * 86400000);

  const failures = await all_async(
    `SELECT id, content, metadata, created_at
     FROM memories
     WHERE primary_sector = 'episodic'
     AND tags LIKE ?
     AND user_id = ?
     AND created_at > ?
     ORDER BY created_at DESC`,
    [`%${project_name}%`, user_id, cutoffTime]
  );

  // Group failures by similar content
  const failureGroups = new Map<string, any[]>();

  for (const failure of failures) {
    const meta = failure.metadata ? JSON.parse(failure.metadata) : {};
    if (meta.outcome !== 'failure' && meta.outcome !== 'error') continue;

    const failureType = extractFailureType(failure.content);
    if (!failureGroups.has(failureType)) {
      failureGroups.set(failureType, []);
    }
    failureGroups.get(failureType)!.push(failure);
  }

  // Predict blockers for repeated failures
  for (const [type, group] of failureGroups.entries()) {
    if (group.length >= 3) {
      // 3+ similar failures = likely blocker
      const probability = Math.min(0.95, 0.5 + (group.length * 0.1));

      predictions.push({
        blocker_id: `repeated-failure-${type}`,
        type: 'REPEATED_FAILURE',
        severity: group.length >= 5 ? 'CRITICAL' : 'HIGH',
        title: `Repeated Failure Pattern: ${type}`,
        description: `${group.length} similar failures detected in ${lookback_days} days. This pattern indicates a persistent blocker.`,
        probability,
        impact: `Development is blocked by recurring ${type} failures`,
        early_warning_signs: [
          `${group.length} failures of type "${type}"`,
          `Failures occurring every ${Math.floor(lookback_days / group.length)} days on average`,
          'No successful resolution pattern found',
        ],
        prevention_steps: [
          `Investigate root cause of ${type} failures`,
          'Review related patterns and decisions',
          'Consider alternative approaches or tools',
          'Allocate dedicated time to resolve this blocker',
        ],
        related_memories: group.slice(0, 3).map(f => ({
          id: f.id,
          type: 'failure',
          content_preview: f.content.substring(0, 100),
        })),
      });
    }
  }

  return predictions;
}

/**
 * Detect missing dependencies
 */
async function detectMissingDependencies(
  project_name: string,
  user_id: string
): Promise<PredictedBlocker[]> {
  const predictions: PredictedBlocker[] = [];

  // Get all decisions and patterns
  const decisions = await all_async(
    `SELECT id, content, metadata FROM memories
     WHERE primary_sector = 'reflective'
     AND tags LIKE ?
     AND user_id = ?`,
    [`%${project_name}%`, user_id]
  );

  const patterns = await all_async(
    `SELECT id, content, metadata FROM memories
     WHERE primary_sector = 'procedural'
     AND tags LIKE ?
     AND user_id = ?`,
    [`%${project_name}%`, user_id]
  );

  // Check if decisions have corresponding implementation patterns
  for (const decision of decisions) {
    const decisionText = decision.content.toLowerCase();

    // Check for technology decisions without implementation patterns
    const techKeywords = ['database', 'authentication', 'caching', 'logging', 'testing', 'deployment'];

    for (const keyword of techKeywords) {
      if (decisionText.includes(keyword)) {
        const hasPattern = patterns.some(p =>
          p.content.toLowerCase().includes(keyword)
        );

        if (!hasPattern) {
          predictions.push({
            blocker_id: `missing-dep-${keyword}`,
            type: 'DEPENDENCY_MISSING',
            severity: 'MEDIUM',
            title: `Missing Implementation Pattern: ${keyword}`,
            description: `Decision mentions ${keyword} but no implementation pattern found. This may block development.`,
            probability: 0.65,
            impact: `Developers lack guidance on implementing ${keyword}`,
            early_warning_signs: [
              `Architectural decision mentions ${keyword}`,
              'No corresponding implementation pattern',
              'No recent actions implementing this decision',
            ],
            prevention_steps: [
              `Create implementation pattern for ${keyword}`,
              'Document best practices and examples',
              'Link pattern to architectural decision',
            ],
            related_memories: [
              {
                id: decision.id,
                type: 'decision',
                content_preview: decision.content.substring(0, 100),
              },
            ],
          });
        }
      }
    }
  }

  return predictions;
}

/**
 * Detect velocity drops
 */
async function detectVelocityDrops(
  project_name: string,
  user_id: string,
  lookback_days: number
): Promise<PredictedBlocker[]> {
  const predictions: PredictedBlocker[] = [];

  // Get actions over time
  const recentPeriod = Date.now() - (7 * 86400000);
  const previousPeriod = Date.now() - (lookback_days * 86400000);

  const recentActions = await all_async(
    `SELECT COUNT(*) as count FROM memories
     WHERE primary_sector = 'episodic'
     AND tags LIKE ?
     AND user_id = ?
     AND created_at > ?`,
    [`%${project_name}%`, user_id, recentPeriod]
  );

  const previousActions = await all_async(
    `SELECT COUNT(*) as count FROM memories
     WHERE primary_sector = 'episodic'
     AND tags LIKE ?
     AND user_id = ?
     AND created_at BETWEEN ? AND ?`,
    [`%${project_name}%`, user_id, previousPeriod, recentPeriod]
  );

  const recentCount = recentActions[0]?.count || 0;
  const previousCount = previousActions[0]?.count || 0;

  // Normalize to per-week rates
  const recentRate = recentCount / 1;
  const previousRate = previousCount / ((lookback_days - 7) / 7);

  if (previousRate > 0 && recentRate < previousRate * 0.5) {
    // 50%+ velocity drop
    const dropPercentage = ((previousRate - recentRate) / previousRate * 100).toFixed(0);

    predictions.push({
      blocker_id: 'velocity-drop',
      type: 'VELOCITY_DROP',
      severity: 'HIGH',
      title: 'Significant Velocity Drop Detected',
      description: `Development velocity dropped by ${dropPercentage}% in the last week. This suggests a blocker.`,
      probability: 0.80,
      impact: 'Project progress is significantly slower than before',
      early_warning_signs: [
        `Actions per week dropped from ${previousRate.toFixed(1)} to ${recentRate.toFixed(1)}`,
        `${dropPercentage}% velocity decrease`,
        'Possible blocker or complexity increase',
      ],
      prevention_steps: [
        'Identify what changed in the last week',
        'Review recent failures and patterns',
        'Check if team encountered new complexity',
        'Consider breaking down current tasks',
      ],
      related_memories: [],
    });
  }

  return predictions;
}

/**
 * Detect complexity spikes
 */
async function detectComplexitySpikes(
  project_name: string,
  user_id: string,
  lookback_days: number
): Promise<PredictedBlocker[]> {
  const predictions: PredictedBlocker[] = [];

  // Get recent actions
  const recentPeriod = Date.now() - (lookback_days * 86400000);
  const actions = await all_async(
    `SELECT id, content, metadata, created_at
     FROM memories
     WHERE primary_sector = 'episodic'
     AND tags LIKE ?
     AND user_id = ?
     AND created_at > ?
     ORDER BY created_at DESC`,
    [`%${project_name}%`, user_id, recentPeriod]
  );

  // Look for complexity indicators in action content
  const complexityKeywords = [
    'refactor',
    'redesign',
    'complex',
    'difficult',
    'stuck',
    'blocked',
    'unclear',
    'confused',
  ];

  let complexityMentions = 0;
  const relatedActions = [];

  for (const action of actions) {
    const content = action.content.toLowerCase();
    const hasComplexity = complexityKeywords.some(kw => content.includes(kw));

    if (hasComplexity) {
      complexityMentions++;
      if (relatedActions.length < 3) {
        relatedActions.push(action);
      }
    }
  }

  if (complexityMentions >= 5) {
    // Multiple mentions of complexity = potential blocker
    predictions.push({
      blocker_id: 'complexity-spike',
      type: 'COMPLEXITY_SPIKE',
      severity: 'HIGH',
      title: 'Complexity Spike Detected',
      description: `${complexityMentions} mentions of complexity/difficulty in recent actions. High complexity often leads to blockers.`,
      probability: 0.70,
      impact: 'Team struggling with current complexity level',
      early_warning_signs: [
        `${complexityMentions} complexity indicators found`,
        'Multiple refactoring or redesign attempts',
        'Possible need for architectural guidance',
      ],
      prevention_steps: [
        'Break down complex tasks into smaller pieces',
        'Request architectural review or guidance',
        'Consider simplifying the approach',
        'Document current complexity and solutions',
      ],
      related_memories: relatedActions.map(a => ({
        id: a.id,
        type: 'action',
        content_preview: a.content.substring(0, 100),
      })),
    });
  }

  return predictions;
}

/**
 * Detect knowledge gaps
 */
async function detectKnowledgeGaps(
  project_name: string,
  user_id: string
): Promise<PredictedBlocker[]> {
  const predictions: PredictedBlocker[] = [];

  // Get all decisions
  const decisions = await all_async(
    `SELECT id, content, metadata FROM memories
     WHERE primary_sector = 'reflective'
     AND tags LIKE ?
     AND user_id = ?`,
    [`%${project_name}%`, user_id]
  );

  // Check for decisions without rationale
  for (const decision of decisions) {
    const hasRationale = decision.content.toLowerCase().includes('rationale:');

    if (!hasRationale) {
      predictions.push({
        blocker_id: `knowledge-gap-${decision.id}`,
        type: 'KNOWLEDGE_GAP',
        severity: 'MEDIUM',
        title: 'Decision Without Rationale',
        description: 'Architectural decision lacks documented rationale. This may cause confusion and blockers later.',
        probability: 0.60,
        impact: 'Future developers may not understand why this decision was made',
        early_warning_signs: [
          'Decision documented without rationale',
          'Risk of questioning or reversing decision later',
          'Potential confusion for team members',
        ],
        prevention_steps: [
          'Document the rationale for this decision',
          'Explain why this approach was chosen',
          'List alternatives considered and why they were rejected',
        ],
        related_memories: [
          {
            id: decision.id,
            type: 'decision',
            content_preview: decision.content.substring(0, 100),
          },
        ],
      });
    }
  }

  return predictions;
}

/**
 * Extract failure type from content
 */
function extractFailureType(content: string): string {
  const errorTypes = [
    'network error',
    'timeout',
    'permission denied',
    'not found',
    'syntax error',
    'type error',
    'undefined',
    'compilation error',
    'build failed',
    'test failed',
  ];

  const lower = content.toLowerCase();

  for (const type of errorTypes) {
    if (lower.includes(type)) {
      return type;
    }
  }

  return 'unknown error';
}

/**
 * Store blocker prediction report
 */
async function storeBlockerReport(report: BlockerPredictionReport): Promise<void> {
  await run_async(
    `INSERT INTO blocker_reports (project_name, user_id, timestamp, blockers_predicted, report_data)
     VALUES (?, ?, ?, ?, ?)`,
    [
      report.project_name,
      report.user_id,
      report.timestamp,
      report.blockers_predicted,
      JSON.stringify(report),
    ]
  ).catch(async (err: any) => {
    // Create table if it doesn't exist
    if (err.message.includes('no such table')) {
      await run_async(`
        CREATE TABLE IF NOT EXISTS blocker_reports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_name TEXT NOT NULL,
          user_id TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          blockers_predicted INTEGER NOT NULL,
          report_data TEXT NOT NULL
        )
      `);
      // Retry
      await run_async(
        `INSERT INTO blocker_reports (project_name, user_id, timestamp, blockers_predicted, report_data)
         VALUES (?, ?, ?, ?, ?)`,
        [
          report.project_name,
          report.user_id,
          report.timestamp,
          report.blockers_predicted,
          JSON.stringify(report),
        ]
      );
    }
  });
}
