/**
 * Confidence Auto-Adjuster
 *
 * Automatically adjusts confidence (salience) of memories based on multiple signals:
 * success/failure outcomes, usage frequency, age, validation results, coactivations.
 */

import { hsg_query, reinforce_memory } from '../hsg';
import { all_async, run_async } from '../../core/db';
import { j } from '../../utils';

export interface ConfidenceAdjustment {
  memory_id: string;
  memory_type: string;
  content_preview: string;
  old_confidence: number;
  new_confidence: number;
  adjustment: number;
  reason: string;
  signals: {
    success_rate?: number;
    usage_frequency?: number;
    age_penalty?: number;
    validation_boost?: number;
    staleness_penalty?: number;
  };
}

export interface ConfidenceReport {
  timestamp: number;
  project_name: string;
  user_id: string;
  adjustments_made: number;
  average_confidence_before: number;
  average_confidence_after: number;
  adjustments: ConfidenceAdjustment[];
}

/**
 * Auto-adjust confidence for all project memories
 */
export async function autoAdjustConfidence(
  project_name: string,
  user_id: string
): Promise<ConfidenceReport> {
  const allMemories = await all_async(
    `SELECT id, content, meta, salience, coactivations, last_seen_at, created_at, updated_at, primary_sector
     FROM memories
     WHERE tags LIKE ?
     AND user_id = ?
     ORDER BY created_at DESC`,
    [`%${project_name}%`, user_id]
  );

  const adjustments: ConfidenceAdjustment[] = [];
  let totalConfidenceBefore = 0;
  let totalConfidenceAfter = 0;

  for (const memory of allMemories) {
    const oldConfidence = memory.salience || 0.5;
    totalConfidenceBefore += oldConfidence;

    const signals = await calculateSignals(memory);
    const adjustment = calculateAdjustment(signals);

    // Apply adjustment
    let newConfidence = oldConfidence + adjustment;
    newConfidence = Math.max(0.1, Math.min(1.0, newConfidence)); // Clamp to [0.1, 1.0]

    totalConfidenceAfter += newConfidence;

    // Only update if change is significant (> 0.05)
    if (Math.abs(adjustment) > 0.05) {
      await run_async(
        'UPDATE memories SET salience = ? WHERE id = ?',
        [newConfidence, memory.id]
      );

      const reason = generateReason(signals);

      adjustments.push({
        memory_id: memory.id,
        memory_type: memory.primary_sector,
        content_preview: memory.content.substring(0, 80),
        old_confidence: oldConfidence,
        new_confidence: newConfidence,
        adjustment,
        reason,
        signals,
      });
    }
  }

  const avgBefore = allMemories.length > 0 ? totalConfidenceBefore / allMemories.length : 0.5;
  const avgAfter = allMemories.length > 0 ? totalConfidenceAfter / allMemories.length : 0.5;

  const report: ConfidenceReport = {
    timestamp: Date.now(),
    project_name,
    user_id,
    adjustments_made: adjustments.length,
    average_confidence_before: Math.round(avgBefore * 100) / 100,
    average_confidence_after: Math.round(avgAfter * 100) / 100,
    adjustments,
  };

  // Store confidence report
  await storeConfidenceReport(report);

  return report;
}

/**
 * Calculate signals for confidence adjustment
 */
async function calculateSignals(memory: any): Promise<ConfidenceAdjustment['signals']> {
  const signals: ConfidenceAdjustment['signals'] = {};

  const now = Date.now();
  const ageMs = now - memory.created_at;
  const ageDays = ageMs / 86400000;
  const lastSeenMs = memory.last_seen_at || memory.updated_at || memory.created_at;
  const timeSinceLastSeenMs = now - lastSeenMs;
  const daysSinceLastSeen = timeSinceLastSeenMs / 86400000;

  // 1. Usage frequency signal (high = boost, low = reduce)
  const coactivations = memory.coactivations || 0;
  const usageFrequency = coactivations / Math.max(1, ageDays);
  signals.usage_frequency = usageFrequency;

  // 2. Age penalty (older memories gradually lose confidence unless reinforced)
  // Penalty increases after 30 days
  if (ageDays > 30) {
    const ageOverThreshold = ageDays - 30;
    signals.age_penalty = Math.min(0.3, ageOverThreshold / 100);
  }

  // 3. Staleness penalty (not accessed recently)
  // Penalty kicks in after 14 days of no access
  if (daysSinceLastSeen > 14) {
    const staleDays = daysSinceLastSeen - 14;
    signals.staleness_penalty = Math.min(0.25, staleDays / 60);
  }

  // 4. Success rate signal (for patterns and decisions)
  if (memory.primary_sector === 'procedural' || memory.primary_sector === 'reflective') {
    // Get actions linked to this memory
    const linkedActions = await all_async(
      `SELECT m.meta
       FROM memories m
       JOIN waypoints w ON w.dst_id = m.id
       WHERE w.src_id = ?
       AND m.primary_sector = 'episodic'`,
      [memory.id]
    );

    if (linkedActions.length > 0) {
      let successes = 0;
      linkedActions.forEach((action: any) => {
        const meta = action.meta ? JSON.parse(action.meta) : {};
        if (meta.outcome === 'success') successes++;
      });
      signals.success_rate = successes / linkedActions.length;
    }
  }

  // 5. Validation boost (if memory has been validated/reinforced recently)
  if (coactivations > 10 && daysSinceLastSeen < 7) {
    signals.validation_boost = Math.min(0.15, coactivations / 100);
  }

  return signals;
}

