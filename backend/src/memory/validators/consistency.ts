/**
 * Consistency Validator
 *
 * Automatically validates memory consistency, detects contradictions,
 * finds circular dependencies, and validates waypoint integrity.
 */

import { hsg_query, reinforce_memory } from '../hsg';
import { all_async, q, run_async } from '../../core/db';
import { j } from '../../utils';
import { cos_sim } from '../../utils/index';

export interface ValidationIssue {
  type: 'DECISION_CONFLICT' | 'CIRCULAR_DEPENDENCY' | 'BROKEN_WAYPOINT' | 'ORPHANED_MEMORY';
  severity: 'critical' | 'high' | 'medium' | 'low';
  memory_ids: string[];
  description: string;
  suggestion: string;
  auto_action_taken?: string;
}

export interface ValidationReport {
  timestamp: number;
  project_name: string;
  user_id: string;
  issues_found: number;
  issues: ValidationIssue[];
  status: 'HEALTHY' | 'ISSUES_FOUND' | 'CRITICAL';
  auto_actions_taken: number;
}

/**
 * Main consistency validation function
 */
export async function validateConsistency(
  project_name: string,
  user_id: string
): Promise<ValidationReport> {
  const issues: ValidationIssue[] = [];
  let autoActionsTaken = 0;

  // 1. Check for contradicting decisions
  const conflictIssues = await checkDecisionConflicts(project_name, user_id);
  issues.push(...conflictIssues);
  autoActionsTaken += conflictIssues.filter(i => i.auto_action_taken).length;

  // 2. Check for circular dependencies
  const circularIssues = await checkCircularDependencies(project_name, user_id);
  issues.push(...circularIssues);

  // 3. Validate waypoint integrity
  const waypointIssues = await validateWaypointIntegrity(project_name, user_id);
  issues.push(...waypointIssues);
  autoActionsTaken += waypointIssues.filter(i => i.auto_action_taken).length;

  // 4. Find orphaned memories
  const orphanIssues = await findOrphanedMemories(project_name, user_id);
  issues.push(...orphanIssues);

  // Determine status
  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const status = criticalCount > 0 ? 'CRITICAL' : issues.length > 0 ? 'ISSUES_FOUND' : 'HEALTHY';

  const report: ValidationReport = {
    timestamp: Date.now(),
    project_name,
    user_id,
    issues_found: issues.length,
    issues,
    status,
    auto_actions_taken: autoActionsTaken,
  };

  // Store validation report
  await storeValidationReport(report);

  return report;
}

/**
 * Check for contradicting decisions
 */
async function checkDecisionConflicts(
  project_name: string,
  user_id: string
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  const decisions = await all_async(
    `SELECT id, content, metadata, created_at, salience
     FROM memories
     WHERE primary_sector = 'reflective'
     AND tags LIKE ?
     AND user_id = ?
     ORDER BY created_at DESC
     LIMIT 100`,
    [`%${project_name}%`, user_id]
  );

  // Check each pair for conflicts
  for (let i = 0; i < decisions.length; i++) {
    for (let j = i + 1; j < decisions.length; j++) {
      const conflict = detectConflict(decisions[i].content, decisions[j].content);

      if (conflict) {
        issues.push({
          type: 'DECISION_CONFLICT',
          severity: 'high',
          memory_ids: [decisions[i].id, decisions[j].id],
          description: `Conflicting decisions: "${extractDecisionText(decisions[i].content)}" vs "${extractDecisionText(decisions[j].content)}"`,
          suggestion: 'Review and consolidate these decisions. Consider which is more current.',
          auto_action_taken: 'Reduced confidence on older decision',
        });

        // Auto-action: Reduce confidence on older (later in array = older)
        await reduceConfidence(decisions[j].id, 0.3);
      }
    }
  }

  return issues;
}

/**
 * Detect if two decision contents conflict
 */
function detectConflict(content1: string, content2: string): boolean {
  const c1 = content1.toLowerCase();
  const c2 = content2.toLowerCase();

  // Check for contradictory technology choices
  const techPatterns = [
    { a: /use\s+postgresql/i, b: /use\s+mongodb/i },
    { a: /use\s+mongodb/i, b: /use\s+postgresql/i },
    { a: /use\s+mysql/i, b: /use\s+postgresql/i },
    { a: /synchronous/i, b: /asynchronous/i },
    { a: /rest\s+api/i, b: /graphql/i },
    { a: /monolith/i, b: /microservices/i },
    { a: /sql/i, b: /nosql/i },
  ];

  for (const { a, b } of techPatterns) {
    if (a.test(c1) && b.test(c2)) return true;
    if (b.test(c1) && a.test(c2)) return true;
  }

  // Check for contradictory directives
  const directivePatterns = [
    { pattern1: /prefer\s+(\w+)/gi, pattern2: /avoid\s+\1/gi },
    { pattern1: /always\s+(\w+)/gi, pattern2: /never\s+\1/gi },
    { pattern1: /must\s+use\s+(\w+)/gi, pattern2: /must\s+not\s+use\s+\1/gi },
  ];

  for (const { pattern1, pattern2 } of directivePatterns) {
    const match1 = content1.match(pattern1);
    const match2 = content2.match(pattern2);
    if (match1 && match2) {
      // Extract the subject and compare
      const subject1 = match1[0].split(/\s+/).pop();
      const subject2 = match2[0].split(/\s+/).pop();
      if (subject1 === subject2) return true;
    }
  }

  return false;
}

/**
 * Check for circular dependencies
 */
