# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Memoria** is an MCP server that gives AI assistants something they desperately lack: **memory of what broke before**.

**Tagline:** Don't Let Your AI Be Stupid.

### The Problem

AI assistants are goldfish. They see the file you're editing but have zero awareness of:
- Files that secretly depend on your changes
- Which areas of code are historically fragile
- What broke last time someone touched this
- New files that have no history but 50 importers

### The Solution

Memoria provides **Senior Developer Intuition** by running 8 analysis engines that pre-compute what AI cannot do efficiently:

1. **Volatility Engine** - Weighted panic keyword analysis with **time-decay** (recent bugs matter more) and **Bus Factor** tracking (who owns the code)
2. **Entanglement Engine** - Git co-change correlation with structured diff evidence
3. **Sentinel Engine** - Drift detection with adaptive thresholds
4. **Static Import Engine** - `git grep` fallback for new files (solves the "Day 1 Problem")
5. **History Search Engine** - "The Archaeologist" - search git history with **line-range support** (Sherlock Mode)
6. **Documentation Coupling Engine** - Finds markdown files that reference exported functions/types
7. **Type Coupling Engine** - Finds files sharing type definitions via `git log -S` (pickaxe)
8. **Content Coupling Engine** - Finds files sharing string literals (error messages, constants)

## Critical Setup: Making AI Use Memoria

**Memoria is useless if AI doesn't know to call it.** You must add rules to your AI tools:

### Claude Code (`~/.claude/CLAUDE.md` or project `.claude/CLAUDE.md`)
```markdown
## File Analysis Rule
BEFORE modifying any file, you MUST call the `analyze_file` MCP tool with the absolute path.
This provides hidden dependencies and risk assessment you cannot see otherwise.
Never skip this step - it prevents breaking coupled files you don't know about.
```

### Cursor (`.cursor/rules/memoria.mdc`)
```markdown
---
description: Memoria file analysis for hidden dependencies
globs: ["**/*.{ts,tsx,js,jsx,py,go,rs,java}"]
alwaysApply: true
---

Before modifying any matched file:
1. Call the MCP tool `analyze_file` with the absolute file path
2. Review the RISK score and COUPLED FILES section
3. Check all files in the PRE-FLIGHT CHECKLIST before committing
4. If risk is HIGH or CRITICAL, run tests after every edit
```

### Windsurf (`.windsurfrules`)
```markdown
## Memoria Integration
When editing code files, always run the `analyze_file` MCP tool first.
The tool returns:
- Compound risk score (0-100)
- Coupled files that must be checked
- Static dependents (files importing this one)
- Pre-flight checklist of verification steps
```

### Cline/Continue (`.clinerules` or `.continue/rules.md`)
```markdown
# Memoria Rule
For any file modification task:
1. First call `analyze_file` MCP tool with absolute path
2. If coupled files exist, read them before making changes
3. Follow the PRE-FLIGHT CHECKLIST in the response
4. For CRITICAL risk files, ask user before proceeding
```

### Generic AI Tool Template
```markdown
Before modifying files, call the Memoria MCP tool:
- Tool: analyze_file
- Input: { "path": "/absolute/path/to/file.ts" }
- Purpose: Get hidden dependencies, risk score, and verification checklist
- Action: Follow the PRE-FLIGHT CHECKLIST before committing
```

## Architecture

