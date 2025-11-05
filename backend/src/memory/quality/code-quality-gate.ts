/**
 * Code Quality Gate (Quality Assurance)
 *
 * Enforces quality standards by checking actions, patterns, and decisions
 * against established best practices. Blocks or warns about quality violations.
 */

import { hsg_query, reinforce_memory } from '../hsg';
import { all_async, run_async } from '../../core/db';
import { add_hsg_memory } from '../hsg';
import { j } from '../../utils';

export interface QualityViolation {
  violation_id: string;
  type: 'ANTI_PATTERN' | 'MISSING_TESTS' | 'NO_DOCUMENTATION' | 'DECISION_NOT_FOLLOWED' | 'COMPLEXITY_THRESHOLD' | 'DUPLICATE_WORK';
  severity: 'BLOCKING' | 'WARNING' | 'INFO';
  title: string;
  description: string;
  impact: string;
  remediation: string;
  related_memory_id?: string;
}

export interface QualityGateReport {
  timestamp: number;
  project_name: string;
  user_id: string;
  passed: boolean;
  violations_found: number;
  blocking_violations: number;
  warning_violations: number;
  quality_score: number; // 0-100
  violations: QualityViolation[];
}

/**
 * Run quality gate check for a project
 */
export async function runQualityGate(
  project_name: string,
  user_id: string,
  context?: {
    action?: string;
    pattern?: string;
    decision?: string;
  }
): Promise<QualityGateReport> {
  const violations: QualityViolation[] = [];

  // 1. Check for anti-patterns
  const antiPatternViolations = await checkAntiPatterns(project_name, user_id, context);
  violations.push(...antiPatternViolations);

  // 2. Check for missing tests
  const testViolations = await checkTestCoverage(project_name, user_id);
  violations.push(...testViolations);

  // 3. Check for missing documentation
  const docViolations = await checkDocumentation(project_name, user_id);
  violations.push(...docViolations);

  // 4. Check decision compliance
  const complianceViolations = await checkDecisionCompliance(project_name, user_id);
  violations.push(...complianceViolations);

  // 5. Check for duplicate work
  const duplicateViolations = await checkDuplicateWork(project_name, user_id);
  violations.push(...duplicateViolations);

  const blockingCount = violations.filter(v => v.severity === 'BLOCKING').length;
  const warningCount = violations.filter(v => v.severity === 'WARNING').length;

  // Calculate quality score (0-100)
  // Start at 100, deduct points for violations
  let qualityScore = 100;
  qualityScore -= blockingCount * 20;  // -20 per blocking violation
  qualityScore -= warningCount * 5;    // -5 per warning
  qualityScore = Math.max(0, Math.min(100, qualityScore));

  const passed = blockingCount === 0;

  const report: QualityGateReport = {
    timestamp: Date.now(),
    project_name,
    user_id,
    passed,
    violations_found: violations.length,
    blocking_violations: blockingCount,
    warning_violations: warningCount,
    quality_score: qualityScore,
    violations,
  };

  // Store quality gate report
  await storeQualityGateReport(report);

  // Create warning memory for failed gates
  if (!passed) {
    await add_hsg_memory(
      `⚠️ QUALITY GATE FAILED\n\n` +
      `${blockingCount} blocking violations detected\n` +
      `Quality Score: ${qualityScore}/100\n\n` +
      `Violations:\n${violations.slice(0, 5).map(v => `• ${v.title}`).join('\n')}`,
      j(['quality-gate', 'failed', project_name]),
      {
        project_name,
        quality_score: qualityScore,
        blocking_violations: blockingCount,
        timestamp: new Date().toISOString(),
      },
      user_id,
      'reflective'
    );
  }

  return report;
}

/**
 * Check for anti-patterns
 */
