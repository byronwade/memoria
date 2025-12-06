import { redirect } from "next/navigation";
import { getDashboardData } from "./dashboard-data";
import { DashboardProvider } from "./dashboard-context";
import { DashboardShell } from "./dashboard-shell";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";

export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const data = await getDashboardData();

	if (!data) {
		redirect("/login");
	}

	// If needs onboarding (no active installation or no active repos), redirect
	if (data.needsOnboarding) {
		redirect("/onboarding");
	}

	return (
		<DashboardProvider initialData={data}>
			<DashboardShell>{children}</DashboardShell>
			<KeyboardShortcuts />
		</DashboardProvider>
	);
}
