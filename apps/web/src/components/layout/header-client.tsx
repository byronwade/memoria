"use client";

import { Github, Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SearchCommand } from "@/components/search-command";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { siteConfig } from "@/lib/seo/constants";
import { cn } from "@/lib/utils";

interface HeaderClientProps {
	navLinks: Array<{ href: string; label: string }>;
	children: React.ReactNode;
}

export function HeaderClient({ navLinks, children }: HeaderClientProps) {
	const [scrolled, setScrolled] = useState(false);
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	useEffect(() => {
		const handleScroll = () => setScrolled(window.scrollY > 20);
		window.addEventListener("scroll", handleScroll);
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	return (
		<header
			className={cn(
				"sticky top-0 z-50 w-full transition-all duration-300",
				scrolled
					? "bg-background/80 backdrop-blur-sm border-b border-border/50"
					: "bg-background"
			)}
		>
			<div className="max-w-6xl mx-auto flex h-14 items-center justify-between px-4 md:px-6">
				{/* Left: Logo + Nav */}
				<div className="flex items-center gap-6">
					{/* Logo */}
					<Link
						href="/"
						className="flex items-center gap-2"
					>
						<img
							src="/memoria.svg"
							alt="Memoria"
							className="h-6 w-6 dark:invert"
						/>
						<span className="font-semibold text-foreground hidden sm:inline">Memoria</span>
					</Link>

					{/* Desktop Nav Links */}
					<nav className="hidden md:flex items-center gap-1">
						{navLinks.map((link) => (
							<Link
								key={link.href}
								href={link.href}
								className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-sm hover:bg-secondary/50"
							>
								{link.label}
							</Link>
						))}
					</nav>
				</div>

				{/* Right: Actions */}
				<div className="flex items-center gap-2">
					{children}

					{/* Mobile menu button */}
					<Button
						variant="ghost"
						size="icon"
						onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
						aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
						aria-expanded={mobileMenuOpen}
						className="md:hidden text-foreground hover:bg-secondary/50 size-8"
					>
						{mobileMenuOpen ? (
							<X className="w-5 h-5" />
						) : (
							<Menu className="w-5 h-5" />
						)}
					</Button>
				</div>
			</div>

			{/* Mobile Menu Dropdown */}
			{mobileMenuOpen && (
				<div className="absolute top-full left-0 right-0 md:hidden border-b border-border/50 bg-background">
					<div className="max-w-6xl mx-auto px-4 py-4">
						<nav className="flex flex-col gap-1">
							{navLinks.map((link) => (
								<Link
									key={link.href}
									href={link.href}
									className="px-3 py-2.5 text-foreground hover:bg-secondary/50 rounded-sm transition-colors"
									onClick={() => setMobileMenuOpen(false)}
								>
									{link.label}
								</Link>
							))}
							<Link
								href="/login"
								className="px-3 py-2.5 text-foreground hover:bg-secondary/50 rounded-sm transition-colors"
								onClick={() => setMobileMenuOpen(false)}
							>
								Login
							</Link>
						</nav>
						<div className="h-px bg-border/50 my-3" />
						<div className="flex items-center justify-between px-3">
							<div className="flex items-center gap-2">
								<SearchCommand variant="mobile" />
								<a
									href={siteConfig.github}
									target="_blank"
									rel="noopener noreferrer"
									className="p-2 text-muted-foreground hover:text-foreground transition-colors"
									aria-label="GitHub"
								>
									<Github className="w-5 h-5" />
								</a>
								<ThemeToggle />
							</div>
						</div>
					</div>
				</div>
			)}
		</header>
	);
}
