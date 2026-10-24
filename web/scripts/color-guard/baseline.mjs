import { spawnSync } from "node:child_process";
import { scanSource } from "./scan.mjs";

/** 白名单身份不含行号，增删普通源码行不会产生新的豁免。 */
export function entryKey(entry) {
	return JSON.stringify([entry.file, entry.rule, entry.value]);
}

/** 同一文件、规则、违规值按出现次数限额，复制已有违规不能复用白名单。 */
export function countFindings(findings) {
	const entries = new Map();
	for (const finding of findings) {
		const key = entryKey(finding);
		const entry = entries.get(key);
		if (entry) entry.count++;
		else
			entries.set(key, {
				file: finding.file,
				rule: finding.rule,
				value: finding.value,
				count: 1,
			});
	}
	return entries;
}

/** 拒绝重复记录和无效次数，避免歧义白名单扩大允许范围。 */
export function parseBaseline(source) {
	const baseline = JSON.parse(source);
	if (baseline.version !== 1 || !Array.isArray(baseline.entries))
		throw new Error("白名单格式无效");
	const entries = new Map();
	for (const entry of baseline.entries) {
		if (
			typeof entry.file !== "string" ||
			!/\.(tsx|css)$/.test(entry.file) ||
			entry.file.startsWith("/") ||
			entry.file.split("/").includes("..") ||
			!["raw-color", "tailwind-palette", "legacy-color", "primary-hover-opacity"].includes(
				entry.rule,
			) ||
			typeof entry.value !== "string" ||
			!entry.value ||
			!Number.isSafeInteger(entry.count) ||
			entry.count < 1
		) {
			throw new Error(`白名单记录无效: ${JSON.stringify(entry)}`);
		}
		const key = entryKey(entry);
		if (entries.has(key)) throw new Error(`白名单记录重复: ${entry.file} ${entry.value}`);
		entries.set(key, entry);
	}
	return entries;
}

/** 对照 Git 基准；首次引入白名单时，以固定提交的源码而非当前白名单决定上限。 */
export function referenceBaseline(root, config, revision, entries) {
	function git(...args) {
		const result = spawnSync("git", args, {
			cwd: root,
			encoding: "utf8",
			maxBuffer: 32 * 1024 * 1024,
		});
		if (result.error) throw result.error;
		if (result.status !== 0)
			throw new Error(`Git 基准读取失败，请确认已获取完整历史: ${result.stderr.trim()}`);
		return result.stdout;
	}
	const base = git("rev-parse", "--verify", "--end-of-options", `${revision}^{commit}`).trim();
	const prefix = git("rev-parse", "--show-prefix").trim();
	const baselinePath = `${prefix}${config.baseline}`;
	if (git("ls-tree", "--full-tree", "--name-only", base, "--", baselinePath).trim()) {
		return parseBaseline(git("show", `${base}:${baselinePath}`));
	}
	const initial = git(
		"rev-parse",
		"--verify",
		"--end-of-options",
		`${config.initialRevision}^{commit}`,
	).trim();
	const findings = [];
	for (const file of new Set([...entries.values()].map((entry) => entry.file))) {
		const path = `${prefix}${file}`;
		if (git("ls-tree", "--full-tree", "--name-only", initial, "--", path).trim()) {
			findings.push(...scanSource(file, git("show", `${initial}:${path}`)));
		}
	}
	return countFindings(findings);
}
