/**
 * AI Agents Integration Routes
 *
 * Provides specialized endpoints for AI autonomous development system integration
 * Stores project state, agent context, development history, and patterns in OpenMemory
 */

import { add_hsg_memory, hsg_query, reinforce_memory } from '../../memory/hsg';
import { now, j } from '../../utils';

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
        timestamp: new Date().toISOString(),
      };

      const result = await add_hsg_memory(content, tags, metadata, user_id, 'episodic');

      res.json({
        success: true,
        memory_id: result.id,
        message: 'Agent action recorded',
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
}
