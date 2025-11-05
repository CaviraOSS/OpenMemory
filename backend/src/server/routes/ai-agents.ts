/**
 * AI Agents Integration Routes
 *
 * Provides specialized endpoints for AI autonomous development system integration
 * Stores project state, agent context, development history, and patterns in OpenMemory
 */

import { add_hsg_memory, hsg_query, reinforce_memory } from '../../memory/hsg';
import { now, j } from '../../utils';
import { run_async, q, all_async } from '../../core/db';
import { validateConsistency } from '../../memory/validators/consistency';
import { trackPatternEffectiveness } from '../../memory/validators/pattern-effectiveness';
import { assessDecisionQuality } from '../../memory/validators/decision-quality';
import { analyzeFailures, getLessonsLearned } from '../../memory/self-correction/failure-analyzer';
import { autoAdjustConfidence, getConfidenceDistribution } from '../../memory/self-correction/confidence-adjuster';
import { consolidateMemories, getConsolidationStats } from '../../memory/self-correction/memory-consolidator';
import { detectPotentialConflicts } from '../../memory/proactive/conflict-detector';
import { predictBlockers } from '../../memory/proactive/blocker-predictor';
import { generateRecommendations } from '../../memory/proactive/context-recommender';
import { extractSuccessPatterns, getLearningStats } from '../../memory/learning/success-pattern-extractor';
import { runQualityGate, getQualityTrends } from '../../memory/quality/code-quality-gate';
import { detectAnomalies } from '../../memory/quality/anomaly-detector';

