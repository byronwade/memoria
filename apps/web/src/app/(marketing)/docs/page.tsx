import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/docs/breadcrumb";
import { generatePageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = generatePageMetadata({
	title: "Documentation",
	description:
		"Learn how to install, configure, and use Memoria to prevent your AI from breaking code through git forensics.",
	path: "/docs",
	keywords: ["documentation", "getting started", "setup", "MCP"],
});

export default function DocsPage() {
	return (
		<>
			<Breadcrumb items={[{ label: "Docs", href: "/docs" }]} />
			<div className="docs-content">
				<h1>Memoria Documentation</h1>

				<div className="p-4 rounded-lg border border-green-500/30 bg-green-500/5 mb-6">
					<div className="flex items-center gap-2 mb-1">
						<span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-green-500/20 text-green-600 dark:text-green-400 rounded">
							100% FREE
						</span>
						<span className="text-sm font-medium text-foreground">Local & Private</span>
					</div>
					<p className="text-sm text-muted-foreground">
						All 13 git analysis engines run on your machine. No account, no cloud, no limits.
						Paid plans are optional for teams who want shared cloud memories.
					</p>
				</div>

				<div className="flex gap-2 flex-wrap mb-6">
					<a
						href="https://www.npmjs.com/package/@byronwade/memoria"
						target="_blank"
						rel="noopener noreferrer"
					>
						<img
							src="https://img.shields.io/npm/v/@byronwade/memoria?style=flat-square"
							alt="npm version"
						/>
					</a>
					<a
						href="https://www.npmjs.com/package/@byronwade/memoria"
						target="_blank"
						rel="noopener noreferrer"
					>
						<img
							src="https://img.shields.io/npm/dm/@byronwade/memoria?style=flat-square"
							alt="npm downloads"
						/>
					</a>
					<a
						href="https://github.com/byronwade/memoria/blob/main/LICENSE"
						target="_blank"
						rel="noopener noreferrer"
					>
						<img
							src="https://img.shields.io/npm/l/@byronwade/memoria?style=flat-square"
							alt="license"
						/>
					</a>
					<a
						href="https://github.com/byronwade/memoria"
						target="_blank"
						rel="noopener noreferrer"
					>
						<img
							src="https://img.shields.io/github/stars/byronwade/memoria?style=flat-square"
							alt="GitHub stars"
						/>
					</a>
				</div>

				<p className="lead">
					An MCP server that prevents your AI from breaking code by revealing
					hidden file dependencies through git forensics.
				</p>

				<h2>What is Memoria?</h2>
				<p>
					When you ask an AI to refactor a file, it might break other files that
					depend on it &mdash; even if there&apos;s no direct import between
					them. Memoria prevents this by analyzing git history to find files
					that frequently change together.
				</p>

				<h2>Key Features</h2>
				<ul>
					<li>
						<strong>Volatility Engine</strong> &mdash; Scans commits for panic
						keywords with time-decay. Recent bugs matter more.
					</li>
					<li>
						<strong>Entanglement Engine</strong> &mdash; Finds files that change
						together &gt;15% of the time, even without imports.
					</li>
					<li>
						<strong>Sentinel Engine</strong> &mdash; Detects when coupled files
						are &gt;7 days out of sync.
					</li>
					<li>
						<strong>Static Import Engine</strong> &mdash; Uses git grep to find
						files that import the target.
					</li>
					<li>
						<strong>History Search</strong> &mdash; Search git history to
						understand WHY code was written.
					</li>
				</ul>

				<h2>Quick Start</h2>
				<p>Add this to your MCP configuration file:</p>
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
					See the <Link href="/docs/installation">installation guides</Link> for
					specific instructions for your AI tool.
				</p>

				<h2>How to Use</h2>
				<p>
					Once installed, simply ask your AI to analyze a file before making
					changes:
				</p>
				<pre className="code-inline">
					<code>
						&quot;Analyze src/api/stripe/route.ts before I refactor it&quot;
					</code>
				</pre>

				<p>Memoria will return:</p>
				<ul>
					<li>
						<strong>Coupled files</strong> &mdash; Files that frequently change
						together
					</li>
					<li>
						<strong>Risk score</strong> &mdash; How bug-prone this code is
						historically
					</li>
					<li>
						<strong>Stale dependencies</strong> &mdash; Coupled files that may
						need updating
					</li>
					<li>
						<strong>Evidence</strong> &mdash; Actual code diffs showing why
						files are related
					</li>
				</ul>

				<h2>Private & Local</h2>
				<p>
					Memoria runs <strong>100% on your machine</strong>. No code is
					uploaded to the cloud, no API keys required, works offline. Your code
					never leaves your computer.
				</p>

				<h2>MCP Tools</h2>
				<p>Memoria exposes two tools via the Model Context Protocol:</p>
				<ul>
					<li>
						<strong>
							<code>analyze_file</code>
						</strong>{" "}
						&mdash; Analyze a file to reveal risk score, coupled files, and
						hidden dependencies
					</li>
					<li>
						<strong>
							<code>ask_history</code>
						</strong>{" "}
						&mdash; Search git history to understand why code was written
					</li>
				</ul>
				<p>
					See the <Link href="/docs/api">API Reference</Link> for complete
					documentation of each tool.
				</p>

				<h2>Requirements</h2>
				<ul>
					<li>Node.js 18 or higher</li>
					<li>Git repository with commit history</li>
					<li>
						An MCP-compatible AI tool (Claude Desktop, Cursor, Windsurf, etc.)
					</li>
				</ul>
			</div>
		</>
	);
}
