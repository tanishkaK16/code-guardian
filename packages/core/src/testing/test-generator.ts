/**
 * Test Generator
 * Automatically generates unit and integration tests for code changes
 * using AI-powered analysis and Vitest framework.
 */

import { v4 as uuidv4 } from 'uuid';
import { FileChange, GeneratedTest } from '../types/index.js';
import { AIReasoningEngine } from '../ai/reasoning-engine.js';

const TEST_GENERATION_PROMPT = `You are an expert test engineer. Generate comprehensive Vitest tests for the following code.

Requirements:
1. Use Vitest (import { describe, it, expect, vi } from 'vitest')
2. Cover all exported functions and classes
3. Include edge cases, error handling, and boundary conditions
4. Use descriptive test names
5. Mock external dependencies using vi.mock()
6. Include both positive and negative test cases
7. For async code, test both success and failure paths

Return ONLY the test code, ready to run. No explanations.`;

export class TestGenerator {
  private aiEngine: AIReasoningEngine;

  constructor(aiEngine: AIReasoningEngine) {
    this.aiEngine = aiEngine;
  }

  /**
   * Generate tests for a set of file changes.
   */
  async generateTests(files: FileChange[]): Promise<GeneratedTest[]> {
    const tests: GeneratedTest[] = [];

    for (const file of files) {
      // Skip non-source files
      if (this.shouldSkip(file)) continue;

      try {
        const testCode = await this.generateTestForFile(file);
        if (testCode) {
          tests.push({
            id: uuidv4(),
            targetFile: file.path,
            testCode,
            testFramework: 'vitest',
          });
        }
      } catch (error) {
        console.error(`Test generation failed for ${file.path}:`, error);
      }
    }

    return tests;
  }

  /**
   * Generate a test suite for a single file.
   */
  private async generateTestForFile(file: FileChange): Promise<string | null> {
    const prompt = `${TEST_GENERATION_PROMPT}

**File**: ${file.path}
**Language**: ${file.language}

\`\`\`${file.language}
${file.content}
\`\`\`

Generate comprehensive Vitest tests:`;

    const response = await this.aiEngine.generateFix(
      {
        id: 'test-gen',
        category: 'test_coverage' as never,
        severity: 'info' as never,
        title: 'Generate Tests',
        description: 'Generate unit tests',
        location: { file: file.path, startLine: 1, endLine: 1 },
        confidence: 1,
      },
      prompt,
      file.path
    );

    if (!response) return null;

    // Ensure proper imports
    let testCode = response;
    if (!testCode.includes("from 'vitest'")) {
      testCode = `import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';\n\n${testCode}`;
    }

    return testCode;
  }

  /**
   * Generate a basic test template without AI (fallback).
   */
  generateBasicTemplate(file: FileChange): string {
    const fileName = file.path.split('/').pop()?.replace(/\.\w+$/, '') ?? 'module';
    const exports = this.extractExports(file.content);

    let template = `import { describe, it, expect } from 'vitest';\n`;
    template += `// Auto-generated test template for ${file.path}\n\n`;

    if (exports.functions.length > 0) {
      template += `import { ${exports.functions.join(', ')} } from './${fileName}';\n\n`;

      for (const fn of exports.functions) {
        template += `describe('${fn}', () => {\n`;
        template += `  it('should be defined', () => {\n`;
        template += `    expect(${fn}).toBeDefined();\n`;
        template += `  });\n\n`;
        template += `  it('should handle valid input', () => {\n`;
        template += `    // TODO: Add test implementation\n`;
        template += `    expect(true).toBe(true);\n`;
        template += `  });\n\n`;
        template += `  it('should handle edge cases', () => {\n`;
        template += `    // TODO: Add edge case tests\n`;
        template += `    expect(true).toBe(true);\n`;
        template += `  });\n`;
        template += `});\n\n`;
      }
    }

    if (exports.classes.length > 0) {
      for (const cls of exports.classes) {
        template += `describe('${cls}', () => {\n`;
        template += `  it('should create instance', () => {\n`;
        template += `    // TODO: Add constructor args\n`;
        template += `    // const instance = new ${cls}();\n`;
        template += `    // expect(instance).toBeInstanceOf(${cls});\n`;
        template += `    expect(true).toBe(true);\n`;
        template += `  });\n`;
        template += `});\n\n`;
      }
    }

    return template;
  }

  private shouldSkip(file: FileChange): boolean {
    const skipPatterns = [
      /\.test\./,
      /\.spec\./,
      /\.d\.ts$/,
      /\.config\./,
      /node_modules/,
      /\.json$/,
      /\.md$/,
      /\.css$/,
      /\.svg$/,
    ];
    return skipPatterns.some((p) => p.test(file.path));
  }

  private extractExports(content: string): { functions: string[]; classes: string[] } {
    const functions: string[] = [];
    const classes: string[] = [];

    // Match exported functions
    const fnRegex = /export\s+(?:async\s+)?function\s+(\w+)/g;
    let match;
    while ((match = fnRegex.exec(content)) !== null) {
      functions.push(match[1]!);
    }

    // Match exported const arrow functions
    const arrowRegex = /export\s+const\s+(\w+)\s*=/g;
    while ((match = arrowRegex.exec(content)) !== null) {
      functions.push(match[1]!);
    }

    // Match exported classes
    const classRegex = /export\s+class\s+(\w+)/g;
    while ((match = classRegex.exec(content)) !== null) {
      classes.push(match[1]!);
    }

    return { functions, classes };
  }
}
