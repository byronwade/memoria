# Contributing to Memoria

Thank you for considering a contribution to Memoria. This project exists to give AI assistants the kind of institutional memory that prevents real mistakes — every improvement matters.

Before diving in, please read this document in full. It covers the contributor agreement, dev setup, code conventions, how the engine architecture works, and the PR process.

---

## Table of Contents

1. [Contributor License Agreement (CLA)](#contributor-license-agreement-cla)
2. [Code of Conduct](#code-of-conduct)
3. [Development Setup](#development-setup)
4. [Project Structure](#project-structure)
5. [Code Style & Conventions](#code-style--conventions)
6. [Testing Expectations](#testing-expectations)
7. [Adding or Extending an Engine](#adding-or-extending-an-engine)
8. [Pull Request Process](#pull-request-process)
9. [Issue Reporting Guidelines](#issue-reporting-guidelines)
10. [Commit Message Format](#commit-message-format)

---

## Contributor License Agreement (CLA)

**All contributors must sign the CLA before a pull request can be merged.**

By contributing code, documentation, or any other material to this repository, you agree to the terms of the [Memoria Individual Contributor License Agreement](./CLA.md).

**Summary of what you're agreeing to:**
- You retain copyright over your contribution.
- You grant the maintainer a perpetual, irrevocable, worldwide license to use, modify, sublicense, and redistribute your contribution under any license — including commercial or proprietary licenses — while the core project remains open source under MIT.
- You confirm you have the right to make the contribution (i.e., it is your own work or you have permission to contribute it).

**How to sign:**

We use [CLA Assistant](https://cla-assistant.io/) for a low-friction, one-click signing flow. When you open a pull request, a bot will automatically prompt you to sign if you have not done so already. Signing takes about 30 seconds and only needs to happen once per GitHub account.

If you are contributing on behalf of a company or organization, please open an issue titled **"Corporate CLA — [Company Name]"** and we will arrange a Corporate CLA.

---

## Code of Conduct

This project follows the [Contributor Covenant](https://www.contributor-covenant.org/) v2.1. In short: be respectful, be constructive, and assume good intent. Harassment of any kind will not be tolerated.

Report issues to: **bw@wadesinc.io**

---

## Development Setup

### Prerequisites

| Tool | Minimum version | Notes |
|------|----------------|-------|
| Node.js | 18.0.0 | `node --version` |
| npm | 9.0.0 | Bundled with Node 18+ |
| Git | 2.30+ | Required for engine tests |

### Clone and install

```bash
git clone https://github.com/byronwade/memoria.git
cd memoria
npm install
```

This is a Turborepo monorepo. `npm install` installs dependencies for all workspaces (`apps/mcp-server`, `apps/web`, `apps/api`) in one step.

### Build

```bash
# Build everything
npm run build

# Build only the MCP server (most contributors only need this)
npm run build --workspace=apps/mcp-server
```

TypeScript output goes to `apps/mcp-server/dist/`. The server entry point is `apps/mcp-server/dist/index.js`.

### Run the MCP server locally

```bash
# Start the server (after building)
node apps/mcp-server/dist/index.js

# Or using the bin alias
npm start --workspace=apps/mcp-server
```

### Watch mode (development)

```bash
# Recompile on save
npm run dev --workspace=apps/mcp-server
```

### Run tests

```bash
# All workspaces
npm test

# MCP server only (most common)
npm test --workspace=apps/mcp-server

# Watch mode
npm run test:watch --workspace=apps/mcp-server

# Coverage report
npm run test:coverage --workspace=apps/mcp-server
```

### Wire up to your AI tool

To test Memoria end-to-end during development, point your MCP client at the local build. For Claude Desktop, add this to `~/.config/claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "memoria-dev": {
      "command": "node",
      "args": ["/absolute/path/to/memoria/apps/mcp-server/dist/index.js"]
    }
  }
}
```

---

## Project Structure

```
memoria/
├── apps/
│   ├── mcp-server/          # The MCP server — primary contribution target
│   │   ├── src/
│   │   │   ├── index.ts     # Everything: server, all 13 engines, output formatter, cache
│   │   │   ├── cli.ts       # CLI interface
│   │   │   ├── auth.ts      # Authentication
│   │   │   └── ...
│   │   ├── tests/           # Vitest test files
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   ├── web/                 # Next.js marketing/docs site
│   └── api/                 # Convex backend
├── .github/
│   └── workflows/
│       ├── ci.yml           # Runs tests on Node 18, 20, 22
│       └── publish.yml      # Publishes to npm on version tags
├── turbo.json
├── CONTRIBUTING.md          # This file
└── CLA.md                   # Contributor License Agreement
```

The MCP server (`apps/mcp-server/src/index.ts`) is intentionally a single large file. This is a deliberate architectural choice — it makes the server trivially deployable as a standalone binary and avoids circular dependency issues that commonly arise when splitting an MCP server with shared state. Resist the urge to split it without a strong reason.

---

## Code Style & Conventions

### TypeScript

- **Strict mode** is on. No `any` unless unavoidable; use `unknown` and narrow it.
- Target is **ES2022** with ESM (`"type": "module"` in package.json).
- Prefer explicit return types on exported functions.
- Avoid classes where a plain function or object will do.

### Formatting

The project does not yet enforce a linter or formatter via CI. Follow the existing style in `src/index.ts`:

- 2-space indentation
- Single quotes for strings
- Trailing commas in multi-line arrays/objects
- Blank line between logical sections inside functions
- No semicolons at end of statements (TypeScript infers them)

A Biome config is used for the `apps/web` workspace. If you are adding formatting tooling to `apps/mcp-server`, open a separate discussion issue first.

### Comments

Only add a comment when the **why** is non-obvious — a hidden constraint, a workaround, a subtle invariant. Do not comment the **what**; well-named identifiers already do that.

### Error handling

- Engines must **never throw**. Catch internally and return a safe empty/default result. A single broken engine should never crash the whole analysis.
- Surface meaningful diagnostics in `console.error` rather than swallowing them silently.

---

## Testing Expectations

Memoria's engine correctness depends entirely on git history. This makes testing unusual.

### What we test

Every engine has a corresponding test file in `apps/mcp-server/tests/`. Tests use **Vitest** and run in Node environment.

| Test scope | Required for |
|------------|-------------|
| Engine unit tests | Any new engine or engine change |
| Output formatter tests | Any change to output format |
| MCP tool handler tests | Changes to tool schemas or tool routing |
| Config loader tests | Changes to `.memoria.json` schema |

### How engine tests work

Because engines call `git` commands, most tests **mock `simple-git`** rather than running against a real git repository. The pattern is:

```typescript
import { vi, describe, it, expect } from 'vitest';
import simpleGit from 'simple-git';

vi.mock('simple-git');
const mockGit = vi.mocked(simpleGit);
```

Look at `tests/volatility-engine.test.ts` or `tests/coupling-engine.test.ts` for examples to follow.

### Coverage requirements

- New engines: **all exported functions must have tests** covering the happy path and at least two edge cases (empty history, malformed input).
- Bug fixes: add a regression test that would have caught the bug.
- Refactors: existing tests must continue to pass; coverage must not decrease.

Run coverage before opening a PR:

```bash
npm run test:coverage --workspace=apps/mcp-server
```

The HTML report appears at `apps/mcp-server/coverage/index.html`.

### Test do's and don'ts

- **Do** mock `simple-git` for unit tests.
- **Do** test the formatted output string when touching the output formatter.
- **Don't** add integration tests that depend on the real git history of this repo — they are flaky and environment-dependent.
- **Don't** skip tests by moving them to the exclude list in `vitest.config.ts` without a documented reason.

---

## Adding or Extending an Engine

This is the most common form of contribution. An "engine" is a self-contained async function that takes `(filePath: string, git: SimpleGit, config: Config)` and returns a typed result.

### Step 1 — Understand the existing pattern

Read at least two existing engines in `apps/mcp-server/src/index.ts` before writing yours. Pay attention to:

- How they handle empty results (return the empty form, never `null`/`undefined`)
- How they use the `config.ignore` list via the `shouldIgnore` helper
- How they respect `config.thresholds.analysisWindow`
- How they emit structured evidence (`DiffSummary`, strings) rather than raw git output

### Step 2 — Add your engine function

Place it in `apps/mcp-server/src/index.ts` alongside the others. Follow this skeleton:

```typescript
async function runMyEngine(
  filePath: string,
  git: SimpleGit,
  config: MemoriaConfig
): Promise<MyEngineResult> {
  try {
    // ... git operations ...
    return result;
  } catch (err) {
    console.error(`[MyEngine] Failed for ${filePath}:`, err);
    return emptyResult;
  }
}
```

### Step 3 — Wire it into the parallel runner

In the main `analyzeFile` function, add your engine to the `Promise.all` array:

```typescript
const [
  volatilityResult,
  entanglementResult,
  // ... existing engines ...
  myEngineResult,          // ← add here
] = await Promise.all([
  runVolatilityEngine(filePath, git, config),
  runEntanglementEngine(filePath, git, config),
  // ...
  runMyEngine(filePath, git, config),   // ← add here
]);
```

Engines run in parallel — keep this in mind if your engine has side effects.

### Step 4 — Add a CouplingSource label (if it produces coupled files)

If your engine returns files that should appear in the **COUPLED FILES** section, add its label to the `CouplingSource` union type:

```typescript
type CouplingSource =
  | 'git' | 'docs' | 'type' | 'content'
  | 'test' | 'env' | 'schema' | 'api'
  | 'transitive'
  | 'my-engine';   // ← add here
```

### Step 5 — Update the output formatter

The output formatter in `formatAnalysisResult` renders each engine's output into the AI-readable markdown block. Add a section for your engine's results.

### Step 6 — Add to the risk formula (if warranted)

If your engine produces a signal that affects file risk, contribute to the compound score in `calculateCompoundRisk`. Document the weight choice in your PR description.

### Step 7 — Write tests

Create `apps/mcp-server/tests/my-engine.test.ts`. The test should:

1. Mock `simple-git` to return controlled fixtures
2. Test the happy path (engine finds relevant files)
3. Test the empty case (no relevant files found)
4. Test failure handling (git throws, engine returns empty result gracefully)

### Step 8 — Update CLAUDE.md

Add a one-line description of the new engine to the "13 Engines Explained" section in `CLAUDE.md`. Keep it consistent with the format of existing engine descriptions.

### Engine checklist

- [ ] Never throws — wraps all git calls in try/catch
- [ ] Respects the `shouldIgnore` filter
- [ ] Returns a typed result (not `any`)
- [ ] Added to `Promise.all` in `analyzeFile`
- [ ] Output rendered by the formatter
- [ ] Tests cover happy path, empty case, and error case
- [ ] `CLAUDE.md` updated with description

---

## Pull Request Process

### Before you start

For anything beyond a small bug fix, **open an issue first** and describe what you want to build. This prevents wasted effort and lets maintainers flag any architectural concerns early.

### Branch naming

```
feat/short-description
fix/short-description
docs/short-description
refactor/short-description
```

### PR requirements

1. **Tests pass on all supported Node versions.** CI runs the matrix against Node 18, 20, and 22. If CI is red, the PR will not be reviewed until it is green.

2. **No coverage regression.** Run `npm run test:coverage` and include the summary in your PR description if you are changing engine logic.

3. **CLA signed.** The CLA Assistant bot checks this automatically.

4. **PR description answers three questions:**
   - *What does this change do?*
   - *Why is this the right approach?*
   - *How was it tested?*

5. **One logical change per PR.** If you are adding a new engine and fixing an unrelated bug, open two PRs.

### Review turnaround

Maintainer aim is to give initial feedback within **5 business days**. If you do not hear back within 7 days, ping the issue thread (not by email).

### Merge policy

- Maintainer merges using **squash merge** by default. Your PR title becomes the commit message, so make it descriptive.
- Maintainer may ask you to rebase before merge if the branch has diverged significantly from `main`.

---

## Issue Reporting Guidelines

### Bug reports

Use the **Bug Report** issue template. Include:

- **Memoria version** (`npm list @byronwade/memoria`)
- **Node version** (`node --version`)
- **MCP client** (Claude Desktop, Cursor, etc.) and its version
- **Steps to reproduce** — the exact file path and git history state if possible
- **Expected vs. actual output** — paste the full Memoria output block
- **Git log snippet** if the issue is engine-specific (e.g., wrong coupling detected)

### Feature requests

Use the **Feature Request** template. Explain:

- The use case (what problem does this solve for a real contributor?)
- What the output would look like (mock the expected markdown output)
- Whether you are willing to implement it

### Engine false positives / false negatives

These are the most valuable bug reports. Provide:

- The file being analyzed
- A `git log --oneline -20` snippet from the repo
- What Memoria reported vs. what you expected
- Your `.memoria.json` config if you have one

### Security vulnerabilities

**Do not open a public issue.** Email **bw@wadesinc.io** with the subject "Memoria Security Vulnerability". We follow responsible disclosure and will acknowledge within 48 hours.

---

## Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

[optional body]

[optional footer]
```

**Types:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`

**Scope** (optional): `engine`, `formatter`, `cache`, `cli`, `config`, `mcp`

**Examples:**

```
feat(engine): add API endpoint coupling engine

fix(formatter): prevent undefined crash when coupled files list is empty

test(engine): add regression test for volatility time-decay with future dates

docs: update CONTRIBUTING.md with engine checklist
```

Keep the summary line under 72 characters. Use the body to explain *why*, not *what*.

---

## Questions?

Open a [Discussion](https://github.com/byronwade/memoria/discussions) for anything that does not fit a bug report or feature request. This is the right place for architecture questions, "is this the right approach?" checks, and general help.
