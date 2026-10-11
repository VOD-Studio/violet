import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const entry = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
	build: {
		lib: {
			entry: {
				index: entry("./src/index.ts"),
				"render/svg": entry("./src/render/svg.ts"),
				"render/canvas": entry("./src/render/canvas.ts"),
			},
			formats: ["es"],
		},
		rollupOptions: {
			external: ["path-data-parser"],
			// 每个源文件单独输出：合成一个文件后打包器只能逐条判断语句能否删除，
			// 未用到的风格与笔会被整体带进使用方的产物，sideEffects: false 的按模块摇树失效
			output: {
				preserveModules: true,
				preserveModulesRoot: "src",
				entryFileNames: "[name].js",
			},
		},
		target: "es2022",
		sourcemap: true,
		minify: false,
	},
});
