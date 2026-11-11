import { expect, type Locator, type Page, test } from "@playwright/test";
import { loadClient } from "./client";
import { ROADMAP_EMBED_POST } from "./mock-data.mjs";
import { openClientPage } from "./support.ts";

const PATH = `/blog/${ROADMAP_EMBED_POST.slug}`;

/** 用鼠标拖选元素里第一段文字的前 `length` 个字，返回选中的文字。 */
async function dragSelect(page: Page, target: Locator, length: number) {
	await target.scrollIntoViewIfNeeded();
	const points = await target.evaluate((element, count) => {
		const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
		let text = walker.nextNode();
		while (text && (text.textContent ?? "").trim().length < count) text = walker.nextNode();
		if (!text) throw new Error("元素里没有足够长的文字");
		const offset = (text.textContent ?? "").search(/\S/);
		const start = document.createRange();
		start.setStart(text, offset);
		start.setEnd(text, offset + 1);
		const end = document.createRange();
		end.setStart(text, offset + count - 1);
		end.setEnd(text, offset + count);
		const first = start.getBoundingClientRect();
		const last = end.getBoundingClientRect();
		return {
			x1: first.left + 1,
			y1: first.top + first.height / 2,
			x2: last.right - 1,
			y2: last.top + last.height / 2,
		};
	}, length);
	await page.mouse.move(points.x1, points.y1);
	await page.mouse.down();
	await page.mouse.move(points.x2, points.y2, { steps: 6 });
	await page.mouse.up();
	return page.evaluate(() => window.getSelection()?.toString() ?? "");
}

test("正文段落选中后出现批注工具，嵌入卡里的文字选中后不出现", async ({ page, context }) => {
	await loadClient(context);
	await openClientPage(page, PATH);
	const toolbar = page.getByRole("toolbar", { name: "批注工具" });
	const article = page.locator("[data-article-content]");

	// 工具条在首次选区时才加载，重复拖选直到它接管
	await expect(async () => {
		expect(await dragSelect(page, article.getByText("中间的一段话。"), 4)).toBe("中间的一");
		await expect(toolbar).toBeVisible({ timeout: 1_000 });
	}).toPass();

	const notice = page.locator('[data-roadmap-embed="notice"]');
	await expect(notice).toBeVisible();
	expect((await dragSelect(page, notice, 4)).length).toBeGreaterThan(0);
	await expect(toolbar).toHaveCount(0);

	// 嵌入卡之后的段落仍可批注，说明工具条不是整体失效
	expect(await dragSelect(page, article.getByText("文章结尾的一段话。"), 4)).toBe("文章结尾");
	await expect(toolbar).toBeVisible();
});
