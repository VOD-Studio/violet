import { defineConfig } from "vite";
import packageJson from "./package.json";

// 打包时排除的依赖：dependencies/peerDependencies 由宿主自行安装。
const externalPackages = new Set([
	...Object.keys(packageJson.dependencies),
	...Object.keys(packageJson.peerDependencies),
]);

export default defineConfig({
	build: {
		lib: {
			entry: "src/index.ts",
			formats: ["es"],
			fileName: () => "index.js",
		},
		rolldownOptions: {
			external: (id) => {
				// @scope/pkg 取前两段，裸包名取第一段；相对路径与虚拟模块不外置。
				const packageName = id.startsWith("@")
					? id.split("/").slice(0, 2).join("/")
					: id.split("/")[0];
				return externalPackages.has(packageName);
			},
			output: {
				// 单入口产物固定 index.js，供 exports 的 import 条件指向。
				entryFileNames: "index.js",
			},
		},
	},
});
