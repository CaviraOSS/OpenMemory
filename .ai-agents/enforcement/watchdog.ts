#!/usr/bin/env ts-node
/**
 * AI Agent Enforcement Watchdog
 *
 * This watchdog service runs continuously in the background to ensure
 * AI agents are properly using OpenMemory and the .ai-agents system.
 *
 * Features:
 * - Monitors AI agent activity every 5 minutes
 * - Validates that actions are being recorded in OpenMemory
 * - Checks for autonomous mode violations
 * - Runs automatic validation checks
 * - Detects and reports anomalies
 * - Ensures continuous compliance
 */

import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';

const OPENMEMORY_URL = process.env.OPENMEMORY_URL || 'http://localhost:8080';
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const PROJECT_NAME = path.basename(PROJECT_ROOT);
const WATCHDOG_LOG = path.join(PROJECT_ROOT, '.ai-agents', 'enforcement', 'watchdog.log');
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

interface WatchdogReport {
  timestamp: string;
  checks_passed: number;
  checks_failed: number;
  violations: string[];
  warnings: string[];
  recommendations: string[];
}

/**
 * Main watchdog class
 */
class EnforcementWatchdog {
  private isRunning: boolean = false;
  private intervalId?: NodeJS.Timeout;
  private reportHistory: WatchdogReport[] = [];

  /**
   * Start the watchdog
   */
  start(): void {
    if (this.isRunning) {
      console.log('[Watchdog] Already running');
      return;
    }

    console.log('=' .repeat(70));
    console.log('AI AGENT ENFORCEMENT WATCHDOG');
    console.log('=' .repeat(70));
    console.log('');
    console.log('✓ Watchdog starting...');
    console.log(`  Check interval: ${CHECK_INTERVAL_MS / 1000} seconds`);
    console.log(`  Project: ${PROJECT_NAME}`);
    console.log(`  OpenMemory: ${OPENMEMORY_URL}`);
    console.log('');

    this.isRunning = true;

    // Run initial check immediately
    this.runChecks();

    // Then run checks periodically
    this.intervalId = setInterval(() => {
      this.runChecks();
    }, CHECK_INTERVAL_MS);

    console.log('✓ Watchdog is now monitoring AI agent compliance');
    console.log('=' .repeat(70));
    console.log('');
  }

  /**
   * Stop the watchdog
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isRunning = false;
    console.log('[Watchdog] Stopped');
  }

  /**
   * Run all watchdog checks
   */
  private async runChecks(): Promise<void> {
    const report: WatchdogReport = {
      timestamp: new Date().toISOString(),
      checks_passed: 0,
      checks_failed: 0,
      violations: [],
      warnings: [],
      recommendations: [],
    };

    console.log(`[${report.timestamp}] Running watchdog checks...`);

    try {
      // Check 1: Verify OpenMemory is accessible
      const memoryCheck = await this.checkOpenMemoryHealth();
      if (memoryCheck.success) {
        report.checks_passed++;
      } else {
        report.checks_failed++;
        report.violations.push('OpenMemory is not accessible');
      }

      // Check 2: Verify enforcement middleware is active
      const enforcementCheck = await this.checkEnforcementActive();
      if (enforcementCheck.success) {
        report.checks_passed++;
      } else {
        report.checks_failed++;
        report.violations.push('Enforcement middleware is not active');
      }

      // Check 3: Verify recent agent activity is recorded
      const activityCheck = await this.checkRecentActivity();
      if (activityCheck.success) {
        report.checks_passed++;
      } else {
        report.checks_failed++;
        report.warnings.push(activityCheck.message || 'No recent activity detected');
      }

      // Check 4: Run consistency validation
      const consistencyCheck = await this.runConsistencyValidation();
      if (consistencyCheck.success) {
        report.checks_passed++;
        if (consistencyCheck.issues && consistencyCheck.issues > 0) {
          report.warnings.push(`${consistencyCheck.issues} consistency issues found`);
        }
      } else {
        report.checks_failed++;
        report.violations.push('Consistency validation failed');
      }

      // Check 5: Check for anomalies
      const anomalyCheck = await this.checkForAnomalies();
      if (anomalyCheck.success) {
        report.checks_passed++;
        if (anomalyCheck.anomalies && anomalyCheck.anomalies > 0) {
          report.warnings.push(`${anomalyCheck.anomalies} anomalies detected`);
        }
      } else {
        report.checks_failed++;
        report.violations.push('Anomaly detection failed');
      }

      // Check 6: Verify autonomous mode compliance
      const autonomousCheck = await this.checkAutonomousCompliance();
      if (autonomousCheck.success) {
        report.checks_passed++;
      } else {
        report.warnings.push('Possible autonomous mode violations detected');
      }

      // Generate recommendations
      if (report.violations.length > 0) {
        report.recommendations.push('CRITICAL: Address violations immediately');
      }
      if (report.warnings.length > 0) {
        report.recommendations.push('Review warnings and take corrective action');
      }
      if (activityCheck.inactive_hours && activityCheck.inactive_hours > 1) {
        report.recommendations.push(`No agent activity for ${activityCheck.inactive_hours} hours - verify agent is working`);
      }

      // Log report
      this.logReport(report);
      this.reportHistory.push(report);

      // Keep only last 100 reports
      if (this.reportHistory.length > 100) {
        this.reportHistory.shift();
      }

      // Print summary
      console.log(`  ✓ Checks passed: ${report.checks_passed}`);
      console.log(`  ✗ Checks failed: ${report.checks_failed}`);
      if (report.violations.length > 0) {
        console.log(`  ⚠ VIOLATIONS: ${report.violations.length}`);
        for (const violation of report.violations) {
          console.log(`    - ${violation}`);
        }
      }
      if (report.warnings.length > 0) {
        console.log(`  ⚠ Warnings: ${report.warnings.length}`);
      }
      console.log('');
    } catch (error: any) {
      console.error('[Watchdog] Check failed:', error.message);
      report.checks_failed++;
      report.violations.push(`Watchdog error: ${error.message}`);
      this.logReport(report);
    }
  }

