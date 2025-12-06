import type { Metadata } from "next";
import { Breadcrumb } from "@/components/docs/breadcrumb";
import { JsonLd } from "@/components/seo/JsonLd";
import { generatePageMetadata } from "@/lib/seo/metadata";
import { generateHowToSchema } from "@/lib/seo/schema";

export const metadata: Metadata = generatePageMetadata({
	title: "Windsurf Setup",
	description:
		"Install Memoria for Codeium's Windsurf editor. Quick MCP configuration setup guide.",
	path: "/docs/installation/windsurf",
	keywords: ["Windsurf", "Codeium", "installation", "MCP"],
});

const windsurfSteps = [
	{
		name: "Find config file",
		text: "Windsurf stores MCP configuration at ~/.codeium/windsurf/mcp_config.json",
	},
	{
		name: "Add configuration",
		text: "Add to mcp_config.json: { mcpServers: { memoria: { command: 'npx', args: ['-y', '@byronwade/memoria'] } } }",
	},
	{
		name: "Restart Windsurf",
		text: "Restart Windsurf to load the new MCP configuration.",
	},
	{
		name: "Verify installation",
		text: "Ask Windsurf's AI 'What MCP tools do you have available?' - you should see analyze_file and ask_history.",
	},
];

export default function WindsurfPage() {
	return (
		<>
			<Breadcrumb
				items={[
					{ label: "Docs", href: "/docs" },
					{ label: "Installation", href: "/docs/installation" },
					{ label: "Windsurf", href: "/docs/installation/windsurf" },
				]}
			/>
			<div className="docs-content">
				<JsonLd
					schema={generateHowToSchema(
						"Install Memoria for Windsurf",
						"Install Memoria for Codeium's Windsurf editor.",
						windsurfSteps,
					)}
				/>
				<h1>Windsurf</h1>

				<div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-green-500/30 bg-green-500/5 mb-4">
					<span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-green-500/20 text-green-600 dark:text-green-400 rounded">
						100% FREE
					</span>
					<span className="text-sm text-muted-foreground">No account or API key required</span>
				</div>

				<p className="lead">
					Install Memoria for Codeium&apos;s Windsurf editor.
				</p>

				<h2>Step 1: Find Config File</h2>

				<p>Windsurf stores MCP configuration at:</p>

				<pre className="code-inline">
					<code>~/.codeium/windsurf/mcp_config.json</code>
				</pre>

				<h2>Step 2: Add Configuration</h2>

				<p>
					Open (or create) <code>mcp_config.json</code> and add:
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

				<p>
					If you have existing MCP servers, add memoria to the{" "}
					<code>mcpServers</code> object:
				</p>

				<pre className="code-block">
					<code>{`{
  "mcpServers": {
    "existing-server": { ... },
    "memoria": {
      "command": "npx",
      "args": ["-y", "@byronwade/memoria"]
    }
  }
}`}</code>
				</pre>

				<h2>Step 3: Restart Windsurf</h2>

				<p>Restart Windsurf to load the new MCP configuration.</p>

				<h2>Verify Installation</h2>

				<p>Ask Windsurf&apos;s AI:</p>
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

				<div className="callout callout-warning">
					<h4>Troubleshooting</h4>
					<p>
						If Memoria doesn&apos;t appear, make sure Node.js 18+ is installed
						and available in your PATH. Verify by running{" "}
						<code>node --version</code>.
					</p>
				</div>
			</div>
		</>
	);
}