async function checkCircularDependencies(
  project_name: string,
  user_id: string
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  // Get all waypoints for the project
  const waypoints = await all_async(
    `SELECT w.src_id, w.dst_id, w.weight
     FROM waypoints w
     JOIN memories m1 ON w.src_id = m1.id
     WHERE m1.tags LIKE ?
     AND m1.user_id = ?`,
    [`%${project_name}%`, user_id]
  );

  // Build adjacency list
  const graph = new Map<string, string[]>();
  waypoints.forEach((w: any) => {
    if (!graph.has(w.src_id)) graph.set(w.src_id, []);
    graph.get(w.src_id)!.push(w.dst_id);
  });

  // DFS to detect cycles
  const visited = new Set<string>();
  const recStack = new Set<string>();
  const cycles: string[][] = [];

  function dfs(node: string, path: string[]): boolean {
    visited.add(node);
    recStack.add(node);
    path.push(node);

    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor, [...path])) return true;
      } else if (recStack.has(neighbor)) {
        // Cycle found
        const cycleStart = path.indexOf(neighbor);
        const cycle = path.slice(cycleStart);
        cycles.push(cycle);
        return true;
      }
    }

    recStack.delete(node);
    return false;
  }

  // Check all nodes
  for (const [node] of graph) {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  }

  // Create issues for each cycle
  for (const cycle of cycles) {
    issues.push({
      type: 'CIRCULAR_DEPENDENCY',
      severity: 'medium',
      memory_ids: cycle,
      description: `Circular dependency detected: ${cycle.join(' → ')} → ${cycle[0]}`,
      suggestion: 'Refactor to remove circular reference',
    });
  }

  return issues;
}

/**
 * Validate waypoint integrity
 */
async function validateWaypointIntegrity(
  project_name: string,
  user_id: string
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  // Find waypoints where source or destination no longer exists
  const brokenWaypoints = await all_async(
    `SELECT w.src_id, w.dst_id
     FROM waypoints w
     LEFT JOIN memories m1 ON w.src_id = m1.id
     LEFT JOIN memories m2 ON w.dst_id = m2.id
     WHERE (m1.id IS NULL OR m2.id IS NULL)
     AND (m1.user_id = ? OR m2.user_id = ?)
     LIMIT 100`,
    [user_id, user_id]
  );

  for (const broken of brokenWaypoints) {
    issues.push({
      type: 'BROKEN_WAYPOINT',
      severity: 'low',
      memory_ids: [broken.src_id, broken.dst_id].filter(Boolean),
      description: `Broken waypoint: link from ${broken.src_id} to ${broken.dst_id}`,
      suggestion: 'Remove broken waypoint link',
      auto_action_taken: 'Removed broken waypoint',
    });

    // Auto-action: Remove broken waypoint
    await run_async(
      'DELETE FROM waypoints WHERE src_id = ? AND dst_id = ?',
      [broken.src_id, broken.dst_id]
    );
  }

  return issues;
}

/**
 * Find orphaned memories (no waypoints in or out)
 */
async function findOrphanedMemories(
  project_name: string,
  user_id: string
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  // Find memories with no waypoints (not critical, just informational)
  const orphans = await all_async(
    `SELECT m.id, m.content, m.primary_sector
     FROM memories m
     WHERE m.tags LIKE ?
     AND m.user_id = ?
     AND m.primary_sector IN ('procedural', 'reflective')
     AND NOT EXISTS (
       SELECT 1 FROM waypoints w WHERE w.src_id = m.id OR w.dst_id = m.id
     )
     AND m.created_at < ?
     LIMIT 20`,
    [`%${project_name}%`, user_id, Date.now() - 7 * 86400000] // Older than 7 days
  );

  if (orphans.length > 0) {
    issues.push({
      type: 'ORPHANED_MEMORY',
      severity: 'low',
      memory_ids: orphans.map((o: any) => o.id),
      description: `Found ${orphans.length} memories with no waypoint connections`,
      suggestion: 'Consider linking these memories to related decisions/patterns/actions',
    });
  }

  return issues;
}

/**
 * Reduce confidence (salience) on a memory
 */
async function reduceConfidence(memory_id: string, amount: number): Promise<void> {
  await run_async(
    `UPDATE memories
     SET salience = MAX(0.1, salience - ?)
     WHERE id = ?`,
    [amount, memory_id]
  );
}

/**
 * Extract decision text from content
 */
function extractDecisionText(content: string): string {
  const match = content.match(/Decision:\s*(.+?)(\n|$)/i);
  return match ? match[1].trim() : content.substring(0, 60);
}

/**
 * Store validation report
 */
async function storeValidationReport(report: ValidationReport): Promise<void> {
  await run_async(
    `INSERT INTO validation_reports (project_name, user_id, timestamp, status, issues_found, report_data)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      report.project_name,
      report.user_id,
      report.timestamp,
      report.status,
      report.issues_found,
      JSON.stringify(report),
    ]
  ).catch(async (err: any) => {
    // Table might not exist, create it
    if (err.message.includes('no such table')) {
      await run_async(`
        CREATE TABLE IF NOT EXISTS validation_reports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_name TEXT NOT NULL,
          user_id TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          status TEXT NOT NULL,
          issues_found INTEGER NOT NULL,
          report_data TEXT NOT NULL
        )
      `);
      // Retry insert
      await run_async(
        `INSERT INTO validation_reports (project_name, user_id, timestamp, status, issues_found, report_data)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          report.project_name,
          report.user_id,
          report.timestamp,
          report.status,
          report.issues_found,
          JSON.stringify(report),
        ]
      );
    }
  });
}
