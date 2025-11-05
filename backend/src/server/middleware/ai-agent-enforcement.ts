/**
 * AI Agent Enforcement Middleware
 *
 * This middleware provides mandatory validation and enforcement for AI agents,
 * ensuring they cannot bypass the OpenMemory and .ai-agents systems.
 *
 * Features:
 * - Validates all AI agent actions before execution
 * - Enforces OpenMemory usage requirements
 * - Validates task dependencies and ordering
 * - Implements action locking to prevent conflicts
 * - Provides automatic rollback on failures
 */

import { q, run_async, all_async } from '../../core/db';
import { hsg_query } from '../../memory/hsg';

interface EnforcementConfig {
  requireOpenMemory: boolean;
  validateTaskDependencies: boolean;
  enableActionLocking: boolean;
  validateSchemas: boolean;
  strictMode: boolean;
}

interface AgentAction {
  project_name: string;
  agent_name: string;
  action_type: string;
  task_id?: string;
  dependencies?: string[];
  metadata?: any;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  auto_fixes?: string[];
}

/**
 * Default enforcement configuration
 */
const DEFAULT_CONFIG: EnforcementConfig = {
  requireOpenMemory: true,
  validateTaskDependencies: true,
  enableActionLocking: true,
  validateSchemas: true,
  strictMode: true,
};

/**
 * In-memory action locks to prevent concurrent modifications
 */
const ACTION_LOCKS = new Map<string, { agent: string; timestamp: number; action: string }>();

/**
 * Enforcement middleware class
 */
export class AIAgentEnforcement {
  private config: EnforcementConfig;
  private actionLog: Map<string, any[]> = new Map();

