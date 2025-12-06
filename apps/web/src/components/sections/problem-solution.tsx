"use client";

import { m } from "framer-motion";
import { Check, X } from "lucide-react";
import { Section } from "@/components/layout/section";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { fadeInUp, slideInLeft, slideInRight } from "@/lib/motion";

export function ProblemSolution() {
	return (
		<Section background="muted">
			<m.div
				initial="hidden"
				whileInView="visible"
				viewport={{ once: true }}
				className="text-center mb-16"
			>
				<m.h2
					variants={fadeInUp}
					className="text-3xl md:text-4xl font-bold"
				>
					The Problem
				</m.h2>
				<m.p
					variants={fadeInUp}
					className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto"
				>
					AI assistants don&apos;t understand implicit file dependencies
				</m.p>
			</m.div>

			<div className="grid md:grid-cols-2 gap-8">
				{/* Without Memoria */}
				<m.div
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true }}
					variants={slideInLeft}
				>
					<Card className="h-full bg-red-500/5 border-red-500/20">
						<CardHeader>
							<div className="flex items-center gap-3">
								<Avatar className="bg-red-500/10">
									<AvatarFallback className="bg-transparent">
										<X className="w-5 h-5 text-red-500" />
									</AvatarFallback>
								</Avatar>
								<h3 className="text-lg font-semibold text-red-500">
									Without Memoria
								</h3>
							</div>
						</CardHeader>
						<CardContent>
							<div className="space-y-4 text-sm md:text-base">
								<div className="flex gap-3">
									<span className="font-medium text-muted-foreground shrink-0">
										You:
									</span>
									<span>
										&quot;Update stripe/route.ts for the new schema&quot;
									</span>
								</div>
								<div className="flex gap-3">
									<span className="font-medium text-muted-foreground shrink-0">
										AI:
									</span>
									<span>&quot;Done!&quot; ✅</span>
								</div>
								<div className="flex gap-3">
									<span className="font-medium text-muted-foreground shrink-0">
										Result:
									</span>
									<span className="text-red-500 font-semibold">💥 CRASH</span>
								</div>
								<p className="text-muted-foreground italic pt-2 border-t border-red-500/10">
									dashboard/billing/page.tsx expected the old schema. The AI
									didn&apos;t know they were connected.
								</p>
							</div>
						</CardContent>
					</Card>
				</m.div>

				{/* With Memoria */}
				<m.div
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true }}
					variants={slideInRight}
				>
					<Card className="h-full bg-success/5 border-success/20">
						<CardHeader>
							<div className="flex items-center gap-3">
								<Avatar className="bg-success/10">
									<AvatarFallback className="bg-transparent">
										<Check className="w-5 h-5 text-success" />
									</AvatarFallback>
								</Avatar>
								<h3 className="text-lg font-semibold text-success">
									With Memoria
								</h3>
							</div>
						</CardHeader>
						<CardContent>
							<div className="space-y-4 text-sm md:text-base">
								<div className="flex gap-3">
									<span className="font-medium text-muted-foreground shrink-0">
										You:
									</span>
									<span>
										&quot;Update stripe/route.ts for the new schema&quot;
									</span>
								</div>
								<div className="flex gap-3">
									<span className="font-medium text-muted-foreground shrink-0">
										Memoria:
									</span>
									<span className="text-amber-500">
										&quot;⚠️ 85% coupled with dashboard/billing/page.tsx&quot;
									</span>
								</div>
								<div className="flex gap-3">
									<span className="font-medium text-muted-foreground shrink-0">
										AI:
									</span>
									<span>&quot;I&apos;ll update both files to match.&quot;</span>
								</div>
								<div className="flex gap-3 pt-2 border-t border-success/10">
									<span className="font-medium text-muted-foreground shrink-0">
										Result:
									</span>
									<span className="text-success font-semibold">
										✅ IT JUST WORKS
									</span>
								</div>
							</div>
						</CardContent>
					</Card>
				</m.div>
			</div>
		</Section>
	);
}
