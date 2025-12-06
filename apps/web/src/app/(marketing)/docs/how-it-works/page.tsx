import type { Metadata } from "next";
import { Breadcrumb } from "@/components/docs/breadcrumb";
import { generatePageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = generatePageMetadata({
	title: "How It Works",
	description:
		"Learn how Memoria uses git forensics to detect hidden file dependencies and prevent your AI from breaking code.",
	path: "/docs/how-it-works",
	keywords: ["git forensics", "engines", "how it works", "file dependencies"],
});

export default function HowItWorksPage() {
	return (
		<>
			<Breadcrumb
				items={[
					{ label: "Docs", href: "/docs" },
					{ label: "How It Works", href: "/docs/how-it-works" },
				]}
			/>
			<div className="docs-content">
				<h1>How It Works</h1>

				<p className="lead">
					Memoria uses git forensics to give your AI the same intuition a senior
					developer has about code dependencies.
				</p>

				<h2>The Problem: Implicit Dependencies</h2>

				<p>
					When you ask an AI to modify a file, it can see explicit dependencies
					(imports, types). But real codebases have{" "}
					<strong>implicit dependencies</strong>:
				</p>

				<ul>
					<li>API routes and the frontend components that consume them</li>
					<li>Database schemas and the services that query them</li>
					<li>Config files and the modules that read them</li>
					<li>Test files and the implementation they verify</li>
				</ul>

				<p>
					Static analysis can&apos;t see these connections. But git history can.
				</p>

				<h2>The Solution: Git Forensics</h2>

				<p>
					Memoria analyzes commit history to find patterns that reveal hidden
					dependencies. It runs five analysis engines:
				</p>

				<h3>1. Volatility Engine</h3>

				<p>
					Scans commits for &ldquo;panic keywords&rdquo;: <code>fix</code>,{" "}
					<code>bug</code>,<code>revert</code>, <code>urgent</code>,{" "}
					<code>hotfix</code>. Uses <strong>time-decay</strong> so recent bugs
					matter more than old ones. Also tracks <strong>Bus Factor</strong>{" "}
					(who owns the code).
				</p>

				<pre className="code-inline">
					<code>Panic Score = (panic_commits / total_commits) * 100</code>
				</pre>

				<p>
					<strong>High panic score = historically bug-prone code.</strong> The
					AI is instructed to review changes twice and avoid removing safety
					checks.
				</p>

				<h3>2. Entanglement Engine</h3>

				<p>
					Analyzes the last 50 commits to find files that frequently change
					together:
				</p>

				<ol>
					<li>
						For each commit that touched the target file, find all other files
						in that commit
					</li>
					<li>Count how often each file appears alongside the target</li>
					<li>
						Calculate coupling percentage:{" "}
						<code>(co-changes / total) * 100</code>
					</li>
					<li>Return files with &gt;15% correlation</li>
				</ol>

				<p>
					<strong>
						If two files change together 85% of the time, they&apos;re coupled
					</strong>{" "}
					&mdash; even without any direct import between them.
				</p>

				<h3>3. Sentinel Engine</h3>

				<p>Compares modification times of coupled files:</p>

				<pre className="code-inline">
					<code>
						If coupled_file.mtime &lt; target_file.mtime - 7 days → STALE
					</code>
				</pre>

				<p>
					<strong>Stale dependencies are a regression risk.</strong> The AI is
					instructed to verify if the coupled file needs updating.
				</p>

				<h3>4. Static Import Engine</h3>

				<p>
					Uses <code>git grep</code> to find files that explicitly import the
					target file. This works even for brand new files with no git history
					yet.
				</p>

				<h3>5. History Search (The Archaeologist)</h3>

				<p>
					Search git history to understand <em>why</em> code was written. Solves
					the &ldquo;Chesterton&apos;s Fence&rdquo; problem before you delete
					that weird-looking code.
				</p>

				<h2>Output Format</h2>

				<p>
					Instead of dumping raw data, Memoria formats output to make the AI{" "}
					<em>think</em>:
				</p>

				<pre className="code-block">
					<code>{`🕵️ DETECTIVE WORK REQUIRED

File: dashboard/billing/page.tsx (85% coupled)
Linked via: "refactor subscription webhook schema"

Evidence (commit a3f21b4):
\`\`\`typescript
+ export interface SubscriptionUpdated {
+   status: 'active' | 'canceled' | 'past_due'
+   current_period_end: number
+ }
\`\`\`

> System Instruction: Analyze the code above.
> These files share the SubscriptionUpdated interface.
> Your changes MUST maintain type compatibility.`}</code>
				</pre>

				<p>
					The AI sees the evidence, understands the relationship, and makes
					informed decisions.
				</p>

				<h2>Smart Filtering</h2>

				<p>Memoria automatically filters noise from coupling analysis:</p>

				<ul>
					<li>
						<code>node_modules/</code>, <code>dist/</code>, <code>build/</code>
					</li>
					<li>
						Lock files (<code>package-lock.json</code>, <code>yarn.lock</code>,
						etc.)
					</li>
					<li>
						Python cache (<code>__pycache__/</code>, <code>*.pyc</code>)
					</li>
					<li>Java/Rust/Go build artifacts</li>
					<li>
						Your project&apos;s <code>.gitignore</code> patterns
					</li>
				</ul>

				<p>
					This reduces token usage by ~83% and eliminates meaningless
					correlations.
				</p>

				<h2>Performance</h2>

				<p>Memoria is optimized for speed:</p>

				<ul>
					<li>
						<strong>Full analysis:</strong> &lt;100ms
					</li>
					<li>
						<strong>Tokens per analysis:</strong> ~600 tokens
					</li>
					<li>
						<strong>Cache speedup:</strong> 2000x+ on repeat calls
					</li>
				</ul>

				<p>
					Results are cached with a 5-minute TTL using an LRU cache (100 items
					max).
				</p>

				<h2>Configuration</h2>

				<p>
					Create a <code>.memoria.json</code> in your project root to customize:
				</p>

				<pre className="code-block">
					<code>{`{
  "thresholds": {
    "couplingPercent": 20,
    "driftDays": 14,
    "analysisWindow": 100
  },
  "ignore": ["**/*.lock", "dist/", "legacy/**"],
  "panicKeywords": {
    "postmortem": 3,
    "incident": 3
  }
}`}</code>
				</pre>
			</div>
		</>
	);
}
