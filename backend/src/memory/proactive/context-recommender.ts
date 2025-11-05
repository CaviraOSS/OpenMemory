/**
 * Context-Aware Recommender (Proactive Intelligence)
 *
 * Provides intelligent recommendations based on current context, past patterns,
 * successful approaches, and project state. Suggests next best actions proactively.
 */

import { hsg_query, reinforce_memory } from '../hsg';
import { all_async, run_async } from '../../core/db';
import { j } from '../../utils';

export interface Recommendation {
  id: string;
  type: 'PATTERN' | 'DECISION' | 'ACTION' | 'CAUTION';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  rationale: string;
  confidence: number; // 0-1
  related_context: string[];
  suggested_actions: string[];
  success_probability: number;
  based_on: Array<{
    id: string;
    type: string;
    relevance: number;
  }>;
}

export interface RecommendationReport {
  timestamp: number;
  project_name: string;
  user_id: string;
  current_context: string;
  recommendations_generated: number;
  high_priority: number;
  recommendations: Recommendation[];
}

/**
 * Generate context-aware recommendations
 */
export async function generateRecommendations(
  project_name: string,
  user_id: string,
  current_context?: string
): Promise<RecommendationReport> {
  const recommendations: Recommendation[] = [];

  // 1. Pattern recommendations (successful patterns to reuse)
  const patternRecs = await recommendPatterns(project_name, user_id, current_context);
  recommendations.push(...patternRecs);

  // 2. Decision recommendations (architectural guidance)
  const decisionRecs = await recommendDecisions(project_name, user_id, current_context);
  recommendations.push(...decisionRecs);

  // 3. Action recommendations (next best actions)
  const actionRecs = await recommendActions(project_name, user_id, current_context);
  recommendations.push(...actionRecs);

  // 4. Caution recommendations (things to avoid)
  const cautionRecs = await recommendCautions(project_name, user_id);
  recommendations.push(...cautionRecs);

  // Sort by priority and confidence
  recommendations.sort((a, b) => {
    const priorityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return b.confidence - a.confidence;
  });

  const report: RecommendationReport = {
    timestamp: Date.now(),
    project_name,
    user_id,
    current_context: current_context || 'general',
    recommendations_generated: recommendations.length,
    high_priority: recommendations.filter(r => r.priority === 'CRITICAL' || r.priority === 'HIGH').length,
    recommendations,
  };

  return report;
}

/**
 * Recommend successful patterns
 */
async function recommendPatterns(
  project_name: string,
  user_id: string,
  context?: string
): Promise<Recommendation[]> {
  const recommendations: Recommendation[] = [];

  // Get highly successful patterns
  const patterns = await all_async(
    `SELECT m.id, m.content, m.meta, m.salience, m.coactivations
     FROM memories m
     WHERE m.primary_sector = 'procedural'
     AND m.tags LIKE ?
     AND m.user_id = ?
     AND m.salience > 0.6
     ORDER BY m.salience DESC, m.coactivations DESC
     LIMIT 10`,
    [`%${project_name}%`, user_id]
  );

  for (const pattern of patterns) {
    const metadata = pattern.meta ? JSON.parse(pattern.meta) : {};
    const patternName = metadata.pattern_name || extractPatternName(pattern.content);

    // Calculate success rate by checking linked actions
    const linkedActions = await all_async(
      `SELECT m.meta
       FROM memories m
       JOIN waypoints w ON w.dst_id = m.id
       WHERE w.src_id = ?
       AND m.primary_sector = 'episodic'`,
      [pattern.id]
    );

    let successes = 0;
    for (const action of linkedActions) {
      const meta = action.meta ? JSON.parse(action.meta) : {};
      if (meta.outcome === 'success') successes++;
    }

    const successRate = linkedActions.length > 0 ? successes / linkedActions.length : 0;

    if (successRate >= 0.7 || pattern.salience > 0.8) {
      // Context relevance (if context provided)
      let contextRelevance = 0.8;
      if (context) {
        const contextLower = context.toLowerCase();
        const patternLower = pattern.content.toLowerCase();
        const keywords = contextLower.split(/\s+/).filter(w => w.length > 3);
        const matches = keywords.filter(kw => patternLower.includes(kw)).length;
        contextRelevance = keywords.length > 0 ? matches / keywords.length : 0.5;
      }

      if (contextRelevance > 0.3) {
        recommendations.push({
          id: `pattern-rec-${pattern.id}`,
          type: 'PATTERN',
          priority: successRate >= 0.9 ? 'HIGH' : 'MEDIUM',
          title: `Reuse Successful Pattern: ${patternName}`,
          description: `This pattern has a ${(successRate * 100).toFixed(0)}% success rate in ${linkedActions.length} uses.`,
          rationale: `Pattern "${patternName}" has proven highly effective in similar contexts.`,
          confidence: Math.min(0.95, pattern.salience * contextRelevance),
          related_context: [context || 'general'],
          suggested_actions: [
            `Review pattern: ${patternName}`,
            'Adapt pattern to current context',
            'Follow established best practices',
          ],
          success_probability: successRate,
          based_on: [
            {
              id: pattern.id,
              type: 'pattern',
              relevance: contextRelevance,
            },
          ],
        });
      }
    }
  }

  return recommendations;
}

