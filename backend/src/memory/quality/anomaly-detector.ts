/**
 * Anomaly Detector (Quality & Monitoring)
 *
 * Detects unusual patterns, activity spikes/drops, sentiment shifts,
 * and other anomalies in real-time. Creates alerts for investigation.
 */

import { hsg_query, reinforce_memory } from '../hsg';
import { all_async, run_async } from '../../core/db';
import { add_hsg_memory } from '../hsg';
import { j } from '../../utils';

export interface Anomaly {
  anomaly_id: string;
  type: 'ACTIVITY_SPIKE' | 'ACTIVITY_DROP' | 'FAILURE_SPIKE' | 'CONFIDENCE_DROP' | 'PATTERN_DEVIATION' | 'MEMORY_GROWTH';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  detected_at: number;
  metric_value: number;
  expected_value: number;
  deviation_percentage: number;
  context: string;
  recommendation: string;
  related_memories: Array<{
    id: string;
    type: string;
    relevance: number;
  }>;
}

export interface AnomalyDetectionReport {
  timestamp: number;
  project_name: string;
  user_id: string;
  anomalies_detected: number;
  critical_anomalies: number;
  alerts_created: number;
  anomalies: Anomaly[];
}

/**
 * Detect anomalies in project activity
 */
export async function detectAnomalies(
  project_name: string,
  user_id: string
): Promise<AnomalyDetectionReport> {
  const anomalies: Anomaly[] = [];
  let alertsCreated = 0;

  // 1. Detect activity spikes/drops
  const activityAnomalies = await detectActivityAnomalies(project_name, user_id);
  anomalies.push(...activityAnomalies);

  // 2. Detect failure spikes
  const failureAnomalies = await detectFailureSpikes(project_name, user_id);
  anomalies.push(...failureAnomalies);

  // 3. Detect confidence drops
  const confidenceAnomalies = await detectConfidenceDrops(project_name, user_id);
  anomalies.push(...confidenceAnomalies);

  // 4. Detect pattern deviations
  const patternAnomalies = await detectPatternDeviations(project_name, user_id);
  anomalies.push(...patternAnomalies);

  // 5. Detect memory growth anomalies
  const memoryAnomalies = await detectMemoryGrowthAnomalies(project_name, user_id);
  anomalies.push(...memoryAnomalies);

  // Create alert memories for critical anomalies
  for (const anomaly of anomalies) {
    if (anomaly.severity === 'CRITICAL' || anomaly.severity === 'HIGH') {
      await add_hsg_memory(
        `🚨 ANOMALY DETECTED\n\n` +
        `${anomaly.title}\n\n` +
        `${anomaly.description}\n\n` +
        `Detected: ${anomaly.metric_value.toFixed(2)}\n` +
        `Expected: ${anomaly.expected_value.toFixed(2)}\n` +
        `Deviation: ${anomaly.deviation_percentage.toFixed(0)}%\n\n` +
        `Recommendation: ${anomaly.recommendation}`,
        j(['anomaly-alert', anomaly.type.toLowerCase(), project_name]),
        {
          project_name,
          anomaly_type: anomaly.type,
          severity: anomaly.severity,
          metric_value: anomaly.metric_value,
          deviation: anomaly.deviation_percentage,
          timestamp: new Date().toISOString(),
        },
        user_id,
        'reflective'
      );
      alertsCreated++;
    }
  }

  const report: AnomalyDetectionReport = {
    timestamp: Date.now(),
    project_name,
    user_id,
    anomalies_detected: anomalies.length,
    critical_anomalies: anomalies.filter(a => a.severity === 'CRITICAL').length,
    alerts_created: alertsCreated,
    anomalies,
  };

  // Store anomaly detection report
  await storeAnomalyReport(report);

  return report;
}

/**
 * Detect activity spikes or drops
 */
