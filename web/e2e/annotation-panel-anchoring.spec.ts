import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { loadClient } from "./client";
import { openClientPage } from "./support.ts";

const PATH = "/blog/contract-rich-code";

async function loginAndOpen(context: BrowserContext, page: Page) {
	await loadClient(context);
	await context.addCookies([
		{ name: "contract_admin", value: "1", url: "http://127.0.0.1:4173" },
	]);
	await openClientPage(page, PATH);
}

/** 批注卡当前位置：面板必须停在正文附近（x 跟着划线），而不是视口左上角。 */
async function anchoredBox(page: Page) {
	const box = await page.getByRole("dialog", { name: "批注" }).boundingBox();
	expect(box).toBeTruthy();
	expect(box!.x).toBeGreaterThan(120);
	expect(box!.y).toBeGreaterThan(80);
	return box!;
}

test("批注卡回复与段评提交后仍贴着划线，不漂到视口左上角", async ({ page, context }) => {
	await loginAndOpen(context, page);
	const mark = page.getByRole("button", { name: /^1 条批注：/ });
	await mark.click();
	const panel = page.getByRole("dialog", { name: "批注" });
	await expect(panel).toBeVisible();
	await expect(panel).toContainText("这段原文被划线批注。");
	const before = await anchoredBox(page);

	// 回复既有批注：面板内容与缓存更新，定位参照不变
	await panel.getByRole("button", { name: /^回复 契约读者/ }).click();
	const editor = panel.getByRole("textbox", { name: "评论内容" });
	await editor.click();
	await page.keyboard.insertText("卡片里的回复");
	await panel.getByRole("button", { name: "发送", exact: true }).click();
	await expect(panel).toContainText("卡片里的回复");
	let after = await anchoredBox(page);
	expect(Math.abs(after.x - before.x)).toBeLessThan(80);
	expect(Math.abs(after.y - before.y)).toBeLessThan(300);

	// 内嵌段评（新的顶层批注）：批注摘要变化 → 划线整体重建、划线节点被替换
	const blockEditor = panel.getByRole("textbox", { name: "段评内容" });
	await blockEditor.scrollIntoViewIfNeeded();
	await blockEditor.click();
	await page.keyboard.insertText("再发一条段评");
	await panel.getByRole("button", { name: "发送段评" }).click();
	// 重建落成：同块出现第二处划线（新区间 8:12）
	await expect(page.getByRole("button", { name: /^1 条批注：这段正/ })).toBeVisible();
	// 滚动触发浮层随锚点重排：锚点已被替换的面板仍要贴着正文，而不是漂到视口角落或丢失
	await page.mouse.wheel(0, 120);
	await expect(panel).toBeVisible();
	after = await anchoredBox(page);
	expect(Math.abs(after.x - before.x)).toBeLessThan(80);
});
