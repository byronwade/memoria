import type { Metadata } from "next";
import { Breadcrumb } from "@/components/docs/breadcrumb";
import { generatePageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = generatePageMetadata({
	title: "Auto-Pilot Mode",
	description:
		"Make your AI automatically analyze files before modifying them. Zero-prompt file analysis with Memoria.",
	path: "/docs/auto-pilot",
	keywords: ["auto-pilot", "automation", "custom rules", "automatic analysis"],
});

export default function AutoPilotPage() {
	return (
		<>
			<Breadcrumb
				items={[
					{ label: "Docs", href: "/docs" },
					{ label: "Auto-Pilot", href: "/docs/auto-pilot" },
				]}
			/>
			<div className="docs-content">
				<h1>Auto-Pilot Mode</h1>

				<p className="lead">
					Make your AI automatically analyze files before modifying
					them&mdash;no prompting required.
				</p>

				<h2>What is Auto-Pilot Mode?</h2>

				<p>
					Auto-Pilot mode injects custom rules into your AI tool that instruct
					it to automatically call Memoria&apos;s <code>analyze_file</code>{" "}
					function before making any changes to a file. This ensures your AI
					always has context about file dependencies and risks.
				</p>

				<h2>Quick Setup</h2>

				<p>
					Run the init command with the <code>--all</code> flag to set up rules
					for all supported AI tools:
				</p>

				<pre className="code-block">
					<code>npx @byronwade/memoria init --all</code>
				</pre>

				<p>
					This creates rule files for Cursor, Claude Code, Windsurf, and Cline.
				</p>

				<h2>Tool-Specific Setup</h2>

				<p>To set up auto-pilot for a specific tool:</p>

				<pre className="code-block">
					<code>{`# Cursor
npx @byronwade/memoria init --cursor

# Claude Code
npx @byronwade/memoria init --claude

# Windsurf
npx @byronwade/memoria init --windsurf

# Cline
npx @byronwade/memoria init --cline`}</code>
				</pre>

				<h2>Rule File Locations</h2>

				<p>Each AI tool reads rules from a specific location:</p>

				<table>
					<thead>
						<tr>
							<th>AI Tool</th>
							<th>Rule File Location</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>Cursor</td>
							<td>
								<code>.cursor/rules/memoria.mdc</code>
							</td>
						</tr>
						<tr>
							<td>Claude Code</td>
							<td>
								<code>.claude/memoria.md</code>
							</td>
						</tr>
						<tr>
							<td>Windsurf</td>
							<td>
								<code>.windsurfrules</code>
							</td>
						</tr>
						<tr>
							<td>Cline</td>
							<td>
								<code>.clinerules</code>
							</td>
						</tr>
					</tbody>
				</table>

				<h2>What the Rules Do</h2>

				<p>The generated rules instruct your AI to:</p>

				<ol>
					<li>
						Call <code>analyze_file</code> before modifying any source file
					</li>
					<li>Review the risk score and coupled files in the response</li>
					<li>
						Update coupled files if they share type definitions or schemas
					</li>
					<li>Check and update stale tests that depend on the modified file</li>
				</ol>

				<h2>Example Rule Content</h2>

				<p>Here&apos;s what a typical auto-pilot rule looks like:</p>

				<pre className="code-block">
					<code>{`# Memoria Integration

Before modifying any source file, ALWAYS call the \`analyze_file\` MCP tool
to get forensics data about the file.

## Required Steps

1. Call \`analyze_file(path: "path/to/file.ts")\`
2. Review the risk score and coupled files
3. If files are coupled, update them together
4. Run tests for any stale test files mentioned

## Example Usage

When asked to "update the API handler", first run:
\`analyze_file(path: "src/api/route.ts")\`

Then review the output before making changes.`}</code>
				</pre>

				<h2>Auto-Detection</h2>

				<p>Memoria can detect which AI tools you have configured:</p>

				<pre className="code-block">
					<code>npx @byronwade/memoria init</code>
				</pre>

				<p>
					Without flags, this command scans for existing AI tool configurations
					and offers to set up rules for detected tools.
				</p>

				<h2>Customizing Rules</h2>

				<p>
					After running init, you can customize the generated rule files. For
					example, you might want to:
				</p>

				<ul>
					<li>Add specific file patterns to always analyze</li>
					<li>Include additional context about your project structure</li>
					<li>Adjust the behavior for certain directories</li>
				</ul>

				<div className="callout callout-warning">
					<h4>Don&apos;t Delete Rule Files</h4>
					<p>
						If you delete the rule files, your AI will no longer automatically
						call Memoria. You&apos;ll need to manually ask it to analyze files.
					</p>
				</div>

				<h2>Verifying Auto-Pilot</h2>

				<p>To verify auto-pilot is working:</p>

				<ol>
					<li>Open your project in your AI tool</li>
					<li>
						Ask the AI to modify a file: &quot;Update src/api/route.ts to add
						logging&quot;
					</li>
					<li>
						Watch for the AI to call <code>analyze_file</code> before making
						changes
					</li>
				</ol>

				<p>
					If the AI doesn&apos;t automatically analyze, check that the rule file
					is in the correct location and restart your AI tool.
				</p>

				<h2>Disabling Auto-Pilot</h2>

				<p>
					To disable auto-pilot for a specific tool, simply delete its rule
					file:
				</p>

				<pre className="code-block">
					<code>{`# Disable for Cursor
rm .cursor/rules/memoria.mdc

# Disable for Claude Code
rm .claude/memoria.md`}</code>
				</pre>

				<p>
					You can still use Memoria manually by asking your AI to analyze files.
				</p>
			</div>
		</>
	);
}
