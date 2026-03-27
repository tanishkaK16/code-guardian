/**
 * Review Engine
 * Orchestrates the complete code review pipeline:
 * Static Analysis → AI Reasoning → Test Generation → Sandbox → Scoring
 */

import { v4 as uuidv4 } from 'uuid';
import {
  FileChange,
  ReviewResult,
  ReviewIssue,
  ReviewStatus,
  AIProvider,
  GuardianConfig,
  Severity,
  IssueCategory,
} from '../types/index.js';
import { StaticAnalyzer } from '../analyzer/static-analyzer.js';
import { AIReasoningEngine } from '../ai/reasoning-engine.js';
import { TestGenerator } from '../testing/test-generator.js';
import { SandboxRunner } from '../sandbox/sandbox-runner.js';
import { ConfidenceScorer } from '../scorer/confidence-scorer.js';

// ─── Default Configuration ──────────────────────────────────

const DEFAULT_CONFIG: GuardianConfig = {
  aiProvider: AIProvider.Gemini,
  enabledCategories: Object.values(IssueCategory),
  severityThreshold: Severity.Low,
  autoFixEnabled: false,
  testGenerationEnabled: true,
  sandboxTimeoutMs: 30000,
  sandboxMemoryLimitMb: 512,
};

// ─── Review Engine ──────────────────────────────────────────

export class ReviewEngine {
  private config: GuardianConfig;
  private staticAnalyzer: StaticAnalyzer;
  private aiEngine: AIReasoningEngine;
  private testGenerator: TestGenerator;
  private sandboxRunner: SandboxRunner;
  private confidenceScorer: ConfidenceScorer;

  constructor(
    config: Partial<GuardianConfig> & {
      geminiApiKey?: string;
      anthropicApiKey?: string;
    }
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize components
    this.staticAnalyzer = new StaticAnalyzer(config.customRules);

    this.aiEngine = new AIReasoningEngine({
      provider: this.config.aiProvider,
      geminiApiKey: config.geminiApiKey,
      anthropicApiKey: config.anthropicApiKey,
    });

    this.testGenerator = new TestGenerator(this.aiEngine);

    this.sandboxRunner = new SandboxRunner({
      timeoutMs: this.config.sandboxTimeoutMs,
      memoryLimitMb: this.config.sandboxMemoryLimitMb,
    });

    this.confidenceScorer = new ConfidenceScorer();
  }