async function checkAntiPatterns(
  project_name: string,
  user_id: string,
  context?: any
): Promise<QualityViolation[]> {
  const violations: QualityViolation[] = [];

  // Get recent actions
  const recentActions = await all_async(
    `SELECT id, content, metadata FROM memories
     WHERE primary_sector = 'episodic'
     AND tags LIKE ?
     AND user_id = ?
     AND created_at > ?
     ORDER BY created_at DESC
     LIMIT 50`,
    [`%${project_name}%`, user_id, Date.now() - (7 * 86400000)]
  );

  // Known anti-patterns
  const antiPatterns = [
    {
      pattern: /god.*class|mega.*class|huge.*class/i,
      title: 'God Class Anti-Pattern',
      description: 'Detected signs of a God/Mega class (class doing too much)',
      impact: 'Hard to maintain, test, and understand',
      remediation: 'Break down into smaller, focused classes with single responsibilities',
    },
    {
      pattern: /global.*state|shared.*state/i,
      title: 'Global State Anti-Pattern',
      description: 'Using global or shared mutable state',
      impact: 'Hard to debug, test, and reason about',
      remediation: 'Use dependency injection or state management patterns',
    },
    {
      pattern: /tight.*coupling|tightly.*coupled/i,
      title: 'Tight Coupling',
      description: 'Components are tightly coupled',
      impact: 'Changes cascade through system, hard to test',
      remediation: 'Use interfaces, dependency injection, or event-driven architecture',
    },
    {
      pattern: /hard.*coded|hardcoded/i,
      title: 'Hard-Coded Values',
      description: 'Using hard-coded values instead of configuration',
      impact: 'Inflexible, hard to adapt to different environments',
      remediation: 'Move values to configuration files or environment variables',
    },
  ];

  for (const action of recentActions) {
    for (const antiPattern of antiPatterns) {
      if (antiPattern.pattern.test(action.content)) {
        violations.push({
          violation_id: `anti-pattern-${action.id}`,
          type: 'ANTI_PATTERN',
          severity: 'WARNING',
          title: antiPattern.title,
          description: antiPattern.description,
          impact: antiPattern.impact,
          remediation: antiPattern.remediation,
          related_memory_id: action.id,
        });
      }
    }
  }

  return violations;
}

/**
 * Check test coverage
 */
async function checkTestCoverage(
  project_name: string,
  user_id: string
): Promise<QualityViolation[]> {
  const violations: QualityViolation[] = [];

  // Count implementation actions vs test actions
  const recentPeriod = Date.now() - (14 * 86400000);

  const implementationActions = await all_async(
    `SELECT COUNT(*) as count FROM memories
     WHERE primary_sector = 'episodic'
     AND tags LIKE ?
     AND user_id = ?
     AND created_at > ?
     AND (content LIKE '%implement%' OR content LIKE '%add feature%' OR content LIKE '%create%')`,
    [`%${project_name}%`, user_id, recentPeriod]
  );

  const testActions = await all_async(
    `SELECT COUNT(*) as count FROM memories
     WHERE primary_sector = 'episodic'
     AND tags LIKE ?
     AND user_id = ?
     AND created_at > ?
     AND (content LIKE '%test%' OR content LIKE '%spec%')`,
    [`%${project_name}%`, user_id, recentPeriod]
  );

  const implCount = implementationActions[0]?.count || 0;
  const testCount = testActions[0]?.count || 0;

  // Expect at least 30% test coverage
  const testRatio = implCount > 0 ? testCount / implCount : 1;

  if (testRatio < 0.3 && implCount > 5) {
    violations.push({
      violation_id: 'missing-tests',
      type: 'MISSING_TESTS',
      severity: 'WARNING',
      title: 'Low Test Coverage',
      description: `Only ${testCount} test actions for ${implCount} implementation actions (${(testRatio * 100).toFixed(0)}%)`,
      impact: 'Untested code is prone to bugs and regressions',
      remediation: 'Add tests for recent implementations. Aim for at least 30% test-to-implementation ratio.',
    });
  }

  return violations;
}

/**
 * Check documentation
 */
async function checkDocumentation(
  project_name: string,
  user_id: string
): Promise<QualityViolation[]> {
  const violations: QualityViolation[] = [];

  // Check if decisions have rationale
  const decisionsWithoutRationale = await all_async(
    `SELECT COUNT(*) as count FROM memories
     WHERE primary_sector = 'reflective'
     AND tags LIKE ?
     AND tags LIKE ?
     AND user_id = ?
     AND content NOT LIKE '%rationale%'
     AND created_at > ?`,
    [`%architectural-decision%`, `%${project_name}%`, user_id, Date.now() - (30 * 86400000)]
  );

  const count = decisionsWithoutRationale[0]?.count || 0;

  if (count > 0) {
    violations.push({
      violation_id: 'missing-rationale',
      type: 'NO_DOCUMENTATION',
      severity: 'WARNING',
      title: 'Decisions Without Rationale',
      description: `${count} architectural decisions lack documented rationale`,
      impact: 'Future developers won\'t understand why decisions were made',
      remediation: 'Document rationale, alternatives considered, and consequences for all decisions',
    });
  }

  return violations;
}

/**
 * Check decision compliance
 */
