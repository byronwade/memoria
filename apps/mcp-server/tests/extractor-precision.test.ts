import { describe, expect, it } from "vitest";
import { extractExports, stripCommentsAndStrings } from "../src/index.js";

describe("stripCommentsAndStrings", () => {
	it("blanks line and block comments but keeps code", () => {
		const src = `const a = 1; // export const fake = 2\n/* export const alsoFake = 3 */ const b = 4;`;
		const out = stripCommentsAndStrings(src);
		expect(out).toContain("const a = 1;");
		expect(out).toContain("const b = 4;");
		expect(out).not.toContain("fake");
		expect(out).not.toContain("alsoFake");
	});

	it("blanks string and template literals", () => {
		const src =
			'const s = "export const inString"; const t = `export const inTemplate`;';
		const out = stripCommentsAndStrings(src);
		expect(out).not.toContain("inString");
		expect(out).not.toContain("inTemplate");
		expect(out).toContain("const s =");
		expect(out).toContain("const t =");
	});

	it("preserves length and newline positions", () => {
		const src = `a\n// comment\n"string"\nb`;
		const out = stripCommentsAndStrings(src);
		expect(out.length).toBe(src.length);
		expect(out.split("\n").length).toBe(src.split("\n").length);
	});
});

describe("extractExports precision", () => {
	it("ignores exports that appear inside comments", () => {
		const code = `
			// export const commentedOut = 1
			/* export function alsoCommented() {} */
			export const realExport = 2;
		`;
		const exports = extractExports(code);
		expect(exports).toContain("realExport");
		expect(exports).not.toContain("commentedOut");
		expect(exports).not.toContain("alsoCommented");
	});

	it("ignores export-like text inside string literals", () => {
		const code = `
			const help = "to use this, write: export function handler() {}";
			export class RealClass {}
		`;
		const exports = extractExports(code);
		expect(exports).toContain("RealClass");
		expect(exports).not.toContain("handler");
	});

	it("recognizes additional export forms", () => {
		const code = `
			export default class DefaultClass {}
			export abstract class AbstractThing {}
			export declare const declaredConst: number;
			export namespace MyNamespace {}
			export * as Reexported from "./other";
		`;
		const exports = extractExports(code);
		expect(exports).toContain("DefaultClass");
		expect(exports).toContain("AbstractThing");
		expect(exports).toContain("declaredConst");
		expect(exports).toContain("MyNamespace");
		expect(exports).toContain("Reexported");
	});

	it("still extracts the classic forms (back-compat)", () => {
		const code = `
			export function myFunction() {}
			export const MY_CONST = 1;
			export interface MyInterface {}
			export { foo, bar as baz }
			export default function defaultFunc() {}
		`;
		const exports = extractExports(code);
		for (const name of [
			"myFunction",
			"MY_CONST",
			"MyInterface",
			"foo",
			"bar",
			"defaultFunc",
		]) {
			expect(exports).toContain(name);
		}
	});
});
