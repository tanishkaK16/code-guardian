'use client';

import { useState } from 'react';

// ─── Sample Review Data ─────────────────────────────────────

const sampleReview = {
  id: '1',
  prTitle: 'feat: Add user authentication flow',
  prNumber: 142,
  repository: 'acme/web-app',
  author: 'dev-sarah',
  branch: 'feat/auth-flow',
  provider: 'github',
  status: 'completed',
  aiProvider: 'gemini',
  processingTime: 4.2,
  createdAt: '2026-03-27T15:30:00Z',
  confidence: {
    overall: 72,
    security: 55,
    correctness: 85,
    quality: 78,
    testCoverage: 70,
  },
  summary: 'Found 2 security issues requiring attention. SQL injection risk in the login handler and a hardcoded JWT secret. Overall code quality is good with proper error handling.',
  issues: [
    {
      id: 'i1',
      category: 'security',
      severity: 'critical',
      title: 'SQL Injection in Login Handler',
      description: 'User input is directly interpolated into SQL query without parameterization. An attacker could bypass authentication or extract sensitive data.',
      file: 'src/auth/login.ts',
      startLine: 23,
      endLine: 25,
      confidence: 0.97,
      ruleId: 'SEC001',
      status: 'open',
      suggestedFix: `// Before (vulnerable):
const user = await db.query(\`SELECT * FROM users WHERE email = '\${email}'\`);

// After (safe):
const user = await db.query('SELECT * FROM users WHERE email = $1', [email]);`,
      aiReasoning: 'The email parameter from req.body is directly embedded into the SQL string using template literals. This is a classic SQL injection vulnerability that allows arbitrary SQL execution.',
    },
    {
      id: 'i2',
      category: 'security',
      severity: 'critical',
      title: 'Hardcoded JWT Secret',
      description: 'JWT signing secret is hardcoded in source code. If the repository is compromised, all tokens can be forged.',
      file: 'src/auth/jwt.ts',
      startLine: 5,
      endLine: 5,
      confidence: 0.99,
      ruleId: 'SEC002',
      status: 'open',
      suggestedFix: `// Before:
const JWT_SECRET = 'super-secret-key-12345';

// After:
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');`,
      aiReasoning: 'The JWT secret is a string literal in the source code. This should always be loaded from environment variables or a secrets manager.',
    },
    {
      id: 'i3',
      category: 'hallucination',
      severity: 'high',
      title: 'Non-existent API: Promise.sleep',
      description: 'Promise.sleep() does not exist in JavaScript/TypeScript. This appears to be an AI hallucination.',
      file: 'src/auth/rate-limiter.ts',
      startLine: 42,
      endLine: 42,
      confidence: 0.95,
      ruleId: 'HAL001',
      status: 'open',
      suggestedFix: `// Before (hallucinated API):
await Promise.sleep(1000);

// After (correct):
await new Promise(resolve => setTimeout(resolve, 1000));`,
      aiReasoning: 'Promise.sleep is not a standard JavaScript API. This is a common AI hallucination, likely confused with sleep functions from other languages like Python.',
    },
    {
      id: 'i4',
      category: 'bug_risk',
      severity: 'medium',
      title: 'Empty Catch Block',
      description: 'Error in token verification is silently swallowed, which could mask authentication failures.',
      file: 'src/auth/middleware.ts',
      startLine: 18,
      endLine: 18,
      confidence: 0.88,
      ruleId: 'QL003',
      status: 'open',
      suggestedFix: `// Before:
try { verifyToken(token); } catch(e) { }

// After:
try {
  verifyToken(token);
} catch (error) {
  logger.warn('Token verification failed', { error });
  return res.status(401).json({ error: 'Invalid token' });
}`,
    },
    {
      id: 'i5',
      category: 'code_smell',
      severity: 'low',
      title: 'Console.log in Production Code',
      description: 'Debug console.log statements should be removed or replaced with a proper logger.',
      file: 'src/auth/login.ts',
      startLine: 15,
      endLine: 15,
      confidence: 0.82,
      ruleId: 'QL002',
      status: 'open',
      suggestedFix: 'Replace console.log with a structured logger like pino or winston.',
    },
  ],
  codeContent: `import { Request, Response } from 'express';
import { db } from '../db';
import { signToken } from './jwt';

export async function loginHandler(req: Request, res: Response) {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    console.log('Login attempt:', email);

    // 🚨 SQL Injection vulnerability
    const result = await db.query(
      \`SELECT * FROM users WHERE email = '\${email}' AND password = '\${password}'\`
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const token = signToken({ userId: user.id, role: user.role });

    return res.json({ token, user: { id: user.id, email: user.email } });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}`,
};

