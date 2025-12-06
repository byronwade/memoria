"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
	const [mounted, setMounted] = useState(false);
	const { theme, setTheme } = useTheme();

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return (
			<Button
				variant="ghost"
				size="icon"
				aria-label="Toggle theme"
				className="relative size-9 rounded-full"
			>
				<Sun className="h-[18px] w-[18px]" />
			</Button>
		);
	}

	return (
		<Button
			variant="ghost"
			size="icon"
			onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
			aria-label={
				theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
			}
			className="relative size-9 rounded-full hover:bg-muted"
		>
			<Sun className="h-[18px] w-[18px] rotate-0 scale-100 transition-all duration-200 dark:-rotate-90 dark:scale-0" />
			<Moon className="absolute h-[18px] w-[18px] rotate-90 scale-0 transition-all duration-200 dark:rotate-0 dark:scale-100" />
			<span className="sr-only">Toggle theme</span>
		</Button>
	);
}
