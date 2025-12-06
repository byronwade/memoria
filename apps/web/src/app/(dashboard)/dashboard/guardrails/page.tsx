"use client";

import {
	AlertTriangle,
	Check,
	ChevronDown,
	Edit2,
	Loader2,
	Plus,
	Shield,
	ShieldAlert,
	ShieldCheck,
	Trash2,
	X,
} from "lucide-react";
import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useDashboard } from "../../dashboard-context";
import type { DashboardGuardrail } from "../../dashboard-data";

type GuardrailLevel = "warn" | "block";
type FilterScope = "all" | "user" | "repo";

export default function GuardrailsPage() {
	const { guardrails, guardrailStats, activeRepos } = useDashboard();

	// Filter state
	const [filterScope, setFilterScope] = useState<FilterScope>("all");
	const [filterRepo, setFilterRepo] = useState<string | null>(null);

	// Modal state
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editingGuardrail, setEditingGuardrail] = useState<DashboardGuardrail | null>(null);
	const [deletingGuardrail, setDeletingGuardrail] = useState<DashboardGuardrail | null>(null);

	// Form state
	const [formPattern, setFormPattern] = useState("");
	const [formLevel, setFormLevel] = useState<GuardrailLevel>("warn");
	const [formMessage, setFormMessage] = useState("");
	const [formRepoId, setFormRepoId] = useState<string | undefined>(undefined);
	const [formEnabled, setFormEnabled] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);

	// Filter guardrails
	const filteredGuardrails = useMemo(() => {
		let result = guardrails;

		if (filterScope === "user") {
			result = result.filter((g) => !g.repoId);
		} else if (filterScope === "repo") {
			result = result.filter((g) => g.repoId);
		}

		if (filterRepo) {
			result = result.filter((g) => g.repoId === filterRepo || !g.repoId);
		}

		return result;
	}, [guardrails, filterScope, filterRepo]);

	// Group guardrails by scope
	const userGuardrails = filteredGuardrails.filter((g) => !g.repoId);
	const repoGuardrails = filteredGuardrails.filter((g) => g.repoId);

	// Reset form
	const resetForm = useCallback(() => {
		setFormPattern("");
		setFormLevel("warn");
		setFormMessage("");
		setFormRepoId(undefined);
		setFormEnabled(true);
	}, []);

	// Open create modal
	const handleOpenCreate = useCallback(() => {
		resetForm();
		setIsCreateOpen(true);
	}, [resetForm]);

	// Open edit modal
	const handleOpenEdit = useCallback((guardrail: DashboardGuardrail) => {
		setFormPattern(guardrail.pattern);
		setFormLevel(guardrail.level);
		setFormMessage(guardrail.message);
		setFormRepoId(guardrail.repoId);
		setFormEnabled(guardrail.isEnabled);
		setEditingGuardrail(guardrail);
	}, []);

	// Create guardrail
	const handleCreate = useCallback(async () => {
		if (!formPattern.trim() || !formMessage.trim()) {
			toast.error("Missing fields", {
				description: "Pattern and message are required.",
			});
			return;
		}

		setIsSubmitting(true);
		try {
			const res = await fetch("/api/guardrails", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					pattern: formPattern.trim(),
					level: formLevel,
					message: formMessage.trim(),
					repoId: formRepoId || undefined,
					isEnabled: formEnabled,
				}),
			});

			if (res.ok) {
				toast.success("Guardrail created", {
					description: `Pattern "${formPattern}" is now ${formEnabled ? "active" : "disabled"}.`,
				});
				setIsCreateOpen(false);
				resetForm();
				// Refresh page to get updated data
				window.location.reload();
			} else {
				const error = await res.json();
				toast.error("Failed to create guardrail", {
					description: error.error || "Please try again.",
				});
			}
		} catch (error) {
			console.error("Failed to create guardrail:", error);
			toast.error("Network error", {
				description: "Could not connect to server.",
			});
		} finally {
			setIsSubmitting(false);
		}
	}, [formPattern, formLevel, formMessage, formRepoId, formEnabled, resetForm]);

	// Update guardrail
	const handleUpdate = useCallback(async () => {
		if (!editingGuardrail || !formPattern.trim() || !formMessage.trim()) {
			toast.error("Missing fields", {
				description: "Pattern and message are required.",
			});
			return;
		}

		setIsSubmitting(true);
		try {
			const res = await fetch(`/api/guardrails/${editingGuardrail._id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					pattern: formPattern.trim(),
					level: formLevel,
					message: formMessage.trim(),
					repoId: formRepoId || undefined,
					isEnabled: formEnabled,
				}),
			});

			if (res.ok) {
				toast.success("Guardrail updated", {
					description: `Pattern "${formPattern}" has been updated.`,
				});
				setEditingGuardrail(null);
				resetForm();
				// Refresh page to get updated data
				window.location.reload();
			} else {
				const error = await res.json();
				toast.error("Failed to update guardrail", {
					description: error.error || "Please try again.",
				});
			}
		} catch (error) {
			console.error("Failed to update guardrail:", error);
			toast.error("Network error", {
				description: "Could not connect to server.",
			});
		} finally {
			setIsSubmitting(false);
		}
	}, [editingGuardrail, formPattern, formLevel, formMessage, formRepoId, formEnabled, resetForm]);

	// Delete guardrail
	const handleDelete = useCallback(async () => {
		if (!deletingGuardrail) return;

		setIsSubmitting(true);
		try {
			const res = await fetch(`/api/guardrails/${deletingGuardrail._id}`, {
				method: "DELETE",
			});

			if (res.ok) {
				toast.success("Guardrail deleted", {
					description: `Pattern "${deletingGuardrail.pattern}" has been removed.`,
				});
				setDeletingGuardrail(null);
				// Refresh page to get updated data
				window.location.reload();
			} else {
				const error = await res.json();
				toast.error("Failed to delete guardrail", {
					description: error.error || "Please try again.",
				});
			}
		} catch (error) {
			console.error("Failed to delete guardrail:", error);
			toast.error("Network error", {
				description: "Could not connect to server.",
			});
		} finally {
			setIsSubmitting(false);
		}
	}, [deletingGuardrail]);

	// Toggle guardrail enabled state
	const handleToggleEnabled = useCallback(async (guardrail: DashboardGuardrail) => {
		try {
			const res = await fetch(`/api/guardrails/${guardrail._id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					isEnabled: !guardrail.isEnabled,
				}),
			});

			if (res.ok) {
				toast.success(guardrail.isEnabled ? "Guardrail disabled" : "Guardrail enabled", {
					description: `Pattern "${guardrail.pattern}" is now ${guardrail.isEnabled ? "disabled" : "active"}.`,
				});
				// Refresh page to get updated data
				window.location.reload();
			} else {
				toast.error("Failed to update guardrail");
			}
		} catch (error) {
			console.error("Failed to toggle guardrail:", error);
			toast.error("Network error");
		}
	}, []);

	// Get repo name by ID
	const getRepoName = useCallback((repoId: string) => {
		const repo = activeRepos.find((r) => r._id === repoId);
		return repo ? repo.fullName.split("/")[1] : "Unknown";
	}, [activeRepos]);

	return (
		<div className="pb-16">
			{/* Header */}
			<div className="max-w-6xl mx-auto px-4 md:px-6 pt-8">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-semibold tracking-tight">Guardrails</h1>
						<p className="text-muted-foreground mt-1">
							Define rules to protect critical files from AI modifications
						</p>
					</div>
					<Button onClick={handleOpenCreate}>
						<Plus className="h-4 w-4 mr-2" />
						Add Guardrail
					</Button>
				</div>
			</div>

			{/* Stats Cards */}
			<div className="max-w-6xl mx-auto px-4 md:px-6 mt-8">
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<div className="p-4 rounded-sm bg-secondary/30 border border-border/50">
						<div className="flex items-center gap-3">
							<div className="w-10 h-10 rounded-sm bg-primary/10 flex items-center justify-center">
								<Shield className="h-5 w-5 text-primary" />
							</div>
							<div>
								<div className="text-2xl font-bold">{guardrailStats?.total ?? 0}</div>
								<div className="text-xs text-muted-foreground">Total Guardrails</div>
							</div>
						</div>
					</div>
					<div className="p-4 rounded-sm bg-secondary/30 border border-border/50">
						<div className="flex items-center gap-3">
							<div className="w-10 h-10 rounded-sm bg-green-500/10 flex items-center justify-center">
								<ShieldCheck className="h-5 w-5 text-green-500" />
							</div>
							<div>
								<div className="text-2xl font-bold">{guardrailStats?.enabled ?? 0}</div>
								<div className="text-xs text-muted-foreground">Active</div>
							</div>
						</div>
					</div>
					<div className="p-4 rounded-sm bg-secondary/30 border border-border/50">
						<div className="flex items-center gap-3">
							<div className="w-10 h-10 rounded-sm bg-red-500/10 flex items-center justify-center">
								<ShieldAlert className="h-5 w-5 text-red-500" />
							</div>
							<div>
								<div className="text-2xl font-bold">{guardrailStats?.blocking ?? 0}</div>
								<div className="text-xs text-muted-foreground">Blocking</div>
							</div>
						</div>
					</div>
					<div className="p-4 rounded-sm bg-secondary/30 border border-border/50">
						<div className="flex items-center gap-3">
							<div className="w-10 h-10 rounded-sm bg-yellow-500/10 flex items-center justify-center">
								<AlertTriangle className="h-5 w-5 text-yellow-500" />
							</div>
							<div>
								<div className="text-2xl font-bold">{guardrailStats?.warning ?? 0}</div>
								<div className="text-xs text-muted-foreground">Warning Only</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Filters */}
			<div className="max-w-6xl mx-auto px-4 md:px-6 mt-6">
				<div className="flex items-center gap-2">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="sm">
								{filterScope === "all" ? "All Scopes" : filterScope === "user" ? "User-Wide Only" : "Repo-Specific Only"}
								<ChevronDown className="h-3.5 w-3.5 ml-2" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start">
							<DropdownMenuItem onClick={() => setFilterScope("all")}>
								All Scopes
								{filterScope === "all" && <Check className="h-4 w-4 ml-auto" />}
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setFilterScope("user")}>
								User-Wide Only
								{filterScope === "user" && <Check className="h-4 w-4 ml-auto" />}
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setFilterScope("repo")}>
								Repo-Specific Only
								{filterScope === "repo" && <Check className="h-4 w-4 ml-auto" />}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>

					{activeRepos.length > 0 && (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" size="sm">
									{filterRepo ? getRepoName(filterRepo) : "All Repositories"}
									<ChevronDown className="h-3.5 w-3.5 ml-2" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start">
								<DropdownMenuItem onClick={() => setFilterRepo(null)}>
									All Repositories
									{!filterRepo && <Check className="h-4 w-4 ml-auto" />}
								</DropdownMenuItem>
								{activeRepos.map((repo) => (
									<DropdownMenuItem key={repo._id} onClick={() => setFilterRepo(repo._id)}>
										{repo.fullName.split("/")[1]}
										{filterRepo === repo._id && <Check className="h-4 w-4 ml-auto" />}
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					)}

					{(filterScope !== "all" || filterRepo) && (
						<Button
							variant="ghost"
							size="sm"
							onClick={() => {
								setFilterScope("all");
								setFilterRepo(null);
							}}
						>
							<X className="h-3.5 w-3.5 mr-1" />
							Clear
						</Button>
					)}
				</div>
			</div>

			{/* Guardrails List */}
			<div className="max-w-6xl mx-auto px-4 md:px-6 mt-6 space-y-8">
				{/* User-Wide Guardrails */}
				{userGuardrails.length > 0 && (
					<section>
						<div className="flex items-center gap-2 mb-4">
							<Shield className="h-4 w-4 text-muted-foreground" />
							<h2 className="text-sm font-medium">All Repositories ({userGuardrails.length})</h2>
						</div>
						<div className="space-y-2">
							{userGuardrails.map((guardrail) => (
								<GuardrailRow
									key={guardrail._id}
									guardrail={guardrail}
									onEdit={handleOpenEdit}
									onDelete={setDeletingGuardrail}
									onToggle={handleToggleEnabled}
								/>
							))}
						</div>
					</section>
				)}

				{/* Repo-Specific Guardrails */}
				{repoGuardrails.length > 0 && (
					<section>
						<div className="flex items-center gap-2 mb-4">
							<Shield className="h-4 w-4 text-muted-foreground" />
							<h2 className="text-sm font-medium">Repository-Specific ({repoGuardrails.length})</h2>
						</div>
						<div className="space-y-2">
							{repoGuardrails.map((guardrail) => (
								<GuardrailRow
									key={guardrail._id}
									guardrail={guardrail}
									repoName={guardrail.repoId ? getRepoName(guardrail.repoId) : undefined}
									onEdit={handleOpenEdit}
									onDelete={setDeletingGuardrail}
									onToggle={handleToggleEnabled}
								/>
							))}
						</div>
					</section>
				)}

				{/* Empty State */}
				{filteredGuardrails.length === 0 && (
					<div className="py-16 text-center">
						<div className="w-16 h-16 rounded-sm bg-secondary/50 border border-dashed border-border/50 flex items-center justify-center mx-auto mb-4">
							<Shield className="h-8 w-8 text-muted-foreground" />
						</div>
						<h3 className="text-lg font-medium mb-2">No guardrails found</h3>
						<p className="text-muted-foreground mb-6 max-w-md mx-auto">
							{filterScope !== "all" || filterRepo
								? "Try adjusting your filters or create a new guardrail."
								: "Create your first guardrail to protect critical files from AI modifications."}
						</p>
						<Button onClick={handleOpenCreate}>
							<Plus className="h-4 w-4 mr-2" />
							Create Guardrail
						</Button>
					</div>
				)}
			</div>

			{/* Create Modal */}
			<Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Create Guardrail</DialogTitle>
						<DialogDescription>
							Define a pattern to protect files from AI modifications.
						</DialogDescription>
					</DialogHeader>
					<GuardrailForm
						pattern={formPattern}
						setPattern={setFormPattern}
						level={formLevel}
						setLevel={setFormLevel}
						message={formMessage}
						setMessage={setFormMessage}
						repoId={formRepoId}
						setRepoId={setFormRepoId}
						enabled={formEnabled}
						setEnabled={setFormEnabled}
						repos={activeRepos}
					/>
					<DialogFooter>
						<Button variant="outline" onClick={() => setIsCreateOpen(false)}>
							Cancel
						</Button>
						<Button onClick={handleCreate} disabled={isSubmitting}>
							{isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
							Create Guardrail
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Edit Modal */}
			<Dialog open={!!editingGuardrail} onOpenChange={(open) => !open && setEditingGuardrail(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Edit Guardrail</DialogTitle>
						<DialogDescription>
							Update the guardrail configuration.
						</DialogDescription>
					</DialogHeader>
					<GuardrailForm
						pattern={formPattern}
						setPattern={setFormPattern}
						level={formLevel}
						setLevel={setFormLevel}
						message={formMessage}
						setMessage={setFormMessage}
						repoId={formRepoId}
						setRepoId={setFormRepoId}
						enabled={formEnabled}
						setEnabled={setFormEnabled}
						repos={activeRepos}
					/>
					<DialogFooter>
						<Button variant="outline" onClick={() => setEditingGuardrail(null)}>
							Cancel
						</Button>
						<Button onClick={handleUpdate} disabled={isSubmitting}>
							{isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
							Save Changes
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Delete Confirmation Modal */}
			<Dialog open={!!deletingGuardrail} onOpenChange={(open) => !open && setDeletingGuardrail(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Guardrail</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete this guardrail? This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					{deletingGuardrail && (
						<div className="p-3 bg-destructive/10 border border-destructive/20 rounded-sm">
							<div className="font-mono text-sm">{deletingGuardrail.pattern}</div>
							<div className="text-xs text-muted-foreground mt-1">{deletingGuardrail.message}</div>
						</div>
					)}
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeletingGuardrail(null)}>
							Cancel
						</Button>
						<Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
							{isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
							Delete Guardrail
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

// Guardrail Row Component
interface GuardrailRowProps {
	guardrail: DashboardGuardrail;
	repoName?: string;
	onEdit: (guardrail: DashboardGuardrail) => void;
	onDelete: (guardrail: DashboardGuardrail) => void;
	onToggle: (guardrail: DashboardGuardrail) => void;
}

function GuardrailRow({ guardrail, repoName, onEdit, onDelete, onToggle }: GuardrailRowProps) {
	return (
		<div
			className={`flex items-center gap-4 p-4 rounded-sm border transition-colors ${
				guardrail.isEnabled
					? guardrail.level === "block"
						? "bg-red-500/5 border-red-500/20"
						: "bg-yellow-500/5 border-yellow-500/20"
					: "bg-secondary/30 border-border/50 opacity-60"
			}`}
		>
			<div className="w-10 h-10 rounded-sm flex items-center justify-center shrink-0 bg-background/50 border border-border/50">
				{guardrail.level === "block" ? (
					<ShieldAlert className="h-5 w-5 text-red-500" />
				) : (
					<AlertTriangle className="h-5 w-5 text-yellow-500" />
				)}
			</div>
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2">
					<code className="font-mono text-sm font-medium truncate">{guardrail.pattern}</code>
					<span
						className={`px-1.5 py-0.5 text-[10px] font-medium rounded-sm ${
							guardrail.level === "block"
								? "bg-red-500/20 text-red-600"
								: "bg-yellow-500/20 text-yellow-600"
						}`}
					>
						{guardrail.level.toUpperCase()}
					</span>
					{repoName && (
						<span className="px-1.5 py-0.5 text-[10px] bg-secondary/50 text-muted-foreground rounded-sm">
							{repoName}
						</span>
					)}
					{!guardrail.isEnabled && (
						<span className="px-1.5 py-0.5 text-[10px] bg-secondary/50 text-muted-foreground rounded-sm">
							DISABLED
						</span>
					)}
				</div>
				<div className="text-xs text-muted-foreground mt-1 truncate">{guardrail.message}</div>
				<div className="text-xs text-muted-foreground mt-0.5">
					Created by {guardrail.creatorName} on{" "}
					{new Date(guardrail.createdAt).toLocaleDateString("en-US", {
						month: "short",
						day: "numeric",
						year: "numeric",
					})}
				</div>
			</div>
			<div className="flex items-center gap-2">
				<Switch
					checked={guardrail.isEnabled}
					onCheckedChange={() => onToggle(guardrail)}
					aria-label={`Toggle ${guardrail.pattern}`}
				/>
				<Button variant="ghost" size="sm" onClick={() => onEdit(guardrail)}>
					<Edit2 className="h-4 w-4" />
				</Button>
				<Button
					variant="ghost"
					size="sm"
					className="text-destructive hover:text-destructive hover:bg-destructive/10"
					onClick={() => onDelete(guardrail)}
				>
					<Trash2 className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}

// Guardrail Form Component
interface GuardrailFormProps {
	pattern: string;
	setPattern: (v: string) => void;
	level: GuardrailLevel;
	setLevel: (v: GuardrailLevel) => void;
	message: string;
	setMessage: (v: string) => void;
	repoId: string | undefined;
	setRepoId: (v: string | undefined) => void;
	enabled: boolean;
	setEnabled: (v: boolean) => void;
	repos: Array<{ _id: string; fullName: string }>;
}

function GuardrailForm({
	pattern,
	setPattern,
	level,
	setLevel,
	message,
	setMessage,
	repoId,
	setRepoId,
	enabled,
	setEnabled,
	repos,
}: GuardrailFormProps) {
	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="pattern">Pattern (glob)</Label>
				<Input
					id="pattern"
					value={pattern}
					onChange={(e) => setPattern(e.target.value)}
					placeholder="src/auth/** or *.config.ts"
					className="font-mono"
				/>
				<p className="text-xs text-muted-foreground">
					Use glob patterns like <code>src/auth/**</code> or <code>*.config.ts</code>
				</p>
			</div>

			<div className="space-y-2">
				<Label htmlFor="level">Enforcement Level</Label>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" className="w-full justify-between">
							{level === "block" ? (
								<span className="flex items-center gap-2">
									<ShieldAlert className="h-4 w-4 text-red-500" />
									Block
								</span>
							) : (
								<span className="flex items-center gap-2">
									<AlertTriangle className="h-4 w-4 text-yellow-500" />
									Warn
								</span>
							)}
							<ChevronDown className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]">
						<DropdownMenuItem onClick={() => setLevel("warn")}>
							<AlertTriangle className="h-4 w-4 mr-2 text-yellow-500" />
							Warn - Show warning but allow changes
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => setLevel("block")}>
							<ShieldAlert className="h-4 w-4 mr-2 text-red-500" />
							Block - Prevent AI from making changes
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			<div className="space-y-2">
				<Label htmlFor="message">Message</Label>
				<Textarea
					id="message"
					value={message}
					onChange={(e) => setMessage(e.target.value)}
					placeholder="Explain why this pattern is protected..."
					rows={3}
				/>
				<p className="text-xs text-muted-foreground">
					This message will be shown to AI tools when they try to modify matching files.
				</p>
			</div>

			<div className="space-y-2">
				<Label htmlFor="scope">Scope</Label>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" className="w-full justify-between">
							{repoId
								? repos.find((r) => r._id === repoId)?.fullName.split("/")[1] || "Unknown"
								: "All repositories"}
							<ChevronDown className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]">
						<DropdownMenuItem onClick={() => setRepoId(undefined)}>
							All repositories
						</DropdownMenuItem>
						{repos.map((repo) => (
							<DropdownMenuItem key={repo._id} onClick={() => setRepoId(repo._id)}>
								{repo.fullName.split("/")[1]}
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			<div className="flex items-center justify-between py-2">
				<div>
					<div className="text-sm font-medium">Enabled</div>
					<div className="text-xs text-muted-foreground">This guardrail is currently active</div>
				</div>
				<Switch checked={enabled} onCheckedChange={setEnabled} />
			</div>
		</div>
	);
}
