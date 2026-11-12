import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build as bundleWorker } from "esbuild";
import { defineConfig, type Plugin } from "vite";
import manifest from "./component-manifest.json";
import packageJson from "./package.json";

const packageRoot = dirname(fileURLToPath(import.meta.url));
const sourceRoot = resolve(packageRoot, "src");
const externalPackages = new Set([
	...Object.keys(packageJson.dependencies),
	...Object.keys(packageJson.peerDependencies),
]);
const publicEntries = [
	"src/index.ts",
	"src/legacy.ts",
	"src/variants.ts",
	...manifest.components.map((component) => component.entry),
	...manifest.additionalExports.map((item) => item.entry),
];

const highlighterClient = resolve(sourceRoot, "components/code-block/highlighter.ts");
const highlighterWorker = "components/code-block/highlighter.worker.js";
const highlighterWorkerUrl = "__VIOLET_HIGHLIGHTER_WORKER_URL__";
const packageRequire = createRequire(import.meta.url);
// 只预打包 worker 核心；JSON/WASM 保留静态 URL，让消费者按自己的 base 搬运。

const portableHighlighter: Plugin = {
	name: "violet-portable-highlighter",
	apply: "build",
	enforce: "pre",
	async buildStart() {
		const emitResource = (name: string, source: string | Uint8Array) => {
			this.emitFile({
				type: "asset",
				fileName: `components/code-block/assets/${name}`,
				source,
			});
			return `new URL(${JSON.stringify(`./assets/${name}?no-inline`)}, import.meta.url)`;
		};
		const result = await bundleWorker({
			absWorkingDir: packageRoot,
			entryPoints: ["src/components/code-block/highlighter.worker.ts"],
			bundle: true,
			write: false,
			format: "esm",
			platform: "browser",
			target: "es2022",
			legalComments: "none",
			plugins: [
				{
					name: "violet-highlighter-resources",
					setup(build) {
						build.onResolve(
							{ filter: /^shiki\/(?:dist\/langs\/[\w-]+\.mjs|wasm)$/ },
							({ path }) => ({ path, namespace: "violet-highlighter-resource" }),
						);
						build.onLoad(
							{ filter: /.*/, namespace: "violet-highlighter-resource" },
							async ({ path }) => {
								if (path === "shiki/wasm") {
									const url = emitResource(
										"onig.wasm",
										readFileSync(packageRequire.resolve("shiki/onig.wasm")),
									);
									return {
										contents: `export default async function (imports) {
	const response = await fetch(${url});
	if (!response.ok) throw new Error("代码高亮 WASM 加载失败: " + response.status);
	return WebAssembly.instantiate(await response.arrayBuffer(), imports);
}`,
									};
								}
								// 构建器按实际遇到的语言模块读取数据，不另维护一份静态语言清单。
								const language = await import(
									pathToFileURL(packageRequire.resolve(path)).href
								);
								const name = path
									.slice(path.lastIndexOf("/") + 1)
									.replace(/\.mjs$/, ".json");
								const url = emitResource(name, JSON.stringify(language.default));
								return {
									contents: `export default async function () {
	const response = await fetch(${url});
	if (!response.ok) throw new Error("代码高亮语法加载失败: " + response.status);
	return response.json();
}`,
								};
							},
						);
					},
				},
			],
		});
		this.emitFile({
			type: "asset",
			fileName: highlighterWorker,
			source: result.outputFiles[0].contents,
		});
	},
	transform(code, id) {
		if (id !== highlighterClient) return;
		// 库阶段不固化 worker URL；交给消费者重定位 npm 路径并收集其资源。
		return code.replace(
			/new URL\("\.\/highlighter\.worker\.ts", import\.meta\.url\)/,
			JSON.stringify(highlighterWorkerUrl),
		);
	},
	renderChunk(code) {
		if (!code.includes(highlighterWorkerUrl)) return;
		return {
			code: code.replace(
				JSON.stringify(highlighterWorkerUrl),
				'new URL("./highlighter.worker.js", import.meta.url)',
			),
			map: null,
		};
	},
};

const preserveClientDirectives: Plugin = {
	name: "violet-preserve-client-directives",
	renderChunk(code, chunk) {
		const needsDirective = chunk.moduleIds.some(
			(id) =>
				id.startsWith(sourceRoot) &&
				/^\s*["']use client["'];/.test(readFileSync(id, "utf8")),
		);
		if (needsDirective && !/^\s*["']use client["'];/.test(code)) {
			return { code: `"use client";\n${code}`, map: null };
		}
	},
};

export default defineConfig({
	plugins: [portableHighlighter, preserveClientDirectives],
	build: {
		minify: false,
		lib: {
			entry: Object.fromEntries(
				publicEntries.map((entry) => [
					entry.replace(/^src\//, "").replace(/\.[jt]sx?$/, ""),
					resolve(packageRoot, entry),
				]),
			),
			formats: ["es"],
		},
		rolldownOptions: {
			external: (id) => {
				const packageName = id.startsWith("@")
					? id.split("/").slice(0, 2).join("/")
					: id.split("/")[0];
				return externalPackages.has(packageName);
			},
			output: {
				entryFileNames: "[name].js",
				chunkFileNames: "[name].js",
				preserveModules: true,
				preserveModulesRoot: sourceRoot,
			},
		},
	},
});
