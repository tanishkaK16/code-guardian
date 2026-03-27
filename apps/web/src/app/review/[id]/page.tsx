'use client';

import { useState, useEffect, use } from 'react';
import { PartyPopper, Lightbulb } from 'lucide-react';

interface ReviewIssue {
  id: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  location: { file: string; startLine: number; endLine: number };
  suggestedFix?: string;
  confidence: number;
  ruleId?: string;
  codeSnippet?: string;
}

interface ReviewData {
  id: string;
  projectName: string;
  status: string;
  issues: ReviewIssue[];
  confidenceScore: {
    overall: number;
    security: number;
    correctness: number;
    quality: number;
    testCoverage: number;
  };
  summary: string;
  filesAnalyzed: { name: string; language: string; lines: number; issueCount: number }[];
  totalFiles: number;
  supportedFiles: number;
  processingTimeMs: number;
  createdAt: string;
}

export default function ReviewResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [review, setReview] = useState<ReviewData | null>(null);
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
  const [issueActions, setIssueActions] = useState<Record<string, string>>({});
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Load review from localStorage
    const reviews = JSON.parse(localStorage.getItem('guardian-reviews') || '[]');
    const found = reviews.find((r: ReviewData) => r.id === id);
    if (found) {
      setReview(found);
      if (found.issues.length > 0) {
        setExpandedIssue(found.issues[0].id);
        setActiveFile(found.issues[0].location.file);
      }
    }
  }, [id]);

  if (!mounted) return null;

  if (!review) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="glass-card p-8 text-center">
          <h2 className="text-xl font-bold mb-2">Review Not Found</h2>
          <p className="text-[var(--color-guardian-text-secondary)] mb-4">
            This review may have been cleared from your browser.
          </p>
          <a href="/upload" className="btn-primary text-sm px-6 py-2.5">Upload New Project</a>
        </div>
      </div>
    );
  }

  const handleAction = (issueId: string, action: string) => {
    setIssueActions((prev) => ({ ...prev, [issueId]: action }));
  };

  const getConfLevel = (s: number) => (s >= 80 ? 'high' : s >= 60 ? 'moderate' : 'low');

  const issuesForFile = activeFile
    ? review.issues.filter((i) => i.location.file === activeFile)
    : review.issues;

  const severityCounts = {
    critical: review.issues.filter((i) => i.severity === 'critical').length,
    high: review.issues.filter((i) => i.severity === 'high').length,
    medium: review.issues.filter((i) => i.severity === 'medium').length,
    low: review.issues.filter((i) => i.severity === 'low').length,
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <a href="/upload" className="text-[var(--color-guardian-text-muted)] hover:text-[var(--color-guardian-text)] transition-colors">
              ← Upload
            </a>
            <span className="text-[var(--color-guardian-text-muted)]">/</span>
            <span className="text-sm text-[var(--color-guardian-text-secondary)]">Review Results</span>
          </div>
          <h1 className="text-2xl font-bold">{review.projectName}</h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-[var(--color-guardian-text-secondary)]">
            <span>{review.supportedFiles} files analyzed</span>
            <span>•</span>
            <span>{review.issues.length} issues found</span>
            <span>•</span>
            <span>{(review.processingTimeMs / 1000).toFixed(1)}s</span>
          </div>
        </div>

        {/* Overall Score */}
        <div className="glass-card p-5 text-center glow-accent">
          <div className={`text-4xl font-bold ${
            review.confidenceScore.overall >= 80 ? 'text-[#4ade80]' :
            review.confidenceScore.overall >= 60 ? 'text-[#fbbf24]' : 'text-[#f87171]'
          }`}>
            {review.confidenceScore.overall}
          </div>
          <div className="text-xs text-[var(--color-guardian-text-muted)] mt-1">Confidence Score</div>
        </div>
      </div>

      {/* Severity Summary */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Critical', count: severityCounts.critical, color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
          { label: 'High', count: severityCounts.high, color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
          { label: 'Medium', count: severityCounts.medium, color: '#eab308', bg: 'rgba(234,179,8,0.12)' },
          { label: 'Low', count: severityCounts.low, color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
        ].map((item) => (
          <div key={item.label} className="glass-card p-4 flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
              style={{ background: item.bg, color: item.color }}
            >
              {item.count}
            </div>
            <div>
              <div className="text-sm font-medium">{item.label}</div>
              <div className="text-xs text-[var(--color-guardian-text-muted)]">issues</div>
            </div>
          </div>
        ))}
      </div>

      {/* Confidence Breakdown */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Security', score: review.confidenceScore.security },
          { label: 'Correctness', score: review.confidenceScore.correctness },
          { label: 'Quality', score: review.confidenceScore.quality },
          { label: 'Test Coverage', score: review.confidenceScore.testCoverage },
        ].map((dim) => (
          <div key={dim.label} className="glass-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-[var(--color-guardian-text-secondary)]">{dim.label}</span>
              <span className="text-sm font-semibold">{dim.score}</span>
            </div>
            <div className="confidence-bar">
              <div
                className={`confidence-bar-fill ${getConfLevel(dim.score)}`}
                style={{ width: mounted ? `${dim.score}%` : '0%', transition: 'width 1s ease-out' }}
              />
            </div>
          </div>
        ))}
      </div>

      {review.issues.length === 0 ? (
        /* Clean Code Celebration */
        <div className="glass-card p-12 text-center glow-accent">
          <div className="flex justify-center mb-4">
            <PartyPopper size={64} className="text-[#4ade80]" />
          </div>
          <h2 className="text-2xl font-bold text-[#4ade80] mb-2">Clean Code!</h2>
          <p className="text-[var(--color-guardian-text-secondary)]">
            No issues found. Your code passed all {review.supportedFiles > 1 ? `${review.supportedFiles} files` : 'the'} security and quality checks.
          </p>
          <a href="/upload" className="btn-primary mt-6 inline-block px-6 py-2.5">
            Analyze Another Project
          </a>
        </div>
      ) : (
        /* Issues + File sidebar */
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          {/* File Sidebar */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-[var(--color-guardian-text-muted)] uppercase tracking-wider">Files</h3>
            <button
              onClick={() => setActiveFile(null)}
              className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-all ${
                !activeFile ? 'bg-[var(--color-guardian-accent-glow)] text-[var(--color-guardian-accent)] font-medium' : 'text-[var(--color-guardian-text-secondary)] hover:bg-[var(--color-guardian-surface-hover)]'
              }`}
            >
              All Files ({review.issues.length} issues)
            </button>
            {review.filesAnalyzed.map((file) => (
              <button
                key={file.name}
                onClick={() => setActiveFile(file.name)}
                className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-all ${
                  activeFile === file.name ? 'bg-[var(--color-guardian-accent-glow)] text-[var(--color-guardian-accent)] font-medium' : 'text-[var(--color-guardian-text-secondary)] hover:bg-[var(--color-guardian-surface-hover)]'
                }`}
              >
                <div className="truncate font-mono text-xs">{file.name.split('/').pop()}</div>
                <div className="text-xs text-[var(--color-guardian-text-muted)] mt-0.5">
                  {file.issueCount > 0 ? (
                    <span className="text-[var(--color-guardian-warning)]">{file.issueCount} issues</span>
                  ) : (
                    <span className="text-[var(--color-guardian-success)]">✓ clean</span>
                  )} · {file.lines} lines
                </div>
              </button>
            ))}
          </div>

          {/* Issues List */}
          <div className="lg:col-span-3 space-y-3">
            <h3 className="text-sm font-semibold text-[var(--color-guardian-text-muted)] uppercase tracking-wider">
              {activeFile ? activeFile.split('/').pop() : 'All Issues'} ({issuesForFile.length})
            </h3>

            {issuesForFile.map((issue) => {
              const status = issueActions[issue.id] ?? 'open';
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
                    <span className={`badge badge-${issue.severity} mt-0.5 flex-shrink-0`}>
                      {issue.severity}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{issue.title}</div>
                      <div className="text-xs text-[var(--color-guardian-text-muted)] mt-1 font-mono">
                        {issue.location.file}:{issue.location.startLine}
                        {issue.ruleId && <span className="ml-2 text-[var(--color-guardian-accent)]">[{issue.ruleId}]</span>}
                        <span className="ml-2">{Math.round(issue.confidence * 100)}% confidence</span>
                      </div>
                    </div>
                    {status !== 'open' && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
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
                      className={`transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
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

                      {/* Code snippet */}
                      {issue.codeSnippet && (
                        <div className="rounded-lg overflow-hidden border border-[var(--color-guardian-border)]">
                          <div className="bg-[var(--color-guardian-surface)] px-3 py-1.5 text-xs font-mono text-[var(--color-guardian-text-muted)] border-b border-[var(--color-guardian-border)]">
                            📍 {issue.location.file}
                          </div>
                          <pre className="p-3 text-xs overflow-x-auto font-[var(--font-mono)] leading-relaxed">
                            {issue.codeSnippet.split('\n').map((line, i) => (
                              <div
                                key={i}
                                className={line.startsWith('>>>') ? 'bg-[rgba(239,68,68,0.1)] text-[var(--color-guardian-danger)] font-medium' : 'text-[var(--color-guardian-text-secondary)]'}
                              >
                                {line}
                              </div>
                            ))}
                          </pre>
                        </div>
                      )}

                      {/* Suggested fix */}
                      {issue.suggestedFix && (
                        <div className="bg-[rgba(34,197,94,0.06)] rounded-lg p-3 border border-[rgba(34,197,94,0.15)]">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#4ade80] mb-1">
                            <Lightbulb size={14} />
                            Suggested Fix
                          </div>
                          <p className="text-xs text-[var(--color-guardian-text-secondary)]">
                            {issue.suggestedFix}
                          </p>
                        </div>
                      )}

                      {/* Action Buttons */}
                      {status === 'open' && (
                        <div className="flex items-center gap-2 pt-2">
                          <button
                            className="text-xs px-4 py-2 rounded-lg font-medium transition-all hover:scale-105 bg-[rgba(34,197,94,0.15)] text-[#4ade80] hover:bg-[rgba(34,197,94,0.25)]"
                            onClick={(e) => { e.stopPropagation(); handleAction(issue.id, 'accept'); }}
                          >
                            ✓ Accept
                          </button>
                          <button
                            className="text-xs px-4 py-2 rounded-lg font-medium transition-all hover:scale-105 bg-[rgba(239,68,68,0.15)] text-[#f87171] hover:bg-[rgba(239,68,68,0.25)]"
                            onClick={(e) => { e.stopPropagation(); handleAction(issue.id, 'reject'); }}
                          >
                            ✕ Dismiss
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-center gap-4 pt-4">
        <a href="/upload" className="btn-primary px-6 py-2.5">
          Analyze Another Project
        </a>
        <a href="/" className="btn-secondary px-6 py-2.5">
          Go to Dashboard
        </a>
      </div>
    </div>
  );
}
