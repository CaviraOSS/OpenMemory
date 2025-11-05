/**
 * Memory Consolidator
 *
 * Identifies duplicate/similar memories, merges them into stronger consolidated memories,
 * transfers waypoints, and cleans up low-value memories.
 */

import { hsg_query, reinforce_memory } from '../hsg';
import { all_async, run_async } from '../../core/db';
import { add_hsg_memory } from '../hsg';
import { j } from '../../utils';

export interface ConsolidationAction {
  action_type: 'MERGE' | 'ARCHIVE' | 'DELETE';
  source_memory_ids: string[];
  target_memory_id?: string;
  reason: string;
  confidence_transferred: number;
  waypoints_transferred: number;
}

export interface ConsolidationReport {
  timestamp: number;
  project_name: string;
  user_id: string;
  memories_before: number;
  memories_after: number;
  memories_merged: number;
  memories_archived: number;
  memories_deleted: number;
  actions: ConsolidationAction[];
}

/**
 * Consolidate memories for a project
 */
export async function consolidateMemories(
  project_name: string,
  user_id: string,
  options: {
    merge_threshold?: number;  // Similarity threshold for merging (0-1)
    archive_threshold?: number; // Confidence below which to archive (0-1)
    min_age_days?: number;     // Minimum age before considering for consolidation
  } = {}
): Promise<ConsolidationReport> {
  const {
    merge_threshold = 0.85,
    archive_threshold = 0.15,
    min_age_days = 7,
  } = options;

  const minAge = Date.now() - (min_age_days * 86400000);

  // Get all project memories (excluding very recent ones)
  const memories = await all_async(
    `SELECT id, content, meta, salience, coactivations, created_at, primary_sector, tags, embedding
     FROM memories
     WHERE tags LIKE ?
     AND user_id = ?
     AND created_at < ?
     ORDER BY primary_sector, created_at DESC`,
    [`%${project_name}%`, user_id, minAge]
  );

  const memoriesBeforeCount = memories.length;
  const actions: ConsolidationAction[] = [];

  // Group by sector for efficiency
  const bySector: Record<string, any[]> = {};
  for (const memory of memories) {
    const sector = memory.primary_sector;
    if (!bySector[sector]) bySector[sector] = [];
    bySector[sector].push(memory);
  }

  const mergedIds = new Set<string>();

  // 1. MERGE: Find and merge similar memories within each sector
  for (const sector in bySector) {
    const sectorMemories = bySector[sector];

    for (let i = 0; i < sectorMemories.length; i++) {
      if (mergedIds.has(sectorMemories[i].id)) continue;

      const candidates: any[] = [];

      for (let j = i + 1; j < sectorMemories.length; j++) {
        if (mergedIds.has(sectorMemories[j].id)) continue;

        const similarity = calculateSimilarity(
          sectorMemories[i].content,
          sectorMemories[j].content
        );

        if (similarity >= merge_threshold) {
          candidates.push(sectorMemories[j]);
        }
      }

      // If we found duplicates, merge them
      if (candidates.length > 0) {
        const primary = sectorMemories[i];
        const duplicates = candidates;

        const mergeResult = await mergeDuplicates(primary, duplicates, user_id);

        mergedIds.add(primary.id);
        duplicates.forEach(dup => mergedIds.add(dup.id));

        actions.push({
          action_type: 'MERGE',
          source_memory_ids: duplicates.map(d => d.id),
          target_memory_id: mergeResult.target_id,
          reason: `Merged ${duplicates.length} duplicate memories (similarity >= ${merge_threshold})`,
          confidence_transferred: mergeResult.confidence_transferred,
          waypoints_transferred: mergeResult.waypoints_transferred,
        });
      }
    }
  }

  // 2. ARCHIVE: Archive very low confidence memories that are old and unused
  const staleThreshold = Date.now() - (90 * 86400000); // 90 days

  for (const memory of memories) {
    if (mergedIds.has(memory.id)) continue; // Skip already merged

    const confidence = memory.salience || 0.5;
    const coactivations = memory.coactivations || 0;
    const isStale = memory.created_at < staleThreshold;

    if (confidence < archive_threshold && coactivations < 2 && isStale) {
      // Archive this memory (reduce salience to 0.05 but don't delete)
      await run_async(
        'UPDATE memories SET salience = 0.05 WHERE id = ?',
        [memory.id]
      );

      actions.push({
        action_type: 'ARCHIVE',
        source_memory_ids: [memory.id],
        reason: `Low confidence (${confidence.toFixed(2)}), unused (${coactivations}), stale (90+ days)`,
        confidence_transferred: 0,
        waypoints_transferred: 0,
      });
    }
  }

  // 3. DELETE: Delete orphaned waypoints (pointing to non-existent memories)
  const orphanedWaypoints = await all_async(
    `SELECT w.src_id, w.dst_id
     FROM waypoints w
     LEFT JOIN memories m1 ON w.src_id = m1.id
     LEFT JOIN memories m2 ON w.dst_id = m2.id
     WHERE m1.id IS NULL OR m2.id IS NULL`
  );

  if (orphanedWaypoints.length > 0) {
    await run_async(
      `DELETE FROM waypoints
       WHERE src_id IN (SELECT w.src_id FROM waypoints w LEFT JOIN memories m ON w.src_id = m.id WHERE m.id IS NULL)
       OR dst_id IN (SELECT w.dst_id FROM waypoints w LEFT JOIN memories m ON w.dst_id = m.id WHERE m.id IS NULL)`
    );

    actions.push({
      action_type: 'DELETE',
      source_memory_ids: orphanedWaypoints.map(w => w.src_id),
      reason: `Deleted ${orphanedWaypoints.length} orphaned waypoint links`,
      confidence_transferred: 0,
      waypoints_transferred: 0,
    });
  }

  // Count remaining memories
  const memoriesAfter = await all_async(
    `SELECT COUNT(*) as count FROM memories
     WHERE tags LIKE ?
     AND user_id = ?
     AND salience > 0.1`,
    [`%${project_name}%`, user_id]
  );

  const memoriesAfterCount = memoriesAfter[0]?.count || memoriesBeforeCount;

  const report: ConsolidationReport = {
    timestamp: Date.now(),
    project_name,
    user_id,
    memories_before: memoriesBeforeCount,
    memories_after: memoriesAfterCount,
    memories_merged: actions.filter(a => a.action_type === 'MERGE').length,
    memories_archived: actions.filter(a => a.action_type === 'ARCHIVE').length,
    memories_deleted: actions.filter(a => a.action_type === 'DELETE').length,
    actions,
  };

  // Store consolidation report
  await storeConsolidationReport(report);

  return report;
}

