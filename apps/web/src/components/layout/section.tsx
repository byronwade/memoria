import { Container } from "@/components/ui/container";

interface SectionProps {
	children: React.ReactNode;
	className?: string;
	containerSize?: "sm" | "md" | "lg" | "xl";
	id?: string;
	background?: "default" | "muted";
}

export function Section({
	children,
	className = "",
	containerSize = "lg",
	id,
	background = "default",
}: SectionProps) {
	return (
		<section
			id={id}
			className={`py-20 md:py-28 ${background === "muted" ? "bg-muted/30" : ""} ${className}`}
		>
			<Container size={containerSize}>{children}</Container>
		</section>
	);
}
