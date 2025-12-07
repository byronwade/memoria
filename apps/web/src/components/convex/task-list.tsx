"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function ConvexTasksPreview() {
	const tasks = useQuery(api.tasks.get);

	if (tasks === undefined) {
		return (
			<div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
				Loading tasks from Convex...
			</div>
		);
	}

	if (!tasks || tasks.length === 0) {
		return (
			<div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
				No tasks yet. Add some in your Convex project to see them here.
			</div>
		);
	}

	return (
		<div className="rounded-lg border border-border bg-card p-4">
			<h3 className="mb-2 text-sm font-semibold text-foreground">Convex tasks</h3>
			<ul className="space-y-1 text-sm text-foreground">
				{tasks.map(({ _id, text }: { _id: string; text: string }) => (
					<li key={_id} className="flex items-center gap-2">
						<span className="h-1.5 w-1.5 rounded-full bg-primary" />
						<span>{text}</span>
					</li>
				))}
			</ul>
		</div>
	);
}