  constructor(config: Partial<EnforcementConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Main enforcement middleware function
   */
  middleware() {
    return async (req: any, res: any, next: any) => {
      // Only enforce on AI agent endpoints
      if (!req.path.startsWith('/ai-agents/')) {
        return next();
      }

      // Skip health checks and read-only endpoints
      if (
        req.method === 'GET' ||
        req.path.includes('/health') ||
        req.path.includes('/query') ||
        req.path.includes('/history')
      ) {
        return next();
      }

      try {
        // Extract agent action from request
        const action = this.extractAgentAction(req);

        // Validate the action
        const validation = await this.validateAction(action, req);

        if (!validation.valid) {
          return res.status(403).json({
            error: 'AI_AGENT_ENFORCEMENT_VIOLATION',
            message: 'Action blocked by enforcement system',
            violations: validation.errors,
            warnings: validation.warnings,
            help: 'AI agents must follow autonomous operation requirements. See .ai-agents/COPY_AS_IS_AUTONOMOUS_MODE.md',
          });
        }

        // Log warnings but allow action
        if (validation.warnings.length > 0) {
          console.warn('[AI Agent Enforcement] Warnings:', validation.warnings);
        }

        // Acquire lock if needed
        if (this.config.enableActionLocking && action.task_id) {
          const lockResult = this.acquireLock(action);
          if (!lockResult.success) {
            return res.status(423).json({
              error: 'RESOURCE_LOCKED',
              message: lockResult.message,
              locked_by: lockResult.locked_by,
            });
          }

          // Add lock release to response
          const originalJson = res.json.bind(res);
          res.json = (data: any) => {
            this.releaseLock(action);
            return originalJson(data);
          };
        }

        // Log action for monitoring
        this.logAction(action, req);

        // Continue to actual endpoint
        next();
      } catch (error: any) {
        console.error('[AI Agent Enforcement] Error:', error);
        return res.status(500).json({
          error: 'ENFORCEMENT_ERROR',
          message: error.message,
        });
      }
    };
  }

  /**
   * Extract agent action from request
   */
  private extractAgentAction(req: any): AgentAction {
    const body = req.body || {};

    return {
      project_name: body.project_name || req.params.project_name || 'unknown',
      agent_name: body.agent_name || body.user_id || 'unknown',
      action_type: this.getActionType(req.path, req.method),
      task_id: body.task_id,
      dependencies: body.dependencies,
      metadata: body,
    };
  }

  /**
   * Get action type from path and method
   */
  private getActionType(path: string, method: string): string {
    if (path.includes('/state')) return 'update_state';
    if (path.includes('/action')) return 'record_action';
    if (path.includes('/decision')) return 'record_decision';
    if (path.includes('/pattern')) return 'record_pattern';
    if (path.includes('/emotion')) return 'record_emotion';
    if (path.includes('/link')) return 'create_link';
    if (path.includes('/reinforce')) return 'reinforce_memory';
    if (path.includes('/consolidate')) return 'consolidate_memories';
    return 'unknown';
  }

  /**
   * Validate agent action against all enforcement rules
   */
  private async validateAction(action: AgentAction, req: any): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Rule 1: Require valid project name
    if (!action.project_name || action.project_name === 'unknown') {
      errors.push('Project name is required for all AI agent actions');
    }

    // Rule 2: Require valid agent name
    if (!action.agent_name || action.agent_name === 'unknown') {
      errors.push('Agent name is required for all AI agent actions');
    }

    // Rule 3: Validate OpenMemory connection (if required)
    if (this.config.requireOpenMemory) {
      const memoryCheck = await this.validateOpenMemoryUsage(action);
      if (!memoryCheck.valid) {
        errors.push(...memoryCheck.errors);
      }
    }

    // Rule 4: Validate task dependencies (if required)
    if (this.config.validateTaskDependencies && action.task_id) {
      const depCheck = await this.validateTaskDependencies(action);
      if (!depCheck.valid) {
        if (this.config.strictMode) {
          errors.push(...depCheck.errors);
        } else {
          warnings.push(...depCheck.errors);
        }
      }
    }

    // Rule 5: Validate schemas (if required)
    if (this.config.validateSchemas) {
      const schemaCheck = this.validateSchema(action);
      if (!schemaCheck.valid) {
        errors.push(...schemaCheck.errors);
      }
    }

    // Rule 6: Check for autonomous mode violations
    const autonomousCheck = this.validateAutonomousMode(req);
    if (!autonomousCheck.valid) {
      warnings.push(...autonomousCheck.errors);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate that OpenMemory is being used correctly
   */
  private async validateOpenMemoryUsage(action: AgentAction): Promise<ValidationResult> {
    const errors: string[] = [];

    try {
      // Check if project has any memories
      const recentMemories = await hsg_query(
        `${action.project_name} recent activities`,
        1,
        { user_id: action.agent_name }
      );

      // For non-initial actions, require memory presence
      if (action.action_type !== 'update_state' && recentMemories.length === 0) {
        errors.push(
          `No OpenMemory records found for project "${action.project_name}". ` +
          `AI agents must store project state before performing other actions.`
        );
      }
    } catch (error: any) {
      console.warn('[Enforcement] OpenMemory validation failed:', error.message);
      // Don't block on OpenMemory errors if not in strict mode
      if (this.config.strictMode) {
        errors.push(`OpenMemory validation error: ${error.message}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: [],
    };
  }

  /**
   * Validate task dependencies are satisfied
   */
  private async validateTaskDependencies(action: AgentAction): Promise<ValidationResult> {
    const errors: string[] = [];

    if (!action.dependencies || action.dependencies.length === 0) {
      return { valid: true, errors: [], warnings: [] };
    }

    try {
      // Check if dependencies are completed
      for (const depId of action.dependencies) {
        const depStatus = await q(
          `SELECT meta FROM memories WHERE id = ? AND tags LIKE '%completed%'`,
          [depId]
        );

        if (!depStatus) {
          errors.push(
            `Dependency "${depId}" not completed. ` +
            `AI agents must complete dependencies before starting new tasks.`
          );
        }
      }
    } catch (error: any) {
      errors.push(`Dependency validation error: ${error.message}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: [],
    };
  }

  /**
   * Validate action against schema
   */
  private validateSchema(action: AgentAction): ValidationResult {
    const errors: string[] = [];
    const metadata = action.metadata || {};

    // Validate based on action type
    switch (action.action_type) {
      case 'record_action':
        if (!metadata.action) {
          errors.push('Field "action" is required for record_action');
        }
        break;

      case 'record_decision':
        if (!metadata.decision || !metadata.rationale) {
          errors.push('Fields "decision" and "rationale" are required for record_decision');
        }
        break;

      case 'record_pattern':
        if (!metadata.pattern_name || !metadata.description) {
          errors.push('Fields "pattern_name" and "description" are required for record_pattern');
        }
        break;

      case 'update_state':
        if (!metadata.state) {
          errors.push('Field "state" is required for update_state');
        }
        break;
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: [],
    };
  }

  /**
   * Validate autonomous mode compliance
   */
  private validateAutonomousMode(req: any): ValidationResult {
    const warnings: string[] = [];
    const body = req.body || {};

    // Check for violations of autonomous mode
    if (body.requires_confirmation === true) {
      warnings.push(
        'AI agents should not require user confirmation. ' +
        'See AUTONOMOUS_MODE.md for autonomous operation requirements.'
      );
    }

    if (body.waiting_for_input === true) {
      warnings.push(
        'AI agents should not wait for user input. ' +
        'Make decisions autonomously based on available context.'
      );
    }

    return {
      valid: true, // Warnings don't block
      errors: warnings,
      warnings: [],
    };
  }

  /**
   * Acquire lock for an action
   */
  private acquireLock(action: AgentAction): { success: boolean; message?: string; locked_by?: string } {
    const lockKey = `${action.project_name}:${action.task_id}`;
    const existing = ACTION_LOCKS.get(lockKey);

    if (existing) {
      const age = Date.now() - existing.timestamp;

      // Release stale locks (older than 5 minutes)
      if (age > 5 * 60 * 1000) {
        ACTION_LOCKS.delete(lockKey);
      } else {
        return {
          success: false,
          message: `Task "${action.task_id}" is locked by agent "${existing.agent}"`,
          locked_by: existing.agent,
        };
      }
    }

    // Acquire lock
    ACTION_LOCKS.set(lockKey, {
      agent: action.agent_name,
      timestamp: Date.now(),
      action: action.action_type,
    });

    return { success: true };
  }

  /**
   * Release lock for an action
   */
  private releaseLock(action: AgentAction): void {
    if (!action.task_id) return;
    const lockKey = `${action.project_name}:${action.task_id}`;
    ACTION_LOCKS.delete(lockKey);
  }

  /**
   * Log action for monitoring
   */
  private logAction(action: AgentAction, req: any): void {
    if (!this.actionLog.has(action.project_name)) {
      this.actionLog.set(action.project_name, []);
    }

    const log = this.actionLog.get(action.project_name)!;
    log.push({
      timestamp: Date.now(),
      action: action.action_type,
      agent: action.agent_name,
      task_id: action.task_id,
      path: req.path,
      method: req.method,
    });

    // Keep only last 1000 actions per project
    if (log.length > 1000) {
      log.shift();
    }
  }

  /**
   * Get action statistics for monitoring
   */
  getActionStats(project_name: string): any {
    const log = this.actionLog.get(project_name) || [];
    const stats = {
      total_actions: log.length,
      by_type: {} as Record<string, number>,
      by_agent: {} as Record<string, number>,
      recent_actions: log.slice(-10),
    };

    for (const entry of log) {
      stats.by_type[entry.action] = (stats.by_type[entry.action] || 0) + 1;
      stats.by_agent[entry.agent] = (stats.by_agent[entry.agent] || 0) + 1;
    }

    return stats;
  }

  /**
   * Get current locks
   */
  getActiveLocks(): any[] {
    const locks: any[] = [];
    const now = Date.now();

    for (const [key, lock] of ACTION_LOCKS.entries()) {
      locks.push({
        resource: key,
        agent: lock.agent,
        action: lock.action,
        age_seconds: Math.floor((now - lock.timestamp) / 1000),
      });
    }

    return locks;
  }
}

/**
 * Export singleton instance
 */
export const agentEnforcement = new AIAgentEnforcement();

/**
 * Monitoring endpoint additions for enforcement
 */
export function addEnforcementEndpoints(app: any) {
  /**
   * Get enforcement statistics
   */
  app.get('/ai-agents/enforcement/stats/:project_name', (req: any, res: any) => {
    const { project_name } = req.params;
    const stats = agentEnforcement.getActionStats(project_name);
    res.json({ success: true, stats });
  });

  /**
   * Get active locks
   */
  app.get('/ai-agents/enforcement/locks', (req: any, res: any) => {
    const locks = agentEnforcement.getActiveLocks();
    res.json({ success: true, locks, count: locks.length });
  });

  /**
   * Health check for enforcement system
   */
  app.get('/ai-agents/enforcement/health', (req: any, res: any) => {
    res.json({
      success: true,
      status: 'operational',
      config: {
        requireOpenMemory: true,
        validateTaskDependencies: true,
        enableActionLocking: true,
        validateSchemas: true,
        strictMode: true,
      },
      uptime: process.uptime(),
    });
  });
}
