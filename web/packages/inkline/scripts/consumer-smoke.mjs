// 检查 README 样例与 examples/ 一致，再打包 tarball，在工作区外的临时项目中安装，验证发布内容、类型、Node 运行与打包体积。
// 用法：node scripts/consumer-smoke.mjs [--keep]
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { build } from "esbuild";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const packageJson = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8"));
const packageRequire = createRequire(resolve(packageRoot, "package.json"));
const temporaryRoot = realpathSync(mkdtempSync(resolve(tmpdir(), "inkline-consumer-")));
const consumerRoot = resolve(temporaryRoot, "consumer");
mkdirSync(consumerRoot);
const keep = process.argv.includes("--keep");
// 默认笔、自然手法与 SVG 渲染的 gzip 体积上限，防止无意中把大模块拉进默认入口
const DEFAULT_BUNDLE_LIMIT = 12 * 1024;

const run = (command, args, cwd) => {
	const result = spawnSync(command, args, { cwd, stdio: "inherit", env: process.env });
	assert.equal(result.status, 0, `${command} ${args.join(" ")} failed.`);
};
const output = (command, args, cwd) => {
	const result = spawnSync(command, args, { cwd, encoding: "utf8", env: process.env });
	assert.equal(result.status, 0, `${command} ${args.join(" ")} failed.`);
	return result.stdout;
};
const installedVersion = (name) => {
	let directory;
	try {
		return JSON.parse(readFileSync(packageRequire.resolve(`${name}/package.json`), "utf8")).version;
	} catch {
		directory = dirname(packageRequire.resolve(name));
	}
	for (;;) {
		try {
			const metadata = JSON.parse(readFileSync(resolve(directory, "package.json"), "utf8"));
			if (metadata.name === name) return metadata.version;
		} catch {}
		const parent = dirname(directory);
		assert.notEqual(parent, directory, `Cannot resolve installed version of ${name}.`);
		directory = parent;
	}
};

