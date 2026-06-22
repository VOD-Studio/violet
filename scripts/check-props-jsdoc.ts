/**
 * 守护脚本：导出的 *Props interface 每字段必须有 JSDoc
 *
 * 检测方式：定位 export interface *Props 块，逐字段检查前一行是否有 /** 注释。
 * spec 第 9.2 节要求 Props 每字段必须 JSDoc。
 *
 * 用法：node --import tsx scripts/check-props-jsdoc.ts
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const REPO_ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf-8" }).trim();
const EXCLUDE = ["src/shared/vendor/"];

const files = execSync("git ls-files 'web/src/**/*.tsx'", {
	encoding: "utf-8",
	cwd: REPO_ROOT,
})
	.trim()
	.split("\n")
	.filter((f) => f && !EXCLUDE.some((e) => f.includes(e)))
	.map((f) => `${REPO_ROOT}/${f}`);

let errors = 0;
for (const file of files) {
	const lines = readFileSync(file, "utf-8").split("\n");
	let inProps = false;
	let braceDepth = 0;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trim();

		if (!inProps && /^export\s+interface\s+\w*Props/.test(trimmed)) {
			inProps = true;
			braceDepth = trimmed.includes("{") ? 1 : 0;
			continue;
		}
		if (inProps) {
			// 简单大括号深度跟踪，遇到闭合即结束
			for (const ch of trimmed) {
				if (ch === "{") braceDepth++;
				else if (ch === "}") braceDepth--;
			}
			if (braceDepth <= 0) {
				inProps = false;
				continue;
			}
			// 字段行：缩进的 fieldName?: type; 或 fieldName: type;
			const isField = /^\s+\w+\s*[?:].*;?\s*$/.test(line) && !trimmed.startsWith("//") && !trimmed.startsWith("/**");
			if (isField) {
				const prev = lines[i - 1]?.trim() ?? "";
				if (!prev.endsWith("*/")) {
					console.error(`✗ ${file}:${i + 1} 字段缺 JSDoc: ${trimmed}`);
					errors++;
				}
			}
		}
	}
}

if (errors > 0) {
	console.error(`\n共 ${errors} 处 Props 字段缺 JSDoc`);
	process.exit(1);
}
console.log(`✓ Props JSDoc 检查通过（${files.length} 个文件）`);