async function detectActivityAnomalies(
  project_name: string,
  user_id: string
): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];

  // Get action counts over time
  const periods = [
    { name: 'last_24h', start: Date.now() - (24 * 3600000), duration: 1 },
    { name: 'prev_24h', start: Date.now() - (48 * 3600000), duration: 1 },
    { name: 'last_7d_avg', start: Date.now() - (7 * 86400000), duration: 7 },
  ];

  const counts: Record<string, number> = {};

  for (const period of periods) {
    const result = await all_async(
      `SELECT COUNT(*) as count FROM memories
       WHERE primary_sector = 'episodic'
       AND tags LIKE ?
       AND user_id = ?
       AND created_at > ?
       AND created_at <= ?`,
      [
        `%${project_name}%`,
        user_id,
        period.start,
        period.name === 'prev_24h' ? Date.now() - (24 * 3600000) : Date.now(),
      ]
    );
    counts[period.name] = (result[0]?.count || 0) / period.duration;
  }

  // Check for spike (current > 2x average)
  if (counts.last_24h > counts.last_7d_avg * 2 && counts.last_7d_avg > 0) {
    const deviation = ((counts.last_24h - counts.last_7d_avg) / counts.last_7d_avg) * 100;

    anomalies.push({
      anomaly_id: 'activity-spike',
      type: 'ACTIVITY_SPIKE',
      severity: deviation > 300 ? 'HIGH' : 'MEDIUM',
      title: 'Unusual Activity Spike Detected',
      description: `Activity in last 24h (${counts.last_24h.toFixed(1)} actions) is ${deviation.toFixed(0)}% higher than 7-day average`,
      detected_at: Date.now(),
      metric_value: counts.last_24h,
      expected_value: counts.last_7d_avg,
      deviation_percentage: deviation,
      context: 'Recent 24h vs 7-day average',
      recommendation: 'Investigate cause of spike. Could indicate: intense development, repeated attempts, or automated actions.',
      related_memories: [],
    });
  }

  // Check for drop (current < 50% of average)
  if (counts.last_24h < counts.last_7d_avg * 0.5 && counts.last_7d_avg > 2) {
    const deviation = ((counts.last_7d_avg - counts.last_24h) / counts.last_7d_avg) * 100;

    anomalies.push({
      anomaly_id: 'activity-drop',
      type: 'ACTIVITY_DROP',
      severity: deviation > 80 ? 'HIGH' : 'MEDIUM',
      title: 'Unusual Activity Drop Detected',
      description: `Activity in last 24h (${counts.last_24h.toFixed(1)} actions) is ${deviation.toFixed(0)}% lower than 7-day average`,
      detected_at: Date.now(),
      metric_value: counts.last_24h,
      expected_value: counts.last_7d_avg,
      deviation_percentage: deviation,
      context: 'Recent 24h vs 7-day average',
      recommendation: 'Investigate cause of drop. Could indicate: blocker encountered, project paused, or shift to different activities.',
      related_memories: [],
    });
  }

  return anomalies;
}

/**
 * Detect failure spikes
 */
async function detectFailureSpikes(
  project_name: string,
  user_id: string
): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];

  // Get failure rates over time
  const recent24h = await all_async(
    `SELECT COUNT(*) as count FROM memories
     WHERE primary_sector = 'episodic'
     AND tags LIKE ?
     AND user_id = ?
     AND created_at > ?`,
    [`%${project_name}%`, user_id, Date.now() - (24 * 3600000)]
  );

  const recentFailures = await all_async(
    `SELECT id, content FROM memories
     WHERE primary_sector = 'episodic'
     AND tags LIKE ?
     AND user_id = ?
     AND created_at > ?`,
    [`%${project_name}%`, user_id, Date.now() - (24 * 3600000)]
  );

  const failureCount = recentFailures.filter((a: any) => {
    const meta = a.meta ? JSON.parse(a.meta) : {};
    return meta.outcome === 'failure' || meta.outcome === 'error';
  }).length;

  const totalCount = recent24h[0]?.count || 0;
  const failureRate = totalCount > 0 ? failureCount / totalCount : 0;

  // Check historical failure rate (7 days)
  const historical = await all_async(
    `SELECT COUNT(*) as count FROM memories
     WHERE primary_sector = 'episodic'
     AND tags LIKE ?
     AND user_id = ?
     AND created_at BETWEEN ? AND ?`,
    [`%${project_name}%`, user_id, Date.now() - (7 * 86400000), Date.now() - (24 * 3600000)]
  );

  const historicalFailures = await all_async(
    `SELECT id FROM memories
     WHERE primary_sector = 'episodic'
     AND tags LIKE ?
     AND user_id = ?
     AND created_at BETWEEN ? AND ?`,
    [`%${project_name}%`, user_id, Date.now() - (7 * 86400000), Date.now() - (24 * 3600000)]
  );

  const historicalFailureCount = historicalFailures.filter((a: any) => {
    const meta = a.meta ? JSON.parse(a.meta) : {};
    return meta.outcome === 'failure' || meta.outcome === 'error';
  }).length;

  const historicalTotal = historical[0]?.count || 0;
  const historicalRate = historicalTotal > 0 ? historicalFailureCount / historicalTotal : 0;

  if (failureRate > historicalRate * 2 && failureCount >= 3) {
    const deviation = ((failureRate - historicalRate) / Math.max(0.01, historicalRate)) * 100;

    anomalies.push({
      anomaly_id: 'failure-spike',
      type: 'FAILURE_SPIKE',
      severity: failureRate > 0.5 ? 'CRITICAL' : 'HIGH',
      title: 'Failure Rate Spike Detected',
      description: `Failure rate in last 24h (${(failureRate * 100).toFixed(0)}%) is significantly higher than baseline (${(historicalRate * 100).toFixed(0)}%)`,
      detected_at: Date.now(),
      metric_value: failureRate,
      expected_value: historicalRate,
      deviation_percentage: deviation,
      context: `${failureCount} failures out of ${totalCount} actions`,
      recommendation: 'Investigate recent failures. Run failure analysis to identify root causes.',
      related_memories: recentFailures.slice(0, 5).map((f: any) => ({
        id: f.id,
        type: 'failure',
        relevance: 1.0,
      })),
    });
  }

  return anomalies;
}

