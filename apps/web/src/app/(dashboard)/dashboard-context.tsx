"use client";

import { createContext, useContext, ReactNode, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type {
	DashboardData,
	DashboardRepository,
	DashboardUser,
	DashboardBillingStatus,
	DashboardGuardrail,
	DashboardMemory,
	DashboardInterventionStats,
	DashboardGuardrailStats,
} from "./dashboard-data";

interface DashboardContextType {
	user: DashboardUser;
	repositories: DashboardRepository[];
	billingStatus: DashboardBillingStatus | null;
	activeRepos: DashboardRepository[];
	canAddRepo: boolean;
	repoLimit: number;
	isLoading: boolean;
	logout: () => Promise<void>;
	// AI Control Plane
	guardrails: DashboardGuardrail[];
	memories: DashboardMemory[];
	interventionStats: DashboardInterventionStats | null;
	guardrailStats: DashboardGuardrailStats | null;
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
	const [isLoading, setIsLoading] = useState(false);

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

	return (
		<DashboardContext.Provider
			value={{
				user: initialData.user,
				repositories: initialData.repositories,
				billingStatus: initialData.billingStatus,
				activeRepos,
				canAddRepo,
				repoLimit,
				isLoading,
				logout,
				// AI Control Plane
				guardrails: initialData.guardrails,
				memories: initialData.memories,
				interventionStats: initialData.interventionStats,
				guardrailStats: initialData.guardrailStats,
			}}
		>
			{children}
		</DashboardContext.Provider>
	);
}
