#!/usr/bin/env node

import path from "node:path";
import {
	checkDrift,
	createAnalysisContext,
	generateAiInstructions,
	getCoupledFiles,
	getImporters,
	getSiblingGuidance,
	getVolatility,
} from "./src/index.js";

async function analyzeFile(filePath: string) {
	try {
		const targetPath = path.resolve(filePath);
		console.log(`Analyzing: ${targetPath}\n`);

		// Create analysis context
		const ctx = await createAnalysisContext(targetPath);

		// Run engines in parallel
		const [volatility, coupled, importers] = await Promise.all([
			getVolatility(targetPath, ctx),
			getCoupledFiles(targetPath, ctx),
			getImporters(targetPath, ctx),
		]);

		const drift = await checkDrift(targetPath, coupled, ctx);

		// Get sibling guidance for new files
		let siblingGuidance = null;
		if (volatility.commitCount === 0) {
			siblingGuidance = await getSiblingGuidance(targetPath, ctx.config);
		}

		// Generate report
		const report = generateAiInstructions(
			targetPath,
			volatility,
			coupled,
			drift,
			importers,
			ctx.config,
			siblingGuidance,
		);

		console.log(report);
	} catch (error: any) {
		console.error(`Analysis Error: ${error.message}`);
		process.exit(1);
	}
}

// Get file path from command line argument
const filePath = process.argv[2];
if (!filePath) {
	console.error("Usage: npx tsx analyze-file.ts <file-path>");
	process.exit(1);
}

analyzeFile(filePath);