// ─── Review Detail Page ─────────────────────────────────────

export default function ReviewDetailPage() {
  const [review] = useState(sampleReview);
  const [issueStatuses, setIssueStatuses] = useState<Record<string, string>>({});
  const [expandedIssue, setExpandedIssue] = useState<string | null>(review.issues[0]?.id ?? null);

  const handleAction = (issueId: string, action: string) => {
    setIssueStatuses((prev) => ({ ...prev, [issueId]: action }));
  };

  const getConfidenceLevel = (score: number) =>
    score >= 80 ? 'high' : score >= 60 ? 'moderate' : 'low';

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <a href="/reviews" className="text-[var(--color-guardian-text-muted)] hover:text-[var(--color-guardian-text)] transition-colors">
              ← Reviews
            </a>
            <span className="text-[var(--color-guardian-text-muted)]">/</span>
            <span className="text-sm px-2 py-0.5 rounded bg-[var(--color-guardian-surface)] text-[var(--color-guardian-text-muted)]">
              {review.provider}
            </span>
          </div>
          <h1 className="text-2xl font-bold">{review.prTitle}</h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-[var(--color-guardian-text-secondary)]">
            <span>{review.repository}</span>
            <span>#{review.prNumber}</span>
            <span>by @{review.author}</span>
            <span>→ {review.branch}</span>
          </div>
        </div>

        {/* Overall Score */}
        <div className="glass-card p-4 text-center glow-accent">
          <div className={`text-3xl font-bold ${
            review.confidence.overall >= 80 ? 'text-[#4ade80]' :
            review.confidence.overall >= 60 ? 'text-[#fbbf24]' : 'text-[#f87171]'
          }`}>
            {review.confidence.overall}
          </div>
          <div className="text-xs text-[var(--color-guardian-text-muted)] mt-1">Confidence</div>
        </div>
      </div>

      {/* Confidence Breakdown */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Security', score: review.confidence.security },
          { label: 'Correctness', score: review.confidence.correctness },
          { label: 'Quality', score: review.confidence.quality },
          { label: 'Test Coverage', score: review.confidence.testCoverage },
        ].map((dim) => (
          <div key={dim.label} className="glass-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-[var(--color-guardian-text-secondary)]">{dim.label}</span>
              <span className="text-sm font-semibold">{dim.score}</span>
            </div>
            <div className="confidence-bar">
              <div
                className={`confidence-bar-fill ${getConfidenceLevel(dim.score)}`}
                style={{ width: `${dim.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* AI Summary */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[var(--color-guardian-gradient-start)] to-[var(--color-guardian-gradient-end)] flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20z" /><path d="M12 16v-4" /><path d="M12 8h.01" />
            </svg>
          </div>
          <span className="text-sm font-semibold">AI Assessment</span>
          <span className="text-xs text-[var(--color-guardian-text-muted)] ml-auto">
            via {review.aiProvider} • {review.processingTime}s
          </span>
        </div>
        <p className="text-sm text-[var(--color-guardian-text-secondary)] leading-relaxed">
          {review.summary}
        </p>
      </div>

      {/* Issues List + Code View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Issues Panel */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            Issues
            <span className="text-sm font-normal text-[var(--color-guardian-text-muted)]">
              ({review.issues.length})
            </span>
          </h3>

          {review.issues.map((issue) => {
            const status = issueStatuses[issue.id] ?? issue.status;
            const isExpanded = expandedIssue === issue.id;

            return (
              <div
                key={issue.id}
                className={`glass-card overflow-hidden transition-all duration-300 ${
                  isExpanded ? 'ring-1 ring-[var(--color-guardian-accent)]' : ''
                } ${status !== 'open' ? 'opacity-60' : ''}`}
              >
                {/* Issue Header */}
                <button
                  className="w-full p-4 text-left flex items-start gap-3 hover:bg-[var(--color-guardian-surface-hover)] transition-colors"
                  onClick={() => setExpandedIssue(isExpanded ? null : issue.id)}
                >
                  <span className={`badge badge-${issue.severity} mt-0.5`}>
                    {issue.severity}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{issue.title}</div>
                    <div className="text-xs text-[var(--color-guardian-text-muted)] mt-1">
                      {issue.file}:{issue.startLine} • {issue.category.replace('_', ' ')} • {Math.round(issue.confidence * 100)}% confidence
                    </div>
                  </div>
                  {status !== 'open' && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      status === 'accept' ? 'bg-[rgba(34,197,94,0.15)] text-[#4ade80]' :
                      status === 'fix' ? 'bg-[rgba(245,158,11,0.15)] text-[#fbbf24]' :
                      'bg-[rgba(239,68,68,0.15)] text-[#f87171]'
                    }`}>
                      {status}
                    </span>
                  )}
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="var(--color-guardian-text-muted)" strokeWidth="2"
                    className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-[var(--color-guardian-border)]">
                    <p className="text-sm text-[var(--color-guardian-text-secondary)] mt-3">
                      {issue.description}
                    </p>

                    {issue.aiReasoning && (
                      <div className="bg-[var(--color-guardian-accent-glow)] rounded-lg p-3">
                        <div className="text-xs font-semibold text-[var(--color-guardian-accent)] mb-1">
                          🤖 AI Reasoning
                        </div>
                        <p className="text-xs text-[var(--color-guardian-text-secondary)]">
                          {issue.aiReasoning}
                        </p>
                      </div>
                    )}

                    {issue.suggestedFix && (
                      <div className="rounded-lg overflow-hidden border border-[var(--color-guardian-border)]">
                        <div className="bg-[var(--color-guardian-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-guardian-text-muted)] border-b border-[var(--color-guardian-border)]">
                          Suggested Fix
                        </div>
                        <pre className="p-3 text-xs overflow-x-auto font-[var(--font-mono)] leading-relaxed">
                          {issue.suggestedFix.split('\n').map((line, i) => (
                            <div
                              key={i}
                              className={
                                line.startsWith('// Before') || line.startsWith('// After') || line.startsWith('// 🚨')
                                  ? 'text-[var(--color-guardian-text-muted)]'
                                  : line.startsWith('//') || line.startsWith('+')
                                    ? 'diff-addition'
                                    : line.startsWith('-')
                                      ? 'diff-deletion'
                                      : ''
                              }
                            >
                              {line}
                            </div>
                          ))}
                        </pre>
                      </div>
                    )}

                    {/* Action Buttons */}
                    {status === 'open' && (
                      <div className="flex items-center gap-2 pt-2">
                        <button
                          className="btn-accept text-xs px-4 py-2 rounded-lg font-medium transition-all hover:scale-105 cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); handleAction(issue.id, 'accept'); }}
                        >
                          ✓ Accept
                        </button>
                        <button
                          className="btn-fix text-xs px-4 py-2 rounded-lg font-medium transition-all hover:scale-105 cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); handleAction(issue.id, 'fix'); }}
                        >
                          🔧 Auto Fix
                        </button>
                        <button
                          className="btn-reject text-xs px-4 py-2 rounded-lg font-medium transition-all hover:scale-105 cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); handleAction(issue.id, 'reject'); }}
                        >
                          ✕ Reject
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Code View Panel */}
        <div className="glass-card overflow-hidden sticky top-8">
          <div className="px-4 py-3 border-b border-[var(--color-guardian-border)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-guardian-accent)" strokeWidth="2">
                <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
              </svg>
              <span className="text-sm font-medium">src/auth/login.ts</span>
            </div>
            <span className="text-xs text-[var(--color-guardian-text-muted)]">TypeScript</span>
          </div>
          <div className="overflow-auto max-h-[600px]">
            <pre className="p-0">
              {review.codeContent.split('\n').map((line, idx) => {
                const lineNum = idx + 1;
                const hasIssue = review.issues.some(
                  (i) => i.file === 'src/auth/login.ts' && lineNum >= i.startLine && lineNum <= i.endLine
                );
                const issue = review.issues.find(
                  (i) => i.file === 'src/auth/login.ts' && lineNum === i.startLine
                );

                return (
                  <div
                    key={idx}
                    className={`flex hover:bg-[var(--color-guardian-surface-hover)] transition-colors ${
                      hasIssue ? 'bg-[rgba(239,68,68,0.06)]' : ''
                    }`}
                  >
                    <span className="w-12 flex-shrink-0 text-right pr-4 text-xs text-[var(--color-guardian-text-muted)] select-none py-0.5 border-r border-[var(--color-guardian-border)]">
                      {lineNum}
                    </span>
                    <code className="diff-line flex-1 text-xs py-0.5 whitespace-pre">
                      {line}
                    </code>
                    {issue && (
                      <span
                        className={`badge badge-${issue.severity} text-[10px] mr-2 self-center cursor-pointer`}
                        title={issue.title}
                        onClick={() => setExpandedIssue(issue.id)}
                      >
                        {issue.severity === 'critical' ? '🚨' : '⚠️'} {issue.ruleId}
                      </span>
                    )}
                  </div>
                );
              })}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
