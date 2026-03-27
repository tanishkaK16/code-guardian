import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Code Guardian — Automated Code Review Dashboard',
  description: 'Automated code review, security analysis, test generation, and invalid API detection for your projects.',
  keywords: ['code review', 'security', 'testing', 'static analysis', 'code quality'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased">
        {/* Floating particles background */}
        <div className="particles-bg" aria-hidden="true">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="particle"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 15}s`,
                animationDuration: `${15 + Math.random() * 10}s`,
              }}
            />
          ))}
        </div>

        {/* App content */}
        <div className="relative z-10 flex min-h-screen">
          {/* Sidebar */}
          <Sidebar />

          {/* Main content */}
          <main className="flex-1 ml-64 p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

// ─── Sidebar Component ──────────────────────────────────────

function Sidebar() {
  const navItems = [
    { label: 'Dashboard', href: '/', icon: 'grid' },
    { label: 'Upload', href: '/upload', icon: 'upload', primary: true },
    { label: 'Reviews', href: '/reviews', icon: 'search' },
    { label: 'Audit Log', href: '/audit', icon: 'clipboard' },
    { label: 'Settings', href: '/settings', icon: 'settings' },
  ];

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 glass-card rounded-none border-r border-[var(--color-guardian-border)] flex flex-col z-50">
      {/* Logo */}
      <div className="p-6 border-b border-[var(--color-guardian-border)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-guardian-gradient-start)] to-[var(--color-guardian-gradient-end)] flex items-center justify-center glow-accent">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-bold gradient-text">Code Guardian</h1>
            <p className="text-xs text-[var(--color-guardian-text-muted)]">Automated Review</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
              'primary' in item && item.primary
                ? 'bg-gradient-to-r from-[var(--color-guardian-gradient-start)] to-[var(--color-guardian-gradient-end)] text-white hover:opacity-90'
                : 'text-[var(--color-guardian-text-secondary)] hover:text-[var(--color-guardian-text)] hover:bg-[var(--color-guardian-surface-hover)]'
            }`}
          >
            <NavIcon name={item.icon} />
            {item.label}
          </a>
        ))}
      </nav>

      {/* Status */}
      <div className="p-4 border-t border-[var(--color-guardian-border)]">
        <div className="glass-card p-3 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-[var(--color-guardian-success)] pulse-glow" />
            <span className="text-xs font-medium text-[var(--color-guardian-success)]">System Online</span>
          </div>
          <p className="text-xs text-[var(--color-guardian-text-muted)]">
            Monitoring active repositories
          </p>
        </div>
      </div>
    </aside>
  );
}

function NavIcon({ name }: { name: string }) {
  const icons: Record<string, React.ReactNode> = {
    grid: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
    upload: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
    search: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
      </svg>
    ),
    clipboard: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      </svg>
    ),
    settings: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  };

  return <>{icons[name] ?? null}</>;
}

