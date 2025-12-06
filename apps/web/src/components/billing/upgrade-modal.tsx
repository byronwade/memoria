"use client";

import { useState } from "react";
import { CreditCard, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface UpgradeModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	currentPlan?: string;
	reason?: "repo_limit" | "analysis_limit" | "feature";
}

const plans = [
	{
		tier: "solo",
		name: "Solo",
		price: 19,
		features: ["5 repositories", "500 PR analyses/month", "Full risk reports", "Priority support"],
	},
	{
		tier: "team",
		name: "Team",
		price: 49,
		features: ["25 repositories", "2500 PR analyses/month", "Team dashboard", "API access", "Priority support"],
		popular: true,
	},
];

export function UpgradeModal({
	open,
	onOpenChange,
	currentPlan = "free",
	reason,
}: UpgradeModalProps) {
	const [selectedPlan, setSelectedPlan] = useState<string>("solo");
	const [isLoading, setIsLoading] = useState(false);

	const handleUpgrade = async () => {
		setIsLoading(true);
		try {
			const response = await fetch("/api/billing/create-checkout", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					planTier: selectedPlan,
					successUrl: `${window.location.origin}/dashboard?upgraded=true`,
					cancelUrl: window.location.href,
				}),
			});

			const data = await response.json();
			if (data.url) {
				window.location.href = data.url;
			}
		} catch (error) {
			console.error("Failed to create checkout:", error);
		} finally {
			setIsLoading(false);
		}
	};

	const getMessage = () => {
		switch (reason) {
			case "repo_limit":
				return "You've reached your repository limit. Upgrade to add more repositories.";
			case "analysis_limit":
				return "You've used all your monthly analyses. Upgrade for more.";
			case "feature":
				return "This feature requires a paid plan.";
			default:
				return "Upgrade your plan to unlock more features.";
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Upgrade Your Plan</DialogTitle>
					<DialogDescription>{getMessage()}</DialogDescription>
				</DialogHeader>

				<div className="grid md:grid-cols-2 gap-4 py-4">
					{plans.map((plan) => (
						<div
							key={plan.tier}
							onClick={() => setSelectedPlan(plan.tier)}
							className={cn(
								"relative p-4 rounded-lg border-2 cursor-pointer transition-all",
								selectedPlan === plan.tier
									? "border-primary bg-primary/5"
									: "border-border hover:border-primary/50"
							)}
						>
							{plan.popular && (
								<div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-medium px-2 py-0.5 rounded-full">
									Popular
								</div>
							)}

							<div className="flex items-center justify-between mb-3">
								<h3 className="font-semibold">{plan.name}</h3>
								{selectedPlan === plan.tier && (
									<Check className="w-5 h-5 text-primary" />
								)}
							</div>

							<div className="mb-3">
								<span className="text-2xl font-bold">${plan.price}</span>
								<span className="text-muted-foreground">/month</span>
							</div>

							<ul className="space-y-1.5 text-sm">
								{plan.features.map((feature) => (
									<li key={feature} className="flex items-center gap-2">
										<Check className="w-4 h-4 text-primary shrink-0" />
										{feature}
									</li>
								))}
							</ul>
						</div>
					))}
				</div>

				<div className="flex justify-end gap-3 pt-2">
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={handleUpgrade} disabled={isLoading}>
						{isLoading ? (
							<Loader2 className="w-4 h-4 mr-2 animate-spin" />
						) : (
							<CreditCard className="w-4 h-4 mr-2" />
						)}
						Continue to Payment
					</Button>
				</div>

				<p className="text-xs text-center text-muted-foreground">
					14-day free trial. Cancel anytime.
				</p>
			</DialogContent>
		</Dialog>
	);
}