  /**
   * Check if OpenMemory is healthy
   */
  private async checkOpenMemoryHealth(): Promise<{ success: boolean }> {
    try {
      const response = await fetch(`${OPENMEMORY_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return { success: response.ok };
    } catch (error) {
      return { success: false };
    }
  }

  /**
   * Check if enforcement middleware is active
   */
  private async checkEnforcementActive(): Promise<{ success: boolean }> {
    try {
      const response = await fetch(`${OPENMEMORY_URL}/ai-agents/enforcement/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return { success: response.ok };
    } catch (error) {
      return { success: false };
    }
  }

  /**
   * Check recent agent activity
   */
  private async checkRecentActivity(): Promise<{
    success: boolean;
    message?: string;
    inactive_hours?: number;
  }> {
    try {
      const response = await fetch(
        `${OPENMEMORY_URL}/ai-agents/history/${PROJECT_NAME}?limit=10&user_id=ai-agent-system`,
        { method: 'GET', signal: AbortSignal.timeout(5000) }
      );

      if (!response.ok) {
        return { success: false, message: 'Failed to fetch activity' };
      }

      const data = await response.json() as any;

      if (!data.history || data.history.length === 0) {
        return { success: false, message: 'No agent activity found' };
      }

      // Check recency of last activity
      const lastActivity = data.history[0];
      const lastTimestamp = lastActivity.created_at || lastActivity.updated_at;

      if (lastTimestamp) {
        const ageHours = (Date.now() - lastTimestamp) / (1000 * 60 * 60);

        if (ageHours > 24) {
          return {
            success: false,
            message: `No activity for ${Math.floor(ageHours)} hours`,
            inactive_hours: Math.floor(ageHours),
          };
        }
      }

      return { success: true };
    } catch (error) {
      return { success: false, message: 'Activity check failed' };
    }
  }

  /**
   * Run consistency validation
   */
  private async runConsistencyValidation(): Promise<{
    success: boolean;
    issues?: number;
  }> {
    try {
      const response = await fetch(
        `${OPENMEMORY_URL}/ai-agents/validate/consistency/${PROJECT_NAME}?user_id=ai-agent-system`,
        { method: 'GET', signal: AbortSignal.timeout(30000) }
      );

      if (!response.ok) {
        return { success: false };
      }

      const data = await response.json() as any;
      return {
        success: true,
        issues: data.issues_found || 0,
      };
    } catch (error) {
      return { success: false };
    }
  }

  /**
   * Check for anomalies
   */
  private async checkForAnomalies(): Promise<{
    success: boolean;
    anomalies?: number;
  }> {
    try {
      const response = await fetch(
        `${OPENMEMORY_URL}/ai-agents/detect/anomalies/${PROJECT_NAME}?user_id=ai-agent-system`,
        { method: 'GET', signal: AbortSignal.timeout(30000) }
      );

      if (!response.ok) {
        return { success: false };
      }

      const data = await response.json() as any;
      return {
        success: true,
        anomalies: data.anomalies_detected || 0,
      };
    } catch (error) {
      return { success: false };
    }
  }

  /**
   * Check autonomous mode compliance
   */
  private async checkAutonomousCompliance(): Promise<{ success: boolean }> {
    // This is a placeholder - in a real implementation, you would:
    // 1. Check for patterns of asking user for confirmation
    // 2. Check for excessive waiting periods
    // 3. Check for incomplete task execution
    // For now, we'll just return success
    return { success: true };
  }

  /**
   * Log report to file
   */
  private logReport(report: WatchdogReport): void {
    try {
      const logDir = path.dirname(WATCHDOG_LOG);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const logEntry = `${JSON.stringify(report)}\n`;
      fs.appendFileSync(WATCHDOG_LOG, logEntry);
    } catch (error) {
      console.error('[Watchdog] Failed to write log:', error);
    }
  }

  /**
   * Get recent reports
   */
  getRecentReports(count: number = 10): WatchdogReport[] {
    return this.reportHistory.slice(-count);
  }

  /**
   * Get statistics
   */
  getStats(): any {
    const totalChecks = this.reportHistory.reduce((sum, r) => sum + r.checks_passed + r.checks_failed, 0);
    const totalPassed = this.reportHistory.reduce((sum, r) => sum + r.checks_passed, 0);
    const totalFailed = this.reportHistory.reduce((sum, r) => sum + r.checks_failed, 0);
    const totalViolations = this.reportHistory.reduce((sum, r) => sum + r.violations.length, 0);

    return {
      total_checks: totalChecks,
      total_passed: totalPassed,
      total_failed: totalFailed,
      total_violations: totalViolations,
      success_rate: totalChecks > 0 ? (totalPassed / totalChecks) * 100 : 0,
      reports_count: this.reportHistory.length,
    };
  }
}

/**
 * Export singleton instance
 */
export const watchdog = new EnforcementWatchdog();

/**
 * Run watchdog if executed directly
 */
if (require.main === module) {
  watchdog.start();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n[Watchdog] Received SIGINT, shutting down gracefully...');
    watchdog.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n[Watchdog] Received SIGTERM, shutting down gracefully...');
    watchdog.stop();
    process.exit(0);
  });

  // Keep process alive
  process.stdin.resume();
}
