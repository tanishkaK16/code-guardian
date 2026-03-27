# 🛡️ AI Code Guardian

**Automated AI-powered code review, security analysis, test generation, and hallucination detection for your pull requests.**

AI Code Guardian sits between your AI coding tools and production — catching security vulnerabilities, hallucinated APIs, and bugs before they reach your codebase.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔍 **Static Analysis** | 12+ CodeQL-style rules for SQL injection, XSS, secrets, path traversal, prototype pollution |
| 🤖 **AI Reasoning** | Gemini 2.5 Pro / Claude 3.5 Sonnet for deep code analysis and fix suggestions |
| 👻 **Hallucination Detection** | Catches non-existent APIs, incorrect method signatures, phantom packages |
| 🧪 **Auto Test Generation** | Generates Vitest test suites and runs them in isolated sandboxes |
| 📊 **Confidence Scoring** | Multi-dimensional scores: Security, Correctness, Quality, Test Coverage |
| 🔗 **Git Integration** | GitHub & GitLab webhooks with OAuth, inline PR comments |
| 🖥️ **Web Dashboard** | Next.js 15 app with diff view, Accept/Fix/Reject actions, audit log |
| 🧩 **VS Code Extension** | Real-time analysis, inline diagnostics, command palette |
| 📋 **Audit Log** | Complete history of all review actions and decisions |
| 🐳 **Self-Hostable** | Docker Compose with Supabase backend |

---

## 🏗️ Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│  GitHub PR   │────▶│  Webhook     │────▶│  Review Engine   │
│  GitLab MR   │     │  Server      │     │                  │
└──────────────┘     └──────────────┘     │  ┌────────────┐  │
                                          │  │ Static     │  │
┌──────────────┐                          │  │ Analysis   │  │
│  VS Code     │────────────────────────▶│  ├────────────┤  │
│  Extension   │                          │  │ AI Engine  │  │
└──────────────┘                          │  │ (Gemini/   │  │
                                          │  │  Claude)   │  │
┌──────────────┐                          │  ├────────────┤  │
│  Dashboard   │◀────────────────────────│  │ Test Gen   │  │
│  (Next.js)   │                          │  │ + Sandbox  │  │
└──────────────┘                          │  ├────────────┤  │
                                          │  │ Confidence │  │
┌──────────────┐                          │  │ Scorer     │  │
│  Supabase    │◀────────────────────────│  └────────────┘  │
│  (Postgres)  │                          └──────────────────┘
└──────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+
- **npm** 10+
- **Docker** (for self-hosting)
- API key for **Gemini** or **Anthropic Claude**

### 1. Clone & Install

```bash
git clone https://github.com/your-org/ai-code-guardian.git
cd ai-code-guardian
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your API keys
```

### 3. Run Development

```bash
# Start all packages in dev mode
npm run dev

# Or start just the web dashboard
npm run dev:web
```

### 4. Open Dashboard

Visit **http://localhost:3000** to see the Guardian dashboard.

---

## 🐳 Self-Hosted Deployment

### Docker Compose (Recommended)

```bash
# Set your environment variables
export GEMINI_API_KEY=your-key
export GITHUB_WEBHOOK_SECRET=your-secret

# Start everything
npm run docker:up

# Stop
npm run docker:down
```

This starts:
- **Postgres** (Supabase) on port 5432
- **API Server** on port 3001
- **Web Dashboard** on port 3000
- **Nginx Proxy** on port 80

### Manual Deployment

```bash
# Build all packages
npm run build:all

# Start API server
node packages/git-integration/dist/index.js

# Start web dashboard
cd apps/web && npm start
```

---

## 🔗 Git Integration Setup

### GitHub

1. Create a GitHub App or use OAuth:
   - Set webhook URL: `https://your-domain.com/webhooks/github`
   - Subscribe to: Pull Request events
   - Set webhook secret

2. Configure environment:
   ```env
   GITHUB_CLIENT_ID=your-client-id
   GITHUB_CLIENT_SECRET=your-client-secret
   GITHUB_WEBHOOK_SECRET=your-webhook-secret
   ```

3. Connect via the Settings page in the dashboard.

### GitLab

