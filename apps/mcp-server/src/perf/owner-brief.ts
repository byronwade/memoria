/**
 * Bus-factor / ownership guidance for AI and humans.
 */

export interface OwnerInfo {
	name: string;
	percentage: number;
	email?: string;
}

export function buildOwnerBrief(
	topAuthor: OwnerInfo | null | undefined,
	opts?: { fileName?: string },
): string | null {
	if (!topAuthor || topAuthor.percentage < 50) return null;
	const file = opts?.fileName ? ` in \`${opts.fileName}\`` : "";
	if (topAuthor.percentage >= 70) {
		return (
			`**Owner brief:** ${topAuthor.name} wrote ${topAuthor.percentage}% of this file${file}. ` +
			`If the logic is unclear, ask them or treat changes as high-risk until reviewed.`
		);
	}
	return (
		`**Owner brief:** ${topAuthor.name} owns ${topAuthor.percentage}% of recent history${file}. ` +
		`Prefer aligning with their patterns when editing.`
	);
}
