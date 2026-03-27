-- AI Code Guardian Database Schema
-- Run via Supabase SQL editor or migration

-- ─── Reviews ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  pr_number INTEGER,
  pr_title TEXT,
  pr_url TEXT,
  repository TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('github', 'gitlab')),
  author TEXT,
  branch TEXT,
  ai_provider TEXT NOT NULL DEFAULT 'gemini',
  confidence_overall INTEGER DEFAULT 0,
  confidence_security INTEGER DEFAULT 0,
  confidence_correctness INTEGER DEFAULT 0,
  confidence_quality INTEGER DEFAULT 0,
  confidence_test_coverage INTEGER DEFAULT 0,
  issues_count INTEGER DEFAULT 0,
  summary TEXT,
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  user_id UUID REFERENCES auth.users(id)
);

-- ─── Issues ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  suggested_fix TEXT,
  confidence NUMERIC(3,2) DEFAULT 0.5,
  rule_id TEXT,
  ai_reasoning TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'fixed', 'rejected', 'ignored')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Generated Tests ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS generated_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  target_file TEXT NOT NULL,
  test_code TEXT NOT NULL,
  test_framework TEXT DEFAULT 'vitest',
  passed_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  total_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Audit Log ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID REFERENCES reviews(id) ON DELETE SET NULL,
  issue_id UUID REFERENCES issues(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('accept', 'fix', 'reject', 'create', 'update', 'delete')),
  user_id UUID REFERENCES auth.users(id),
  previous_value TEXT,
  new_value TEXT,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── User Settings ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id),
  ai_provider TEXT DEFAULT 'gemini',
  enabled_categories TEXT[] DEFAULT ARRAY['security', 'hallucination', 'bug_risk', 'performance', 'code_smell', 'type_safety'],
  severity_threshold TEXT DEFAULT 'low',
  auto_fix_enabled BOOLEAN DEFAULT false,
  test_generation_enabled BOOLEAN DEFAULT true,
  github_token_encrypted TEXT,
  gitlab_token_encrypted TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_repo ON reviews(repository);
CREATE INDEX IF NOT EXISTS idx_reviews_created ON reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);
CREATE INDEX IF NOT EXISTS idx_issues_review ON issues(review_id);
CREATE INDEX IF NOT EXISTS idx_issues_severity ON issues(severity);
CREATE INDEX IF NOT EXISTS idx_audit_log_review ON audit_log(review_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);

-- ─── Row Level Security ─────────────────────────────────────
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own reviews" ON reviews
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own issues" ON issues
  FOR SELECT USING (
    review_id IN (SELECT id FROM reviews WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view own audit log" ON audit_log
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage own settings" ON user_settings
  FOR ALL USING (user_id = auth.uid());

-- Service role can do everything
CREATE POLICY "Service role full access to reviews" ON reviews
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to issues" ON issues
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to tests" ON generated_tests
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to audit_log" ON audit_log
  FOR ALL USING (auth.role() = 'service_role');
