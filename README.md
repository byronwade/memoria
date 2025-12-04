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

## How It Works

### Volatility Engine
Scans commits for panic keywords (`fix`, `bug`, `revert`, `urgent`, `hotfix`). High score = historically fragile code.

### Entanglement Engine
Finds files that change together >15% of the time. Reveals implicit dependencies that imports can't show.

### Sentinel Engine
Detects when coupled files are >7 days out of sync. Flags stale dependencies before they cause bugs.

### Evidence Bag
Fetches actual code diffs showing *what* changed together, so the AI understands *why* files are coupled.

---

## Example Output

```markdown
🕵️ DETECTIVE WORK REQUIRED

File: dashboard/billing/page.tsx (85% coupled)
Linked via: "refactor subscription webhook schema"

Evidence (commit a3f21b4):
+ export interface SubscriptionUpdated {
+   status: 'active' | 'canceled' | 'past_due'
+ }

> System Instruction: These files share the SubscriptionUpdated interface.
> Your changes MUST maintain type compatibility.

🛑 PRE-FLIGHT CHECKLIST
- [ ] Modify stripe/route.ts (primary target)
- [ ] Verify dashboard/billing/page.tsx (85% coupled)
- [ ] Update tests/stripe.test.ts (stale by 12 days)

📊 RISK: VOLATILE (40% Panic Score)
```

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
