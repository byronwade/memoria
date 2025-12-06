import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

interface RelatedItem {
	title: string;
	href: string;
	description: string;
}

interface RelatedLinksProps {
	title: string;
	items: RelatedItem[];
}

export function RelatedLinks({ title, items }: RelatedLinksProps) {
	if (!items.length) return null;

	return (
		<div className="mt-12 pt-8 border-t border-card-border">
			<h2 className="text-xl font-semibold mb-4">{title}</h2>
			<div className="grid gap-4 sm:grid-cols-2">
				{items.map((item) => (
					<Link key={item.href} href={item.href} className="group block">
						<Card className="h-full transition-colors hover:border-accent/50">
							<CardContent className="pt-4">
								<div className="flex items-center justify-between mb-2">
									<h3 className="font-medium group-hover:text-accent transition-colors">
										{item.title}
									</h3>
									<ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent group-hover:translate-x-1 transition-all" />
								</div>
								<p className="text-sm text-muted-foreground line-clamp-2">
									{item.description}
								</p>
							</CardContent>
						</Card>
					</Link>
				))}
			</div>
		</div>
	);
}
