// 将 src/styles.css 及其 @import 依赖内联为 dist/styles.css。
// 独立脚本而非 vite 入口：CSS 里的 @source "./" 是给宿主 Tailwind 的指令，
// 打包后位于 dist 根，恰好扫描到同目录的打包 JS；构建器必须原样保留未知 at-rule。
import { build } from "esbuild";

await build({
	entryPoints: ["src/styles.css"],
	outfile: "dist/styles.css",
	bundle: true,
	loader: { ".css": "css" },
	minify: false,
	logLevel: "info",
});