  /**
   * Run the complete review pipeline on a set of file changes.
   */
  async review(files: FileChange[]): Promise<ReviewResult> {
    const reviewId = uuidv4();
    const startTime = Date.now();

    const result: ReviewResult = {
      id: reviewId,
      status: ReviewStatus.InProgress,
      issues: [],
      generatedTests: [],
      confidenceScore: {
        overall: 0,
        security: 0,
        correctness: 0,
        quality: 0,
        testCoverage: 0,
        breakdown: [],
      },
      summary: '',
      aiProvider: this.config.aiProvider,
      processingTimeMs: 0,
      createdAt: new Date().toISOString(),
    };

    try {
      // ── Step 1: Static Analysis ─────────────────────────
      console.log(`[Guardian] 🔍 Running static analysis on ${files.length} files...`);
      const staticIssues = this.staticAnalyzer.analyzeFiles(files);
      result.issues.push(...staticIssues);
      console.log(`[Guardian] Found ${staticIssues.length} static analysis issues`);

      // ── Step 2: AI-Powered Analysis ─────────────────────
      console.log(`[Guardian] 🤖 Running AI analysis (${this.config.aiProvider})...`);
      const [aiResult, hallucinations] = await Promise.all([
        this.aiEngine.analyzeCode(files),
        this.aiEngine.detectHallucinations(files),
      ]);

      // Merge AI issues (deduplicate by location)
      const aiIssues = [...aiResult.issues, ...hallucinations];
      const dedupedAIIssues = this.deduplicateIssues(aiIssues, staticIssues);
      result.issues.push(...dedupedAIIssues);
      console.log(`[Guardian] AI found ${dedupedAIIssues.length} additional issues`);

      // ── Step 3: Test Generation ─────────────────────────
      if (this.config.testGenerationEnabled) {
        console.log(`[Guardian] 🧪 Generating tests...`);
        const tests = await this.testGenerator.generateTests(files);
        result.generatedTests = tests;
        console.log(`[Guardian] Generated ${tests.length} test suites`);

        // ── Step 4: Sandbox Execution ───────────────────
        if (tests.length > 0) {
          console.log(`[Guardian] 📦 Running tests in sandbox...`);
          const sandboxResults = await this.sandboxRunner.runTests(tests);

          // Attach results to tests
          for (const sr of sandboxResults) {
            const test = result.generatedTests.find((t) => t.id === sr.testId);
            if (test) {
              test.results = sr.results;
            }
          }

          const totalTests = sandboxResults.reduce((sum, r) => sum + r.results.length, 0);
          const passed = sandboxResults.reduce(
            (sum, r) => sum + r.results.filter((t) => t.status === 'passed').length,
            0
          );
          console.log(`[Guardian] Tests: ${passed}/${totalTests} passed`);
        }
      }

      // ── Step 5: Filter by Configuration ─────────────────
      result.issues = this.filterIssues(result.issues);

      // ── Step 6: Confidence Scoring ──────────────────────
      console.log(`[Guardian] 📊 Calculating confidence scores...`);
      const allTestResults = result.generatedTests.flatMap((t) => t.results ?? []);
      const totalLines = files.reduce((sum, f) => sum + f.content.split('\n').length, 0);

      result.confidenceScore = this.confidenceScorer.calculate({
        issues: result.issues,
        generatedTests: result.generatedTests,
        testResults: allTestResults,
        fileCount: files.length,
        totalLines,
      });

      // ── Step 7: Generate Summary ────────────────────────
      result.summary = this.generateSummary(result, aiResult.summary);
      result.status = ReviewStatus.Completed;
      result.completedAt = new Date().toISOString();

      console.log(
        `[Guardian] ✅ Review complete — Score: ${result.confidenceScore.overall}/100, ` +
        `Issues: ${result.issues.length}`
      );
    } catch (error) {
      result.status = ReviewStatus.Failed;
      result.summary = `Review failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error('[Guardian] ❌ Review failed:', error);
    }

    result.processingTimeMs = Date.now() - startTime;
    return result;
  }

  /**
   * Generate an auto-fix for a specific issue.
   */
  async autoFix(
    issueId: string,
    reviewResult: ReviewResult,
    fileContent: string
  ): Promise<string | null> {
    const issue = reviewResult.issues.find((i) => i.id === issueId);
    if (!issue) return null;

    return this.aiEngine.generateFix(issue, fileContent, issue.location.file);
  }

  // ─── Private Methods ────────────────────────────────────

  private deduplicateIssues(
    newIssues: ReviewIssue[],
    existingIssues: ReviewIssue[]
  ): ReviewIssue[] {
    return newIssues.filter((newIssue) => {
      return !existingIssues.some(
        (existing) =>
          existing.location.file === newIssue.location.file &&
          Math.abs(existing.location.startLine - newIssue.location.startLine) <= 2 &&
          existing.category === newIssue.category
      );
    });
  }

  private filterIssues(issues: ReviewIssue[]): ReviewIssue[] {
    const severityOrder: Record<Severity, number> = {
      [Severity.Critical]: 0,
      [Severity.High]: 1,
      [Severity.Medium]: 2,
      [Severity.Low]: 3,
      [Severity.Info]: 4,
    };

    const thresholdLevel = severityOrder[this.config.severityThreshold];

    return issues.filter((issue) => {
      // Filter by severity threshold
      if (severityOrder[issue.severity] > thresholdLevel) return false;

      // Filter by enabled categories
      if (!this.config.enabledCategories.includes(issue.category)) return false;

      return true;
    });
  }

  private generateSummary(result: ReviewResult, aiSummary: string): string {
    const { confidenceScore, issues } = result;
    const emoji = confidenceScore.overall >= 80 ? '✅' : confidenceScore.overall >= 60 ? '⚠️' : '🚨';

    const criticals = issues.filter((i) => i.severity === Severity.Critical).length;
    const highs = issues.filter((i) => i.severity === Severity.High).length;

    let summary = `${emoji} **Confidence Score: ${confidenceScore.overall}/100**\n\n`;

    if (criticals > 0) {
      summary += `🚨 **${criticals} critical issue(s)** require immediate attention.\n`;
    }
    if (highs > 0) {
      summary += `⚠️ **${highs} high severity issue(s)** found.\n`;
    }

    summary += `\n📊 **Breakdown:**\n`;
    for (const dim of confidenceScore.breakdown) {
      summary += `  • ${dim.label}: ${dim.score}/100\n`;
    }

    if (aiSummary) {
      summary += `\n🤖 **AI Assessment:** ${aiSummary}\n`;
    }

    summary += `\n⏱️ Review completed in ${(result.processingTimeMs / 1000).toFixed(1)}s`;

    return summary;
  }
}
