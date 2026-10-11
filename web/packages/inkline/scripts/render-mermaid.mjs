// 在 Chromium 中运行 examples/mermaid.ts，把重画后的 SVG 写入 docs/images/mermaid.svg，并记录来源指纹。
// Mermaid 的排版依赖本机字体，输出不能跨机器逐字节比对；--check 只核对输入与图片的指纹，不启动浏览器。
// 用法：node scripts/render-mermaid.mjs [--check]
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const image = resolve(root, "docs/images/mermaid.svg");
const manifestPath = resolve(root, "docs/images/mermaid.json");
const check = process.argv.includes("--check");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const files = (directory) =>
	readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = resolve(directory, entry.name);
		return entry.isDirectory() ? files(path) : [path];
	});
const mermaidVersion = JSON.parse(
	readFileSync(createRequire(resolve(root, "package.json")).resolve("mermaid/package.json"), "utf8"),
).version;
const inputs = [
	...files(resolve(root, "src")).filter((path) => !path.endsWith(".test.ts")),
	resolve(root, "examples/mermaid.ts"),
	resolve(root, "scripts/render-mermaid.mjs"),
].sort();
const sources = Object.fromEntries(inputs.map((path) => [relative(root, path), hash(readFileSync(path))]));

if (check) {
	const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
	assert.equal(manifest.mermaid, mermaidVersion, "Mermaid version changed; run pnpm examples.");
	assert.deepEqual(manifest.sources, sources, "mermaid.svg inputs changed; run pnpm examples.");
	assert.equal(hash(readFileSync(image)), manifest.image, "mermaid.svg changed without regeneration.");
	console.log("Checked mermaid.svg provenance.");
} else {
	const { build } = await import("esbuild");
	const { chromium } = await import("@playwright/test");
	const bundle = await build({
		absWorkingDir: root,
		entryPoints: ["examples/mermaid.ts"],
		bundle: true,
		write: false,
		format: "esm",
		platform: "browser",
		logLevel: "silent",
	});
	const origin = "https://inkline.example";
	const page = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#fff"><div id="diagram"></div><script type="module" src="/example.js"></script></body></html>`;
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
		await tab.waitForSelector("#diagram [data-inkline]", { timeout: 30_000 });
		assert.deepEqual(errors, [], "The example threw in the browser.");
		const svg = await tab.evaluate(() => {
			const element = document.querySelector("#diagram svg");
			// 与其他样例图一致的纸色底，在 GitHub 暗色主题下仍可读
			element.style.backgroundColor = "#fffdf7";
			return new XMLSerializer().serializeToString(element);
		});
		writeFileSync(image, `${svg}\n`);
		const manifest = { mermaid: mermaidVersion, sources, image: hash(readFileSync(image)) };
		writeFileSync(manifestPath, `${JSON.stringify(manifest, null, "\t")}\n`);
		console.log(`mermaid.svg  ${(svg.length / 1024).toFixed(0)} KB`);
	} finally {
		await browser.close();
	}
}
