"use client";

import { m } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { fadeInUp } from "@/lib/motion";

export function CtaSection() {
	return (
		<Section className="bg-muted/30">
			<m.div
				initial="hidden"
				whileInView="visible"
				viewport={{ once: true }}
				className="text-center max-w-2xl mx-auto"
			>
				<m.h2
					variants={fadeInUp}
					className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight text-foreground"
				>
					Ready to give your AI{" "}
					<span className="text-primary">memory</span>?
				</m.h2>
				<m.p
					variants={fadeInUp}
					className="mt-6 text-lg text-muted-foreground"
				>
					Install in seconds. No configuration required.
				</m.p>
				<m.div
					variants={fadeInUp}
					className="mt-10 flex flex-col sm:flex-row gap-4 justify-center"
				>
					<Button variant="cta" size="lg" asChild>
						<Link href="/docs/installation">
							Get Started
							<ArrowRight className="w-4 h-4 ml-2" />
						</Link>
					</Button>
					<Button variant="outline" size="lg" asChild>
						<a
							href="https://github.com/byronwade/memoria"
							target="_blank"
							rel="noopener noreferrer"
						>
							Star on GitHub
						</a>
					</Button>
				</m.div>
			</m.div>
		</Section>
	);
}
