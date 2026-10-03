import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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
	plugins: [preserveClientDirectives],
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
