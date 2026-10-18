import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const check = process.argv.includes("--check");
const examples = ["quick-start", "editable", "canvas", "graph"];

for (const name of ["README.md", "README.zh-CN.md"]) {
	const path = new URL(name, root);
	const current = readFileSync(path, "utf8");
	let next = current;
	const markers = [...current.matchAll(/<!-- example:([^:>]+):(start|end) -->/g)];
	assert.equal(markers.length, examples.length * 2, `${name}: unexpected example markers`);
	for (const example of examples) {
		const start = `<!-- example:${example}:start -->`;
		const end = `<!-- example:${example}:end -->`;
		assert.equal(next.split(start).length, 2, `${name}: expected one ${start}`);
		assert.equal(next.split(end).length, 2, `${name}: expected one ${end}`);
		const from = next.indexOf(start) + start.length;
		const to = next.indexOf(end);
		assert.ok(to > from, `${name}: invalid marker order for ${example}`);
		assert.ok(!/<!-- example:/.test(next.slice(from, to)), `${name}: nested example markers`);
		const source = readFileSync(new URL(`examples/${example}.tsx`, root), "utf8").trimEnd();
		next = `${next.slice(0, from)}\n\`\`\`tsx\n${source}\n\`\`\`\n${next.slice(to)}`;
	}
	if (check) assert.ok(current === next, `${name}: examples drifted; run make kanban-examples.`);
	else if (next !== current) writeFileSync(path, next);
}

console.log(check ? "README examples match all four source files." : "README examples synchronized.");
