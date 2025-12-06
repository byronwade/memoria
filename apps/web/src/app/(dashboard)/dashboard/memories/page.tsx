"use client";

import {
	Brain,
	Check,
	ChevronDown,
	Edit2,
	FileText,
	Loader2,
	Plus,
	Tag,
	Trash2,
	X,
} from "lucide-react";
import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import type { DashboardMemory } from "../../dashboard-data";

type FilterScope = "all" | "org" | "repo";

export default function MemoriesPage() {
	const { memories, activeRepos } = useDashboard();

	// Filter state
	const [filterScope, setFilterScope] = useState<FilterScope>("all");
	const [filterRepo, setFilterRepo] = useState<string | null>(null);
	const [filterTag, setFilterTag] = useState<string | null>(null);

	// Modal state
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editingMemory, setEditingMemory] = useState<DashboardMemory | null>(null);
	const [deletingMemory, setDeletingMemory] = useState<DashboardMemory | null>(null);

	// Form state
	const [formContext, setFormContext] = useState("");
	const [formTags, setFormTags] = useState<string[]>([]);
	const [formTagInput, setFormTagInput] = useState("");
	const [formLinkedFiles, setFormLinkedFiles] = useState<string[]>([]);
	const [formFileInput, setFormFileInput] = useState("");
	const [formRepoId, setFormRepoId] = useState<string | undefined>(undefined);
	const [isSubmitting, setIsSubmitting] = useState(false);

	// Get all unique tags
	const allTags = useMemo(() => {
		const tags = new Set<string>();
		memories.forEach((m) => m.tags.forEach((t) => tags.add(t)));
		return Array.from(tags).sort();
	}, [memories]);

	// Filter memories
	const filteredMemories = useMemo(() => {
		let result = memories;

		if (filterScope === "org") {
			result = result.filter((m) => !m.repoId);
		} else if (filterScope === "repo") {
			result = result.filter((m) => m.repoId);
		}

		if (filterRepo) {
			result = result.filter((m) => m.repoId === filterRepo || !m.repoId);
		}

		if (filterTag) {
			result = result.filter((m) => m.tags.includes(filterTag));
		}

		return result;
	}, [memories, filterScope, filterRepo, filterTag]);

	// Group memories by scope
	const orgMemories = filteredMemories.filter((m) => !m.repoId);
	const repoMemories = filteredMemories.filter((m) => m.repoId);

	// Reset form
	const resetForm = useCallback(() => {
		setFormContext("");
		setFormTags([]);
		setFormTagInput("");
		setFormLinkedFiles([]);
		setFormFileInput("");
		setFormRepoId(undefined);
	}, []);

	// Open create modal
	const handleOpenCreate = useCallback(() => {
		resetForm();
		setIsCreateOpen(true);
	}, [resetForm]);

	// Open edit modal
	const handleOpenEdit = useCallback((memory: DashboardMemory) => {
		setFormContext(memory.context);
		setFormTags(memory.tags);
		setFormLinkedFiles(memory.linkedFiles);
		setFormRepoId(memory.repoId);
		setEditingMemory(memory);
	}, []);

	// Add tag
	const handleAddTag = useCallback(() => {
		const tag = formTagInput.trim().toLowerCase();
		if (tag && !formTags.includes(tag)) {
			setFormTags([...formTags, tag]);
		}
		setFormTagInput("");
	}, [formTagInput, formTags]);

	// Remove tag
	const handleRemoveTag = useCallback((tag: string) => {
		setFormTags(formTags.filter((t) => t !== tag));
	}, [formTags]);

	// Add linked file
	const handleAddFile = useCallback(() => {
		const file = formFileInput.trim();
		if (file && !formLinkedFiles.includes(file)) {
			setFormLinkedFiles([...formLinkedFiles, file]);
		}
		setFormFileInput("");
	}, [formFileInput, formLinkedFiles]);

	// Remove linked file
	const handleRemoveFile = useCallback((file: string) => {
		setFormLinkedFiles(formLinkedFiles.filter((f) => f !== file));
	}, [formLinkedFiles]);

	// Create memory
	const handleCreate = useCallback(async () => {
		if (!formContext.trim()) {
			toast.error("Missing context", {
				description: "Please provide context for this memory.",
			});
			return;
		}

		setIsSubmitting(true);
		try {
			const res = await fetch("/api/memories", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					context: formContext.trim(),
					tags: formTags,
					linkedFiles: formLinkedFiles,
					repoId: formRepoId || undefined,
				}),
			});

			if (res.ok) {
				toast.success("Memory created", {
					description: "Your AI context has been saved.",
				});
				setIsCreateOpen(false);
				resetForm();
				// Refresh page to get updated data
				window.location.reload();
			} else {
				const error = await res.json();
				toast.error("Failed to create memory", {
					description: error.error || "Please try again.",
				});
			}
		} catch (error) {
			console.error("Failed to create memory:", error);
			toast.error("Network error", {
				description: "Could not connect to server.",
			});
		} finally {
			setIsSubmitting(false);
		}
	}, [formContext, formTags, formLinkedFiles, formRepoId, resetForm]);

	// Update memory
	const handleUpdate = useCallback(async () => {
		if (!editingMemory || !formContext.trim()) {
			toast.error("Missing context", {
				description: "Please provide context for this memory.",
			});
			return;
		}

		setIsSubmitting(true);
		try {
			const res = await fetch(`/api/memories/${editingMemory._id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					context: formContext.trim(),
					tags: formTags,
					linkedFiles: formLinkedFiles,
					repoId: formRepoId || undefined,
				}),
			});

			if (res.ok) {
				toast.success("Memory updated", {
					description: "Your changes have been saved.",
				});
				setEditingMemory(null);
				resetForm();
				// Refresh page to get updated data
				window.location.reload();
			} else {
				const error = await res.json();
				toast.error("Failed to update memory", {
					description: error.error || "Please try again.",
				});
			}
		} catch (error) {
			console.error("Failed to update memory:", error);
			toast.error("Network error", {
				description: "Could not connect to server.",
			});
		} finally {
			setIsSubmitting(false);
		}
	}, [editingMemory, formContext, formTags, formLinkedFiles, formRepoId, resetForm]);

	// Delete memory
	const handleDelete = useCallback(async () => {
		if (!deletingMemory) return;

		setIsSubmitting(true);
		try {
			const res = await fetch(`/api/memories/${deletingMemory._id}`, {
				method: "DELETE",
			});

			if (res.ok) {
				toast.success("Memory deleted", {
					description: "The memory has been removed.",
				});
				setDeletingMemory(null);
				// Refresh page to get updated data
				window.location.reload();
			} else {
				const error = await res.json();
				toast.error("Failed to delete memory", {
					description: error.error || "Please try again.",
				});
			}
		} catch (error) {
			console.error("Failed to delete memory:", error);
			toast.error("Network error", {
				description: "Could not connect to server.",
			});
		} finally {
			setIsSubmitting(false);
		}
	}, [deletingMemory]);

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
						<h1 className="text-2xl font-semibold tracking-tight">Memories</h1>
						<p className="text-muted-foreground mt-1">
							Provide context and knowledge for your AI assistants
						</p>
					</div>
					<Button onClick={handleOpenCreate}>
						<Plus className="h-4 w-4 mr-2" />
						Add Memory
					</Button>
				</div>
			</div>

			{/* Stats Cards */}
			<div className="max-w-6xl mx-auto px-4 md:px-6 mt-8">
				<div className="grid gap-4 sm:grid-cols-3">
					<div className="p-4 rounded-sm bg-secondary/30 border border-border/50">
						<div className="flex items-center gap-3">
							<div className="w-10 h-10 rounded-sm bg-primary/10 flex items-center justify-center">
								<Brain className="h-5 w-5 text-primary" />
							</div>
							<div>
								<div className="text-2xl font-bold">{memories.length}</div>
								<div className="text-xs text-muted-foreground">Total Memories</div>
							</div>
						</div>
					</div>
					<div className="p-4 rounded-sm bg-secondary/30 border border-border/50">
						<div className="flex items-center gap-3">
							<div className="w-10 h-10 rounded-sm bg-blue-500/10 flex items-center justify-center">
								<Tag className="h-5 w-5 text-blue-500" />
							</div>
							<div>
								<div className="text-2xl font-bold">{allTags.length}</div>
								<div className="text-xs text-muted-foreground">Unique Tags</div>
							</div>
						</div>
					</div>
					<div className="p-4 rounded-sm bg-secondary/30 border border-border/50">
						<div className="flex items-center gap-3">
							<div className="w-10 h-10 rounded-sm bg-green-500/10 flex items-center justify-center">
								<FileText className="h-5 w-5 text-green-500" />
							</div>
							<div>
								<div className="text-2xl font-bold">
									{memories.reduce((acc, m) => acc + m.linkedFiles.length, 0)}
								</div>
								<div className="text-xs text-muted-foreground">Linked Files</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Filters */}
			<div className="max-w-6xl mx-auto px-4 md:px-6 mt-6">
				<div className="flex items-center gap-2 flex-wrap">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="sm">
								{filterScope === "all" ? "All Scopes" : filterScope === "org" ? "Org-Wide Only" : "Repo-Specific Only"}
								<ChevronDown className="h-3.5 w-3.5 ml-2" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start">
							<DropdownMenuItem onClick={() => setFilterScope("all")}>
								All Scopes
								{filterScope === "all" && <Check className="h-4 w-4 ml-auto" />}
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setFilterScope("org")}>
								Org-Wide Only
								{filterScope === "org" && <Check className="h-4 w-4 ml-auto" />}
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

					{allTags.length > 0 && (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" size="sm">
									{filterTag || "All Tags"}
									<ChevronDown className="h-3.5 w-3.5 ml-2" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start">
								<DropdownMenuItem onClick={() => setFilterTag(null)}>
									All Tags
									{!filterTag && <Check className="h-4 w-4 ml-auto" />}
								</DropdownMenuItem>
								{allTags.map((tag) => (
									<DropdownMenuItem key={tag} onClick={() => setFilterTag(tag)}>
										{tag}
										{filterTag === tag && <Check className="h-4 w-4 ml-auto" />}
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					)}

					{(filterScope !== "all" || filterRepo || filterTag) && (
						<Button
							variant="ghost"
							size="sm"
							onClick={() => {
								setFilterScope("all");
								setFilterRepo(null);
								setFilterTag(null);
							}}
						>
							<X className="h-3.5 w-3.5 mr-1" />
							Clear
						</Button>
					)}
				</div>
			</div>

			{/* Memories List */}
			<div className="max-w-6xl mx-auto px-4 md:px-6 mt-6 space-y-8">
				{/* Org-Wide Memories */}
				{orgMemories.length > 0 && (
					<section>
						<div className="flex items-center gap-2 mb-4">
							<Brain className="h-4 w-4 text-muted-foreground" />
							<h2 className="text-sm font-medium">Organization-Wide ({orgMemories.length})</h2>
						</div>
						<div className="space-y-3">
							{orgMemories.map((memory) => (
								<MemoryCard
									key={memory._id}
									memory={memory}
									onEdit={handleOpenEdit}
									onDelete={setDeletingMemory}
								/>
							))}
						</div>
					</section>
				)}

				{/* Repo-Specific Memories */}
				{repoMemories.length > 0 && (
					<section>
						<div className="flex items-center gap-2 mb-4">
							<Brain className="h-4 w-4 text-muted-foreground" />
							<h2 className="text-sm font-medium">Repository-Specific ({repoMemories.length})</h2>
						</div>
						<div className="space-y-3">
							{repoMemories.map((memory) => (
								<MemoryCard
									key={memory._id}
									memory={memory}
									repoName={memory.repoId ? getRepoName(memory.repoId) : undefined}
									onEdit={handleOpenEdit}
									onDelete={setDeletingMemory}
								/>
							))}
						</div>
					</section>
				)}

				{/* Empty State */}
				{filteredMemories.length === 0 && (
					<div className="py-16 text-center">
						<div className="w-16 h-16 rounded-sm bg-secondary/50 border border-dashed border-border/50 flex items-center justify-center mx-auto mb-4">
							<Brain className="h-8 w-8 text-muted-foreground" />
						</div>
						<h3 className="text-lg font-medium mb-2">No memories found</h3>
						<p className="text-muted-foreground mb-6 max-w-md mx-auto">
							{filterScope !== "all" || filterRepo || filterTag
								? "Try adjusting your filters or create a new memory."
								: "Create your first memory to provide context and knowledge for AI assistants."}
						</p>
						<Button onClick={handleOpenCreate}>
							<Plus className="h-4 w-4 mr-2" />
							Create Memory
						</Button>
					</div>
				)}
			</div>

			{/* Create Modal */}
			<Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle>Create Memory</DialogTitle>
						<DialogDescription>
							Add context or knowledge that AI assistants should consider when working in your codebase.
						</DialogDescription>
					</DialogHeader>
					<MemoryForm
						context={formContext}
						setContext={setFormContext}
						tags={formTags}
						tagInput={formTagInput}
						setTagInput={setFormTagInput}
						onAddTag={handleAddTag}
						onRemoveTag={handleRemoveTag}
						linkedFiles={formLinkedFiles}
						fileInput={formFileInput}
						setFileInput={setFormFileInput}
						onAddFile={handleAddFile}
						onRemoveFile={handleRemoveFile}
						repoId={formRepoId}
						setRepoId={setFormRepoId}
						repos={activeRepos}
					/>
					<DialogFooter>
						<Button variant="outline" onClick={() => setIsCreateOpen(false)}>
							Cancel
						</Button>
						<Button onClick={handleCreate} disabled={isSubmitting}>
							{isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
							Create Memory
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Edit Modal */}
			<Dialog open={!!editingMemory} onOpenChange={(open) => !open && setEditingMemory(null)}>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle>Edit Memory</DialogTitle>
						<DialogDescription>
							Update the memory content and settings.
						</DialogDescription>
					</DialogHeader>
					<MemoryForm
						context={formContext}
						setContext={setFormContext}
						tags={formTags}
						tagInput={formTagInput}
						setTagInput={setFormTagInput}
						onAddTag={handleAddTag}
						onRemoveTag={handleRemoveTag}
						linkedFiles={formLinkedFiles}
						fileInput={formFileInput}
						setFileInput={setFormFileInput}
						onAddFile={handleAddFile}
						onRemoveFile={handleRemoveFile}
						repoId={formRepoId}
						setRepoId={setFormRepoId}
						repos={activeRepos}
					/>
					<DialogFooter>
						<Button variant="outline" onClick={() => setEditingMemory(null)}>
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
			<Dialog open={!!deletingMemory} onOpenChange={(open) => !open && setDeletingMemory(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Memory</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete this memory? This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					{deletingMemory && (
						<div className="p-3 bg-destructive/10 border border-destructive/20 rounded-sm">
							<div className="text-sm line-clamp-3">{deletingMemory.context}</div>
							{deletingMemory.tags.length > 0 && (
								<div className="flex flex-wrap gap-1 mt-2">
									{deletingMemory.tags.map((tag) => (
										<span
											key={tag}
											className="px-1.5 py-0.5 text-[10px] bg-secondary/50 rounded-sm"
										>
											{tag}
										</span>
									))}
								</div>
							)}
						</div>
					)}
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeletingMemory(null)}>
							Cancel
						</Button>
						<Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
							{isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
							Delete Memory
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

// Memory Card Component
interface MemoryCardProps {
	memory: DashboardMemory;
	repoName?: string;
	onEdit: (memory: DashboardMemory) => void;
	onDelete: (memory: DashboardMemory) => void;
}

function MemoryCard({ memory, repoName, onEdit, onDelete }: MemoryCardProps) {
	return (
		<div className="p-4 rounded-sm bg-secondary/30 border border-border/50">
			<div className="flex items-start gap-4">
				<div className="w-10 h-10 rounded-sm bg-primary/10 flex items-center justify-center shrink-0">
					<Brain className="h-5 w-5 text-primary" />
				</div>
				<div className="flex-1 min-w-0">
					<div className="text-sm whitespace-pre-wrap">{memory.context}</div>

					{/* Tags */}
					{memory.tags.length > 0 && (
						<div className="flex flex-wrap gap-1 mt-3">
							{memory.tags.map((tag) => (
								<span
									key={tag}
									className="px-2 py-0.5 text-xs bg-blue-500/10 text-blue-600 border border-blue-500/20 rounded-sm"
								>
									{tag}
								</span>
							))}
						</div>
					)}

					{/* Linked Files */}
					{memory.linkedFiles.length > 0 && (
						<div className="mt-3 space-y-1">
							<div className="text-xs text-muted-foreground">Linked files:</div>
							<div className="flex flex-wrap gap-1">
								{memory.linkedFiles.map((file) => (
									<span
										key={file}
										className="px-2 py-0.5 text-xs font-mono bg-secondary/50 border border-border/50 rounded-sm"
									>
										{file}
									</span>
								))}
							</div>
						</div>
					)}

					{/* Meta */}
					<div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
						{repoName && (
							<span className="px-1.5 py-0.5 bg-secondary/50 rounded-sm">
								{repoName}
							</span>
						)}
						<span>
							Created by {memory.creatorName} on{" "}
							{new Date(memory.createdAt).toLocaleDateString("en-US", {
								month: "short",
								day: "numeric",
								year: "numeric",
							})}
						</span>
					</div>
				</div>
				<div className="flex items-center gap-1">
					<Button variant="ghost" size="sm" onClick={() => onEdit(memory)}>
						<Edit2 className="h-4 w-4" />
					</Button>
					<Button
						variant="ghost"
						size="sm"
						className="text-destructive hover:text-destructive hover:bg-destructive/10"
						onClick={() => onDelete(memory)}
					>
						<Trash2 className="h-4 w-4" />
					</Button>
				</div>
			</div>
		</div>
	);
}

// Memory Form Component
interface MemoryFormProps {
	context: string;
	setContext: (v: string) => void;
	tags: string[];
	tagInput: string;
	setTagInput: (v: string) => void;
	onAddTag: () => void;
	onRemoveTag: (tag: string) => void;
	linkedFiles: string[];
	fileInput: string;
	setFileInput: (v: string) => void;
	onAddFile: () => void;
	onRemoveFile: (file: string) => void;
	repoId: string | undefined;
	setRepoId: (v: string | undefined) => void;
	repos: Array<{ _id: string; fullName: string }>;
}

function MemoryForm({
	context,
	setContext,
	tags,
	tagInput,
	setTagInput,
	onAddTag,
	onRemoveTag,
	linkedFiles,
	fileInput,
	setFileInput,
	onAddFile,
	onRemoveFile,
	repoId,
	setRepoId,
	repos,
}: MemoryFormProps) {
	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="context">Context</Label>
				<Textarea
					id="context"
					value={context}
					onChange={(e) => setContext(e.target.value)}
					placeholder="Provide context or knowledge for AI assistants...

Example: 'The payment module uses a retry queue for failed transactions. Never delete records from payments table - always soft delete using deleted_at field.'"
					rows={5}
				/>
				<p className="text-xs text-muted-foreground">
					This context will be provided to AI assistants when they work on your codebase.
				</p>
			</div>

			<div className="space-y-2">
				<Label>Tags</Label>
				<div className="flex items-center gap-2">
					<Input
						value={tagInput}
						onChange={(e) => setTagInput(e.target.value)}
						placeholder="Add tag..."
						onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onAddTag())}
					/>
					<Button variant="outline" onClick={onAddTag} type="button">
						<Plus className="h-4 w-4" />
					</Button>
				</div>
				{tags.length > 0 && (
					<div className="flex flex-wrap gap-1 mt-2">
						{tags.map((tag) => (
							<span
								key={tag}
								className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-500/10 text-blue-600 border border-blue-500/20 rounded-sm"
							>
								{tag}
								<button
									type="button"
									onClick={() => onRemoveTag(tag)}
									className="hover:text-blue-800"
								>
									<X className="h-3 w-3" />
								</button>
							</span>
						))}
					</div>
				)}
			</div>

			<div className="space-y-2">
				<Label>Linked Files (optional)</Label>
				<div className="flex items-center gap-2">
					<Input
						value={fileInput}
						onChange={(e) => setFileInput(e.target.value)}
						placeholder="src/payments/queue.ts"
						className="font-mono"
						onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onAddFile())}
					/>
					<Button variant="outline" onClick={onAddFile} type="button">
						<Plus className="h-4 w-4" />
					</Button>
				</div>
				{linkedFiles.length > 0 && (
					<div className="flex flex-wrap gap-1 mt-2">
						{linkedFiles.map((file) => (
							<span
								key={file}
								className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono bg-secondary/50 border border-border/50 rounded-sm"
							>
								{file}
								<button
									type="button"
									onClick={() => onRemoveFile(file)}
									className="hover:text-foreground"
								>
									<X className="h-3 w-3" />
								</button>
							</span>
						))}
					</div>
				)}
				<p className="text-xs text-muted-foreground">
					Link specific files that this memory applies to.
				</p>
			</div>

			<div className="space-y-2">
				<Label htmlFor="scope">Scope</Label>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" className="w-full justify-between">
							{repoId
								? repos.find((r) => r._id === repoId)?.fullName.split("/")[1] || "Unknown"
								: "Organization-wide (all repos)"}
							<ChevronDown className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]">
						<DropdownMenuItem onClick={() => setRepoId(undefined)}>
							Organization-wide (all repos)
						</DropdownMenuItem>
						{repos.map((repo) => (
							<DropdownMenuItem key={repo._id} onClick={() => setRepoId(repo._id)}>
								{repo.fullName.split("/")[1]}
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
}
