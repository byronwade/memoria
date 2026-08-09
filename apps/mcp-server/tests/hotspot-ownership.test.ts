import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	cache,
	calculateHotspotScore,
	getVolatility,
} from "../src/index.js";
import { TempGitRepo } from "./helpers/temp-git-repo.js";

const DAY = 24 * 60 * 60 * 1000;

describe("Volatility engine — bugspots hotspot + ownership", () => {
	describe("calculateHotspotScore (pure)", () => {
		it("is 0 with no bug-fix commits", () => {
			expect(calculateHotspotScore([])).toBe(0);
		});

		it("weights recent fixes far more than old ones", () => {
			const now = Date.UTC(2026, 0, 1);
			const oldest = new Date(now - 100 * DAY);
			const recent = [oldest, new Date(now - 1 * DAY)];
			const middle = [oldest, new Date(now - 50 * DAY)];
			expect(calculateHotspotScore(recent, now)).toBeGreaterThan(
				calculateHotspotScore(middle, now),
			);
		});

		it("increases as more recent fixes pile up", () => {
			const now = Date.UTC(2026, 0, 1);
			const oldest = new Date(now - 100 * DAY);
			const one = [oldest, new Date(now - 2 * DAY)];
			const two = [oldest, new Date(now - 2 * DAY), new Date(now - 1 * DAY)];
			expect(calculateHotspotScore(two, now)).toBeGreaterThan(
				calculateHotspotScore(one, now),
			);
		});
	});

	describe("getVolatility integration", () => {
		let repo: TempGitRepo;

		beforeEach(async () => {
			cache.clear();
			repo = await TempGitRepo.create("memoria-hotspot-test-");
		});

		afterEach(() => {
			cache.clear();
			repo.cleanup();
		});

		it("counts bug-fix commits and produces a positive hotspot score", async () => {
			const iso = (daysAgo: number) =>
				new Date(Date.now() - daysAgo * DAY).toISOString();
			await repo.commit("add feature", { "foo.ts": "v1" }, { date: iso(40) });
			await repo.commit("fix crash in foo", { "foo.ts": "v2" }, { date: iso(30) });
			await repo.commit("refactor foo", { "foo.ts": "v3" }, { date: iso(20) });
			await repo.commit("fix bug in foo", { "foo.ts": "v4" }, { date: iso(10) });
			await repo.commit("hotfix regression", { "foo.ts": "v5" }, { date: iso(1) });

			const v = await getVolatility(repo.path("foo.ts"));
			expect(v.bugFixCommits).toBe(3);
			expect(v.hotspotScore).toBeGreaterThan(0);
		});

		it("flags many minor (<5% ownership) contributors", async () => {
			for (let i = 0; i < 18; i++) {
				await commitAs(repo, "owner@x.com", "Owner", `owner change ${i}`, {
					"foo.ts": `owner-${i}`,
				});
			}
			for (const who of ["a", "b", "c"]) {
				await commitAs(repo, `${who}@x.com`, who.toUpperCase(), `tweak ${who}`, {
					"foo.ts": `tweak-${who}`,
				});
			}

			const v = await getVolatility(repo.path("foo.ts"));
			expect(v.minorContributors).toBe(3);
		});

		it("reports zero minor contributors when one author owns everything", async () => {
			for (let i = 0; i < 6; i++) {
				await commitAs(repo, "solo@x.com", "Solo", `change ${i}`, {
					"foo.ts": `v-${i}`,
				});
			}
			const v = await getVolatility(repo.path("foo.ts"));
			expect(v.minorContributors).toBe(0);
		});
	});
});

async function commitAs(
	repo: TempGitRepo,
	email: string,
	name: string,
	message: string,
	files: Record<string, string>,
): Promise<void> {
	for (const [rel, content] of Object.entries(files)) repo.write(rel, content);
	await repo.git.add(Object.keys(files));
	await repo.git.raw([
		"commit",
		"-m",
		message,
		"--author",
		`${name} <${email}>`,
	]);
}
