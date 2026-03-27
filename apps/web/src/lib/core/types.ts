/**
 * AI Code Guardian — Core Type Definitions
 * All shared types for the review engine, scoring, and audit system.
 */

// ─── Enums ───────────────────────────────────────────────────

export enum Severity {
  Critical = 'critical',
  High = 'high',
  Medium = 'medium',
  Low = 'low',
  Info = 'info',
}

export enum IssueCategory {
  Security = 'security',
  Hallucination = 'hallucination',
  Performance = 'performance',
  BugRisk = 'bug_risk',
  CodeSmell = 'code_smell',
  TypeSafety = 'type_safety',
  TestCoverage = 'test_coverage',
  Dependency = 'dependency',
  APIUsage = 'api_usage',
}

export enum ReviewStatus {
  Pending = 'pending',
  InProgress = 'in_progress',
  Completed = 'completed',
  Failed = 'failed',
}

export enum ActionType {
  Accept = 'accept',
  Fix = 'fix',
  Reject = 'reject',
}

export enum AIProvider {
  Gemini = 'gemini',
  Anthropic = 'anthropic',
}

// ─── Core Interfaces ────────────────────────────────────────

export interface FileChange {
  path: string;
  content: string;
  previousContent?: string;
  language: string;
  additions: number;
  deletions: number;
}

export interface CodeLocation {
  file: string;
  startLine: number;
  endLine: number;
  startColumn?: number;
  endColumn?: number;
}

export interface ReviewIssue {
  id: string;
  category: IssueCategory;
  severity: Severity;
  title: string;
  description: string;
  location: CodeLocation;
  suggestedFix?: string;
  confidence: number; // 0-1
  ruleId?: string;
  aiReasoning?: string;
}

export interface TestResult {
  id: string;
  name: string;
  status: 'passed' | 'failed' | 'skipped' | 'error';
  duration: number;
  errorMessage?: string;
  file: string;
}

export interface GeneratedTest {
  id: string;
  targetFile: string;
  testCode: string;
  testFramework: 'vitest';
  results?: TestResult[];
}

export interface ConfidenceScore {
  overall: number; // 0-100
  security: number;
  correctness: number;
  quality: number;
  testCoverage: number;
  breakdown: {
    label: string;
    score: number;
    weight: number;
  }[];
}

export interface ReviewResult {
  id: string;
  status: ReviewStatus;
  issues: ReviewIssue[];
  generatedTests: GeneratedTest[];
  confidenceScore: ConfidenceScore;
  summary: string;
  aiProvider: AIProvider;
  processingTimeMs: number;
  createdAt: string;
  completedAt?: string;
}

// ─── Git Integration ────────────────────────────────────────

export interface PullRequestInfo {
  id: string;
  number: number;
  title: string;
  description: string;
  author: string;
  baseBranch: string;
  headBranch: string;
  repository: string;
  provider: 'github' | 'gitlab';
  url: string;
  files: FileChange[];
}

export interface WebhookPayload {
  event: 'pull_request' | 'push' | 'merge_request';
  action: 'opened' | 'synchronize' | 'updated' | 'reopened';
  pullRequest: PullRequestInfo;
  installation?: {
    id: number;
  };
}

// ─── Audit Log ──────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  reviewId: string;
  action: ActionType;
  userId: string;
  issueId?: string;
  previousValue?: string;
  newValue?: string;
  reason?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// ─── Configuration ──────────────────────────────────────────

export interface GuardianConfig {
  aiProvider: AIProvider;
  enabledCategories: IssueCategory[];
  severityThreshold: Severity;
  autoFixEnabled: boolean;
  testGenerationEnabled: boolean;
  sandboxTimeoutMs: number;
  sandboxMemoryLimitMb: number;
  customRules?: CustomRule[];
}

export interface CustomRule {
  id: string;
  name: string;
  description: string;
  pattern: string; // regex
  category: IssueCategory;
  severity: Severity;
  language?: string;
  message: string;
}

// ─── API Responses ──────────────────────────────────────────

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

export interface DashboardStats {
  totalReviews: number;
  issuesFound: number;
  issuesFixed: number;
  averageConfidence: number;
  reviewsByDay: { date: string; count: number }[];
  issuesByCategory: { category: IssueCategory; count: number }[];
  issuesBySeverity: { severity: Severity; count: number }[];
}
