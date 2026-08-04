"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

interface Shortcut {
	key: string;
	description: string;
	action: () => void;
	modifiers?: ("meta" | "ctrl" | "alt" | "shift")[];
}

interface KeyboardShortcutsProps {
	shortcuts?: Shortcut[];
}

export function KeyboardShortcuts({
	shortcuts: customShortcuts = [],
}: KeyboardShortcutsProps) {
	const router = useRouter();
	const { resolvedTheme, setTheme } = useTheme();
	const [showHelp, setShowHelp] = useState(false);

	const allShortcuts = useMemo(() => {
		const defaultShortcuts: Shortcut[] = [
			{
				key: "g",
				description: "Go to dashboard",
				modifiers: ["meta"],
				action: () => router.push("/dashboard"),
			},
			{
				key: "s",
				description: "Go to settings",
				modifiers: ["meta"],
				action: () => router.push("/dashboard/settings"),
			},
			{
				key: "d",
				description: "Toggle theme",
				modifiers: ["meta", "shift"],
				action: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
			},
			{
				key: "/",
				description: "Show keyboard shortcuts",
				action: () => setShowHelp(true),
			},
			{
				key: "Escape",
				description: "Close dialogs",
				action: () => setShowHelp(false),
			},
		];
		return [...defaultShortcuts, ...customShortcuts];
	}, [customShortcuts, router, resolvedTheme, setTheme]);

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			// Skip when focus is in form fields or contenteditable
			const target = event.target as HTMLElement | null;
			if (
				target?.tagName === "INPUT" ||
				target?.tagName === "TEXTAREA" ||
				target?.tagName === "SELECT" ||
				target?.isContentEditable
			) {
				return;
			}

			const key = event.key.toLowerCase();

			// Theme toggle: bare "d" or Cmd/Ctrl+Shift+D
			if (key === "d") {
				const bareD =
					!event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
				const modShiftD = (event.metaKey || event.ctrlKey) && event.shiftKey;
				if (bareD || modShiftD) {
					event.preventDefault();
					setTheme(resolvedTheme === "dark" ? "light" : "dark");
					return;
				}
			}

			for (const shortcut of allShortcuts) {
				if (shortcut.key.toLowerCase() === "d") {
					continue;
				}

				const modifiersMatch =
					!shortcut.modifiers ||
					shortcut.modifiers.length === 0 ||
					shortcut.modifiers.every((mod) => {
						switch (mod) {
							case "meta":
								return event.metaKey || event.ctrlKey;
							case "ctrl":
								return event.ctrlKey;
							case "alt":
								return event.altKey;
							case "shift":
								return event.shiftKey;
							default:
								return false;
						}
					});

				if (modifiersMatch && key === shortcut.key.toLowerCase()) {
					event.preventDefault();
					shortcut.action();
					return;
				}
			}
		}

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [allShortcuts, resolvedTheme, setTheme]);

	const formatShortcut = (shortcut: Shortcut) => {
		const parts: string[] = [];
		if (shortcut.modifiers?.includes("meta")) parts.push("⌘");
		if (shortcut.modifiers?.includes("ctrl")) parts.push("Ctrl");
		if (shortcut.modifiers?.includes("alt")) parts.push("Alt");
		if (shortcut.modifiers?.includes("shift")) parts.push("⇧");
		parts.push(shortcut.key.toUpperCase());
		return parts.join(" + ");
	};

	return (
		<Dialog open={showHelp} onOpenChange={setShowHelp}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Keyboard Shortcuts</DialogTitle>
					<DialogDescription>
						Press these keys to quickly navigate the dashboard.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-3 py-4">
					{allShortcuts
						.filter((s) => s.key !== "Escape")
						.map((shortcut) => (
							<div
								key={`${shortcut.modifiers?.join("-")}-${shortcut.key}`}
								className="flex items-center justify-between"
							>
								<span className="text-sm text-muted-foreground">
									{shortcut.description}
								</span>
								<kbd className="px-2 py-1 text-xs font-mono bg-muted rounded-md border">
									{formatShortcut(shortcut)}
								</kbd>
							</div>
						))}
					<div className="flex items-center justify-between">
						<span className="text-sm text-muted-foreground">Toggle theme</span>
						<kbd className="px-2 py-1 text-xs font-mono bg-muted rounded-md border">
							D
						</kbd>
					</div>
				</div>
				<div className="text-xs text-muted-foreground text-center border-t pt-4">
					Press{" "}
					<kbd className="px-1.5 py-0.5 text-xs font-mono bg-muted rounded border">
						/
					</kbd>{" "}
					anywhere to show this help
				</div>
			</DialogContent>
		</Dialog>
	);
}
