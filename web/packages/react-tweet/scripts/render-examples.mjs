import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const out = resolve(root, "docs/images");
const check = process.argv.includes("--check");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const files = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
	const path = resolve(directory, entry.name);
	return entry.isDirectory() ? files(path) : [path];
});
const imageNames = ["tweet-en.png", "tweet-zh.png", "gallery-en.png", "gallery-zh.png"];
const inputs = [
	...files(resolve(root, "examples")),
	...files(resolve(root, "dist")),
	resolve(root, "scripts/render-examples.mjs"),
].sort();
const sources = Object.fromEntries(inputs.map((path) => [relative(root, path), hash(readFileSync(path))]));
const manifestPath = resolve(out, "manifest.json");
if (check) {
	const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
	assert.deepEqual(manifest.sources, sources, "Example inputs changed; rebuild and run pnpm examples.");
	for (const name of imageNames)
		assert.equal(hash(readFileSync(resolve(out, name))), manifest.images[name], `${name} changed without regeneration.`);
	console.log("README image provenance and image hashes match the executable examples and build.");
} else {
	const { build } = await import("esbuild");
	const { chromium } = await import("@playwright/test");
	const { createElement } = await import("react");
	const { renderToStaticMarkup } = await import("react-dom/server");
	// Bundle the actual README examples; only the CSS-bearing entry is swapped for Node SSR.
	const bundle = async (entry, alias = {}) => {
		const result = await build({
			absWorkingDir: root,
			entryPoints: [entry],
			bundle: true,
			write: false,
			format: "esm",
			platform: "node",
			jsx: "automatic",
			alias,
			packages: "external",
		});
		return result.outputFiles[0].contents;
	};
	const unstyled = { "@violetjs/react-tweet": resolve(root, "dist/unstyled.js") };
	// A data URL cannot resolve external React imports; package-local temporary modules can.
	mkdirSync(out, { recursive: true });
	const temporaries = [".render-themes.mjs", ".render-gallery.mjs", ".render-art.mjs"].map((name) => resolve(out, name));
	writeFileSync(temporaries[0], await bundle("examples/themes.tsx", unstyled));
	writeFileSync(temporaries[1], await bundle("examples/gallery.tsx", unstyled));
	writeFileSync(temporaries[2], await bundle("examples/gallery-art.ts"));
	const { rmSync } = await import("node:fs");
	let browser;
	try {
		const { Themes } = await import(new URL("../docs/images/.render-themes.mjs", import.meta.url));
		const { Gallery } = await import(new URL("../docs/images/.render-gallery.mjs", import.meta.url));
		const { sceneSvg } = await import(new URL("../docs/images/.render-art.mjs", import.meta.url));
		browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
		const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1040, height: 800 } });
		const origin = "https://react-tweet.example";
		const pages = new Map();
		const types = { ".css": "text/css", ".svg": "image/svg+xml" };
		await page.route("**/*", (route) => {
			const url = new URL(route.request().url());
			assert.equal(url.origin, origin, "Examples must not request third-party assets.");
			if (pages.has(url.pathname)) return route.fulfill({ contentType: "text/html", body: pages.get(url.pathname) });
			const art = sceneSvg(url.pathname);
			if (art) return route.fulfill({ contentType: "image/svg+xml", body: art });
			return route.fulfill({ contentType: types[extname(url.pathname)] ?? "application/octet-stream", body: readFileSync(resolve(root, `dist${url.pathname}`)) });
		});
		const images = {};
		for (const [prefix, Example] of [["tweet", Themes], ["gallery", Gallery]]) {
			for (const [language, locale] of [["en", "en-US"], ["zh", "zh-CN"]]) {
				const markup = renderToStaticMarkup(createElement(Example, { locale }));
				const route = `/${prefix}-${language}.html`;
				pages.set(route, `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><link rel="stylesheet" href="/styles.css"></head><body style="margin:0"><div id="shot" style="display:inline-block">${markup}</div></body></html>`);
				await page.goto(`${origin}${route}`, { waitUntil: "networkidle" });
				await page.evaluate(() => document.fonts.ready);
				const name = `${prefix}-${language}.png`;
				const bytes = await page.locator("#shot").screenshot({ path: resolve(out, name), animations: "disabled" });
				images[name] = hash(bytes);
			}
		}
		writeFileSync(manifestPath, `${JSON.stringify({ sources, images }, null, "\t")}\n`);
	} finally {
		await browser?.close();
		for (const temporary of temporaries) rmSync(temporary, { force: true });
	}
}
