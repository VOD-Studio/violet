import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const check = process.argv.includes("--check");
const names = ["snapshot", "themes", "quoted", "remote", "server", "card"];
for (const name of ["README.md", "README.zh-CN.md"]) {
	const path = new URL(name, root);
	const current = readFileSync(path, "utf8");
	let next = current;
	for (const example of names) {
		const start = `<!-- example:${example}:start -->`;
		const end = `<!-- example:${example}:end -->`;
		assert.equal(next.split(start).length, 2, `${name}: expected one ${start}`);
		assert.equal(next.split(end).length, 2, `${name}: expected one ${end}`);
		const source = readFileSync(new URL(`examples/${example}.tsx`, root), "utf8").trimEnd();
		const from = next.indexOf(start) + start.length;
		const to = next.indexOf(end);
		assert.ok(to > from, `${name}: invalid marker order`);
		next = `${next.slice(0, from)}\n\`\`\`tsx\n${source}\n\`\`\`\n${next.slice(to)}`;
	}
	if (check) assert.equal(current, next, `${name} examples drifted; run pnpm examples.`);
	else if (next !== current) writeFileSync(path, next);
}
