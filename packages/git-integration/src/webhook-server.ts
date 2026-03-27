/**
 * Webhook Server
 * Express server that handles GitHub & GitLab webhook events
 * and routes them to the review engine.
 */

import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { ReviewEngine, ReviewResult, PullRequestInfo } from '@ai-code-guardian/core';
import { GitHubAdapter } from './github.js';
import { GitLabAdapter } from './gitlab.js';

interface WebhookServerConfig {
  port: number;
  corsOrigins?: string[];
  github?: {
    webhookSecret: string;
    appId?: string;
    privateKey?: string;
    clientId?: string;
    clientSecret?: string;
  };
  gitlab?: {
    webhookSecret: string;
    personalAccessToken?: string;
    baseUrl?: string;
  };
  reviewEngine: ReviewEngine;
  onReviewComplete?: (result: ReviewResult, pr: PullRequestInfo) => Promise<void>;
}

export function createWebhookServer(config: WebhookServerConfig): express.Express {
  const app = express();

  // ─── Security Middleware ────────────────────────────────
  app.use(helmet());
  app.use(cors({
    origin: config.corsOrigins ?? ['http://localhost:3000'],
    credentials: true,
  }));

  // Raw body for webhook verification
  app.use('/webhooks', express.raw({ type: 'application/json' }));
  app.use(express.json());

  // ─── Health Check ──────────────────────────────────────
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ─── GitHub Webhook ────────────────────────────────────
  if (config.github) {
    const github = new GitHubAdapter(config.github);

    app.post('/webhooks/github', async (req: Request, res: Response) => {
      try {
        const signature = req.headers['x-hub-signature-256'] as string;
        const payload = req.body as Buffer;

        if (!signature || !github.verifyWebhookSignature(payload.toString(), signature)) {
          res.status(401).json({ error: 'Invalid signature' });
          return;
        }

        const body = JSON.parse(payload.toString()) as Record<string, unknown>;
        const event = req.headers['x-github-event'] as string;

        if (event !== 'pull_request') {
          res.json({ message: 'Event ignored' });
          return;
        }

        const webhookPayload = github.parseWebhookPayload(body);
        if (!webhookPayload) {
          res.status(400).json({ error: 'Invalid payload' });
          return;
        }

        // Acknowledge webhook immediately
        res.status(202).json({ message: 'Review started', reviewId: webhookPayload.pullRequest.id });

        // Process asynchronously
        const [owner, repo] = webhookPayload.pullRequest.repository.split('/');
        if (!owner || !repo) return;

        // TODO: Get token from installation or stored OAuth token
        // github.authenticate(token);

        const files = await github.fetchPRFiles(
          owner,
          repo,
          webhookPayload.pullRequest.number
        );

        webhookPayload.pullRequest.files = files;
        const result = await config.reviewEngine.review(files);

        // Post review comment
        const reviewBody = formatReviewComment(result);
        const reviewEvent = result.confidenceScore.overall >= 80
          ? 'APPROVE' as const
          : result.issues.some((i) => i.severity === 'critical')
            ? 'REQUEST_CHANGES' as const
            : 'COMMENT' as const;

        await github.postReviewComment(owner, repo, webhookPayload.pullRequest.number, reviewBody, reviewEvent);

        if (config.onReviewComplete) {
          await config.onReviewComplete(result, webhookPayload.pullRequest);
        }
      } catch (error) {
        console.error('GitHub webhook error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Internal server error' });
        }
      }
    });

    // OAuth callback
    app.get('/auth/github/callback', async (req: Request, res: Response) => {
      try {
        const { code, state } = req.query as { code: string; state: string };
        const redirectUri = `${req.protocol}://${req.get('host')}/auth/github/callback`;
        const token = await github.exchangeCode(code, redirectUri);

        // Redirect to dashboard with token (in production, store in session/DB)
        res.redirect(`${config.corsOrigins?.[0] ?? 'http://localhost:3000'}/auth/callback?token=${token}&state=${state}`);
      } catch (error) {
        res.status(400).json({ error: 'OAuth failed' });
      }
    });
  }

  // ─── GitLab Webhook ────────────────────────────────────
  if (config.gitlab) {
    const gitlab = new GitLabAdapter(config.gitlab);

    app.post('/webhooks/gitlab', async (req: Request, res: Response) => {
      try {
        const token = req.headers['x-gitlab-token'] as string;

        if (!token || !gitlab.verifyWebhookToken(token)) {
          res.status(401).json({ error: 'Invalid token' });
          return;
        }

        const body = JSON.parse((req.body as Buffer).toString()) as Record<string, unknown>;
        const eventType = body.object_kind as string;

        if (eventType !== 'merge_request') {
          res.json({ message: 'Event ignored' });
          return;
        }

        const webhookPayload = gitlab.parseWebhookPayload(body);
        if (!webhookPayload) {
          res.status(400).json({ error: 'Invalid payload' });
          return;
        }

        res.status(202).json({ message: 'Review started' });

        // Fetch MR files and run review
        const project = body.project as Record<string, unknown>;
        const projectId = project?.id as number;

        const files = await gitlab.fetchMRFiles(projectId, webhookPayload.pullRequest.number);
        const result = await config.reviewEngine.review(files);

        const comment = formatReviewComment(result);
        await gitlab.postComment(projectId, webhookPayload.pullRequest.number, comment);

        if (config.onReviewComplete) {
          await config.onReviewComplete(result, webhookPayload.pullRequest);
        }
      } catch (error) {
        console.error('GitLab webhook error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Internal server error' });
        }
      }
    });
  }

  // ─── Error Handler ─────────────────────────────────────
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

