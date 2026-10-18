import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { writeSSRFixture, writeTypeFixture } from "./consumer-fixtures.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const metadata = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const require = createRequire(resolve(root, "package.json"));
const temporary = realpathSync(mkdtempSync(resolve(tmpdir(), "kanban-consumer-")));
const consumer = resolve(temporary, "consumer");
const keep = process.argv.includes("--keep");
mkdirSync(consumer);

const run = (command, args, cwd, capture = false) => {
	const result = spawnSync(command, args, { cwd, env: process.env, encoding: "utf8", stdio: capture ? "pipe" : "inherit" });
	if (result.error) throw result.error;
	assert.equal(result.status, 0, `${command} ${args.join(" ")} failed.\n${result.stderr ?? ""}`);
	return result.stdout;
};
const write = (name, value) => writeFileSync(resolve(consumer, name), value);
const installedVersion = (name) => JSON.parse(readFileSync(require.resolve(`${name}/package.json`), "utf8")).version;
const examples = [
	["quick-start", "QuickStart", "快速开始"],
	["editable", "EditableBoard", "可编辑看板"],
	["canvas", "CanvasBoard", "画布"],
	["graph", "Graph", "关系图"],
];

try {
	console.log("检查 README 与示例同步状态。");
	run(process.execPath, ["scripts/sync-readme.mjs", "--check"], root);
	run("pnpm", ["pack", "--pack-destination", temporary], root);
	const tarballs = readdirSync(temporary).filter((name) => name.endsWith(".tgz"));
	assert.equal(tarballs.length, 1);
	const tarball = resolve(temporary, tarballs[0]);

	// 压缩包只含声明的文件，且包含全部入口与样式。
	const files = run("tar", ["-tzf", tarball], temporary, true)
		.trim()
		.split("\n")
		.map((name) => name.replace(/^package\//, ""));
	for (const name of [
		"package.json",
		"README.md",
		"README.zh-CN.md",
		"docs/api.md",
		"DEVELOPMENT.md",
		...examples.map(([name]) => `examples/${name}.tsx`),
		"LICENSE",
		"dist/index.js",
		"dist/unstyled.js",
		"dist/unstyled.d.ts",
		"dist/core/index.js",
		"dist/core/index.d.ts",
		"dist/canvas/index.js",
		"dist/canvas/index.d.ts",
		"dist/canvas/canvas.css",
		"dist/graph/index.js",
		"dist/graph/index.d.ts",
		"dist/graph/graph.css",
		"dist/styles.css",
		"dist/board/board.css",
		"dist/board/shell.css",
		"dist/board/switcher.css",
		"dist/board/relations/relations.css",
		"dist/history/history.css",
	])
		assert.ok(files.includes(name), `Missing packed file: ${name}`);
	for (const name of files)
		assert.ok(
			/^(?:package\.json|README(?:\.zh-CN)?\.md|DEVELOPMENT\.md|docs\/api\.md|examples\/(?:quick-start|editable|canvas|graph)\.tsx|LICENSE|dist\/.+)$/.test(name) && !/\.test\.|^dist\/test\/|(?:^|\/)src\/|\.map$/.test(name),
			`Unexpected packed file: ${name}`,
		);

	const packed = JSON.parse(run("tar", ["-xzOf", tarball, "package/package.json"], temporary, true));
	assert.equal(packed.private, undefined);
	assert.equal(packed.license, "MIT");
	assert.equal(packed.main, "./dist/index.js");
	assert.equal(packed.types, "./dist/unstyled.d.ts");
	for (const [entry, js, types] of [
		[".", "index", "unstyled"],
		["./unstyled", "unstyled", "unstyled"],
		["./core", "core/index", "core/index"],
		["./canvas", "canvas/index", "canvas/index"],
		["./graph", "graph/index", "graph/index"],
	]) {
		assert.equal(packed.exports[entry].import, `./dist/${js}.js`);
		assert.equal(packed.exports[entry].types, `./dist/${types}.d.ts`);
	}
	assert.equal(packed.exports["./styles.css"], "./dist/styles.css");
	assert.deepEqual(packed.exports, metadata.publishConfig.exports, "压缩包必须保留全部公开入口及条件。");
	for (const [subpath, conditions] of Object.entries(packed.exports)) {
		const targets = typeof conditions === "string" ? [conditions] : Object.values(conditions);
		for (const target of targets) {
			assert.ok(target === "./package.json" || /^\.\/dist\/[^.][^\\]*$/.test(target), `${subpath} 指向非发布文件：${target}`);
			assert.ok(!target.split("/").includes("..") && files.includes(target.slice(2)), `${subpath} 缺少目标：${target}`);
		}
	}
	console.log("真实 tarball 文件白名单、文档、示例与全部 exports 检查通过。");
	assert.ok(packed.sideEffects.includes("./dist/index.js") && packed.sideEffects.includes("**/*.css"));
	assert.deepEqual(packed.dependencies ?? {}, {}, "Runtime must not gain hidden dependencies.");
	assert.deepEqual(Object.keys(packed.peerDependencies ?? {}), ["react"]);

	write(
		"package.json",
		JSON.stringify(
			{
				name: "kanban-independent-consumer",
				private: true,
				type: "module",
				dependencies: { [metadata.name]: `file:${tarball}`, react: installedVersion("react"), "react-dom": installedVersion("react-dom") },
				devDependencies: {
					typescript: installedVersion("typescript"),
					"@types/react": installedVersion("@types/react"),
				},
			},
			null,
			2,
		),
	);
	write("pnpm-workspace.yaml", "packages: []\n");
	run("pnpm", ["install", "--prefer-offline", "--ignore-scripts", "--no-frozen-lockfile"], consumer);

	const consumerRequire = createRequire(resolve(consumer, "package.json"));
	const entry = realpathSync(consumerRequire.resolve(metadata.name));
	assert.ok(
		entry.startsWith(`${consumer}${sep}`) && entry.endsWith(`${sep}dist${sep}index.js`),
		"Consumer must resolve the installed dist, not workspace source.",
	);
	const installedRoot = realpathSync(resolve(consumerRequire.resolve(`${metadata.name}/package.json`), ".."));
	assert.ok(installedRoot.startsWith(`${consumer}${sep}`), "安装包必须位于外部 consumer 内。");
	for (const [subpath, conditions] of Object.entries(packed.exports)) {
		const specifier = subpath === "." ? metadata.name : `${metadata.name}${subpath.slice(1)}`;
		const target = typeof conditions === "string" ? conditions : conditions.import;
		assert.equal(realpathSync(consumerRequire.resolve(specifier)), realpathSync(resolve(installedRoot, target)), `${specifier} 必须解析到声明的安装产物。`);
		for (const value of typeof conditions === "string" ? [conditions] : Object.values(conditions)) {
			assert.ok(realpathSync(resolve(installedRoot, value)).startsWith(`${installedRoot}${sep}`), `${specifier} 的目标不能逃离安装包。`);
		}
	}
	mkdirSync(resolve(consumer, "examples"));
	for (const [name] of examples) copyFileSync(resolve(installedRoot, "examples", `${name}.tsx`), resolve(consumer, "examples", `${name}.tsx`));
	console.log("外部安装全部入口路径与隔离检查通过，已复制 tarball 内四个示例。");

	writeTypeFixture(write, metadata);
	const compilerOptions = { target: "ES2022", lib: ["ES2022", "DOM", "DOM.Iterable"], strict: true, noEmit: true, skipLibCheck: false, jsx: "react-jsx" };
	write("tsconfig.json", JSON.stringify({ compilerOptions: { ...compilerOptions, module: "ESNext", moduleResolution: "Bundler" }, include: ["types.tsx", "examples/*.tsx"] }));
	write("tsconfig.nodenext.json", JSON.stringify({ compilerOptions: { ...compilerOptions, module: "NodeNext", moduleResolution: "NodeNext" }, include: ["types.tsx", "examples/*.tsx"] }));
	run("pnpm", ["exec", "tsc", "-p", "tsconfig.json"], consumer);
	run("pnpm", ["exec", "tsc", "-p", "tsconfig.nodenext.json"], consumer);
	console.log("公开类型与四个发布示例的 Bundler / NodeNext 类型检查通过。");

	writeSSRFixture(write, metadata);
	run(process.execPath, ["ssr.mjs"], consumer);

	const exampleImports = examples.map(([name, component]) => `import { ${component} } from "./examples/${name}.js";`).join("\n");
	write("example-ssr.tsx", `import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
${exampleImports}
const quick = renderToString(createElement(QuickStart));
assert.ok(quick.indexOf("Write the specification") >= 0 && quick.indexOf("Write the specification") < quick.indexOf("Build the prototype"), "只读示例保留卡片与列顺序");
assert.doesNotMatch(quick, /data-draggable=/, "只读示例不提供移动入口");
const editable = renderToString(createElement(EditableBoard));
assert.equal((editable.match(/data-draggable="true"/g) ?? []).length, 2, "编辑示例中的两张卡片可移动");
assert.equal((editable.match(/aria-disabled="true"/g) ?? []).length, 2, "编辑示例首次渲染没有可撤销或重做的命令");
const responsive = renderToString(createElement(CanvasBoard));
assert.ok(responsive.includes("Write the specification") && responsive.includes("Build the prototype"), "画布示例服务端保留所有列中的卡片");
assert.doesNotMatch(responsive, /role="tablist"/, "响应式示例服务端渲染宽布局，留待客户端测量");
const graph = renderToString(createElement(Graph));
assert.match(graph, /<li>Build the prototype extends Write the specification<\\/li>/, "关系图提供扩展关系的文本等价");
assert.match(graph, /<li>Build the prototype blocks Ship the package<\\/li>/, "关系图提供阻塞关系的文本等价");
console.log("tarball 内四个完整示例的 Node SSR 通过。");
`);
	const assertIsolated = (result) => {
		for (const input of Object.keys(result.metafile.inputs)) {
			if (input === "<stdin>") continue;
			assert.ok(realpathSync(resolve(consumer, input)).startsWith(`${consumer}${sep}`), `生产构建泄漏工作区输入：${input}`);
			assert.ok(!/(?:@shared|@features|@entities|@violet\/ui)(?:\/|$)/.test(input), `生产构建包含站点私有依赖：${input}`);
		}
	};
	const exampleSSR = await build({
		absWorkingDir: consumer,
		entryPoints: ["example-ssr.tsx"],
		outfile: "example-ssr.mjs",
		bundle: true,
		platform: "node",
		format: "esm",
		jsx: "automatic",
		external: ["react", "react/*", "react-dom", "react-dom/*"],
		loader: { ".css": "empty" },
		metafile: true,
	});
	assertIsolated(exampleSSR);
	run(process.execPath, ["example-ssr.mjs"], consumer);

	write("preview.tsx", `import { createRoot } from "react-dom/client";
${exampleImports}
function Preview() {
	return <main><h1>Kanban 发布包示例</h1>${examples.map(([name, component, title]) => `<section id="${name}" aria-labelledby="${name}-title"><h2 id="${name}-title">${title}</h2><${component} /></section>`).join("")}</main>;
}
const root = document.getElementById("root");
if (!root) throw new Error("Missing preview root");
createRoot(root).render(<Preview />);
`);
	const preview = await build({
		absWorkingDir: consumer,
		entryPoints: ["preview.tsx"],
		outdir: "preview",
		bundle: true,
		minify: true,
		format: "esm",
		platform: "browser",
		jsx: "automatic",
		metafile: true,
		define: { "process.env.NODE_ENV": '"production"' },
	});
	assertIsolated(preview);
	assert.ok(Object.keys(preview.metafile.outputs).some((path) => path.endsWith(".css")), "完整示例生产构建必须保留根入口样式。");
	write("preview/index.html", `<!doctype html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Kanban 真实发布包验收</title><link rel="stylesheet" href="./preview.css"><style>body{margin:0;padding:24px;font-family:system-ui,sans-serif}main{max-width:1200px;margin:auto}section{margin:32px 0;padding:20px;border:1px solid #8886;border-radius:12px;min-width:0}h2{margin-top:0}</style></head><body><div id="root"></div><script type="module" src="./preview.js"></script></body></html>`);
	console.log("四个 tarball 示例的生产浏览器构建通过，包含独立可见分区与根入口样式。");

	// 入口依赖图：带样式根入口在生产摇树后仍保留 CSS；无样式入口无 CSS；/core 不含 React 与 CSS。
	const bundle = (contents, platform) =>
		build({
			absWorkingDir: consumer,
			stdin: { contents, resolveDir: consumer, loader: "js" },
			bundle: true,
			minify: true,
			format: "esm",
			platform,
			outdir: "bundle",
			write: false,
			metafile: true,
			define: { "process.env.NODE_ENV": '"production"' },
		});
	const styled = await bundle(
		`import { createElement } from "react"; import { createRoot } from "react-dom/client"; import { Board } from "${metadata.name}"; createRoot(document.getElementById("root")).render(createElement(Board, { columns: [], cards: [], order: {}, renderCard: () => null }));`,
		"browser",
	);
	assertIsolated(styled);
	const css = styled.outputFiles.find((file) => file.path.endsWith(".css"));
	assert.ok(css, "A named root import must preserve automatic CSS under production tree shaking.");
	const explicitStyles = await bundle(`import "${metadata.name}/styles.css"; import manifest from "${metadata.name}/package.json"; console.log(manifest.name);`, "browser");
	assertIsolated(explicitStyles);
	assert.ok(explicitStyles.outputFiles.some((file) => file.path.endsWith(".css") && file.text.includes(".v-kanban")), "公开 CSS 入口必须能在生产构建中消费。");
	assert.ok(explicitStyles.outputFiles.some((file) => file.path.endsWith(".js") && file.text.includes(packed.name)), "公开 package.json 入口必须能在生产构建中消费。");
	assert.ok(css.text.includes(".v-kanban") && css.text.includes("light-dark"));
	for (const [name, contents] of [
		["unstyled", `export { Board } from "${metadata.name}/unstyled";`],
		["core", `export { normalizeBoardState, resolveBoard } from "${metadata.name}/core";`],
		["canvas", `export { Canvas } from "${metadata.name}/canvas";`],
		["graph", `export { RelationGraph } from "${metadata.name}/graph";`],
	]) {
		const result = await bundle(contents, "node");
		assertIsolated(result);
		const inputs = Object.keys(result.metafile.inputs);
		assert.ok(!inputs.some((path) => path.endsWith(".css")), `${name} must not load CSS.`);
		if (name === "core")
			assert.ok(!inputs.some((path) => /node_modules\/(react|react-dom)\//.test(path)), "/core must not pull in React.");
	}
	console.log(`${metadata.name}@${metadata.version} 全部真实 tarball 消费验收通过。`);
} finally {
	if (keep) console.log(`保留外部消费验收目录：${temporary}\n浏览器预览目录：${resolve(consumer, "preview")}\n请使用静态 HTTP 服务打开该目录中的 index.html。`);
	else rmSync(temporary, { recursive: true, force: true });
}
