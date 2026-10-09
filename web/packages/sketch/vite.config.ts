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
		rollupOptions: { external: ["path-data-parser"] },
		target: "es2022",
		sourcemap: true,
		minify: false,
	},
});
