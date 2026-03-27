'use client';

const auditEntries = [
  { id: '1', action: 'create', reviewId: 'rev-142', description: 'Review created for PR #142', user: 'system', timestamp: '2026-03-27T15:30:00Z', metadata: { repository: 'acme/web-app', provider: 'github' } },
  { id: '2', action: 'fix', reviewId: 'rev-142', issueId: 'i1', description: 'Applied auto-fix for SQL injection vulnerability', user: 'sarah', timestamp: '2026-03-27T15:35:00Z', metadata: { ruleId: 'SEC001', severity: 'critical' } },
  { id: '3', action: 'accept', reviewId: 'rev-142', issueId: 'i2', description: 'Accepted: Hardcoded JWT secret finding', user: 'sarah', timestamp: '2026-03-27T15:36:00Z', metadata: { ruleId: 'SEC002', severity: 'critical' } },
  { id: '4', action: 'reject', reviewId: 'rev-142', issueId: 'i5', description: 'Rejected: Console.log — this is intentional debug logging', user: 'sarah', timestamp: '2026-03-27T15:37:00Z', metadata: { ruleId: 'QL002', severity: 'low' } },
  { id: '5', action: 'create', reviewId: 'rev-89', description: 'Review created for PR #89', user: 'system', timestamp: '2026-03-27T14:15:00Z', metadata: { repository: 'acme/api-service', provider: 'github' } },
  { id: '6', action: 'fix', reviewId: 'rev-89', description: 'Applied 3 auto-fixes for security issues', user: 'mike', timestamp: '2026-03-27T14:25:00Z', metadata: { fixCount: 3 } },
  { id: '7', action: 'create', reviewId: 'rev-56', description: 'Review created for MR !56', user: 'system', timestamp: '2026-03-27T12:00:00Z', metadata: { repository: 'acme/mobile-app', provider: 'gitlab' } },
  { id: '8', action: 'accept', reviewId: 'rev-56', description: 'Accepted all findings for MR !56', user: 'alex', timestamp: '2026-03-27T12:30:00Z', metadata: { acceptCount: 14 } },
];

export default function AuditPage() {
  const actionIcons: Record<string, { icon: string; color: string; bg: string }> = {
    create: { icon: '📋', color: '#a5b4fc', bg: 'rgba(99,102,241,0.12)' },
    accept: { icon: '✓', color: '#4ade80', bg: 'rgba(34,197,94,0.12)' },
    fix: { icon: '🔧', color: '#fbbf24', bg: 'rgba(245,158,11,0.12)' },
    reject: { icon: '✕', color: '#f87171', bg: 'rgba(239,68,68,0.12)' },
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold gradient-text">Audit Log</h1>
        <p className="text-[var(--color-guardian-text-secondary)] mt-1">Complete history of all review actions and changes</p>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-6 top-0 bottom-0 w-px bg-[var(--color-guardian-border)]" />

        <div className="space-y-4">
          {auditEntries.map((entry) => {
            const actionStyle = actionIcons[entry.action] ?? actionIcons.create!;
            const time = new Date(entry.timestamp);

            return (
              <div key={entry.id} className="relative pl-16">
                {/* Timeline dot */}
                <div
                  className="absolute left-3.5 w-5 h-5 rounded-full flex items-center justify-center text-xs z-10"
                  style={{ background: actionStyle.bg, color: actionStyle.color }}
                >
                  {actionStyle.icon}
                </div>

                <div className="glass-card p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium">{entry.description}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-[var(--color-guardian-text-muted)]">
                        <span
                          className="px-2 py-0.5 rounded-full font-medium"
                          style={{ background: actionStyle.bg, color: actionStyle.color }}
                        >
                          {entry.action}
                        </span>
                        <span>by @{entry.user}</span>
                        <span>{entry.reviewId}</span>
                        {entry.issueId && <span>• {entry.issueId}</span>}
                      </div>
                    </div>
                    <time className="text-xs text-[var(--color-guardian-text-muted)] flex-shrink-0">
                      {time.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                      <br />
                      {time.toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                    </time>
                  </div>

                  {/* Metadata */}
                  {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                    <div className="mt-2 pt-2 border-t border-[var(--color-guardian-border)] flex gap-3 flex-wrap">
                      {Object.entries(entry.metadata).map(([key, value]) => (
                        <span key={key} className="text-xs px-2 py-0.5 rounded bg-[var(--color-guardian-surface)] text-[var(--color-guardian-text-muted)]">
                          {key}: {String(value)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
