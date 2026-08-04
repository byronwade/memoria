# Changelog

## 1.1.0

### Added
- **Structured MCP output** — `analyze_file` returns markdown plus a machine-readable JSON payload (`format`: `markdown` | `json` | `both`)
- **`analyze_diff` MCP tool** — forensic analysis of all files changed since a git base ref
- **Fast → full escalation** — when fast mode shows risk ≥ 50 or many importers, Memoria automatically re-runs in full
- **Owner / bus-factor brief** — ownership guidance when a single author dominates file history
- **Breaking-change detector** — compares working-tree exports to `HEAD` and surfaces removed exports
- **Monorepo package-graph coupling** — couples packages that depend on (or are depended on by) the target’s package
- **Call-graph enhancer** — TypeScript compiler API when available, regex fallback otherwise
- **`memoria watch`** — refreshes `.memoria/pack.json` when HEAD changes
- **`memoria check [base]`** — CI gate that fails if critical-risk changed files lack `[test]` coupling
- **Auto-pack on `init`** — builds a workspace pack and installs a post-commit pack hook (skip with `--no-pack`)
- **CI benchmarks** — smoke performance budgets on every PR

### Changed
- MCP server version reported as `1.1.0`
- Full analysis plans now include the `package` engine for source files

## 1.0.x

See git history for prior releases.
