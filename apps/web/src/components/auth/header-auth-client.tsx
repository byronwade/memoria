"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { UserDropdown } from "./user-dropdown";

interface HeaderAuthClientProps {
	user: {
		_id: string;
		name: string | null;
		email: string;
		avatarUrl: string | null;
	} | null;
}

export function HeaderAuthClient({ user }: HeaderAuthClientProps) {
	if (user) {
		return <UserDropdown user={user} variant="header" />;
	}

	return (
		<>
			{/* Login */}
			<Link
				href="/login"
				className="hidden md:block px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
			>
				Login
			</Link>

			{/* CTA Button */}
			<Button
				size="sm"
				variant="cta"
				className="h-8 px-4"
				asChild
			>
				<Link href="/register">Get Started</Link>
			</Button>
		</>
	);
}

export function HeaderAuthMobile({ user }: HeaderAuthClientProps) {
	if (user) {
		return (
			<>
				<Link
					href="/dashboard"
					className="px-3 py-2.5 text-foreground hover:bg-secondary/50 rounded-sm transition-colors"
				>
					Dashboard
				</Link>
				<Link
					href="/dashboard/settings"
					className="px-3 py-2.5 text-foreground hover:bg-secondary/50 rounded-sm transition-colors"
				>
					Settings
				</Link>
				<a
					href="/api/auth/logout"
					className="px-3 py-2.5 text-destructive hover:bg-secondary/50 rounded-sm transition-colors"
				>
					Logout
				</a>
			</>
		);
	}

	return (
		<Link
			href="/login"
			className="px-3 py-2.5 text-foreground hover:bg-secondary/50 rounded-sm transition-colors"
		>
			Login
		</Link>
	);
}