/**
 * Merge duplicate memories into a consolidated memory
 */
async function mergeDuplicates(
  primary: any,
  duplicates: any[],
  user_id: string
): Promise<{ target_id: string; confidence_transferred: number; waypoints_transferred: number }> {
  // Calculate combined confidence (sum of saliences, capped at 1.0)
  let combinedConfidence = primary.salience || 0.5;
  for (const dup of duplicates) {
    combinedConfidence += (dup.salience || 0.5) * 0.3; // 30% of duplicate's confidence
  }
  combinedConfidence = Math.min(1.0, combinedConfidence);

  // Calculate combined coactivations
  let combinedCoactivations = primary.coactivations || 0;
  for (const dup of duplicates) {
    combinedCoactivations += dup.coactivations || 0;
  }

  // Update primary memory with combined values
  await run_async(
    'UPDATE memories SET salience = ?, coactivations = ? WHERE id = ?',
    [combinedConfidence, combinedCoactivations, primary.id]
  );

  // Transfer all waypoints from duplicates to primary
  let waypointsTransferred = 0;
  for (const dup of duplicates) {
    // Transfer outgoing waypoints (where dup is source)
    await run_async(
      `UPDATE waypoints SET src_id = ?
       WHERE src_id = ?
       AND NOT EXISTS (
         SELECT 1 FROM waypoints w2
         WHERE w2.src_id = ? AND w2.dst_id = waypoints.dst_id
       )`,
      [primary.id, dup.id, primary.id]
    );

    // Transfer incoming waypoints (where dup is destination)
    await run_async(
      `UPDATE waypoints SET dst_id = ?
       WHERE dst_id = ?
       AND NOT EXISTS (
         SELECT 1 FROM waypoints w2
         WHERE w2.src_id = waypoints.src_id AND w2.dst_id = ?
       )`,
      [primary.id, dup.id, primary.id]
    );

    const transferred = await all_async(
      'SELECT COUNT(*) as count FROM waypoints WHERE src_id = ? OR dst_id = ?',
      [primary.id, primary.id]
    );
    waypointsTransferred += transferred[0]?.count || 0;

    // Mark duplicate as merged (set salience to 0.01)
    await run_async(
      'UPDATE memories SET salience = 0.01 WHERE id = ?',
      [dup.id]
    );
  }

  const confidenceTransferred = combinedConfidence - (primary.salience || 0.5);

  return {
    target_id: primary.id,
    confidence_transferred: confidenceTransferred,
    waypoints_transferred: waypointsTransferred,
  };
}

