import type { Metadata } from "next";
import { Breadcrumb } from "@/components/docs/breadcrumb";
import { generatePageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = generatePageMetadata({
	title: "API Reference",
	description:
		"Complete API documentation for Memoria MCP tools. Reference for analyze_file and ask_history tools with schemas and examples.",
	path: "/docs/api",
	keywords: ["API", "MCP tools", "analyze_file", "ask_history", "reference"],
});

export default function ApiPage() {
	return (
		<>
			<Breadcrumb
				items={[
					{ label: "Docs", href: "/docs" },
					{ label: "API Reference", href: "/docs/api" },
				]}
			/>
			<div className="docs-content">
				<h1>API Reference</h1>

				<p className="lead">
					Complete reference for the MCP tools exposed by Memoria.
				</p>

				<p>
					Memoria is a tools-only MCP server. It does not expose Resources or
					Prompts, focusing instead on providing powerful analysis tools that
					work with any AI workflow.
				</p>

				<h2>Available Tools</h2>

				<p>Memoria exposes two primary tools via the Model Context Protocol:</p>

				<div className="tool-card">
					<h3>analyze_file</h3>

					<p>
						Analyzes a file using git forensics to reveal hidden dependencies,
						risk factors, and coupled files. This is the primary tool for
						understanding code relationships.
					</p>

					<h4>Parameters</h4>

					<table>
						<thead>
							<tr>
								<th>Name</th>
								<th>Type</th>
								<th>Required</th>
								<th>Description</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<td>
									<code>file</code>
								</td>
								<td>string</td>
								<td>Yes</td>
								<td>Absolute or relative path to the file to analyze</td>
							</tr>
						</tbody>
					</table>

					<h4>Returns</h4>

					<p>A formatted analysis report containing:</p>

					<ul>
						<li>
							<strong>Risk Score</strong> &mdash; Composite score (0-100) based
							on volatility, coupling, and drift
						</li>
						<li>
							<strong>Volatility Analysis</strong> &mdash; Panic keyword
							frequency, bus factor, recent bug history
						</li>
						<li>
							<strong>Coupled Files</strong> &mdash; Files that change together
							with coupling percentage
						</li>
						<li>
							<strong>Stale Dependencies</strong> &mdash; Coupled files that are
							out of sync
						</li>
						<li>
							<strong>Static Imports</strong> &mdash; Files that explicitly
							import the target
						</li>
						<li>
							<strong>Evidence</strong> &mdash; Actual code diffs showing why
							files are related
						</li>
					</ul>

					<h4>Example Usage</h4>

					<pre className="code-block">
						<code>{`// Ask your AI assistant:
"Analyze src/api/stripe/route.ts before I refactor it"

// The AI will call:
analyze_file({ file: "src/api/stripe/route.ts" })`}</code>
					</pre>

					<h4>Example Response</h4>

					<pre className="code-block">
						<code>{`MEMORIA ANALYSIS: src/api/stripe/route.ts
═══════════════════════════════════════════

RISK ASSESSMENT
───────────────
Overall Risk: 72/100 (HIGH)
- Volatility: 45% (3 panic commits in last 50)
- Bus Factor: 1 developer (byronwade)
- Drift Risk: 2 stale dependencies detected

COUPLED FILES (>15% correlation)
────────────────────────────────
1. dashboard/billing/page.tsx (85% coupled)
   Last changed together: 3 days ago
   Evidence: "refactor subscription webhook schema"

2. lib/stripe/client.ts (62% coupled)
   Last changed together: 1 week ago
   Evidence: "update stripe api version"

STALE DEPENDENCIES
──────────────────
⚠️  components/PricingTable.tsx
    Last modified: 14 days ago
    Target modified: 2 days ago
    → May need updating

STATIC IMPORTS
──────────────
Found 3 files importing this module:
- app/api/webhooks/stripe/route.ts
- lib/billing/subscription.ts
- tests/stripe.test.ts

RECOMMENDATIONS
───────────────
1. Review dashboard/billing/page.tsx for type compatibility
2. Check if PricingTable.tsx needs corresponding changes
3. Run tests/stripe.test.ts after modifications`}</code>
					</pre>
				</div>

				<div className="tool-card">
					<h3>ask_history</h3>

					<p>
						Search git history to understand <em>why</em> code was written.
						Solves the &ldquo;Chesterton&apos;s Fence&rdquo; problem &mdash;
						understanding the reason behind code before removing or modifying
						it.
					</p>

					<h4>Parameters</h4>

					<table>
						<thead>
							<tr>
								<th>Name</th>
								<th>Type</th>
								<th>Required</th>
								<th>Description</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<td>
									<code>query</code>
								</td>
								<td>string</td>
								<td>Yes</td>
								<td>Natural language question or search term</td>
							</tr>
							<tr>
								<td>
									<code>file</code>
								</td>
								<td>string</td>
								<td>No</td>
								<td>Limit search to a specific file&apos;s history</td>
							</tr>
						</tbody>
					</table>

					<h4>Returns</h4>

					<p>Relevant commits and changes that answer the query:</p>

					<ul>
						<li>
							<strong>Matching Commits</strong> &mdash; Commits related to the
							query
						</li>
						<li>
							<strong>Code Changes</strong> &mdash; Relevant diffs from those
							commits
						</li>
						<li>
							<strong>Context</strong> &mdash; Commit messages explaining the
							changes
						</li>
						<li>
							<strong>Authors</strong> &mdash; Who made the changes and when
						</li>
					</ul>

					<h4>Example Usage</h4>

					<pre className="code-block">
						<code>{`// Ask your AI assistant:
"Why was the rate limiter added to the API?"

// The AI will call:
ask_history({ query: "rate limiter API" })

// Or for a specific file:
"Why does this function handle null specially?"
ask_history({
  query: "null handling",
  file: "src/utils/parser.ts"
})`}</code>
					</pre>

					<h4>Example Response</h4>

					<pre className="code-block">
						<code>{`HISTORY SEARCH: "rate limiter API"
═══════════════════════════════════

RELEVANT COMMITS
────────────────

[a3f21b4] 2024-01-15 - Add rate limiting to prevent abuse
Author: byronwade <byron@example.com>

  After the incident on Jan 12th where a misconfigured
  client made 50k requests/minute, adding rate limiting
  to all public API endpoints.

  Limit: 100 requests/minute per IP
  Returns: 429 Too Many Requests when exceeded

+ import { rateLimit } from '@/lib/rate-limit'
+
+ const limiter = rateLimit({
+   interval: 60 * 1000,
+   uniqueTokenPerInterval: 500,
+ })

[b7c92e1] 2024-01-12 - HOTFIX: disable public API
Author: byronwade <byron@example.com>

  Emergency disable - API being hammered by runaway client.
  TODO: Add rate limiting before re-enabling.

SUMMARY
───────
Rate limiting was added after a Jan 12th incident where
a misconfigured client made excessive requests. The limit
is 100 req/min per IP. Consider this context before
modifying rate limit values.`}</code>
					</pre>
				</div>

				<h2>Tool Schemas</h2>

				<p>
					For MCP client developers, here are the JSON schemas for each tool:
				</p>

				<h3>analyze_file Schema</h3>

				<pre className="code-block">
					<code>{`{
  "name": "analyze_file",
  "description": "Analyze a file using git forensics to reveal hidden dependencies, risk factors, and coupled files.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "file": {
        "type": "string",
        "description": "Path to the file to analyze"
      }
    },
    "required": ["file"]
  }
}`}</code>
				</pre>

				<h3>ask_history Schema</h3>

				<pre className="code-block">
					<code>{`{
  "name": "ask_history",
  "description": "Search git history to understand why code was written or changed.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Natural language question or search term"
      },
      "file": {
        "type": "string",
        "description": "Optional: limit search to a specific file"
      }
    },
    "required": ["query"]
  }
}`}</code>
				</pre>

				<h2>Error Handling</h2>

				<p>Tools return structured error messages when issues occur:</p>

				<table>
					<thead>
						<tr>
							<th>Error</th>
							<th>Cause</th>
							<th>Solution</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>
								<code>File not found</code>
							</td>
							<td>The specified file doesn&apos;t exist</td>
							<td>Check the file path is correct</td>
						</tr>
						<tr>
							<td>
								<code>Not a git repository</code>
							</td>
							<td>No .git directory in project</td>
							<td>
								Run <code>git init</code> first
							</td>
						</tr>
						<tr>
							<td>
								<code>No git history</code>
							</td>
							<td>File has no commits yet</td>
							<td>Commit the file first</td>
						</tr>
						<tr>
							<td>
								<code>Analysis timeout</code>
							</td>
							<td>Repository too large</td>
							<td>Add ignore patterns in .memoria.json</td>
						</tr>
					</tbody>
				</table>

				<h2>Output Format</h2>

				<p>
					Memoria formats output as structured text optimized for LLM
					consumption. The format includes:
				</p>

				<ul>
					<li>
						<strong>Clear section headers</strong> using ASCII art dividers
					</li>
					<li>
						<strong>Structured data</strong> in lists and tables
					</li>
					<li>
						<strong>Actionable recommendations</strong> for the AI to follow
					</li>
					<li>
						<strong>Evidence blocks</strong> with actual code diffs
					</li>
				</ul>

				<p>
					This format ensures the AI understands the context and makes informed
					decisions about code changes.
				</p>

				<div className="callout callout-info">
					<h4>Token Efficiency</h4>
					<p>
						Each analysis uses approximately 600 tokens on average. Results are
						cached for 5 minutes, making repeat queries nearly instant with
						minimal token overhead.
					</p>
				</div>
			</div>
		</>
	);
}