/**
 * Detect confidence drops
 */
async function detectConfidenceDrops(
  project_name: string,
  user_id: string
): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];

  // Get recent emotions
  const recentEmotions = await all_async(
    `SELECT meta FROM memories
     WHERE primary_sector = 'emotional'
     AND tags LIKE ?
     AND user_id = ?
     AND created_at > ?
     ORDER BY created_at DESC
     LIMIT 20`,
    [`%${project_name}%`, user_id, Date.now() - (24 * 3600000)]
  );

  if (recentEmotions.length >= 5) {
    let totalConfidence = 0;
    let negativeCount = 0;

    for (const emotion of recentEmotions) {
      const meta = emotion.meta ? JSON.parse(emotion.meta) : {};
      totalConfidence += meta.confidence || 0.5;
      if (meta.sentiment === 'negative' || meta.sentiment === 'frustrated') {
        negativeCount++;
      }
    }

    const avgConfidence = totalConfidence / recentEmotions.length;
    const negativeRate = negativeCount / recentEmotions.length;

    if (avgConfidence < 0.4 || negativeRate > 0.6) {
      anomalies.push({
        anomaly_id: 'confidence-drop',
        type: 'CONFIDENCE_DROP',
        severity: avgConfidence < 0.3 ? 'HIGH' : 'MEDIUM',
        title: 'Agent Confidence Drop',
        description: `Average confidence in last 24h is ${(avgConfidence * 100).toFixed(0)}%, with ${(negativeRate * 100).toFixed(0)}% negative sentiment`,
        detected_at: Date.now(),
        metric_value: avgConfidence,
        expected_value: 0.7,
        deviation_percentage: ((0.7 - avgConfidence) / 0.7) * 100,
        context: `${recentEmotions.length} emotional states analyzed`,
        recommendation: 'Low confidence indicates difficulty or uncertainty. Review recent blockers and provide guidance.',
        related_memories: [],
      });
    }
  }

  return anomalies;
}

/**
 * Detect pattern deviations
 */
