/**
 * Confidence Scorer
 * Calculates multi-dimensional confidence scores for code reviews
 * based on static analysis, AI findings, and test results.
 */

import {
  ReviewIssue,
  TestResult,
  ConfidenceScore,
  Severity,
  IssueCategory,
  GeneratedTest,
} from './types';

interface ScoringInput {
  issues: ReviewIssue[];
  generatedTests: GeneratedTest[];
  testResults: TestResult[];
  fileCount: number;
  totalLines: number;
}

// ─── Scoring Weights ────────────────────────────────────────

const DIMENSION_WEIGHTS = {
  security: 0.35,
  correctness: 0.30,
  quality: 0.20,
  testCoverage: 0.15,
};

const SEVERITY_PENALTIES: Record<Severity, number> = {
  [Severity.Critical]: 25,
  [Severity.High]: 15,
  [Severity.Medium]: 8,
  [Severity.Low]: 3,
  [Severity.Info]: 1,
};

// ─── Confidence Scorer ──────────────────────────────────────

export class ConfidenceScorer {
  /**
   * Calculate a comprehensive confidence score from review results.
   */
  calculate(input: ScoringInput): ConfidenceScore {
    const securityScore = this.calculateSecurityScore(input);
    const correctnessScore = this.calculateCorrectnessScore(input);
    const qualityScore = this.calculateQualityScore(input);
    const testCoverageScore = this.calculateTestCoverageScore(input);

    const overall = Math.round(
      securityScore * DIMENSION_WEIGHTS.security +
      correctnessScore * DIMENSION_WEIGHTS.correctness +
      qualityScore * DIMENSION_WEIGHTS.quality +
      testCoverageScore * DIMENSION_WEIGHTS.testCoverage
    );

    return {
      overall: Math.max(0, Math.min(100, overall)),
      security: Math.round(securityScore),
      correctness: Math.round(correctnessScore),
      quality: Math.round(qualityScore),
      testCoverage: Math.round(testCoverageScore),
      breakdown: [
        { label: 'Security', score: Math.round(securityScore), weight: DIMENSION_WEIGHTS.security },
        { label: 'Correctness', score: Math.round(correctnessScore), weight: DIMENSION_WEIGHTS.correctness },
        { label: 'Code Quality', score: Math.round(qualityScore), weight: DIMENSION_WEIGHTS.quality },
        { label: 'Test Coverage', score: Math.round(testCoverageScore), weight: DIMENSION_WEIGHTS.testCoverage },
      ],
    };
  }

  /**
   * Security dimension: penalized heavily by security issues.
   */
  private calculateSecurityScore(input: ScoringInput): number {
    let score = 100;
    const securityIssues = input.issues.filter(
      (i) => i.category === IssueCategory.Security
    );

    for (const issue of securityIssues) {
      const penalty = SEVERITY_PENALTIES[issue.severity] * issue.confidence;
      score -= penalty;
    }

    // Extra penalty for critical security issues
    const criticals = securityIssues.filter((i) => i.severity === Severity.Critical);
    if (criticals.length > 0) {
      score -= criticals.length * 10;
    }

    return Math.max(0, score);
  }

  /**
   * Correctness dimension: based on bug risk, hallucinations, and test results.
   */
  private calculateCorrectnessScore(input: ScoringInput): number {
    let score = 100;

    // Penalize for bug risk issues
    const bugIssues = input.issues.filter(
      (i) => i.category === IssueCategory.BugRisk || i.category === IssueCategory.Hallucination
    );

    for (const issue of bugIssues) {
      score -= SEVERITY_PENALTIES[issue.severity] * issue.confidence;
    }

    // Penalize for failed tests
    const failedTests = input.testResults.filter((t) => t.status === 'failed');
    const errorTests = input.testResults.filter((t) => t.status === 'error');

    if (input.testResults.length > 0) {
      const failRate = (failedTests.length + errorTests.length) / input.testResults.length;
      score -= failRate * 40;
    }

    return Math.max(0, score);
  }

  /**
   * Quality dimension: code smell, type safety, etc.
   */
  private calculateQualityScore(input: ScoringInput): number {
    let score = 100;

    const qualityIssues = input.issues.filter(
      (i) =>
        i.category === IssueCategory.CodeSmell ||
        i.category === IssueCategory.TypeSafety ||
        i.category === IssueCategory.Performance
    );

    for (const issue of qualityIssues) {
      score -= SEVERITY_PENALTIES[issue.severity] * issue.confidence * 0.7;
    }

    // Bonus for clean code (no issues found)
    if (qualityIssues.length === 0 && input.totalLines > 50) {
      score = Math.min(100, score + 5);
    }

    return Math.max(0, score);
  }

  /**
   * Test coverage dimension: based on generated vs. passing tests.
   */
  private calculateTestCoverageScore(input: ScoringInput): number {
    if (input.generatedTests.length === 0) {
      // No tests generated — moderate score (tests might exist elsewhere)
      return 50;
    }

    const totalTests = input.testResults.length;
    if (totalTests === 0) return 30;

    const passedTests = input.testResults.filter((t) => t.status === 'passed').length;
    const passRate = passedTests / totalTests;

    // Test-per-file ratio bonus
    const testsPerFile = totalTests / Math.max(1, input.fileCount);
    const ratioBonus = Math.min(20, testsPerFile * 5);

    return Math.min(100, passRate * 80 + ratioBonus);
  }

  /**
   * Generate a human-readable summary of the confidence score.
   */
  summarize(score: ConfidenceScore): string {
    const emoji = score.overall >= 80 ? '✅' : score.overall >= 60 ? '⚠️' : '🚨';
    const level = score.overall >= 80 ? 'High' : score.overall >= 60 ? 'Moderate' : 'Low';

    let summary = `${emoji} **${level} Confidence** (${score.overall}/100)\n\n`;

    for (const dim of score.breakdown) {
      const bar = this.renderBar(dim.score);
      summary += `  ${dim.label}: ${bar} ${dim.score}/100 (weight: ${Math.round(dim.weight * 100)}%)\n`;
    }

    return summary;
  }

  private renderBar(score: number): string {
    const filled = Math.round(score / 10);
    const empty = 10 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }
}
