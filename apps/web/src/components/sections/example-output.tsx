"use client";

import { m } from "framer-motion";
import { Section } from "@/components/layout/section";
import { Card } from "@/components/ui/card";
import { fadeInUp } from "@/lib/motion";

const exampleOutput = `### 🧠 Forensics for \`route.ts\`

**🔥 RISK: 65/100 (HIGH)**
> Proceed carefully. Check all coupled files and update stale dependencies.

**Risk Factors:** High volatility (45% panic score) • Tightly coupled (3 files) • Heavily imported (8 files depend on this)

---

**🔗 COUPLED FILES**

**📐 \`billing/page.tsx\`** (85% coupled, schema)
> These files share type definitions. If you modify types in one, update the other to match.
\`\`\`diff
+ interface SubscriptionUpdated
- oldStatus: string
\`\`\`

---

**🧱 STATIC DEPENDENTS**
> These files explicitly import \`route.ts\`. If you change the API, you MUST update them.
- [ ] Check \`src/components/SubscriptionCard.tsx\`
- [ ] Check \`src/hooks/useSubscription.ts\`

---

**🛑 PRE-FLIGHT CHECKLIST**
- [ ] Modify \`route.ts\` (primary target)
- [ ] Verify \`billing/page.tsx\` (schema coupling)
- [ ] Update \`tests/stripe.test.ts\` (stale by 12 days)`;

export function ExampleOutput() {
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
					See It In Action
				</m.p>
				<m.h2
					variants={fadeInUp}
					className="mt-4 text-3xl md:text-4xl font-medium tracking-tight"
				>
					Real forensics output
				</m.h2>
				<m.p
					variants={fadeInUp}
					className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto"
				>
					When you ask your AI to analyze a file, Memoria returns actionable
					intelligence
				</m.p>
			</m.div>

			<m.div
				variants={fadeInUp}
				initial="hidden"
				whileInView="visible"
				viewport={{ once: true }}
				className="max-w-3xl mx-auto"
			>
				<Card className="bg-gray-900 overflow-hidden shadow-xl border-gray-800 p-0">
					<div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
						<div className="flex gap-1.5">
							<div className="w-3 h-3 rounded-full bg-red-500/80" />
							<div className="w-3 h-3 rounded-full bg-yellow-500/80" />
							<div className="w-3 h-3 rounded-full bg-green-500/80" />
						</div>
						<span className="text-gray-500 text-xs font-mono ml-2">
							memoria output
						</span>
					</div>
					<div className="p-6 text-left font-mono text-sm overflow-x-auto">
						<pre className="whitespace-pre-wrap text-gray-300 leading-relaxed">
							{exampleOutput.split("\n").map((line, i) => {
								// Color different parts
								if (line.startsWith("###")) {
									return (
										<div
											key={i}
											className="text-white font-bold text-base mb-2"
										>
											{line.replace("### ", "")}
										</div>
									);
								}
								if (line.startsWith("**🔥")) {
									return (
										<div key={i} className="text-red-400 font-semibold">
											{line.replace(/\*\*/g, "")}
										</div>
									);
								}
								if (
									line.startsWith("**🔗") ||
									line.startsWith("**🧱") ||
									line.startsWith("**🛑")
								) {
									return (
										<div
											key={i}
											className="text-emerald-400 font-semibold mt-4"
										>
											{line.replace(/\*\*/g, "")}
										</div>
									);
								}
								if (line.startsWith("**📐")) {
									return (
										<div key={i} className="text-blue-400">
											{line.replace(/\*\*/g, "")}
										</div>
									);
								}
								if (line.startsWith("**Risk")) {
									return (
										<div key={i} className="text-amber-400 text-xs mt-1">
											{line.replace(/\*\*/g, "")}
										</div>
									);
								}
								if (line.startsWith(">")) {
									return (
										<div
											key={i}
											className="text-gray-500 italic pl-4 border-l-2 border-gray-700 my-2"
										>
											{line.replace("> ", "")}
										</div>
									);
								}
								if (line.startsWith("- [ ]")) {
									return (
										<div key={i} className="text-gray-400 pl-4">
											{line}
										</div>
									);
								}
								if (line.startsWith("```")) {
									return null;
								}
								if (line.startsWith("+")) {
									return (
										<div key={i} className="text-green-400 pl-4">
											{line}
										</div>
									);
								}
								if (
									line.startsWith("-") &&
									!line.startsWith("- [") &&
									!line.startsWith("---")
								) {
									return (
										<div key={i} className="text-red-400 pl-4">
											{line}
										</div>
									);
								}
								if (line === "---") {
									return <hr key={i} className="border-gray-700 my-4" />;
								}
								return <div key={i}>{line}</div>;
							})}
						</pre>
					</div>
				</Card>
			</m.div>
		</Section>
	);
}
