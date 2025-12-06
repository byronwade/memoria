import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/docs/breadcrumb";
import { JsonLd } from "@/components/seo/JsonLd";
import { generatePageMetadata } from "@/lib/seo/metadata";
import { generateHowToSchema } from "@/lib/seo/schema";

export const metadata: Metadata = generatePageMetadata({
	title: "Installation",
	description:
		"Get Memoria set up with your favorite AI tool in under 2 minutes. Guides for Claude Desktop, Cursor, Windsurf, and Continue.",
	path: "/docs/installation",
	keywords: ["install", "setup", "npx", "configuration"],
});

const guides = [
	{
		name: "Claude Desktop",
		path: "claude",
		description: "Install Memoria for Claude Desktop on macOS or Windows",
	},
	{
		name: "Cursor",
		path: "cursor",
		description: "Install Memoria for the Cursor AI code editor",
	},
	{
		name: "Windsurf",
		path: "windsurf",
		description: "Install Memoria for Codeium's Windsurf editor",
	},
	{
		name: "Continue",
		path: "continue",
		description: "Install Memoria for the Continue VS Code extension",
	},
];

const installationSteps = [
	{
		name: "Choose your AI tool",
		text: "Select your AI tool (Claude Desktop, Cursor, Windsurf, or Continue) and open its configuration file.",
	},
	{
		name: "Add MCP configuration",
		text: "Add the Memoria server config: { mcpServers: { memoria: { command: 'npx', args: ['-y', '@byronwade/memoria'] } } }",
	},
	{
		name: "Restart your AI tool",
		text: "Completely quit and reopen your AI tool to load the new MCP server.",
	},
	{
		name: "Verify installation",
		text: "Ask your AI 'What MCP tools do you have available?' and confirm analyze_file and ask_history are listed.",
	},
];

export default function InstallationPage() {
	return (
		<>
			<Breadcrumb
				items={[
					{ label: "Docs", href: "/docs" },
					{ label: "Installation", href: "/docs/installation" },
				]}
			/>
			<div className="docs-content">
				<JsonLd
					schema={generateHowToSchema(
						"Install Memoria MCP Server",
						"Get Memoria set up with your favorite AI tool in under 2 minutes.",
						installationSteps,
					)}
				/>
				<h1>Installation</h1>

				<div className="p-4 rounded-lg border border-green-500/30 bg-green-500/5 mb-6">
					<div className="flex items-center gap-2 mb-1">
						<span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-green-500/20 text-green-600 dark:text-green-400 rounded">
							100% FREE
						</span>
						<span className="text-sm font-medium text-foreground">No account required</span>
					</div>
					<p className="text-sm text-muted-foreground mb-0">
						Memoria is completely free to install and run. All 13 git analysis engines work locally with no account, no API keys, and no cloud connection.
					</p>
				</div>

				<p className="lead">
					Memoria works with any MCP-compatible AI tool. Choose your editor
					below for specific instructions.
				</p>

				<h2>Universal Config</h2>
				<p>
					Most MCP clients use a similar JSON configuration. Add this to your
					MCP config file:
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

				<h2>Installation Guides</h2>
				<div className="grid gap-3 mt-6">
					{guides.map((guide) => (
						<Link
							key={guide.path}
							href={`/docs/installation/${guide.path}`}
							className="block p-4 rounded-xl border border-card-border bg-card hover:border-accent/30 hover:bg-accent/5 transition-all no-underline group"
						>
							<h3 className="font-semibold text-foreground group-hover:text-accent transition-colors m-0">
								{guide.name}
							</h3>
							<p className="text-muted-foreground text-sm mt-1 mb-0">
								{guide.description}
							</p>
						</Link>
					))}
				</div>

				<h2>Alternative: Global Install</h2>
				<p>If you prefer to install Memoria globally instead of using npx:</p>
				<pre className="code-block">
					<code>npm install -g @byronwade/memoria</code>
				</pre>
				<p>Then update your config to use the global binary:</p>
				<pre className="code-block">
					<code>{`{
  "mcpServers": {
    "memoria": {
      "command": "memoria"
    }
  }
}`}</code>
				</pre>

				<h2>Verify Installation</h2>
				<p>After configuring, restart your AI tool and ask:</p>
				<pre className="code-inline">
					<code>&quot;What MCP tools do you have available?&quot;</code>
				</pre>
				<p>
					You should see <code>analyze_file</code> and <code>ask_history</code>{" "}
					from Memoria in the response.
				</p>
			</div>
		</>
	);
}
