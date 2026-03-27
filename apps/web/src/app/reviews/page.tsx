'use client';

import { useState } from 'react';

const sampleReviews = [
  { id: '1', repository: 'acme/web-app', prTitle: 'feat: Add user authentication flow', prNumber: 142, confidence: 92, issues: 3, status: 'completed', createdAt: '2026-03-27T15:30:00Z', provider: 'github', author: 'sarah' },
  { id: '2', repository: 'acme/api-service', prTitle: 'fix: Database connection pooling', prNumber: 89, confidence: 67, issues: 8, status: 'completed', createdAt: '2026-03-27T14:15:00Z', provider: 'github', author: 'mike' },
  { id: '3', repository: 'acme/mobile-app', prTitle: 'refactor: Payment processing module', prNumber: 56, confidence: 45, issues: 14, status: 'completed', createdAt: '2026-03-27T12:00:00Z', provider: 'gitlab', author: 'alex' },
  { id: '4', repository: 'acme/web-app', prTitle: 'chore: Update dependencies to latest', prNumber: 143, confidence: 98, issues: 0, status: 'completed', createdAt: '2026-03-27T10:30:00Z', provider: 'github', author: 'sarah' },
  { id: '5', repository: 'acme/data-pipeline', prTitle: 'feat: Real-time streaming pipeline', prNumber: 23, confidence: 78, issues: 5, status: 'in_progress', createdAt: '2026-03-27T09:00:00Z', provider: 'gitlab', author: 'dave' },
  { id: '6', repository: 'acme/frontend', prTitle: 'feat: New design system components', prNumber: 201, confidence: 88, issues: 2, status: 'completed', createdAt: '2026-03-26T16:00:00Z', provider: 'github', author: 'emma' },
  { id: '7', repository: 'acme/backend', prTitle: 'fix: Rate limiter bypass vulnerability', prNumber: 134, confidence: 35, issues: 18, status: 'completed', createdAt: '2026-03-26T14:45:00Z', provider: 'github', author: 'mike' },
  { id: '8', repository: 'acme/web-app', prTitle: 'feat: Add dark mode support', prNumber: 140, confidence: 95, issues: 1, status: 'completed', createdAt: '2026-03-26T11:20:00Z', provider: 'github', author: 'alex' },
];

export default function ReviewsPage() {
  const [filter, setFilter] = useState<'all' | 'critical' | 'clean'>('all');
  const [search, setSearch] = useState('');

  const filtered = sampleReviews.filter((r) => {
    if (filter === 'critical' && r.confidence >= 70) return false;
    if (filter === 'clean' && r.issues > 0) return false;
    if (search && !r.prTitle.toLowerCase().includes(search.toLowerCase()) && !r.repository.includes(search)) return false;
    return true;
  });

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Reviews</h1>
          <p className="text-[var(--color-guardian-text-secondary)] mt-1">All code reviews across your repositories</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-guardian-text-muted)]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Search reviews..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--color-guardian-surface)] border border-[var(--color-guardian-border)] text-sm text-[var(--color-guardian-text)] placeholder-[var(--color-guardian-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-guardian-accent)] focus:border-[var(--color-guardian-accent)] transition-all"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'critical', 'clean'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === f
                  ? 'bg-[var(--color-guardian-accent)] text-white'
                  : 'bg-[var(--color-guardian-surface)] text-[var(--color-guardian-text-secondary)] border border-[var(--color-guardian-border)] hover:bg-[var(--color-guardian-surface-hover)]'
              }`}
            >
              {f === 'all' ? 'All' : f === 'critical' ? '🚨 Needs Attention' : '✅ Clean'}
            </button>
          ))}
        </div>
      </div>

      {/* Reviews Grid */}
      <div className="grid gap-4">
        {filtered.map((review) => {
          const scoreColor = review.confidence >= 80 ? '#4ade80' : review.confidence >= 60 ? '#fbbf24' : '#f87171';
          const timeDiff = Date.now() - new Date(review.createdAt).getTime();
          const hoursAgo = Math.floor(timeDiff / 3600000);

          return (
            <a
              key={review.id}
              href={`/reviews/${review.id}`}
              className="glass-card p-5 flex items-center gap-5 hover:border-[var(--color-guardian-border-hover)] transition-all group"
            >
              {/* Score Ring */}
              <div className="relative flex-shrink-0">
                <svg width="56" height="56" viewBox="0 0 56 56">
                  <circle cx="28" cy="28" r="24" fill="none" stroke="var(--color-guardian-border)" strokeWidth="3" />
                  <circle
                    cx="28" cy="28" r="24" fill="none" stroke={scoreColor} strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${(review.confidence / 100) * 150.8} 150.8`}
                    transform="rotate(-90 28 28)"
                    className="transition-all duration-1000"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold" style={{ color: scoreColor }}>
                  {review.confidence}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold truncate group-hover:text-[var(--color-guardian-accent)] transition-colors">
                    {review.prTitle}
                  </h3>
                  <span className="text-xs text-[var(--color-guardian-text-muted)] flex-shrink-0">#{review.prNumber}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-[var(--color-guardian-text-muted)]">
                  <span>{review.repository}</span>
                  <span className="px-1.5 py-0.5 rounded bg-[var(--color-guardian-surface)] border border-[var(--color-guardian-border)]">
                    {review.provider}
                  </span>
                  <span>@{review.author}</span>
                  <span>{hoursAgo}h ago</span>
                </div>
              </div>

              {/* Issues */}
              <div className="flex items-center gap-4 flex-shrink-0">
                {review.issues === 0 ? (
                  <span className="text-sm text-[var(--color-guardian-success)] font-medium">✓ Clean</span>
                ) : (
                  <span className="text-sm text-[var(--color-guardian-warning)] font-medium">{review.issues} issues</span>
                )}

                {review.status === 'in_progress' ? (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-[var(--color-guardian-warning)] pulse-glow" />
                    <span className="text-xs text-[var(--color-guardian-warning)]">In Progress</span>
                  </div>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-guardian-text-muted)" strokeWidth="2" className="group-hover:translate-x-1 transition-transform">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                )}
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
