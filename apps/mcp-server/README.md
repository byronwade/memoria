<p align="center">
  <img src="memoria.svg" alt="Memoria Logo" width="120">
</p>

# Memoria

**The Memory Your AI Lacks.**

An MCP server that prevents your AI from breaking code by revealing hidden file dependencies through git forensics — plus cloud memories and guardrails for teams.

[![npm version](https://img.shields.io/npm/v/@byronwade/memoria.svg)](https://www.npmjs.com/package/@byronwade/memoria)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-1.0-green.svg)](https://modelcontextprotocol.io)
[![Twitter](https://img.shields.io/badge/Twitter-@byron__c__wade-1DA1F2.svg?logo=twitter)](https://twitter.com/byron_c_wade)

---

## Free vs Paid

| Feature | Free (Local) | Paid (Cloud) |
|---------|--------------|--------------|
| **Git Analysis** (13 engines) | Unlimited | Unlimited |
| **Risk Scores & Coupling** | Unlimited | Unlimited |
| **History Search** | Unlimited | Unlimited |
| **Cloud Memories** | - | Team-wide context |
| **Guardrails** | - | File protection rules |
| **Dashboard** | - | Visual analytics |

**Free tier runs 100% locally** — no account, no API keys, no cloud.

**Paid tier adds team intelligence** — shared memories, guardrails, and dashboards synced across your org.

---

## Quick Install

### One-Click Install (Smithery)

<a href="https://smithery.ai/server/@byronwade/memoria"><img src="https://smithery.ai/badge/@byronwade/memoria" alt="Smithery - Install Memoria" height="28" /></a>

Click the badge above to install Memoria with one click via Smithery.

### Quick Copy-Paste Config

Add this to your MCP config file (works with Claude, Cursor, Windsurf, Cline):

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

### Terminal One-Liners

| Tool | Command |
|------|---------|
| **Claude Code** | `claude mcp add memoria -- npx -y @byronwade/memoria` |
| **Claude Desktop** | `npx @anthropic/claude-code mcp add memoria -- npx -y @byronwade/memoria` |
| **Cursor** | `mkdir -p .cursor && echo '{"mcpServers":{"memoria":{"command":"npx","args":["-y","@byronwade/memoria"]}}}' > .cursor/mcp.json` |
| **npm global** | `npm install -g @byronwade/memoria` |

<details>
<summary><strong>Windows PowerShell Install</strong></summary>

```powershell
# Claude Desktop
$config = "$env:APPDATA\Claude\claude_desktop_config.json"
$json = if(Test-Path $config){Get-Content $config | ConvertFrom-Json}else{@{}}
$json.mcpServers = @{memoria=@{command="npx";args=@("-y","@byronwade/memoria")}}
$json | ConvertTo-Json -Depth 10 | Set-Content $config
```

</details>

<details>
<summary><strong>macOS Manual Install</strong></summary>

```bash
# Claude Desktop (requires jq: brew install jq)
echo '{"mcpServers":{"memoria":{"command":"npx","args":["-y","@byronwade/memoria"]}}}' | \
  jq -s '.[0] * .[1]' ~/Library/Application\ Support/Claude/claude_desktop_config.json - > tmp.json && \
  mv tmp.json ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

</details>

**Then restart your AI tool. That's it!**

---

## Why Memoria?

You ask your AI to refactor a file. It does a perfect job. You run your app. **It crashes.**

Why? Some other file depended on the old implementation - but there's no import between them, so the AI didn't know.

**Memoria fixes this.** It analyzes git history to find files that change together, even without direct imports.

```
Without Memoria:                        With Memoria:
-----------------                       -------------
You: "Update route.ts"                  You: "Update route.ts"
AI: "Done!"                             Memoria: "85% coupled with billing.tsx"
Result: CRASH                           AI: "I'll update both files"
                                        Result: Works
```

---

## The Four MCP Tools

### 1. `analyze_file` (FREE)
Full forensic analysis of any file — risk score, coupled files, static dependents, pre-flight checklist.

### 2. `ask_history` (FREE)
Search git history to understand WHY code exists. Solves Chesterton's Fence problem.

### 3. `get_context` (FREE + PAID)
Get context for a file before editing:
- **FREE**: Git-based coupling, risk assessment, checklist
- **PAID**: Cloud memories from your team, guardrail warnings

### 4. `save_lesson` (PAID)
Save a lesson or context that persists across sessions and team members.

---

## Enabling Cloud Features

To enable cloud memories and guardrails, set these environment variables:

```bash
# In your shell or .env file
export MEMORIA_API_URL=https://memoria.dev
export MEMORIA_TOKEN=mem_xxxxx  # Get from https://memoria.dev/dashboard
```

Or in your MCP config:

```json
{
  "mcpServers": {
    "memoria": {
      "command": "npx",
      "args": ["-y", "@byronwade/memoria"],
      "env": {
        "MEMORIA_API_URL": "https://memoria.dev",
        "MEMORIA_TOKEN": "mem_xxxxx"
      }
    }
  }
}
```

Without these, Memoria runs in free mode with full local git analysis.

---

## The 13 Analysis Engines

All engines run locally for free:

| Engine | What It Does | Speed |
|--------|--------------|-------|
| **Volatility** | Panic keyword detection with time-decay | ~10ms |
| **Entanglement** | Files that change together >15% | ~45ms |
| **Sentinel** | Drift detection for stale dependencies | <1ms |
| **Static Imports** | Files that import the target | ~8ms |
| **History Search** | Git archaeology with line-range support | ~7ms |
| **Documentation** | Markdown files referencing exports | ~50ms |
| **Type Coupling** | Files sharing type definitions | ~100ms |
| **Content Coupling** | Files sharing string literals | ~30ms |
| **Test Files** | Auto-discovered test/mock files | ~20ms |
| **Environment** | Files sharing env variables | ~15ms |
| **Schema/Model** | Database schema dependencies | ~25ms |
| **API Endpoints** | Client code calling your routes | ~30ms |
| **Re-Export Chain** | Transitive barrel file imports | ~40ms |

**Total analysis time: ~150ms** — all engines run in parallel.

---

## CLI Commands

Memoria includes a full CLI for manual analysis:

```bash
# Full forensic analysis (same as AI's analyze_file)
memoria analyze src/index.ts

# Quick risk assessment
memoria risk src/api/route.ts

# Show coupled files
memoria coupled src/auth.ts

# Find files that import the target
memoria importers src/types.ts

# Search git history (same as AI's ask_history)
memoria history "setTimeout" src/utils.ts
memoria history "fix" --type=message

# Install auto-pilot rules for your AI tool
memoria init --all
```

---

## Example Output

```
# Forensics: `route.ts`

**RISK: 65/100** - HIGH
45% volatility | 5 coupled | 8 dependents | 1 stale

> Proceed carefully. Check all coupled files and update stale dependencies.

---

## Coupled Files

**`billing/page.tsx`** - 85% (schema)
> These files share type definitions. If you modify types in one, update the other to match.
  + interface SubscriptionUpdated
  - oldStatus: string

**`route.test.ts`** - 90% [test]
> Test file for this module. Update when changing exports.

**`services/stripe.ts`** - 75% [env]
> Shares env vars: STRIPE_KEY, STRIPE_SECRET

---

## Cloud Memories (Paid)

**CRITICAL MEMORIES**
- Safari OAuth requires 100ms delay before redirect (commit abc123)
- Always invalidate old sessions before creating new ones

---

## Pre-flight Checklist

- [ ] Modify `route.ts`
- [ ] Update `billing/page.tsx` (schema)
- [ ] Update `tests/stripe.test.ts` - stale 12d
```

---

## Configuration (Optional)

Create a `.memoria.json` in your project root:

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

---

## Private & Local

The free tier runs **100% on your machine**.

- No code is uploaded to the cloud
- No API keys required
- Works offline
- Analyzes your local `.git` folder directly

Your code never leaves your computer unless you opt into cloud features.

---

## Auto-Pilot Mode

Want your AI to check Memoria **automatically** before every edit?

```bash
# Install globally first
npm install -g @byronwade/memoria

# Then in your project directory:
memoria init --all
```

This installs rule files that tell your AI to always call `analyze_file` before editing code.

| Flag | File | Tool |
|------|------|------|
| `--cursor` | `.cursor/rules/memoria.mdc` | Cursor |
| `--claude` | `.claude/CLAUDE.md` | Claude Code |
| `--windsurf` | `.windsurfrules` | Windsurf |
| `--cline` | `.clinerules` | Cline/Continue |
| `--all` | All of the above | All tools |

---

## Requirements

- Node.js 18+
- Git repository with commit history
- MCP-compatible AI tool

---

## Development

```bash
npm install
npm run build                     # turbo build across workspaces
npm test                          # turbo test (runs vitest in mcp-server)

# Focus on a single app/package
npx turbo run build --filter=@byronwade/memoria
npx turbo run dev --filter=@byronwade/memoria
```

---

## Troubleshooting

<details>
<summary><strong>"Tool not found" or "analyze_file not available"</strong></summary>

1. **Restart your AI tool** - MCP servers only load on startup
2. **Check config syntax** - JSON must be valid (no trailing commas)
3. **Verify Node.js 18+** - Run `node --version` to check
4. **Check file path** - Config file must be in the exact location for your tool

</details>

<details>
<summary><strong>"Not a git repository"</strong></summary>

Memoria requires a git repository with history. Make sure:
1. You're in a git repo (`git status` should work)
2. The repo has at least a few commits
3. You're passing an **absolute path** to `analyze_file`

</details>

<details>
<summary><strong>npx is slow or times out</strong></summary>

Install globally for faster startup:
```bash
npm install -g @byronwade/memoria
```

Then update your config to use `memoria` directly:
```json
{
  "mcpServers": {
    "memoria": {
      "command": "memoria"
    }
  }
}
```

</details>

**Still stuck?** [Open an issue](https://github.com/byronwade/memoria/issues) with your config and error message.

---

## License

MIT

---

**When Memoria saves you from a regression, [let us know](https://github.com/byronwade/memoria/issues).**
