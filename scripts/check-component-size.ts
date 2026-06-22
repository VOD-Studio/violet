/**
 * 守护脚本：组件文件长度限制
 *
 * 规则（spec 第 9.2 节）：
 * - routes/**：≤ 400 行（页面组件）
 * - widgets/**：≤ 250 行（复杂业务组件）
 * - 其他 .tsx：≤ 150 行（普通组件）
 *
 * 用法：node --import tsx scripts/check-component-size.ts
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const REPO_ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf-8" }).trim();
const LIMITS: Array<{ pattern: string; max: number; label: string }> = [
	{ pattern: "src/routes/", max: 400, label: "路由文件" },
	{ pattern: "src/widgets/", max: 250, label: "widget 组件" },
	{ pattern: ".tsx", max: 150, label: "普通组件" },
];

const EXCLUDE = [
	"src/shared/vendor/", // 第三方 copy-paste
	"src/shared/ui/", // shadcn/ui 生成的多组件文件
	"src/routeTree.gen.ts",
];

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
	const content = readFileSync(file, "utf-8");
	const lines = content.split("\n").length;
	for (const { pattern, max, label } of LIMITS) {
		if (file.includes(pattern) && lines > max) {
			console.error(`✗ ${file}: ${lines} 行超过 ${label} 上限 ${max}`);
			errors++;
			break;
		}
	}
}

if (errors > 0) {
	console.error(`\n共 ${errors} 个文件超出长度限制`);
	process.exit(1);
}
console.log(`✓ 文件长度检查通过（${files.length} 个文件）`);
