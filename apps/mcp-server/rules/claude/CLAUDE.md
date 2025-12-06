# Memoria Integration

Memoria gives AI assistants memory of what broke before. Use these MCP tools to avoid breaking coupled files.

## File Analysis Rule

**BEFORE modifying any file**, call the `analyze_file` MCP tool with the absolute path:

```json
{"path": "/absolute/path/to/file.ts"}
```

**What you get:**
- **Risk Score (0-100):** LOW (0-24), MEDIUM (25-49), HIGH (50-74), CRITICAL (75+)
- **Coupled Files:** Files that historically change together
- **Static Dependents:** Files that import this file
- **Pre-flight Checklist:** Files to verify before committing

**Actions based on risk:**
- **LOW (0-24):** Safe to proceed normally
- **MEDIUM (25-49):** Verify coupled files are still compatible
- **HIGH (50-74):** Read all coupled files before making changes
- **CRITICAL (75+):** Stop and ask the user before proceeding

## History Search Rule

**Before removing "weird" code**, call `ask_history` to understand WHY it exists:

```json
{"query": "setTimeout", "path": "/absolute/path/to/file.ts"}
```

**IMPORTANT:** Use SHORT keywords (1-3 words). Do NOT use full sentences - git grep requires exact matches.

**Parameters:**
- `query` - Short keyword (e.g., "setTimeout", "Safari", "race condition")
- `path` - Optional: scope to specific file
- `searchType` - "message", "diff", or "both" (default)
- `startLine`/`endLine` - For line-range search (Sherlock Mode)

**Example:** You see `setTimeout(() => resolve(), 0)` and think it's useless. Search for "setTimeout" and find a commit from 2 years ago: "Fix race condition in Safari." Keep the code!

## Mandatory Rules

1. **ALWAYS call `analyze_file` before modifying any code file**
2. **If risk is CRITICAL:** Stop and ask user before proceeding
3. **If risk is HIGH:** Read all coupled files first
4. **Before removing code:** Call `ask_history` to check if it's a bug fix
5. **Use ABSOLUTE paths** (e.g., `/Users/name/project/src/file.ts`)
6. **Use SHORT keywords** in `ask_history` queries (not sentences)
