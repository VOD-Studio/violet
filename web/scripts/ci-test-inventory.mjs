import { execFile, spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { invariant, PACKAGE_NAMES, safeFile, sorted } from "./ci-test-data.mjs";

const execute = promisify(execFile);
export const SITE_EXCLUDE = "packages/{ui,react-tweet,kanban,theme}/**";

export async function command(program, args, cwd, env = {}) {
	const result = await execute(program, args, { cwd, env: { ...process.env, ...env }, maxBuffer: 64 * 1024 * 1024 });
	return result.stdout;
}

export async function git(root, args) {
	return (await command("git", args, root)).trim();
}

export async function revision(root, ref = "HEAD") {
	invariant(!ref.startsWith("-"), "Invalid Git revision");
	const sha = await git(root, ["rev-parse", "--verify", `${ref}^{commit}`]);
	invariant(/^[a-f0-9]{40}$/.test(sha), "Git did not return a complete revision");
	return sha;
}

export async function changedFiles(root, base) {
	const output = await command("git", ["diff", "--name-status", "--no-renames", "-z", `${base}...HEAD`, "--"], root);
	const tokens = output.split("\0");
	const changes = [];
	for (let index = 0; index < tokens.length - 1; index += 2) {
		invariant(/^[AMDTUX]$/.test(tokens[index]) && tokens[index + 1], "Unexpected Git diff format");
		changes.push({ status: tokens[index], file: tokens[index + 1] });
	}
	return changes;
}

export async function listUnit(webRoot, changed) {
	const temporary = await mkdtemp(resolve(tmpdir(), "violet-vitest-list-"));
	try {
		const output = resolve(temporary, "inventory.json");
		const args = [resolve(webRoot, "node_modules/vitest/vitest.mjs"), "list", "--filesOnly", `--json=${output}`, "--exclude", SITE_EXCLUDE];
		if (changed) {
			args.push(`--changed=${changed}`);
		}
		await command(process.execPath, args, webRoot);
		const files = JSON.parse(await readFile(output, "utf8"));
		invariant(Array.isArray(files), "Invalid Vitest file list");
		const result = files.map((entry) => safeFile(relative(webRoot, isAbsolute(entry.file) ? entry.file : resolve(webRoot, entry.file))));
		invariant(new Set(result).size === result.length, "Vitest returned duplicate files/projects; add an explicit scheduling boundary");
		return result.sort();
	} finally {
		await rm(temporary, { recursive: true, force: true });
	}
}

export async function listContract(webRoot, reporter) {
	const temporary = await mkdtemp(resolve(tmpdir(), "violet-playwright-list-"));
	try {
		const output = resolve(temporary, "inventory.json");
		await command(process.execPath, [resolve(webRoot, "node_modules/@playwright/test/cli.js"), "test", "--list", `--reporter=${reporter}`], webRoot, { CI_TEST_REPORT: output, CI_TEST_WEB_ROOT: webRoot, CI_TEST_LIST: "1" });
		const result = JSON.parse(await readFile(output, "utf8"));
		invariant(result.version === 1 && result.kind === "contract" && Array.isArray(result.files), "Invalid Playwright file list");
		invariant(new Set(result.files.map((entry) => entry.file)).size === result.files.length, "Duplicate Playwright file inventory");
		return result.files.map((entry) => safeFile(entry.file)).sort();
	} finally {
		await rm(temporary, { recursive: true, force: true });
	}
}

export async function runProcess(program, args, cwd, env) {
	return new Promise((resolveRun, reject) => {
		const child = spawn(program, args, { cwd, env: { ...process.env, ...env }, stdio: "inherit" });
		child.once("error", reject);
		child.once("exit", (code, signal) => resolveRun({ code, signal }));
	});
}

export function documentation(file) {
	return /^(README|CHANGELOG|CONTEXT|CONTRIBUTING|SECURITY|PRODUCT|DESIGN)\.md$/.test(file)
		|| /^(api|web)\/README\.md$/.test(file)
		|| /^docs\/.*\.(md|txt|png|jpe?g|gif|svg|webp)$/i.test(file)
		|| /^(LICENSE|NOTICE)(\.[^/]*)?$/.test(file);
}

/** URL-served tests need an explicit business mapping; unclassified code runs all tests. */
export function affectedScope(changes, mapping, contractInventory) {
	invariant(mapping?.version === 1 && Array.isArray(mapping.always) && Array.isArray(mapping.rules), "Unsupported browser test map");
	const knownSpecs = sorted([...mapping.always, ...mapping.rules.flatMap((rule) => rule.specs)]);
	const reasons = [];
	const selected = new Set();
	let full = false;
	const changedPackages = new Set();
	const relevant = [];
	const forceFull = (reason) => {
		full = true;
		reasons.push(reason);
	};
	for (const { file, status } of changes) {
		if (documentation(file) || /^(CHANGELOG\.md|\.release-please-manifest\.json|release-please-config\.json)$/.test(file)) {
			continue;
		}
		if (file.startsWith("api/")) {
			continue;
		}
		if (!file.startsWith("web/")) {
			forceFull(`Shared or unclassified repository change: ${file}`);
			continue;
		}
		const local = file.slice(4);
		if (/[^\x21-\x7e]|["\\]/.test(local)) {
			forceFull(`Filename is unsafe for Vitest Git line-based discovery: ${JSON.stringify(local)}`);
		}
		relevant.push(local);
		const packageName = /^packages\/([^/]+)\//.exec(local)?.[1];
		if (packageName && PACKAGE_NAMES.includes(packageName)) {
			changedPackages.add(packageName);
		}
		if (status === "D" || status === "T" || status === "U" || status === "X") {
			forceFull(`Deleted or replaced executable path: ${local}`);
			continue;
		}
		if (/^e2e\/.*\.spec\.[cm]?[jt]sx?$/.test(local)) {
			selected.add(local);
			reasons.push(`Changed browser contract: ${local}`);
			continue;
		}
		if (packageName) {
			forceFull(`Package change includes site consumers: ${packageName}`);
			continue;
		}
		const rules = mapping.rules.filter((rule) => rule.prefixes.some((prefix) => local.startsWith(prefix)));
		if (rules.length === 0) {
			forceFull(`Shared or unmapped web change: ${local}`);
			continue;
		}
		for (const rule of rules) {
			rule.specs.forEach((spec) => selected.add(spec));
			reasons.push(`Browser business mapping: ${rule.name}`);
		}
		mapping.always.forEach((spec) => selected.add(spec));
	}
	if (relevant.length > 0 && contractInventory.some((file) => !knownSpecs.includes(file) && !selected.has(file))) {
		forceFull("Browser inventory contains an unmapped contract; using full selection");
	}
	if (relevant.length > 0 && knownSpecs.some((file) => !contractInventory.includes(file))) {
		forceFull("Browser mapping names an absent contract; using actual full inventory");
	}
	return { full, reasons: sorted(reasons), relevant, changedPackages: [...changedPackages], contract: full ? contractInventory : sorted(selected) };
}

/** Package changes propagate through workspace dependency and peer-dependency edges. */
export async function packageDependents(webRoot, changed) {
	const manifests = await Promise.all(PACKAGE_NAMES.map(async (name) => ({ name, manifest: JSON.parse(await readFile(resolve(webRoot, "packages", name, "package.json"), "utf8")) })));
	const selected = new Set(changed);
	let previousSize = -1;
	while (previousSize !== selected.size) {
		previousSize = selected.size;
		const dependencyNames = manifests.filter(({ name }) => selected.has(name)).map(({ manifest }) => manifest.name);
		for (const { name, manifest } of manifests) {
			const dependencies = { ...manifest.dependencies, ...manifest.devDependencies, ...manifest.peerDependencies, ...manifest.optionalDependencies };
			if (dependencyNames.some((dependency) => Object.hasOwn(dependencies, dependency))) {
				selected.add(name);
			}
		}
	}
	return PACKAGE_NAMES.filter((name) => selected.has(name));
}

export function ensureSelectedInventory(selected, inventory, label) {
	invariant(selected.every((file) => inventory.includes(file)), `${label} dependency selection returned a test outside the actual inventory`);
	invariant(new Set(selected).size === selected.length, `${label} returned duplicate test files`);
}
