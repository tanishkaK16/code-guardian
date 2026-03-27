'use client';

import { useState } from 'react';

export default function SettingsPage() {
  const [aiProvider, setAiProvider] = useState('gemini');
  const [autoFix, setAutoFix] = useState(false);
  const [testGen, setTestGen] = useState(true);
  const [severity, setSeverity] = useState('low');
  const [saved, setSaved] = useState(false);
  const [categories, setCategories] = useState({
    security: true,
    hallucination: true,
    bug_risk: true,
    performance: true,
    code_smell: true,
    type_safety: true,
    test_coverage: true,
  });

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleCategory = (key: string) => {
    setCategories((prev) => ({ ...prev, [key]: !prev[key as keyof typeof prev] }));
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold gradient-text">Settings</h1>
        <p className="text-[var(--color-guardian-text-secondary)] mt-1">Configure your AI Code Guardian preferences</p>
      </div>

      {/* AI Provider */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold mb-4">AI Provider</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { id: 'gemini', name: 'Google Gemini', desc: 'Gemini 2.5 Pro', badge: 'Recommended' },
            { id: 'anthropic', name: 'Anthropic Claude', desc: 'Claude 3.5 Sonnet', badge: '' },
          ].map((provider) => (
            <button
              key={provider.id}
              onClick={() => setAiProvider(provider.id)}
              className={`p-4 rounded-xl text-left transition-all border ${
                aiProvider === provider.id
                  ? 'border-[var(--color-guardian-accent)] bg-[var(--color-guardian-accent-glow)]'
                  : 'border-[var(--color-guardian-border)] bg-[var(--color-guardian-surface)] hover:bg-[var(--color-guardian-surface-hover)]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{provider.name}</span>
                {provider.badge && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-guardian-accent)] text-white">
                    {provider.badge}
                  </span>
                )}
              </div>
              <span className="text-xs text-[var(--color-guardian-text-muted)] mt-1">{provider.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Analysis Settings */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold mb-4">Analysis Settings</h2>
        <div className="space-y-5">
          {/* Auto Fix */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium">Auto-Fix Issues</span>
              <p className="text-xs text-[var(--color-guardian-text-muted)] mt-0.5">Automatically apply AI-generated fixes when confidence is high</p>
            </div>
            <button
              onClick={() => setAutoFix(!autoFix)}
              className={`w-12 h-6 rounded-full transition-all ${autoFix ? 'bg-[var(--color-guardian-accent)]' : 'bg-[var(--color-guardian-border)]'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-transform ${autoFix ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* Test Generation */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium">Test Generation</span>
              <p className="text-xs text-[var(--color-guardian-text-muted)] mt-0.5">Generate and run Vitest tests in sandbox for every review</p>
            </div>
            <button
              onClick={() => setTestGen(!testGen)}
              className={`w-12 h-6 rounded-full transition-all ${testGen ? 'bg-[var(--color-guardian-accent)]' : 'bg-[var(--color-guardian-border)]'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-transform ${testGen ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* Severity Threshold */}
          <div>
            <span className="text-sm font-medium">Severity Threshold</span>
            <p className="text-xs text-[var(--color-guardian-text-muted)] mt-0.5 mb-3">Only report issues at or above this severity level</p>
            <div className="flex gap-2">
              {['info', 'low', 'medium', 'high', 'critical'].map((sev) => (
                <button
                  key={sev}
                  onClick={() => setSeverity(sev)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                    severity === sev
                      ? `badge-${sev}`
                      : 'bg-[var(--color-guardian-surface)] text-[var(--color-guardian-text-muted)] border border-[var(--color-guardian-border)]'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold mb-4">Enabled Categories</h2>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(categories).map(([key, enabled]) => (
            <button
              key={key}
              onClick={() => toggleCategory(key)}
              className={`p-3 rounded-xl text-left text-sm capitalize transition-all border ${
                enabled
                  ? 'border-[var(--color-guardian-accent)] bg-[var(--color-guardian-accent-glow)] text-[var(--color-guardian-text)]'
                  : 'border-[var(--color-guardian-border)] bg-[var(--color-guardian-surface)] text-[var(--color-guardian-text-muted)]'
              }`}
            >
              <span className="mr-2">{enabled ? '✓' : '○'}</span>
              {key.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Git Integration */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold mb-4">Git Integration</h2>
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-[var(--color-guardian-border)] bg-[var(--color-guardian-surface)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-[var(--color-guardian-text)]">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              <div>
                <span className="text-sm font-medium">GitHub</span>
                <p className="text-xs text-[var(--color-guardian-text-muted)]">Connect to receive PR webhooks</p>
              </div>
            </div>
            <button className="btn-primary text-xs px-4 py-2">Connect</button>
          </div>

          <div className="p-4 rounded-xl border border-[var(--color-guardian-border)] bg-[var(--color-guardian-surface)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-[#e24329]">
                <path d="m23.6 9.593-.033-.086L20.3.98a.851.851 0 0 0-.336-.382.859.859 0 0 0-.992.07.856.856 0 0 0-.27.397l-2.208 6.763H7.506L5.298 1.065a.856.856 0 0 0-.27-.398.859.859 0 0 0-.992-.069.854.854 0 0 0-.336.382L.433 9.502l-.032.09a6.033 6.033 0 0 0 2.004 6.97l.01.009.027.019 4.948 3.702 2.448 1.852 1.49 1.126a1.014 1.014 0 0 0 1.224 0l1.49-1.126 2.447-1.852 4.976-3.722.012-.01a6.036 6.036 0 0 0 2.002-6.967z" />
              </svg>
              <div>
                <span className="text-sm font-medium">GitLab</span>
                <p className="text-xs text-[var(--color-guardian-text-muted)]">Connect for merge request analysis</p>
              </div>
            </div>
            <button className="btn-secondary text-xs px-4 py-2">Connect</button>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button onClick={handleSave} className="btn-primary">
          {saved ? '✓ Saved!' : 'Save Settings'}
        </button>
        {saved && <span className="text-sm text-[var(--color-guardian-success)]">Settings saved successfully</span>}
      </div>
    </div>
  );
}
