/**
 * AI Code Guardian — VS Code Extension
 * Provides real-time code analysis, inline diagnostics, and review functionality.
 */

import * as vscode from 'vscode';
import {
  StaticAnalyzer,
  AIReasoningEngine,
  ReviewIssue,
  Severity,
  AIProvider,
  FileChange,
  ReviewEngine,
} from '@ai-code-guardian/core';

let diagnosticCollection: vscode.DiagnosticCollection;
let statusBarItem: vscode.StatusBarItem;
let staticAnalyzer: StaticAnalyzer;
let reviewEngine: ReviewEngine | null = null;

// ─── Extension Activation ───────────────────────────────────

export function activate(context: vscode.ExtensionContext) {
  console.log('AI Code Guardian activated');

  // Initialize diagnostics
  diagnosticCollection = vscode.languages.createDiagnosticCollection('guardian');
  context.subscriptions.push(diagnosticCollection);

  // Initialize static analyzer
  staticAnalyzer = new StaticAnalyzer();

  // Initialize review engine if API keys are configured
  initializeReviewEngine();

  // Status bar
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.text = '$(shield) Guardian';
  statusBarItem.tooltip = 'AI Code Guardian — Click to review';
  statusBarItem.command = 'guardian.reviewFile';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // ─── Register Commands ──────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('guardian.reviewFile', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active file to review');
        return;
      }

      await reviewCurrentFile(editor);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('guardian.reviewWorkspace', async () => {
      await reviewWorkspaceChanges();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('guardian.fixIssue', async () => {
      vscode.window.showInformationMessage('Auto-fix will be applied via the Guardian dashboard');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('guardian.showDashboard', () => {
      const config = vscode.workspace.getConfiguration('guardian');
      const dashboardUrl = config.get<string>('dashboardUrl') ?? 'http://localhost:3000';
      vscode.env.openExternal(vscode.Uri.parse(dashboardUrl));
    })
  );

  // ─── Auto-Review on Save ───────────────────────────────

  const config = vscode.workspace.getConfiguration('guardian');
  if (config.get<boolean>('autoReview')) {
    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument(async (document) => {
        const editor = vscode.window.visibleTextEditors.find(
          (e) => e.document === document
        );
        if (editor) {
          await runStaticAnalysis(editor);
        }
      })
    );
  }

  // ─── Analyze Open File ─────────────────────────────────

  if (vscode.window.activeTextEditor) {
    runStaticAnalysis(vscode.window.activeTextEditor);
  }

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        runStaticAnalysis(editor);
      }
    })
  );

  // Watch for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('guardian')) {
        initializeReviewEngine();
      }
    })
  );
}

export function deactivate() {
  diagnosticCollection?.dispose();
  statusBarItem?.dispose();
}

// ─── Core Functions ─────────────────────────────────────────

function initializeReviewEngine() {
  const config = vscode.workspace.getConfiguration('guardian');
  const aiProvider = config.get<string>('aiProvider') ?? 'gemini';
  const geminiKey = config.get<string>('geminiApiKey');
  const anthropicKey = config.get<string>('anthropicApiKey');

  if (geminiKey || anthropicKey) {
    reviewEngine = new ReviewEngine({
      aiProvider: aiProvider as AIProvider,
      geminiApiKey: geminiKey ?? undefined,
      anthropicApiKey: anthropicKey ?? undefined,
    });
  }
}

async function runStaticAnalysis(editor: vscode.TextEditor) {
  const document = editor.document;
  const language = detectLanguage(document.languageId);

  if (!language) return;

  const fileChange: FileChange = {
    path: document.fileName,
    content: document.getText(),
    language,
    additions: 0,
    deletions: 0,
  };

  const issues = staticAnalyzer.analyzeFile(fileChange);
  updateDiagnostics(document.uri, issues);
  updateStatusBar(issues);
}

