import { expect, test } from "@playwright/test";
import { loadClient } from "./client";

const PATH = "/blog/contract-rich-math";
const LATER = "a^2 + b^2 = c^2";

/** 块公式容器里直接放着的文字：未排版时就是 LaTeX 原文（排版层与注解层都在子元素里）。 */
const ownText = (element: Element) =>
	Array.from(element.childNodes)
		.filter((node) => node.nodeType === Node.TEXT_NODE)
		.map((node) => node.textContent)
		.join("");

test("首屏公式随 HTML 排好，脚本接管前后都不退回 LaTeX 原文", async ({ page, context }) => {
	await loadClient(context);
	const scripts = Promise.withResolvers<void>();
	const hydrationErrors: string[] = [];
	page.on("pageerror", (error) => {
		if (/hydration|hydrated|React error #418/i.test(error.message)) {
			hydrationErrors.push(error.message);
		}
	});
	await context.route("**/assets/*.js", async (route) => {
		await scripts.promise;
		await route.fallback();
	});
	try {
		await page.goto(PATH, { waitUntil: "commit" });
		// 属性选择器里的反斜杠会被当作转义，按文档顺序定位
		const first = page.locator('[data-type="block-math"]').first();
		// 站点脚本尚未执行：排版结果与样式都来自服务端
		await expect(first.locator(".katex-display")).toBeVisible();
		// KaTeX 样式已生效：无障碍注解层被移出排版流，不与排版层重复显示
		await expect(first.locator(".katex-mathml")).toHaveCSS("position", "absolute");
		expect(await first.evaluate(ownText)).toBe("");
		await expect(page.locator('[data-type="inline-math"] .katex')).toBeVisible();
		// 首屏之外的公式服务端只给原文，脚本接管后再排
		await expect(page.locator('[data-type="block-math"]').last()).toContainText(LATER);

		const ready = page.waitForResponse("**/api/v1/presence/stream");
		scripts.resolve();
		await ready;
		await page.waitForLoadState("networkidle");
		await expect(first.locator(".katex-display")).toBeVisible();
		expect(await first.evaluate(ownText)).toBe("");
		expect(hydrationErrors).toEqual([]);
		// 文末的公式不必滚到跟前：空闲时已排好，读者从目录跳过去看不到 LaTeX 原文
		await expect(
			page.locator('[data-type="block-math"]').last().locator(".katex-display"),
		).toBeAttached();
	} finally {
		scripts.resolve();
		await context.unrouteAll({ behavior: "wait" });
	}
});

test("服务端 HTML 只在首屏范围直出公式排版", async ({ request }) => {
	const html = await (await request.get(PATH)).text();
	expect(html).toContain('class="katex-display"');
	expect(html).toContain(`data-latex="${LATER}">${LATER}<`);
	expect(html).not.toContain("data-first-screen");
});