/**
 * Calculate similarity between two content strings (simple token-based)
 */
function calculateSimilarity(content1: string, content2: string): number {
  const normalize = (str: string) =>
    str.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3); // Filter short words

  const tokens1 = new Set(normalize(content1));
  const tokens2 = new Set(normalize(content2));

  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  // Jaccard similarity
  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);

  return intersection.size / union.size;
}

/**
 * Get consolidation statistics for a project
 */
export async function getConsolidationStats(
  project_name: string,
  user_id: string
): Promise<any> {
  const memories = await all_async(
    `SELECT salience, coactivations, created_at, primary_sector
     FROM memories
     WHERE tags LIKE ?
     AND user_id = ?`,
    [`%${project_name}%`, user_id]
  );

  const now = Date.now();
  const stats = {
    total_memories: memories.length,
    active_memories: 0,      // salience > 0.3
    archived_memories: 0,    // salience < 0.1
    stale_memories: 0,       // not accessed in 90+ days
    highly_used: 0,          // coactivations > 10
    candidates_for_merge: 0, // Will estimate
    by_sector: {} as Record<string, number>,
  };

  for (const memory of memories) {
    const confidence = memory.salience || 0.5;
    const coactivations = memory.coactivations || 0;
    const ageDays = (now - memory.created_at) / 86400000;

    if (confidence > 0.3) stats.active_memories++;
    if (confidence < 0.1) stats.archived_memories++;
    if (ageDays > 90) stats.stale_memories++;
    if (coactivations > 10) stats.highly_used++;

    const sector = memory.primary_sector;
    stats.by_sector[sector] = (stats.by_sector[sector] || 0) + 1;
  }

  return stats;
}

/**
 * Store consolidation report
 */
async function storeConsolidationReport(report: ConsolidationReport): Promise<void> {
  await run_async(
    `INSERT INTO consolidation_reports (project_name, user_id, timestamp, memories_merged, report_data)
     VALUES (?, ?, ?, ?, ?)`,
    [
      report.project_name,
      report.user_id,
      report.timestamp,
      report.memories_merged,
      JSON.stringify(report),
    ]
  ).catch(async (err: any) => {
    // Create table if it doesn't exist
    if (err.message.includes('no such table')) {
      await run_async(`
        CREATE TABLE IF NOT EXISTS consolidation_reports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_name TEXT NOT NULL,
          user_id TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          memories_merged INTEGER NOT NULL,
          report_data TEXT NOT NULL
        )
      `);
      // Retry
      await run_async(
        `INSERT INTO consolidation_reports (project_name, user_id, timestamp, memories_merged, report_data)
         VALUES (?, ?, ?, ?, ?)`,
        [
          report.project_name,
          report.user_id,
          report.timestamp,
          report.memories_merged,
          JSON.stringify(report),
        ]
      );
    }
  });
}
