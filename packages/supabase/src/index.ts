/**
 * Supabase Client & Data Access Layer
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  ReviewResult,
  ReviewIssue,
  AuditLogEntry,
  ActionType,
  DashboardStats,
  IssueCategory,
  Severity,
} from '@ai-code-guardian/core';

interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
}

export class GuardianDatabase {
  private client: SupabaseClient;
  private serviceClient?: SupabaseClient;

  constructor(config: SupabaseConfig) {
    this.client = createClient(config.url, config.anonKey);

    if (config.serviceRoleKey) {
      this.serviceClient = createClient(config.url, config.serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }
  }

  /**
   * Get admin client (service role) for server-side operations.
   */
  private get admin(): SupabaseClient {
    return this.serviceClient ?? this.client;
  }

  // ─── Reviews ──────────────────────────────────────────────

  async saveReview(review: ReviewResult, prInfo?: {
    number?: number;
    title?: string;
    url?: string;
    repository: string;
    provider: 'github' | 'gitlab';
    author?: string;
    branch?: string;
  }, userId?: string): Promise<string> {
    const { data, error } = await this.admin
      .from('reviews')
      .insert({
        id: review.id,
        status: review.status,
        pr_number: prInfo?.number,
        pr_title: prInfo?.title,
        pr_url: prInfo?.url,
        repository: prInfo?.repository ?? 'local',
        provider: prInfo?.provider ?? 'github',
        author: prInfo?.author,
        branch: prInfo?.branch,
        ai_provider: review.aiProvider,
        confidence_overall: review.confidenceScore.overall,
        confidence_security: review.confidenceScore.security,
        confidence_correctness: review.confidenceScore.correctness,
        confidence_quality: review.confidenceScore.quality,
        confidence_test_coverage: review.confidenceScore.testCoverage,
        issues_count: review.issues.length,
        summary: review.summary,
        processing_time_ms: review.processingTimeMs,
        completed_at: review.completedAt,
        user_id: userId,
      })
      .select('id')
      .single();

    if (error) throw new Error(`Failed to save review: ${error.message}`);

    // Save issues
    if (review.issues.length > 0) {
      const issueRows = review.issues.map((issue) => ({
        id: issue.id,
        review_id: review.id,
        category: issue.category,
        severity: issue.severity,
        title: issue.title,
        description: issue.description,
        file_path: issue.location.file,
        start_line: issue.location.startLine,
        end_line: issue.location.endLine,
        suggested_fix: issue.suggestedFix,
        confidence: issue.confidence,
        rule_id: issue.ruleId,
        ai_reasoning: issue.aiReasoning,
      }));

      const { error: issueError } = await this.admin.from('issues').insert(issueRows);
      if (issueError) console.error('Failed to save issues:', issueError);
    }

    // Save generated tests
    if (review.generatedTests.length > 0) {
      const testRows = review.generatedTests.map((test) => {
        const results = test.results ?? [];
        return {
          id: test.id,
          review_id: review.id,
          target_file: test.targetFile,
          test_code: test.testCode,
          test_framework: test.testFramework,
          passed_count: results.filter((r) => r.status === 'passed').length,
          failed_count: results.filter((r) => r.status === 'failed').length,
          total_count: results.length,
        };
      });

      const { error: testError } = await this.admin.from('generated_tests').insert(testRows);
      if (testError) console.error('Failed to save tests:', testError);
    }

    return data?.id ?? review.id;
  }

  async getReview(id: string): Promise<Record<string, unknown> | null> {
    const { data, error } = await this.client
      .from('reviews')
      .select('*, issues(*), generated_tests(*)')
      .eq('id', id)
      .single();

    if (error) return null;
    return data;
  }

  async listReviews(params?: {
    page?: number;
    limit?: number;
    repository?: string;
    status?: string;
  }): Promise<{ data: Record<string, unknown>[]; total: number }> {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const offset = (page - 1) * limit;

    let query = this.client
      .from('reviews')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (params?.repository) {
      query = query.eq('repository', params.repository);
    }
    if (params?.status) {
      query = query.eq('status', params.status);
    }

    const { data, count, error } = await query;
    if (error) throw new Error(`Failed to list reviews: ${error.message}`);

    return { data: data ?? [], total: count ?? 0 };
  }

  // ─── Issues ───────────────────────────────────────────────

  async updateIssueStatus(issueId: string, status: string, userId: string, reason?: string): Promise<void> {
    const { error } = await this.admin
      .from('issues')
      .update({ status })
      .eq('id', issueId);

    if (error) throw new Error(`Failed to update issue: ${error.message}`);

    // Create audit log entry
    await this.createAuditEntry({
      reviewId: '',
      issueId,
      action: status as ActionType,
      userId,
      reason,
    });
  }

  // ─── Audit Log ────────────────────────────────────────────

  async createAuditEntry(entry: {
    reviewId: string;
    issueId?: string;
    action: ActionType | string;
    userId: string;
    previousValue?: string;
    newValue?: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.admin.from('audit_log').insert({
      review_id: entry.reviewId || null,
      issue_id: entry.issueId || null,
      action: entry.action,
      user_id: entry.userId,
      previous_value: entry.previousValue,
      new_value: entry.newValue,
      reason: entry.reason,
      metadata: entry.metadata,
    });
  }

  async getAuditLog(params?: {
    reviewId?: string;
    page?: number;
    limit?: number;
  }): Promise<Record<string, unknown>[]> {
    const limit = params?.limit ?? 50;
    const offset = ((params?.page ?? 1) - 1) * limit;

    let query = this.admin
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (params?.reviewId) {
      query = query.eq('review_id', params.reviewId);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to get audit log: ${error.message}`);
    return data ?? [];
  }

  // ─── Dashboard Stats ─────────────────────────────────────

  async getDashboardStats(): Promise<DashboardStats> {
    // Get totals
    const { count: totalReviews } = await this.client
      .from('reviews')
      .select('*', { count: 'exact', head: true });

    const { count: issuesFound } = await this.client
      .from('issues')
      .select('*', { count: 'exact', head: true });

    const { count: issuesFixed } = await this.client
      .from('issues')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'fixed');

    // Average confidence
    const { data: avgData } = await this.client
      .from('reviews')
      .select('confidence_overall')
      .not('confidence_overall', 'is', null);

    const avgConfidence = avgData && avgData.length > 0
      ? Math.round(avgData.reduce((sum, r) => sum + (r.confidence_overall ?? 0), 0) / avgData.length)
      : 0;

    // Reviews by day (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: reviewsByDay } = await this.client
      .from('reviews')
      .select('created_at')
      .gte('created_at', thirtyDaysAgo.toISOString());

    const dayMap = new Map<string, number>();
    for (const r of reviewsByDay ?? []) {
      const date = new Date(r.created_at).toISOString().split('T')[0]!;
      dayMap.set(date, (dayMap.get(date) ?? 0) + 1);
    }

    // Issues by category
    const { data: issueCats } = await this.client
      .from('issues')
      .select('category');

    const catMap = new Map<string, number>();
    for (const i of issueCats ?? []) {
      catMap.set(i.category, (catMap.get(i.category) ?? 0) + 1);
    }

    // Issues by severity
    const { data: issueSevs } = await this.client
      .from('issues')
      .select('severity');

    const sevMap = new Map<string, number>();
    for (const i of issueSevs ?? []) {
      sevMap.set(i.severity, (sevMap.get(i.severity) ?? 0) + 1);
    }

    return {
      totalReviews: totalReviews ?? 0,
      issuesFound: issuesFound ?? 0,
      issuesFixed: issuesFixed ?? 0,
      averageConfidence: avgConfidence,
      reviewsByDay: Array.from(dayMap.entries()).map(([date, count]) => ({ date, count })),
      issuesByCategory: Array.from(catMap.entries()).map(([category, count]) => ({
        category: category as IssueCategory,
        count,
      })),
      issuesBySeverity: Array.from(sevMap.entries()).map(([severity, count]) => ({
        severity: severity as Severity,
        count,
      })),
    };
  }
}

export { createClient };