try {
	// README 中的样例代码须与 examples/ 一致，图与代码才能对应
	run("pnpm", ["examples:check"], packageRoot);
	run("pnpm", ["pack", "--pack-destination", temporaryRoot], packageRoot);
	const tarball = resolve(temporaryRoot, readdirSync(temporaryRoot).find((name) => name.endsWith(".tgz")));

	const files = output("tar", ["-tzf", tarball], temporaryRoot)
		.split("\n")
		.filter(Boolean)
		.map((path) => path.replace(/^package\//, ""));
	for (const required of [
		"package.json",
		"README.md",
		"README.zh-CN.md",
		"CHANGELOG.md",
		"LICENSE",
		"dist/index.js",
		"dist/index.d.ts",
		"dist/render/svg.js",
		"dist/render/svg.d.ts",
		"dist/render/canvas.js",
		"dist/render/canvas.d.ts",
	])
		assert.ok(files.includes(required), `Tarball is missing ${required}.`);
	for (const path of files)
		assert.ok(
			path === "package.json" || /^(?:README(?:\.zh-CN)?\.md|CHANGELOG\.md|LICENSE|dist\/.+)$/.test(path),
			`Tarball should not contain ${path}.`,
		);
	assert.ok(!files.some((path) => /\.test\./.test(path)), "Tarball contains tests.");

	const packed = JSON.parse(output("tar", ["-xzOf", tarball, "package/package.json"], temporaryRoot));
	assert.equal(packed.private, undefined, "Packed manifest must not be private.");
	assert.equal(packed.exports["."].import, "./dist/index.js");
	assert.equal(packed.exports["."].types, "./dist/index.d.ts");
	for (const renderer of ["svg", "canvas"]) {
		assert.equal(packed.exports[`./${renderer}`].import, `./dist/render/${renderer}.js`);
		assert.equal(packed.exports[`./${renderer}`].types, `./dist/render/${renderer}.d.ts`);
	}
	assert.equal(packed.sideEffects, false);
	assert.equal(packed.engines.node, ">=18");
	assert.equal(packed.types, "./dist/index.d.ts");
	assert.equal(packed.license, "MIT");

	const consumerPackage = {
		name: "inkline-independent-consumer",
		private: true,
		type: "module",
		dependencies: { [packageJson.name]: `file:${tarball}` },
		devDependencies: {
			typescript: installedVersion("typescript"),
			"@types/node": installedVersion("@types/node"),
		},
	};
	writeFileSync(resolve(consumerRoot, "package.json"), `${JSON.stringify(consumerPackage, null, 2)}\n`);
	writeFileSync(resolve(consumerRoot, "pnpm-workspace.yaml"), "packages: []\n");
	run("pnpm", ["install", "--prefer-offline", "--ignore-scripts", "--no-frozen-lockfile"], consumerRoot);

	const consumerRequire = createRequire(resolve(consumerRoot, "package.json"));
	const entry = realpathSync(consumerRequire.resolve(packageJson.name));
	assert.ok(
		entry.startsWith(`${consumerRoot}${sep}`) && entry.endsWith(`${sep}dist${sep}index.js`),
		"Consumer resolves workspace source instead of the installed dist.",
	);

	writeFileSync(
		resolve(consumerRoot, "types.ts"),
		`import { createGPen, createPlayer, createSchedule, draw, fills, gpen, lineWashStyle, rect, styles, type Drawing, type Pen, type SceneItem, type Style } from "${packageJson.name}";
import { mountSvg, renderSvg, seekSvg, updateSvgPalette } from "${packageJson.name}/svg";
import { drawCanvas } from "${packageJson.name}/canvas";

const item: SceneItem = { id: "card", path: rect(0, 0, 40, 30, 4), fillRole: "surface" };
const style: Style = { ...styles.natural, fill: fills.hachure, pen: createGPen({ pressure: 0.5 }) };
const drawing: Drawing = draw({ width: 40, height: 30, items: [item] }, { style, seed: 1 });
const markup: string = renderSvg(drawing, { paper: "#fff", ink: "#000", surface: "#ccc" });
const pen: Pen = gpen;
export const checks = [markup, pen, lineWashStyle, mountSvg, seekSvg, updateSvgPalette, drawCanvas, createSchedule, createPlayer];
`,
	);
	const compilerOptions = {
		target: "ES2022",
		lib: ["ES2022", "DOM"],
		strict: true,
		noEmit: true,
		skipLibCheck: false,
		types: ["node"],
	};
	writeFileSync(
		resolve(consumerRoot, "tsconfig.json"),
		JSON.stringify({ compilerOptions: { ...compilerOptions, module: "ESNext", moduleResolution: "Bundler" }, files: ["types.ts"] }),
	);
	writeFileSync(
		resolve(consumerRoot, "tsconfig.nodenext.json"),
		JSON.stringify({ compilerOptions: { ...compilerOptions, module: "NodeNext", moduleResolution: "NodeNext" }, files: ["types.ts"] }),
	);
	run("pnpm", ["exec", "tsc", "-p", "tsconfig.json"], consumerRoot);
	run("pnpm", ["exec", "tsc", "-p", "tsconfig.nodenext.json"], consumerRoot);

	writeFileSync(
		resolve(consumerRoot, "render.mjs"),
		`import assert from "node:assert/strict";
import { circle, draw, lineWashStyle, styles } from "${packageJson.name}";
import { renderSvg } from "${packageJson.name}/svg";

const scene = { width: 120, height: 120, items: [{ id: "moon", path: circle(60, 60, 40), fillRole: "moon" }] };
const palette = { paper: "#fff", ink: "#222", moon: "#f7e6a1" };
for (const style of [styles.natural, styles.draft, lineWashStyle]) {
	const first = renderSvg(draw(scene, { style, seed: 3 }), palette);
	const second = renderSvg(draw(scene, { style, seed: 3 }), palette);
	assert.match(first, /^<svg[^>]+viewBox="0 0 120 120"/);
	assert.match(first, /<path d="M/);
	// clipPath id 带递增序号以免同页冲突，比较几何时去掉
	const geometry = (svg) => svg.replace(/inkline-\\d+-/g, "");
	assert.equal(geometry(first), geometry(second), "Same input and seed must render identically.");
}
console.log("Installed tarball renders deterministic SVG in Node.");
`,
	);
	run(process.execPath, ["render.mjs"], consumerRoot);

	const bundle = await build({
		absWorkingDir: consumerRoot,
		stdin: {
			contents: `import { draw, rect, styles } from "${packageJson.name}";
import { renderSvg } from "${packageJson.name}/svg";
console.log(renderSvg(draw({ width: 10, height: 10, items: [{ id: "r", path: rect(1, 1, 5, 5) }] }, { style: styles.natural }), { paper: "#fff", ink: "#000" }));`,
			resolveDir: consumerRoot,
			loader: "js",
		},
		bundle: true,
		metafile: true,
		minify: true,
		format: "esm",
		platform: "browser",
		write: false,
		logLevel: "silent",
	});
	const gzip = gzipSync(bundle.outputFiles[0].contents, { level: 9 }).length;
	console.log(`Default pen + SVG renderer: ${gzip} bytes gzip.`);
	assert.ok(gzip <= DEFAULT_BUNDLE_LIMIT, `Default bundle grew to ${gzip} bytes gzip (limit ${DEFAULT_BUNDLE_LIMIT}).`);
	const included = Object.values(bundle.metafile.outputs).flatMap((file) =>
		Object.entries(file.inputs).filter(([, input]) => input.bytesInOutput > 0).map(([path]) => path),
	);
	for (const excluded of ["fill/wash.js", "pen/ribbon.js", "pen/brushes.js", "render/canvas.js"]) {
		assert.ok(!included.some((path) => path.endsWith(excluded)), `Tree shaking retained ${excluded}.`);
	}
	assert.ok(included.every((path) => path === "<stdin>" || !path.includes(packageRoot)), "Bundle leaked workspace source.");

	console.log(`${packageJson.name}@${packageJson.version} tarball passed the independent consumer check.`);
} finally {
	if (keep) console.log(`Kept ${temporaryRoot}`);
	else rmSync(temporaryRoot, { recursive: true, force: true });
}