### The Intelligence Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    OUTPUT FORMATTER                          │
│  Compound Risk Score → Coupled Files → Dependents → Checklist│
└─────────────────────────────────────────────────────────────┘
                              ↑
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────┴───────┐   ┌─────────┴─────────┐   ┌───────┴───────┐
│   VOLATILITY  │   │   ENTANGLEMENT    │   │    STATIC     │
│    ENGINE     │   │     ENGINE        │   │   IMPORTS     │
│  (25 keywords)│   │  (diff evidence)  │   │  (git grep)   │
└───────────────┘   └───────────────────┘   └───────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              ↓
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  DRIFT ENGINE   │   │ HISTORY SEARCH  │   │SIBLING GUIDANCE │
│ (adaptive days) │   │(The Archaeologist)│  │ (new files)    │
└─────────────────┘   └─────────────────┘   └─────────────────┘
                              ↓
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────┴───────┐   ┌─────────┴─────────┐   ┌───────┴───────┐
│     DOCS      │   │      TYPE         │   │    CONTENT    │
│   COUPLING    │   │    COUPLING       │   │   COUPLING    │
│  (git grep)   │   │  (git log -S)     │   │ (git grep -F) │
└───────────────┘   └───────────────────┘   └───────────────┘
```

### Single File Implementation

Everything lives in `src/index.ts`:
- MCP Server with stdio transport (2 tools: `analyze_file` and `ask_history`)
- 8 analysis engines running in parallel
- LRU cache (100 items, 5-minute TTL)
- Output formatter generating AI-optimized markdown
- Optional `.memoria.json` config support

### Key Design Decisions

- **Pre-computation > Raw Data**: We parse diffs into structured summaries (90% token reduction)
- **Weighted Scoring**: "security vulnerability" matters more than "fix typo"
- **Adaptive Thresholds**: High-velocity repos get different treatment than slow ones
- **Hybrid Detection**: Git history + static imports = 100% coverage (even Day 1 files)

## Commands

```bash
# Build TypeScript to dist/
npm run build

# Watch mode for development
npm run dev

# Run the MCP server
npm start

# Run test suite (442 tests)
npm test
```

## MCP Tool Interface

### `analyze_file`

**Input:**
```json
{ "path": "/absolute/path/to/file.ts" }
```

**Output Structure:**
```markdown
### Forensics for `filename.ts`

**RISK: 65/100 (HIGH)**
> Proceed carefully. Check all coupled files and update stale dependencies.
**Risk Factors:** High volatility (45% panic score) • Tightly coupled (3 files) • Heavily imported (8 files depend on this)

---

**COUPLED FILES**
**📐 `types.ts`** (67% coupled, schema)
> These files share type definitions. If you modify types in one, update the other to match.
> + interface User, userId: string
> - oldField: number

---

**STATIC DEPENDENTS**
> These files explicitly import `filename.ts`. If you change the API, you MUST update them.
- [ ] Check `src/components/Profile.tsx`
- [ ] Check `src/services/AuthService.ts`

---

**PRE-FLIGHT CHECKLIST**
- [ ] Modify `filename.ts` (primary target)
- [ ] Verify `types.ts` (schema coupling)
- [ ] Verify `Profile.tsx` (imports this file)
```

### `ask_history` (The Archaeologist + Sherlock Mode)

Search git history to understand WHY code was written a certain way. Solves the **Chesterton's Fence** problem.

**Input:**
```json
{
  "query": "setTimeout",
  "path": "/optional/scope/to/file.ts",
  "searchType": "both",
  "limit": 20,
  "startLine": 100,
  "endLine": 150
}
```

**Parameters:**
- `query` (required) - Keyword to search for in commit messages or code diffs
- `path` (optional) - Scope search to a specific file or directory
- `searchType` (optional) - Where to search: `"message"`, `"diff"`, or `"both"` (default: `"both"`)
- `limit` (optional) - Maximum results to return (default: 20)
- `startLine` (optional) - Start line for line-range search (Sherlock Mode)
- `endLine` (optional) - End line for line-range search (Sherlock Mode)

**Output Structure:**
```markdown
### History Search: "setTimeout" in `src/api/utils.ts`

**Found 3 relevant commits:**

**1. 💬 [a1b2c3] 2022-03-15 @developer**
> Fix race condition in Safari where API returns before DOM ready
> Files: `utils.ts`, `safari-polyfill.ts`

**2. 📝 [d4e5f6] 2021-11-20 @senior-dev**
> Add timeout fallback for slow network conditions
> Files: `utils.ts`, `config.ts`

---

⚠️ **Bug fixes detected!** Review these commits carefully before modifying this code.

