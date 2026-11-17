const KINDS = ["unit", "contract"];
export const PACKAGE_NAMES = ["ui", "inkline", "react-tweet", "kanban", "theme"];
export const HISTORY_LIMIT = 10;
const MAX_HISTORY_FILES = 5_000;

export function invariant(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
}

export function sorted(values) {
	return [...new Set(values)].sort();
}

export function equalFiles(actual, expected, label) {
	const left = sorted(actual);
	const right = sorted(expected);
	invariant(JSON.stringify(left) === JSON.stringify(right), `${label}: missing=${right.filter((file) => !left.includes(file)).join(",")} unexpected=${left.filter((file) => !right.includes(file)).join(",")}`);
}

export function safeFile(file) {
	invariant(typeof file === "string" && file.length > 0 && !file.startsWith("/") && !file.split("/").includes("..") && !/[\\\r\n\0]/.test(file), `Unsafe test path: ${JSON.stringify(file)}`);
	return file;
}

export function median(values) {
	const ordered = [...values].sort((a, b) => a - b);
	const middle = Math.floor(ordered.length / 2);
	return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

/** Unknown files cost at least the slowest recorded file until measured. */
export function splitFiles(files, count, history = {}) {
	invariant(Number.isSafeInteger(count) && count > 0 && count <= 100, "Shard count must be between 1 and 100");
	const estimates = Object.values(history).map((entry) => median(entry.samples.map((sample) => sample.ms)));
	const unknownCost = Math.max(1_000, ...estimates);
	const cost = (file) => history[file] ? median(history[file].samples.map((sample) => sample.ms)) : unknownCost;
	const shards = Array.from({ length: count }, (_, index) => ({ id: index + 1, files: [], estimatedMs: 0 }));
	for (const file of sorted(files).sort((a, b) => cost(b) - cost(a) || a.localeCompare(b, "en"))) {
		const shard = [...shards].sort((a, b) => a.estimatedMs - b.estimatedMs || a.files.length - b.files.length || a.id - b.id)[0];
		shard.files.push(file);
		shard.estimatedMs += cost(file);
	}
	return shards.map((shard) => ({ ...shard, files: shard.files.sort() }));
}

export function validateHistory(value) {
	invariant(value?.version === 1 && value.files && typeof value.files === "object", "Unsupported duration history format");
	for (const kind of KINDS) {
		invariant(value.files[kind] && typeof value.files[kind] === "object" && !Array.isArray(value.files[kind]), `Missing ${kind} history`);
		invariant(Object.keys(value.files[kind]).length <= MAX_HISTORY_FILES, "Duration history is too large");
		for (const [file, entry] of Object.entries(value.files[kind])) {
			safeFile(file);
			invariant(Array.isArray(entry.samples) && entry.samples.length > 0 && entry.samples.length <= HISTORY_LIMIT, `Invalid duration samples for ${file}`);
			const runs = new Set();
			for (const sample of entry.samples) {
				invariant(typeof sample.run === "string" && sample.run.length > 0 && !runs.has(sample.run) && Number.isFinite(sample.ms) && sample.ms > 0 && Number.isFinite(Date.parse(sample.at)) && /^[a-f0-9]{40}$/.test(sample.revision), `Invalid duration sample for ${file}`);
				runs.add(sample.run);
			}
		}
	}
	return value;
}

export function emptyHistory() {
	return { version: 1, files: { unit: {}, contract: {} } };
}

export function validatePlan(plan, revision, actualInventory) {
	invariant(plan?.version === 1 && ["full", "affected"].includes(plan.mode), "Unsupported test plan format");
	invariant(/^[a-f0-9]{40}$/.test(plan.revision) && plan.revision === revision, `Plan revision ${plan.revision} does not match checkout ${revision}`);
	invariant(plan.base === null || /^[a-f0-9]{40}$/.test(plan.base), "Invalid plan base revision");
	invariant(Array.isArray(plan.packages) && plan.packages.every((name) => PACKAGE_NAMES.includes(name)) && new Set(plan.packages).size === plan.packages.length, "Invalid package selection");
	invariant((plan.mode === "full") === (plan.base === null), "Plan mode does not match its base revision");
	invariant(Array.isArray(plan.reasons) && plan.reasons.every((reason) => typeof reason === "string"), "Invalid plan reasons");
	if (plan.mode === "full") {
		equalFiles(plan.packages, PACKAGE_NAMES, "Full package plan omits packages");
	}
	for (const kind of KINDS) {
		invariant(Array.isArray(plan[kind]) && plan[kind].length > 0 && plan[kind].length <= 100 && Array.isArray(plan.inventory?.[kind]) && Array.isArray(plan.selected?.[kind]), `Missing ${kind} inventory`);
		const inventory = plan.inventory[kind].map(safeFile);
		const selected = plan.selected[kind].map(safeFile);
		invariant(new Set(inventory).size === inventory.length && new Set(selected).size === selected.length, `Duplicate ${kind} inventory`);
		const union = [];
		for (const [index, shard] of plan[kind].entries()) {
			invariant(shard.id === index + 1 && Array.isArray(shard.files), `Invalid ${kind} shard ID`);
			union.push(...shard.files.map(safeFile));
		}
		invariant(new Set(union).size === union.length, `Duplicate ${kind} shard assignments`);
		equalFiles(union, selected, `${kind} shard union differs from selected inventory`);
		invariant(selected.every((file) => inventory.includes(file)), `Selected ${kind} test is absent from inventory`);
		if (plan.mode === "full") {
			equalFiles(selected, inventory, `Full ${kind} plan omits tests`);
		}
		if (actualInventory?.[kind]) {
			equalFiles(actualInventory[kind], inventory, `${kind} inventory changed after planning`);
		}
	}
	return plan;
}

export function validateRun(raw, files, kind) {
	invariant(raw?.version === 1 && raw.kind === kind && Array.isArray(raw.files), "Missing or invalid runner report");
	invariant(new Set(raw.files.map((entry) => entry.file)).size === raw.files.length, "Runner reported duplicate files");
	equalFiles(raw.files.map((entry) => entry.file), files, "Runner did not execute the exact planned files");
	for (const entry of raw.files) {
		invariant(Number.isSafeInteger(entry.tests) && Number.isSafeInteger(entry.executed) && entry.tests > 0 && entry.executed > 0 && entry.executed <= entry.tests, `Selected file ran no tests: ${entry.file}`);
		invariant(entry.success === true, `Selected file did not pass: ${entry.file}`);
	}
	invariant(raw.success === true, "Runner did not complete successfully");
	return raw.files.filter((entry) => entry.healthy && Number.isFinite(entry.durationMs) && entry.durationMs > 0).map(({ file, durationMs }) => ({ file, durationMs }));
}

export function mergeHistory(oldHistory, reports) {
	const history = structuredClone(validateHistory(oldHistory));
	const reportRuns = new Set();
	for (const report of reports) {
		invariant(report?.version === 1 && report.type === "ci-test-run" && KINDS.includes(report.kind) && /^[a-f0-9]{40}$/.test(report.revision) && Number.isSafeInteger(report.shard) && report.shard > 0 && typeof report.success === "boolean" && Number.isFinite(Date.parse(report.at)) && typeof report.run === "string" && report.run.length > 0 && Array.isArray(report.planned) && Array.isArray(report.durations), "Invalid test run summary");
		report.planned.forEach(safeFile);
		invariant(new Set(report.planned).size === report.planned.length, "Duplicate planned files in run summary");
		invariant(report.planned.length > 0 || report.durations.length === 0, "Empty run includes duration measurements");
		invariant(!reportRuns.has(report.run), `Duplicate test run summary: ${report.run}`);
		reportRuns.add(report.run);
		if (!report.success || report.planned.length === 0) {
			continue;
		}
		invariant(report.durations.every((entry) => report.planned.includes(entry.file)) && new Set(report.durations.map((entry) => entry.file)).size === report.durations.length, "Duration report includes unplanned or duplicate files");
		for (const { file, durationMs } of report.durations) {
			safeFile(file);
			invariant(Number.isFinite(durationMs) && durationMs > 0, `Invalid measured duration for ${file}`);
			const record = history.files[report.kind][file] ?? { samples: [] };
			const previous = record.samples.find((sample) => sample.run === report.run);
			invariant(!previous || (previous.ms === durationMs && previous.revision === report.revision && previous.at === report.at), `Conflicting duration for ${file}`);
			if (!previous) {
				record.samples.push({ run: report.run, revision: report.revision, at: report.at, ms: durationMs });
			}
			record.samples.sort((a, b) => a.at.localeCompare(b.at) || a.run.localeCompare(b.run));
			record.samples = record.samples.slice(-HISTORY_LIMIT);
			record.medianMs = median(record.samples.map((sample) => sample.ms));
			history.files[report.kind][file] = record;
		}
	}
	for (const kind of KINDS) {
		const entries = Object.entries(history.files[kind]).sort(([fileA, a], [fileB, b]) => b.samples.at(-1).at.localeCompare(a.samples.at(-1).at) || fileA.localeCompare(fileB));
		history.files[kind] = Object.fromEntries(entries.slice(0, MAX_HISTORY_FILES).sort(([a], [b]) => a.localeCompare(b)));
	}
	return history;
}
