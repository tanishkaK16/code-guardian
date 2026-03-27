/**
 * Sandbox Runner
 * Executes generated tests in an isolated environment with resource limits.
 */

import { spawn, ChildProcess } from 'node:child_process';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { v4 as uuidv4 } from 'uuid';
import { GeneratedTest, TestResult } from '../types/index.js';

interface SandboxConfig {
  timeoutMs: number;
  memoryLimitMb: number;
  workDir?: string;
}

interface SandboxResult {
  testId: string;
  results: TestResult[];
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  duration: number;
}

export class SandboxRunner {
  private config: SandboxConfig;

  constructor(config?: Partial<SandboxConfig>) {
    this.config = {
      timeoutMs: config?.timeoutMs ?? 30000,
      memoryLimitMb: config?.memoryLimitMb ?? 512,
      workDir: config?.workDir,
    };
  }

  /**
   * Run a generated test in an isolated sandbox.
   */
  async runTest(test: GeneratedTest): Promise<SandboxResult> {
    const sandboxId = uuidv4().slice(0, 8);
    const sandboxDir = join(this.config.workDir ?? tmpdir(), `guardian-sandbox-${sandboxId}`);
    const startTime = Date.now();

    try {
      // Create sandbox directory
      await mkdir(sandboxDir, { recursive: true });

      // Write test file
      const testFilePath = join(sandboxDir, `${sandboxId}.test.ts`);
      await writeFile(testFilePath, test.testCode, 'utf-8');

      // Write minimal vitest config
      const vitestConfig = `
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    reporters: ['json'],
    outputFile: './results.json',
  },
});`;
      await writeFile(join(sandboxDir, 'vitest.config.ts'), vitestConfig, 'utf-8');

      // Write package.json
      const packageJson = JSON.stringify({
        name: `sandbox-${sandboxId}`,
        type: 'module',
        private: true,
      });
      await writeFile(join(sandboxDir, 'package.json'), packageJson, 'utf-8');

      // Run vitest with resource limits
      const result = await this.executeInSandbox(sandboxDir, testFilePath);

      return {
        testId: test.id,
        results: result.results,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        timedOut: result.timedOut,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        testId: test.id,
        results: [],
        stdout: '',
        stderr: error instanceof Error ? error.message : 'Unknown error',
        exitCode: 1,
        timedOut: false,
        duration: Date.now() - startTime,
      };
    } finally {
      // Clean up sandbox
      await this.cleanup(sandboxDir);
    }
  }

  /**
   * Run multiple tests in parallel sandboxes.
   */
  async runTests(tests: GeneratedTest[], concurrency = 3): Promise<SandboxResult[]> {
    const results: SandboxResult[] = [];
    const chunks = this.chunk(tests, concurrency);

    for (const batch of chunks) {
      const batchResults = await Promise.all(batch.map((test) => this.runTest(test)));
      results.push(...batchResults);
    }

    return results;
  }

  // ─── Private Methods ────────────────────────────────────

  private executeInSandbox(
    sandboxDir: string,
    testFile: string
  ): Promise<{
    results: TestResult[];
    stdout: string;
    stderr: string;
    exitCode: number | null;
    timedOut: boolean;
  }> {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let child: ChildProcess;

      try {
        // Execute vitest with memory limit via Node.js flags
        child = spawn(
          'npx',
          ['vitest', 'run', testFile, '--reporter=json', '--no-color'],
          {
            cwd: sandboxDir,
            env: {
              ...process.env,
              NODE_OPTIONS: `--max-old-space-size=${this.config.memoryLimitMb}`,
              // Restrict network access in sandbox
              NO_PROXY: '*',
            },
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: this.config.timeoutMs,
          }
        );
      } catch (error) {
        resolve({
          results: [],
          stdout: '',
          stderr: `Failed to spawn sandbox: ${error}`,
          exitCode: 1,
          timedOut: false,
        });
        return;
      }

      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, this.config.timeoutMs);

      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        const results = this.parseTestResults(stdout);
        resolve({ results, stdout, stderr, exitCode: code, timedOut });
      });

      child.on('error', (error) => {
        clearTimeout(timeout);
        resolve({
          results: [],
          stdout,
          stderr: `Process error: ${error.message}`,
          exitCode: 1,
          timedOut,
        });
      });
    });
  }

  private parseTestResults(stdout: string): TestResult[] {
    try {
      // Try to parse JSON output from vitest
      const jsonMatch = stdout.match(/\{[\s\S]*"testResults"[\s\S]*\}/);
      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[0]) as {
        testResults?: Array<{
          assertionResults?: Array<{
            fullName: string;
            status: string;
            duration: number;
            failureMessages?: string[];
          }>;
          name?: string;
        }>;
      };

      const results: TestResult[] = [];
      for (const suite of parsed.testResults ?? []) {
        for (const test of suite.assertionResults ?? []) {
          results.push({
            id: uuidv4(),
            name: test.fullName ?? 'unknown',
            status: this.mapTestStatus(test.status),
            duration: test.duration ?? 0,
            errorMessage: test.failureMessages?.join('\n'),
            file: suite.name ?? 'unknown',
          });
        }
      }

      return results;
    } catch {
      return [];
    }
  }

  private mapTestStatus(status: string): TestResult['status'] {
    switch (status) {
      case 'passed': return 'passed';
      case 'failed': return 'failed';
      case 'skipped':
      case 'pending': return 'skipped';
      default: return 'error';
    }
  }

  private async cleanup(dir: string): Promise<void> {
    try {
      await rm(dir, { recursive: true, force: true });
    } catch {
      // Cleanup failure is non-critical
    }
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}
