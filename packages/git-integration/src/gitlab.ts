/**
 * GitLab Integration
 * Handles webhooks and merge request operations.
 */

import { createHmac } from 'node:crypto';
import { FileChange, WebhookPayload } from '@ai-code-guardian/core';

interface GitLabConfig {
  webhookSecret: string;
  personalAccessToken?: string;
  baseUrl?: string;
}

export class GitLabAdapter {
  private config: GitLabConfig;
  private baseUrl: string;
  private token: string | null = null;

  constructor(config: GitLabConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl ?? 'https://gitlab.com';
  }

  authenticate(token: string): void {
    this.token = token;
  }

  /**
   * Verify GitLab webhook token.
   */
  verifyWebhookToken(receivedToken: string): boolean {
    return receivedToken === this.config.webhookSecret;
  }

  /**
   * Parse a GitLab merge request webhook payload.
   */
  parseWebhookPayload(body: Record<string, unknown>): WebhookPayload | null {
    const attrs = body.object_attributes as Record<string, unknown> | undefined;
    if (!attrs) return null;

    const project = body.project as Record<string, unknown>;
    const user = body.user as Record<string, unknown>;

    const actionMap: Record<string, WebhookPayload['action']> = {
      open: 'opened',
      update: 'updated',
      reopen: 'reopened',
    };

    return {
      event: 'merge_request',
      action: actionMap[attrs.action as string] ?? 'opened',
      pullRequest: {
        id: String(attrs.id),
        number: attrs.iid as number,
        title: (attrs.title as string) ?? '',
        description: (attrs.description as string) ?? '',
        author: (user?.username as string) ?? 'unknown',
        baseBranch: (attrs.target_branch as string) ?? 'main',
        headBranch: (attrs.source_branch as string) ?? '',
        repository: (project?.path_with_namespace as string) ?? '',
        provider: 'gitlab',
        url: (attrs.url as string) ?? '',
        files: [],
      },
    };
  }

  /**
   * Fetch changed files from a merge request.
   */
  async fetchMRFiles(projectId: string | number, mrIid: number): Promise<FileChange[]> {
    const token = this.token ?? this.config.personalAccessToken;
    if (!token) throw new Error('Not authenticated');

    const url = `${this.baseUrl}/api/v4/projects/${encodeURIComponent(String(projectId))}/merge_requests/${mrIid}/changes`;

    const response = await fetch(url, {
      headers: {
        'PRIVATE-TOKEN': token,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      changes?: Array<{
        new_path: string;
        deleted_file: boolean;
        diff: string;
        new_file: boolean;
      }>;
    };

    const fileChanges: FileChange[] = [];

    for (const change of data.changes ?? []) {
      if (change.deleted_file) continue;

      // Fetch actual file content
      const content = await this.fetchFileContent(projectId, change.new_path, mrIid);

      const additions = (change.diff.match(/^\+[^+]/gm) ?? []).length;
      const deletions = (change.diff.match(/^-[^-]/gm) ?? []).length;

      fileChanges.push({
        path: change.new_path,
        content,
        language: this.detectLanguage(change.new_path),
        additions,
        deletions,
      });
    }

    return fileChanges;
  }

  /**
   * Post a comment on a merge request.
   */
  async postComment(projectId: string | number, mrIid: number, body: string): Promise<void> {
    const token = this.token ?? this.config.personalAccessToken;
    if (!token) throw new Error('Not authenticated');

    const url = `${this.baseUrl}/api/v4/projects/${encodeURIComponent(String(projectId))}/merge_requests/${mrIid}/notes`;

    await fetch(url, {
      method: 'POST',
      headers: {
        'PRIVATE-TOKEN': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body }),
    });
  }

  // ─── Private Methods ────────────────────────────────────

  private async fetchFileContent(
    projectId: string | number,
    filePath: string,
    mrIid: number
  ): Promise<string> {
    const token = this.token ?? this.config.personalAccessToken;
    if (!token) return '';

    const encodedPath = encodeURIComponent(filePath);
    const url = `${this.baseUrl}/api/v4/projects/${encodeURIComponent(String(projectId))}/repository/files/${encodedPath}/raw?ref=refs/merge-requests/${mrIid}/head`;

    try {
      const response = await fetch(url, {
        headers: { 'PRIVATE-TOKEN': token },
      });
      return response.ok ? await response.text() : '';
    } catch {
      return '';
    }
  }

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
    };
    return languageMap[ext ?? ''] ?? 'unknown';
  }
}
