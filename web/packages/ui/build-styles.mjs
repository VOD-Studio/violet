// 样式多入口构建（esbuild bundle 内联各入口的 @import 依赖）：
// - src/styles.css → dist/styles.css：完整产物（token + @theme 映射 + 滚动条工具类 + @source）
// - src/tokens.css → dist/tokens.css：纯 CSS 变量子集（无 @theme / @source，Headless 场景）
// - src/classes.css → dist/classes.css：BEM 类名产物（.v-button 等，Headless 场景），
//   各组件类文件经 @import 内联进单一产物。
// 独立脚本而非 vite 入口：CSS 里的 @source "./" 是给宿主 Tailwind 的指令，
// 打包后位于 dist 根，恰好扫描到同目录的打包 JS；构建器必须原样保留未知 at-rule。
import { build } from "esbuild";

await Promise.all([
	build({
		entryPoints: ["src/styles.css", "src/tokens.css", "src/classes.css"],
		outbase: "src",
		outdir: "dist",
		bundle: true,
		loader: { ".css": "css" },
		minify: false,
		logLevel: "info",
	}),
	build({
		entryPoints: ["src/styles/palettes/violet.css", "src/styles/palettes/coral.css"],
		outbase: "src/styles/palettes",
		outdir: "dist/palettes",
		bundle: true,
		loader: { ".css": "css" },
		minify: false,
		logLevel: "info",
	}),
]);
