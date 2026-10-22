// 在 Chromium 中运行 examples/export.ts，把导出的动图写入 docs/images/export.gif，并记录来源指纹。
// 光栅化的抗锯齿随浏览器版本变化，输出不能跨机器逐字节比对；--check 只核对输入与图片的指纹，不启动浏览器。
// 用法：node scripts/render-export.mjs [--check]
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const image = resolve(root, "docs/images/export.gif");
const manifestPath = resolve(root, "docs/images/export.json");
const check = process.argv.includes("--check");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const files = (directory) =>
	readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = resolve(directory, entry.name);
		return entry.isDirectory() ? files(path) : [path];
	});
const inputs = [
	...files(resolve(root, "src")).filter((path) => !path.endsWith(".test.ts")),
	resolve(root, "examples/export.ts"),
	resolve(root, "scripts/render-export.mjs"),
].sort();
const sources = Object.fromEntries(inputs.map((path) => [relative(root, path), hash(readFileSync(path))]));

if (check) {
	const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
	assert.deepEqual(manifest.sources, sources, "export.gif inputs changed; run pnpm examples.");
	assert.equal(hash(readFileSync(image)), manifest.image, "export.gif changed without regeneration.");
	console.log("Checked export.gif provenance.");
} else {
	const { build } = await import("esbuild");
	const { chromium } = await import("@playwright/test");
	const bundle = await build({
		absWorkingDir: root,
		stdin: {
			contents: `import { exportCard } from "./examples/export.ts";
window.exportCard = async () => {
	const bytes = new Uint8Array(await (await exportCard()).arrayBuffer());
	return Array.from(bytes);
};`,
			resolveDir: root,
			loader: "ts",
		},
		bundle: true,
		write: false,
		format: "esm",
		platform: "browser",
		logLevel: "silent",
	});
	// WebCodecs 与 OffscreenCanvas 只在安全上下文开放，页面从 https 源加载
	const origin = "https://inkline.example";
	const page = `<!doctype html><html><head><meta charset="utf-8"></head><body><script type="module" src="/example.js"></script></body></html>`;
	const browser = await chromium.launch({
		executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
	});
	try {
		const tab = await browser.newPage();
		const errors = [];
		tab.on("pageerror", (error) => errors.push(String(error)));
		await tab.route("**/*", (route) => {
			const url = new URL(route.request().url());
			assert.equal(url.origin, origin, "The example must not request third-party resources.");
			if (url.pathname === "/example.js")
				return route.fulfill({ contentType: "text/javascript", body: bundle.outputFiles[0].text });
			return route.fulfill({ contentType: "text/html", body: page });
		});
		await tab.goto(`${origin}/`);
		await tab.waitForFunction(() => typeof window.exportCard === "function");
		const bytes = Uint8Array.from(await tab.evaluate(() => window.exportCard()));
		assert.deepEqual(errors, [], "The example threw in the browser.");
		writeFileSync(image, bytes);
		const manifest = { sources, image: hash(bytes) };
		writeFileSync(manifestPath, `${JSON.stringify(manifest, null, "\t")}\n`);
		console.log(`export.gif  ${(bytes.length / 1024).toFixed(0)} KB`);
	} finally {
		await browser.close();
	}
}