**AI INSTRUCTION:**
Before removing or modifying code matching "setTimeout":
- [ ] Review context in `utils.ts`, `safari-polyfill.ts`
- [ ] Check commit a1b2c3 for the original reasoning
```

**Use Cases:**
- User asks: "Why do we have a setTimeout here?"
- AI calls: `ask_history("setTimeout", "src/api/utils.ts")`
- Tool returns: Commit from 3 years ago explaining the Safari race condition fix

**Sherlock Mode (Line-Range Search):**
User highlights lines 100-150 and asks: "Why is this weird if-statement here?"
- AI calls: `ask_history("", "src/api/utils.ts", "diff", 10, 100, 150)`
- Tool uses `git log -L 100,150:src/api/utils.ts` to find all commits that touched those lines
- Returns the full history of that specific code block

## The 13 Engines Explained

### Engine 1: Volatility (Panic Detection + Time-Decay + Bus Factor)

Scans commit messages for weighted keywords with **time-decay** (recent bugs matter more):

| Weight | Keywords | Example |
|--------|----------|---------|
| 3x (Critical) | security, vulnerability, crash, data loss | "Fix security vulnerability in auth" |
| 2x (High) | revert, hotfix, urgent, breaking, critical | "Hotfix: revert payment logic" |
| 1x (Normal) | fix, bug, patch, error, issue | "Fix login form validation" |
| 0.5x (Low) | refactor, cleanup, lint, format | "Refactor user service" |

**Time-Decay Formula:**
```typescript
// Risk drops by 50% every 30 days
decay = Math.pow(0.5, daysAgo / 30)
weightedPanicScore += keywordWeight * decay
```

A bug fix from yesterday matters far more than a fix from 3 years ago.

**Bus Factor Tracking:**
Now tracks all contributors with commit counts and percentages:
- `authorDetails[]` - All authors sorted by commit count
- `topAuthor` - The primary owner (most commits)
- Expert warning when one person owns >70% of the file

**Output Example:**
```
🔥 Status: VOLATILE (Score: 85%)
Expert: Dave wrote 90% of this file. If the logic is unclear, assume it is complex.

Contributors:
  - Dave (45 commits, 90%)
  - Alice (3 commits, 6%)
  - Bob (2 commits, 4%)
```

### Engine 2: Entanglement (Co-Change Correlation)

Analyzes git history to find files that change together:

1. Get last N commits for target file (N = adaptive, 30-100)
2. For each commit, find all other files changed
3. Calculate coupling %: `(co-changes / total commits) * 100`
4. Fetch actual diff and parse into `DiffSummary`:
   - `additions[]` / `removals[]` - What changed
   - `changeType` - schema/api/config/import/test/style/unknown
   - `hasBreakingChange` - Removed exports, deleted functions, etc.

**Output:** Top 5 coupled files with relationship classification

### Engine 3: Sentinel (Drift Detection)

Detects when coupled files get out of sync:

- Compares file modification timestamps
- Uses adaptive thresholds based on project velocity:
  - Low velocity (<5 commits/week): 14 days
  - Normal velocity: 7 days
  - High velocity (>50 commits/week): 3 days

**Output:** List of stale files with days since last update

### Engine 4: Static Imports (The Fallback Layer)

**The Problem:** New files have no git history. Memoria would say "Stable, no coupling" even if 50 files import it.

**The Solution:** `git grep` for import statements:

```typescript
// Find all files that mention "UserService"
git grep -l -- UserService
```

**Why This Matters:**
- Nearly free (~10ms)
- Works on Day 1 of a new file
- Catches compilation/import errors that git history misses

### Engine 5: History Search (The Archaeologist + Sherlock Mode)

Searches git history to answer "Why was this code written this way?"

**Three Search Modes:**
1. **Message search** (`git log --grep`) - Finds commits mentioning the keyword
2. **Pickaxe search** (`git log -S`) - Finds commits that added/removed the keyword in code
3. **Line-range search** (`git log -L`) - Finds all commits that touched specific lines (Sherlock Mode)

**Output includes:**
- Commit hash, date, and author
- Full commit message
- Files changed in that commit
- Match type indicator (💬 message vs 📝 diff)
- Warning if bug fixes are detected

**Sherlock Mode (Line-Range Search):**
When you need to understand WHY specific lines exist:
```typescript
// Search history of lines 100-150 in a file
await searchHistory("", filePath, "diff", 10, 100, 150)
// Uses: git log -L 100,150:filepath
```

**Why This Matters:**
- Solves Chesterton's Fence problem - understand WHY before changing
- Finds context lost in code comments
- Surfaces past bug fixes that explain "weird" code
- Line-range search traces the full evolution of a specific code block

### Engine 6: Documentation Coupling (Git Grep)

Finds markdown files that reference exported functions, types, or classes from the source file.

**How It Works:**
```typescript
// 1. Extract exports from source file
const exports = extractExports(sourceCode);
// Result: ["generateAiInstructions", "formatHistoryResults", "searchHistory"]

