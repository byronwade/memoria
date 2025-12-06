import { ImageResponse } from "next/og";
import { getFeatureBySlug } from "@/data/features";
import { loadGeistFont } from "@/lib/og/fonts";
import { ogColors } from "@/lib/seo/constants";

export const alt = "Memoria Feature";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: { slug: string } }) {
	const geistFont = await loadGeistFont();
	const item = getFeatureBySlug(params.slug);

	const title = item?.shortTitle || "Feature";
	const tagline = item?.tagline || "";
	const description = item?.description || "Memoria feature";

	return new ImageResponse(
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				justifyContent: "space-between",
				padding: "60px",
				backgroundColor: ogColors.background,
				fontFamily: "Geist, sans-serif",
				position: "relative",
				overflow: "hidden",
			}}
		>
			{/* Background gradient orb */}
			<div
				style={{
					position: "absolute",
					top: "-200px",
					right: "-200px",
					width: "600px",
					height: "600px",
					background: `radial-gradient(circle, ${ogColors.accent}33 0%, transparent 70%)`,
					borderRadius: "50%",
				}}
			/>

			{/* Header */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
					<div
						style={{
							width: "48px",
							height: "48px",
							borderRadius: "12px",
							background: `linear-gradient(135deg, ${ogColors.gradientStart}, ${ogColors.gradientEnd})`,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<svg
							width="28"
							height="28"
							viewBox="0 0 24 24"
							fill="none"
							stroke="white"
							strokeWidth="2"
						>
							<path d="M12 2L2 7l10 5 10-5-10-5z" />
							<path d="M2 17l10 5 10-5" />
							<path d="M2 12l10 5 10-5" />
						</svg>
					</div>
					<span
						style={{
							fontSize: "28px",
							fontWeight: 600,
							color: ogColors.foreground,
						}}
					>
						Memoria
					</span>
				</div>

				<div
					style={{
						padding: "8px 16px",
						borderRadius: "8px",
						backgroundColor: ogColors.card,
						border: `1px solid ${ogColors.cardBorder}`,
						fontSize: "14px",
						fontWeight: 500,
						color: ogColors.accent,
						textTransform: "uppercase",
						letterSpacing: "0.05em",
					}}
				>
					Feature
				</div>
			</div>

			{/* Title and description */}
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "16px",
					flex: 1,
					justifyContent: "center",
				}}
			>
				<h1
					style={{
						fontSize: title.length > 25 ? "52px" : "60px",
						fontWeight: 600,
						color: ogColors.foreground,
						lineHeight: 1.1,
						margin: 0,
					}}
				>
					{title}
				</h1>
				{tagline && (
					<p
						style={{
							fontSize: "28px",
							color: ogColors.accent,
							margin: 0,
						}}
					>
						{tagline}
					</p>
				)}
				<p
					style={{
						fontSize: "22px",
						color: ogColors.mutedForeground,
						lineHeight: 1.4,
						margin: 0,
						maxWidth: "800px",
					}}
				>
					{description}
				</p>
			</div>

			{/* Footer */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
				}}
			>
				<span
					style={{
						fontSize: "18px",
						color: ogColors.mutedForeground,
						display: "flex",
					}}
				>
					The Memory Your AI{" "}
					<span style={{ color: ogColors.accent, marginLeft: "6px" }}>
						Lacks
					</span>
				</span>
				<span style={{ fontSize: "16px", color: ogColors.tertiary }}>
					memoria.byronwade.com
				</span>
			</div>
		</div>,
		{
			...size,
			...(geistFont && {
				fonts: [
					{
						name: "Geist",
						data: geistFont,
						style: "normal" as const,
						weight: 400 as const,
					},
					{
						name: "Geist",
						data: geistFont,
						style: "normal" as const,
						weight: 600 as const,
					},
				],
			}),
		},
	);
}
