# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Memoria** is a Model Context Protocol (MCP) server that provides AI assistants with "Senior Developer Intuition" by analyzing git history and filesystem operations. It identifies high-risk files, coupled dependencies, and stale code through three core analysis engines.

**Tagline:** The Memory Your AI Lacks.

### Core Engines

1. **Volatility Engine** - Analyzes commit history for panic keywords (fix, bug, revert, urgent, hotfix, oops) to calculate risk scores
2. **Entanglement Engine** - Identifies files that frequently change together in commits (coupling correlation >15%)
3. **Sentinel Engine** - Detects drift when coupled files are out of sync (>7 days difference)

The server uses **System Prompt Injection** to deliver behavioral instructions rather than raw data, forcing AI attention on high-risk operations.

## Architecture

### Main Components

- **src/index.ts** - Single-file MCP server implementation containing:
  - MCP Server setup with stdio transport
  - Three analysis engines (getCoupledFiles, checkDrift, getVolatility)
  - LRU cache with 5-minute TTL (100 item capacity)
  - Output formatter that generates AI behavioral instructions
  - Tool handler for `analyze_file` MCP tool

### Key Design Patterns

- **Dynamic Git Context**: Uses `getGitForFile()` to create git instances scoped to each file's directory
- **Smart Filtering**: Automatically excludes noise (node_modules, dist, build, lockfiles) from coupling analysis
- **Cache-First**: All engine results are LRU cached with 5-minute TTL for sub-100ms responses
- **Path Resolution**: Git returns relative paths; code resolves them against repo root using `git revparse --show-toplevel`

### Data Flow

1. Client calls `analyze_file` with absolute file path
2. Volatility and Coupling engines run in parallel
3. Drift engine calculates staleness using coupling results
4. Output formatter generates markdown report with system instructions

## Commands

### Build and Development

```bash
# Build TypeScript to dist/
npm run build

# Watch mode for development
npm run dev

# Run the MCP server (requires build first)
npm start
```

### Testing

The repository includes manual test files (not automated):

```bash
# Build first
npm run build

# Run test client
node test-server.js
```

Test files use `@modelcontextprotocol/sdk/client` to manually verify the server functionality.

## MCP Tool Interface

### `analyze_file`

**Input Schema:**
```json
{
  "path": "ABSOLUTE path to file (e.g., C:/dev/project/src/file.ts)"
}
```

**Critical Requirements:**
- Path MUST be absolute (not relative)
- File MUST exist in a git repository
- Git history MUST be accessible

**Output Format:**
Markdown report containing:
- Risk level assessment (based on panic score %)
- Behavioral instructions (e.g., "You MUST review twice")
- Coupled files list (>15% correlation threshold)
- Stale dependency warnings (>7 days drift)

## Key Implementation Details

### Coupling Calculation
- Analyzes last 50 commits for target file (src/index.ts:31)
- For each commit, uses `git show --name-only` to find co-changed files (src/index.ts:39)
- Filters out same filename, ignored patterns (src/index.ts:43)
- Calculates coupling percentage: `(co-changes / total commits) * 100` (src/index.ts:53)
- Only returns top 5 coupled files with >15% correlation (src/index.ts:55)

### Drift Detection
- Compares file modification times using `fs.stat()` (src/index.ts:68-78)
- Alerts when coupled files are >7 days older than source (src/index.ts:81)
- Resolves git relative paths to absolute using repo root (src/index.ts:75)

### Volatility Scoring
- Scans last 20 commits for panic keywords (src/index.ts:100-106)
- Returns panic score: `min(100, (panic_count / 20) * 100)` (src/index.ts:110)
- Higher score = higher historical bug frequency

### Caching Strategy
- Cache key format: `"coupling:${filePath}"` or `"volatility:${filePath}"` (src/index.ts:25, 96)
- 5-minute TTL prevents stale data during active development
- 100 item LRU capacity handles typical project sizes

## Configuration

MCP clients (Cursor, Claude Desktop, etc.) configure via JSON:

```json
{
  "mcpServers": {
    "memoria": {
      "command": "node",
      "args": ["path/to/memoria/dist/index.js"],
      "cwd": "path/to/target/repo"
    }
  }
}
```

**Important**: The `cwd` parameter determines which repository is analyzed. The server operates on the working directory context.

## Tech Stack

- **TypeScript ES2022** with strict mode enabled
- **@modelcontextprotocol/sdk** - MCP protocol implementation
- **simple-git** - Git operations interface
- **lru-cache** - Response caching
- **zod** - Input validation (imported but not actively used in current implementation)

## Noise Filtering

Hardcoded ignore patterns (src/index.ts:15):
- `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`
- `node_modules/`
- `dist/`, `build/`
- `.git/`

These are filtered during coupling analysis to reduce token usage by ~83% and eliminate meaningless correlations.