async function detectPatternDeviations(
  project_name: string,
  user_id: string
): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];

  // Get established patterns
  const patterns = await all_async(
    `SELECT id, content, salience FROM memories
     WHERE primary_sector = 'procedural'
     AND tags LIKE ?
     AND user_id = ?
     AND salience > 0.7
     LIMIT 10`,
    [`%${project_name}%`, user_id]
  );

  // Get recent actions
  const recentActions = await all_async(
    `SELECT content FROM memories
     WHERE primary_sector = 'episodic'
     AND tags LIKE ?
     AND user_id = ?
     AND created_at > ?`,
    [`%${project_name}%`, user_id, Date.now() - (7 * 86400000)]
  );

  // Check if patterns are being used
  for (const pattern of patterns) {
    const patternKeywords = extractKeywords(pattern.content);
    let usageCount = 0;

    for (const action of recentActions) {
      const actionLower = action.content.toLowerCase();
      const matchCount = patternKeywords.filter(kw => actionLower.includes(kw)).length;
      if (matchCount >= 2) usageCount++;
    }

    const usageRate = recentActions.length > 0 ? usageCount / recentActions.length : 0;

    if (usageRate < 0.1 && recentActions.length > 10) {
      // Pattern not being used despite being established
      anomalies.push({
        anomaly_id: `pattern-deviation-${pattern.id}`,
        type: 'PATTERN_DEVIATION',
        severity: 'LOW',
        title: 'Established Pattern Not Being Used',
        description: `High-confidence pattern (${(pattern.salience * 100).toFixed(0)}%) only used in ${(usageRate * 100).toFixed(0)}% of recent actions`,
        detected_at: Date.now(),
        metric_value: usageRate,
        expected_value: 0.3,
        deviation_percentage: ((0.3 - usageRate) / 0.3) * 100,
        context: 'Pattern usage rate vs expectations',
        recommendation: 'Consider if pattern is still relevant or if new approach is emerging.',
        related_memories: [
          {
            id: pattern.id,
            type: 'pattern',
            relevance: 1.0,
          },
        ],
      });
    }
  }

  return anomalies;
}

/**
 * Detect memory growth anomalies
 */
async function detectMemoryGrowthAnomalies(
  project_name: string,
  user_id: string
): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];

  // Get memory counts over time
  const last7days = await all_async(
    `SELECT COUNT(*) as count FROM memories
     WHERE tags LIKE ?
     AND user_id = ?
     AND created_at > ?`,
    [`%${project_name}%`, user_id, Date.now() - (7 * 86400000)]
  );

  const prev7days = await all_async(
    `SELECT COUNT(*) as count FROM memories
     WHERE tags LIKE ?
     AND user_id = ?
     AND created_at BETWEEN ? AND ?`,
    [`%${project_name}%`, user_id, Date.now() - (14 * 86400000), Date.now() - (7 * 86400000)]
  );

  const recent = last7days[0]?.count || 0;
  const previous = prev7days[0]?.count || 0;

  if (recent > previous * 3 && previous > 0) {
    const deviation = ((recent - previous) / previous) * 100;

    anomalies.push({
      anomaly_id: 'memory-growth',
      type: 'MEMORY_GROWTH',
      severity: 'MEDIUM',
      title: 'Unusual Memory Growth',
      description: `Memory creation rate tripled: ${recent} memories in last 7 days vs ${previous} in previous 7 days`,
      detected_at: Date.now(),
      metric_value: recent,
      expected_value: previous,
      deviation_percentage: deviation,
      context: 'Memory creation rate comparison',
      recommendation: 'Review memory consolidation settings. High growth may indicate duplicate or redundant memories.',
      related_memories: [],
    });
  }

  return anomalies;
}

/**
 * Extract keywords from content
 */
function extractKeywords(content: string): string[] {
  return content
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 4)
    .slice(0, 10);
}

/**
 * Store anomaly detection report
 */
async function storeAnomalyReport(report: AnomalyDetectionReport): Promise<void> {
  await run_async(
    `INSERT INTO anomaly_reports (project_name, user_id, timestamp, anomalies_detected, report_data)
     VALUES (?, ?, ?, ?, ?)`,
    [
      report.project_name,
      report.user_id,
      report.timestamp,
      report.anomalies_detected,
      JSON.stringify(report),
    ]
  ).catch(async (err: any) => {
    // Create table if it doesn't exist
    if (err.message.includes('no such table')) {
      await run_async(`
        CREATE TABLE IF NOT EXISTS anomaly_reports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_name TEXT NOT NULL,
          user_id TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          anomalies_detected INTEGER NOT NULL,
          report_data TEXT NOT NULL
        )
      `);
      // Retry
      await run_async(
        `INSERT INTO anomaly_reports (project_name, user_id, timestamp, anomalies_detected, report_data)
         VALUES (?, ?, ?, ?, ?)`,
        [
          report.project_name,
          report.user_id,
          report.timestamp,
          report.anomalies_detected,
          JSON.stringify(report),
        ]
      );
    }
  });
}