/**
 * Recommend architectural decisions
 */
async function recommendDecisions(
  project_name: string,
  user_id: string,
  context?: string
): Promise<Recommendation[]> {
  const recommendations: Recommendation[] = [];

  // Get recent validated decisions
  const decisions = await all_async(
    `SELECT m.id, m.content, m.meta, m.salience
     FROM memories m
     WHERE m.primary_sector = 'reflective'
     AND m.tags LIKE ?
     AND m.user_id = ?
     AND m.salience > 0.7
     ORDER BY m.created_at DESC
     LIMIT 10`,
    [`%${project_name}%`, user_id]
  );

  for (const decision of decisions) {
    const metadata = decision.meta ? JSON.parse(decision.meta) : {};
    const decisionText = extractDecisionText(decision.content);

    // Check if decision has been successfully followed
    const followedActions = await all_async(
      `SELECT COUNT(*) as count
       FROM memories m
       JOIN waypoints w ON w.dst_id = m.id
       WHERE w.src_id = ?
       AND m.primary_sector = 'episodic'`,
      [decision.id]
    );

    const actionCount = followedActions[0]?.count || 0;

    if (actionCount > 2) {
      // Decision has been acted upon successfully
      recommendations.push({
        id: `decision-rec-${decision.id}`,
        type: 'DECISION',
        priority: 'MEDIUM',
        title: `Follow Established Decision: ${decisionText}`,
        description: `This architectural decision has guided ${actionCount} actions successfully.`,
        rationale: `Continuing with established architectural decisions ensures consistency.`,
        confidence: decision.salience,
        related_context: [context || 'architectural'],
        suggested_actions: [
          'Review decision rationale',
          'Ensure new work aligns with this decision',
          'Create implementation patterns if needed',
        ],
        success_probability: 0.75,
        based_on: [
          {
            id: decision.id,
            type: 'decision',
            relevance: 0.9,
          },
        ],
      });
    }
  }

  return recommendations;
}

/**
 * Recommend next actions
 */
async function recommendActions(
  project_name: string,
  user_id: string,
  context?: string
): Promise<Recommendation[]> {
  const recommendations: Recommendation[] = [];

  // Get project state
  const stateMemories = await all_async(
    `SELECT content, meta FROM memories
     WHERE primary_sector = 'semantic'
     AND tags LIKE ?
     AND tags LIKE ?
     AND user_id = ?
     ORDER BY updated_at DESC
     LIMIT 1`,
    [`%project-state%`, `%${project_name}%`, user_id]
  );

  if (stateMemories.length > 0) {
    const stateContent = stateMemories[0].content;
    const stateMatch = stateContent.match(/State: ([\s\S]+)$/);

    if (stateMatch) {
      try {
        const state = JSON.parse(stateMatch[1]);
        const nextTasks = state.next_recommended_tasks || [];

        if (nextTasks.length > 0) {
          recommendations.push({
            id: 'action-rec-next-task',
            type: 'ACTION',
            priority: 'HIGH',
            title: 'Continue with Next Planned Task',
            description: `${nextTasks.length} tasks are queued in the project plan.`,
            rationale: 'Following the established project plan maintains momentum.',
            confidence: 0.85,
            related_context: [context || 'project-plan'],
            suggested_actions: nextTasks.slice(0, 3),
            success_probability: 0.80,
            based_on: [
              {
                id: stateMemories[0].id || 'state',
                type: 'state',
                relevance: 1.0,
              },
            ],
          });
        }
      } catch (e) {
        // JSON parse error, skip
      }
    }
  }

  // Check for incomplete actions (actions without outcome)
  const incompleteActions = await all_async(
    `SELECT id, content, meta, created_at
     FROM memories
     WHERE primary_sector = 'episodic'
     AND tags LIKE ?
     AND user_id = ?
     ORDER BY created_at DESC
     LIMIT 20`,
    [`%${project_name}%`, user_id]
  );

  const pendingActions = incompleteActions.filter(action => {
    const meta = action.meta ? JSON.parse(action.meta) : {};
    return !meta.outcome || meta.outcome === 'pending';
  });

  if (pendingActions.length > 0) {
    recommendations.push({
      id: 'action-rec-complete-pending',
      type: 'ACTION',
      priority: 'HIGH',
      title: `Complete ${pendingActions.length} Pending Actions`,
      description: `${pendingActions.length} actions are marked as pending. Complete or update their status.`,
      rationale: 'Completing pending actions prevents forgotten work and maintains accurate project state.',
      confidence: 0.90,
      related_context: ['pending-work'],
      suggested_actions: [
        'Review pending actions',
        'Update outcomes (success/failure)',
        'Close or continue pending work',
      ],
      success_probability: 0.85,
      based_on: pendingActions.slice(0, 3).map(a => ({
        id: a.id,
        type: 'action',
        relevance: 0.9,
      })),
    });
  }

  return recommendations;
}

