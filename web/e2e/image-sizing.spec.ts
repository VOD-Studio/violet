import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";

const { build } = createRequire(new URL("../packages/ui/package.json", import.meta.url))("esbuild");
const ANIMATED_WEBP =
	"UklGRiABAABXRUJQVlA4WAoAAAACAAAAdwAAOwAAQU5JTQYAAAAAAAAAAABBTk1GegAAAAAAAAAAAHcAADsAAHgAAAJWUDggYgAAAJAGAJ0BKngAPAA+bTaZSaQjIqEhCACADYlpBnBmgXgD9AJH2mgPwABCbEjFKJae6UJHwLhCjRXBkXoXCAAA/vChL//5BcsLrka///ID/kB/yA//j8WOzXkZSgjW30v6hAAAQU5NRnIAAAAAAAAAAAB3AAA7AAB4AAAAVlA4IFoAAADUBQCdASp4ADwAPm0yk0mCEAAA2JaQZwZoF4A/QCR9poAD+NQLEiH8Xnypq6Ye/OASobl1FawAAP75JI///ID//ID//ID/+QH//ELvZDMfLH8ZnIC7hVBgAAA=";
const DIMENSIONS: Record<string, [number, number]> = {
	"horizontal.png": [2000, 1000],
	"portrait.png": [800, 1600],
	"small.png": [120, 60],
	"square.png": [1254, 1254],
	"panorama.png": [4000, 1000],
	"fractional-panorama.png": [4000, 1000],
	"external.png": [120, 60],
};
let fixtureScript = "";

test.beforeAll(async () => {
	const result = await build({
		stdin: {
			resolveDir: resolve(import.meta.dirname, ".."),
			loader: "tsx",
			contents: `
import { createRoot } from "react-dom/client";
import { ArticleImage } from "./src/shared/ui/markdown-preview/components/ArticleImage";
import { CroppedImage } from "./src/shared/ui/image-cropper/CroppedImage";
createRoot(document.getElementById("fixture")).render(<>
  {["horizontal.png", "portrait.png", "small.png", "square.png", "animated.gif", "animated.webp"].map(name => <ArticleImage key={name} src={"/uploads/" + name} alt={name} />)}
  <ArticleImage src="https://external.image-size.test/external.png" alt="external.png" />
  <CroppedImage src="/uploads/panorama.png" width={920} widths={[360,720,920,1840,2400]} aspect={2} className="cover-fixture" alt="cover" />
  <CroppedImage src="/uploads/panorama.png?crop=0.25,0.25,0.5,0.5" width={920} widths={[360,720,920,1840,2400]} aspect={2} className="cover-fixture" alt="crop" />
  <CroppedImage src="/uploads/fractional-panorama.png" width={304} aspect={304/171} className="fractional-cover-fixture" alt="fractional" />
</>);
`,
		},
		bundle: true,
		format: "iife",
		platform: "browser",
		jsx: "automatic",
		write: false,
		logLevel: "error",
		define: {
			"process.env.NODE_ENV": '"development"',
			"import.meta.env.VITE_SITE_URL": '"http://image-size.test"',
		},
	});
	fixtureScript = result.outputFiles[0].text;
});

