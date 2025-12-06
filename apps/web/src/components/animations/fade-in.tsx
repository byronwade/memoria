"use client";

import { m } from "framer-motion";
import { fadeInUp } from "@/lib/motion";

interface FadeInProps {
	children: React.ReactNode;
	delay?: number;
	className?: string;
}

export function FadeIn({ children, delay = 0, className = "" }: FadeInProps) {
	return (
		<m.div
			initial="hidden"
			whileInView="visible"
			viewport={{ once: true, margin: "-100px" }}
			variants={fadeInUp}
			transition={{ delay }}
			className={className}
		>
			{children}
		</m.div>
	);
}

export function FadeInOnMount({
	children,
	delay = 0,
	className = "",
}: FadeInProps) {
	return (
		<m.div
			initial="hidden"
			animate="visible"
			variants={fadeInUp}
			transition={{ delay }}
			className={className}
		>
			{children}
		</m.div>
	);
}