/**
 * Calculate confidence adjustment from signals
 */
function calculateAdjustment(signals: ConfidenceAdjustment['signals']): number {
  let adjustment = 0;

  // Positive adjustments
  if (signals.usage_frequency !== undefined) {
    // High usage frequency = boost confidence
    if (signals.usage_frequency > 0.5) {
      adjustment += 0.10;
    } else if (signals.usage_frequency > 0.2) {
      adjustment += 0.05;
    }
  }

  if (signals.success_rate !== undefined) {
    // High success rate = boost confidence
    if (signals.success_rate >= 0.8) {
      adjustment += 0.15;
    } else if (signals.success_rate >= 0.6) {
      adjustment += 0.08;
    } else if (signals.success_rate < 0.4) {
      // Low success rate = reduce confidence
      adjustment -= 0.12;
    }
  }

  if (signals.validation_boost !== undefined) {
    adjustment += signals.validation_boost;
  }

  // Negative adjustments
  if (signals.age_penalty !== undefined) {
    adjustment -= signals.age_penalty;
  }

  if (signals.staleness_penalty !== undefined) {
    adjustment -= signals.staleness_penalty;
  }

  return adjustment;
}

/**
 * Generate human-readable reason for adjustment
 */
function generateReason(signals: ConfidenceAdjustment['signals']): string {
  const reasons: string[] = [];

  if (signals.success_rate !== undefined) {
    if (signals.success_rate >= 0.8) {
      reasons.push(`High success rate (${(signals.success_rate * 100).toFixed(0)}%)`);
    } else if (signals.success_rate < 0.4) {
      reasons.push(`Low success rate (${(signals.success_rate * 100).toFixed(0)}%)`);
    }
  }

  if (signals.usage_frequency !== undefined && signals.usage_frequency > 0.2) {
    reasons.push(`Frequently used (${signals.usage_frequency.toFixed(2)}/day)`);
  }

  if (signals.age_penalty !== undefined) {
    reasons.push(`Age penalty (old memory)`);
  }

  if (signals.staleness_penalty !== undefined) {
    reasons.push(`Staleness penalty (not accessed recently)`);
  }

  if (signals.validation_boost !== undefined) {
    reasons.push(`Validation boost (recently reinforced)`);
  }

  if (reasons.length === 0) {
    return 'Minor adjustment based on overall metrics';
  }

  return reasons.join(', ');
}

/**
 * Get confidence distribution for project
 */
export async function getConfidenceDistribution(
  project_name: string,
  user_id: string
): Promise<any> {
  const memories = await all_async(
    `SELECT salience, primary_sector FROM memories
     WHERE tags LIKE ?
     AND user_id = ?`,
    [`%${project_name}%`, user_id]
  );

  const distribution = {
    total: memories.length,
    by_range: {
      very_low: 0,   // 0.0 - 0.3
      low: 0,        // 0.3 - 0.5
      medium: 0,     // 0.5 - 0.7
      high: 0,       // 0.7 - 0.9
      very_high: 0,  // 0.9 - 1.0
    },
    by_sector: {} as Record<string, { average: number; count: number }>,
    average_overall: 0,
  };

  let totalConfidence = 0;

  for (const memory of memories) {
    const confidence = memory.salience || 0.5;
    totalConfidence += confidence;

    // By range
    if (confidence < 0.3) distribution.by_range.very_low++;
    else if (confidence < 0.5) distribution.by_range.low++;
    else if (confidence < 0.7) distribution.by_range.medium++;
    else if (confidence < 0.9) distribution.by_range.high++;
    else distribution.by_range.very_high++;

    // By sector
    const sector = memory.primary_sector;
    if (!distribution.by_sector[sector]) {
      distribution.by_sector[sector] = { average: 0, count: 0 };
    }
    distribution.by_sector[sector].average += confidence;
    distribution.by_sector[sector].count++;
  }

  // Calculate averages
  distribution.average_overall = memories.length > 0 ? totalConfidence / memories.length : 0.5;

  for (const sector in distribution.by_sector) {
    const data = distribution.by_sector[sector];
    data.average = data.count > 0 ? data.average / data.count : 0.5;
    data.average = Math.round(data.average * 100) / 100;
  }

  distribution.average_overall = Math.round(distribution.average_overall * 100) / 100;

  return distribution;
}

/**
 * Store confidence report
 */
async function storeConfidenceReport(report: ConfidenceReport): Promise<void> {
  await run_async(
    `INSERT INTO confidence_reports (project_name, user_id, timestamp, adjustments_made, report_data)
     VALUES (?, ?, ?, ?, ?)`,
    [
      report.project_name,
      report.user_id,
      report.timestamp,
      report.adjustments_made,
      JSON.stringify(report),
    ]
  ).catch(async (err: any) => {
    // Create table if it doesn't exist
    if (err.message.includes('no such table')) {
      await run_async(`
        CREATE TABLE IF NOT EXISTS confidence_reports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_name TEXT NOT NULL,
          user_id TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          adjustments_made INTEGER NOT NULL,
          report_data TEXT NOT NULL
        )
      `);
      // Retry
      await run_async(
        `INSERT INTO confidence_reports (project_name, user_id, timestamp, adjustments_made, report_data)
         VALUES (?, ?, ?, ?, ?)`,
        [
          report.project_name,
          report.user_id,
          report.timestamp,
          report.adjustments_made,
          JSON.stringify(report),
        ]
      );
    }
  });
}
