// 把 examples/ 下的样例源码同步进 README 中 <!-- example: 名称 --> 与 <!-- /example --> 之间的代码块。
// 用法：node scripts/sync-readme.mjs [--check]；--check 只检查是否一致，不一致时以非零状态退出。
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const check = process.argv.includes("--check");
const block = /(<!-- example: ([\w-]+) -->\n)[\s\S]*?(<!-- \/example -->)/g;
let stale = false;

for (const readme of ["README.md", "README.zh-CN.md"]) {
	const file = new URL(readme, root);
	const text = readFileSync(file, "utf8");
	const next = text.replace(block, (_, open, name, close) => {
		const example = readFileSync(new URL(`examples/${name}.ts`, root), "utf8");
		// 有 #region readme 时只展示区域内的代码，导入与渲染样板留在文件里
		const region = example.match(/\/\/ #region readme\n([\s\S]*?)\n\/\/ #endregion/);
		const source = (region ? region[1] : example).trimEnd();
		return `${open}\n\`\`\`ts\n${source}\n\`\`\`\n\n${close}`;
	});
	if (next === text) continue;
	stale = true;
	if (check) console.error(`${readme} is out of sync with examples/; run pnpm examples.`);
	else {
		writeFileSync(file, next);
		console.log(`Updated ${readme}`);
	}
}

if (check && stale) process.exit(1);
