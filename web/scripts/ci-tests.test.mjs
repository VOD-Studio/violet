import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { emptyHistory, HISTORY_LIMIT, mergeHistory, PACKAGE_NAMES, splitFiles, validateHistory, validatePlan, validateRun } from "./ci-test-data.mjs";
import { affectedScope, packageDependents } from "./ci-test-inventory.mjs";
import { collectHistory, planTests, publishPlan, runPlan } from "./ci-tests.mjs";

const execute = promisify(execFile);
const scripts = dirname(fileURLToPath(import.meta.url));
const sha = "a".repeat(40);
const fixtureMap = {
	version: 1,
	always: ["e2e/global.spec.ts"],
	rules: [
		{ name: "chat", prefixes: ["src/features/chat/", "src/routes/chat.ts"], specs: ["e2e/chat.spec.ts"] },
		{ name: "posts", prefixes: ["src/features/posts/"], specs: ["e2e/posts.spec.ts"] },
	],
};
const inventory = { unit: ["src/a.test.ts", "src/b.test.ts"], contract: ["e2e/a.spec.ts"] };

function sample(ms, run = "one") {
	return { ms, run, revision: sha, at: "2026-11-17T00:00:00.000Z" };
}

function plan() {
	return { version: 1, mode: "full", revision: sha, base: null, unit: [{ id: 1, files: [...inventory.unit] }], contract: [{ id: 1, files: [...inventory.contract] }], inventory: structuredClone(inventory), selected: structuredClone(inventory), packages: [...PACKAGE_NAMES], reasons: [] };
}

function report(index, overrides = {}) {
	return { version: 1, type: "ci-test-run", revision: sha, kind: "unit", shard: 1, run: `run-${index}`, at: new Date(Date.UTC(2026, 10, 17, 0, 0, index)).toISOString(), planned: ["src/a.test.ts"], success: true, durations: [{ file: "src/a.test.ts", durationMs: index + 1 }], ...overrides };
}

test("recorded medians change LPT assignments while every file occurs exactly once", () => {
	const files = ["a", "b", "c", "d"];
	const history = Object.fromEntries([10_000, 9_000, 2_000, 1_000].map((ms, index) => [files[index], { samples: [sample(ms)] }]));
	const withoutHistory = splitFiles(files, 2);
	const withHistory = splitFiles(files, 2, history);
	assert.deepEqual(withHistory.map((shard) => shard.files), [["a", "d"], ["b", "c"]]);
	assert.notDeepEqual(withHistory.map((shard) => shard.files), withoutHistory.map((shard) => shard.files));
	assert.deepEqual(withHistory, splitFiles([...files].reverse(), 2, history));
	assert.deepEqual(withHistory.flatMap((shard) => shard.files).sort(), files);
	assert.deepEqual(withHistory.map((shard) => shard.estimatedMs), [11_000, 11_000]);
	assert.equal(splitFiles(["new"], 1, history)[0].estimatedMs, 10_000);
	assert.equal(splitFiles([], 3).length, 3);
});

test("history keeps bounded successful measurements, unobserved files, and idempotent merges", () => {
	const old = emptyHistory();
	old.files.unit["src/unobserved.test.ts"] = { samples: [sample(33)] };
	const reports = Array.from({ length: HISTORY_LIMIT + 4 }, (_, index) => report(index));
	const merged = mergeHistory(old, reports);
	assert.equal(merged.files.unit["src/a.test.ts"].samples.length, HISTORY_LIMIT);
	assert.equal(merged.files.unit["src/a.test.ts"].medianMs, 9.5);
	assert.deepEqual(merged.files.unit["src/unobserved.test.ts"], old.files.unit["src/unobserved.test.ts"]);
	assert.deepEqual(mergeHistory(merged, reports.slice(-2)), merged);
	assert.deepEqual(mergeHistory(merged, [report(20, { success: false, durations: [{ file: "src/a.test.ts", durationMs: 60_000 }] })]), merged);
	assert.throws(() => mergeHistory(old, [report(1), report(1)]), /Duplicate test run/);
	assert.throws(() => mergeHistory(old, [report(1, { durations: [{ file: "src/extra.test.ts", durationMs: 1 }] })]), /unplanned/);
	assert.throws(() => validateHistory({ version: 2, files: {} }), /Unsupported/);
	assert.throws(() => validateHistory({ version: 1, files: { unit: { "bad": { samples: [sample(-1)] } }, contract: {} } }), /Invalid duration/);
});

