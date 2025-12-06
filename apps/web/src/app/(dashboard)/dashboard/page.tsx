import { redirect } from "next/navigation";
import { GitBranch, Plus, ArrowRight } from "lucide-react";
import Link from "next/link";
import { getDashboardData } from "../dashboard-data";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
	const data = await getDashboardData();

	if (!data) {
		redirect("/login");
	}

	// If needs onboarding, redirect there
	if (data.needsOnboarding) {
		redirect("/onboarding");
	}

	// Get active repositories
	const activeRepos = data.repositories.filter(r => r.isActive);

	// If has active repos, redirect to first one (full-width analytics view)
	if (activeRepos.length > 0) {
		redirect(`/dashboard/repositories/${activeRepos[0].fullName.split("/")[1]}`);
	}

	// Show empty state
	return (
		<div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
			<div className="w-20 h-20 rounded-sm bg-secondary/50 border border-dashed border-border/50 flex items-center justify-center mb-6">
				<GitBranch className="h-10 w-10 text-muted-foreground" />
			</div>
			<h1 className="text-2xl font-semibold mb-2">No repositories connected</h1>
			<p className="text-muted-foreground text-center max-w-md mb-8">
				Connect your first repository to start analyzing your codebase with Memoria.
			</p>
			<Button asChild size="lg">
				<Link href="/onboarding">
					<Plus className="h-5 w-5 mr-2" />
					Connect Repository
					<ArrowRight className="h-4 w-4 ml-2" />
				</Link>
			</Button>
		</div>
	);
}