export function aiagents(app: any) {
  /**
   * Store project state in OpenMemory
   * POST /ai-agents/state
   */
  app.post('/ai-agents/state', async (req: any, res: any) => {
    try {
      const { project_name, state, user_id = 'ai-agent-system' } = req.body;

      if (!project_name || !state) {
        return res.status(400).json({ err: 'project_name and state required' });
      }

      // Store the entire project state as a semantic memory
      const content = `Project: ${project_name}\nState: ${JSON.stringify(state, null, 2)}`;
      const tags = j(['project-state', 'ai-agents', project_name]);
      const metadata = {
        project_name,
        phase: state.project_metadata?.current_phase,
        progress: state.project_metadata?.progress_percentage,
        timestamp: new Date().toISOString(),
      };

      const result = await add_hsg_memory(content, tags, metadata, user_id, 'semantic');

      res.json({
        success: true,
        memory_id: result.id,
        message: 'Project state stored in OpenMemory',
      });
    } catch (error: any) {
      console.error('[ai-agents] Error storing project state:', error);
      res.status(500).json({ err: error.message });
    }
  });

  /**
   * Retrieve project state from OpenMemory
   * GET /ai-agents/state/:project_name
   */
  app.get('/ai-agents/state/:project_name', async (req: any, res: any) => {
    try {
      const { project_name } = req.params;
      const { user_id = 'ai-agent-system' } = req.query;

      const results = await hsg_query(
        `Project state for ${project_name}`,
        1,
        {
          sectors: ['semantic'],
          user_id: user_id as string
        }
      );

      if (results.length === 0) {
        return res.status(404).json({
          err: 'not_found',
          mode: 'INITIALIZE',
        });
      }

      // Parse the stored state from content
      const memory = results[0];
      const stateMatch = memory.content.match(/State: ([\s\S]+)$/);
      const state = stateMatch ? JSON.parse(stateMatch[1]) : null;

      res.json({
        success: true,
        mode: 'RESUME',
        state,
        memory_id: memory.id,
        last_updated: memory.updated_at,
      });
    } catch (error: any) {
      console.error('[ai-agents] Error retrieving project state:', error);
      res.status(500).json({ err: error.message });
    }
  });

  /**
   * Store agent action/decision in episodic memory
   * POST /ai-agents/action
   */
  app.post('/ai-agents/action', async (req: any, res: any) => {
    try {
      const {
        project_name,
        agent_name,
        action,
        context,
        outcome,
        related_decision,  // NEW: decision memory ID that led to this action
        used_pattern,      // NEW: pattern memory ID used in this action
        user_id = 'ai-agent-system',
      } = req.body;

      if (!project_name || !agent_name || !action) {
        return res.status(400).json({ err: 'project_name, agent_name, and action required' });
      }

      const content = `Agent ${agent_name} performed: ${action}\nContext: ${context || 'N/A'}\nOutcome: ${outcome || 'pending'}`;
      const tags = j(['agent-action', project_name, agent_name]);
      const metadata = {
        project_name,
        agent_name,
        action,
        context,
        outcome,
        related_decision,
        used_pattern,
        timestamp: new Date().toISOString(),
      };

      const result = await add_hsg_memory(content, tags, metadata, user_id, 'episodic');

      // NEW: Automatically create waypoints for linked memories
      const links: any = { decision: null, pattern: null };
      if (related_decision) {
        await run_async(
          `INSERT OR REPLACE INTO waypoints (src_id, dst_id, weight, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          [related_decision, result.id, 0.85, Date.now(), Date.now()]
        );
        links.decision = related_decision;
      }
      if (used_pattern) {
        await run_async(
          `INSERT OR REPLACE INTO waypoints (src_id, dst_id, weight, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          [used_pattern, result.id, 0.75, Date.now(), Date.now()]
        );
        links.pattern = used_pattern;
      }

      res.json({
        success: true,
        memory_id: result.id,
        message: 'Agent action recorded' + (related_decision || used_pattern ? ' with links' : ''),
        links,
      });
    } catch (error: any) {
      console.error('[ai-agents] Error storing agent action:', error);
      res.status(500).json({ err: error.message });
    }
  });

  /**
   * Store coding pattern or best practice
   * POST /ai-agents/pattern
   */
  app.post('/ai-agents/pattern', async (req: any, res: any) => {
    try {
      const {
        project_name,
        pattern_name,
        description,
        example,
        tags: userTags = [],
        user_id = 'ai-agent-system',
      } = req.body;

      if (!project_name || !pattern_name || !description) {
        return res.status(400).json({ err: 'project_name, pattern_name, and description required' });
      }

      const content = `Pattern: ${pattern_name}\n${description}${example ? `\n\nExample:\n${example}` : ''}`;
      const tags = j(['coding-pattern', project_name, ...userTags]);
      const metadata = {
        project_name,
        pattern_name,
        timestamp: new Date().toISOString(),
      };

      const result = await add_hsg_memory(content, tags, metadata, user_id, 'procedural');

      res.json({
        success: true,
        memory_id: result.id,
        message: 'Coding pattern stored',
      });
    } catch (error: any) {
      console.error('[ai-agents] Error storing pattern:', error);
      res.status(500).json({ err: error.message });
    }
  });

  /**
   * Store architectural decision
   * POST /ai-agents/decision
   */
  app.post('/ai-agents/decision', async (req: any, res: any) => {
    try {
      const {
        project_name,
        decision,
        rationale,
        alternatives,
        consequences,
        user_id = 'ai-agent-system',
      } = req.body;

      if (!project_name || !decision || !rationale) {
        return res.status(400).json({ err: 'project_name, decision, and rationale required' });
      }

      const content = `Decision: ${decision}\n\nRationale: ${rationale}${
        alternatives ? `\n\nAlternatives considered: ${alternatives}` : ''
      }${consequences ? `\n\nConsequences: ${consequences}` : ''}`;
      const tags = j(['architectural-decision', project_name]);
      const metadata = {
        project_name,
        decision,
        timestamp: new Date().toISOString(),
      };

      const result = await add_hsg_memory(content, tags, metadata, user_id, 'reflective');

      res.json({
        success: true,
        memory_id: result.id,
        message: 'Architectural decision recorded',
      });
    } catch (error: any) {
      console.error('[ai-agents] Error storing decision:', error);
      res.status(500).json({ err: error.message });
    }
  });

  /**
   * Query project memories by type
   * POST /ai-agents/query
   */
  app.post('/ai-agents/query', async (req: any, res: any) => {
    try {
      const {
        project_name,
        query,
        memory_type = 'all',
        k = 10,
        user_id = 'ai-agent-system',
      } = req.body;

      if (!project_name || !query) {
        return res.status(400).json({ err: 'project_name and query required' });
      }

      const sectorMap: Record<string, string[]> = {
        state: ['semantic'],
        actions: ['episodic'],
        patterns: ['procedural'],
        decisions: ['reflective'],
        all: ['semantic', 'episodic', 'procedural', 'reflective'],
      };

      const sectors = sectorMap[memory_type] || sectorMap.all;
      const results = await hsg_query(query, k, {
        sectors,
        user_id
      });

      res.json({
        success: true,
        results,
        count: results.length,
      });
    } catch (error: any) {
      console.error('[ai-agents] Error querying project memories:', error);
      res.status(500).json({ err: error.message });
    }
  });

  /**
   * Get project development history
   * GET /ai-agents/history/:project_name
   */
  app.get('/ai-agents/history/:project_name', async (req: any, res: any) => {
    try {
      const { project_name } = req.params;
      const { limit = 50, user_id = 'ai-agent-system' } = req.query;

      const results = await hsg_query(
        `development history for ${project_name}`,
        parseInt(limit as string, 10),
        {
          sectors: ['episodic'],
          user_id: user_id as string
        }
      );

      res.json({
        success: true,
        history: results,
        count: results.length,
      });
    } catch (error: any) {
      console.error('[ai-agents] Error retrieving history:', error);
      res.status(500).json({ err: error.message });
    }
  });

  /**
   * Get all patterns for a project
   * GET /ai-agents/patterns/:project_name
   */
  app.get('/ai-agents/patterns/:project_name', async (req: any, res: any) => {
    try {
      const { project_name } = req.params;
      const { user_id = 'ai-agent-system' } = req.query;

      const results = await hsg_query(
        `coding patterns for ${project_name}`,
        100,
        {
          sectors: ['procedural'],
          user_id: user_id as string
        }
      );

      res.json({
        success: true,
        patterns: results,
        count: results.length,
      });
    } catch (error: any) {
      console.error('[ai-agents] Error retrieving patterns:', error);
      res.status(500).json({ err: error.message });
    }
  });

  /**
   * Get architectural decisions for a project
   * GET /ai-agents/decisions/:project_name
   */
  app.get('/ai-agents/decisions/:project_name', async (req: any, res: any) => {
    try {
      const { project_name } = req.params;
      const { user_id = 'ai-agent-system' } = req.query;

      const results = await hsg_query(
        `architectural decisions for ${project_name}`,
        100,
        {
          sectors: ['reflective'],
          user_id: user_id as string
        }
      );

      res.json({
        success: true,
        decisions: results,
        count: results.length,
      });
    } catch (error: any) {
      console.error('[ai-agents] Error retrieving decisions:', error);
      res.status(500).json({ err: error.message });
    }
  });

  /**
   * Reinforce a memory (mark as important)
   * POST /ai-agents/reinforce/:memory_id
   */
  app.post('/ai-agents/reinforce/:memory_id', async (req: any, res: any) => {
    try {
      const { memory_id } = req.params;
      const { boost = 0.2 } = req.body;

      await reinforce_memory(memory_id, boost);

      res.json({
        success: true,
        message: 'Memory reinforced',
      });
    } catch (error: any) {
      console.error('[ai-agents] Error reinforcing memory:', error);
      res.status(500).json({ err: error.message });
    }
  });

  /**
   * Get comprehensive project context for AI agents
   * GET /ai-agents/context/:project_name
   */
  app.get('/ai-agents/context/:project_name', async (req: any, res: any) => {
    try {
      const { project_name } = req.params;
      const { user_id = 'ai-agent-system' } = req.query;

      // Get current state
      const stateResults = await hsg_query(
        `Project state for ${project_name}`,
        1,
        {
          sectors: ['semantic'],
          user_id: user_id as string
        }
      );

      // Get recent actions
      const recentActions = await hsg_query(
        `recent development for ${project_name}`,
        20,
        {
          sectors: ['episodic'],
          user_id: user_id as string
        }
      );

      // Get patterns
      const patterns = await hsg_query(
        `coding patterns for ${project_name}`,
        10,
        {
          sectors: ['procedural'],
          user_id: user_id as string
        }
      );

      // Get decisions
      const decisions = await hsg_query(
        `architectural decisions for ${project_name}`,
        10,
        {
          sectors: ['reflective'],
          user_id: user_id as string
        }
      );

      const state = stateResults.length > 0
        ? JSON.parse(stateResults[0].content.match(/State: ([\s\S]+)$/)?.[1] || '{}')
        : null;

      res.json({
        success: true,
        context: {
          state,
          recent_actions: recentActions,
          patterns,
          decisions,
          mode: state ? 'RESUME' : 'INITIALIZE',
        },
      });
    } catch (error: any) {
      console.error('[ai-agents] Error retrieving context:', error);
      res.status(500).json({ err: error.message });
    }
  });

  // ============================================================================
  // NEW ENDPOINTS: Emotional Memory, Waypoints, Pattern Detection, Smart Reinforcement
  // ============================================================================

  /**
   * Record agent emotional state/sentiment
   * POST /ai-agents/emotion
   */
  app.post('/ai-agents/emotion', async (req: any, res: any) => {
    try {
      const {
        project_name,
        agent_name,
        context,
        sentiment,      // positive, negative, neutral, frustrated, confident
        confidence,     // 0.0 - 1.0
        feeling,        // "This feels right", "Stuck on this", "Very confident"
        related_action, // Optional: link to action ID
        user_id = 'ai-agent-system',
      } = req.body;

      if (!project_name || !agent_name || !feeling) {
        return res.status(400).json({ err: 'project_name, agent_name, and feeling required' });
      }

      const content = `Agent ${agent_name} feels: ${feeling}\nContext: ${context || 'N/A'}\nSentiment: ${sentiment || 'neutral'}\nConfidence: ${confidence !== undefined ? confidence : 0.5}`;
      const tags = j(['agent-emotion', project_name, agent_name, sentiment || 'neutral']);
      const metadata = {
        project_name,
        agent_name,
        sentiment: sentiment || 'neutral',
        confidence: confidence !== undefined ? confidence : 0.5,
        related_action,
        timestamp: new Date().toISOString(),
      };

      const result = await add_hsg_memory(content, tags, metadata, user_id, 'emotional');

      // Link to related action if provided
      if (related_action) {
        await run_async(
          `INSERT OR REPLACE INTO waypoints (src_id, dst_id, weight, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          [related_action, result.id, 0.70, Date.now(), Date.now()]
        );
      }

      res.json({
        success: true,
        memory_id: result.id,
        message: 'Emotional state recorded',
      });
    } catch (error: any) {
      console.error('[ai-agents] Error storing emotion:', error);
      res.status(500).json({ err: error.message });
    }
  });

  /**
   * Get emotional timeline for project
   * GET /ai-agents/emotions/:project_name
   */
  app.get('/ai-agents/emotions/:project_name', async (req: any, res: any) => {
    try {
      const { project_name } = req.params;
      const { limit = 50, user_id = 'ai-agent-system' } = req.query;

      const results = await hsg_query(
        `emotional state for ${project_name}`,
        parseInt(limit as string, 10),
        {
          sectors: ['emotional'],
          user_id: user_id as string
        }
      );

      res.json({
        success: true,
        emotions: results,
        count: results.length,
      });
    } catch (error: any) {
      console.error('[ai-agents] Error retrieving emotions:', error);
      res.status(500).json({ err: error.message });
    }
  });

  /**
   * Analyze sentiment trends
   * GET /ai-agents/sentiment/:project_name
   */
  app.get('/ai-agents/sentiment/:project_name', async (req: any, res: any) => {
    try {
      const { project_name } = req.params;
      const { user_id = 'ai-agent-system' } = req.query;

      const emotions = await hsg_query(
        `emotional state for ${project_name}`,
        100,
        {
          sectors: ['emotional'],
          user_id: user_id as string
        }
      );

      if (emotions.length === 0) {
        return res.json({
          success: true,
          trend: 'neutral',
          average_confidence: 0.5,
          sample_size: 0,
        });
      }

      let positive = 0, negative = 0;
      let totalConfidence = 0;

      emotions.forEach((e: any) => {
        const sentiment = e.meta?.sentiment || 'neutral';
        if (sentiment === 'positive' || sentiment === 'confident') positive++;
        else if (sentiment === 'negative' || sentiment === 'frustrated') negative++;
        totalConfidence += e.meta?.confidence || 0.5;
      });

      const avgConfidence = totalConfidence / emotions.length;
      let trend = 'neutral';
      if (positive > negative * 1.5) trend = 'positive';
      else if (negative > positive * 1.5) trend = 'negative';

      res.json({
        success: true,
        trend,
        average_confidence: Math.round(avgConfidence * 100) / 100,
        positive_count: positive,
        negative_count: negative,
        neutral_count: emotions.length - positive - negative,
        sample_size: emotions.length,
        recent_emotions: emotions.slice(0, 5),
      });
    } catch (error: any) {
      console.error('[ai-agents] Error analyzing sentiment:', error);
      res.status(500).json({ err: error.message });
    }
  });

  /**
   * Link two memories (create waypoint)
   * POST /ai-agents/link
   */
  app.post('/ai-agents/link', async (req: any, res: any) => {
    try {
      const {
        source_memory_id,
        target_memory_id,
        weight = 0.8,
        relationship,  // "led_to", "resulted_in", "used", "informed_by"
      } = req.body;

      if (!source_memory_id || !target_memory_id) {
        return res.status(400).json({ err: 'source_memory_id and target_memory_id required' });
      }

      await run_async(
        `INSERT OR REPLACE INTO waypoints (src_id, dst_id, weight, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [source_memory_id, target_memory_id, weight, Date.now(), Date.now()]
      );

      res.json({
        success: true,
        message: `Linked ${source_memory_id} → ${target_memory_id}`,
        relationship,
        weight,
      });
    } catch (error: any) {
      console.error('[ai-agents] Error creating link:', error);
      res.status(500).json({ err: error.message });
    }
  });

  /**
   * Get memory graph (waypoints) for a memory
   * GET /ai-agents/graph/:memory_id
   */
  app.get('/ai-agents/graph/:memory_id', async (req: any, res: any) => {
    try {
      const { memory_id } = req.params;
      const { depth = 2 } = req.query;

      // Recursive traversal of waypoint graph
      const query = `
        WITH RECURSIVE traverse(id, depth, path) AS (
          SELECT ? AS id, 0 AS depth, ? AS path
          UNION ALL
          SELECT w.dst_id, t.depth + 1, t.path || ',' || w.dst_id
          FROM traverse t
          JOIN waypoints w ON w.src_id = t.id
          WHERE t.depth < ? AND instr(t.path, w.dst_id) = 0
        )
        SELECT DISTINCT m.*, t.depth, w.weight
        FROM traverse t
        JOIN memories m ON m.id = t.id
        LEFT JOIN waypoints w ON w.src_id = ? AND w.dst_id = t.id
        ORDER BY t.depth, m.created_at DESC
      `;

      const waypoints = await all_async(query, [memory_id, memory_id, parseInt(depth as string, 10), memory_id]);

      res.json({
        success: true,
        root: memory_id,
        waypoints,
        depth: parseInt(depth as string, 10),
        count: waypoints.length,
      });
    } catch (error: any) {
      console.error('[ai-agents] Error retrieving graph:', error);
      res.status(500).json({ err: error.message });
    }
  });

  /**
   * Smart reinforcement based on success/usage
   * POST /ai-agents/smart-reinforce
   */
  app.post('/ai-agents/smart-reinforce', async (req: any, res: any) => {
    try {
      const {
        memory_id,
        reason,  // success, frequent_use, critical_decision, reference
        boost,
      } = req.body;

      if (!memory_id || !reason) {
        return res.status(400).json({ err: 'memory_id and reason required' });
      }

      // Different boost amounts based on reason
      const boostMap: Record<string, number> = {
        success: 0.20,           // Pattern/decision led to success
        frequent_use: 0.15,      // Frequently accessed pattern
        critical_decision: 0.25, // Important architectural decision
        reference: 0.10,         // Referenced by another memory
      };

      const actualBoost = boost || boostMap[reason] || 0.15;

      await reinforce_memory(memory_id, actualBoost);

      // Also increment coactivation count
      await run_async(
        `UPDATE memories SET coactivations = COALESCE(coactivations, 0) + 1 WHERE id = ?`,
        [memory_id]
      );

      res.json({
        success: true,
        message: `Memory reinforced (${reason})`,
        boost: actualBoost,
      });
    } catch (error: any) {
      console.error('[ai-agents] Error reinforcing memory:', error);
      res.status(500).json({ err: error.message });
    }
  });

  /**
   * Get memory importance metrics
   * GET /ai-agents/metrics/:memory_id
   */
  app.get('/ai-agents/metrics/:memory_id', async (req: any, res: any) => {
    try {
      const { memory_id } = req.params;

      const memory = await q(
        `SELECT salience, coactivations, last_seen_at, created_at, updated_at, primary_sector
         FROM memories WHERE id = ?`,
        [memory_id]
      );

      if (!memory) {
        return res.status(404).json({ err: 'Memory not found' });
      }

      const now_ts = Date.now();
      const age_days = (now_ts - memory.created_at) / 86400000;
      const usage_frequency = (memory.coactivations || 0) / Math.max(1, age_days);
      const importance_score = (memory.salience || 0.5) * (1 + Math.log(1 + (memory.coactivations || 0)));

      // Determine tier
      const dt = Math.max(0, now_ts - (memory.last_seen_at || memory.updated_at || now_ts));
      const recent = dt < 6 * 86_400_000;
      const high = (memory.coactivations || 0) > 5 || (memory.salience || 0) > 0.7;
      let tier = 'cold';
      if (recent && high) tier = 'hot';
      else if (recent || (memory.salience || 0) > 0.4) tier = 'warm';

      res.json({
        success: true,
        metrics: {
          salience: memory.salience,
          coactivations: memory.coactivations || 0,
          age_days: Math.round(age_days * 10) / 10,
          usage_frequency: Math.round(usage_frequency * 100) / 100,
          importance_score: Math.round(importance_score * 100) / 100,
          tier,
          sector: memory.primary_sector,
        },
      });
    } catch (error: any) {
      console.error('[ai-agents] Error retrieving metrics:', error);
      res.status(500).json({ err: error.message });
    }
  });

  /**
   * Run automatic pattern detection
   * POST /ai-agents/detect-patterns
   */
  app.post('/ai-agents/detect-patterns', async (req: any, res: any) => {
    try {
      const {
        project_name,
        user_id = 'ai-agent-system',
        lookback_days = 7,
        min_frequency = 3,
      } = req.body;

      if (!project_name) {
        return res.status(400).json({ err: 'project_name required' });
      }

      // Get recent actions
      const actions = await all_async(
        `SELECT id, content, meta FROM memories
         WHERE primary_sector = 'episodic'
         AND tags LIKE ?
         AND user_id = ?
         AND created_at > ?
         ORDER BY created_at DESC`,
        [`%${project_name}%`, user_id, Date.now() - (lookback_days * 86400000)]
      );

      // Simple pattern detection: find action sequences that repeat
      const sequences = new Map<string, any>();

      for (let i = 0; i < actions.length - 2; i++) {
        const seq = [
          extractActionType(actions[i].content),
          extractActionType(actions[i + 1].content),
          extractActionType(actions[i + 2].content),
        ];

        const key = seq.join(' → ');
        if (!sequences.has(key)) {
          sequences.set(key, { actions: seq, frequency: 0, contexts: [] });
        }

        const entry = sequences.get(key)!;
        entry.frequency++;
        const ctx = actions[i].meta ? JSON.parse(actions[i].meta as any) : {};
        entry.contexts.push(ctx.context || '');
      }

      // Store patterns that meet frequency threshold
      const detectedPatterns = [];
      for (const [key, seq] of sequences.entries()) {
        if (seq.frequency >= min_frequency) {
          const patternName = `Auto-detected: ${seq.actions.slice(0, 2).join(' + ')}`;
          const description = `Common sequence observed:\n${seq.actions.map((a: string, i: number) => `${i + 1}. ${a}`).join('\n')}`;

          const result = await add_hsg_memory(
            `${patternName}\n${description}\n\nObserved ${seq.frequency} times in ${project_name}`,
            j(['auto-detected', 'coding-pattern', project_name]),
            {
              project_name,
              pattern_name: patternName,
              frequency: seq.frequency,
              confidence: Math.min(0.95, 0.5 + (seq.frequency * 0.05)),
              auto_detected: true,
              timestamp: new Date().toISOString(),
            },
            user_id,
            'procedural'
          );

          detectedPatterns.push({
            pattern_name: patternName,
            memory_id: result.id,
            frequency: seq.frequency,
          });
        }
      }

      res.json({
        success: true,
        patterns_detected: detectedPatterns.length,
        patterns: detectedPatterns,
      });
    } catch (error: any) {
      console.error('[ai-agents] Error detecting patterns:', error);
      res.status(500).json({ err: error.message });
    }
  });

  /**
   * Get most important memories (by salience * coactivations)
   * POST /ai-agents/important
   */
  app.post('/ai-agents/important', async (req: any, res: any) => {
    try {
      const {
        project_name,
        memory_type = 'all',
        limit = 10,
        user_id = 'ai-agent-system',
      } = req.body;

      if (!project_name) {
        return res.status(400).json({ err: 'project_name required' });
      }

      const sectorMap: Record<string, string[]> = {
        state: ['semantic'],
        actions: ['episodic'],
        patterns: ['procedural'],
        decisions: ['reflective'],
        emotions: ['emotional'],
        all: ['semantic', 'episodic', 'procedural', 'reflective', 'emotional'],
      };

      const sectors = sectorMap[memory_type] || sectorMap.all;

      // Query with larger limit, then sort by importance
      const results = await hsg_query(
        `important memories for ${project_name}`,
        limit * 2,
        {
          sectors,
          user_id
        }
      );

      // Calculate importance score for each
      const scored = results.map((mem: any) => {
        const salience = mem.salience || 0.5;
        const coactivations = mem.coactivations || 0;
        const importance_score = salience * (1 + Math.log(1 + coactivations));
        return { ...mem, importance_score };
      });

      // Sort by importance and return top N
      scored.sort((a: any, b: any) => b.importance_score - a.importance_score);
      const topN = scored.slice(0, limit);

      res.json({
        success: true,
        memories: topN,
        count: topN.length,
      });
    } catch (error: any) {
      console.error('[ai-agents] Error retrieving important memories:', error);
      res.status(500).json({ err: error.message });
    }
  });

  // ============================================================================
  // AUTO-VALIDATION SYSTEM: Consistency, Pattern Effectiveness, Decision Quality
  // ============================================================================

  /**
   * Run consistency validation for project
   * Detects contradicting decisions, circular dependencies, broken waypoints, orphaned memories
   * GET /ai-agents/validate/consistency/:project_name
   */
  app.get('/ai-agents/validate/consistency/:project_name', async (req: any, res: any) => {
    try {
      const { project_name } = req.params;
      const { user_id = 'ai-agent-system' } = req.query;

      console.log(`[ai-agents] Running consistency validation for ${project_name}...`);

      const report = await validateConsistency(project_name, user_id as string);

      res.json({
        success: true,
        report,
        issues_found: report.issues.length,
        auto_actions_taken: report.auto_actions_taken,
      });
    } catch (error: any) {
      console.error('[ai-agents] Error running consistency validation:', error);
      res.status(500).json({ err: error.message });
    }
  });

  /**
   * Run pattern effectiveness analysis for project
   * Tracks success rates, calculates effectiveness scores, auto-reinforces/downgrades patterns
   * GET /ai-agents/validate/effectiveness/:project_name
   */
  app.get('/ai-agents/validate/effectiveness/:project_name', async (req: any, res: any) => {
    try {
      const { project_name } = req.params;
      const { user_id = 'ai-agent-system' } = req.query;

      console.log(`[ai-agents] Running pattern effectiveness analysis for ${project_name}...`);

      const report = await trackPatternEffectiveness(project_name, user_id as string);

      res.json({
        success: true,
        report,
        patterns_analyzed: report.patterns_analyzed,
        excellent_patterns: report.excellent_patterns,
        failing_patterns: report.failing_patterns,
        auto_actions_taken: report.auto_actions_taken,
      });
    } catch (error: any) {
      console.error('[ai-agents] Error running effectiveness analysis:', error);
      res.status(500).json({ err: error.message });
    }
  });

  /**
   * Run decision quality assessment for project
   * Evaluates adherence, consistency, outcomes; auto-boosts validated decisions
   * GET /ai-agents/validate/decisions/:project_name
   */
  app.get('/ai-agents/validate/decisions/:project_name', async (req: any, res: any) => {
    try {
      const { project_name } = req.params;
      const { user_id = 'ai-agent-system' } = req.query;

      console.log(`[ai-agents] Running decision quality assessment for ${project_name}...`);

      const report = await assessDecisionQuality(project_name, user_id as string);

      res.json({
        success: true,
        report,
        decisions_assessed: report.decisions_assessed,
        validated_decisions: report.validated_decisions,
        ignored_decisions: report.ignored_decisions,
        reversed_decisions: report.reversed_decisions,
        auto_actions_taken: report.auto_actions_taken,
      });
    } catch (error: any) {
      console.error('[ai-agents] Error running decision quality assessment:', error);
      res.status(500).json({ err: error.message });
    }
  });

  /**
   * Run comprehensive validation (all three validators)
   * GET /ai-agents/validate/:project_name
   */
  app.get('/ai-agents/validate/:project_name', async (req: any, res: any) => {
    try {
      const { project_name } = req.params;
      const { user_id = 'ai-agent-system' } = req.query;

      console.log(`[ai-agents] Running comprehensive validation for ${project_name}...`);

      // Run all three validators in parallel
      const [consistencyReport, effectivenessReport, decisionQualityReport] = await Promise.all([
        validateConsistency(project_name, user_id as string),
        trackPatternEffectiveness(project_name, user_id as string),
        assessDecisionQuality(project_name, user_id as string),
      ]);

      const totalAutoActions =
        consistencyReport.auto_actions_taken +
        effectivenessReport.auto_actions_taken +
        decisionQualityReport.auto_actions_taken;

      res.json({
        success: true,
        timestamp: Date.now(),
        project_name,
        validation: {
          consistency: {
            issues_found: consistencyReport.issues.length,
            critical: consistencyReport.issues.filter(i => i.severity === 'CRITICAL').length,
            warning: consistencyReport.issues.filter(i => i.severity === 'WARNING').length,
            auto_actions_taken: consistencyReport.auto_actions_taken,
          },
          effectiveness: {
            patterns_analyzed: effectivenessReport.patterns_analyzed,
            excellent: effectivenessReport.excellent_patterns,
            failing: effectivenessReport.failing_patterns,
            auto_actions_taken: effectivenessReport.auto_actions_taken,
          },
          decisions: {
            assessed: decisionQualityReport.decisions_assessed,
            validated: decisionQualityReport.validated_decisions,
            ignored: decisionQualityReport.ignored_decisions,
            reversed: decisionQualityReport.reversed_decisions,
            auto_actions_taken: decisionQualityReport.auto_actions_taken,
          },
        },
        total_auto_actions: totalAutoActions,
        detailed_reports: {
          consistency: consistencyReport,
          effectiveness: effectivenessReport,
          decisions: decisionQualityReport,
        },
      });
    } catch (error: any) {
      console.error('[ai-agents] Error running comprehensive validation:', error);
      res.status(500).json({ err: error.message });
    }
  });

  // ============================================================================
  // SELF-CORRECTION SYSTEM: Failure Analysis, Confidence Adjustment, Consolidation
  // ============================================================================

  /**
   * Analyze failures and identify root causes
   * GET /ai-agents/analyze/failures/:project_name
   */
  app.get('/ai-agents/analyze/failures/:project_name', async (req: any, res: any) => {
    try {
      const { project_name } = req.params;
      const { user_id = 'ai-agent-system', lookback_days = 30 } = req.query;

      console.log(`[ai-agents] Running failure analysis for ${project_name}...`);

      const report = await analyzeFailures(project_name, user_id as string, parseInt(lookback_days as string, 10));

      res.json({
        success: true,
        report,
        failures_analyzed: report.failures_analyzed,
        lessons_created: report.lessons_created,
      });
    } catch (error: any) {
      console.error('[ai-agents] Error analyzing failures:', error);
      res.status(500).json({ err: error.message });
    }
  });

  /**
   * Get lessons learned from failures
   * GET /ai-agents/lessons/:project_name
   */
  app.get('/ai-agents/lessons/:project_name', async (req: any, res: any) => {
    try {
      const { project_name } = req.params;
      const { user_id = 'ai-agent-system', limit = 20 } = req.query;

      const lessons = await getLessonsLearned(project_name, user_id as string, parseInt(limit as string, 10));

      res.json({
        success: true,
        lessons,
        count: lessons.length,
      });
    } catch (error: any) {
      console.error('[ai-agents] Error retrieving lessons:', error);
      res.status(500).json({ err: error.message });
    }
  });

  /**
   * Auto-adjust confidence for all project memories
   * POST /ai-agents/adjust/confidence/:project_name
   */
  app.post('/ai-agents/adjust/confidence/:project_name', async (req: any, res: any) => {
    try {
      const { project_name } = req.params;
      const { user_id = 'ai-agent-system' } = req.body;

      console.log(`[ai-agents] Running confidence auto-adjustment for ${project_name}...`);

      const report = await autoAdjustConfidence(project_name, user_id);

      res.json({
        success: true,
        report,
        adjustments_made: report.adjustments_made,
        avg_confidence_before: report.average_confidence_before,
        avg_confidence_after: report.average_confidence_after,
      });
    } catch (error: any) {
      console.error('[ai-agents] Error adjusting confidence:', error);
      res.status(500).json({ err: error.message });
    }
  });

  /**
   * Get confidence distribution
   * GET /ai-agents/confidence/distribution/:project_name
   */
  app.get('/ai-agents/confidence/distribution/:project_name', async (req: any, res: any) => {
    try {
      const { project_name } = req.params;
      const { user_id = 'ai-agent-system' } = req.query;

      const distribution = await getConfidenceDistribution(project_name, user_id as string);

      res.json({
        success: true,
        distribution,
      });
    } catch (error: any) {
      console.error('[ai-agents] Error getting confidence distribution:', error);
      res.status(500).json({ err: error.message });
    }
  });

  /**
   * Consolidate memories (merge duplicates, archive low-value)
   * POST /ai-agents/consolidate/:project_name
   */
  app.post('/ai-agents/consolidate/:project_name', async (req: any, res: any) => {
    try {
      const { project_name } = req.params;
      const { user_id = 'ai-agent-system', options = {} } = req.body;

      console.log(`[ai-agents] Running memory consolidation for ${project_name}...`);

      const report = await consolidateMemories(project_name, user_id, options);

      res.json({
        success: true,
        report,
        memories_before: report.memories_before,
        memories_after: report.memories_after,
        memories_merged: report.memories_merged,
      });
    } catch (error: any) {
      console.error('[ai-agents] Error consolidating memories:', error);
      res.status(500).json({ err: error.message });
    }
  });

  /**
   * Get consolidation statistics
   * GET /ai-agents/consolidation/stats/:project_name
   */
  app.get('/ai-agents/consolidation/stats/:project_name', async (req: any, res: any) => {
    try {
      const { project_name } = req.params;
      const { user_id = 'ai-agent-system' } = req.query;

      const stats = await getConsolidationStats(project_name, user_id as string);

      res.json({
        success: true,
        stats,
      });
    } catch (error: any) {
      console.error('[ai-agents] Error getting consolidation stats:', error);
      res.status(500).json({ err: error.message });
    }
  });

  // ============================================================================
  // PROACTIVE INTELLIGENCE: Conflict Detection, Blocker Prediction, Recommendations
  // ============================================================================

  /**
   * Detect potential conflicts proactively
   * GET /ai-agents/detect/conflicts/:project_name
   */
  app.get('/ai-agents/detect/conflicts/:project_name', async (req: any, res: any) => {
    try {
      const { project_name } = req.params;
      const { user_id = 'ai-agent-system' } = req.query;

      console.log(`[ai-agents] Running conflict detection for ${project_name}...`);

      const report = await detectPotentialConflicts(project_name, user_id as string);

      res.json({
        success: true,
        report,
        conflicts_detected: report.conflicts_detected,
        critical_conflicts: report.critical_conflicts,
      });
    } catch (error: any) {
      console.error('[ai-agents] Error detecting conflicts:', error);
      res.status(500).json({ err: error.message });
    }
  });

  /**
   * Predict potential blockers
   * GET /ai-agents/predict/blockers/:project_name
   */
  app.get('/ai-agents/predict/blockers/:project_name', async (req: any, res: any) => {
    try {
      const { project_name } = req.params;
      const { user_id = 'ai-agent-system', lookback_days = 30 } = req.query;

      console.log(`[ai-agents] Running blocker prediction for ${project_name}...`);

      const report = await predictBlockers(project_name, user_id as string, parseInt(lookback_days as string, 10));

      res.json({
        success: true,
        report,
        blockers_predicted: report.blockers_predicted,
        high_probability: report.high_probability_blockers,
      });
    } catch (error: any) {
      console.error('[ai-agents] Error predicting blockers:', error);
      res.status(500).json({ err: error.message });
    }
  });

  /**
   * Generate context-aware recommendations
   * POST /ai-agents/recommend/:project_name
   */
  app.post('/ai-agents/recommend/:project_name', async (req: any, res: any) => {
    try {
      const { project_name } = req.params;
      const { user_id = 'ai-agent-system', context } = req.body;

      console.log(`[ai-agents] Generating recommendations for ${project_name}...`);

      const report = await generateRecommendations(project_name, user_id, context);

      res.json({
        success: true,
        report,
        recommendations_generated: report.recommendations_generated,
        high_priority: report.high_priority,
      });
    } catch (error: any) {
      console.error('[ai-agents] Error generating recommendations:', error);
      res.status(500).json({ err: error.message });
    }
  });

  // ============================================================================
  // CONTINUOUS LEARNING: Success Pattern Extraction
  // ============================================================================

  /**
   * Extract success patterns from project history
   * POST /ai-agents/learn/patterns/:project_name
   */
  app.post('/ai-agents/learn/patterns/:project_name', async (req: any, res: any) => {
    try {
      const { project_name } = req.params;
      const { user_id = 'ai-agent-system', lookback_days = 30 } = req.body;

      console.log(`[ai-agents] Extracting success patterns for ${project_name}...`);

      const report = await extractSuccessPatterns(project_name, user_id, lookback_days);

      res.json({
        success: true,
        report,
        patterns_extracted: report.patterns_extracted,
        high_confidence: report.high_confidence_patterns,
      });
    } catch (error: any) {
      console.error('[ai-agents] Error extracting patterns:', error);
      res.status(500).json({ err: error.message });
    }
  });

  /**
   * Get learning statistics
   * GET /ai-agents/learn/stats/:project_name
   */
  app.get('/ai-agents/learn/stats/:project_name', async (req: any, res: any) => {
    try {
      const { project_name } = req.params;
      const { user_id = 'ai-agent-system' } = req.query;

      const stats = await getLearningStats(project_name, user_id as string);

      res.json({
        success: true,
        stats,
      });
    } catch (error: any) {
      console.error('[ai-agents] Error getting learning stats:', error);
      res.status(500).json({ err: error.message });
    }
  });

  // ============================================================================
  // QUALITY & MONITORING: Quality Gates, Anomaly Detection
  // ============================================================================

  /**
   * Run quality gate check
   * POST /ai-agents/quality/gate/:project_name
   */
  app.post('/ai-agents/quality/gate/:project_name', async (req: any, res: any) => {
    try {
      const { project_name } = req.params;
      const { user_id = 'ai-agent-system', context } = req.body;

      console.log(`[ai-agents] Running quality gate for ${project_name}...`);

      const report = await runQualityGate(project_name, user_id, context);

      res.json({
        success: true,
        report,
        passed: report.passed,
        quality_score: report.quality_score,
        violations: report.violations_found,
      });
    } catch (error: any) {
      console.error('[ai-agents] Error running quality gate:', error);
      res.status(500).json({ err: error.message });
    }
  });

  /**
   * Get quality trends
   * GET /ai-agents/quality/trends/:project_name
   */
  app.get('/ai-agents/quality/trends/:project_name', async (req: any, res: any) => {
    try {
      const { project_name } = req.params;
      const { user_id = 'ai-agent-system', days = 30 } = req.query;

      const trends = await getQualityTrends(project_name, user_id as string, parseInt(days as string, 10));

      res.json({
        success: true,
        trends,
      });
    } catch (error: any) {
      console.error('[ai-agents] Error getting quality trends:', error);
      res.status(500).json({ err: error.message });
    }
  });

  /**
   * Detect anomalies in project activity
   * GET /ai-agents/detect/anomalies/:project_name
   */
  app.get('/ai-agents/detect/anomalies/:project_name', async (req: any, res: any) => {
    try {
      const { project_name } = req.params;
      const { user_id = 'ai-agent-system' } = req.query;

      console.log(`[ai-agents] Running anomaly detection for ${project_name}...`);

      const report = await detectAnomalies(project_name, user_id as string);

      res.json({
        success: true,
        report,
        anomalies_detected: report.anomalies_detected,
        critical: report.critical_anomalies,
      });
    } catch (error: any) {
      console.error('[ai-agents] Error detecting anomalies:', error);
      res.status(500).json({ err: error.message });
    }
  });

  /**
   * Run all autonomous intelligence checks (comprehensive report)
   * POST /ai-agents/autonomous/:project_name
   */
  app.post('/ai-agents/autonomous/:project_name', async (req: any, res: any) => {
    try {
      const { project_name } = req.params;
      const { user_id = 'ai-agent-system', context } = req.body;

      console.log(`[ai-agents] Running comprehensive autonomous intelligence for ${project_name}...`);

      // Run all systems in parallel for speed
      const [
        validationReport,
        failureReport,
        confidenceReport,
        conflictReport,
        blockerReport,
        recommendationReport,
        qualityReport,
        anomalyReport,
      ] = await Promise.all([
        // Phase 1: Validation
        Promise.all([
          validateConsistency(project_name, user_id),
          trackPatternEffectiveness(project_name, user_id),
          assessDecisionQuality(project_name, user_id),
        ]),
        // Phase 2: Self-Correction
        analyzeFailures(project_name, user_id, 30),
        autoAdjustConfidence(project_name, user_id),
        // Phase 3: Proactive Intelligence
        detectPotentialConflicts(project_name, user_id),
        predictBlockers(project_name, user_id, 30),
        generateRecommendations(project_name, user_id, context),
        // Phase 5: Quality & Monitoring
        runQualityGate(project_name, user_id, context),
        detectAnomalies(project_name, user_id),
      ]);

      res.json({
        success: true,
        timestamp: Date.now(),
        project_name,
        comprehensive_report: {
          validation: {
            consistency: validationReport[0],
            effectiveness: validationReport[1],
            decisions: validationReport[2],
          },
          self_correction: {
            failures: failureReport,
            confidence: confidenceReport,
          },
          proactive: {
            conflicts: conflictReport,
            blockers: blockerReport,
            recommendations: recommendationReport,
          },
          quality: {
            gate: qualityReport,
            anomalies: anomalyReport,
          },
        },
        summary: {
          validation_issues: validationReport[0].issues.length,
          patterns_analyzed: validationReport[1].patterns_analyzed,
          decisions_assessed: validationReport[2].decisions_assessed,
          failures_analyzed: failureReport.failures_analyzed,
          confidence_adjustments: confidenceReport.adjustments_made,
          conflicts_detected: conflictReport.conflicts_detected,
          blockers_predicted: blockerReport.blockers_predicted,
          recommendations_generated: recommendationReport.recommendations_generated,
          quality_score: qualityReport.quality_score,
          anomalies_detected: anomalyReport.anomalies_detected,
        },
      });
    } catch (error: any) {
      console.error('[ai-agents] Error running autonomous intelligence:', error);
      res.status(500).json({ err: error.message });
    }
  });
}

// Helper function to extract action type from content
function extractActionType(content: string): string {
  const match = content.match(/performed: (.+?)\n/);
  if (match) return match[1].trim();
  return content.substring(0, 50).trim();
}
