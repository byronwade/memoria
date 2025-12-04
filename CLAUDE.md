# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Memoria** is a Model Context Protocol (MCP) server that provides AI assistants with "Senior Developer Intuition" by analyzing git history and filesystem operations. It identifies high-risk files, coupled dependencies, and stale code through three core analysis engines.

**Tagline:** The Memory Your AI Lacks.

### Core Engines

1. **Volatility Engine** - Analyzes commit history for panic keywords (fix, bug, revert, urgent, hotfix, oops) to calculate risk scores
2. **Entanglement Engine (Enhanced)** - Identifies files that frequently change together in commits (coupling correlation >15%), now includes:
   - **Context Engine**: Captures commit messages explaining WHY files are coupled
   - **Evidence Bag**: Fetches actual code diffs from commits to show WHAT changed together
3. **Sentinel Engine** - Detects drift when coupled files are out of sync (>7 days difference)

The server uses **System Prompt Injection** with a **Detective Work Format** to force AI analysis of evidence rather than passive data consumption.

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
Three-section markdown report with **Detective Work Format**:

**Section 1: Detective Work Required**
- Shows each coupled file with context (commit message) and evidence (code diff)
- Instructs AI to analyze the diff and determine the relationship
- Max 1000 chars per diff to balance context vs. token usage

**Section 2: Pre-Flight Checklist**
- Actionable checklist format the AI must follow
- Lists all coupled files and stale dependencies
- Uses `- [ ]` markdown checkbox format for clarity

**Section 3: Risk Assessment**
- Volatility score with status (Stable/Volatile/New)
- Metadata: commit count, contributors, last modified date
- Explicit behavioral instructions for high-risk files

## Key Implementation Details

### Coupling Calculation (Enhanced)
- Analyzes last 50 commits for target file (src/index.ts:128)
- For each commit, uses `git show --name-only` to find co-changed files (src/index.ts:137)
- Filters using multi-language ignore patterns + .gitignore (src/index.ts:141-145)
- Tracks commit message and hash for the most recent co-change (src/index.ts:148-156)
- Calculates coupling percentage: `(co-changes / total commits) * 100` (src/index.ts:168)
- Returns top 5 coupled files with >15% correlation (src/index.ts:172)
- **NEW**: Fetches code diff evidence for ALL coupled files in parallel (src/index.ts:175-186)
- Each result includes: file path, score, commit message (reason), hash, and diff (evidence)

### Evidence Bag (The Intelligence Upgrade)
- `getDiffSnippet()` function fetches actual code changes from commits (src/index.ts:67-83)
- Uses `git show commitHash:filePath` to retrieve file content at that moment
- Truncates diffs to 1000 characters to balance context vs. token usage (src/index.ts:74-77)
- Handles errors gracefully (file might not exist in that commit, git errors, etc.)
- **Why this matters**: Removes dependency on commit message quality
  - Bad commit messages like "updates" or "stuff" are ignored
  - Code diffs show the truth: "Added userId field to User type and validation logic"
  - AI analyzes the actual code changes to determine relationship type

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
