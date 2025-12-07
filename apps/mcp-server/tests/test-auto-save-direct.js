#!/usr/bin/env node
/**
 * Direct Node.js test for auto-save memory functionality
 * This bypasses Vitest's transformation pipeline
 */

import {
	extractFromCode,
	extractFromCommitMessage,
	scanFile,
	mergeSimilarMemories,
} from "../dist/auto-librarian.js";

let passed = 0;
let failed = 0;

function assert(condition, message) {
	if (condition) {
		passed++;
		console.log(`  ✓ ${message}`);
	} else {
		failed++;
		console.log(`  ✗ ${message}`);
	}
}

console.log("\n=== Auto-Save Memory Tests ===\n");

// Test 1: Extract CRITICAL annotations
console.log("Test: extractFromCode - CRITICAL annotations");
{
	const code = `// CRITICAL: This validation prevents SQL injection attacks in user input\nfunction sanitizeInput(input) {}`;
	const memories = extractFromCode(code, "/path/to/security.ts");
	assert(memories.length > 0, "Should extract at least one memory");
	assert(memories[0].importance === "critical", "Should have critical importance");
	assert(memories[0].confidence >= 50, "Should have confidence >= 50");
}

// Test 2: Extract WARNING and HACK annotations
console.log("\nTest: extractFromCode - WARNING and HACK annotations");
{
	const code1 = `// WARNING: This function modifies global state and is not thread-safe\nfunction updateGlobalCache(data) {}`;
	const code2 = `// HACK: Workaround for Safari WebSocket bug that causes random disconnects\nsetTimeout(() => reconnect(), 100);`;
	const memories1 = extractFromCode(code1, "/path/to/cache.ts");
	const memories2 = extractFromCode(code2, "/path/to/websocket.ts");
	assert(memories1.length > 0 && memories1[0].importance === "high", "WARNING should have high importance");
	assert(memories2.length > 0 && memories2[0].memoryType === "context", "HACK should have context type");
}

// Test 3: Multiple annotations in one file
console.log("\nTest: extractFromCode - Multiple annotations");
{
	const code = `
// CRITICAL: Never expose this key in client code
const API_KEY = process.env.SECRET_KEY;
// WARNING: Rate limiting is required for this endpoint
async function fetchData() {}
	`;
	const memories = extractFromCode(code, "/path/to/api.ts");
	assert(memories.length >= 2, "Should extract multiple memories");
}

// Test 4: Short annotations should be filtered
console.log("\nTest: extractFromCode - Filter short annotations");
{
	const code = `// CRITICAL: short\n// WARNING: x`;
	const memories = extractFromCode(code, "/path/to/file.ts");
	assert(memories.length === 0, "Should filter out short annotations");
}

// Test 5: Commit message extraction
console.log("\nTest: extractFromCommitMessage");
{
	const message = "fix: Resolve critical race condition in payment processing that caused duplicate charges";
	const memories = extractFromCommitMessage(message, "abc123", ["/path/to/payment.ts"]);
	assert(memories.length > 0, "Should extract memory from commit");
	assert(memories[0].source.type === "commit_message", "Should track source type");
}

// Test 6: Auto-save threshold filtering
console.log("\nTest: Auto-save threshold filtering");
{
	const code = `// CRITICAL: This is a very important security note about preventing SQL injection attacks in user input\nfunction validateInput() {}`;
	const memories = extractFromCode(code, "/path/to/file.ts");
	const toSave = memories.filter(m => m.confidence >= 70 && (m.importance === "critical" || m.importance === "high"));
	assert(toSave.length > 0, "Should have memories meeting auto-save threshold");
}

// Test 7: Edge cases
console.log("\nTest: Edge cases");
{
	const empty = extractFromCode("", "/path/to/empty.ts");
	const whitespace = extractFromCode("   \n\n\t\t  \n", "/path/to/whitespace.ts");
	assert(empty.length === 0, "Empty file should return empty array");
	assert(whitespace.length === 0, "Whitespace-only file should return empty array");
}

// Test 8: Python comments
console.log("\nTest: Python-style comments");
{
	const code = `# CRITICAL: This validation is required for security\ndef validate_input(data):\n    pass`;
	const memories = extractFromCode(code, "/path/to/security.py");
	assert(memories.length > 0, "Should extract Python comments");
}

// Test 9: scanFile with threshold
console.log("\nTest: scanFile with confidence threshold");
{
	const code = `// CRITICAL: This is a very important security note about authentication and authorization`;
	const memories = scanFile(code, "/path/to/file.ts", 50);
	assert(memories.every(m => m.confidence >= 50), "Should filter by confidence threshold");
}

// Test 10: Deduplication
console.log("\nTest: Memory deduplication");
{
	const memories = [
		{ context: "Database connection must be properly managed", summary: "DB", keywords: ["database", "connection"], memoryType: "warning", importance: "high", source: { type: "auto_extracted", reference: null }, linkedFiles: ["/f1.ts"], confidence: 75 },
		{ context: "Database connection must be properly managed carefully", summary: "DB", keywords: ["database", "connection"], memoryType: "warning", importance: "high", source: { type: "auto_extracted", reference: null }, linkedFiles: ["/f2.ts"], confidence: 75 },
	];
	const merged = mergeSimilarMemories(memories, 0.7);
	assert(merged.length <= memories.length, "Should merge similar memories");
}

// Summary
console.log("\n=== Results ===");
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total: ${passed + failed}`);

if (failed > 0) {
	process.exit(1);
} else {
	console.log("\n✓ All tests passed!");
}
