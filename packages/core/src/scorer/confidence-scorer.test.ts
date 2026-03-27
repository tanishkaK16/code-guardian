/**
 * Confidence Scorer Tests
 */

import { describe, it, expect } from 'vitest';
import { ConfidenceScorer } from './confidence-scorer.js';
import { IssueCategory, Severity, ReviewIssue, GeneratedTest, TestResult } from '../types/index.js';

describe('ConfidenceScorer', () => {
  const scorer = new ConfidenceScorer();

  const makeIssue = (category: IssueCategory, severity: Severity, confidence = 0.9): ReviewIssue => ({
    id: 'test',
    category,
    severity,
    title: 'Test',
    description: 'Test issue',
    location: { file: 'test.ts', startLine: 1, endLine: 1 },
    confidence,
  });

  const makeTestResult = (status: TestResult['status']): TestResult => ({
    id: 'test',
    name: 'test',
    status,
    duration: 100,
    file: 'test.ts',
  });

  it('should return perfect score for clean code', () => {
    const score = scorer.calculate({
      issues: [],
      generatedTests: [{ id: 't1', targetFile: 'test.ts', testCode: '', testFramework: 'vitest' }],
      testResults: [makeTestResult('passed'), makeTestResult('passed')],
      fileCount: 1,
      totalLines: 100,
    });

    expect(score.overall).toBeGreaterThanOrEqual(80);
    expect(score.security).toBe(100);
  });

  it('should heavily penalize critical security issues', () => {
    const score = scorer.calculate({
      issues: [
        makeIssue(IssueCategory.Security, Severity.Critical),
        makeIssue(IssueCategory.Security, Severity.Critical),
      ],
      generatedTests: [],
      testResults: [],
      fileCount: 1,
      totalLines: 50,
    });

    expect(score.security).toBeLessThan(50);
    expect(score.overall).toBeLessThanOrEqual(70);
  });

  it('should reduce correctness for failed tests', () => {
    const score = scorer.calculate({
      issues: [],
      generatedTests: [{ id: 't1', targetFile: 'test.ts', testCode: '', testFramework: 'vitest' }],
      testResults: [
        makeTestResult('passed'),
        makeTestResult('failed'),
        makeTestResult('failed'),
      ],
      fileCount: 1,
      totalLines: 100,
    });

    expect(score.correctness).toBeLessThan(100);
  });

  it('should give moderate test coverage when no tests generated', () => {
    const score = scorer.calculate({
      issues: [],
      generatedTests: [],
      testResults: [],
      fileCount: 1,
      totalLines: 100,
    });

    expect(score.testCoverage).toBe(50);
  });

  it('should cap all scores between 0 and 100', () => {
    const score = scorer.calculate({
      issues: Array(20).fill(makeIssue(IssueCategory.Security, Severity.Critical)),
      generatedTests: [],
      testResults: Array(10).fill(makeTestResult('failed')),
      fileCount: 1,
      totalLines: 10,
    });

    expect(score.overall).toBeGreaterThanOrEqual(0);
    expect(score.overall).toBeLessThanOrEqual(100);
    expect(score.security).toBeGreaterThanOrEqual(0);
  });

  it('should generate a readable summary', () => {
    const score = scorer.calculate({
      issues: [makeIssue(IssueCategory.Security, Severity.High)],
      generatedTests: [],
      testResults: [],
      fileCount: 1,
      totalLines: 100,
    });

    const summary = scorer.summarize(score);
    expect(summary).toContain('Confidence');
    expect(summary).toContain('Security');
    expect(summary).toContain('/100');
  });
});
