import type { Metadata } from "next";
import { Breadcrumb } from "@/components/docs/breadcrumb";
import { JsonLd } from "@/components/seo/JsonLd";
import { generatePageMetadata } from "@/lib/seo/metadata";
import { generateHowToSchema } from "@/lib/seo/schema";

export const metadata: Metadata = generatePageMetadata({
	title: "Cursor Setup",
	description:
		"Configure Memoria for the Cursor AI code editor. Project-level and global configuration options.",
	path: "/docs/installation/cursor",
	keywords: ["Cursor", "installation", "code editor", "MCP"],
});

const cursorSteps = [
	{
		name: "Create config file",
		text: "Create .cursor/mcp.json in your project root (project-level) or ~/.cursor/mcp.json (global).",
	},
	{
		name: "Add configuration",
		text: "Add to mcp.json: { mcpServers: { memoria: { command: 'npx', args: ['-y', '@byronwade/memoria'] } } }",
	},
	{
		name: "Restart Cursor",
		text: "Restart Cursor to load the new MCP configuration.",
	},
	{
		name: "Verify installation",
		text: "Ask Cursor's AI 'What MCP tools do you have available?' - you should see analyze_file and ask_history.",
	},
];

export default function CursorPage() {
	return (
		<>
			<Breadcrumb
				items={[
					{ label: "Docs", href: "/docs" },
					{ label: "Installation", href: "/docs/installation" },
					{ label: "Cursor", href: "/docs/installation/cursor" },
				]}
			/>
			<div className="docs-content">
				<JsonLd
					schema={generateHowToSchema(
						"Install Memoria for Cursor",
						"Configure Memoria for the Cursor AI code editor.",
						cursorSteps,
					)}
				/>
				<h1>Cursor</h1>

				<div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-green-500/30 bg-green-500/5 mb-4">
					<span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-green-500/20 text-green-600 dark:text-green-400 rounded">
						100% FREE
					</span>
					<span className="text-sm text-muted-foreground">No account or API key required</span>
				</div>

				<p className="lead">Install Memoria for the Cursor AI code editor.</p>

				<h2>Quick Install (One-liner)</h2>

				<p>Run this in your project directory:</p>

				<pre className="code-block">
					<code>
						mkdir -p .cursor && echo &apos;
						{`{"mcpServers":{"memoria":{"command":"npx","args":["-y","@byronwade/memoria"]}}}`}
						&apos; &gt; .cursor/mcp.json
					</code>
				</pre>

				<h2>Manual Setup</h2>

				<h3>Step 1: Create Config File</h3>

				<p>Cursor supports both project-level and global MCP configuration:</p>

				<ul>
					<li>
						<strong>Project-level:</strong> <code>.cursor/mcp.json</code> (in
						project root)
					</li>
					<li>
						<strong>Global:</strong> <code>~/.cursor/mcp.json</code>
					</li>
				</ul>

				<h3>Step 2: Add Configuration</h3>

				<p>
					Add this to your <code>mcp.json</code> file:
				</p>

				<pre className="code-block">
					<code>{`{
  "mcpServers": {
    "memoria": {
      "command": "npx",
      "args": ["-y", "@byronwade/memoria"]
    }
  }
}`}</code>
				</pre>

				<h3>Step 3: Restart Cursor</h3>

				<p>Restart Cursor to load the new MCP configuration.</p>

				<h2>Verify Installation</h2>

				<p>Ask Cursor&apos;s AI:</p>
				<pre className="code-inline">
					<code>&quot;What MCP tools do you have available?&quot;</code>
				</pre>

				<p>
					You should see <code>analyze_file</code> and <code>ask_history</code>{" "}
					from Memoria.
				</p>

				<h2>Usage</h2>

				<p>Ask the AI to analyze files before making changes:</p>
				<pre className="code-inline">
					<code>&quot;Analyze src/api/route.ts before I refactor it&quot;</code>
				</pre>

				<div className="callout callout-info">
					<h4>Project vs Global Config</h4>
					<p>
						Use project-level config (<code>.cursor/mcp.json</code>) if you want
						Memoria only for specific projects. Use global config for all
						projects.
					</p>
				</div>
			</div>
		</>
	);
}
