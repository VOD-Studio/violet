import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { loadClient } from "./client";

test("目录键盘焦点的四边均位于滚动裁剪层内", async ({ page, context }) => {
	await loadClient(context);
	await page.goto("/blog/contract-rich-toc");
	await expect(page.locator("[data-article-content] pre.shiki")).toBeVisible();
	await page.getByRole("button", { name: "展开完整目录", exact: true }).focus();
	const links = page.locator("[data-toc-accordion] a");
	const count = await links.count();
	expect(
		await page.locator("[data-toc-accordion]").evaluate((element) => {
			return element.scrollHeight > element.clientHeight;
		}),
	).toBe(true);
	for (let index = 0; index < count; index++) {
		await page.keyboard.press("Tab");
		const link = links.nth(index);
		await expect(link).toBeFocused();
		const bounds = await link.evaluate((element) => {
			const container = element.closest("[data-toc-accordion]");
			if (!container) throw new Error("目录缺少滚动容器");
			const item = element.getBoundingClientRect();
			const clip = container.getBoundingClientRect();
			const style = getComputedStyle(element);
			const bleed =
				Number.parseFloat(style.outlineWidth) + Number.parseFloat(style.outlineOffset);
			return {
				bleed,
				ring: {
					left: item.left - bleed,
					right: item.right + bleed,
					top: item.top - bleed,
					bottom: item.bottom + bleed,
				},
				clip: { left: clip.left, right: clip.right, top: clip.top, bottom: clip.bottom },
			};
		});
		expect(bounds.bleed).toBeGreaterThan(0);
		expect(bounds.ring.left).toBeGreaterThanOrEqual(bounds.clip.left);
		expect(bounds.ring.right).toBeLessThanOrEqual(bounds.clip.right);
		expect(bounds.ring.top).toBeGreaterThanOrEqual(bounds.clip.top);
		expect(bounds.ring.bottom).toBeLessThanOrEqual(bounds.clip.bottom);
	}
});

test("正文图片打开原图预览，并复用浏览器已经选中的缩略候选", async ({ page, context }) => {
	await loadClient(context);
	const requests: string[] = [];
	await context.route("**/uploads/contract-article.png*", (route) => {
		requests.push(route.request().url());
		return route.fulfill({
			path: join(import.meta.dirname, "fixtures/article-preview.png"),
			contentType: "image/png",
		});
	});
	await page.goto("/blog/contract-rich-image");
	await expect(page.locator("[data-article-content] pre.shiki")).toBeVisible();
	const image = page.getByRole("img", { name: "可预览的正文图片", exact: true });
	await expect(image).toBeVisible();
	await expect
		.poll(() => image.evaluate((element: HTMLImageElement) => element.complete))
		.toBe(true);
	const thumbnail = await image.evaluate((element: HTMLImageElement) => element.currentSrc);
	await image.click();
	const preview = page.getByLabel("图片预览", { exact: true });
	await expect(preview).toBeVisible();
	await expect(preview.locator('img[src$="/uploads/contract-article.png"]')).toBeVisible();
	expect(requests.some((url) => new URL(url).search === "")).toBe(true);
	expect(requests.every((url) => url === thumbnail || new URL(url).search === "")).toBe(true);
	await preview.press("ArrowLeft");
	await expect(preview).toBeVisible();
	await expect(page).toHaveURL(/\/blog\/contract-rich-image$/);
	await page.keyboard.press("Escape");
	await expect(preview).not.toBeVisible();
	await expect(image).toBeVisible();
	await page.keyboard.press("ArrowLeft");
	await expect(page).toHaveURL(/\/blog\/contract-rich-toc-copy$/);
});

test("同正文文章切换后，目录跟踪新文章的标题节点", async ({ page, context }) => {
	await loadClient(context);
	await page.goto("/blog/contract-rich-toc");
	await expect(page.locator("[data-article-content] pre.shiki")).toBeVisible();
	const previousTitle = await page.getByRole("heading", { level: 1 }).innerText();
	await page
		.getByRole("navigation", { name: "章节导航" })
		.getByRole("link", { name: /下一章/ })
		.click();
	await expect(page).toHaveURL(/\/blog\/contract-rich-toc-copy$/);
	await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(previousTitle);
	await expect(page.locator("[data-article-content] pre.shiki")).toBeVisible();
	await page.getByRole("button", { name: "展开完整目录", exact: true }).hover();
	const firstLink = page
		.locator("[data-toc-accordion]")
		.getByRole("link", { name: "富内容局部恢复", exact: true });
	await firstLink.click();
	await expect
		.poll(async () => {
			const bounds = await page
				.locator("[data-article-content]")
				.getByRole("heading", { level: 2, name: /^富内容局部恢复/ })
				.boundingBox();
			return bounds?.y ?? Number.POSITIVE_INFINITY;
		})
		.toBeLessThan(120);
	await page.evaluate(async () => {
		const frame = Promise.withResolvers<void>();
		requestAnimationFrame(() => requestAnimationFrame(() => frame.resolve()));
		await frame.promise;
	});
	await expect(firstLink).toHaveAttribute("aria-current", "location");
});
