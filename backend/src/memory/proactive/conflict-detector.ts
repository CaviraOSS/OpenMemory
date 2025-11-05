/**
 * Conflict Detector (Proactive Intelligence)
 *
 * Detects potential conflicts BEFORE they happen by analyzing decisions,
 * patterns, and planned actions against project context. Creates proactive
 * warnings to prevent issues.
 */

import { hsg_query, reinforce_memory } from '../hsg';
import { all_async, run_async } from '../../core/db';
import { add_hsg_memory } from '../hsg';
import { j } from '../../utils';

export interface PotentialConflict {
  conflict_id: string;
  type: 'DECISION_CONFLICT' | 'PATTERN_INCOMPATIBILITY' | 'RESOURCE_CONFLICT' | 'ARCHITECTURAL_MISMATCH';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  description: string;
  involved_memories: Array<{
    id: string;
    type: string;
    content_preview: string;
  }>;
  recommendation: string;
  prevention_action: string;
}

export interface ConflictDetectionReport {
  timestamp: number;
  project_name: string;
  user_id: string;
  conflicts_detected: number;
  critical_conflicts: number;
  warnings_created: number;
  conflicts: PotentialConflict[];
}

/**
 * Detect potential conflicts proactively
 */
export async function detectPotentialConflicts(
  project_name: string,
  user_id: string
): Promise<ConflictDetectionReport> {
  const conflicts: PotentialConflict[] = [];
  let warningsCreated = 0;

  // 1. Check for decision conflicts
  const decisionConflicts = await detectDecisionConflicts(project_name, user_id);
  conflicts.push(...decisionConflicts);

  // 2. Check for pattern incompatibilities
  const patternConflicts = await detectPatternIncompatibilities(project_name, user_id);
  conflicts.push(...patternConflicts);

  // 3. Check for architectural mismatches
  const architecturalConflicts = await detectArchitecturalMismatches(project_name, user_id);
  conflicts.push(...architecturalConflicts);

  // 4. Check for resource conflicts
  const resourceConflicts = await detectResourceConflicts(project_name, user_id);
  conflicts.push(...resourceConflicts);

  // Create warning memories for critical conflicts
  for (const conflict of conflicts) {
    if (conflict.severity === 'CRITICAL') {
      await add_hsg_memory(
        `⚠️ CRITICAL CONFLICT DETECTED\n\n` +
        `${conflict.title}\n\n` +
        `${conflict.description}\n\n` +
        `Recommendation: ${conflict.recommendation}\n` +
        `Prevention: ${conflict.prevention_action}`,
        j(['conflict-warning', 'critical', project_name]),
        {
          project_name,
          conflict_type: conflict.type,
          severity: conflict.severity,
          involved_memory_ids: conflict.involved_memories.map(m => m.id),
          timestamp: new Date().toISOString(),
        },
        user_id,
        'reflective'
      );
      warningsCreated++;
    }
  }

  const report: ConflictDetectionReport = {
    timestamp: Date.now(),
    project_name,
    user_id,
    conflicts_detected: conflicts.length,
    critical_conflicts: conflicts.filter(c => c.severity === 'CRITICAL').length,
    warnings_created: warningsCreated,
    conflicts,
  };

  // Store conflict detection report
  await storeConflictReport(report);

  return report;
}

/**
 * Detect decision conflicts
 */
async function detectDecisionConflicts(
  project_name: string,
  user_id: string
): Promise<PotentialConflict[]> {
  const conflicts: PotentialConflict[] = [];

  const decisions = await all_async(
    `SELECT id, content, meta, created_at
     FROM memories
     WHERE primary_sector = 'reflective'
     AND tags LIKE ?
     AND tags LIKE ?
     AND user_id = ?
     ORDER BY created_at DESC
     LIMIT 50`,
    [`%architectural-decision%`, `%${project_name}%`, user_id]
  );

  // Check for contradicting decisions
  for (let i = 0; i < decisions.length; i++) {
    for (let j = i + 1; j < decisions.length; j++) {
      const conflict = detectDecisionContradiction(decisions[i], decisions[j]);

      if (conflict) {
        conflicts.push({
          conflict_id: `decision-conflict-${i}-${j}`,
          type: 'DECISION_CONFLICT',
          severity: 'CRITICAL',
          title: `Contradicting Decisions Detected`,
          description: conflict.description,
          involved_memories: [
            {
              id: decisions[i].id,
              type: 'decision',
              content_preview: decisions[i].content.substring(0, 100),
            },
            {
              id: decisions[j].id,
              type: 'decision',
              content_preview: decisions[j].content.substring(0, 100),
            },
          ],
          recommendation: conflict.recommendation,
          prevention_action: conflict.prevention,
        });
      }
    }
  }

  return conflicts;
}