// ─── Helpers ──────────────────────────────────────────────

function formatReviewComment(result: ReviewResult): string {
  let comment = `## 🛡️ AI Code Guardian Review\n\n`;
  comment += `**Confidence Score: ${result.confidenceScore.overall}/100** `;
  comment += result.confidenceScore.overall >= 80 ? '✅\n\n' : result.confidenceScore.overall >= 60 ? '⚠️\n\n' : '🚨\n\n';

  // Score breakdown
  comment += `### 📊 Score Breakdown\n\n`;
  comment += `| Dimension | Score |\n|-----------|-------|\n`;
  for (const dim of result.confidenceScore.breakdown) {
    const bar = '█'.repeat(Math.round(dim.score / 10)) + '░'.repeat(10 - Math.round(dim.score / 10));
    comment += `| ${dim.label} | ${bar} ${dim.score}/100 |\n`;
  }
  comment += '\n';

  // Issues
  if (result.issues.length > 0) {
    comment += `### 🔍 Issues Found (${result.issues.length})\n\n`;

    const severityEmoji: Record<string, string> = {
      critical: '🚨',
      high: '🔴',
      medium: '🟡',
      low: '🔵',
      info: 'ℹ️',
    };

    for (const issue of result.issues.slice(0, 20)) {
      const emoji = severityEmoji[issue.severity] ?? '•';
      comment += `${emoji} **${issue.title}** (${issue.severity})\n`;
      comment += `  📁 \`${issue.location.file}:${issue.location.startLine}\`\n`;
      comment += `  ${issue.description}\n`;
      if (issue.suggestedFix) {
        comment += `  💡 **Fix:** ${issue.suggestedFix}\n`;
      }
      comment += '\n';
    }

    if (result.issues.length > 20) {
      comment += `\n*...and ${result.issues.length - 20} more issues. See full report in dashboard.*\n`;
    }
  } else {
    comment += `### ✅ No Issues Found\n\nLooks good! No security vulnerabilities or code quality issues detected.\n`;
  }

  // Test results
  if (result.generatedTests.length > 0) {
    const allTests = result.generatedTests.flatMap((t) => t.results ?? []);
    const passed = allTests.filter((t) => t.status === 'passed').length;
    const failed = allTests.filter((t) => t.status === 'failed').length;

    comment += `\n### 🧪 Generated Tests\n\n`;
    comment += `Generated **${result.generatedTests.length}** test suites | `;
    comment += `✅ ${passed} passed | ❌ ${failed} failed\n`;
  }

  comment += `\n---\n*Reviewed by AI Code Guardian in ${(result.processingTimeMs / 1000).toFixed(1)}s using ${result.aiProvider}*`;

  return comment;
}

export { formatReviewComment };
