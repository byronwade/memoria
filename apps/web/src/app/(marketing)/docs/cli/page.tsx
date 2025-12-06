import type { Metadata } from "next";
import { Breadcrumb } from "@/components/docs/breadcrumb";
import { generatePageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = generatePageMetadata({
	title: "CLI Reference",
	description:
		"Command-line interface for Memoria. Initialize, analyze, and serve commands for standalone usage.",
	path: "/docs/cli",
	keywords: ["CLI", "command line", "terminal", "commands"],
});

export default function CliPage() {
	return (
		<>
			<Breadcrumb
				items={[
					{ label: "Docs", href: "/docs" },
					{ label: "CLI Reference", href: "/docs/cli" },
				]}
			/>
			<div className="docs-content">
				<h1>CLI Reference</h1>

				<p className="lead">
					Command-line interface for Memoria setup and standalone usage.
				</p>

				<h2>Installation</h2>

				<p>
					You can use Memoria via npx (no installation) or install it globally:
				</p>

				<pre className="code-block">
					<code>{`# Use with npx (recommended)
npx @byronwade/memoria <command>

# Or install globally
npm install -g @byronwade/memoria
memoria <command>`}</code>
				</pre>

				<h2>Commands</h2>

				<h3>init</h3>

				<p>
					Initialize Memoria for your AI tools. Creates rule files for
					auto-pilot mode.
				</p>

				<pre className="code-block">
					<code>{`npx @byronwade/memoria init [options]

Options:
  --all       Set up rules for all detected AI tools
  --cursor    Set up rules for Cursor
  --claude    Set up rules for Claude Code
  --windsurf  Set up rules for Windsurf
  --cline     Set up rules for Cline`}</code>
				</pre>

				<p>Examples:</p>

				<pre className="code-block">
					<code>{`# Auto-detect and set up all tools
npx @byronwade/memoria init --all

# Set up only Cursor
npx @byronwade/memoria init --cursor

# Set up multiple specific tools
npx @byronwade/memoria init --cursor --claude`}</code>
				</pre>

				<h3>analyze</h3>

				<p>
					Analyze a file and output forensics data to stdout. Useful for testing
					or scripting.
				</p>

				<pre className="code-block">
					<code>{`npx @byronwade/memoria analyze <file> [options]

Options:
  --json      Output as JSON instead of formatted text
  --verbose   Include all available metadata`}</code>
				</pre>

				<p>Examples:</p>

				<pre className="code-block">
					<code>{`# Analyze a file
npx @byronwade/memoria analyze src/api/route.ts

# Get JSON output for scripting
npx @byronwade/memoria analyze src/api/route.ts --json

# Full verbose output
npx @byronwade/memoria analyze src/api/route.ts --verbose`}</code>
				</pre>

				<h3>serve</h3>

				<p>
					Start the MCP server. This is called automatically by your AI
					tool&apos;s configuration.
				</p>

				<pre className="code-block">
					<code>{`npx @byronwade/memoria serve [options]

Options:
  --stdio     Use stdio transport (default)
  --port      Use HTTP transport on specified port`}</code>
				</pre>

				<h3>version</h3>

				<p>Show the installed version:</p>

				<pre className="code-inline">
					<code>npx @byronwade/memoria --version</code>
				</pre>

				<h3>help</h3>

				<p>Show help for any command:</p>

				<pre className="code-block">
					<code>{`npx @byronwade/memoria --help
npx @byronwade/memoria init --help
npx @byronwade/memoria analyze --help`}</code>
				</pre>

				<h2>Global vs npx</h2>

				<table>
					<thead>
						<tr>
							<th>Method</th>
							<th>Pros</th>
							<th>Cons</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>
								<code>npx</code>
							</td>
							<td>Always latest version, no install needed</td>
							<td>Slower first run, downloads each time</td>
						</tr>
						<tr>
							<td>Global install</td>
							<td>Faster startup, works offline</td>
							<td>Manual updates needed</td>
						</tr>
					</tbody>
				</table>

				<p>
					For MCP server configuration, npx is recommended as it ensures you
					always have the latest version.
				</p>

				<h2>Environment Variables</h2>

				<table>
					<thead>
						<tr>
							<th>Variable</th>
							<th>Description</th>
							<th>Default</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>
								<code>MEMORIA_DEBUG</code>
							</td>
							<td>Enable debug logging</td>
							<td>
								<code>false</code>
							</td>
						</tr>
						<tr>
							<td>
								<code>MEMORIA_CONFIG</code>
							</td>
							<td>Path to config file</td>
							<td>
								<code>.memoria.json</code>
							</td>
						</tr>
						<tr>
							<td>
								<code>MEMORIA_CACHE_DIR</code>
							</td>
							<td>Cache directory location</td>
							<td>
								<code>.memoria-cache</code>
							</td>
						</tr>
					</tbody>
				</table>

				<pre className="code-block">
					<code>{`# Enable debug mode
MEMORIA_DEBUG=true npx @byronwade/memoria analyze src/api/route.ts

# Use custom config
MEMORIA_CONFIG=./my-config.json npx @byronwade/memoria serve`}</code>
				</pre>

				<h2>Exit Codes</h2>

				<table>
					<thead>
						<tr>
							<th>Code</th>
							<th>Meaning</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>
								<code>0</code>
							</td>
							<td>Success</td>
						</tr>
						<tr>
							<td>
								<code>1</code>
							</td>
							<td>General error</td>
						</tr>
						<tr>
							<td>
								<code>2</code>
							</td>
							<td>Invalid arguments</td>
						</tr>
						<tr>
							<td>
								<code>3</code>
							</td>
							<td>File not found</td>
						</tr>
						<tr>
							<td>
								<code>4</code>
							</td>
							<td>Not a git repository</td>
						</tr>
					</tbody>
				</table>

				<h2>Scripting Examples</h2>

				<p>Use Memoria in your CI/CD or scripts:</p>

				<pre className="code-block">
					<code>{`#!/bin/bash

# Analyze changed files in a PR
for file in $(git diff --name-only main...HEAD); do
  echo "Analyzing $file"
  npx @byronwade/memoria analyze "$file" --json >> analysis.json
done

# Check if any file has high risk
HIGH_RISK=$(jq '[.[] | select(.risk > 70)] | length' analysis.json)
if [ "$HIGH_RISK" -gt 0 ]; then
  echo "Warning: $HIGH_RISK files have high risk scores"
  exit 1
fi`}</code>
				</pre>

				<div className="callout callout-info">
					<h4>MCP Server Mode</h4>
					<p>
						When running as an MCP server (the default for AI tools), Memoria
						uses the stdio transport and communicates via JSON-RPC. You
						don&apos;t need to interact with the CLI directly in this mode.
					</p>
				</div>
			</div>
		</>
	);
}
