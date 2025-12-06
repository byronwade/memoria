interface ContainerProps {
	children: React.ReactNode;
	className?: string;
	size?: "sm" | "md" | "lg" | "xl";
}

const sizeStyles = {
	sm: "max-w-3xl",
	md: "max-w-5xl",
	lg: "max-w-6xl",
	xl: "max-w-7xl",
};

export function Container({
	children,
	className = "",
	size = "lg",
}: ContainerProps) {
	return (
		<div
			className={`${sizeStyles[size]} mx-auto px-4 sm:px-6 lg:px-8 ${className}`}
		>
			{children}
		</div>
	);
}
