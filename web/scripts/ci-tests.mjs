#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { emptyHistory, invariant, mergeHistory, PACKAGE_NAMES, sorted, splitFiles, validateHistory, validatePlan, validateRun } from "./ci-test-data.mjs";
import { affectedScope, changedFiles, documentation, ensureSelectedInventory, git, listContract, listUnit, packageDependents, revision, runProcess } from "./ci-test-inventory.mjs";

const SCRIPT_ROOT = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(SCRIPT_ROOT, "..");
const ROOT = resolve(WEB_ROOT, "..");
const CONTRACT_REPORTER = resolve(SCRIPT_ROOT, "ci-playwright-reporter.mjs");
const UNIT_REPORTER = resolve(SCRIPT_ROOT, "ci-vitest-reporter.mjs");

async function json(path) {
	return JSON.parse(await readFile(path, "utf8"));
}

async function writeJson(path, value, exclusive = false) {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { flag: exclusive ? "wx" : "w" });
}

async function loadHistory(path) {
	if (!path) {
		return emptyHistory();
	}
	try {
		return validateHistory(await json(path));
	} catch (error) {
		if (error.code === "ENOENT") {
			return emptyHistory();
		}
		throw error;
	}
}

/** Uses real runner inventories at a single checkout; paths in the result are web-relative. */
export async function planTests({ root = ROOT, webRoot = WEB_ROOT, base, full = false, history = emptyHistory(), unitShards = 3, contractShards = 2, contractReporter = CONTRACT_REPORTER }) {
	invariant(!(base && full), "Use either --base or --full");
	validateHistory(history);
	const head = await revision(root);
	const resolvedBase = base ? await revision(root, base) : null;
	if (resolvedBase) {
		await git(root, ["merge-base", resolvedBase, head]);
	}
	const [unitInventory, contractInventory] = await Promise.all([listUnit(webRoot), listContract(webRoot, contractReporter)]);
	invariant(unitInventory.length > 0 && contractInventory.length > 0, "The full runner inventory must not be empty");
	const inventory = { unit: unitInventory, contract: contractInventory };
	let selected = { ...inventory };
	let packages = [...PACKAGE_NAMES];
	let reasons = ["Full validation requested"];
	if (resolvedBase) {
		const changes = await changedFiles(root, resolvedBase);
		const mapping = await json(resolve(webRoot, "e2e/ci-test-map.json"));
		const scope = affectedScope(changes, mapping, contractInventory);
		reasons = scope.reasons;
		selected = { unit: unitInventory, contract: scope.contract };
		const onlyPackages = changes.filter(({ file }) => !documentation(file) && !file.startsWith("api/")).every(({ file, status }) => /^[AM]$/.test(status) && /^web\/packages\/([^/]+)\//.test(file) && PACKAGE_NAMES.includes(file.split("/")[2]));
		packages = scope.full && !onlyPackages ? [...PACKAGE_NAMES] : await packageDependents(webRoot, scope.changedPackages);
		if (!scope.full) {
			try {
				selected.unit = await listUnit(webRoot, resolvedBase);
				ensureSelectedInventory(selected.unit, unitInventory, "Vitest affected inventory");
				// Added tests must be selected even when a runner's changed-file discovery omits them.
				const added = changes.filter(({ status }) => status === "A").map(({ file }) => file.slice(4)).filter((file) => unitInventory.includes(file));
				selected.unit = sorted([...selected.unit, ...added]);
				reasons.push("Unit selection uses Vitest --changed dependency traversal");
			} catch (error) {
				selected.unit = unitInventory;
				reasons.push(`Vitest dependency selection unavailable; full unit inventory: ${error.message}`);
			}
		}
		if (changes.length === 0) {
			reasons.push("No changed files against the PR merge base");
		}
	}
	for (const kind of ["unit", "contract"]) {
		ensureSelectedInventory(selected[kind], inventory[kind], kind);
	}
	const plan = {
		version: 1,
		mode: resolvedBase ? "affected" : "full",
		revision: head,
		base: resolvedBase,
		unit: splitFiles(selected.unit, unitShards, history.files.unit),
		contract: splitFiles(selected.contract, contractShards, history.files.contract),
		packages,
		reasons: sorted(reasons),
		inventory,
		selected,
	};
	return validatePlan(plan, head, inventory);
}

export async function publishPlan(plan, env = process.env) {
	const outputs = {
		unit_matrix: plan.unit.filter((shard) => shard.files.length > 0).map((shard) => shard.id),
		contract_matrix: plan.contract.filter((shard) => shard.files.length > 0).map((shard) => shard.id),
		package_matrix: plan.packages,
	};
	if (env.GITHUB_OUTPUT) {
		await appendFile(env.GITHUB_OUTPUT, `${Object.entries(outputs).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join("\n")}\nhas_unit=${outputs.unit_matrix.length > 0}\nhas_contract=${outputs.contract_matrix.length > 0}\nhas_packages=${plan.packages.length > 0}\n`);
	}
	const summary = [
		"### Web test plan",
		"",
		`Mode: **${plan.mode}** · revision: \`${plan.revision}\` · base: \`${plan.base ?? "none"}\``,
		"",
		`- Unit files: ${plan.selected.unit.length}/${plan.inventory.unit.length}; active shards: ${outputs.unit_matrix.join(", ") || "none"}`,
		`- Browser contract files: ${plan.selected.contract.length}/${plan.inventory.contract.length}; active shards: ${outputs.contract_matrix.join(", ") || "none"}`,
		`- Independent packages: ${plan.packages.join(", ") || "none"}`,
		"",
		...plan.reasons.map((reason) => `- ${reason.replaceAll("\n", " ")}`),
		"",
	].join("\n");
	if (env.GITHUB_STEP_SUMMARY) {
		await appendFile(env.GITHUB_STEP_SUMMARY, summary);
	}
	console.log(JSON.stringify({ revision: plan.revision, mode: plan.mode, ...outputs, selected: { unit: plan.selected.unit.length, contract: plan.selected.contract.length }, total: { unit: plan.inventory.unit.length, contract: plan.inventory.contract.length }, reasons: plan.reasons }));
}

/** Runs only the assigned files and rejects runner omissions before recording successful timing data. */
export async function runPlan({ plan, kind, shard: shardId, reportDir, root = ROOT, webRoot = WEB_ROOT, contractReporter = CONTRACT_REPORTER, unitReporter = UNIT_REPORTER }) {
	invariant(["unit", "contract"].includes(kind), "--kind must be unit or contract");
	const head = await revision(root);
	validatePlan(plan, head);
	const actual = kind === "unit" ? await listUnit(webRoot) : await listContract(webRoot, contractReporter);
	validatePlan(plan, head, { [kind]: actual });
	const shard = plan[kind].find((entry) => entry.id === shardId);
	invariant(shard, `Unknown ${kind} shard ${shardId}`);
	await mkdir(reportDir, { recursive: true });
	const prefix = resolve(reportDir, `${kind}-${shardId}`);
	const summaryPath = `${prefix}.summary.json`;
	const rawPath = `${prefix}.runner.json`;
	const configPath = `${prefix}.vitest.config.mjs`;
	const run = `${process.env.GITHUB_RUN_ID ?? randomUUID()}/${process.env.GITHUB_RUN_ATTEMPT ?? "1"}/${head}/${kind}/${shardId}`;
	const summary = { version: 1, type: "ci-test-run", revision: head, kind, shard: shardId, run, at: new Date().toISOString(), planned: shard.files, success: false, durations: [] };
	// Reserve the result path so an old successful report cannot mask a failed rerun.
	await writeJson(summaryPath, summary, true);
	try {
		if (shard.files.length === 0) {
			summary.success = true;
			summary.noWork = true;
		} else {
			const env = { CI_TEST_REPORT: rawPath, CI_TEST_WEB_ROOT: webRoot, CI_TEST_LIST: "0" };
			await rm(rawPath, { force: true });
			let args;
			if (kind === "unit") {
				const literalGlob = (file) => file.replace(/[\\*?{}\[\]()!+@]/g, "\\$&");
				const source = `import base from ${JSON.stringify(pathToFileURL(resolve(webRoot, "vitest.config.ts")).href)};\nexport default { ...base, root: ${JSON.stringify(webRoot)}, test: { ...base.test, include: ${JSON.stringify(shard.files.map(literalGlob))}, exclude: [], allowOnly: false, passWithNoTests: false, reporters: ["default", ${JSON.stringify(unitReporter)}] } };\n`;
				await writeFile(configPath, source, { flag: "wx" });
				args = [resolve(webRoot, "node_modules/vitest/vitest.mjs"), "run", "--config", configPath];
			} else {
				const exactPattern = (file) => `^${resolve(webRoot, file).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`;
				args = [resolve(webRoot, "node_modules/@playwright/test/cli.js"), "test", "--workers=2", "--forbid-only", `--reporter=list,${contractReporter}`, ...shard.files.map(exactPattern)];
			}
			const result = await runProcess(process.execPath, args, webRoot, env);
			invariant(result.code === 0 && !result.signal, `Test runner failed: code=${result.code} signal=${result.signal ?? "none"}`);
			summary.durations = validateRun(await json(rawPath), shard.files, kind);
			summary.success = true;
		}
	} catch (error) {
		summary.error = error.message;
		throw error;
	} finally {
		await writeJson(summaryPath, summary);
		await rm(configPath, { force: true });
	}
	console.log(JSON.stringify({ report: summaryPath, success: summary.success, files: shard.files.length, measured: summary.durations.length }));
	return summary;
}

async function summaryFiles(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const nested = await Promise.all(entries.filter((entry) => entry.isDirectory()).map((entry) => summaryFiles(resolve(directory, entry.name))));
	return [...entries.filter((entry) => entry.isFile() && entry.name.endsWith(".summary.json")).map((entry) => resolve(directory, entry.name)), ...nested.flat()].sort();
}

export async function collectHistory({ reports, output, history }) {
	const files = await summaryFiles(reports);
	invariant(files.length > 0, "No test run summaries found");
	const result = mergeHistory(await loadHistory(history), await Promise.all(files.map(json)));
	await writeJson(output, result);
	console.log(JSON.stringify({ history: output, reports: files.length, unit: Object.keys(result.files.unit).length, contract: Object.keys(result.files.contract).length }));
	return result;
}

function options(args) {
	const result = {};
	for (let index = 0; index < args.length; index += 1) {
		const key = args[index];
		invariant(key.startsWith("--") && !Object.hasOwn(result, key.slice(2)), `Invalid or duplicate option: ${key}`);
		if (key === "--full") {
			result.full = true;
		} else {
			invariant(args[index + 1] !== undefined && !args[index + 1].startsWith("--"), `Missing value for ${key}`);
			result[key.slice(2)] = args[++index];
		}
	}
	return result;
}

export async function main(args = process.argv.slice(2)) {
	const [action, ...rest] = args;
	const opts = options(rest);
	const allowed = { plan: ["output", "base", "full", "history", "unit-shards", "contract-shards"], run: ["plan", "kind", "shard", "report-dir"], history: ["reports", "output", "history"] };
	invariant(allowed[action], "Usage: ci-tests.mjs plan|run|history --output PATH (see CLI contract)");
	invariant(Object.keys(opts).every((key) => allowed[action].includes(key)), `Unknown ${action} option`);
	const path = (name) => {
		invariant(typeof opts[name] === "string" && opts[name].length > 0, `Missing --${name}`);
		return resolve(opts[name]);
	};
	if (action === "plan") {
		const output = path("output");
		const plan = await planTests({ base: opts.base, full: opts.full, history: await loadHistory(opts.history && resolve(opts.history)), unitShards: Number(opts["unit-shards"] ?? 3), contractShards: Number(opts["contract-shards"] ?? 2) });
		await writeJson(output, plan);
		await publishPlan(plan);
	} else if (action === "run") {
		await runPlan({ plan: await json(path("plan")), kind: opts.kind, shard: Number(opts.shard), reportDir: path("report-dir") });
	} else {
		await collectHistory({ reports: path("reports"), output: path("output"), history: opts.history && resolve(opts.history) });
	}
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main().catch((error) => {
		console.error(error.stack ?? error.message);
		process.exitCode = 1;
	});
}
