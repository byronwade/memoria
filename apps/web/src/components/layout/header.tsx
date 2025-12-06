import { Github } from "lucide-react";
import Link from "next/link";
import { SearchCommand } from "@/components/search-command";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { siteConfig } from "@/lib/seo/constants";
import { HeaderAuth } from "@/components/auth/header-auth";
import { HeaderClient } from "./header-client";

const navLinks = [
	{ href: "/pricing", label: "Pricing" },
	{ href: "/docs", label: "Docs" },
	{ href: "/faq", label: "FAQ" },
];

export async function Header() {
	return (
		<HeaderClient navLinks={navLinks}>
			{/* Search */}
			<div className="hidden md:block">
				<SearchCommand />
			</div>

			{/* GitHub */}
			<a
				href={siteConfig.github}
				target="_blank"
				rel="noopener noreferrer"
				className="hidden md:flex items-center justify-center w-8 h-8 text-muted-foreground hover:text-foreground transition-colors rounded-sm hover:bg-secondary/50"
				aria-label="GitHub"
			>
				<Github className="w-4 h-4" />
			</a>

			{/* Theme Toggle - Hidden when logged in (it's in the user dropdown) */}
			<div className="hidden md:block">
				<ThemeToggle />
			</div>

			{/* Auth Section (Login/Register or User Dropdown) */}
			<HeaderAuth />
		</HeaderClient>
	);
}
