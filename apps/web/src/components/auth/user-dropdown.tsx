"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
	ChevronsUpDown,
	LogOut,
	Settings,
	LayoutDashboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface UserDropdownProps {
	user: {
		name: string | null;
		email: string;
		avatarUrl: string | null;
	};
	variant?: "header" | "dashboard";
}

export function UserDropdown({ user, variant = "header" }: UserDropdownProps) {
	const router = useRouter();
	const [isLoggingOut, setIsLoggingOut] = useState(false);

	const handleLogout = async () => {
		setIsLoggingOut(true);
		try {
			await fetch("/api/auth/logout", { method: "POST" });
			router.push("/");
			router.refresh();
		} catch (error) {
			console.error("Logout failed:", error);
			setIsLoggingOut(false);
		}
	};

	const displayName = user.name || user.email.split("@")[0];
	const avatarFallback = displayName[0]?.toUpperCase() || "U";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					className="flex items-center gap-2 px-1.5 sm:px-2 h-8 text-sm font-medium"
				>
					{user.avatarUrl ? (
						<img
							src={user.avatarUrl}
							alt=""
							className="h-6 w-6 rounded-sm"
						/>
					) : (
						<div className="h-6 w-6 rounded-sm bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
							{avatarFallback}
						</div>
					)}
					<span className="hidden sm:inline">{displayName}</span>
					<ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56">
				{/* User Info */}
				<div className="px-2.5 py-2.5 border-b border-border/50">
					<div className="flex items-center gap-3">
						{user.avatarUrl ? (
							<img
								src={user.avatarUrl}
								alt=""
								className="h-9 w-9 rounded-sm"
							/>
						) : (
							<div className="h-9 w-9 rounded-sm bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
								{avatarFallback}
							</div>
						)}
						<div className="flex-1 min-w-0">
							<div className="font-medium text-sm">{displayName}</div>
							<div className="text-xs text-muted-foreground truncate">{user.email}</div>
						</div>
					</div>
				</div>

				{/* Navigation */}
				<div className="py-1">
					{variant === "header" && (
						<DropdownMenuItem asChild className="flex items-center gap-2.5 py-2">
							<Link href="/dashboard">
								<LayoutDashboard className="h-4 w-4 text-muted-foreground" />
								<span className="text-foreground">Dashboard</span>
							</Link>
						</DropdownMenuItem>
					)}
					<DropdownMenuItem asChild className="flex items-center gap-2.5 py-2">
						<Link href="/dashboard/settings">
							<Settings className="h-4 w-4 text-muted-foreground" />
							<span className="text-foreground">Settings</span>
						</Link>
					</DropdownMenuItem>
				</div>

				<DropdownMenuSeparator />

				{/* Theme Toggle */}
				<DropdownMenuItem
					className="flex items-center gap-2.5 py-2"
					onSelect={(e) => e.preventDefault()}
				>
					<div className="flex items-center gap-2.5 flex-1">
						<div className="h-4 w-4 text-muted-foreground">
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
								<circle cx="12" cy="12" r="4"/>
								<path d="M12 2v2"/>
								<path d="M12 20v2"/>
								<path d="m4.93 4.93 1.41 1.41"/>
								<path d="m17.66 17.66 1.41 1.41"/>
								<path d="M2 12h2"/>
								<path d="M20 12h2"/>
								<path d="m6.34 17.66-1.41 1.41"/>
								<path d="m19.07 4.93-1.41 1.41"/>
							</svg>
						</div>
						<span className="text-foreground">Theme</span>
					</div>
					<ThemeToggle />
				</DropdownMenuItem>

				<DropdownMenuSeparator />

				{/* Logout */}
				<DropdownMenuItem
					className="flex items-center gap-2.5 py-2 text-destructive focus:text-destructive"
					onClick={handleLogout}
					disabled={isLoggingOut}
				>
					<LogOut className="h-4 w-4" />
					<span>{isLoggingOut ? "Logging out..." : "Logout"}</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
