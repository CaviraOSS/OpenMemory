#!/usr/bin/env ts-node
/**
 * OpenMemory + AI Agents - Project Auto-Detection Watcher
 *
 * This service watches configured directories for new projects and
 * automatically initializes them with the AI agent enforcement system.
 *
 * Features:
 * - Detects new directories in watch paths
 * - Detects git init in existing directories
 * - Auto-initializes OpenMemory + AI agents
 * - Registers projects with global system
 * - Installs git hooks automatically
 *
 * Usage:
 *   ts-node project-watcher.ts
 *   # Or after global install:
 *   openmemory-watch
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import * as os from 'os';

interface WatcherConfig {
  watchPaths: string[];
  ignorePatterns: string[];
  checkIntervalMs: number;
  autoInitialize: boolean;
  requireGit: boolean;
}

interface ProjectInfo {
  name: string;
  path: string;
  detected: string;
  initialized: boolean;
}

const DEFAULT_CONFIG: WatcherConfig = {
  watchPaths: [
    path.join(os.homedir(), 'Projects'),
    path.join(os.homedir(), 'Development'),
    path.join(os.homedir(), 'Code'),
    path.join(os.homedir(), 'workspace'),
  ],
  ignorePatterns: [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    '__pycache__',
    'venv',
    '.venv',
  ],
  checkIntervalMs: 30 * 1000, // 30 seconds
  autoInitialize: true,
  requireGit: true,
};

class ProjectWatcher {
  private config: WatcherConfig;
  private globalDir: string;
  private registryPath: string;
  private knownProjects: Set<string>;
  private isRunning: boolean = false;

  constructor(config: Partial<WatcherConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.globalDir = path.join(os.homedir(), '.openmemory-global');
    this.registryPath = path.join(this.globalDir, 'projects', 'registry.json');
    this.knownProjects = new Set();

    this.loadKnownProjects();
  }

  /**
   * Load known projects from registry
   */
  private loadKnownProjects(): void {
    try {
      if (fs.existsSync(this.registryPath)) {
        const registry = JSON.parse(fs.readFileSync(this.registryPath, 'utf-8'));
        Object.keys(registry.projects || {}).forEach(name => {
          this.knownProjects.add(name);
        });
      }
    } catch (error) {
      console.error('[Watcher] Failed to load registry:', error);
    }
  }

  /**
   * Start watching for new projects
   */
  start(): void {
    if (this.isRunning) {
      console.log('[Watcher] Already running');
      return;
    }

    console.log('='.repeat(70));
    console.log('OpenMemory + AI Agents - Project Auto-Detection Watcher');
    console.log('='.repeat(70));
    console.log('');
    console.log('✓ Watcher starting...');
    console.log(`  Global directory: ${this.globalDir}`);
    console.log(`  Check interval: ${this.config.checkIntervalMs / 1000} seconds`);
    console.log(`  Auto-initialize: ${this.config.autoInitialize}`);
    console.log('');
    console.log('Watch paths:');
    this.config.watchPaths.forEach(p => {
      const exists = fs.existsSync(p);
      console.log(`  ${exists ? '✓' : '✗'} ${p}`);
    });
    console.log('');

    this.isRunning = true;

    // Run initial scan
    this.scanForProjects();

    // Then scan periodically
    setInterval(() => {
      this.scanForProjects();
    }, this.config.checkIntervalMs);

    console.log('✓ Watcher is now monitoring for new projects');
    console.log('  Press Ctrl+C to stop');
    console.log('='.repeat(70));
    console.log('');
  }

  /**
   * Stop watching
   */
  stop(): void {
    this.isRunning = false;
    console.log('[Watcher] Stopped');
  }

  /**
   * Scan watch paths for new projects
   */
  private scanForProjects(): void {
    for (const watchPath of this.config.watchPaths) {
      if (!fs.existsSync(watchPath)) {
        continue;
      }

      try {
        const entries = fs.readdirSync(watchPath, { withFileTypes: true });

        for (const entry of entries) {
          if (!entry.isDirectory()) continue;

          const fullPath = path.join(watchPath, entry.name);

          // Skip ignored patterns
          if (this.shouldIgnore(entry.name)) continue;

          // Check if it's a project
          if (this.isProject(fullPath)) {
            this.handleProject(entry.name, fullPath);
          }
        }
      } catch (error) {
        console.error(`[Watcher] Error scanning ${watchPath}:`, error);
      }
    }
  }

  /**
   * Check if directory name should be ignored
   */
  private shouldIgnore(name: string): boolean {
    return this.config.ignorePatterns.some(pattern => name.includes(pattern));
  }

  /**
   * Check if directory is a project
   */
  private isProject(dirPath: string): boolean {
    try {
      // Must have .git directory if requireGit is true
      if (this.config.requireGit) {
        const gitPath = path.join(dirPath, '.git');
        if (!fs.existsSync(gitPath)) {
          return false;
        }
      }

      // Additional heuristics to identify projects
      const indicators = [
        'package.json',
        'requirements.txt',
        'Cargo.toml',
        'go.mod',
        'pom.xml',
        'build.gradle',
        'CMakeLists.txt',
        'Makefile',
      ];

      const hasIndicator = indicators.some(indicator =>
        fs.existsSync(path.join(dirPath, indicator))
      );

      return hasIndicator || !this.config.requireGit;
    } catch (error) {
      return false;
    }
  }

  /**
   * Handle discovered project
   */
  private handleProject(name: string, projectPath: string): void {
    // Skip if already known
    if (this.knownProjects.has(name)) {
      return;
    }

    // Check if already initialized
    const openmemoryFile = path.join(projectPath, '.openmemory');
    if (fs.existsSync(openmemoryFile)) {
      console.log(`[Watcher] Project already initialized: ${name}`);
      this.knownProjects.add(name);
      return;
    }

    console.log(`[Watcher] NEW PROJECT DETECTED: ${name}`);
    console.log(`  Path: ${projectPath}`);

    if (this.config.autoInitialize) {
      console.log(`  Auto-initializing...`);
      this.initializeProject(name, projectPath);
    } else {
      console.log(`  Auto-initialization disabled. Run: openmemory-init ${projectPath}`);
      this.knownProjects.add(name);
    }
  }

  /**
   * Initialize project with OpenMemory + AI agents
   */
  private initializeProject(name: string, projectPath: string): void {
    const initScript = path.join(this.globalDir, 'bin', 'openmemory-init');

    if (!fs.existsSync(initScript)) {
      console.error(`[Watcher] Init script not found: ${initScript}`);
      return;
    }

    const child = spawn(initScript, [projectPath], {
      stdio: 'pipe',
      shell: true,
    });

    let output = '';

    child.stdout?.on('data', (data) => {
      output += data.toString();
    });

    child.stderr?.on('data', (data) => {
      output += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`[Watcher] ✓ Project initialized: ${name}`);
        this.knownProjects.add(name);

        // Log to watcher log
        const watcherLog = path.join(this.globalDir, 'watcher', 'watcher.log');
        fs.mkdirSync(path.dirname(watcherLog), { recursive: true });
        fs.appendFileSync(
          watcherLog,
          `${new Date().toISOString()} - INITIALIZED - ${name} (${projectPath})\n`
        );
      } else {
        console.error(`[Watcher] ✗ Failed to initialize: ${name} (exit code: ${code})`);
        console.error(output);
      }
    });
  }

  /**
   * Get watcher statistics
   */
  getStats(): any {
    return {
      isRunning: this.isRunning,
      knownProjects: Array.from(this.knownProjects),
      watchPaths: this.config.watchPaths,
      checkIntervalSeconds: this.config.checkIntervalMs / 1000,
    };
  }
}