async function mountFixture(page: Page) {
	await page.route("**/*", async (route) => {
		const url = new URL(route.request().url());
		if (route.request().resourceType() === "document") {
			await route.fulfill({
				contentType: "text/html",
				body: '<style>body{margin:24px}#fixture{width:min(920px,100vw - 48px)}img{display:block}.max-w-full{max-width:100%}.cover-fixture{width:342px;height:171px}.fractional-cover-fixture{width:304px;height:171px}.overflow-hidden{overflow:hidden}.relative{position:relative}.absolute{position:absolute}.max-w-none{max-width:none}.h-full{height:100%}.w-full{width:100%}.object-cover{object-fit:cover}</style><main id="fixture"></main>',
			});
			return;
		}
		const name = url.pathname.split("/").at(-1) ?? "";
		if (name === "animated.gif" || name === "animated.webp") {
			await route.fulfill(
				name === "animated.gif"
					? {
							contentType: "image/gif",
							path: join(import.meta.dirname, "fixtures/article-small.gif"),
						}
					: {
							contentType: "image/webp",
							body: Buffer.from(ANIMATED_WEBP, "base64"),
						},
			);
			return;
		}
		const dimensions = DIMENSIONS[name];
		if (!dimensions) throw new Error(`未知图片请求：${url}`);
		// 与后端 imaging.Fit 一致：只缩不放大，派生高度向下取整。
		const [naturalWidth, naturalHeight] = dimensions;
		const width = Math.min(naturalWidth, Number(url.searchParams.get("w")) || naturalWidth);
		const height = Math.floor((width * naturalHeight) / naturalWidth);
		await route.fulfill({
			contentType: "image/svg+xml",
			body: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="red"/></svg>`,
		});
	});
	await page.goto("http://image-size.test");
	await page.addScriptTag({ content: fixtureScript });
}

for (const density of [1, 2, 3]) {
	test(`未知尺寸正文保留自然比例和小图尺寸，DPR=${density} 按视口选择`, async ({ browser }) => {
		const context = await browser.newContext({
			viewport: { width: 390, height: 844 },
			deviceScaleFactor: density,
		});
		const page = await context.newPage();
		try {
			await mountFixture(page);
			for (const [name, width, height] of [
				["horizontal.png", 342, 171],
				["portrait.png", 342, 684],
				["small.png", 120, 60],
				["square.png", 342, 342],
				["animated.gif", 120, 60],
				["animated.webp", 120, 60],
				["external.png", 120, 60],
			] as const) {
				const image = page.getByAltText(name, { exact: true });
				await image.scrollIntoViewIfNeeded();
				await expect
					.poll(() =>
						image.evaluate(
							(element: HTMLImageElement) =>
								element.complete && element.naturalWidth > 0,
						),
					)
					.toBe(true);
				await expect
					.poll(async () => (await image.boundingBox())?.height)
					.toBeCloseTo(height, 0);
				expect((await image.boundingBox())?.width).toBeCloseTo(width, 0);
			}
			const current = await page
				.getByAltText("horizontal.png")
				.evaluate((image: HTMLImageElement) => image.currentSrc);
			expect(Number(new URL(current).searchParams.get("w"))).toBe(
				density === 1 ? 480 : density === 2 ? 920 : 1200,
			);
			for (const name of ["animated.gif", "external.png"]) {
				const source = await page
					.getByAltText(name)
					.evaluate((image: HTMLImageElement) => image.currentSrc);
				expect(new URL(source).search).toBe("");
			}
			const cover = page.getByAltText("cover", { exact: true });
			await cover.scrollIntoViewIfNeeded();
			await expect
				.poll(() =>
					cover.evaluate(
						(image: HTMLImageElement) =>
							image.complete && image.naturalWidth >= 684 * window.devicePixelRatio,
					),
				)
				.toBe(true);
			const crop = page.getByAltText("crop", { exact: true });
			await expect
				.poll(() =>
					crop.evaluate(
						(image: HTMLImageElement) =>
							image.complete &&
							image.naturalWidth >= Math.min(1368 * window.devicePixelRatio, 4000),
					),
				)
				.toBe(true);
			expect((await crop.boundingBox())?.width).toBeCloseTo(1368, 0);
		} finally {
			await context.close();
		}
	});
}

test("1254 方图在桌面高 DPR 不因请求 1840 档而缩成较小自然尺寸", async ({ browser }) => {
	const context = await browser.newContext({
		viewport: { width: 1280, height: 900 },
		deviceScaleFactor: 2,
	});
	try {
		const page = await context.newPage();
		await mountFixture(page);
		const image = page.getByAltText("square.png", { exact: true });
		await image.scrollIntoViewIfNeeded();
		await expect
			.poll(() =>
				image.evaluate(
					(element: HTMLImageElement) =>
						element.complete && element.naturalWidth === 1254,
				),
			)
			.toBe(true);
		expect((await image.boundingBox())?.width).toBeCloseTo(920, 0);
		expect((await image.boundingBox())?.height).toBeCloseTo(920, 0);
	} finally {
		await context.close();
	}
});

test("小数 DPR 的无档位封面不会因派生高度取整反复请求", async ({ browser }) => {
	const context = await browser.newContext({
		viewport: { width: 390, height: 844 },
		deviceScaleFactor: 1.5,
	});
	try {
		const page = await context.newPage();
		const requests: string[] = [];
		page.on("request", (request) => {
			if (request.url().includes("/uploads/fractional-panorama.png")) {
				requests.push(request.url());
			}
		});
		await mountFixture(page);
		const image = page.getByAltText("fractional", { exact: true });
		await image.scrollIntoViewIfNeeded();
		await expect
			.poll(() =>
				image.evaluate(
					(element: HTMLImageElement) => element.complete && element.naturalWidth >= 1026,
				),
			)
			.toBe(true);
		await page.waitForLoadState("networkidle", { timeout: 10_000 });
		expect(requests).toEqual([...new Set(requests)]);
		// 缓存命中可能不产生新网络请求，仍须排除连续帧内反复替换图片地址。
		const swaps = await image.evaluate(async (element) => {
			const changes: string[] = [];
			const observer = new MutationObserver(() =>
				changes.push(element.getAttribute("src") ?? ""),
			);
			observer.observe(element, { attributes: true, attributeFilter: ["src"] });
			const frame = Promise.withResolvers<void>();
			requestAnimationFrame(() => requestAnimationFrame(() => frame.resolve()));
			await frame.promise;
			observer.disconnect();
			return changes;
		});
		expect(swaps).toEqual([]);
		expect((await image.boundingBox())?.width).toBe(304);
		expect((await image.boundingBox())?.height).toBe(171);
	} finally {
		await context.close();
	}
});
