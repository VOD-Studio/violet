// Generate the README illustrations, or compare them byte-for-byte with --check.
// Requires Node >=22.18; artwork is data, never an import of a site module.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const check = process.argv.includes("--check");
const out = new URL("../docs/images/", import.meta.url);
if (!check) mkdirSync(out, { recursive: true });

const write = (name: string, svg: string) => {
	const target = new URL(`${name}.svg`, out);
	if (check) {
		assert.equal(readFileSync(target, "utf8"), svg, `${name}.svg is stale; run pnpm examples.`);
	} else {
		writeFileSync(target, svg);
	}
	console.log(`${check ? "Checked" : "Wrote"} ${name}.svg  ${(svg.length / 1024).toFixed(0)} KB`);
};

for (const name of ["quick-start", "pens", "hands", "fills", "line-wash", "diagram"]) {
	const example: { svg: string } = await import(`../examples/${name}.ts`);
	write(name, example.svg);
}

// 首图由 examples/artwork.ts 处理传入的画稿生成
const artworkFlag = process.argv.indexOf("--artwork");
if (artworkFlag > 0) {
	assert.ok(
		process.argv[artworkFlag + 1] && !process.argv[artworkFlag + 1].startsWith("--"),
		"--artwork requires a JSON path.",
	);
	const { inkArtwork } = await import("../examples/artwork.ts");
	write(
		"illustration",
		inkArtwork(JSON.parse(readFileSync(process.argv[artworkFlag + 1], "utf8"))),
	);
}
