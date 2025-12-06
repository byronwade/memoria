import type { Metadata } from "next";
import { Breadcrumb } from "@/components/docs/breadcrumb";
import { generatePageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = generatePageMetadata({
	title: "Contributing",
	description:
		"Contribute to Memoria development. Setup guide, code style, pull request process, and architecture overview for contributors.",
	path: "/docs/contributing",
	keywords: ["contributing", "development", "open source", "pull requests"],
});

export default function ContributingPage() {
	return (
		<>
			<Breadcrumb
				items={[
					{ label: "Docs", href: "/docs" },
					{ label: "Contributing", href: "/docs/contributing" },
				]}
			/>
			<div className="docs-content">
				<h1>Contributing</h1>

				<p className="lead">
					Help make Memoria better. Contributions of all kinds are welcome.
				</p>

				<h2>Ways to Contribute</h2>

				<ul>
					<li>
						<strong>Report bugs</strong> &mdash; Found an issue? Open a GitHub
						issue
					</li>
					<li>
						<strong>Suggest features</strong> &mdash; Have an idea? Start a
						discussion
					</li>
					<li>
						<strong>Improve docs</strong> &mdash; Fix typos, add examples,
						clarify explanations
					</li>
					<li>
						<strong>Submit code</strong> &mdash; Fix bugs or implement new
						features
					</li>
					<li>
						<strong>Share feedback</strong> &mdash; Tell us how you use Memoria
					</li>
				</ul>

				<h2>Development Setup</h2>

				<h3>Prerequisites</h3>

				<ul>
					<li>Node.js 18 or higher</li>
					<li>npm or yarn</li>
					<li>Git</li>
				</ul>

				<h3>Clone and Install</h3>

				<pre className="code-block">
					<code>{`# Clone the repository
git clone https://github.com/byronwade/memoria.git
cd memoria

# Install dependencies
npm install

# Build the project
npm run build`}</code>
				</pre>

				<h3>Project Structure</h3>

				<pre className="code-block">
					<code>{`memoria/
├── src/
│   ├── index.ts          # MCP server entry point
│   ├── cli.ts            # CLI commands
│   ├── engines/          # Analysis engines
│   │   ├── volatility.ts
│   │   ├── entanglement.ts
│   │   ├── sentinel.ts
│   │   └── static-import.ts
│   ├── tools/            # MCP tool definitions
│   │   ├── analyze-file.ts
│   │   └── ask-history.ts
│   └── utils/            # Shared utilities
├── tests/                # Test files
├── package.json
└── tsconfig.json`}</code>
				</pre>

				<h3>Running Locally</h3>

				<pre className="code-block">
					<code>{`# Run in development mode (auto-reload)
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Build for production
npm run build

# Run the built version
npm start`}</code>
				</pre>

				<h2>Testing with AI Tools</h2>

				<p>To test your changes with an AI tool:</p>

				<pre className="code-block">
					<code>{`# Build first
npm run build

# Update your MCP config to use local version
{
  "mcpServers": {
    "memoria": {
      "command": "node",
      "args": ["/path/to/memoria/dist/index.js"]
    }
  }
}

# Restart your AI tool to pick up changes`}</code>
				</pre>

				<h2>Code Style</h2>

				<p>We use ESLint and Prettier to maintain consistent code style:</p>

				<pre className="code-block">
					<code>{`# Check for linting errors
npm run lint

# Fix auto-fixable issues
npm run lint:fix

# Format code
npm run format`}</code>
				</pre>

				<h3>Guidelines</h3>

				<ul>
					<li>Use TypeScript for all new code</li>
					<li>Write descriptive variable and function names</li>
					<li>Add JSDoc comments for public APIs</li>
					<li>Keep functions focused and small</li>
					<li>Prefer composition over inheritance</li>
				</ul>

				<h2>Pull Request Process</h2>

				<ol>
					<li>
						<strong>Fork the repository</strong> and create your branch from{" "}
						<code>main</code>
					</li>
					<li>
						<strong>Make your changes</strong> with clear, atomic commits
					</li>
					<li>
						<strong>Add tests</strong> for new features or bug fixes
					</li>
					<li>
						<strong>Update documentation</strong> if needed
					</li>
					<li>
						<strong>Run the test suite</strong> and ensure all tests pass
					</li>
					<li>
						<strong>Submit a pull request</strong> with a clear description
					</li>
				</ol>

				<h3>Commit Messages</h3>

				<p>We follow conventional commits:</p>

				<pre className="code-block">
					<code>{`feat: add new analysis engine for import cycles
fix: handle empty git history gracefully
docs: update installation guide for Windows
refactor: simplify cache implementation
test: add tests for volatility engine
chore: update dependencies`}</code>
				</pre>

				<h3>PR Description Template</h3>

				<pre className="code-block">
					<code>{`## What does this PR do?
Brief description of the changes.

## Why is this change needed?
Context and motivation for the change.

## How has this been tested?
Describe how you tested your changes.

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Lint and format pass
- [ ] All tests pass`}</code>
				</pre>

				<h2>Architecture Overview</h2>

				<h3>Analysis Engines</h3>

				<p>Each engine is responsible for a specific type of analysis:</p>

				<table>
					<thead>
						<tr>
							<th>Engine</th>
							<th>Purpose</th>
							<th>Input</th>
							<th>Output</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>Volatility</td>
							<td>Risk scoring</td>
							<td>Git log</td>
							<td>Panic score, bus factor</td>
						</tr>
						<tr>
							<td>Entanglement</td>
							<td>Find coupled files</td>
							<td>Commit history</td>
							<td>File pairs with coupling %</td>
						</tr>
						<tr>
							<td>Sentinel</td>
							<td>Detect drift</td>
							<td>File timestamps</td>
							<td>Stale dependency list</td>
						</tr>
						<tr>
							<td>Static Import</td>
							<td>Find importers</td>
							<td>Source files</td>
							<td>Files that import target</td>
						</tr>
					</tbody>
				</table>

				<h3>Data Flow</h3>

				<pre className="code-block">
					<code>{`User Request
    ↓
MCP Tool (analyze_file / ask_history)
    ↓
Engine Coordinator
    ↓
┌─────────────────────────────────────┐
│  Volatility → Entanglement → ...    │
│     (parallel execution)            │
└─────────────────────────────────────┘
    ↓
Result Formatter
    ↓
Cached Response to AI`}</code>
				</pre>

				<h2>Adding a New Engine</h2>

				<p>To add a new analysis engine:</p>

				<ol>
					<li>
						Create a new file in <code>src/engines/</code>
					</li>
					<li>Implement the engine interface</li>
					<li>Register it in the coordinator</li>
					<li>Add configuration options</li>
					<li>Write tests</li>
					<li>Update documentation</li>
				</ol>

				<pre className="code-block">
					<code>{`// src/engines/my-engine.ts
export interface MyEngineResult {
  // Define your output structure
}

export async function runMyEngine(
  file: string,
  config: Config
): Promise<MyEngineResult> {
  // Implementation
}`}</code>
				</pre>

				<h2>Getting Help</h2>

				<ul>
					<li>
						<strong>GitHub Issues</strong> &mdash;{" "}
						<a
							href="https://github.com/byronwade/memoria/issues"
							target="_blank"
							rel="noopener noreferrer"
						>
							Report bugs or request features
						</a>
					</li>
					<li>
						<strong>Discussions</strong> &mdash;{" "}
						<a
							href="https://github.com/byronwade/memoria/discussions"
							target="_blank"
							rel="noopener noreferrer"
						>
							Ask questions or share ideas
						</a>
					</li>
				</ul>

				<h2>License</h2>

				<p>
					By contributing to Memoria, you agree that your contributions will be
					licensed under the MIT License.
				</p>
			</div>
		</>
	);
}
