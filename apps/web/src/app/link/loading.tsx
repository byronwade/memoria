export default function LinkLoading() {
	return (
		<div
			className="min-h-[50vh] flex items-center justify-center"
			role="status"
			aria-live="polite"
		>
			<span className="text-sm text-muted-foreground">Loading…</span>
		</div>
	);
}
