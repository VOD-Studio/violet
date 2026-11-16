import { expect, test } from "@playwright/test";
import { loadClient } from "./client";
import { openClientPage } from "./support";

test("全文命中在窄屏仍可见，方向键将当前结果滚入视口", async ({ page, context }) => {
	await loadClient(context);
	await context.route("**/api/v1/posts/search?**", (route) =>
		route.fulfill({
			json: {
				data: Array.from({ length: 5 }, (_, index) => ({
					id: `body-match-${index}`,
					slug: `body-match-${index}`,
					title: `正文检索结果 ${index + 1}`,
					status: "published",
					tags: [],
					snippet: `${"正文上下文".repeat(16)}设计${"后续说明".repeat(20)}`,
					updated_at: "2026-11-13T00:00:00Z",
				})),
				meta: { pagination: { page: 1, limit: 8, total: 5, total_pages: 1 } },
			},
		}),
	);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await openClientPage(page, "/blog");
	await page
		.getByRole("navigation", { name: "主导航" })
		.getByRole("button", { name: /^搜索/ })
		.click();
	const dialog = page.getByRole("dialog");
	const input = dialog.getByRole("combobox");
	await input.fill("设计");
	const results = dialog.getByRole("option");
	await expect(results).toHaveCount(5);
	const firstHit = results.first().locator("mark");
	await expect(firstHit).toHaveText("设计");
	await expect(firstHit).toBeInViewport({ ratio: 1 });

	await page.setViewportSize({ width: 320, height: 740 });
	await expect(firstHit).toBeInViewport({ ratio: 1 });
	const listbox = dialog.getByRole("listbox");
	await expect
		.poll(() => listbox.evaluate((element) => element.scrollWidth <= element.clientWidth))
		.toBe(true);
	for (let index = 1; index < 5; index += 1) await input.press("ArrowDown");
	await expect(results.last()).toHaveAttribute("aria-selected", "true");
	await expect(results.last().locator("mark")).toBeInViewport({ ratio: 1 });
	await expect(input).toBeFocused();
	await expect(input).toHaveAttribute(
		"aria-activedescendant",
		(await results.last().getAttribute("id")) ?? "",
	);
	await expect.poll(() => listbox.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
});

test("长查询的空状态不会撑宽面板，清空后可继续选择命令", async ({ page, context }) => {
	await loadClient(context);
	await context.route("**/api/v1/posts/search?**", (route) =>
		route.fulfill({
			json: {
				data: [],
				meta: { pagination: { page: 1, limit: 8, total: 0, total_pages: 0 } },
			},
		}),
	);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await openClientPage(page, "/blog");
	const trigger = page
		.getByRole("navigation", { name: "主导航" })
		.getByRole("button", { name: /^搜索/ });
	await trigger.click();
	const dialog = page.getByRole("dialog");
	const input = dialog.getByRole("combobox");
	const query = `${"没有匹配内容".repeat(5)}${"unbrokentext".repeat(10)}`;
	await Promise.all([
		page.waitForResponse((response) => new URL(response.url()).searchParams.get("q") === query),
		input.fill(query),
	]);
	await expect(dialog.getByRole("status")).toBeVisible();
	await expect(dialog.getByRole("option")).toHaveCount(0);
	await expect(input).not.toHaveAttribute("aria-activedescendant");
	for (const width of [1440, 320]) {
		await page.setViewportSize({ width, height: 740 });
		await expect
			.poll(() =>
				dialog
					.getByRole("listbox")
					.evaluate((element) => element.scrollWidth <= element.clientWidth),
			)
			.toBe(true);
		await expect
			.poll(() =>
				dialog.evaluate((element) => {
					const box = element.getBoundingClientRect();
					return box.left >= 0 && box.right <= document.documentElement.clientWidth;
				}),
			)
			.toBe(true);
	}
	await input.fill("");
	await expect(dialog.getByRole("option", { name: /^切换明暗/ })).toBeVisible();
	await expect(input).toBeFocused();
	await page.setViewportSize({ width: 1440, height: 900 });
	await input.press("Escape");
	await expect(dialog).toHaveCount(0);
	await expect(trigger).toBeFocused();
});
