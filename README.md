# Memoria 🧠

**The Memory Your AI Lacks.**

A Just-In-Time (JIT) analyzer that uses git and filesystem operations to give AI "Senior Developer Intuition" by analyzing file volatility, coupling, and drift.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-1.0-green.svg)](https://modelcontextprotocol.io)

## Quick Start

```bash
# 1. Clone and build
git clone <your-repo-url>
cd Memoria
npm install
npm run build

# 2. Add to your Cursor MCP settings
# Edit your Cursor settings and add:
{
  "mcpServers": {
    "memoria": {
      "command": "node",
      "args": ["path/to/Memoria/dist/index.js"],
      "cwd": "path/to/your/project"
    }
  }
}

# 3. Restart Cursor and start using it!
# Just ask: "Analyze src/app/layout.tsx before I refactor it"
```

## Why Install This?

- **Prevents "Zombie Bugs"** (regressions) by identifying high-risk files before you modify them
- **Reminds the AI to update Stale Tests** and coupled dependencies automatically
- **Finds hidden "Spooky Action at a Distance" dependencies** that break when you least expect it
- **System Prompt Injection** - Forces AI attention with behavioral instructions, not just data dumps
- **Self-Healing Path Resolution** - Automatically detects and corrects relative path errors
- **Sub-100ms responses** via smart LRU caching
- **Zero noise** - Automatically filters out node_modules, lockfiles, and build artifacts

## What Makes It Different?

**Other tools give you data. Memoria gives you wisdom.**

| Traditional Tools | Memoria |
|-------------------|---------|
| "Here are 47 files that import this module" | "These 2 files MUST be updated when you change this" |
| Lists all test files in the project | "This test is 12 days stale - update it NOW" |
| Shows git blame and commit count | "40% panic score - review changes TWICE" |
| Dumps JSON for the AI to ignore | Injects behavioral instructions the AI must follow |

Memoria uses **System Prompt Injection** to force AI compliance, not just provide context. It's like having a senior developer watching over the AI's shoulder.

## Overview

Memoria provides three core analysis engines with revolutionary output formatting:

1. **Volatility Engine (Risk)**: Analyzes commit history for "panic" keywords to determine file stability
2. **Entanglement Engine (Coupling)**: Finds files that change together in commits (hidden dependencies)
3. **Sentinel Engine (Drift)**: Detects when coupled files are out of sync (stale dependencies)

### The Revolutionary Difference

Unlike other tools that just dump data, Memoria uses **System Prompt Injection** to tell the AI how to behave:

- **High Risk Files**: "You MUST review your changes twice. Do not delete safety checks."
- **Coupled Files**: "These files MUST usually be updated when this file changes. Check them now."
- **Stale Files**: "You are required to update these files to match your new logic."

This forces the AI to pay attention, not just acknowledge the data.

## Installation

```bash
npm install
npm run build
```

## Usage

### Running the Server

The server runs via stdio transport and is designed to be used with MCP-compatible clients like Cursor.

```bash
npm start
```

### MCP Tool: `analyze_file`

**USE THIS before modifying complex files.**

Analyzes a file's git history to provide:
- Risk level (volatility score based on panic commits)
- Coupled files (files that change together, filtered to >15% correlation)
- Drift warnings (stale dependencies >7 days old)

**Input:**
```json
{
  "path": "C:/absolute/path/to/file.ts"
}
```

**Path Requirements:**
- **Absolute paths recommended** (e.g., `C:/dev/project/src/file.ts`)
- Relative paths will trigger a helpful error with instructions for the AI to retry
- The self-healing system automatically guides the AI to use the correct path format

**Output:**
A markdown report with system instructions that guide AI behavior, not just data.

## Configuration

### Cursor MCP Configuration

Add to your Cursor MCP settings (typically in `.cursor/mcp.json` or similar):

**Option 1: Local Installation**
```json
{
  "mcpServers": {
    "memoria": {
      "command": "node",
      "args": ["path/to/memoria/dist/index.js"],
      "cwd": "path/to/your/repo"
    }
  }
}
```

**Option 2: NPM Global (Recommended)**
```json
{
  "mcpServers": {
    "memoria": {
      "command": "npx",
      "args": ["-y", "memoria"],
      "cwd": "path/to/your/repo"
    }
  }
}
```

## Example Usage

In Cursor chat, you can ask:

```
I'm planning to refactor src/app/layout.tsx. Analyze it first.
```

The AI will automatically call `analyze_file` with the absolute path, and you'll get system instructions like:

```
### 🧠 Repo Context Analysis for `layout.tsx`
*System Instruction: Use this data to guide your coding decisions.*

🟢 **Stable File.** Standard coding practices apply.

🔗 **Entangled Files (Action Required)**
> **Instruction:** These files usually change when `layout.tsx` changes. Check them:
- src/app/(dashboard)/dashboard/customers/page.tsx (Coupled 78%)
```

### Real-World Example

This 78% coupling between a root layout and a customer dashboard page reveals:
- **Shared providers** - Both might use the same context providers
- **CSS dependencies** - Common styling or theme imports
- **Directory structure refactors** - Files moved together in past commits

**Without Memoria:** You edit the layout, ship it, and break the customer dashboard.
**With Memoria:** You're warned to check the coupled file before deploying.

## Use Cases

### 🐛 Before Refactoring
```
"I need to refactor the authentication module. Analyze src/auth/index.ts first."
```
Memoria reveals high-risk areas and coupled files that need simultaneous updates.

### 🧪 Before Deploying
```
"Check src/api/payments.ts - I'm about to ship this."
```
Detects stale tests and drift in related files that might cause production issues.

### 🔍 Understanding Legacy Code
```
"What files are coupled with src/legacy/oldProcessor.ts?"
```
Reveals hidden dependencies through commit history, not just imports.

### 📦 Pre-Merge Review
```
"Analyze all the files I changed in this PR."
```
Identifies forgotten updates in coupled files before they cause regressions.

## Platinum Features

### 1. Self-Healing Path Resolution
When the AI sends a relative path, Memoria:
1. Detects the file doesn't exist at the resolved location
2. Returns a **SYSTEM INSTRUCTION** error telling the AI to retry with an absolute path
3. The AI automatically retries with the correct format
4. Analysis succeeds without user intervention

No more "file not found" dead ends - the AI learns and corrects itself.

### 2. Smart Caching
- LRU cache with 5-minute TTL
- Sub-100ms responses for repeated queries
- Automatic cache invalidation

### 3. Noise Filtering
Automatically ignores:
- `node_modules/`
- `dist/`, `build/`
- `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`
- `.git/`

Only shows files with >15% coupling correlation to reduce noise.

### 4. System Prompt Injection
Doesn't just provide data - provides behavioral instructions that force AI attention:
- Risk-based coding guidelines
- Mandatory dependency checks
- Required update actions

## Benefits

- **Token Efficiency**: ~83% reduction in token usage by identifying only critical dependencies
- **Regression Prevention**: Warns about coupled files that need updates
- **Senior Developer Intuition**: Provides context that would otherwise require manual investigation
- **AI Compliance**: Forces AI to follow best practices through system instructions
- **Zero Configuration**: Works out of the box with smart defaults

## How It Works

Memoria doesn't rely on static analysis or expensive code parsing. Instead, it uses **git forensics**:

1. **Reads commit history** - Analyzes the last 50 commits for coupling, 20 for volatility
2. **Detects panic patterns** - Keywords like "fix", "bug", "revert", "urgent" indicate risk
3. **Calculates correlation** - Files that change together >15% of the time are coupled
4. **Checks modification times** - Coupled files with >7 day drift are flagged as stale

All results are cached for 5 minutes in an LRU cache, making repeated queries sub-100ms.

## Troubleshooting

### "File not found" errors

**Problem:** The AI sends relative paths but the server runs in a different directory.

**Solution:** This should auto-correct! The self-healing system tells the AI to retry with an absolute path. If it doesn't work:
- Restart Cursor to reload the MCP server
- Verify your `cwd` in MCP config points to your project directory
- Manually specify the full path: `Use analyze_file on C:/full/path/to/file.ts`

### Server not appearing in Cursor

**Problem:** MCP server doesn't show up in Cursor's tool list.

**Solution:**
1. Check your MCP config file location (usually `.cursor/mcp.json` or Cursor settings)
2. Verify the path to `dist/index.js` is correct
3. Make sure you ran `npm run build`
4. Restart Cursor completely

### No coupling found for file

**Problem:** Analysis shows no coupled files even though you expected some.

**Reasons:**
- File has <50 commits in history
- No files change together >15% of the time
- File is new (recently added)
- All potential coupled files are in the ignore list (node_modules, etc.)

This is expected behavior - not all files have strong coupling patterns.

## Development

```bash
# Build
npm run build

# Watch mode
npm run dev

# Test the server
npm run build
node test-server.js
```

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Git Interface**: simple-git
- **Protocol**: @modelcontextprotocol/sdk
- **Caching**: lru-cache
- **Validation**: zod

## Contributing

Found a bug or have an idea? Open an issue or submit a PR!

When Memoria saves you from a regression, take a screenshot - those are gold for showing real-world value.

## License

MIT
