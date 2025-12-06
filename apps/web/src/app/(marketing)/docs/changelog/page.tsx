import type { Metadata } from "next";
import { Breadcrumb } from "@/components/docs/breadcrumb";
import { generatePageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = generatePageMetadata({
	title: "Changelog",
	description:
		"Version history and release notes for Memoria. Track new features, bug fixes, and breaking changes across all releases.",
	path: "/docs/changelog",
	keywords: ["changelog", "releases", "version history", "updates"],
});

export default function ChangelogPage() {
	return (
		<>
			<Breadcrumb
				items={[
					{ label: "Docs", href: "/docs" },
					{ label: "Changelog", href: "/docs/changelog" },
				]}
			/>
			<div className="docs-content">
				<h1>Changelog</h1>

				<p className="lead">
					All notable changes to Memoria are documented here.
				</p>

				<p>
					This project adheres to{" "}
					<a
						href="https://semver.org/"
						target="_blank"
						rel="noopener noreferrer"
					>
						Semantic Versioning
					</a>
					. The format is based on{" "}
					<a
						href="https://keepachangelog.com/"
						target="_blank"
						rel="noopener noreferrer"
					>
						Keep a Changelog
					</a>
					.
				</p>

				<div className="callout callout-info">
					<h4>Stay Updated</h4>
					<p>
						Watch the{" "}
						<a
							href="https://github.com/byronwade/memoria/releases"
							target="_blank"
							rel="noopener noreferrer"
						>
							GitHub Releases
						</a>{" "}
						page for the latest updates and release notes.
					</p>
				</div>

				<h2 id="unreleased">[Unreleased]</h2>

				<p>Changes that are in development but not yet released.</p>

				<h3>Planned</h3>
				<ul>
					<li>Multi-file analysis in a single call</li>
					<li>Custom output formatters</li>
					<li>Integration with more AI tools</li>
				</ul>

				<hr />

				<h2 id="1.0.0">[1.0.0] - Initial Release</h2>

				<p>The first stable release of Memoria.</p>

				<h3>Added</h3>

				<ul>
					<li>
						<strong>analyze_file</strong> tool &mdash; Core file analysis with
						git forensics
						<ul>
							<li>
								Volatility Engine: Panic keyword detection with time-decay
								scoring
							</li>
							<li>
								Entanglement Engine: Co-change analysis with configurable
								threshold
							</li>
							<li>Sentinel Engine: Stale dependency detection</li>
							<li>Static Import Engine: Import relationship tracking</li>
							<li>Evidence extraction: Actual code diffs in analysis output</li>
						</ul>
					</li>
					<li>
						<strong>ask_history</strong> tool &mdash; Git history search for
						understanding code context
					</li>
					<li>
						<strong>CLI commands</strong>
						<ul>
							<li>
								<code>memoria init</code> &mdash; Auto-setup for AI tools
							</li>
							<li>
								<code>memoria analyze</code> &mdash; Standalone file analysis
							</li>
							<li>
								<code>memoria serve</code> &mdash; Start MCP server
							</li>
						</ul>
					</li>
					<li>
						<strong>Configuration</strong> via <code>.memoria.json</code>
						<ul>
							<li>
								Customizable thresholds (coupling, drift, analysis window)
							</li>
							<li>Ignore patterns with glob syntax</li>
							<li>Custom panic keywords with weights</li>
							<li>Risk weight configuration</li>
						</ul>
					</li>
					<li>
						<strong>Auto-pilot mode</strong> &mdash; Automatic analysis rules
						for AI tools
						<ul>
							<li>
								Cursor rules (<code>.cursor/rules/memoria.mdc</code>)
							</li>
							<li>
								Claude Code rules (<code>.claude/memoria.md</code>)
							</li>
							<li>
								Windsurf rules (<code>.windsurfrules</code>)
							</li>
							<li>
								Cline rules (<code>.clinerules</code>)
							</li>
						</ul>
					</li>
					<li>
						<strong>Performance optimizations</strong>
						<ul>
							<li>LRU cache with 5-minute TTL</li>
							<li>
								Smart filtering of noise (node_modules, build artifacts, etc.)
							</li>
							<li>&lt;100ms analysis time</li>
							<li>~600 tokens per analysis average</li>
						</ul>
					</li>
					<li>
						<strong>Platform support</strong>
						<ul>
							<li>macOS</li>
							<li>Linux</li>
							<li>Windows</li>
						</ul>
					</li>
				</ul>

				<h3>AI Tool Support</h3>

				<ul>
					<li>Claude Desktop</li>
					<li>Cursor</li>
					<li>Windsurf</li>
					<li>Continue (VS Code)</li>
					<li>Cline</li>
				</ul>

				<hr />

				<h2>Version Format</h2>

				<p>Memoria follows Semantic Versioning (SemVer):</p>

				<pre className="code-block">
					<code>{`MAJOR.MINOR.PATCH

MAJOR - Breaking changes (incompatible API changes)
MINOR - New features (backward compatible)
PATCH - Bug fixes (backward compatible)`}</code>
				</pre>

				<h3>What Constitutes a Breaking Change?</h3>

				<ul>
					<li>Changes to tool input/output schemas</li>
					<li>Removal of configuration options</li>
					<li>
						Changes to default behavior that could affect existing workflows
					</li>
					<li>Minimum Node.js version increases</li>
				</ul>

				<h3>What&apos;s NOT a Breaking Change?</h3>

				<ul>
					<li>Adding new tools</li>
					<li>Adding new optional configuration options</li>
					<li>Performance improvements</li>
					<li>Bug fixes that don&apos;t change expected behavior</li>
					<li>Documentation updates</li>
				</ul>

				<h2>Checking Your Version</h2>

				<pre className="code-block">
					<code>{`# Check installed version
npx @byronwade/memoria --version

# Or if installed globally
memoria --version`}</code>
				</pre>

				<h2>Upgrading</h2>

				<p>When using npx, you always get the latest version:</p>

				<pre className="code-block">
					<code>{`npx @byronwade/memoria@latest`}</code>
				</pre>

				<p>For global installations, update with:</p>

				<pre className="code-block">
					<code>{`npm update -g @byronwade/memoria`}</code>
				</pre>

				<div className="callout callout-warning">
					<h4>Major Version Upgrades</h4>
					<p>
						Before upgrading to a new major version, read the release notes for
						any migration steps. Breaking changes will be clearly documented.
					</p>
				</div>
			</div>
		</>
	);
}