/**
 * Recommend cautions (things to avoid)
 */
async function recommendCautions(
  project_name: string,
  user_id: string
): Promise<Recommendation[]> {
  const recommendations: Recommendation[] = [];

  // Get failed patterns (low success rate)
  const failedPatterns = await all_async(
    `SELECT m.id, m.content, m.meta, m.salience
     FROM memories m
     WHERE m.primary_sector = 'procedural'
     AND m.tags LIKE ?
     AND m.user_id = ?
     AND m.salience < 0.4
     ORDER BY m.salience ASC
     LIMIT 5`,
    [`%${project_name}%`, user_id]
  );

  for (const pattern of failedPatterns) {
    const metadata = pattern.meta ? JSON.parse(pattern.meta) : {};
    const patternName = metadata.pattern_name || extractPatternName(pattern.content);

    recommendations.push({
      id: `caution-rec-${pattern.id}`,
      type: 'CAUTION',
      priority: 'HIGH',
      title: `⚠️ Avoid Pattern: ${patternName}`,
      description: `This pattern has low confidence (${(pattern.salience * 100).toFixed(0)}%) due to past failures.`,
      rationale: `Pattern "${patternName}" has not been successful in this project. Consider alternatives.`,
      confidence: 0.85,
      related_context: ['failed-patterns'],
      suggested_actions: [
        `Do NOT use: ${patternName}`,
        'Look for alternative approaches',
        'Learn from past failures',
      ],
      success_probability: 0.30,
      based_on: [
        {
          id: pattern.id,
          type: 'pattern',
          relevance: 1.0,
        },
      ],
    });
  }

  // Get warning memories
  const warnings = await all_async(
    `SELECT id, content, meta
 FROM memories
     WHERE primary_sector = 'reflective'
     AND tags LIKE ?
     AND tags LIKE ?
     AND user_id = ?
     AND created_at > ?
     ORDER BY created_at DESC
     LIMIT 5`,
    [`%warning%`, `%${project_name}%`, user_id, Date.now() - (30 * 86400000)]
  );

  if (warnings.length > 0) {
    recommendations.push({
      id: 'caution-rec-warnings',
      type: 'CAUTION',
      priority: 'CRITICAL',
      title: `⚠️ Review ${warnings.length} Active Warnings`,
      description: `${warnings.length} warnings have been issued in the last 30 days.`,
      rationale: 'Active warnings indicate potential problems that should be addressed.',
      confidence: 0.95,
      related_context: ['warnings'],
      suggested_actions: [
        'Review all active warnings',
        'Address critical warnings first',
        'Create action plans for each warning',
      ],
      success_probability: 0.70,
      based_on: warnings.map(w => ({
        id: w.id,
        type: 'warning',
        relevance: 1.0,
      })),
    });
  }

  return recommendations;
}

/**
 * Extract pattern name from content
 */
function extractPatternName(content: string): string {
  const match = content.match(/Pattern:\s*(.+?)(\n|$)/i);
  if (match) return match[1].trim();
  return content.substring(0, 50);
}

/**
 * Extract decision text from content
 */
function extractDecisionText(content: string): string {
  const match = content.match(/Decision:\s*(.+?)(\n|$)/i);
  if (match) return match[1].trim();
  return content.substring(0, 80);
}
