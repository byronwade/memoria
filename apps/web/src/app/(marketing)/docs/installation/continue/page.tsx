import type { Metadata } from "next";
import { Breadcrumb } from "@/components/docs/breadcrumb";
import { JsonLd } from "@/components/seo/JsonLd";
import { generatePageMetadata } from "@/lib/seo/metadata";
import { generateHowToSchema } from "@/lib/seo/schema";

export const metadata: Metadata = generatePageMetadata({
	title: "Continue Setup",
	description:
		"Set up Memoria for the Continue VS Code extension. Experimental MCP support configuration.",
	path: "/docs/installation/continue",
	keywords: ["Continue", "VS Code", "installation", "MCP"],
});

const continueSteps = [
	{
		name: "Find config file",
		text: "Continue stores configuration at ~/.continue/config.json",
	},
	{
		name: "Add configuration",
		text: "Add to config.json under experimental: { modelContextProtocolServers: [{ transport: { type: 'stdio', command: 'npx', args: ['-y', '@byronwade/memoria'] } }] }",
	},
	{
		name: "Reload VS Code",
		text: "Reload your VS Code window (Cmd/Ctrl + Shift + P → 'Developer: Reload Window').",
	},
	{
		name: "Verify installation",
		text: "Ask Continue 'What MCP tools do you have available?' - you should see analyze_file and ask_history.",
	},
];

export default function ContinuePage() {
	return (
		<>
			<Breadcrumb
				items={[
					{ label: "Docs", href: "/docs" },
					{ label: "Installation", href: "/docs/installation" },
					{ label: "Continue", href: "/docs/installation/continue" },
				]}
			/>
			<div className="docs-content">
				<JsonLd
					schema={generateHowToSchema(
						"Install Memoria for Continue",
						"Set up Memoria for the Continue VS Code extension.",
						continueSteps,
					)}
				/>
				<h1>Continue</h1>

				<p className="lead">
					Install Memoria for the Continue VS Code extension.
				</p>

				<h2>Step 1: Find Config File</h2>

				<p>Continue stores configuration at:</p>

				<pre className="code-inline">
					<code>~/.continue/config.json</code>
				</pre>

				<h2>Step 2: Add Configuration</h2>

				<p>
					Continue uses a slightly different config format. Add the following to
					your <code>config.json</code>:
				</p>

				<pre className="code-block">
					<code>{`{
  "experimental": {
    "modelContextProtocolServers": [
      {
        "transport": {
          "type": "stdio",
          "command": "npx",
          "args": ["-y", "@byronwade/memoria"]
        }
      }
    ]
  }
}`}</code>
				</pre>

				<p>
					If you have an existing config, merge the <code>experimental</code>{" "}
					section:
				</p>

				<pre className="code-block">
					<code>{`{
  "models": [...],
  "experimental": {
    "modelContextProtocolServers": [
      {
        "transport": {
          "type": "stdio",
          "command": "npx",
          "args": ["-y", "@byronwade/memoria"]
        }
      }
    ]
  }
}`}</code>
				</pre>

				<h2>Step 3: Reload VS Code</h2>

				<p>
					Reload your VS Code window (<kbd>Cmd/Ctrl + Shift + P</kbd> &rarr;
					&quot;Developer: Reload Window&quot;).
				</p>

				<h2>Verify Installation</h2>

				<p>Ask Continue:</p>
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
					<h4>Experimental Feature</h4>
					<p>
						MCP support in Continue is marked as experimental. Check
						Continue&apos;s documentation for the latest configuration format.
					</p>
				</div>
			</div>
		</>
	);
}
