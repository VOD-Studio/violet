import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import {
	countFindings,
	entryKey,
	parseBaseline,
	referenceBaseline,
} from "./color-guard/baseline.mjs";
import { scanProject } from "./color-guard/scan.mjs";

try {
	const { values } = parseArgs({ options: { base: { type: "string" } } });
	const root = process.cwd();
	const config = JSON.parse(readFileSync(resolve(root, "color-guard.config.json"), "utf8"));
	const baseline = parseBaseline(readFileSync(resolve(root, config.baseline), "utf8"));
	const previous = referenceBaseline(
		root,
		config,
		values.base || process.env.COLOR_GUARD_BASE || "HEAD",
		baseline,
	);
	const findings = scanProject(root, config);
	const counts = countFindings(findings);
	const errors = [];
	for (const [key, entry] of baseline) {
		if (entry.count > (previous.get(key)?.count ?? 0)) {
			errors.push(
				`${config.baseline}: [baseline-growth] 白名单只能减少: ${entry.file} ${entry.rule} ${entry.value} (${previous.get(key)?.count ?? 0} → ${entry.count})`,
			);
		}
		const actual = counts.get(key)?.count ?? 0;
		if (entry.count > actual) {
			errors.push(
				`${config.baseline}: [baseline-stale] 请将 ${entry.file} ${entry.value} 的次数从 ${entry.count} 减为 ${actual}${actual === 0 ? "，并删除该记录" : ""}`,
			);
		}
	}
	const seen = new Map();
	for (const finding of findings) {
		const key = entryKey(finding);
		const count = (seen.get(key) ?? 0) + 1;
		seen.set(key, count);
		if (count > (baseline.get(key)?.count ?? 0)) {
			errors.push(
				`${finding.file}:${finding.line}:${finding.column}: [${finding.rule}] ${finding.value}${finding.message ? ` — ${finding.message}` : ""}`,
			);
		}
	}
	if (errors.length) {
		console.error(errors.join("\n"));
		console.error(
			`颜色检查失败：${errors.length} 项。请改用语义 token；存量白名单只允许删减。`,
		);
		process.exitCode = 1;
	} else {
		console.log(
			`颜色检查通过：${findings.length} 处存量违规，${baseline.size} 条白名单，无新增。`,
		);
	}
} catch (error) {
	console.error(`颜色检查失败：${error.message}`);
	process.exitCode = 1;
}
