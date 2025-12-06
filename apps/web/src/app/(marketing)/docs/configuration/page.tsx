import type { Metadata } from "next";
import { Breadcrumb } from "@/components/docs/breadcrumb";
import { generatePageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = generatePageMetadata({
	title: "Configuration",
	description:
		"Customize Memoria with .memoria.json. Configure thresholds, ignore patterns, and risk weights for your project.",
	path: "/docs/configuration",
	keywords: ["configuration", "settings", ".memoria.json", "customize"],
});

export default function ConfigurationPage() {
	return (
		<>
			<Breadcrumb
				items={[
					{ label: "Docs", href: "/docs" },
					{ label: "Configuration", href: "/docs/configuration" },
				]}
			/>
			<div className="docs-content">
				<h1>Configuration</h1>

				<p className="lead">
					Customize Memoria&apos;s behavior with a <code>.memoria.json</code>{" "}
					configuration file.
				</p>

				<h2>Creating a Config File</h2>

				<p>
					Create a <code>.memoria.json</code> file in your project root to
					customize thresholds, ignore patterns, and risk weights.
				</p>

				<pre className="code-block">
					<code>{`{
  "thresholds": {
    "couplingPercent": 60,
    "driftDays": 14,
    "analysisWindow": 90
  },
  "ignore": [
    "node_modules/**",
    "*.test.ts",
    "*.spec.ts"
  ],
  "panicKeywords": [
    "FIXME",
    "HACK",
    "XXX",
    "BUG"
  ],
  "riskWeights": {
    "coupling": 0.4,
    "drift": 0.3,
    "panic": 0.3
  }
}`}</code>
				</pre>

				<h2>Configuration Options</h2>

				<h3>Thresholds</h3>

				<table>
					<thead>
						<tr>
							<th>Option</th>
							<th>Default</th>
							<th>Description</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>
								<code>couplingPercent</code>
							</td>
							<td>60</td>
							<td>Minimum co-change percentage to flag files as coupled</td>
						</tr>
						<tr>
							<td>
								<code>driftDays</code>
							</td>
							<td>14</td>
							<td>
								Days since last modification to consider a file
								&quot;stale&quot;
							</td>
						</tr>
						<tr>
							<td>
								<code>analysisWindow</code>
							</td>
							<td>90</td>
							<td>Number of days of git history to analyze</td>
						</tr>
					</tbody>
				</table>

				<h3>Ignore Patterns</h3>

				<p>
					The <code>ignore</code> array uses glob patterns to exclude files from
					analysis:
				</p>

				<pre className="code-block">
					<code>{`{
  "ignore": [
    "node_modules/**",
    "dist/**",
    "build/**",
    "*.test.ts",
    "*.spec.ts",
    "**/__tests__/**",
    "*.d.ts"
  ]
}`}</code>
				</pre>

				<h3>Panic Keywords</h3>

				<p>
					Customize the keywords that contribute to a file&apos;s &quot;panic
					score&quot;. These indicate areas of technical debt or instability:
				</p>

				<pre className="code-block">
					<code>{`{
  "panicKeywords": [
    "FIXME",
    "HACK",
    "XXX",
    "BUG",
    "TODO",
    "BROKEN",
    "DEPRECATED"
  ]
}`}</code>
				</pre>

				<h3>Risk Weights</h3>

				<p>
					Adjust how different factors contribute to the overall risk score.
					Weights should sum to 1.0:
				</p>

				<pre className="code-block">
					<code>{`{
  "riskWeights": {
    "coupling": 0.4,
    "drift": 0.3,
    "panic": 0.3
  }
}`}</code>
				</pre>

				<table>
					<thead>
						<tr>
							<th>Weight</th>
							<th>Description</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>
								<code>coupling</code>
							</td>
							<td>How much file coupling affects risk score</td>
						</tr>
						<tr>
							<td>
								<code>drift</code>
							</td>
							<td>How much file staleness affects risk score</td>
						</tr>
						<tr>
							<td>
								<code>panic</code>
							</td>
							<td>How much panic keywords affect risk score</td>
						</tr>
					</tbody>
				</table>

				<h2>Environment Variables</h2>

				<p>You can also configure Memoria via environment variables:</p>

				<table>
					<thead>
						<tr>
							<th>Variable</th>
							<th>Description</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>
								<code>MEMORIA_DEBUG</code>
							</td>
							<td>Enable debug logging (set to &quot;true&quot;)</td>
						</tr>
						<tr>
							<td>
								<code>MEMORIA_CONFIG</code>
							</td>
							<td>Path to custom config file location</td>
						</tr>
					</tbody>
				</table>

				<h2>Per-Project Configuration</h2>

				<p>
					Each project can have its own <code>.memoria.json</code>. Memoria
					automatically detects and uses the config file in the current working
					directory.
				</p>

				<div className="callout callout-info">
					<h4>Config Priority</h4>
					<p>
						Project-level config (<code>.memoria.json</code>) takes precedence
						over environment variables, which take precedence over defaults.
					</p>
				</div>

				<h2>Minimal Configuration</h2>

				<p>For most projects, you only need to customize ignore patterns:</p>

				<pre className="code-block">
					<code>{`{
  "ignore": [
    "node_modules/**",
    "dist/**"
  ]
}`}</code>
				</pre>
			</div>
		</>
	);
}