// 2. Search markdown files for these exports
git grep -l -e "generateAiInstructions" -e "formatHistoryResults" -- "*.md"
// Result: ["README.md", "CLAUDE.md", "docs/api.md"]
```

**Why This Matters:**
- Catches README files that need updating when output format changes
- Finds documentation that references your API
- Prevents broken code examples in docs
- Labels coupled files with `[docs]` in output

### Engine 7: Type Coupling (Pickaxe Search)

Finds files sharing type definitions using git's pickaxe feature (`git log -S`).

**How It Works:**
```typescript
// 1. Extract type definitions from source file
const types = extractTypeDefinitions(sourceCode);
// Result: ["UserData", "AuthState", "CoupledFile"]

// 2. Find commits that added/removed these types
git log -S "interface UserData" --name-only --format=""
// Result: Files that have the same type definition
```

**Why This Matters:**
- Finds files sharing interfaces/types without direct imports
- Detects semantic coupling through shared data structures
- Labels coupled files with `[type]` in output

### Engine 8: Content Coupling (String Literal Search)

Finds files sharing significant string literals like error messages, API endpoints, or constants.

**How It Works:**
```typescript
// 1. Extract meaningful strings from source file (>10 chars, not imports)
const strings = extractStringLiterals(sourceCode);
// Result: ["Authentication failed", "Invalid request format"]

// 2. Find other files with the same strings
git grep -l -F "Authentication failed" -- "*.ts" "*.tsx"
// Result: Files sharing that error message
```

**Why This Matters:**
- Finds files coupled through shared constants
- Catches error message inconsistencies
- Detects hardcoded strings that should be centralized
- Labels coupled files with `[content]` in output

### Engine 9: Test File Coupling (Auto-Discovery)

Finds test files that should be updated when source changes. Language-agnostic - no hardcoded extensions.

**How It Works:**
```typescript
// 1. Get basename (login.ts -> login)
const basename = path.basename(filePath, ext);

// 2. Search for test file naming patterns
const testPatterns = [
  `${basename}\\.test\\.`,      // login.test.ts
  `${basename}\\.spec\\.`,      // login.spec.py
  `${basename}_test\\.`,        // login_test.go
  `test_${basename}\\.`,        // test_login.py
];
git grep -l -E "login\\.test\\.|login\\.spec\\." -- "*"

// 3. Also find mocks/fixtures
git grep -l -E "mock.*LoginService|LoginService.*mock"
```

**Why This Matters:**
- Catches missing test updates when changing exports
- Finds mock files that need interface updates
- Works across all test frameworks (Jest, Vitest, pytest, Go testing)
- Labels coupled files with `[test]` in output

### Engine 10: Environment Variable Coupling (Auto-Discovery)

Finds files sharing the same environment variables.

**How It Works:**
```typescript
// 1. Extract ALL_CAPS_UNDERSCORE patterns (universal env var convention)
const envVarRegex = /\b([A-Z][A-Z0-9_]{3,})\b/g;
// Result: ["API_KEY", "DATABASE_URL", "STRIPE_SECRET"]

