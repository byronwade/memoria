import type { Metadata } from "next";
import { Breadcrumb } from "@/components/docs/breadcrumb";
import { JsonLd } from "@/components/seo/JsonLd";
import { generatePageMetadata } from "@/lib/seo/metadata";
import { generateHowToSchema } from "@/lib/seo/schema";

export const metadata: Metadata = generatePageMetadata({
	title: "Claude Desktop Setup",
	description:
		"Step-by-step guide to install Memoria for Claude Desktop on macOS or Windows. Configure MCP in under 2 minutes.",
	path: "/docs/installation/claude",
	keywords: ["Claude Desktop", "installation", "macOS", "Windows", "MCP"],
});

const claudeSteps = [
	{
		name: "Find your config file",
		text: "On macOS: ~/Library/Application Support/Claude/claude_desktop_config.json. On Windows: %APPDATA%\\Claude\\claude_desktop_config.json",
	},
	{
		name: "Add Memoria to config",
		text: "Add to mcpServers: { memoria: { command: 'npx', args: ['-y', '@byronwade/memoria'] } }",
	},
	{
		name: "Restart Claude Desktop",
		text: "Completely quit Claude Desktop (not just close the window) and reopen it.",
	},
	{
		name: "Verify installation",
		text: "Ask Claude 'What MCP tools do you have available?' - you should see analyze_file and ask_history.",
	},
];

export default function ClaudePage() {
	return (
		<>
			<Breadcrumb
				items={[
					{ label: "Docs", href: "/docs" },
					{ label: "Installation", href: "/docs/installation" },
					{ label: "Claude Desktop", href: "/docs/installation/claude" },
				]}
			/>
			<div className="docs-content">
				<JsonLd
					schema={generateHowToSchema(
						"Install Memoria for Claude Desktop",
						"Step-by-step guide to install Memoria for Claude Desktop on macOS or Windows.",
						claudeSteps,
					)}
				/>
				<h1>Claude Desktop</h1>

				<p className="lead">
					Install Memoria for Claude Desktop on macOS or Windows.
				</p>

				<h2>Step 1: Find Your Config File</h2>

				<h3>macOS</h3>
				<pre className="code-inline">
					<code>
						~/Library/Application Support/Claude/claude_desktop_config.json
					</code>
				</pre>
				<p>Open Terminal and run:</p>
				<pre className="code-block">
					<code>open ~/Library/Application\ Support/Claude/</code>
				</pre>

				<h3>Windows</h3>
				<pre className="code-inline">
					<code>%APPDATA%\Claude\claude_desktop_config.json</code>
				</pre>
				<p>
					Press <kbd>Win + R</kbd>, type <code>%APPDATA%\Claude</code>, and
					press Enter.
				</p>

				<h2>Step 2: Add Memoria to Config</h2>

				<p>
					Open (or create) <code>claude_desktop_config.json</code> and add:
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
					If you already have other MCP servers configured, add memoria to the
					existing
					<code>mcpServers</code> object:
				</p>

				<pre className="code-block">
					<code>{`{
  "mcpServers": {
    "other-server": { ... },
    "memoria": {
      "command": "npx",
      "args": ["-y", "@byronwade/memoria"]
    }
  }
}`}</code>
				</pre>

				<h2>Step 3: Restart Claude Desktop</h2>

				<p>
					Completely quit Claude Desktop (not just close the window) and reopen
					it.
				</p>

				<h2>Step 4: Verify Installation</h2>

				<p>Ask Claude:</p>
				<pre className="code-inline">
					<code>&quot;What MCP tools do you have available?&quot;</code>
				</pre>

				<p>
					You should see <code>analyze_file</code> and <code>ask_history</code>{" "}
					from Memoria listed.
				</p>

				<h2>Usage</h2>

				<p>Now you can ask Claude to analyze files before making changes:</p>
				<pre className="code-inline">
					<code>
						&quot;Analyze /Users/me/project/src/api/route.ts before I refactor
						it&quot;
					</code>
				</pre>

				<div className="callout callout-warning">
					<h4>Important: Use Absolute Paths</h4>
					<p>
						Memoria requires absolute file paths (e.g.,{" "}
						<code>/Users/me/project/src/file.ts</code>). Relative paths
						won&apos;t work.
					</p>
				</div>
			</div>
		</>
	);
}
