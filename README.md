# Memoria

**The Memory Your AI Lacks.**

An MCP server that prevents your AI from breaking code by revealing hidden file dependencies through git forensics.

[![npm version](https://img.shields.io/npm/v/@byronwade/memoria.svg)](https://www.npmjs.com/package/@byronwade/memoria)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-1.0-green.svg)](https://modelcontextprotocol.io)

---

## Why Memoria?

You ask your AI to refactor a file. It does a perfect job. You run your app. **It crashes.**

Why? Some other file depended on the old implementation - but there's no import between them, so the AI didn't know.

**Memoria fixes this.** It analyzes git history to find files that change together, even without direct imports.

```
Without Memoria:                        With Memoria:
─────────────────                       ─────────────
You: "Update route.ts"                  You: "Update route.ts"
AI: "Done!" ✅                           Memoria: "⚠️ 85% coupled with billing.tsx"
Result: 💥 CRASH                         AI: "I'll update both files"
                                        Result: ✅ Works
```

---

## Private & Local

Memoria runs **100% on your machine**.

- No code is uploaded to the cloud
- No API keys required
- Works offline
- Analyzes your local `.git` folder directly

Your code never leaves your computer.

---

## Installation

### Claude Desktop

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "memoria": {
      "command": "npx",
      "args": ["-y", "@byronwade/memoria"]
    }
  }
}
```

### Cursor

**Project:** `.cursor/mcp.json` (in project root)
**Global:** `~/.cursor/mcp.json`

```json
{
  "mcpServers": {
    "memoria": {
      "command": "npx",
      "args": ["-y", "@byronwade/memoria"]
    }
  }
}
```

### Windsurf

**Config:** `~/.codeium/windsurf/mcp_config.json`

```json
{
  "mcpServers": {
    "memoria": {
      "command": "npx",
      "args": ["-y", "@byronwade/memoria"]
    }
  }
}
```

### Continue (VS Code)

**Config:** `~/.continue/config.json`

```json
{
  "experimental": {
    "modelContextProtocolServers": [
      {
        "transport": {
          "type": "stdio",
          "command": "npx",
          "args": ["-y", "@byronwade/memoria"]
        }
      }
    ]
  }
}
```

### Cline (VS Code)

Open Cline settings → MCP Servers → Add new server:

```json
{
  "mcpServers": {
    "memoria": {
      "command": "npx",
      "args": ["-y", "@byronwade/memoria"]
    }
  }
}
```

### Other MCP Clients

Any MCP-compatible client works. Use this config:

```json
{
  "mcpServers": {
    "memoria": {
      "command": "npx",
      "args": ["-y", "@byronwade/memoria"]
    }
  }
}
```

**After configuring, restart your AI tool.**

---

## Usage

Ask your AI to analyze a file before making changes:

```
"Analyze src/api/stripe/route.ts before I refactor it"
```

Memoria returns:
- **Coupled files** - Files that frequently change together
- **Risk score** - How bug-prone this code is historically
- **Stale dependencies** - Coupled files that may need updating
- **Evidence** - Actual code diffs showing why files are related

---

## Configuration (Optional)

Create a `.memoria.json` in your project root to customize thresholds:

```json
{
  "thresholds": {
    "couplingPercent": 20,
    "driftDays": 14,
    "analysisWindow": 100
  },
  "ignore": [
    "**/*.lock",
    "dist/",
    "legacy/**"
  ],
  "panicKeywords": {
    "postmortem": 3,
    "incident": 3,
    "p0": 3
  },
  "riskWeights": {
    "volatility": 0.35,
    "coupling": 0.30,
    "drift": 0.20,
    "importers": 0.15
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `thresholds.couplingPercent` | 15 | Minimum coupling % to report |
| `thresholds.driftDays` | 7 | Days before a file is "stale" |
| `thresholds.analysisWindow` | 50 | Number of commits to analyze |
| `ignore` | [] | Additional glob patterns to ignore |
| `panicKeywords` | {} | Custom keywords with severity weights |
| `riskWeights` | {} | Override risk calculation weights |

---

## How It Works

### Volatility Engine
Scans commits for panic keywords (`fix`, `bug`, `revert`, `urgent`, `hotfix`) with **time-decay** - recent bugs matter more than old ones. Also tracks **Bus Factor** (who owns the code).

### Entanglement Engine
Finds files that change together >15% of the time. Reveals implicit dependencies that imports can't show.

### Sentinel Engine
Detects when coupled files are >7 days out of sync. Flags stale dependencies before they cause bugs.

### Static Import Engine
Uses `git grep` to find files that import the target - even for brand new files with no git history.

### History Search (The Archaeologist)
Search git history to understand *why* code was written. Solves the "Chesterton's Fence" problem before you delete that weird-looking code.

---

## Example Output

```markdown
### 🧠 Forensics for `route.ts`

**🔥 RISK: 65/100 (HIGH)**
> Proceed carefully. Check all coupled files and update stale dependencies.

**Risk Factors:** High volatility (45% panic score) • Tightly coupled (3 files) • Heavily imported (8 files depend on this)

---

**🔗 COUPLED FILES**

**📐 `billing/page.tsx`** (85% coupled, schema)
> These files share type definitions. If you modify types in one, update the other to match.
> + interface SubscriptionUpdated
> - oldStatus: string

---

**🧱 STATIC DEPENDENTS**
> These files explicitly import `route.ts`. If you change the API, you MUST update them.
- [ ] Check `src/components/SubscriptionCard.tsx`
- [ ] Check `src/hooks/useSubscription.ts`

---

**🛑 PRE-FLIGHT CHECKLIST**
- [ ] Modify `route.ts` (primary target)
- [ ] Verify `billing/page.tsx` (schema coupling)
- [ ] Update `tests/stripe.test.ts` (stale by 12 days)

---

**📊 VOLATILITY**
**🔥 Status:** VOLATILE (Score: 45%)
**Expert:** Dave wrote 90% of this file. If the logic is unclear, assume it is complex.
```

---

## Auto-Pilot Mode

Want your AI to check Memoria **automatically** before every edit?

### For Cursor Users

Add this to `.cursorrules` or your global system prompt:

```markdown
## Memoria Safety Check
Before editing any existing file, you MUST call the `analyze_file` MCP tool on that file.
If Memoria reports HIGH or CRITICAL risk, review all coupled files before writing code.
Never skip this step - it prevents breaking coupled files you don't know about.
```

### For Claude Code Users

Add this to your project's `.claude/CLAUDE.md`:

```markdown
## File Analysis Rule
BEFORE modifying any file, call the `analyze_file` MCP tool with the absolute path.
This provides hidden dependencies and risk assessment you cannot see otherwise.
```

### For Other AI Tools

Add similar instructions to your tool's system prompt or rules file. The key instruction is:

> "Before editing files, call `analyze_file` to check for hidden dependencies."

Now Memoria acts as a **mandatory safety guard** for every edit.

---

## Requirements

- Node.js 18+
- Git repository with commit history
- MCP-compatible AI tool

---

## Development

```bash
npm install
npm run build
npm test
```

---

## License

MIT

---

**When Memoria saves you from a regression, [let us know](https://github.com/byronwade/memoria/issues).**
