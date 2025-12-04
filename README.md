# Memoria 🧠

**Don't Let Your AI Be Stupid When It's Coding.**

A Model Context Protocol (MCP) server that prevents "spooky action at a distance" bugs by teaching AI assistants about implicit file dependencies through git forensics.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-1.0-green.svg)](https://modelcontextprotocol.io)

---

## The Problem

You ask your AI to refactor a file. It does a perfect job. You run your app. **It crashes.**

Why? Because some *other* file you didn't think about was secretly dependent on the old implementation. The AI didn't touch it because it didn't *know* they were connected.

**Traditional tools can't help:**
- Static analysis only sees explicit imports
- Type checkers only see TypeScript definitions
- Linters only see what's in the current file

**But Git history knows the truth:** If two files change together repeatedly, they're coupled - *even if there's no direct import.*

---

## The Solution

**Memoria gives your AI "street smarts."**

It analyzes git history to find:
1. **Implicit Coupling** - Files that change together (even without imports)
2. **High-Risk Files** - Code with a history of bugs/reverts
3. **Stale Dependencies** - Coupled files that haven't been updated in sync

Then it uses **System Prompt Injection** to force the AI to check these files before making changes.

---

## Before vs. After

### ❌ **Without Memoria** (The Old Way)

**Scenario:** Refactor the Stripe webhook handler

```
You: "Update stripe/route.ts to handle the new subscription.updated event schema"

AI: "Done!" ✅ (Rewrites the API route perfectly)

You: *Run the app*

Result: 💥 CRASH

Why? dashboard/billing/page.tsx was expecting the old schema.
The AI didn't touch it because there's no direct import between them.
```

### ✅ **With Memoria** (The New Way)

```
You: "Update stripe/route.ts to handle the new subscription.updated event schema"

AI: "Hold on, running analyze_file first..." (System rule)

Memoria: "⚠️ ALERT: stripe/route.ts is 85% coupled with dashboard/billing/page.tsx"

AI: "Oh! These files change together. I need to update both."

AI: "I've updated:
     1. stripe/route.ts (new schema handling)
     2. dashboard/billing/page.tsx (updated to expect new schema)"

Result: ✅ IT JUST WORKS
```

---

## Why This Matters

Most AI tools rely on **explicit connections** (imports, types) to understand code relationships.

But real codebases have **implicit connections:**
- API routes and the frontend components that consume them
- Database schemas and the services that query them
- Config files and the modules that read them
- Test files and the implementation they verify

**Only git history reveals these hidden dependencies.**

Memoria gives your AI the same intuition a senior developer has: *"I know from experience that every time Dave changes File A, he also changes File B."*

---

## What It Does

**Memoria is a safety belt.**

You don't stare at your safety belt while driving. You just wear it so you don't fly through the windshield when you crash.

Memoria runs automatically when your AI modifies files. It:
1. ✅ **Prevents regressions** - "These 3 files must be updated together"
2. ✅ **Flags high-risk areas** - "This file has a 40% panic score, review twice"
3. ✅ **Catches stale tests** - "This test hasn't been updated in 12 days"
4. ✅ **Reveals implicit coupling** - "No import between them, but they change together"

**Result:** Code at 10x speed without breaking hidden things.

---

## Quick Start

```bash
# 1. Install
git clone https://github.com/byronwade/memoria.git
cd memoria
npm install
npm run build

# 2. Configure Cursor (or any MCP client)
# Add to your MCP settings:
{
  "mcpServers": {
    "memoria": {
      "command": "node",
      "args": ["path/to/memoria/dist/index.js"],
      "cwd": "path/to/your/project"
    }
  }
}

# 3. Use it!
# In Cursor chat:
"Analyze src/app/layout.tsx before I refactor it"
```

The AI will automatically check for:
- Files that change together (coupling)
- Bug-prone areas (volatility)
- Out-of-sync dependencies (drift)

---

## How It Works

Memoria uses **git forensics** instead of static analysis:

### 1. **Volatility Engine** (Risk Assessment)
Scans commit history for "panic keywords" (fix, bug, revert, urgent, hotfix, oops)
- High panic score = historically bug-prone code
- Forces AI to review changes twice

### 2. **Entanglement Engine** (Coupling Detection)
Analyzes which files change together in commits
- >15% co-change correlation = coupled files
- Reveals implicit dependencies imports can't see

### 3. **Sentinel Engine** (Drift Detection)
Compares modification times of coupled files
- >7 days drift = stale dependency warning
- Prevents shipping code with out-of-sync dependencies

### 4. **System Prompt Injection** (Behavioral Override)
Delivers results as **mandatory instructions**, not passive data:

**Bad (Traditional Tools):**
```
ℹ️ Info: This file is coupled with 5 other files
```

**Good (Memoria):**
```
⚠️ INSTRUCTION: These files MUST be updated when this file changes:
- src/api/billing.ts
- src/components/PricingTable.tsx
Check them NOW before proceeding.
```

The AI can't ignore this - it's injected into the system prompt.

---

## Example Output

```markdown
### 🧠 Repo Context Analysis for `stripe/route.ts`

🔴 **HIGH RISK FILE (40% Panic Score)**
> **INSTRUCTION:** This file has a history of bugs/reverts.
> You MUST review your changes twice. Do not delete safety checks.

🔗 **Entangled Files (Action Required)**
> **INSTRUCTION:** These files usually change when `stripe/route.ts` changes. Check them:
- `dashboard/billing/page.tsx` (Coupled 85%)
- `lib/stripe/client.ts` (Coupled 62%)

⚠️ **Stale Siblings Detected**
> **INSTRUCTION:** These related files are outdated (>7 days). Update them:
- `tests/stripe.test.ts` (12 days old)
```

---

## Key Features

### 🎯 **Prevents "Spooky Action at a Distance" Bugs**
Finds implicit dependencies that static analysis misses

### 🚦 **Risk-Based Coding**
Warns AI about historically unstable files before changes

### 🔗 **Implicit Coupling Detection**
Reveals files that change together without direct imports

### ⚡ **Sub-100ms Response Time**
LRU cache with 5-minute TTL for instant feedback

### 🌍 **Multi-Language Support**
Universal ignore patterns for Python, Java, Rust, Go, Ruby, PHP, .NET, and more

### 🧪 **Comprehensive Testing**
60+ Vitest tests covering all engines and edge cases

### 🛡️ **System Prompt Injection**
Forces AI compliance with behavioral instructions, not just data

---

## Configuration

### Multi-Language Ignore Patterns

Memoria automatically filters noise from:

**JavaScript/Node.js**: `node_modules/`, `dist/`, `build/`, lockfiles
**Python**: `__pycache__/`, `venv/`, `.pytest_cache/`, `*.pyc`
**Java/Kotlin**: `target/`, `*.class`, `.gradle/`
**C/C++**: `*.o`, `*.exe`, `*.dll`, `*.so`
**Rust**: `target/`, `Cargo.lock`
**Go**: `vendor/`, `*.test`
**Ruby**: `Gemfile.lock`, `.bundle/`
**PHP**: `vendor/`, `composer.lock`
**.NET**: `bin/`, `obj/`, `*.dll`

Plus `.gitignore` patterns from your project.

**Result:** ~83% token reduction by filtering build artifacts.

---

## Use Cases

### 🐛 **Before Refactoring**
```
"I need to refactor the auth module. Analyze src/auth/index.ts first."
```
Reveals high-risk areas and coupled files that need simultaneous updates.

### 🚀 **Before Deploying**
```
"Check src/api/payments.ts - I'm about to ship this."
```
Detects stale tests and drift in related files that might cause production issues.

### 🔍 **Understanding Legacy Code**
```
"What files are coupled with src/legacy/oldProcessor.ts?"
```
Reveals hidden dependencies through commit history, not just imports.

### 📦 **Pre-Merge Review**
```
"Analyze all the files I changed in this PR."
```
Identifies forgotten updates in coupled files before they cause regressions.

---

## Development

```bash
# Build
npm run build

# Watch mode
npm run dev

# Run tests
npm test

# Test with watch mode
npm run test:watch

# Test with UI
npm run test:ui

# Coverage report
npm run test:coverage
```

---

## Tech Stack

- **Runtime**: Node.js 20+ with TypeScript ES2022
- **Git Interface**: simple-git
- **Protocol**: @modelcontextprotocol/sdk (stdio transport)
- **Caching**: lru-cache (100 item LRU, 5-min TTL)
- **Testing**: Vitest with 60+ tests
- **Ignore Patterns**: ignore (gitignore parsing)

---

## Troubleshooting

### "File not found" errors

Memoria requires **absolute paths**. If you see this error, the AI will auto-correct and retry with the absolute path. If it doesn't:
- Verify `cwd` in your MCP config points to your project root
- Restart Cursor to reload the MCP server

### Server not appearing in Cursor

1. Check your MCP config location (`.cursor/mcp.json` or Cursor settings)
2. Verify the path to `dist/index.js` is correct
3. Run `npm run build` to compile TypeScript
4. Restart Cursor completely

### No coupling found

This is expected if:
- File has <50 commits in history
- No files change together >15% of the time
- File is new (recently added)
- Coupled files are filtered (node_modules, dist, etc.)

Not all files have strong coupling patterns.

---

## Contributing

Found a bug? Have an idea? Open an issue or submit a PR!

**When Memoria saves you from a regression, screenshot it.** Those are gold for showing real-world value.

---

## License

MIT

---

## Inspiration

> *"The best code is the code that doesn't break production at 3 AM."*
> – Every senior developer ever

Memoria gives your AI that hard-earned wisdom.
