import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(webRoot, "src/styles/theme-presets.generated.css");
const { outputFiles } = await build({
	entryPoints: [resolve(webRoot, "src/shared/lib/theme-presets-css.ts")],
	bundle: true,
	write: false,
	platform: "node",
	format: "esm",
});
const { generateThemePresetsCss } = await import(
	`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`
);
// 与提交的文件一样经过 Biome 格式化，避免检查时因换行不同误报；直接调用可执行文件，stdout 只含格式化结果
const expected = execFileSync(
	resolve(webRoot, "node_modules/.bin/biome"),
	["format", `--stdin-file-path=${relative(webRoot, target)}`],
	{ cwd: webRoot, input: generateThemePresetsCss(), encoding: "utf8" },
);
let actual;
try {
	actual = readFileSync(target, "utf8");
} catch (error) {
	if (error.code !== "ENOENT") throw error;
}
if (actual !== expected) {
	if (process.argv.includes("--check")) {
		throw new Error("Theme preset colors are stale. Run pnpm colors:themes.");
	}
	writeFileSync(target, expected);
}
console.log(
	process.argv.includes("--check")
		? "Theme preset colors are current."
		: "Theme preset colors synchronized.",
);
