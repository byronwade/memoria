import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { loadGeistFont } from "@/lib/og/fonts";
import { ogColors } from "@/lib/seo/constants";

export const runtime = "nodejs";
export const alt = "Memoria - Risk & Impact reports for every PR";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
	const geistFont = await loadGeistFont();

	// Read the SVG logo and change fill to white for dark background
	const logoPath = join(process.cwd(), "public", "memoria.svg");
	const logoSvg = await readFile(logoPath, "utf-8");
	const whiteLogo = logoSvg.replace('fill="#000000"', 'fill="#ffffff"');
	const logoBase64 = `data:image/svg+xml;base64,${Buffer.from(whiteLogo).toString("base64")}`;

	return new ImageResponse(
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				backgroundColor: ogColors.background,
				fontFamily: "Geist, sans-serif",
				position: "relative",
				overflow: "hidden",
			}}
		>
			{/* Background gradient effects */}
			<div
				style={{
					position: "absolute",
					top: "-300px",
					right: "-200px",
					width: "800px",
					height: "800px",
					background: `radial-gradient(circle, ${ogColors.accent}33 0%, transparent 70%)`,
					borderRadius: "50%",
				}}
			/>
			<div
				style={{
					position: "absolute",
					bottom: "-200px",
					left: "-100px",
					width: "500px",
					height: "500px",
					background: `radial-gradient(circle, ${ogColors.accentLight}26 0%, transparent 70%)`,
					borderRadius: "50%",
				}}
			/>

			{/* Logo mark */}
			<img
				src={logoBase64}
				width="120"
				height="120"
				style={{
					marginBottom: "32px",
				}}
			/>

			{/* Title */}
			<h1
				style={{
					fontSize: "72px",
					fontWeight: 600,
					color: ogColors.foreground,
					margin: 0,
					letterSpacing: "-0.02em",
				}}
			>
				Memoria
			</h1>

			{/* Tagline */}
			<p
				style={{
					fontSize: "32px",
					color: ogColors.mutedForeground,
					margin: "16px 0 0 0",
					display: "flex",
				}}
			>
				Risk & Impact for every{" "}
				<span style={{ color: ogColors.accent, marginLeft: "10px" }}>
					pull request
				</span>
			</p>

			{/* Subtitle */}
			<p
				style={{
					fontSize: "20px",
					color: ogColors.tertiary,
					margin: "24px 0 0 0",
					maxWidth: "600px",
					textAlign: "center",
					lineHeight: 1.4,
				}}
			>
				MCP + GitHub App that mines git forensics to surface hidden
				dependencies, missing co-change files, and suggested tests before you
				merge.
			</p>
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
