import Link from "next/link";
import { Fragment } from "react";
import { JsonLd } from "@/components/seo/JsonLd";
import {
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	Breadcrumb as BreadcrumbNav,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { siteConfig } from "@/lib/seo/constants";
import { generateBreadcrumbSchema } from "@/lib/seo/schema";

interface BreadcrumbItemType {
	label: string;
	href: string;
}

interface BreadcrumbProps {
	items: BreadcrumbItemType[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
	const schemaItems = [
		{ name: "Home", url: siteConfig.url },
		...items.map((item) => ({
			name: item.label,
			url: `${siteConfig.url}${item.href}`,
		})),
	];

	return (
		<>
			<BreadcrumbNav className="mb-6">
				<BreadcrumbList>
					{items.map((item, index) => (
						<Fragment key={item.href}>
							{index > 0 && <BreadcrumbSeparator />}
							<BreadcrumbItem>
								{index === items.length - 1 ? (
									<BreadcrumbPage>{item.label}</BreadcrumbPage>
								) : (
									<BreadcrumbLink asChild>
										<Link href={item.href}>{item.label}</Link>
									</BreadcrumbLink>
								)}
							</BreadcrumbItem>
						</Fragment>
					))}
				</BreadcrumbList>
			</BreadcrumbNav>
			<JsonLd schema={generateBreadcrumbSchema(schemaItems)} />
		</>
	);
}