// 2. Search all tracked files for these variables
git grep -l -E "API_KEY|DATABASE_URL|STRIPE_SECRET"
```

**Why This Matters:**
- Works across any language (JS, Python, Go, Ruby, Java, Rust)
- Catches environment mismatches that cause runtime crashes
- Finds config files that need updating
- Labels coupled files with `[env]` in output

### Engine 11: Schema/Model Coupling (Auto-Discovery)

Finds files affected by database schema or model changes.

**How It Works:**
```typescript
// 1. Detect schema-related content patterns
const schemaIndicators = [
  /CREATE\s+TABLE\s+(\w+)/gi,      // SQL
  /model\s+(\w+)\s*\{/gi,          // Prisma
  /@Entity|@Table|@Column/gi,      // TypeORM/Hibernate
  /mongoose\.model\s*\(/gi,        // Mongoose
];

// 2. Extract table/model names
const tables = extractSchemaNames(sourceCode);
// Result: ["users", "orders", "User"]

// 3. Find files referencing these tables
git grep -l -E "\\busers\\b|\\bUser\\b"
```

**Why This Matters:**
- Catches schema changes that break queries
- Finds migration files that need ordering checks
- Works with SQL, ORMs, and document databases
- Labels coupled files with `[schema]` in output

### Engine 12: API Endpoint Coupling (Auto-Discovery)

Finds client code that calls API endpoints defined in the target file.

**How It Works:**
```typescript
// 1. Detect if file defines API routes
const apiIndicators = [
  /app\.(get|post|put|delete)\s*\(/,    // Express
  /@(Get|Post|Put|Delete)\s*\(/,        // NestJS/Spring
  /export\s+function\s+(GET|POST)/,     // Next.js
];

// 2. Extract endpoint paths
const endpoints = extractApiEndpoints(sourceCode);
// Result: ["/api/users", "/api/auth/login"]

// 3. Find files calling these endpoints
git grep -l -F "/api/users"
```

**Why This Matters:**
- Catches API contract violations
- Finds UI components that break when response shapes change
- Works with REST, GraphQL, and RPC patterns
- Labels coupled files with `[api]` in output

### Engine 13: Re-Export Chain Coupling (Transitive)

Finds files affected through barrel/index re-exports.

**How It Works:**
```typescript
// 1. Find files that re-export the target
const reExportPattern = `export.*from.*['"].*${basename}['"]`;
git grep -l -E "export.*from.*UserService"
// Result: ["features/auth/index.ts"]

// 2. Find transitive importers of those barrels
git grep -l -E "from.*features/auth"
// Result: ["app/routes.ts", "pages/login.tsx"]
```

**Why This Matters:**
- Reveals hidden dependencies through barrel files
- Catches breaking changes that propagate transitively
- Common in monorepos with feature folders
- Labels coupled files with `[transitive]` in output

### Sibling Guidance (New File Intelligence)

When analyzing a file with no git history, Memoria provides intelligent guidance based on sibling files:

**Analysis includes:**
- Test file patterns (do siblings have `.test.ts` files?)
- Common imports across siblings
- Naming conventions (prefix/suffix patterns)
- Average volatility of the folder

**Why This Matters:**
- New files aren't "safe" - they may have 50 importers
- Sibling analysis reveals expected patterns
- Helps AI follow existing conventions

### Compound Risk Formula

```
Risk = Volatility(35%) + Coupling(30%) + Drift(20%) + Importers(15%)
```

| Score | Level | Action |
|-------|-------|--------|
| 75+ | CRITICAL | STOP. Review all coupled files before changes. |
| 50-74 | HIGH | Proceed carefully. Check coupled files. |
| 25-49 | MEDIUM | Standard caution. Verify compatibility. |
| 0-24 | LOW | Safe to proceed normally. |

## Configuration

### Claude Desktop (`~/.config/claude/claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "memoria": {
      "command": "node",
      "args": ["/path/to/memoria/dist/index.js"]
    }
  }
}
```

### Cursor MCP Settings
```json
{
  "mcpServers": {
    "memoria": {
      "command": "node",
      "args": ["/path/to/memoria/dist/index.js"]
    }
  }
}
```

### NPM Global Install (Recommended)
```bash
npm install -g @byronwade/memoria
```

Then in your MCP config:
```json
{
  "mcpServers": {
    "memoria": {
      "command": "memoria"
    }
  }
}
```

## Configuration File (`.memoria.json`)

Create a `.memoria.json` file in your repository root to customize Memoria's behavior:

```json
{
  "thresholds": {
    "couplingPercent": 15,
    "driftDays": 7,
    "analysisWindow": 50
  },
  "ignore": [
    "migrations/**",
    "generated/**",
    "*.generated.ts"
  ],
  "panicKeywords": {
    "p0": 3,
    "outage": 3,
    "incident": 2.5
  },
  "riskWeights": {
    "volatility": 0.35,
    "coupling": 0.30,
    "drift": 0.20,
    "importers": 0.15
  }
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `thresholds.couplingPercent` | number (0-100) | 15 | Minimum coupling % to report |
| `thresholds.driftDays` | number (1-365) | 7 | Days before file is "stale" |
| `thresholds.analysisWindow` | number (10-500) | 50 | Commits to analyze |
| `thresholds.maxFilesPerCommit` | number (5-100) | 15 | Skip commits touching more files (filters bulk refactors/renames) |
| `ignore` | string[] | [] | Additional glob patterns to ignore |
| `panicKeywords` | Record<string, number> | {} | Custom panic keywords with weights |
| `riskWeights.volatility` | number (0-1) | 0.35 | Weight for volatility in risk score |
| `riskWeights.coupling` | number (0-1) | 0.30 | Weight for coupling in risk score |
| `riskWeights.drift` | number (0-1) | 0.20 | Weight for drift in risk score |
| `riskWeights.importers` | number (0-1) | 0.15 | Weight for importers in risk score |

### Example Configurations

**High-velocity monorepo:**
```json
{
  "thresholds": {
    "couplingPercent": 10,
    "driftDays": 3,
    "analysisWindow": 100
  },
  "panicKeywords": {
    "p0": 3,
    "sev1": 2.5,
    "rollback": 2
  }
}
```

**Stable library with strict coupling:**
```json
{
  "thresholds": {
    "couplingPercent": 25,
    "driftDays": 14
  },
  "riskWeights": {
    "coupling": 0.50,
    "volatility": 0.20
  }
}
```

## Tech Stack

- **TypeScript ES2022** - Strict mode, ESM
- **@modelcontextprotocol/sdk** - MCP protocol
- **simple-git** - Git operations
- **lru-cache** - Response caching
- **ignore** - .gitignore parsing
- **zod** - Config file validation

## Noise Filtering

Universal patterns filtered from analysis:
- Lock files: `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `Cargo.lock`, `Gemfile.lock`
- Build outputs: `dist/`, `build/`, `target/`, `out/`, `.next/`, `__pycache__/`
- Dependencies: `node_modules/`, `vendor/`, `venv/`, `.bundle/`
- IDE: `.vscode/`, `.idea/`, `*.swp`

Plus any patterns from the project's `.gitignore`.

## Test Coverage

442 tests covering:
- All 13 engines with edge cases
- Documentation, type, and content coupling engines
- Test file, env var, schema, API, and transitive coupling engines
- Time-decay and bus factor tracking
- History search (message, diff, and line-range modes)
- Sibling guidance for new files
- Config file loading and validation
- Diff parsing and classification
- Compound risk calculation
- Adaptive thresholds
- Output formatting
- MCP tool handler
- Caching behavior

```bash
npm test
```

## Why Memoria Exists

AI assistants make the same mistakes junior developers make:
1. Change a file without checking what depends on it
2. Ignore historically problematic areas
3. Miss "spooky action at a distance" (files coupled by convention, not imports)
4. Don't know about new files until they break

Memoria gives AI the context a senior developer would have after working on a codebase for months. It's the memory your AI lacks.
