'use client';

import { useState, useEffect } from 'react';
import { ShieldCheck, FileSearch, BarChart3 } from 'lucide-react';

interface StoredReview {
  id: string;
  projectName: string;
  status: string;
  issues: { severity: string; category: string }[];
  confidenceScore: { overall: number; security: number; correctness: number; quality: number; testCoverage: number };
  supportedFiles: number;
  processingTimeMs: number;
  createdAt: string;
}

export default function DashboardPage() {
  const [reviews, setReviews] = useState<StoredReview[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = JSON.parse(localStorage.getItem('guardian-reviews') || '[]');
    setReviews(stored);
  }, []);

  // Compute real stats
  const totalReviews = reviews.length;
  const totalIssues = reviews.reduce((s, r) => s + r.issues.length, 0);
  const avgConfidence = totalReviews > 0
    ? Math.round(reviews.reduce((s, r) => s + r.confidenceScore.overall, 0) / totalReviews)
    : 0;

  // Issues by category
  const categoryCounts: Record<string, number> = {};
  reviews.forEach((r) =>
    r.issues.forEach((i) => {
      categoryCounts[i.category] = (categoryCounts[i.category] || 0) + 1;
    })
  );

  const categoryColors: Record<string, string> = {
    security: '#ef4444', hallucination: '#a855f7', bug_risk: '#f59e0b',
    performance: '#3b82f6', code_smell: '#6366f1', type_safety: '#22c55e',
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Dashboard</h1>
          <p className="text-[var(--color-guardian-text-secondary)] mt-1">
            Your automated code review workspace
          </p>
        </div>
        <a href="/upload" className="btn-primary flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Upload Project
        </a>
      </div>

      {/* Empty State */}
      {totalReviews === 0 && mounted && (
        <div className="glass-card p-16 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[var(--color-guardian-gradient-start)] to-[var(--color-guardian-gradient-end)] flex items-center justify-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-2">Welcome to Code Guardian</h2>
          <p className="text-[var(--color-guardian-text-secondary)] max-w-md mx-auto mb-6">
            Upload your project files to get instant automated security analysis, invalid API detection, and code quality feedback.
          </p>
          <a href="/upload" className="btn-primary text-lg px-8 py-3.5 inline-flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload Your First Project
          </a>

          <div className="grid grid-cols-3 gap-4 mt-10 max-w-xl mx-auto">
            {[
              { icon: <ShieldCheck size={28} className="mx-auto text-[var(--color-guardian-accent)]" />, title: 'Security Analysis', desc: 'SQL injection, XSS, secrets detection' },
              { icon: <FileSearch size={28} className="mx-auto text-[var(--color-guardian-accent)]" />, title: 'Robustness Check', desc: 'Catches invalid functions & bad practices' },
              { icon: <BarChart3 size={28} className="mx-auto text-[var(--color-guardian-accent)]" />, title: 'Quality Scoring', desc: 'Multi-dimensional confidence score' },
            ].map((item) => (
              <div key={item.title} className="text-center">
                <div className="mb-3">{item.icon}</div>
                <h4 className="text-xs font-semibold">{item.title}</h4>
                <p className="text-xs text-[var(--color-guardian-text-muted)] mt-1">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      {totalReviews > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard title="Total Reviews" value={totalReviews} icon="shield" mounted={mounted} />
            <StatCard title="Issues Found" value={totalIssues} icon="alert" mounted={mounted} />
            <StatCard
              title="Clean Reviews"
              value={reviews.filter((r) => r.issues.length === 0).length}
              icon="check"
              mounted={mounted}
            />
            <StatCard title="Avg Confidence" value={avgConfidence} suffix="/100" icon="chart" mounted={mounted} />
          </div>

          {/* Issues by Category */}
          {Object.keys(categoryCounts).length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold mb-4">Issues by Category</h3>
                <div className="space-y-3">
                  {Object.entries(categoryCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, count]) => {
                      const maxCount = Math.max(...Object.values(categoryCounts));
                      const width = (count / maxCount) * 100;
                      return (
                        <div key={cat} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="capitalize text-[var(--color-guardian-text-secondary)]">
                              {cat.replace('_', ' ')}
                            </span>
                            <span className="font-medium">{count}</span>
                          </div>
                          <div className="confidence-bar">
                            <div
                              className="confidence-bar-fill"
                              style={{
                                width: mounted ? `${width}%` : '0%',
                                background: categoryColors[cat] || '#6366f1',
                                transition: 'width 1s ease-out',
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Confidence Distribution */}
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold mb-4">Score Distribution</h3>
                <div className="space-y-3">
                  {reviews.map((r) => (
                    <div key={r.id} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                        r.confidenceScore.overall >= 80 ? 'bg-[rgba(34,197,94,0.12)] text-[#4ade80]' :
                        r.confidenceScore.overall >= 60 ? 'bg-[rgba(245,158,11,0.12)] text-[#fbbf24]' :
                        'bg-[rgba(239,68,68,0.12)] text-[#f87171]'
                      }`}>
                        {r.confidenceScore.overall}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{r.projectName}</div>
                        <div className="text-xs text-[var(--color-guardian-text-muted)]">
                          {r.issues.length} issues · {r.supportedFiles} files
                        </div>
                      </div>
                      <div className="confidence-bar w-24 flex-shrink-0">
                        <div
                          className={`confidence-bar-fill ${r.confidenceScore.overall >= 80 ? 'high' : r.confidenceScore.overall >= 60 ? 'moderate' : 'low'}`}
                          style={{ width: mounted ? `${r.confidenceScore.overall}%` : '0%', transition: 'width 1s ease-out' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Recent Reviews */}
          <div className="glass-card overflow-hidden">
            <div className="p-5 border-b border-[var(--color-guardian-border)] flex items-center justify-between">
              <h3 className="text-lg font-semibold">Recent Reviews</h3>
              <a href="/upload" className="text-sm text-[var(--color-guardian-accent)] hover:text-[var(--color-guardian-accent-hover)] transition-colors">
                Upload New →
              </a>
            </div>
            <div className="divide-y divide-[var(--color-guardian-border)]">
              {reviews.map((review) => {
                const scoreColor = review.confidenceScore.overall >= 80 ? '#4ade80' :
                  review.confidenceScore.overall >= 60 ? '#fbbf24' : '#f87171';
                const timeAgo = getTimeAgo(review.createdAt);

                return (
                  <a
                    key={review.id}
                    href={`/review/${review.id}`}
                    className="flex items-center gap-4 p-4 hover:bg-[var(--color-guardian-surface-hover)] transition-colors"
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm`}
                      style={{ background: `${scoreColor}15`, color: scoreColor }}
                    >
                      {review.confidenceScore.overall}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{review.projectName}</div>
                      <div className="text-xs text-[var(--color-guardian-text-muted)] mt-0.5">
                        {review.supportedFiles} files · {timeAgo}
                      </div>
                    </div>
                    <div className="text-sm font-medium flex-shrink-0">
                      {review.issues.length === 0 ? (
                        <span className="text-[#4ade80]">✓ Clean</span>
                      ) : (
                        <span className="text-[var(--color-guardian-warning)]">{review.issues.length} issues</span>
                      )}
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-guardian-text-muted)" strokeWidth="2">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </a>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ title, value, icon, suffix, mounted }: {
  title: string; value: number; icon: string; suffix?: string; mounted: boolean;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (!mounted) return;
    const duration = 1200;
    const steps = 40;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) { setDisplayValue(value); clearInterval(timer); }
      else setDisplayValue(Math.floor(current));
    }, duration / steps);
    return () => clearInterval(timer);
  }, [mounted, value]);

  const iconMap: Record<string, React.ReactNode> = {
    shield: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
    alert: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>,
    check: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" /></svg>,
    chart: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" /></svg>,
  };

  return (
    <div className="glass-card p-5 group">
      <div className="w-10 h-10 rounded-xl bg-[var(--color-guardian-accent-glow)] flex items-center justify-center text-[var(--color-guardian-accent)] group-hover:scale-110 transition-transform duration-300 mb-3">
        {iconMap[icon]}
      </div>
      <div className="text-2xl font-bold">{displayValue.toLocaleString()}{suffix}</div>
      <div className="text-sm text-[var(--color-guardian-text-muted)] mt-1">{title}</div>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