/**
 * Detect pattern incompatibilities
 */
async function detectPatternIncompatibilities(
  project_name: string,
  user_id: string
): Promise<PotentialConflict[]> {
  const conflicts: PotentialConflict[] = [];

  const patterns = await all_async(
    `SELECT id, content, meta, salience
     FROM memories
     WHERE primary_sector = 'procedural'
     AND tags LIKE ?
     AND user_id = ?
     AND salience > 0.3
     ORDER BY created_at DESC
     LIMIT 30`,
    [`%${project_name}%`, user_id]
  );

  // Check for incompatible patterns
  const incompatibilityRules = [
    {
      a: /synchronous.*api/i,
      b: /event.*driven/i,
      description: 'Synchronous API pattern conflicts with event-driven architecture',
      recommendation: 'Choose either synchronous or asynchronous architecture consistently',
    },
    {
      a: /monolith/i,
      b: /microservice/i,
      description: 'Monolithic pattern conflicts with microservices architecture',
      recommendation: 'Decide on a single architectural style',
    },
    {
      a: /sql.*database/i,
      b: /nosql/i,
      description: 'Mixing SQL and NoSQL patterns without clear boundaries',
      recommendation: 'Define clear data storage strategy for each use case',
    },
    {
      a: /rest.*api/i,
      b: /graphql/i,
      description: 'Mixing REST and GraphQL API patterns',
      recommendation: 'Standardize on a single API style or clearly separate use cases',
    },
  ];

  for (let i = 0; i < patterns.length; i++) {
    for (let j = i + 1; j < patterns.length; j++) {
      for (const rule of incompatibilityRules) {
        if (
          (rule.a.test(patterns[i].content) && rule.b.test(patterns[j].content)) ||
          (rule.b.test(patterns[i].content) && rule.a.test(patterns[j].content))
        ) {
          conflicts.push({
            conflict_id: `pattern-conflict-${i}-${j}`,
            type: 'PATTERN_INCOMPATIBILITY',
            severity: 'WARNING',
            title: 'Incompatible Patterns Detected',
            description: rule.description,
            involved_memories: [
              {
                id: patterns[i].id,
                type: 'pattern',
                content_preview: patterns[i].content.substring(0, 100),
              },
              {
                id: patterns[j].id,
                type: 'pattern',
                content_preview: patterns[j].content.substring(0, 100),
              },
            ],
            recommendation: rule.recommendation,
            prevention_action: 'Review both patterns and choose one consistent approach',
          });
        }
      }
    }
  }

  return conflicts;
}

/**
 * Detect architectural mismatches
 */
async function detectArchitecturalMismatches(
  project_name: string,
  user_id: string
): Promise<PotentialConflict[]> {
  const conflicts: PotentialConflict[] = [];

  // Get all decisions and patterns
  const decisions = await all_async(
    `SELECT id, content, meta
 FROM memories
     WHERE primary_sector = 'reflective'
     AND tags LIKE ?
     AND user_id = ?`,
    [`%${project_name}%`, user_id]
  );

  const patterns = await all_async(
    `SELECT id, content, meta
 FROM memories
     WHERE primary_sector = 'procedural'
     AND tags LIKE ?
     AND user_id = ?`,
    [`%${project_name}%`, user_id]
  );

  // Check if patterns align with architectural decisions
  for (const decision of decisions) {
    const decisionText = decision.content.toLowerCase();

    // Example: If decision is "Use microservices", but patterns indicate monolithic approach
    if (decisionText.includes('microservice')) {
      const monolithicPatterns = patterns.filter(p =>
        p.content.toLowerCase().includes('monolith') ||
        p.content.toLowerCase().includes('single application')
      );

      if (monolithicPatterns.length > 0) {
        conflicts.push({
          conflict_id: `arch-mismatch-micro-mono`,
          type: 'ARCHITECTURAL_MISMATCH',
          severity: 'CRITICAL',
          title: 'Architectural Mismatch: Microservices vs Monolithic',
          description: 'Decision to use microservices conflicts with monolithic implementation patterns',
          involved_memories: [
            { id: decision.id, type: 'decision', content_preview: decision.content.substring(0, 100) },
            ...monolithicPatterns.map(p => ({
              id: p.id,
              type: 'pattern',
              content_preview: p.content.substring(0, 100),
            })),
          ],
          recommendation: 'Align implementation patterns with microservices architecture decision',
          prevention_action: 'Review and update patterns to match microservices approach',
        });
      }
    }
  }

  return conflicts;
}

