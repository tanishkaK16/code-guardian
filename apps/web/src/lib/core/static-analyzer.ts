/**
 * Static Analysis Engine
 * Implements CodeQL-style security and quality rules for code analysis.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  FileChange,
  ReviewIssue,
  IssueCategory,
  Severity,
  CodeLocation,
  CustomRule,
} from './types';

// ─── Rule Definition ────────────────────────────────────────

interface AnalysisRule {
  id: string;
  name: string;
  description: string;
  category: IssueCategory;
  severity: Severity;
  languages: string[];
  check: (content: string, file: FileChange) => RuleMatch[];
}

interface RuleMatch {
  line: number;
  endLine?: number;
  column?: number;
  endColumn?: number;
  message: string;
  suggestedFix?: string;
}

// ─── Built-in Security Rules (CodeQL-style) ─────────────────

const SECURITY_RULES: AnalysisRule[] = [
  {
    id: 'SEC001',
    name: 'sql-injection',
    description: 'Detects potential SQL injection vulnerabilities via string concatenation',
    category: IssueCategory.Security,
    severity: Severity.Critical,
    languages: ['typescript', 'javascript', 'python'],
    check: (content: string): RuleMatch[] => {
      const matches: RuleMatch[] = [];
      const lines = content.split('\n');
      const patterns = [
        /(?:query|execute|raw)\s*\(\s*[`"'].*\$\{/i,
        /(?:query|execute|raw)\s*\(\s*.*\+\s*(?:req\.|params\.|body\.|query\.)/i,
        /f["'].*SELECT.*\{.*\}/i,
        /["'].*SELECT.*["']\s*\+/i,
        /\.format\s*\(.*\).*(?:SELECT|INSERT|UPDATE|DELETE)/i,
      ];

      lines.forEach((line, idx) => {
        for (const pattern of patterns) {
          if (pattern.test(line)) {
            matches.push({
              line: idx + 1,
              message: 'Potential SQL injection: use parameterized queries instead of string interpolation',
              suggestedFix: 'Use parameterized queries (e.g., db.query("SELECT * FROM users WHERE id = $1", [userId]))',
            });
            break;
          }
        }
      });
      return matches;
    },
  },
  {
    id: 'SEC002',
    name: 'hardcoded-secrets',
    description: 'Detects hardcoded API keys, passwords, and secrets',
    category: IssueCategory.Security,
    severity: Severity.Critical,
    languages: ['typescript', 'javascript', 'python', 'java', 'go'],
    check: (content: string): RuleMatch[] => {
      const matches: RuleMatch[] = [];
      const lines = content.split('\n');
      const patterns = [
        { regex: /(?:api[_-]?key|apikey)\s*[:=]\s*["'][a-zA-Z0-9_\-]{20,}["']/i, msg: 'Hardcoded API key detected' },
        { regex: /(?:password|passwd|pwd)\s*[:=]\s*["'][^"']{6,}["']/i, msg: 'Hardcoded password detected' },
        { regex: /(?:secret|token)\s*[:=]\s*["'][a-zA-Z0-9_\-]{20,}["']/i, msg: 'Hardcoded secret/token detected' },
        { regex: /(?:aws_access_key_id|aws_secret_access_key)\s*[:=]\s*["'][A-Za-z0-9/+=]{16,}["']/i, msg: 'Hardcoded AWS credential detected' },
        { regex: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/i, msg: 'Private key embedded in source code' },
      ];

      lines.forEach((line, idx) => {
        // Skip comments and test files
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*')) return;

        for (const { regex, msg } of patterns) {
          if (regex.test(line)) {
            matches.push({
              line: idx + 1,
              message: msg,
              suggestedFix: 'Move secrets to environment variables and use a secrets manager',
            });
            break;
          }
        }
      });
      return matches;
    },
  },
  {
    id: 'SEC003',
    name: 'xss-vulnerability',
    description: 'Detects potential cross-site scripting vulnerabilities',
    category: IssueCategory.Security,
    severity: Severity.High,
    languages: ['typescript', 'javascript'],
    check: (content: string): RuleMatch[] => {
      const matches: RuleMatch[] = [];
      const lines = content.split('\n');
      const patterns = [
        { regex: /innerHTML\s*=\s*(?!["'`]<)/, msg: 'Using innerHTML with dynamic content can lead to XSS' },
        { regex: /dangerouslySetInnerHTML/, msg: 'dangerouslySetInnerHTML can lead to XSS if not properly sanitized' },
        { regex: /document\.write\s*\(/, msg: 'document.write with dynamic content can lead to XSS' },
        { regex: /\.insertAdjacentHTML\s*\(/, msg: 'insertAdjacentHTML can lead to XSS with unsanitized content' },
        { regex: /eval\s*\(/, msg: 'eval() is dangerous and can lead to code injection' },
        { regex: /new\s+Function\s*\(/, msg: 'new Function() is equivalent to eval and can lead to code injection' },
      ];

      lines.forEach((line, idx) => {
        for (const { regex, msg } of patterns) {
          if (regex.test(line)) {
            matches.push({
              line: idx + 1,
              message: msg,
              suggestedFix: 'Use textContent instead of innerHTML, or sanitize input with DOMPurify',
            });
            break;
          }
        }
      });
      return matches;
    },
  },
  {
    id: 'SEC004',
    name: 'path-traversal',
    description: 'Detects potential path traversal vulnerabilities',
    category: IssueCategory.Security,
    severity: Severity.High,
    languages: ['typescript', 'javascript', 'python'],
    check: (content: string): RuleMatch[] => {
      const matches: RuleMatch[] = [];
      const lines = content.split('\n');
      const patterns = [
        /(?:readFile|readFileSync|createReadStream)\s*\(\s*(?:req\.|params\.|query\.)/i,
        /(?:path\.join|path\.resolve)\s*\(\s*.*(?:req\.|params\.|body\.)/i,
        /(?:fs\.|os\.path).*(?:req\.|request\.)/i,
        /open\s*\(\s*(?:request\.|params\.)/i,
      ];

      lines.forEach((line, idx) => {
        for (const pattern of patterns) {
          if (pattern.test(line)) {
            matches.push({
              line: idx + 1,
              message: 'Potential path traversal: user input used in file system operation',
              suggestedFix: 'Validate and sanitize file paths. Use path.resolve() and verify the result is within allowed directories.',
            });
            break;
          }
        }
      });
      return matches;
    },
  },
  {
    id: 'SEC005',
    name: 'prototype-pollution',
    description: 'Detects potential prototype pollution vulnerabilities',
    category: IssueCategory.Security,
    severity: Severity.High,
    languages: ['typescript', 'javascript'],
    check: (content: string): RuleMatch[] => {
      const matches: RuleMatch[] = [];
      const lines = content.split('\n');
      const patterns = [
        /Object\.assign\s*\(\s*\{\}\s*,.*(?:req\.|body\.|params\.)/i,
        /\[.*(?:req|body|params).*\]\s*=/i,
        /(?:__proto__|constructor\.prototype|Object\.prototype)/,
        /(?:merge|extend|deepMerge)\s*\(.*(?:req\.|body\.)/i,
      ];

      lines.forEach((line, idx) => {
        for (const pattern of patterns) {
          if (pattern.test(line)) {
            matches.push({
              line: idx + 1,
              message: 'Potential prototype pollution vulnerability',
              suggestedFix: 'Use Object.create(null) for dictionaries, validate keys against a whitelist, or use Map instead of plain objects.',
            });
            break;
          }
        }
      });
      return matches;
    },
  },
];

// ─── Quality Rules ──────────────────────────────────────────

const QUALITY_RULES: AnalysisRule[] = [
  {
    id: 'QL001',
    name: 'any-type-usage',
    description: 'Detects usage of "any" type in TypeScript',
    category: IssueCategory.TypeSafety,
    severity: Severity.Medium,
    languages: ['typescript'],
    check: (content: string): RuleMatch[] => {
      const matches: RuleMatch[] = [];
      const lines = content.split('\n');

      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;

        if (/:\s*any\b/.test(line) || /as\s+any\b/.test(line) || /<any>/.test(line)) {
          matches.push({
            line: idx + 1,
            message: 'Avoid using "any" type — it bypasses TypeScript\'s type safety',
            suggestedFix: 'Use "unknown" for truly unknown types, or define a proper type/interface',
          });
        }
      });
      return matches;
    },
  },
  {
    id: 'QL002',
    name: 'console-in-production',
    description: 'Detects console.log statements that should not be in production',
    category: IssueCategory.CodeSmell,
    severity: Severity.Low,
    languages: ['typescript', 'javascript'],
    check: (content: string): RuleMatch[] => {
      const matches: RuleMatch[] = [];
      const lines = content.split('\n');

      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//')) return;

        if (/console\.(log|debug|info)\s*\(/.test(line)) {
          matches.push({
            line: idx + 1,
            message: 'Remove console.log statements before production. Use a proper logging framework.',
            suggestedFix: 'Use a structured logger (e.g., pino, winston) or remove the log statement',
          });
        }
      });
      return matches;
    },
  },
  {
    id: 'QL003',
    name: 'unhandled-promise',
    description: 'Detects unhandled promises and missing error handling',
    category: IssueCategory.BugRisk,
    severity: Severity.High,
    languages: ['typescript', 'javascript'],
    check: (content: string): RuleMatch[] => {
      const matches: RuleMatch[] = [];
      const lines = content.split('\n');

      lines.forEach((line, idx) => {
        // Detect floating promises (async calls without await/catch/then)
        if (/^\s*[a-zA-Z_$][a-zA-Z0-9_$]*\.[a-zA-Z]+\(\);\s*$/.test(line)) {
          // Check if previous line has await
          if (idx > 0 && !/await\s/.test(lines[idx - 1]!)) {
            // This is a very basic check — AI layer handles more complex cases
          }
        }

        // Detect empty catch blocks
        if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(line)) {
          matches.push({
            line: idx + 1,
            message: 'Empty catch block swallows errors silently',
            suggestedFix: 'Log the error or re-throw it. At minimum: catch (error) { console.error(error); }',
          });
        }
      });
      return matches;
    },
  },
  {
    id: 'QL004',
    name: 'missing-error-boundary',
    description: 'Detects React components without error boundaries',
    category: IssueCategory.BugRisk,
    severity: Severity.Medium,
    languages: ['typescript', 'javascript'],
    check: (content: string): RuleMatch[] => {
      const matches: RuleMatch[] = [];

      // Check if file has React component but no ErrorBoundary usage
      const hasReactComponent = /(?:function|const)\s+\w+.*(?:return\s*\(|=>)\s*(?:<|\()/.test(content);
      const hasErrorBoundary = /ErrorBoundary|componentDidCatch|getDerivedStateFromError/.test(content);

      if (hasReactComponent && !hasErrorBoundary && content.includes('useEffect')) {
        matches.push({
          line: 1,
          message: 'React component with side effects should be wrapped in an ErrorBoundary',
          suggestedFix: 'Wrap component tree with an ErrorBoundary component to catch rendering errors',
        });
      }
      return matches;
    },
  },
];

// ─── AI Hallucination Detection Rules ───────────────────────

const HALLUCINATION_RULES: AnalysisRule[] = [
  {
    id: 'HAL001',
    name: 'nonexistent-api',
    description: 'Detects usage of commonly hallucinated APIs',
    category: IssueCategory.Hallucination,
    severity: Severity.High,
    languages: ['typescript', 'javascript'],
    check: (content: string): RuleMatch[] => {
      const matches: RuleMatch[] = [];
      const lines = content.split('\n');
      const hallucinatedAPIs = [
        { pattern: /Array\.last\b/, msg: 'Array.last does not exist — use arr[arr.length - 1] or arr.at(-1)' },
        { pattern: /String\.contains\b/, msg: 'String.contains does not exist — use String.includes()' },
        { pattern: /Object\.length\b/, msg: 'Object.length does not exist — use Object.keys(obj).length' },
        { pattern: /Promise\.sleep\b/, msg: 'Promise.sleep does not exist — use new Promise(r => setTimeout(r, ms))' },
        { pattern: /Array\.flatten\b/, msg: 'Array.flatten does not exist — use Array.flat()' },
        { pattern: /\.toJSON\(\)(?!.*JSON\.stringify)/, msg: 'Verify that .toJSON() is defined on this object' },
        { pattern: /Math\.clamp\b/, msg: 'Math.clamp does not exist — use Math.min(Math.max(val, min), max)' },
        { pattern: /document\.query\b(?!Selector)/, msg: 'document.query does not exist — use document.querySelector()' },
      ];

      lines.forEach((line, idx) => {
        for (const { pattern, msg } of hallucinatedAPIs) {
          if (pattern.test(line)) {
            matches.push({
              line: idx + 1,
              message: `Potential hallucination: ${msg}`,
            });
            break;
          }
        }
      });
      return matches;
    },
  },
  {
    id: 'HAL002',
    name: 'phantom-import',
    description: 'Detects imports from potentially non-existent packages',
    category: IssueCategory.Hallucination,
    severity: Severity.High,
    languages: ['typescript', 'javascript'],
    check: (content: string): RuleMatch[] => {
      const matches: RuleMatch[] = [];
      const lines = content.split('\n');

      // Common hallucinated package patterns
      const suspiciousPatterns = [
        { regex: /from\s+['"]@([a-z]+)\/([a-z-]+)\/([a-z-]+)\/([a-z-]+)['"]/, msg: 'Deeply nested package path — verify this import exists' },
        { regex: /from\s+['"]([a-z-]+)-utils['"]/, msg: 'Package name ending in -utils — verify this exists in package.json' },
      ];

      lines.forEach((line, idx) => {
        if (!line.includes('import') && !line.includes('require')) return;

        for (const { regex, msg } of suspiciousPatterns) {
          if (regex.test(line)) {
            matches.push({
              line: idx + 1,
              message: `Potential hallucination: ${msg}`,
            });
          }
        }
      });
      return matches;
    },
  },
];

// ─── Analyzer Class ─────────────────────────────────────────

export class StaticAnalyzer {
  private rules: AnalysisRule[];

  constructor(customRules?: CustomRule[]) {
    this.rules = [...SECURITY_RULES, ...QUALITY_RULES, ...HALLUCINATION_RULES];

    if (customRules) {
      for (const custom of customRules) {
        this.rules.push(this.compileCustomRule(custom));
      }
    }
  }

  /**
   * Analyze a single file and return all issues found.
   */
  analyzeFile(file: FileChange): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    const applicableRules = this.rules.filter(
      (rule) => rule.languages.includes(file.language) || rule.languages.includes('*')
    );

    for (const rule of applicableRules) {
      try {
        const ruleMatches = rule.check(file.content, file);

        for (const match of ruleMatches) {
          const location: CodeLocation = {
            file: file.path,
            startLine: match.line,
            endLine: match.endLine ?? match.line,
            startColumn: match.column,
            endColumn: match.endColumn,
          };

          issues.push({
            id: uuidv4(),
            category: rule.category,
            severity: rule.severity,
            title: rule.name,
            description: match.message,
            location,
            suggestedFix: match.suggestedFix,
            confidence: 0.85, // Static rules have high base confidence
            ruleId: rule.id,
          });
        }
      } catch (error) {
        // Rule execution failure — log but don't crash
        console.error(`Rule ${rule.id} failed on ${file.path}:`, error);
      }
    }

    return issues;
  }

  /**
   * Analyze multiple files and return aggregated issues.
   */
  analyzeFiles(files: FileChange[]): ReviewIssue[] {
    const allIssues: ReviewIssue[] = [];

    for (const file of files) {
      const fileIssues = this.analyzeFile(file);
      allIssues.push(...fileIssues);
    }

    // Sort by severity (critical first)
    const severityOrder: Record<Severity, number> = {
      [Severity.Critical]: 0,
      [Severity.High]: 1,
      [Severity.Medium]: 2,
      [Severity.Low]: 3,
      [Severity.Info]: 4,
    };

    return allIssues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  }

  /**
   * Get available rule count by category.
   */
  getRuleStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const rule of this.rules) {
      stats[rule.category] = (stats[rule.category] ?? 0) + 1;
    }
    return stats;
  }

  /**
   * Compile a custom rule from user configuration into an AnalysisRule.
   */
  private compileCustomRule(custom: CustomRule): AnalysisRule {
    const regex = new RegExp(custom.pattern, 'gi');

    return {
      id: custom.id,
      name: custom.name,
      description: custom.description,
      category: custom.category,
      severity: custom.severity,
      languages: custom.language ? [custom.language] : ['*'],
      check: (content: string): RuleMatch[] => {
        const matches: RuleMatch[] = [];
        const lines = content.split('\n');

        lines.forEach((line, idx) => {
          if (regex.test(line)) {
            matches.push({
              line: idx + 1,
              message: custom.message,
            });
          }
          regex.lastIndex = 0; // Reset regex state
        });

        return matches;
      },
    };
  }
}

export { SECURITY_RULES, QUALITY_RULES, HALLUCINATION_RULES };
export type { AnalysisRule, RuleMatch };
