"use client";

import { createContext, useContext, ReactNode, useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
	DashboardData,
	DashboardOrganization,
	DashboardRepository,
	DashboardUser,
	DashboardBillingStatus,
} from "./dashboard-data";

interface DashboardContextType {
	user: DashboardUser;
	organizations: DashboardOrganization[];
	currentOrg: DashboardOrganization | null;
	setCurrentOrg: (org: DashboardOrganization) => void;
	repositories: DashboardRepository[];
	billingStatus: DashboardBillingStatus | null;
	activeRepos: DashboardRepository[];
	canAddRepo: boolean;
	repoLimit: number;
	isLoading: boolean;
	isSwitchingOrg: boolean;
	logout: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextType | null>(null);

export function useDashboard() {
	const context = useContext(DashboardContext);
	if (!context) {
		throw new Error("useDashboard must be used within a DashboardProvider");
	}
	return context;
}

interface DashboardProviderProps {
	children: ReactNode;
	initialData: DashboardData;
}

export function DashboardProvider({ children, initialData }: DashboardProviderProps) {
	const router = useRouter();
	const [currentOrg, setCurrentOrg] = useState<DashboardOrganization | null>(
		initialData.currentOrg
	);
	const [isLoading, setIsLoading] = useState(false);
	const [isSwitchingOrg, startOrgTransition] = useTransition();

	const activeRepos = initialData.repositories.filter(r => r.isActive);
	const repoLimit = initialData.billingStatus?.plan?.maxRepos ?? 1;
	const canAddRepo = repoLimit === -1 || activeRepos.length < repoLimit;

	const logout = useCallback(async () => {
		setIsLoading(true);
		try {
			await fetch("/api/auth/logout", { method: "POST" });
			router.push("/");
			router.refresh();
		} catch (error) {
			console.error("Logout failed:", error);
		} finally {
			setIsLoading(false);
		}
	}, [router]);

	const handleSetCurrentOrg = useCallback((org: DashboardOrganization) => {
		setCurrentOrg(org);
		// Trigger a router refresh to refetch data for the new org
		startOrgTransition(() => {
			router.refresh();
		});
	}, [router]);

	return (
		<DashboardContext.Provider
			value={{
				user: initialData.user,
				organizations: initialData.organizations,
				currentOrg,
				setCurrentOrg: handleSetCurrentOrg,
				repositories: initialData.repositories,
				billingStatus: initialData.billingStatus,
				activeRepos,
				canAddRepo,
				repoLimit,
				isLoading,
				isSwitchingOrg,
				logout,
			}}
		>
			{children}
		</DashboardContext.Provider>
	);
}
