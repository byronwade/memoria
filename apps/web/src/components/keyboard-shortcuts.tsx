"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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

export function KeyboardShortcuts({ shortcuts: customShortcuts = [] }: KeyboardShortcutsProps) {
	const router = useRouter();
	const [showHelp, setShowHelp] = useState(false);

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

	const allShortcuts = [...defaultShortcuts, ...customShortcuts];

	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			// Don't trigger shortcuts when typing in inputs
			const target = event.target as HTMLElement;
			if (
				target.tagName === "INPUT" ||
				target.tagName === "TEXTAREA" ||
				target.isContentEditable
			) {
				return;
			}

			for (const shortcut of allShortcuts) {
				const modifiersMatch =
					(!shortcut.modifiers || shortcut.modifiers.length === 0) ||
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

				if (modifiersMatch && event.key.toLowerCase() === shortcut.key.toLowerCase()) {
					event.preventDefault();
					shortcut.action();
					return;
				}
			}
		},
		[allShortcuts]
	);

	useEffect(() => {
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleKeyDown]);

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
				</div>
				<div className="text-xs text-muted-foreground text-center border-t pt-4">
					Press <kbd className="px-1.5 py-0.5 text-xs font-mono bg-muted rounded border">/</kbd> anywhere to show this help
				</div>
			</DialogContent>
		</Dialog>
	);
}
