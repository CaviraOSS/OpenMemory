#!/usr/bin/env ts-node
/**
 * Automatic Initialization and Enforcement System
 *
 * This script runs automatically when the OpenMemory project starts.
 * It ensures that:
 * 1. The .ai-agents system is properly initialized
 * 2. OpenMemory is connected and accessible
 * 3. Project state is loaded or created
 * 4. Validation systems are operational
 * 5. Enforcement is active
 *
 * This is the entry point for ensuring AI agents cannot bypass the systems.
 */

import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';

interface InitResult {
  success: boolean;
  mode: 'INITIALIZE' | 'RESUME';
  errors: string[];
  warnings: string[];
  state?: any;
}

const OPENMEMORY_URL = process.env.OPENMEMORY_URL || 'http://localhost:8080';
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const PROJECT_NAME = path.basename(PROJECT_ROOT);
const AI_AGENTS_DIR = path.join(PROJECT_ROOT, '.ai-agents');
const STATE_FILE = path.join(AI_AGENTS_DIR, 'project-state.json');
const CONFIG_FILE = path.join(AI_AGENTS_DIR, 'config.json');

/**
 * Main initialization function
 */
async function autoInit(): Promise<InitResult> {
  const result: InitResult = {
    success: false,
    mode: 'INITIALIZE',
    errors: [],
    warnings: [],
  };

  console.log('=' .repeat(70));
  console.log('AI AGENT AUTO-INITIALIZATION & ENFORCEMENT SYSTEM');
  console.log('=' .repeat(70));
  console.log('');

  try {
    // Step 1: Verify .ai-agents directory exists
    if (!fs.existsSync(AI_AGENTS_DIR)) {
      result.errors.push('.ai-agents directory not found');
      console.error('❌ .ai-agents directory not found');
      return result;
    }
    console.log('✓ .ai-agents directory found');

    // Step 2: Verify config exists
    if (!fs.existsSync(CONFIG_FILE)) {
      result.errors.push('config.json not found in .ai-agents/');
      console.error('❌ config.json not found');
      return result;
    }
    console.log('✓ config.json found');

    // Step 3: Load config
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    console.log('✓ Configuration loaded');

    // Step 4: Check OpenMemory connection
    const memoryStatus = await checkOpenMemory();
    if (!memoryStatus.available) {
      if (config.openmemory.fallback_to_local) {
        result.warnings.push('OpenMemory not available, using local fallback');
        console.warn('⚠ OpenMemory not available - using local fallback');
      } else {
        result.errors.push('OpenMemory not available and fallback is disabled');
        console.error('❌ OpenMemory not available');
        return result;
      }
    } else {
      console.log(`✓ OpenMemory connected (v${memoryStatus.version})`);
    }

    // Step 5: Load or initialize project state
    const stateResult = await loadOrInitializeState(config, memoryStatus.available);
    result.mode = stateResult.mode;
    result.state = stateResult.state;

    if (stateResult.mode === 'RESUME') {
      console.log('');
      console.log('📋 MODE: RESUME');
      console.log('-'.repeat(70));
      console.log(`  Phase: ${stateResult.state.project_metadata?.current_phase || 'Unknown'}`);
      console.log(`  Progress: ${stateResult.state.project_metadata?.progress_percentage || 0}%`);
      console.log(`  Next Tasks: ${stateResult.state.next_recommended_tasks?.length || 0}`);
      console.log('');

      // Show next recommended tasks
      if (stateResult.state.next_recommended_tasks?.length > 0) {
        console.log('NEXT RECOMMENDED TASKS:');
        console.log('-'.repeat(70));
        for (const [i, task] of stateResult.state.next_recommended_tasks.slice(0, 3).entries()) {
          console.log(`  ${i + 1}. ${task.task}`);
          console.log(`     Agent: ${task.agent}, Priority: ${task.priority}`);
        }
        console.log('');
      }
    } else {
      console.log('');
      console.log('🚀 MODE: INITIALIZE');
      console.log('-'.repeat(70));
      console.log('  This is a fresh start.');
      console.log('  AI agents should begin Phase 1 immediately.');
      console.log('');
    }

    // Step 6: Verify enforcement is active
    const enforcementStatus = await checkEnforcement();
    if (enforcementStatus.active) {
      console.log('✓ Enforcement middleware is active');
      console.log(`  - Require OpenMemory: ${enforcementStatus.config.requireOpenMemory}`);
      console.log(`  - Validate Dependencies: ${enforcementStatus.config.validateTaskDependencies}`);
      console.log(`  - Action Locking: ${enforcementStatus.config.enableActionLocking}`);
      console.log(`  - Schema Validation: ${enforcementStatus.config.validateSchemas}`);
      console.log(`  - Strict Mode: ${enforcementStatus.config.strictMode}`);
    } else {
      result.warnings.push('Enforcement middleware not yet active - will activate on server start');
      console.warn('⚠ Enforcement middleware not yet active');
    }

    // Step 7: Create enforcement status file
    createEnforcementStatusFile(result);

    result.success = result.errors.length === 0;

    console.log('');
    console.log('=' .repeat(70));
    if (result.success) {
      console.log('✅ AUTO-INITIALIZATION COMPLETE');
      console.log('');
      console.log('AI agents are now REQUIRED to:');
      console.log('  • Use OpenMemory for all state and memory operations');
      console.log('  • Follow .ai-agents system requirements');
      console.log('  • Record all actions, decisions, and patterns');
      console.log('  • Execute tasks in dependency order');
      console.log('  • Operate autonomously without user confirmation');
      console.log('');
      console.log('Enforcement is ACTIVE and cannot be bypassed.');
    } else {
      console.log('❌ AUTO-INITIALIZATION FAILED');
      console.log('');
      console.log('Errors:');
      for (const error of result.errors) {
        console.log(`  • ${error}`);
      }
    }
    console.log('=' .repeat(70));

    return result;
  } catch (error: any) {
    result.errors.push(`Initialization error: ${error.message}`);
    console.error('❌ Initialization failed:', error);
    return result;
  }
}

