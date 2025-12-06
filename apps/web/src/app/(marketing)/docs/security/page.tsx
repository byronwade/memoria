import type { Metadata } from "next";
import { Breadcrumb } from "@/components/docs/breadcrumb";
import { generatePageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = generatePageMetadata({
	title: "Security & Privacy",
	description:
		"Memoria security practices and privacy policy. Learn how your code stays local and secure with our privacy-first architecture.",
	path: "/docs/security",
	keywords: ["security", "privacy", "local-only", "data protection"],
});

export default function SecurityPage() {
	return (
		<>
			<Breadcrumb
				items={[
					{ label: "Docs", href: "/docs" },
					{ label: "Security", href: "/docs/security" },
				]}
			/>
			<div className="docs-content">
				<h1>Security &amp; Privacy</h1>

				<p className="lead">
					Memoria is designed with privacy-first principles. Your code never
					leaves your machine.
				</p>

				<h2>Local-Only Architecture</h2>

				<p>
					Memoria runs <strong>100% locally</strong> on your machine. It makes
					no network requests and requires no API keys, accounts, or cloud
					services.
				</p>

				<ul>
					<li>No code is uploaded to any server</li>
					<li>No telemetry or analytics are collected</li>
					<li>No external dependencies at runtime</li>
					<li>Works completely offline</li>
				</ul>

				<div className="callout callout-info">
					<h4>Open Source</h4>
					<p>
						Memoria is fully open source. You can audit the code yourself at{" "}
						<a
							href="https://github.com/byronwade/memoria"
							target="_blank"
							rel="noopener noreferrer"
						>
							github.com/byronwade/memoria
						</a>
					</p>
				</div>

				<h2>Data Access</h2>

				<p>Memoria accesses the following data on your local machine:</p>

				<h3>Git Repository Data</h3>

				<ul>
					<li>
						<strong>Commit history</strong> &mdash; Messages, authors,
						timestamps, and file lists
					</li>
					<li>
						<strong>File diffs</strong> &mdash; Changes between commits for
						evidence display
					</li>
					<li>
						<strong>Branch information</strong> &mdash; Current branch context
					</li>
				</ul>

				<p>
					This data is read directly from your local <code>.git</code> directory
					using standard git commands. Memoria never modifies your git history.
				</p>

				<h3>Source Files</h3>

				<ul>
					<li>
						<strong>File contents</strong> &mdash; Read to detect imports and
						relationships
					</li>
					<li>
						<strong>File metadata</strong> &mdash; Modification times for drift
						detection
					</li>
				</ul>

				<p>
					File contents are only read, never modified. Memoria operates in
					read-only mode.
				</p>

				<h3>Configuration Files</h3>

				<ul>
					<li>
						<code>.memoria.json</code> &mdash; Your project-specific
						configuration
					</li>
					<li>
						<code>.gitignore</code> &mdash; Patterns to exclude from analysis
					</li>
				</ul>

				<h2>Data Storage</h2>

				<p>Memoria stores minimal data locally for performance optimization:</p>

				<h3>Cache Location</h3>

				<p>
					Analysis results are cached in memory with a 5-minute TTL
					(time-to-live). The cache is cleared when:
				</p>

				<ul>
					<li>The MCP server is restarted</li>
					<li>The TTL expires (5 minutes)</li>
					<li>The cache reaches its size limit (100 items)</li>
				</ul>

				<p>
					You can customize the cache directory using the{" "}
					<code>MEMORIA_CACHE_DIR</code> environment variable.
				</p>

				<h3>No Persistent Storage</h3>

				<p>
					By default, Memoria does not write any persistent files. All analysis
					data exists only in memory during your session. When you restart your
					AI tool, the cache is cleared.
				</p>

				<h2>Permission Model</h2>

				<p>
					Memoria runs with the same permissions as your AI tool (Claude
					Desktop, Cursor, etc.):
				</p>

				<table>
					<thead>
						<tr>
							<th>Permission</th>
							<th>Scope</th>
							<th>Purpose</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>Read files</td>
							<td>Project directory only</td>
							<td>Analyze source code and imports</td>
						</tr>
						<tr>
							<td>Execute git</td>
							<td>Project directory only</td>
							<td>Read commit history and diffs</td>
						</tr>
						<tr>
							<td>Read .git</td>
							<td>Project directory only</td>
							<td>Access repository metadata</td>
						</tr>
					</tbody>
				</table>

				<p>Memoria cannot:</p>

				<ul>
					<li>Access files outside the project directory</li>
					<li>Modify any files or git history</li>
					<li>Make network requests</li>
					<li>Execute arbitrary code</li>
					<li>Access other applications or system settings</li>
				</ul>

				<h2>Trust Model</h2>

				<p>
					When using Memoria with an AI assistant, consider this trust chain:
				</p>

				<ol>
					<li>
						<strong>You trust your AI tool</strong> (Claude Desktop, Cursor,
						etc.) to run MCP servers safely
					</li>
					<li>
						<strong>The AI tool trusts Memoria</strong> to provide accurate file
						analysis
					</li>
					<li>
						<strong>Memoria trusts your git history</strong> to contain accurate
						information about code changes
					</li>
				</ol>

				<p>
					Memoria provides information to help the AI make better decisions, but
					the AI (and ultimately you) decide what actions to take.
				</p>

				<h2>Security Best Practices</h2>

				<h3>For Users</h3>

				<ul>
					<li>
						<strong>Review changes</strong> &mdash; Always review AI-suggested
						changes before accepting them, regardless of Memoria&apos;s analysis
					</li>
					<li>
						<strong>Use version control</strong> &mdash; Commit frequently so
						you can revert if needed
					</li>
					<li>
						<strong>Check sensitive files</strong> &mdash; Add sensitive files
						to your .gitignore and .memoria.json ignore patterns
					</li>
				</ul>

				<h3>For Organizations</h3>

				<ul>
					<li>
						<strong>Audit the source</strong> &mdash; Review the Memoria
						codebase before deploying in sensitive environments
					</li>
					<li>
						<strong>Pin versions</strong> &mdash; Use specific versions instead
						of <code>npx -y @byronwade/memoria</code> to avoid unexpected
						updates
					</li>
					<li>
						<strong>Use global install</strong> &mdash; Install globally for
						better control over which version runs
					</li>
				</ul>

				<pre className="code-block">
					<code>{`# Pin to specific version
npm install -g @byronwade/memoria@1.0.0

# Verify installed version
memoria --version`}</code>
				</pre>

				<h2>Sensitive Data Handling</h2>

				<p>
					Memoria automatically ignores common sensitive files and directories:
				</p>

				<ul>
					<li>
						<code>.env</code> files (environment variables)
					</li>
					<li>
						<code>credentials.json</code>, <code>secrets.yaml</code>
					</li>
					<li>
						<code>*.pem</code>, <code>*.key</code> (certificates and keys)
					</li>
					<li>
						Files in <code>.gitignore</code>
					</li>
				</ul>

				<p>
					You can add additional ignore patterns in <code>.memoria.json</code>:
				</p>

				<pre className="code-block">
					<code>{`{
  "ignore": [
    "**/*.secret",
    "config/production/**",
    "internal/**"
  ]
}`}</code>
				</pre>

				<h2>Reporting Security Issues</h2>

				<p>If you discover a security vulnerability in Memoria:</p>

				<ol>
					<li>
						<strong>Do not</strong> open a public GitHub issue
					</li>
					<li>Email details to the maintainer directly (see GitHub profile)</li>
					<li>Include steps to reproduce the vulnerability</li>
					<li>Allow reasonable time for a fix before public disclosure</li>
				</ol>

				<p>
					We take security seriously and will respond promptly to any reported
					issues.
				</p>
			</div>
		</>
	);
}
