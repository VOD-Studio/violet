import { expect, test } from "@playwright/test";
import { loadClient } from "./client";
import { openClientPage } from "./support.ts";

const PATH = "/blog/contract-rich-code";

test("桌面键盘不需悬停即可发起段评，关闭后焦点回到入口", async ({ page, context }) => {
	await loadClient(context);
	await openClientPage(page, PATH);
	const entry = page.getByRole("button", { name: /^发表段评/ });
	await expect(entry).toHaveCount(1);
	await entry.focus();
	await expect(entry).toHaveAttribute("data-show", "true");
	await expect(entry).toHaveAccessibleName(/^发表段评：.+/);
	const first = await entry.getAttribute("aria-label");
	await page.keyboard.press("ArrowDown");
	await expect(entry).not.toHaveAttribute("aria-label", first ?? "");
	// 代码块不是可段评段落：方向键只在文字段落之间移动
	await expect(entry).not.toHaveAccessibleName(/recoveryMessage/);
	const target = await entry.getAttribute("aria-label");

	await page.keyboard.press("Enter");
	const composer = page.getByRole("dialog", { name: "发表段评" });
	await expect(composer).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(composer).toHaveCount(0);
	await expect(entry).toBeFocused();
	await expect(entry).toHaveAttribute("aria-label", target ?? "");
});

test.describe("390px 手机", () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

	test("点按段落出现段评入口，点按代码块不出现", async ({ page, context }) => {
		await loadClient(context);
		await openClientPage(page, PATH);
		const entry = page.getByRole("button", { name: /^发表段评/ });
		const paragraph = page
			.locator("[data-article-content] p")
			.filter({ hasText: "增强加载失败时，这段正文始终保留。" });
		await expect(async () => {
			await paragraph.tap();
			await expect(entry).toHaveAttribute("data-show", "true", { timeout: 1_000 });
		}).toPass();
		await expect(entry).toBeVisible();
		await expect(entry).toHaveAccessibleName("发表段评：增强加载失败时，这段正文始终保留。");
		// 入口与段落水平对齐、停在正文范围内（跟在末行文字后），不压页边
		await expect
			.poll(async () => {
				const box = await entry.boundingBox();
				const text = await paragraph.boundingBox();
				return Boolean(
					box && text && box.x >= text.x && box.x + box.width <= text.x + text.width,
				);
			})
			.toBe(true);
		await page.screenshot({ path: test.info().outputPath("mobile-entry.png") });

		await expect(async () => {
			await entry.tap();
			await expect(page.getByRole("dialog", { name: "发表段评" })).toBeVisible({
				timeout: 1_000,
			});
		}).toPass();
		await page.keyboard.press("Escape");

		await page.locator("[data-article-content] pre").first().tap();
		await expect(entry).not.toHaveAttribute("data-show", "true");
	});
});
