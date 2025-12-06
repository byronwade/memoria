"use client";

import { m } from "framer-motion";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fadeInUp } from "@/lib/motion";

const frameworks = [
	{
		id: "claude-desktop",
		name: "Claude Desktop",
		icon: "C",
		config: `{
  "mcpServers": {
    "memoria": {
      "command": "npx",
      "args": ["-y", "@byronwade/memoria"]
    }
  }
}`,
		path: "~/Library/Application Support/Claude/claude_desktop_config.json",
	},
	{
		id: "claude-code",
		name: "Claude Code",
		icon: "CC",
		config: `claude mcp add memoria -- npx -y @byronwade/memoria`,
		path: "Terminal one-liner",
	},
	{
		id: "cursor",
		name: "Cursor",
		icon: "⌘",
		config: `{
  "mcpServers": {
    "memoria": {
      "command": "npx",
      "args": ["-y", "@byronwade/memoria"]
    }
  }
}`,
		path: ".cursor/mcp.json",
	},
	{
		id: "windsurf",
		name: "Windsurf",
		icon: "W",
		config: `{
  "mcpServers": {
    "memoria": {
      "command": "npx",
      "args": ["-y", "@byronwade/memoria"]
    }
  }
}`,
		path: "~/.codeium/windsurf/mcp_config.json",
	},
	{
		id: "continue",
		name: "Continue",
		icon: "→",
		config: `{
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
}`,
		path: "~/.continue/config.json",
	},
	{
		id: "cline",
		name: "Cline",
		icon: "CL",
		config: `{
  "mcpServers": {
    "memoria": {
      "command": "npx",
      "args": ["-y", "@byronwade/memoria"]
    }
  }
}`,
		path: "Cline MCP Settings",
	},
];

function CopyButton({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);

	const copy = async () => {
		await navigator.clipboard.writeText(text);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<Button
			variant="ghost"
			size="icon"
			onClick={copy}
			aria-label="Copy to clipboard"
			className="h-8 w-8 hover:bg-foreground/10"
		>
			{copied ? (
				<Check className="w-4 h-4 text-emerald-400" />
			) : (
				<Copy className="w-4 h-4 text-gray-400" />
			)}
		</Button>
	);
}

export function FrameworkTabs() {
	const [activeTab, setActiveTab] = useState("claude-desktop");

	return (
		<Section background="muted">
			<m.div
				initial="hidden"
				whileInView="visible"
				viewport={{ once: true }}
				className="text-center mb-12"
			>
				<m.p
					variants={fadeInUp}
					className="text-sm text-muted-foreground uppercase tracking-wider font-medium"
				>
					Quick Setup
				</m.p>
				<m.h2
					variants={fadeInUp}
					className="mt-4 text-3xl md:text-4xl font-medium tracking-tight"
				>
					Configure your AI tool
				</m.h2>
				<m.p
					variants={fadeInUp}
					className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto"
				>
					Add Memoria to your favorite AI assistant in seconds. Then restart
					your tool.
				</m.p>
			</m.div>

			<m.div
				variants={fadeInUp}
				initial="hidden"
				whileInView="visible"
				viewport={{ once: true }}
				className="max-w-2xl mx-auto"
			>
				<Tabs value={activeTab} onValueChange={setActiveTab}>
					<TabsList className="w-full justify-start overflow-x-auto mb-4">
						{frameworks.map((framework) => (
							<TabsTrigger
								key={framework.id}
								value={framework.id}
								className="gap-2 whitespace-nowrap"
							>
								<span className="w-5 h-5 rounded bg-muted flex items-center justify-center text-xs">
									{framework.icon}
								</span>
								<span className="hidden sm:inline">{framework.name}</span>
							</TabsTrigger>
						))}
					</TabsList>

					{frameworks.map((framework) => (
						<TabsContent key={framework.id} value={framework.id}>
							<Card className="bg-gray-900 overflow-hidden border-gray-800 p-0">
								<div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
									<span className="text-gray-500 text-sm font-mono">
										{framework.path}
									</span>
									<CopyButton text={framework.config} />
								</div>
								<pre className="p-4 overflow-x-auto">
									<code className="text-sm text-emerald-400 font-mono">
										{framework.config}
									</code>
								</pre>
							</Card>
						</TabsContent>
					))}
				</Tabs>
			</m.div>
		</Section>
	);
}