test("plan validation rejects revision drift, missing/new tests, duplicate shards, and omissions", () => {
	assert.equal(validatePlan(plan(), sha, inventory).version, 1);
	assert.throws(() => validatePlan(plan(), "b".repeat(40)), /does not match/);
	assert.throws(() => validatePlan(plan(), sha, { unit: [...inventory.unit, "src/new.test.ts"] }), /inventory changed/);
	assert.throws(() => validatePlan(plan(), sha, { unit: [inventory.unit[0]] }), /inventory changed/);
	const omitted = structuredClone(plan());
	omitted.unit[0].files.pop();
	assert.throws(() => validatePlan(omitted, sha), /union differs/);
	const duplicate = structuredClone(plan());
	duplicate.unit.push({ id: 2, files: [inventory.unit[0]] });
	assert.throws(() => validatePlan(duplicate, sha), /Duplicate/);
});

test("runner validation rejects zero execution and extra files, excluding retries from timing history", () => {
	const raw = { version: 1, kind: "unit", success: true, files: [{ file: "a.test.ts", tests: 2, executed: 2, success: true, healthy: true, durationMs: 12 }] };
	assert.deepEqual(validateRun(raw, ["a.test.ts"], "unit"), [{ file: "a.test.ts", durationMs: 12 }]);
	assert.deepEqual(validateRun({ ...raw, files: [{ ...raw.files[0], healthy: false }] }, ["a.test.ts"], "unit"), []);
	assert.throws(() => validateRun({ ...raw, files: [{ ...raw.files[0], executed: 0 }] }, ["a.test.ts"], "unit"), /ran no tests/);
	assert.throws(() => validateRun(raw, ["other.test.ts"], "unit"), /exact planned files/);
	assert.throws(() => validateRun({ ...raw, success: false }, ["a.test.ts"], "unit"), /complete successfully/);
});

test("business mappings narrow known routes and fail safe for shared, deleted, or unmapped executable changes", () => {
	const contract = ["e2e/chat.spec.ts", "e2e/posts.spec.ts", "e2e/global.spec.ts"].sort();
	const mapped = affectedScope([{ status: "M", file: "web/src/routes/chat.ts" }], fixtureMap, contract);
	assert.deepEqual(mapped.contract, ["e2e/chat.spec.ts", "e2e/global.spec.ts"]);
	assert.equal(mapped.full, false);
	for (const change of [
		{ status: "M", file: "web/src/shared/client.ts" },
		{ status: "M", file: "web/src/features/new/view.tsx" },
		{ status: "D", file: "web/src/features/chat/value.ts" },
		{ status: "M", file: "web/vitest.config.ts" },
		{ status: "M", file: "web/pnpm-lock.yaml" },
		{ status: "M", file: "scripts/unknown.py" },
		{ status: "M", file: "docs/executable.ts" },
		{ status: "M", file: "web/src/features/docs/content.md" },
		{ status: "M", file: "web/packages/ui/README.md" },
		{ status: "M", file: "web/e2e/fixtures/article.md" },
		{ status: "M", file: "web/scripts/fixtures/input.txt" },
	]) {
		assert.equal(affectedScope([change], fixtureMap, contract).full, true, change.file);
	}
	assert.deepEqual(affectedScope([{ status: "M", file: "docs/guide.md" }, { status: "M", file: "api/internal/handler.go" }], fixtureMap, contract).contract, []);
	assert.equal(affectedScope([{ status: "M", file: "web/src/routes/chat.ts" }], fixtureMap, [...contract, "e2e/unmapped.spec.ts"]).full, true);
	const packageDocs = affectedScope([{ status: "M", file: "web/packages/ui/README.md" }], fixtureMap, contract);
	assert.deepEqual(packageDocs.changedPackages, ["ui"]);
});

