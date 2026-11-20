import { expect, test } from "@playwright/test";
import { loadClient } from "./client";

const releaseURL = "https://github.com/VOD-Studio/violet/releases/tag/v2.0.0";

test("关闭脚本也能查周统计、版本并进入更早的生长历史", async ({ browser }) => {
	const context = await browser.newContext({ javaScriptEnabled: false });
	try {
		const page = await context.newPage();
		await page.goto("/about");
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(/种下\s*1,326\s*天/);
		const growth = page.getByRole("region", { name: "生长图" });
		const details = growth.getByText("逐周查看记录", { exact: true });
		await details.click();
		await expect(growth.getByText("17 次提交", { exact: true })).toBeVisible();
		await expect(growth.getByRole("link", { name: "v2.0.0", exact: true })).toHaveAttribute(
			"href",
			releaseURL,
		);
		const flowers = page.getByRole("region", { name: "最近开的花" });
		await expect(flowers.getByRole("link", { name: /v2.0.0/ })).toHaveAttribute(
			"href",
			releaseURL,
		);
		await expect(flowers.getByText("进展契约版本")).toBeVisible();
		await growth.getByRole("link", { name: "上一个时段" }).click();
		await expect(page).toHaveURL(/growth=/);
		await expect(growth.getByRole("link", { name: "下一个时段" })).toBeVisible();
		await expect(growth.getByText("0 次提交", { exact: true }).first()).toBeHidden();
		await details.click();
		await expect(growth.getByText("0 次提交", { exact: true }).first()).toBeVisible();
	} finally {
		await context.close();
	}
});

test("键盘选择空窗和有发布的周，版本入口不会留在上一周", async ({ page, context }) => {
	await loadClient(context);
	await page.goto("/about");
	const group = page.getByRole("group", { name: "选择一周" });
	const latest = group.getByRole("button", { name: /2026年8月17日/ });
	await expect(latest).toBeEnabled();
	await latest.focus();
	await expect(latest).toHaveAttribute("aria-pressed", "true");
	const selection = page.getByRole("region", { name: "所选周进展" });
	await expect(selection.getByRole("group", { name: "提交 0" })).toBeVisible();
	await latest.press("ArrowLeft");
	const previous = group.getByRole("button", { name: /2026年8月10日/ });
	await expect(previous).toBeFocused();
	await expect(previous).toHaveAttribute("aria-pressed", "true");
	await expect(selection.getByRole("group", { name: "提交 8" })).toBeVisible();
	await expect(selection.getByRole("link", { name: "v2.0.0" })).toHaveAttribute(
		"href",
		releaseURL,
	);
	await previous.press("End");
	await expect(latest).toBeFocused();
	await expect(selection.getByRole("link", { name: "v2.0.0" })).toBeHidden();
});

test.describe("窄屏手指选择", () => {
	test.use({ viewport: { width: 320, height: 744 }, hasTouch: true, reducedMotion: "reduce" });

	test("点击对应日期的叶片或花苞列，不撑宽整个页面", async ({ page, context }) => {
		await loadClient(context);
		await page.goto("/about");
		const graph = page.getByRole("group", { name: "选择一周" });
		await graph.getByRole("button", { name: /2026年8月10日/ }).tap();
		const selection = page.getByRole("region", { name: "所选周进展" });
		await expect(selection.getByRole("link", { name: "v2.0.0" })).toBeVisible();
		const { pageWidth, viewportWidth } = await page.evaluate(() => ({
			pageWidth: document.documentElement.scrollWidth,
			viewportWidth: document.documentElement.clientWidth,
		}));
		expect(pageWidth).toBe(viewportWidth);
	});
});
