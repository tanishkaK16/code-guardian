/**
 * AI Reasoning Layer
 * Integrates with Gemini and Claude APIs for deep code analysis,
 * hallucination detection, and intelligent fix suggestions.
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import {
  FileChange,
  ReviewIssue,
  IssueCategory,
  Severity,
  AIProvider,
} from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';

// ─── Configuration ──────────────────────────────────────────

interface AIConfig {
  provider: AIProvider;
  geminiApiKey?: string;
  anthropicApiKey?: string;
  temperature?: number;
  maxTokens?: number;
}

interface AIAnalysisResult {
  issues: ReviewIssue[];
  summary: string;
  reasoning: string;
}

// ─── System Prompts ─────────────────────────────────────────

const REVIEW_SYSTEM_PROMPT = `You are an expert code reviewer and security analyst. Your task is to analyze code changes and identify:

1. **Security Vulnerabilities**: SQL injection, XSS, CSRF, path traversal, insecure deserialization, authentication bypass, etc.
2. **AI Hallucinations**: Non-existent APIs, incorrect method signatures, fabricated package names, wrong function parameters.
3. **Bug Risks**: Race conditions, null pointer dereferences, off-by-one errors, resource leaks, unhandled edge cases.
4. **Performance Issues**: N+1 queries, unnecessary re-renders, memory leaks, blocking operations in async context.
5. **Code Quality**: Missing error handling, poor naming, duplicated logic, missing types.

For each issue found, provide:
- A clear title and description
- The exact line number(s)
- A severity rating (critical/high/medium/low/info)
- A confidence score (0.0-1.0)
- A suggested fix with actual code

Respond in JSON format following this exact schema:
{
  "issues": [
    {
      "category": "security|hallucination|bug_risk|performance|code_smell|type_safety",
      "severity": "critical|high|medium|low|info",
      "title": "Short issue title",
      "description": "Detailed description",
      "startLine": 1,
      "endLine": 1,
      "confidence": 0.95,
      "suggestedFix": "Fixed code or instructions",
      "reasoning": "Why this is an issue"
    }
  ],
  "summary": "Overall assessment of the code changes",
  "overallReasoning": "Your reasoning process for the analysis"
}

Be thorough but avoid false positives. Only flag real issues with high confidence.`;

// ─── AI Reasoning Engine ────────────────────────────────────

export class AIReasoningEngine {
  private config: AIConfig;
  private geminiModel?: GenerativeModel;
  private anthropicClient?: Anthropic;

  constructor(config: AIConfig) {
    this.config = {
      temperature: 0.1, // Low temperature for analytical tasks
      maxTokens: 8192,
      ...config,
    };

    this.initializeProviders();
  }

  private initializeProviders(): void {
    if (this.config.geminiApiKey) {
      const genAI = new GoogleGenerativeAI(this.config.geminiApiKey);
      this.geminiModel = genAI.getGenerativeModel({
        model: 'gemini-2.5-pro',
        generationConfig: {
          temperature: this.config.temperature,
          maxOutputTokens: this.config.maxTokens,
        },
      });
    }

    if (this.config.anthropicApiKey) {
      this.anthropicClient = new Anthropic({
        apiKey: this.config.anthropicApiKey,
      });
    }
  }

  /**
   * Analyze code changes using the configured AI provider.
   */
  async analyzeCode(files: FileChange[]): Promise<AIAnalysisResult> {
    const prompt = this.buildAnalysisPrompt(files);

    try {
      const response = this.config.provider === AIProvider.Gemini
        ? await this.callGemini(prompt)
        : await this.callClaude(prompt);

      return this.parseAIResponse(response, files);
    } catch (error) {
      console.error('AI analysis failed:', error);
      return {
        issues: [],
        summary: 'AI analysis failed — falling back to static analysis only',
        reasoning: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Generate a suggested fix for a specific issue.
   */
  async generateFix(
    issue: ReviewIssue,
    fileContent: string,
    filePath: string
  ): Promise<string | null> {
    const prompt = `Fix the following issue in the code:

**File**: ${filePath}
**Issue**: ${issue.title}
**Description**: ${issue.description}
**Location**: Lines ${issue.location.startLine}-${issue.location.endLine}
**Severity**: ${issue.severity}

**Current Code**:
\`\`\`
${fileContent}
\`\`\`

Provide ONLY the fixed code for the affected lines. No explanation needed.
Return the complete fixed file content.`;

    try {
      const response = this.config.provider === AIProvider.Gemini
        ? await this.callGemini(prompt)
        : await this.callClaude(prompt);

      // Extract code from response (handle markdown code blocks)
      const codeMatch = response.match(/```(?:\w+)?\n([\s\S]*?)```/);
      return codeMatch ? codeMatch[1]!.trim() : response.trim();
    } catch (error) {
      console.error('Fix generation failed:', error);
      return null;
    }
  }

  /**
   * Detect if code appears to be AI-generated and flag potential hallucinations.
   */
  async detectHallucinations(files: FileChange[]): Promise<ReviewIssue[]> {
    const prompt = `Analyze the following code for AI hallucinations — that is, code that an AI model might generate but that contains:

1. Non-existent APIs or methods
2. Incorrect function signatures or wrong parameter counts
3. Fabricated package/module names that don't exist
4. Incorrect syntax for the language version
5. Plausible-looking but incorrect logic
6. Using deprecated APIs as if they're current

${files.map((f) => `**${f.path}**:\n\`\`\`${f.language}\n${f.content}\n\`\`\``).join('\n\n')}

Respond in JSON:
{
  "hallucinations": [
    {
      "file": "path",
      "line": 1,
      "description": "What's wrong",
      "confidence": 0.9,
      "correction": "What it should be"
    }
  ]
}`;

    try {
      const response = this.config.provider === AIProvider.Gemini
        ? await this.callGemini(prompt)
        : await this.callClaude(prompt);

      return this.parseHallucinationResponse(response, files);
    } catch (error) {
      console.error('Hallucination detection failed:', error);
      return [];
    }
  }

  // ─── Private Methods ────────────────────────────────────

  private buildAnalysisPrompt(files: FileChange[]): string {
    const fileContents = files.map((f) => {
      const diffInfo = f.previousContent
        ? `\n**Previous version available** (${f.additions} additions, ${f.deletions} deletions)`
        : '';

      return `### ${f.path} (${f.language})${diffInfo}\n\`\`\`${f.language}\n${f.content}\n\`\`\``;
    }).join('\n\n');

    return `${REVIEW_SYSTEM_PROMPT}\n\n## Code to Review:\n\n${fileContents}`;
  }

  private async callGemini(prompt: string): Promise<string> {
    if (!this.geminiModel) {
      throw new Error('Gemini API key not configured');
    }

    const result = await this.geminiModel.generateContent(prompt);
    const response = result.response;
    return response.text();
  }

  private async callClaude(prompt: string): Promise<string> {
    if (!this.anthropicClient) {
      throw new Error('Anthropic API key not configured');
    }

    const response = await this.anthropicClient.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: this.config.maxTokens ?? 8192,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      system: REVIEW_SYSTEM_PROMPT,
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    return textBlock ? textBlock.text : '';
  }

  private parseAIResponse(response: string, files: FileChange[]): AIAnalysisResult {
    try {
      // Extract JSON from response (may be wrapped in markdown)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { issues: [], summary: 'Could not parse AI response', reasoning: response };
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        issues?: Array<{
          category: string;
          severity: string;
          title: string;
          description: string;
          startLine: number;
          endLine?: number;
          confidence: number;
          suggestedFix?: string;
          reasoning?: string;
        }>;
        summary?: string;
        overallReasoning?: string;
      };

      const issues: ReviewIssue[] = (parsed.issues ?? []).map((issue) => ({
        id: uuidv4(),
        category: (issue.category as IssueCategory) ?? IssueCategory.CodeSmell,
        severity: (issue.severity as Severity) ?? Severity.Medium,
        title: issue.title ?? 'Untitled Issue',
        description: issue.description ?? '',
        location: {
          file: files[0]?.path ?? 'unknown',
          startLine: issue.startLine ?? 1,
          endLine: issue.endLine ?? issue.startLine ?? 1,
        },
        confidence: Math.min(1, Math.max(0, issue.confidence ?? 0.5)),
        suggestedFix: issue.suggestedFix,
        aiReasoning: issue.reasoning,
      }));

      return {
        issues,
        summary: parsed.summary ?? 'Analysis complete',
        reasoning: parsed.overallReasoning ?? '',
      };
    } catch (error) {
      return {
        issues: [],
        summary: 'Failed to parse AI response',
        reasoning: `Parse error: ${error instanceof Error ? error.message : 'Unknown'}`,
      };
    }
  }

  private parseHallucinationResponse(response: string, _files: FileChange[]): ReviewIssue[] {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[0]) as {
        hallucinations?: Array<{
          file: string;
          line: number;
          description: string;
          confidence: number;
          correction?: string;
        }>;
      };

      return (parsed.hallucinations ?? []).map((h) => ({
        id: uuidv4(),
        category: IssueCategory.Hallucination,
        severity: Severity.High,
        title: 'AI Hallucination Detected',
        description: h.description,
        location: {
          file: h.file,
          startLine: h.line,
          endLine: h.line,
        },
        confidence: h.confidence,
        suggestedFix: h.correction,
        aiReasoning: 'Detected by AI hallucination analysis',
      }));
    } catch {
      return [];
    }
  }
}
