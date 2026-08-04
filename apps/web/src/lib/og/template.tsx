import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { ogColors } from "@/lib/seo/constants";
import { loadGeistFont } from "./fonts";

interface OGTemplateProps {
	title: string;
	description: string;
	category?: string;
}

export async function createOGImage({
	title,
	description,
	category,
}: OGTemplateProps): Promise<ImageResponse> {
	const geistFont = await loadGeistFont();

	// Load the simplified logo mark for OG rendering
	const logoPath = join(process.cwd(), "public", "memoria-mark.svg");
	const logoSvg = await readFile(logoPath, "utf-8");
	const logoBase64 = `data:image/svg+xml;base64,${Buffer.from(logoSvg).toString("base64")}`;

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
			<div
				style={{
					position: "absolute",
					bottom: "-150px",
					left: "-150px",
					width: "400px",
					height: "400px",
					background: `radial-gradient(circle, ${ogColors.accentLight}26 0%, transparent 70%)`,
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
					<img src={logoBase64} alt="" width={48} height={48} />
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

				{category && (
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
						{category}
					</div>
				)}
			</div>

			{/* Title and description */}
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "24px",
					flex: 1,
					justifyContent: "center",
				}}
			>
				<h1
					style={{
						fontSize: title.length > 40 ? "48px" : "64px",
						fontWeight: 600,
						color: ogColors.foreground,
						lineHeight: 1.1,
						margin: 0,
						letterSpacing: "-0.02em",
					}}
				>
					{title}
				</h1>
				<p
					style={{
						fontSize: "24px",
						color: ogColors.mutedForeground,
						lineHeight: 1.4,
						margin: 0,
						maxWidth: "700px",
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
				<span
					style={{
						fontSize: "16px",
						color: ogColors.tertiary,
					}}
				>
					memoria.byronwade.com
				</span>
			</div>
		</div>,
		{
			width: 1200,
			height: 630,
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
