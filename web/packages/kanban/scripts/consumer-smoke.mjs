import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

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

try {
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
		"LICENSE",
		"dist/index.js",
		"dist/unstyled.js",
		"dist/unstyled.d.ts",
		"dist/core/index.js",
		"dist/core/index.d.ts",
		"dist/styles.css",
		"dist/board/board.css",
	])
		assert.ok(files.includes(name), `Missing packed file: ${name}`);
	for (const name of files)
		assert.ok(
			/^(?:package\.json|README\.md|LICENSE|dist\/.+)$/.test(name) && !/\.test\.|^dist\/test\//.test(name),
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
	]) {
		assert.equal(packed.exports[entry].import, `./dist/${js}.js`);
		assert.equal(packed.exports[entry].types, `./dist/${types}.d.ts`);
	}
	assert.equal(packed.exports["./styles.css"], "./dist/styles.css");
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
					"@types/react-dom": installedVersion("@types/react-dom"),
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

	// 公开类型：泛型卡片只要求 id，使用方自己的列类型贯穿插槽；缺 id 的卡片必须被拒绝。
	write(
		"types.tsx",
		`import { Board, createPointerController, type BoardCard, type BoardColumn, type BoardLocale, type BoardMessages, type BoardMove, type BoardProps, type BoardState, type DragController, type DragHost, type MoveDecision } from "${metadata.name}";
import { Board as Unstyled } from "${metadata.name}/unstyled";
import { applyMove, violatesAutoSort, createMove, isNoopMove, locateCard, normalizeBoardState, resolveBoard, resolveDropTarget, type ColumnLayout, type ResolvedColumn } from "${metadata.name}/core";
interface Task extends BoardCard { title: string }
interface Stage extends BoardColumn { hint: string }
const canMove = (move: BoardMove): MoveDecision => move.to.columnId === "done" ? { allowed: false, reason: "no" } : { allowed: true };
const controller: DragController = { attach: (host: DragHost) => { host.root.focus(); return () => {}; } };
export const defaultController: DragController = createPointerController({ threshold: 6 });
const tasks: Task[] = [{ id: "a", title: "A" }];
const stages: Stage[] = [{ id: "todo", title: "Todo", hint: "next" }];
const locale: BoardLocale = "zh-CN";
const messages: Partial<BoardMessages> = { emptyColumn: "none" };
export const nodes = [
	<Board columns={stages} cards={tasks} order={{ todo: ["a"] }} locale={locale} messages={messages}
		renderCard={(task, { column, index }) => <span>{task.title}{column.hint}{index}</span>}
		renderColumnHeader={(stage, { count }) => <b>{stage.hint}{count}</b>}
		renderEmpty={(stage) => <i>{stage.hint}</i>}
		onMove={async (move) => { await Promise.resolve(move.cardId); }} canMove={canMove} onMoveError={(error, move) => console.error(error, move.previousId)}
		isDraggable={(task) => task.title !== ""} readOnly={false} dragController={controller} />,
	<Unstyled columns={stages} cards={tasks} order={{}} renderCard={(task) => task.title} />,
];
export const props: BoardProps<Task, Stage>["order"] = {};
const state: BoardState = { columns: ["todo"], order: { todo: ["a"] } };
export const resolved: ResolvedColumn<Task>[] = resolveBoard(state, tasks);
export const normalized: BoardState = normalizeBoardState(state);
const move: BoardMove | null = createMove(state, "a", { columnId: "todo", index: 0 });
const layout: ColumnLayout[] = [{ id: "todo", rect: { left: 0, top: 0, right: 1, bottom: 1 }, cards: [] }];
export const moves = [move && applyMove(state, move), move && isNoopMove(move), move && violatesAutoSort(move, () => false), locateCard(state, "a"), resolveDropTarget(layout, { x: 0, y: 0 })];
// @ts-expect-error 卡片必须有 id
export const bad = <Board columns={stages} cards={[{ title: "no id" }]} order={{}} renderCard={() => null} />;
`,
	);
	const compilerOptions = { target: "ES2022", lib: ["ES2022", "DOM", "DOM.Iterable"], strict: true, noEmit: true, skipLibCheck: false, jsx: "react-jsx" };
	write("tsconfig.json", JSON.stringify({ compilerOptions: { ...compilerOptions, module: "ESNext", moduleResolution: "Bundler" }, include: ["types.tsx"] }));
	write("tsconfig.nodenext.json", JSON.stringify({ compilerOptions: { ...compilerOptions, module: "NodeNext", moduleResolution: "NodeNext" }, files: ["types.tsx"] }));
	run("pnpm", ["exec", "tsc", "-p", "tsconfig.json"], consumer);
	run("pnpm", ["exec", "tsc", "-p", "tsconfig.nodenext.json"], consumer);

	// Node 服务端渲染：不带样式入口可直接使用，输出确定，列与卡片顺序正确。
	write(
		"ssr.mjs",
		`import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { Board } from "${metadata.name}/unstyled";
import { createMove, applyMove, resolveBoard } from "${metadata.name}/core";
const props = {
	columns: [{ id: "todo", title: "Todo" }, { id: "done", title: "Done" }],
	cards: [{ id: "a", title: "First" }, { id: "b", title: "Second" }],
	order: { todo: ["b", "a"], done: [] },
	renderCard: (card) => card.title,
};
const html = renderToString(createElement(Board, props));
assert.equal(renderToString(createElement(Board, props)), html, "SSR output must be deterministic.");
assert.ok(html.indexOf("Todo") < html.indexOf("Done"));
assert.ok(html.indexOf("Second") < html.indexOf("First"), "Card order must follow the order prop.");
assert.match(html, /No cards/);
assert.match(renderToString(createElement(Board, { ...props, locale: "zh-CN" })), /暂无卡片/);
const editable = renderToString(createElement(Board, { ...props, onMove: () => {} }));
assert.equal(renderToString(createElement(Board, { ...props, onMove: () => {} })), editable, "Editable SSR output must be deterministic.");
assert.match(editable, /data-draggable="true"/);
assert.ok(!/data-draggable/.test(html), "Read-only boards must not advertise dragging.");
assert.ok(!/<script|<style/.test(html));
assert.deepEqual(resolveBoard({ columns: ["todo"], order: { todo: ["b", "x"] } }, props.cards).map((column) => column.cards.map((card) => card.id)), [["b"]]);
const moved = applyMove({ columns: ["todo", "done"], order: { todo: ["a", "b"], done: [] } }, createMove({ columns: ["todo", "done"], order: { todo: ["a", "b"], done: [] } }, "a", { columnId: "done", index: 0 }));
assert.deepEqual(moved.order, { todo: ["b"], done: ["a"] });
console.log("Installed tarball: SSR and core contracts passed.");
`,
	);
	run(process.execPath, ["ssr.mjs"], consumer);

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
	const css = styled.outputFiles.find((file) => file.path.endsWith(".css"));
	assert.ok(css, "A named root import must preserve automatic CSS under production tree shaking.");
	assert.ok(css.text.includes(".v-kanban") && css.text.includes("light-dark"));
	for (const [name, contents] of [
		["unstyled", `export { Board } from "${metadata.name}/unstyled";`],
		["core", `export { normalizeBoardState, resolveBoard } from "${metadata.name}/core";`],
	]) {
		const result = await bundle(contents, "node");
		const inputs = Object.keys(result.metafile.inputs);
		assert.ok(!inputs.some((path) => path.endsWith(".css")), `${name} must not load CSS.`);
		if (name === "core")
			assert.ok(!inputs.some((path) => /node_modules\/(react|react-dom)\//.test(path)), "/core must not pull in React.");
	}
	console.log(`${metadata.name}@${metadata.version} independent consumer passed.`);
} finally {
	if (keep) console.log(`Kept ${temporary}`);
	else rmSync(temporary, { recursive: true, force: true });
}