1. Go to your project → Settings → Webhooks
2. Set URL: `https://your-domain.com/webhooks/gitlab`
3. Set Secret Token
4. Select: Merge Request events

---

## 🧩 VS Code Extension

### Install

```bash
cd apps/vscode
npm install
npm run build
# Package as VSIX
npx vsce package
```

Then install the `.vsix` file in VS Code.

### Configure

Open VS Code settings and set:
- `guardian.aiProvider`: `gemini` or `anthropic`
- `guardian.geminiApiKey`: Your Gemini API key
- `guardian.autoReview`: Auto-review on save

### Commands

| Command | Description |
|---------|-------------|
| `Guardian: Review Current File` | Full AI-powered review |
| `Guardian: Review All Changed Files` | Scan workspace |
| `Guardian: Open Dashboard` | Open web dashboard |

---

## 📊 Confidence Scoring

Scores are calculated across 4 dimensions:

| Dimension | Weight | What it measures |
|-----------|--------|-----------------|
| **Security** | 35% | Vulnerabilities, secrets, injection risks |
| **Correctness** | 30% | Bugs, hallucinations, test results |
| **Quality** | 20% | Code smells, type safety, performance |
| **Test Coverage** | 15% | Generated test pass rate |

Severity penalties per issue:
- 🚨 Critical: -25 points
- 🔴 High: -15 points
- 🟡 Medium: -8 points
- 🔵 Low: -3 points
- ℹ️ Info: -1 point

---

## 🔍 Built-in Rules

### Security Rules (SEC)
| Rule | Description |
|------|-------------|
| SEC001 | SQL Injection via string interpolation |
| SEC002 | Hardcoded API keys, passwords, secrets |
| SEC003 | XSS via innerHTML, eval, dangerouslySetInnerHTML |
| SEC004 | Path traversal via unsanitized file paths |
| SEC005 | Prototype pollution via unsafe object merging |

### Quality Rules (QL)
| Rule | Description |
|------|-------------|
| QL001 | Usage of `any` type in TypeScript |
| QL002 | Console.log in production code |
| QL003 | Empty catch blocks / unhandled errors |
| QL004 | React components without ErrorBoundary |

### Hallucination Rules (HAL)
| Rule | Description |
|------|-------------|
| HAL001 | Non-existent APIs (Promise.sleep, Array.last, etc.) |
| HAL002 | Suspicious deep-nested package imports |

---

## 🧪 Running Tests

```bash
# Run all tests
npm run test:all

# Run core package tests
cd packages/core && npm test

# Watch mode
cd packages/core && npm run test:watch
```

---

## 📁 Project Structure

```
ai-code-guardian/
├── apps/
│   ├── web/                    # Next.js 15 Dashboard
│   │   └── src/app/
│   │       ├── page.tsx        # Dashboard with stats & charts
│   │       ├── reviews/        # Review list & detail pages
│   │       ├── audit/          # Audit log timeline
│   │       └── settings/       # Configuration page
│   └── vscode/                 # VS Code Extension
├── packages/
│   ├── core/                   # Review engine (shared)
│   │   └── src/
│   │       ├── analyzer/       # Static analysis (12+ rules)
│   │       ├── ai/             # AI reasoning (Gemini/Claude)
│   │       ├── testing/        # Test generation (Vitest)
│   │       ├── sandbox/        # Isolated test runner
│   │       ├── scorer/         # Confidence scoring
│   │       ├── engine/         # Review orchestrator
│   │       └── types/          # TypeScript types
│   ├── git-integration/        # GitHub/GitLab adapters
│   └── supabase/               # Database layer & migrations
├── docker/                     # Docker Compose setup
└── README.md
```

---

## 🔒 Security

- All webhook payloads are verified using HMAC-SHA256 (constant-time comparison)
- OAuth tokens are encrypted at rest
- Database uses Row Level Security (RLS) policies
- Sandbox runner has memory limits & timeouts
- No secrets are stored in source code

---

## 📝 License

MIT License. See [LICENSE](./LICENSE) for details.

---

<p align="center">
  <strong>Built with ❤️ for safer AI-generated code</strong>
</p>
