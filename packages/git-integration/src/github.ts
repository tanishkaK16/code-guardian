/**
 * GitHub Integration
 * Handles webhooks, OAuth, and PR operations via Octokit.
 */

import { Octokit } from '@octokit/rest';
import { createHmac } from 'node:crypto';
import { FileChange, PullRequestInfo, WebhookPayload } from '@ai-code-guardian/core';

// ─── Configuration ──────────────────────────────────────────

interface GitHubConfig {
  appId?: string;
  privateKey?: string;
  clientId?: string;
  clientSecret?: string;
  webhookSecret: string;
}

// ─── GitHub Adapter ─────────────────────────────────────────

export class GitHubAdapter {
  private config: GitHubConfig;
  private octokit: Octokit | null = null;

  constructor(config: GitHubConfig) {
    this.config = config;
  }

  /**
   * Initialize Octokit with an access token.
   */
  authenticate(token: string): void {
    this.octokit = new Octokit({ auth: token });
  }

  /**
   * Verify webhook signature to prevent spoofing.
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    const expectedSignature = `sha256=${createHmac('sha256', this.config.webhookSecret)
      .update(payload)
      .digest('hex')}`;

    // Constant-time comparison to prevent timing attacks
    if (signature.length !== expectedSignature.length) return false;

    let result = 0;
    for (let i = 0; i < signature.length; i++) {
      result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
    }
    return result === 0;
  }

  /**
   * Parse a GitHub webhook payload into our standard format.
   */
  parseWebhookPayload(body: Record<string, unknown>): WebhookPayload | null {
    const action = body.action as string;
    const pr = body.pull_request as Record<string, unknown> | undefined;

    if (!pr) return null;

    const head = pr.head as Record<string, unknown>;
    const base = pr.base as Record<string, unknown>;
    const repo = (head.repo ?? base.repo) as Record<string, unknown>;
    const user = pr.user as Record<string, unknown>;

    return {
      event: 'pull_request',
      action: action as WebhookPayload['action'],
      pullRequest: {
        id: String(pr.id),
        number: pr.number as number,
        title: pr.title as string,
        description: (pr.body as string) ?? '',
        author: (user.login as string) ?? 'unknown',
        baseBranch: (base.ref as string) ?? 'main',
        headBranch: (head.ref as string) ?? '',
        repository: (repo.full_name as string) ?? '',
        provider: 'github',
        url: (pr.html_url as string) ?? '',
        files: [], // Will be fetched separately
      },
    };
  }

  /**
   * Fetch changed files from a pull request.
   */
  async fetchPRFiles(owner: string, repo: string, prNumber: number): Promise<FileChange[]> {
    if (!this.octokit) throw new Error('Not authenticated');

    const { data: files } = await this.octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
      per_page: 100,
    });

    const fileChanges: FileChange[] = [];

    for (const file of files) {
      if (file.status === 'removed') continue;

      try {
        // Fetch file content
        const { data: contentData } = await this.octokit.repos.getContent({
          owner,
          repo,
          path: file.filename,
          ref: `pull/${prNumber}/head`,
        });

        const content = 'content' in contentData
          ? Buffer.from(contentData.content as string, 'base64').toString('utf-8')
          : '';

        fileChanges.push({
          path: file.filename,
          content,
          language: this.detectLanguage(file.filename),
          additions: file.additions,
          deletions: file.deletions,
        });
      } catch (error) {
        console.error(`Failed to fetch ${file.filename}:`, error);
      }
    }

    return fileChanges;
  }

  /**
   * Post a review comment on a PR.
   */
  async postReviewComment(
    owner: string,
    repo: string,
    prNumber: number,
    body: string,
    event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT' = 'COMMENT'
  ): Promise<void> {
    if (!this.octokit) throw new Error('Not authenticated');

    await this.octokit.pulls.createReview({
      owner,
      repo,
      pull_number: prNumber,
      body,
      event,
    });
  }

  /**
   * Post inline comments on specific lines.
   */
  async postInlineComment(
    owner: string,
    repo: string,
    prNumber: number,
    path: string,
    line: number,
    body: string,
    commitId: string
  ): Promise<void> {
    if (!this.octokit) throw new Error('Not authenticated');

    await this.octokit.pulls.createReviewComment({
      owner,
      repo,
      pull_number: prNumber,
      body,
      path,
      line,
      commit_id: commitId,
    });
  }

  /**
   * Generate OAuth authorization URL.
   */
  getOAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId ?? '',
      redirect_uri: redirectUri,
      scope: 'repo read:org',
      state,
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange OAuth code for access token.
   */
  async exchangeCode(code: string, redirectUri: string): Promise<string> {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const data = (await response.json()) as { access_token?: string; error?: string };
    if (data.error) throw new Error(`OAuth error: ${data.error}`);
    if (!data.access_token) throw new Error('No access token received');

    return data.access_token;
  }

  // ─── Helpers ──────────────────────────────────────────────

  private detectLanguage(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      java: 'java',
      go: 'go',
      rs: 'rust',
      rb: 'ruby',
      php: 'php',
      cs: 'csharp',
      cpp: 'cpp',
      c: 'c',
      swift: 'swift',
      kt: 'kotlin',
    };
    return languageMap[ext ?? ''] ?? 'unknown';
  }
}