/**
 * Load configuration from file
 */
function loadConfig(): Partial<WatcherConfig> {
  const configPath = path.join(os.homedir(), '.openmemory-global', 'watcher', 'config.json');

  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch (error) {
    console.warn('[Watcher] Failed to load config, using defaults');
  }

  return {};
}

/**
 * Create default config file
 */
function createDefaultConfig(): void {
  const configPath = path.join(os.homedir(), '.openmemory-global', 'watcher', 'config.json');
  const configDir = path.dirname(configPath);

  fs.mkdirSync(configDir, { recursive: true });

  const config = {
    ...DEFAULT_CONFIG,
    _comment: 'OpenMemory + AI Agents - Watcher Configuration',
    _help: {
      watchPaths: 'Directories to watch for new projects',
      ignorePatterns: 'Directory names to ignore',
      checkIntervalMs: 'How often to scan for new projects (milliseconds)',
      autoInitialize: 'Automatically initialize detected projects',
      requireGit: 'Only detect directories that are git repositories',
    },
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`[Watcher] Created default config: ${configPath}`);
}

/**
 * Main execution
 */
if (require.main === module) {
  // Create default config if it doesn't exist
  const configPath = path.join(os.homedir(), '.openmemory-global', 'watcher', 'config.json');
  if (!fs.existsSync(configPath)) {
    createDefaultConfig();
  }

  // Load config and start watcher
  const config = loadConfig();
  const watcher = new ProjectWatcher(config);
  watcher.start();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n[Watcher] Received SIGINT, shutting down gracefully...');
    watcher.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n[Watcher] Received SIGTERM, shutting down gracefully...');
    watcher.stop();
    process.exit(0);
  });

  // Keep process alive
  process.stdin.resume();
}

export { ProjectWatcher, WatcherConfig };
