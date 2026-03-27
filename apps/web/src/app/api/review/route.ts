/**
 * POST /api/review
 * Accepts uploaded code files, runs the real static analysis engine,
 * and returns a structured review result.
 */

import { NextRequest, NextResponse } from 'next/server';
import { StaticAnalyzer } from '@/lib/core/static-analyzer';
import { ConfidenceScorer } from '@/lib/core/confidence-scorer';
import { v4 as uuidv4 } from 'uuid';

const analyzer = new StaticAnalyzer();
const scorer = new ConfidenceScorer();

// Map file extensions to languages
function detectLanguage(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
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
  return map[ext ?? ''] ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { files, projectName } = body as {
      files: { name: string; content: string }[];
      projectName?: string;
    };

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No files provided' },
        { status: 400 }
      );
    }

    const startTime = Date.now();
    const reviewId = uuidv4();

    // Convert uploaded files to FileChange format
    const fileChanges = files
      .map((file) => {
        const language = detectLanguage(file.name);
        if (!language) return null;
        return {
          path: file.name,
          content: file.content,
          language,
          additions: file.content.split('\n').length,
          deletions: 0,
        };
      })
      .filter(Boolean) as Array<{
        path: string;
        content: string;
        language: string;
        additions: number;
        deletions: number;
      }>;

    if (fileChanges.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No supported file types found. Supported: .ts, .tsx, .js, .jsx, .py, .java, .go' },
        { status: 400 }
      );
    }

    // Run static analysis on all files
    const allIssues = analyzer.analyzeFiles(fileChanges);

    // Calculate confidence score
    const totalLines = fileChanges.reduce(
      (sum, f) => sum + f.content.split('\n').length,
      0
    );

    const confidenceScore = scorer.calculate({
      issues: allIssues,
      generatedTests: [],
      testResults: [],
      fileCount: fileChanges.length,
      totalLines,
    });

    const processingTimeMs = Date.now() - startTime;

    // Build severity summary
    const criticals = allIssues.filter((i) => i.severity === 'critical').length;
    const highs = allIssues.filter((i) => i.severity === 'high').length;
    const mediums = allIssues.filter((i) => i.severity === 'medium').length;
    const lows = allIssues.filter((i) => i.severity === 'low').length;

    const emoji = confidenceScore.overall >= 80 ? '✅' : confidenceScore.overall >= 60 ? '⚠️' : '🚨';
    let summary = `${emoji} Confidence Score: ${confidenceScore.overall}/100\n\n`;
    if (criticals > 0) summary += `🚨 ${criticals} critical issue(s) require immediate attention.\n`;
    if (highs > 0) summary += `⚠️ ${highs} high severity issue(s) found.\n`;
    if (mediums > 0) summary += `🟡 ${mediums} medium severity issue(s).\n`;
    if (lows > 0) summary += `💡 ${lows} low severity suggestion(s).\n`;
    summary += `\nAnalyzed ${fileChanges.length} file(s), ${totalLines} lines in ${(processingTimeMs / 1000).toFixed(1)}s.`;

    const result = {
      id: reviewId,
      projectName: projectName || 'Uploaded Project',
      status: 'completed',
      issues: allIssues.map((issue) => ({
        ...issue,
        // Add the actual code snippet from the file
        codeSnippet: getCodeSnippet(
          fileChanges.find((f) => f.path === issue.location.file)?.content || '',
          issue.location.startLine,
          issue.location.endLine
        ),
      })),
      confidenceScore,
      summary,
      filesAnalyzed: fileChanges.map((f) => ({
        name: f.path,
        language: f.language,
        lines: f.content.split('\n').length,
        issueCount: allIssues.filter((i) => i.location.file === f.path).length,
      })),
      totalFiles: files.length,
      supportedFiles: fileChanges.length,
      skippedFiles: files.length - fileChanges.length,
      processingTimeMs,
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Review failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: `Review failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}

function getCodeSnippet(content: string, startLine: number, endLine: number): string {
  const lines = content.split('\n');
  const contextBefore = Math.max(0, startLine - 3);
  const contextAfter = Math.min(lines.length, endLine + 3);
  return lines
    .slice(contextBefore, contextAfter)
    .map((line, i) => {
      const lineNum = contextBefore + i + 1;
      const marker = lineNum >= startLine && lineNum <= endLine ? '>>>' : '   ';
      return `${marker} ${lineNum.toString().padStart(4)} | ${line}`;
    })
    .join('\n');
}