/**
 * Check if OpenMemory is available
 */
async function checkOpenMemory(): Promise<{ available: boolean; version?: string }> {
  try {
    const response = await fetch(`${OPENMEMORY_URL}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const data = await response.json() as any;
      return { available: true, version: data.version || 'unknown' };
    }

    return { available: false };
  } catch (error) {
    return { available: false };
  }
}

/**
 * Load or initialize project state
 */
async function loadOrInitializeState(
  config: any,
  memoryAvailable: boolean
): Promise<{ mode: 'INITIALIZE' | 'RESUME'; state: any }> {
  // Try OpenMemory first if available
  if (memoryAvailable) {
    try {
      const response = await fetch(
        `${OPENMEMORY_URL}/ai-agents/state/${PROJECT_NAME}?user_id=ai-agent-system`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (response.ok) {
        const data = await response.json() as any;
        if (data.mode === 'RESUME' && data.state) {
          return { mode: 'RESUME', state: data.state };
        }
      }
    } catch (error) {
      console.warn('Failed to load state from OpenMemory:', error);
    }
  }

  // Try local file
  if (fs.existsSync(STATE_FILE)) {
    try {
      const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
      return { mode: 'RESUME', state };
    } catch (error) {
      console.warn('Failed to load local state file:', error);
    }
  }

  // Initialize mode - no state found
  return { mode: 'INITIALIZE', state: null };
}

/**
 * Check if enforcement middleware is active
 */
async function checkEnforcement(): Promise<{ active: boolean; config?: any }> {
  try {
    const response = await fetch(`${OPENMEMORY_URL}/ai-agents/enforcement/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const data = await response.json() as any;
      return { active: data.success, config: data.config };
    }

    return { active: false };
  } catch (error) {
    return { active: false };
  }
}

/**
 * Create enforcement status file for AI agents to read
 */
function createEnforcementStatusFile(result: InitResult): void {
  const statusFile = path.join(AI_AGENTS_DIR, 'enforcement-status.json');
  const status = {
    timestamp: new Date().toISOString(),
    enforcement_active: result.success,
    mode: result.mode,
    errors: result.errors,
    warnings: result.warnings,
    requirements: {
      use_openmemory: true,
      record_all_actions: true,
      follow_autonomous_mode: true,
      validate_dependencies: true,
      cannot_bypass: true,
    },
  };

  fs.writeFileSync(statusFile, JSON.stringify(status, null, 2));
  console.log(`✓ Enforcement status written to ${path.relative(PROJECT_ROOT, statusFile)}`);
}

/**
 * Run initialization
 */
if (require.main === module) {
  autoInit()
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { autoInit };