async function checkDecisionCompliance(
  project_name: string,
  user_id: string
): Promise<QualityViolation[]> {
  const violations: QualityViolation[] = [];

  // Get high-confidence decisions
  const decisions = await all_async(
    `SELECT id, content, metadata FROM memories
     WHERE primary_sector = 'reflective'
     AND tags LIKE ?
     AND user_id = ?
     AND salience > 0.7
     ORDER BY created_at DESC
     LIMIT 10`,
    [`%${project_name}%`, user_id]
  );

  // Check if recent actions comply with decisions
  const recentActions = await all_async(
    `SELECT id, content, metadata FROM memories
     WHERE primary_sector = 'episodic'
     AND tags LIKE ?
     AND user_id = ?
     AND created_at > ?
     ORDER BY created_at DESC
     LIMIT 20`,
    [`%${project_name}%`, user_id, Date.now() - (7 * 86400000)]
  );

  for (const decision of decisions) {
    const decisionText = decision.content.toLowerCase();

    // Check for technology decisions
    if (decisionText.includes('use typescript')) {
      const jsActions = recentActions.filter(a =>
        a.content.toLowerCase().includes('javascript') &&
        !a.content.toLowerCase().includes('typescript')
      );
      if (jsActions.length > 0) {
        violations.push({
          violation_id: `non-compliance-${decision.id}`,
          type: 'DECISION_NOT_FOLLOWED',
          severity: 'WARNING',
          title: 'Decision Not Followed: TypeScript',
          description: `Decision to use TypeScript, but ${jsActions.length} JavaScript implementations found`,
          impact: 'Inconsistent technology stack',
          remediation: 'Follow TypeScript decision or formally revise the decision',
          related_memory_id: decision.id,
        });
      }
    }
  }

  return violations;
}

/**
 * Check for duplicate work
 */
async function checkDuplicateWork(
  project_name: string,
  user_id: string
): Promise<QualityViolation[]> {
  const violations: QualityViolation[] = [];

  // Get recent actions
  const recentActions = await all_async(
    `SELECT id, content, metadata, created_at FROM memories
     WHERE primary_sector = 'episodic'
     AND tags LIKE ?
     AND user_id = ?
     AND created_at > ?
     ORDER BY created_at DESC`,
    [`%${project_name}%`, user_id, Date.now() - (14 * 86400000)]
  );

  // Check for similar actions
  for (let i = 0; i < recentActions.length - 1; i++) {
    for (let j = i + 1; j < recentActions.length; j++) {
      const similarity = calculateSimilarity(
        recentActions[i].content,
        recentActions[j].content
      );

      if (similarity > 0.8) {
        violations.push({
          violation_id: `duplicate-${recentActions[i].id}`,
          type: 'DUPLICATE_WORK',
          severity: 'INFO',
          title: 'Potential Duplicate Work',
          description: `Two similar actions detected (${(similarity * 100).toFixed(0)}% similar)`,
          impact: 'Wasted effort on redundant work',
          remediation: 'Review both actions and consolidate if truly duplicate',
          related_memory_id: recentActions[i].id,
        });
        break; // Only report once per action
      }
    }
  }

  return violations;
}

/**
 * Calculate similarity between two strings
 */
function calculateSimilarity(str1: string, str2: string): number {
  const normalize = (str: string) =>
    str.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3);

  const tokens1 = new Set(normalize(str1));
  const tokens2 = new Set(normalize(str2));

  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);

  return intersection.size / union.size;
}

/**
 * Get quality trends over time
 */
export async function getQualityTrends(
  project_name: string,
  user_id: string,
  days: number = 30
): Promise<any> {
  const reports = await all_async(
    `SELECT report_data FROM quality_gate_reports
     WHERE project_name = ?
     AND user_id = ?
     AND timestamp > ?
     ORDER BY timestamp ASC`,
    [project_name, user_id, Date.now() - (days * 86400000)]
  );

  const trend = reports.map((r: any) => {
    const data = JSON.parse(r.report_data);
    return {
      timestamp: data.timestamp,
      quality_score: data.quality_score,
      violations: data.violations_found,
      blocking: data.blocking_violations,
    };
  });

  return {
    trend,
    average_quality: trend.length > 0
      ? trend.reduce((sum: number, t: any) => sum + t.quality_score, 0) / trend.length
      : 100,
    total_reports: trend.length,
  };
}

/**
 * Store quality gate report
 */
async function storeQualityGateReport(report: QualityGateReport): Promise<void> {
  await run_async(
    `INSERT INTO quality_gate_reports (project_name, user_id, timestamp, passed, quality_score, report_data)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      report.project_name,
      report.user_id,
      report.timestamp,
      report.passed ? 1 : 0,
      report.quality_score,
      JSON.stringify(report),
    ]
  ).catch(async (err: any) => {
    // Create table if it doesn't exist
    if (err.message.includes('no such table')) {
      await run_async(`
        CREATE TABLE IF NOT EXISTS quality_gate_reports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_name TEXT NOT NULL,
          user_id TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          passed INTEGER NOT NULL,
          quality_score INTEGER NOT NULL,
          report_data TEXT NOT NULL
        )
      `);
      // Retry
      await run_async(
        `INSERT INTO quality_gate_reports (project_name, user_id, timestamp, passed, quality_score, report_data)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          report.project_name,
          report.user_id,
          report.timestamp,
          report.passed ? 1 : 0,
          report.quality_score,
          JSON.stringify(report),
        ]
      );
    }
  });
}
