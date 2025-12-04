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

Memoria uses **git forensics** with **evidence-based analysis**:

### 1. **Volatility Engine** (Risk Assessment)
Scans commit history for "panic keywords" (fix, bug, revert, urgent, hotfix, oops)
- High panic score = historically bug-prone code
- Forces AI to review changes twice

### 2. **Entanglement Engine** (Coupling Detection)
Analyzes which files change together in commits
- >15% co-change correlation = coupled files
- Reveals implicit dependencies imports can't see
- **NEW: Context Engine** - Captures commit messages explaining WHY files are coupled
- **NEW: Evidence Bag** - Fetches actual code diffs showing WHAT changed together

### 3. **Sentinel Engine** (Drift Detection)
Compares modification times of coupled files
- >7 days drift = stale dependency warning
- Prevents shipping code with out-of-sync dependencies

### 4. **Detective Work Format** (The Intelligence Upgrade)
Instead of dumping data, Memoria provides **evidence** and forces the AI to be the detective:

**Old Way (Passive Data):**
```
ℹ️ Info: This file is coupled with billing.ts (85%)
```

**New Way (Active Investigation):**
```
🕵️ DETECTIVE WORK REQUIRED

File: billing.ts (85% coupled)
Linked via: "refactor subscription webhook schema"

Evidence (commit a3f21b4):
```diff
+ export interface SubscriptionUpdated {
+   status: 'active' | 'canceled' | 'past_due'
+   current_period_end: number
+ }
```

> System Instruction: Analyze the code above.
> These files share the SubscriptionUpdated interface.
> Your changes MUST maintain type compatibility.
```

**Why this matters:**
- Bad commit messages ("updates", "stuff") → Ignored
- Code diffs → Tell the truth about relationships
- AI analyzes evidence → Makes intelligent decisions
- Removes guesswork → Forces Chain-of-Thought reasoning

---

## Example Output

Memoria now outputs a **three-section report** designed to make the AI think, not just read:

```markdown
### 🧠 Forensics for `stripe/route.ts`

**🕵️ DETECTIVE WORK REQUIRED**

The following files are coupled with `stripe/route.ts`. Analyze the evidence to understand *why* they change together:

**File:** `dashboard/billing/page.tsx` (85% coupled)
**Linked via:** "refactor subscription webhook schema"
**Evidence (commit a3f21b4):**
```typescript
+ export interface SubscriptionUpdated {
+   status: 'active' | 'canceled' | 'past_due'
+   current_period_end: number
+ }
+
+ // Dashboard now consumes this webhook payload
+ async function handleSubscriptionUpdate(data: SubscriptionUpdated) {
+   updateUI(data.status, data.current_period_end)
+ }
```
> **System Instruction:** Analyze the code above. Determine the relationship (e.g., shared types, API contract, schema dependency). Apply that logic when modifying `stripe/route.ts`.

**File:** `lib/stripe/client.ts` (62% coupled)
**Linked via:** "add retry logic for failed webhooks"
> **System Instruction:** These files historically change together. Verify if your changes to `stripe/route.ts` require updates to `lib/stripe/client.ts`.

---

**🛑 PRE-FLIGHT CHECKLIST**

You MUST complete these steps before finalizing code changes:

- [ ] Modify `stripe/route.ts` (primary target)
- [ ] Verify/update `dashboard/billing/page.tsx` (85% coupling detected)
- [ ] Verify/update `lib/stripe/client.ts` (62% coupling detected)
- [ ] Update `tests/stripe.test.ts` (stale by 12 days)

---

**📊 RISK ASSESSMENT**

🔥 **Status:** VOLATILE (40% Panic Score)
> **Warning:** This file has 40% panic commits (fix/bug/revert/urgent). Code is historically fragile.
> **Required Action:** Review your changes twice. Do not delete safety checks or validation logic.

**Metadata:**
- Total commits analyzed: 47
- Unique contributors: 3
- Last modified: 2025-12-01
```

### What the AI Sees

The AI doesn't just get "these files are coupled" - it gets:
1. **The Evidence** - Actual code showing they share an interface
2. **The Context** - Commit message explaining it was a schema refactor
3. **The Instruction** - Must maintain type compatibility
4. **The Checklist** - Explicit action items to verify

Result: The AI **understands the relationship** and updates both files correctly.

---

## Key Features

### 🎯 **Prevents "Spooky Action at a Distance" Bugs**
Finds implicit dependencies that static analysis misses

### 🚦 **Risk-Based Coding**
Warns AI about historically unstable files before changes

### 🔗 **Implicit Coupling Detection with Evidence**
Reveals files that change together without direct imports - backed by actual code diffs

### 🧠 **Context Engine (NEW)**
Captures commit messages explaining WHY files are coupled - the "reasoning" behind the relationship

### 🔍 **Evidence Bag (NEW)**
Fetches actual code diffs (1000 chars max) showing WHAT changed together - the "proof" of the relationship

### 🕵️ **Detective Work Format (NEW)**
Forces AI to analyze evidence and determine relationships instead of passively consuming data

### ⚡ **Sub-100ms Response Time**
LRU cache with 5-minute TTL for instant feedback

### 🌍 **Multi-Language Support**
Universal ignore patterns for Python, Java, Rust, Go, Ruby, PHP, .NET, and more

### 🧪 **Comprehensive Testing**
60+ Vitest tests covering all engines and edge cases

### 🛡️ **System Prompt Injection**
Forces AI compliance with behavioral instructions through evidence-based analysis

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
- **Git Interface**: simple-git (enhanced with diff fetching and commit analysis)
- **Protocol**: @modelcontextprotocol/sdk (stdio transport)
- **Caching**: lru-cache (100 item LRU, 5-min TTL) - caches diffs + coupling data
- **Testing**: Vitest with 60+ tests
- **Ignore Patterns**: ignore (gitignore parsing + universal multi-language patterns)

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
