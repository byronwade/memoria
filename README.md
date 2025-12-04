# Repo-Forensics MCP Server

A Just-In-Time (JIT) analyzer that uses git and filesystem operations to give AI "Senior Developer Intuition" by analyzing file volatility, coupling, and drift.

## Overview

Repo-Forensics provides three core analysis engines:

1. **Volatility Engine (Risk)**: Analyzes commit history for "panic" keywords to determine file stability
2. **Entanglement Engine (Coupling)**: Finds files that change together in commits (hidden dependencies)
3. **Sentinel Engine (Drift)**: Detects when coupled files are out of sync (stale dependencies)

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

### MCP Tool: `analyze_file_context`

Analyzes a file's git history to provide:
- Risk level (volatility score based on panic commits)
- Coupled files (files that change together)
- Drift warnings (stale dependencies)

**Input:**
```json
{
  "path": "src/path/to/file.ts"
}
```

**Output:**
A markdown report containing:
- Risk level with panic score
- List of coupled files with correlation percentages
- Drift warnings for stale files

## Configuration

### Cursor MCP Configuration

Add to your Cursor MCP settings (typically in `.cursor/mcp.json` or similar):

```json
{
  "mcpServers": {
    "repo-forensics": {
      "command": "node",
      "args": ["path/to/repo-forensics/dist/index.js"],
      "cwd": "path/to/your/repo"
    }
  }
}
```

## Example Usage

In Cursor chat, you can now use:

```
I am planning to refactor src/vs/workbench/contrib/terminal/browser/terminalInstance.ts. 
Analyze the file context first.
```

The tool will return:
- Risk assessment (how volatile the file is)
- Hidden dependencies (files that change together)
- Stale file warnings (dependencies that need updates)

## Benefits

- **Token Efficiency**: ~83% reduction in token usage by identifying only critical dependencies
- **Regression Prevention**: Warns about coupled files that need updates
- **Senior Developer Intuition**: Provides context that would otherwise require manual investigation

## Development

```bash
# Build
npm run build

# Watch mode
npm run dev
```

## Stack

- **Runtime**: Node.js + TypeScript
- **Git Interface**: simple-git
- **Protocol**: @modelcontextprotocol/sdk
- **Validation**: zod

## License

MIT