async function fixture(run) {
	const root = await realpath(await mkdtemp(resolve(tmpdir(), "violet-ci-scheduler-")));
	const webRoot = resolve(root, "web");
	const put = async (file, content) => {
		await mkdir(dirname(resolve(root, file)), { recursive: true });
		await writeFile(resolve(root, file), content);
	};
	const git = async (...args) => (await execute("git", args, { cwd: root })).stdout.trim();
	const commit = async () => {
		await git("add", ".");
		await git("-c", "user.name=CI Fixture", "-c", "user.email=ci@example.invalid", "commit", "--quiet", "-m", "fixture");
		return git("rev-parse", "HEAD");
	};
	try {
		await put(".gitignore", "web/node_modules/\nreports/\nplan.json\nsummary.md\noutputs.txt\n");
		await put("web/package.json", JSON.stringify({ type: "module" }));
		await symlink(resolve(scripts, "../node_modules"), resolve(webRoot, "node_modules"), "dir");
		await put("web/vitest.config.ts", "export default { test: { environment: 'node', include: ['src/**/*.test.ts'] } };\n");
		await put("web/playwright.config.ts", "export default { testDir: './e2e' };\n");
		await put("web/e2e/ci-test-map.json", JSON.stringify(fixtureMap));
		await put("web/src/features/chat/value.ts", "export const value = 1;\n");
		await put("web/src/routes/chat.ts", "export { value } from '../features/chat/value';\n");
		await put("web/src/features/chat/value.test.ts", "import { it, expect } from 'vitest'; import { value } from './value'; it('chat logic', () => expect(value).toBeGreaterThan(0));\n");
		await put("web/src/routes/chat.test.ts", "import { it, expect } from 'vitest'; import { value } from './chat'; it('route consumer', () => expect(value).toBeGreaterThan(0));\n");
		await put("web/src/routes/chat.test.ts.extra.test.ts", "import { it, expect } from 'vitest'; it('unrelated filename containing a selected path', () => expect(1).toBe(1));\n");
		await put("web/src/features/posts/value.test.ts", "import { it, expect } from 'vitest'; it('other business', () => expect(1).toBe(1));\n");
		for (const name of ["chat", "posts", "global"]) {
			await put(`web/e2e/${name}.spec.ts`, `import { test, expect } from '@playwright/test'; test('${name}', () => { let sum = 0; for (let i = 0; i < 1000000; i++) { sum += Math.sqrt(i); } expect(sum).toBeGreaterThan(0); });\n`);
		}
		for (const name of PACKAGE_NAMES) {
			await put(`web/packages/${name}/package.json`, JSON.stringify({ name: name === "ui" ? "@violet/ui" : `@violetjs/${name}`, dependencies: name === "ui" ? { "@violetjs/theme": "workspace:*" } : name === "kanban" ? { "@violet/ui": "workspace:*" } : {} }));
			await put(`web/packages/${name}/src/index.ts`, "export const packageValue = 1;\n");
		}
		await mkdir(resolve(webRoot, "scripts"), { recursive: true });
		for (const file of ["ci-tests.mjs", "ci-test-data.mjs", "ci-test-inventory.mjs", "ci-vitest-reporter.mjs", "ci-playwright-reporter.mjs"]) {
			await copyFile(resolve(scripts, file), resolve(webRoot, "scripts", file));
		}
		await git("init", "--quiet");
		const base = await commit();
		await run({ root, webRoot, put, git, commit, base });
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}

test("real Vitest dependency selection includes route consumers, and exact unit/browser plans record measured history", async () => {
	await fixture(async ({ root, webRoot, put, commit, base }) => {
		await put("web/src/features/chat/value.ts", "export const value = 2;\n");
		await commit();
		const selected = await planTests({ root, webRoot, base, unitShards: 1, contractShards: 1 });
		assert.deepEqual(selected.selected.unit, ["src/features/chat/value.test.ts", "src/routes/chat.test.ts"]);
		assert.deepEqual(selected.selected.contract, ["e2e/chat.spec.ts", "e2e/global.spec.ts"]);
		assert.deepEqual(selected.packages, []);
		const reports = resolve(root, "reports");
		const unit = await runPlan({ plan: selected, root, webRoot, kind: "unit", shard: 1, reportDir: resolve(reports, "unit-artifact") });
		const contract = await runPlan({ plan: selected, root, webRoot, kind: "contract", shard: 1, reportDir: resolve(reports, "browser-artifact") });
		assert.equal(unit.success, true);
		assert.equal(contract.success, true);
		assert.equal(unit.durations.length, 2);
		assert.equal(contract.durations.length, 2);
		assert.ok([...unit.durations, ...contract.durations].every((entry) => entry.durationMs > 0));
		const output = resolve(root, "history.json");
		const history = await collectHistory({ reports, output });
		assert.equal(Object.keys(history.files.unit).length, 2);
		assert.equal(Object.keys(history.files.contract).length, 2);
		assert.deepEqual(await collectHistory({ reports, output, history: output }), history);
		const drifted = { ...selected, revision: "b".repeat(40) };
		await assert.rejects(() => runPlan({ plan: drifted, root, webRoot, kind: "unit", shard: 1, reportDir: resolve(root, "wrong-sha") }), /does not match/);
		await put("web/src/new.test.ts", "import { it } from 'vitest'; it('new coverage', () => {});\n");
		await assert.rejects(() => runPlan({ plan: selected, root, webRoot, kind: "unit", shard: 1, reportDir: resolve(root, "new-inventory") }), /inventory changed/);
	});
});

test("repeated browser runs still verify all files without inflating duration history", async () => {
	await fixture(async ({ root, webRoot, put, commit }) => {
		await put("web/playwright.config.ts", "export default { testDir: './e2e', repeatEach: 2 };\n");
		await commit();
		const selected = await planTests({ root, webRoot, full: true, contractShards: 1 });
		const reports = resolve(root, "repeated");
		const result = await runPlan({ plan: selected, root, webRoot, kind: "contract", shard: 1, reportDir: reports });
		assert.equal(result.success, true);
		const raw = JSON.parse(await readFile(resolve(reports, "contract-1.runner.json"), "utf8"));
		assert.ok(raw.files.every((file) => file.executed === 2));
		assert.deepEqual(result.durations, []);
		const history = await collectHistory({ reports, output: resolve(root, "history.json") });
		assert.deepEqual(history.files.contract, {});
	});
});

test("new tests are selected, package changes cover dependent packages and all site consumers, deletions fail safe", async () => {
	await fixture(async ({ root, webRoot, put, git, commit, base }) => {
		await put("web/src/features/chat/new.test.ts", "import { it } from 'vitest'; it('new coverage', () => {});\n");
		await commit();
		const added = await planTests({ root, webRoot, base });
		assert.ok(added.selected.unit.includes("src/features/chat/new.test.ts"));
		assert.deepEqual(await packageDependents(webRoot, ["theme"]), ["ui", "kanban", "theme"]);
		const packageBase = await git("rev-parse", "HEAD");
		await put("web/packages/theme/src/index.ts", "export const packageValue = 2;\n");
		await commit();
		const packagePlan = await planTests({ root, webRoot, base: packageBase });
		assert.deepEqual(packagePlan.selected, packagePlan.inventory);
		assert.deepEqual(packagePlan.packages, ["ui", "kanban", "theme"]);
		await rm(resolve(webRoot, "src/features/chat/value.ts"));
		await commit();
		const deleted = await planTests({ root, webRoot, base });
		assert.deepEqual(deleted.selected, deleted.inventory);
		assert.ok(deleted.reasons.some((reason) => reason.includes("Deleted")));
	});
});

test("CLI resolves the same inventories from root and web and exports consumer-visible matrices and summaries", async () => {
	await fixture(async ({ root, webRoot }) => {
		const entry = resolve(webRoot, "scripts/ci-tests.mjs");
		const rootPlan = resolve(root, "root-plan.json");
		const webPlan = resolve(root, "web-plan.json");
		const outputs = resolve(root, "outputs.txt");
		const summary = resolve(root, "summary.md");
		await execute(process.execPath, [entry, "plan", "--full", "--output", rootPlan], { cwd: root, env: { ...process.env, GITHUB_OUTPUT: outputs, GITHUB_STEP_SUMMARY: summary } });
		await execute(process.execPath, [entry, "plan", "--full", "--output", webPlan], { cwd: webRoot, env: { ...process.env, GITHUB_OUTPUT: outputs, GITHUB_STEP_SUMMARY: summary } });
		assert.deepEqual(JSON.parse(await readFile(rootPlan, "utf8")), JSON.parse(await readFile(webPlan, "utf8")));
		const values = await readFile(outputs, "utf8");
		assert.match(values, /unit_matrix=\[1,2,3\]/);
		assert.match(values, /contract_matrix=\[1,2\]/);
		assert.match(values, /has_unit=true/);
		assert.match(await readFile(summary, "utf8"), /Unit files: 4\/4/);
		assert.match(await readFile(summary, "utf8"), /Full validation requested/);
		await assert.rejects(() => execute(process.execPath, [entry, "plan", "--full", "--base", "HEAD", "--output", rootPlan], { cwd: root }), /either --base or --full/);
	});
});

test("empty planned shards publish no-work reports without passing empty selections to a runner", async () => {
	await fixture(async ({ root, webRoot, base }) => {
		const selected = await planTests({ root, webRoot, base });
		assert.deepEqual(selected.selected, { unit: [], contract: [] });
		const summary = await runPlan({ plan: selected, root, webRoot, kind: "unit", shard: 1, reportDir: resolve(root, "reports") });
		assert.equal(summary.noWork, true);
		assert.deepEqual(summary.durations, []);
		const outputs = resolve(root, "outputs.txt");
		await publishPlan(selected, { GITHUB_OUTPUT: outputs });
		assert.match(await readFile(outputs, "utf8"), /unit_matrix=\[\]/);
		assert.match(await readFile(outputs, "utf8"), /has_unit=false/);
	});
});
