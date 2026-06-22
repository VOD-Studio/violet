/**
 * 守护脚本：每个 .tsx 文件（排除 vendor/app/routes）只能有 1 个组件
 *
 * 检测方式：用正则匹配 PascalCase 命名的组件定义特征。
 * 第三方组件库组合（如 <Card><Button/></Card>）不算内部组件定义。
 *
 * 用法：node --import tsx scripts/check-single-component.ts
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const REPO_ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf-8" }).trim();
const EXCLUDE = [
	"src/shared/vendor/", // 第三方 copy-paste
	"src/shared/ui/", // shadcn/ui 生成的多组件文件
	"src/routeTree.gen.ts",
	"src/app/",
	"src/routes/__root.tsx", // TanStack Start 约定：component + shellComponent 必须双组件
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
	// 匹配组件定义：const Foo = (...) => / function Foo(...）/ {
	// 不匹配类型断言（如 RootDocument({ children }: { children: X })）——
	// 这些是匿名参数类型，没有 const/function 关键字前缀
	const componentDefs =
		content.match(
			/\b(?:const|function)\s+([A-Z][a-zA-Z0-9]+)\s*(?:=\s*(?:\(|async)|\()/g,
		) ?? [];
	if (componentDefs.length > 1) {
		console.error(`✗ ${file}: 检测到 ${componentDefs.length} 个组件（应仅 1 个）`);
		errors++;
	}
}

if (errors > 0) {
	console.error(`\n共 ${errors} 个文件违反"一文件一组件"规则`);
	process.exit(1);
}
console.log(`✓ 一文件一组件检查通过（${files.length} 个文件）`);