/**
 * Detect resource conflicts
 */
async function detectResourceConflicts(
  project_name: string,
  user_id: string
): Promise<PotentialConflict[]> {
  const conflicts: PotentialConflict[] = [];

  // Get recent actions to check for resource conflicts
  const recentActions = await all_async(
    `SELECT id, content, meta, created_at
     FROM memories
     WHERE primary_sector = 'episodic'
     AND tags LIKE ?
     AND user_id = ?
     AND created_at > ?
     ORDER BY created_at DESC
     LIMIT 100`,
    [`%${project_name}%`, user_id, Date.now() - (7 * 86400000)]
  );

  // Check for port conflicts
  const portPattern = /port\s+(\d+)/gi;
  const portsUsed = new Map<string, any[]>();

  for (const action of recentActions) {
    const matches = [...action.content.matchAll(portPattern)];
    for (const match of matches) {
      const port = match[1];
      if (!portsUsed.has(port)) portsUsed.set(port, []);
      portsUsed.get(port)!.push(action);
    }
  }

  for (const [port, actions] of portsUsed.entries()) {
    if (actions.length > 1) {
      conflicts.push({
        conflict_id: `resource-conflict-port-${port}`,
        type: 'RESOURCE_CONFLICT',
        severity: 'WARNING',
        title: `Port Conflict: Port ${port}`,
        description: `Multiple services attempting to use port ${port}`,
        involved_memories: actions.map(a => ({
          id: a.id,
          type: 'action',
          content_preview: a.content.substring(0, 100),
        })),
        recommendation: `Assign unique ports to each service`,
        prevention_action: `Update service configurations to use different ports`,
      });
    }
  }

  return conflicts;
}

/**
 * Detect decision contradiction
 */
function detectDecisionContradiction(
  decision1: any,
  decision2: any
): { description: string; recommendation: string; prevention: string } | null {
  const d1 = decision1.content.toLowerCase();
  const d2 = decision2.content.toLowerCase();

  const contradictions = [
    {
      a: /use\s+postgresql/i,
      b: /use\s+mongodb/i,
      desc: 'Decision to use PostgreSQL contradicts earlier decision to use MongoDB',
      rec: 'Clarify database strategy: PostgreSQL for relational, MongoDB for document storage, or choose one',
      prev: 'Create a data storage architecture document defining when to use each technology',
    },
    {
      a: /typescript/i,
      b: /javascript/i,
      desc: 'Mixed TypeScript and JavaScript decisions',
      rec: 'Standardize on TypeScript for better type safety',
      prev: 'Establish coding standards document',
    },
    {
      a: /rest.*api/i,
      b: /graphql/i,
      desc: 'Conflicting API architecture decisions (REST vs GraphQL)',
      rec: 'Choose primary API style; use secondary only for specific use cases',
      prev: 'Document API architecture strategy',
    },
  ];

  for (const { a, b, desc, rec, prev } of contradictions) {
    if ((a.test(d1) && b.test(d2)) || (b.test(d1) && a.test(d2))) {
      return {
        description: desc,
        recommendation: rec,
        prevention: prev,
      };
    }
  }

  return null;
}

/**
 * Store conflict detection report
 */
async function storeConflictReport(report: ConflictDetectionReport): Promise<void> {
  await run_async(
    `INSERT INTO conflict_reports (project_name, user_id, timestamp, conflicts_detected, report_data)
     VALUES (?, ?, ?, ?, ?)`,
    [
      report.project_name,
      report.user_id,
      report.timestamp,
      report.conflicts_detected,
      JSON.stringify(report),
    ]
  ).catch(async (err: any) => {
    // Create table if it doesn't exist
    if (err.message.includes('no such table')) {
      await run_async(`
        CREATE TABLE IF NOT EXISTS conflict_reports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_name TEXT NOT NULL,
          user_id TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          conflicts_detected INTEGER NOT NULL,
          report_data TEXT NOT NULL
        )
      `);
      // Retry
      await run_async(
        `INSERT INTO conflict_reports (project_name, user_id, timestamp, conflicts_detected, report_data)
         VALUES (?, ?, ?, ?, ?)`,
        [
          report.project_name,
          report.user_id,
          report.timestamp,
          report.conflicts_detected,
          JSON.stringify(report),
        ]
      );
    }
  });
}
