import { redirect } from "next/navigation";
import { getDashboardData } from "./dashboard-data";
import { DashboardProvider } from "./dashboard-context";
import { DashboardShell } from "./dashboard-shell";

export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const data = await getDashboardData();

	if (!data) {
		redirect("/login");
	}

	// If needs onboarding, redirect
	if (data.needsOnboarding && !data.currentOrg) {
		redirect("/onboarding");
	}

	return (
		<DashboardProvider initialData={data}>
			<DashboardShell>{children}</DashboardShell>
		</DashboardProvider>
	);
}
