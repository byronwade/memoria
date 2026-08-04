import { SiGithub, SiX } from "@icons-pack/react-simple-icons";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

type IconProps = {
	className?: string;
	size?: number | string;
} & Omit<ComponentProps<"svg">, "ref">;

/** GitHub brand mark (Lucide removed brand icons in v1). */
export function Github({ className, size = 24, ...props }: IconProps) {
	return (
		<SiGithub
			size={typeof size === "string" ? Number.parseFloat(size) || 24 : size}
			className={cn(className)}
			aria-hidden={props["aria-hidden"] ?? true}
			{...props}
		/>
	);
}

/** X (Twitter) brand mark (Lucide removed brand icons in v1). */
export function Twitter({ className, size = 24, ...props }: IconProps) {
	return (
		<SiX
			size={typeof size === "string" ? Number.parseFloat(size) || 24 : size}
			className={cn(className)}
			aria-hidden={props["aria-hidden"] ?? true}
			{...props}
		/>
	);
}