async function reviewCurrentFile(editor: vscode.TextEditor) {
  const document = editor.document;
  const language = detectLanguage(document.languageId);

  if (!language) {
    vscode.window.showWarningMessage('Unsupported file type for Guardian review');
    return;
  }

  statusBarItem.text = '$(loading~spin) Guardian: Reviewing...';

  const file: FileChange = {
    path: document.fileName,
    content: document.getText(),
    language,
    additions: 0,
    deletions: 0,
  };

  try {
    if (reviewEngine) {
      // Full AI-powered review
      const result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'AI Code Guardian',
          cancellable: false,
        },
        async (progress) => {
          progress.report({ message: 'Running static analysis...' });
          const staticIssues = staticAnalyzer.analyzeFile(file);

          progress.report({ message: 'Running AI analysis...' });
          const result = await reviewEngine!.review([file]);

          return result;
        }
      );

      updateDiagnostics(document.uri, result.issues);
      updateStatusBar(result.issues);

      // Show summary
      const score = result.confidenceScore.overall;
      const emoji = score >= 80 ? '✅' : score >= 60 ? '⚠️' : '🚨';
      vscode.window.showInformationMessage(
        `${emoji} Guardian Review: Score ${score}/100 | ${result.issues.length} issues found`
      );
    } else {
      // Static analysis only
      const issues = staticAnalyzer.analyzeFile(file);
      updateDiagnostics(document.uri, issues);
      updateStatusBar(issues);

      vscode.window.showInformationMessage(
        `🔍 Guardian: ${issues.length} issues found (static analysis only — add API key for AI review)`
      );
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Guardian review failed: ${error}`);
  }

  statusBarItem.text = '$(shield) Guardian';
}

async function reviewWorkspaceChanges() {
  vscode.window.showInformationMessage('Scanning workspace for changes...');
  // In a full implementation, this would scan git diff
  // For now, review all open editors
  for (const editor of vscode.window.visibleTextEditors) {
    await runStaticAnalysis(editor);
  }
}

// ─── Helpers ────────────────────────────────────────────────

function updateDiagnostics(uri: vscode.Uri, issues: ReviewIssue[]) {
  const diagnostics: vscode.Diagnostic[] = issues.map((issue) => {
    const range = new vscode.Range(
      new vscode.Position(issue.location.startLine - 1, issue.location.startColumn ?? 0),
      new vscode.Position(issue.location.endLine - 1, issue.location.endColumn ?? 200)
    );

    const severity = mapSeverity(issue.severity);
    const diagnostic = new vscode.Diagnostic(range, issue.description, severity);

    diagnostic.source = 'AI Code Guardian';
    diagnostic.code = issue.ruleId ?? issue.category;

    // Add suggested fix as code action
    if (issue.suggestedFix) {
      diagnostic.relatedInformation = [
        new vscode.DiagnosticRelatedInformation(
          new vscode.Location(uri, range),
          `💡 Fix: ${issue.suggestedFix.split('\n')[0]}`
        ),
      ];
    }

    return diagnostic;
  });

  diagnosticCollection.set(uri, diagnostics);
}

function updateStatusBar(issues: ReviewIssue[]) {
  const criticals = issues.filter((i) => i.severity === Severity.Critical).length;
  const highs = issues.filter((i) => i.severity === Severity.High).length;

  if (criticals > 0) {
    statusBarItem.text = `$(error) Guardian: ${criticals} critical`;
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
  } else if (highs > 0) {
    statusBarItem.text = `$(warning) Guardian: ${highs} high`;
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  } else if (issues.length > 0) {
    statusBarItem.text = `$(info) Guardian: ${issues.length} issues`;
    statusBarItem.backgroundColor = undefined;
  } else {
    statusBarItem.text = `$(shield) Guardian: ✓`;
    statusBarItem.backgroundColor = undefined;
  }
}

function mapSeverity(sev: Severity): vscode.DiagnosticSeverity {
  switch (sev) {
    case Severity.Critical:
    case Severity.High:
      return vscode.DiagnosticSeverity.Error;
    case Severity.Medium:
      return vscode.DiagnosticSeverity.Warning;
    case Severity.Low:
    case Severity.Info:
      return vscode.DiagnosticSeverity.Information;
  }
}

function detectLanguage(languageId: string): string | null {
  const map: Record<string, string> = {
    typescript: 'typescript',
    typescriptreact: 'typescript',
    javascript: 'javascript',
    javascriptreact: 'javascript',
    python: 'python',
    java: 'java',
    go: 'go',
    rust: 'rust',
  };
  return map[languageId] ?? null;
}
