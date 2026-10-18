import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

/** 把演示页打成静态文件，测试通过 file:// 打开，不依赖站点与网络。 */
export default async function globalSetup() {
	const directory = mkdtempSync(join(tmpdir(), "kanban-browser-"));
	mkdirSync(directory, { recursive: true });
	await build({
		entryPoints: [join(import.meta.dirname, "demo.tsx")],
		outfile: join(directory, "demo.js"),
		bundle: true,
		format: "iife",
		jsx: "automatic",
		define: { "process.env.NODE_ENV": '"production"' },
	});
	writeFileSync(
		join(directory, "index.html"),
		`<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="demo.css"><body style="margin:0"><div id="root"></div><script src="demo.js"></script>`,
	);
	process.env.KANBAN_FIXTURE_URL = pathToFileURL(join(directory, "index.html")).href;
	return () => rmSync(directory, { recursive: true, force: true });
}
