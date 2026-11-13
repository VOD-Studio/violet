import { expect, type Locator, test } from "@playwright/test";
import { loadClient } from "./client";
import { openClientPage } from "./support";

async function expectContainedIcons(entry: Locator, reference: Locator) {
	const geometry = await entry.evaluate((node) => {
		const entryBox = node.getBoundingClientRect();
		return Array.from(node.querySelectorAll("svg"), (icon) => {
			const box = icon.getBoundingClientRect();
			return {
				width: box.width,
				left: box.left - entryBox.left,
				right: entryBox.right - box.right,
			};
		});
	});
	expect(geometry).toHaveLength(2);
	expect(geometry[0].width).toBeCloseTo(16, 0);
	expect(geometry[1].width).toBeCloseTo(12, 0);
	for (const icon of geometry) {
		expect(icon.left).toBeGreaterThanOrEqual(0);
		expect(icon.right).toBeGreaterThanOrEqual(0);
	}
	const referenceInsets = await reference.evaluate((node) => {
		const box = node.getBoundingClientRect();
		const icon = node.querySelector("svg");
		const label = node.querySelector('[data-slot="navbar-label"]');
		if (!icon || !label) throw new Error("参照导航项必须包含图标与文字");
		return {
			left: icon.getBoundingClientRect().left - box.left,
			right: box.right - label.getBoundingClientRect().right,
		};
	});
	expect(geometry[0].left).toBeCloseTo(referenceInsets.left, 0);
	expect(geometry[1].right).toBeCloseTo(referenceInsets.right, 0);
}

for (const authenticated of [false, true]) {
	for (const width of [1024, 1440]) {
		test(`导航留白一致且长名称保留两字：${width}px ${authenticated ? "登录" : "游客"}`, async ({
			page,
			context,
		}) => {
			await loadClient(context);
			if (authenticated) {
				await context.addCookies([
					{ name: "contract_admin", value: "1", url: "http://127.0.0.1:4173" },
				]);
			}
			await page.setViewportSize({ width, height: 900 });
			await page.emulateMedia({ reducedMotion: "reduce" });
			await openClientPage(page, "/");
			const nav = page.getByRole("navigation", { name: "主导航" });
			const reference = nav.getByRole("link", { name: "博客", exact: true });
			const more = nav.getByRole("button", { name: "更多", exact: true });
			await expectContainedIcons(more, reference);
			const shortLabel = more.locator('[data-slot="navbar-label"]');
			await expect
				.poll(() => shortLabel.evaluate((node) => node.scrollWidth <= node.clientWidth))
				.toBe(true);
			await openClientPage(page, "/editor-guide");
			const entry = nav.locator('[data-segment-item][aria-current="page"]');
			const label = entry.locator('[data-slot="navbar-label"]');
			await expect(entry).toBeVisible();
			await expect(entry).toHaveAccessibleName("编辑器手册");
			await expect(nav.locator("[data-segment-item]")).toHaveCount(authenticated ? 6 : 5);
			await expectContainedIcons(entry, reference);
			await expect(label).toHaveText("编辑…");
			await expect
				.poll(() => label.evaluate((node) => node.scrollWidth <= node.clientWidth))
				.toBe(true);
			await label.hover();
			await expect(page.getByRole("tooltip")).toHaveText("编辑器手册");
			await page.mouse.move(0, 500);

			const bounds = await nav.boundingBox();
			const root = page.locator('[data-slot="site-navbar"]');
			const left = await root.locator('[data-slot="navbar-left"]').boundingBox();
			const right = await root.locator('[data-slot="navbar-right"]').boundingBox();
			if (!bounds || !left || !right) throw new Error("三枚导航胶囊必须可见");
			expect(bounds.x).toBeGreaterThanOrEqual(0);
			expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
			expect(left.x + left.width).toBeLessThanOrEqual(bounds.x);
			expect(bounds.x + bounds.width).toBeLessThanOrEqual(right.x);

			await page.mouse.move(width - 1, 500);
			await page.evaluate(() => window.scrollTo(0, 700));
			await expect(page.locator('[data-slot="site-navbar"]')).toHaveAttribute(
				"data-collapsed",
				"true",
			);
			const collapsed = nav.getByRole("button", { name: "更多", exact: true });
			await expect(collapsed).toHaveAttribute("aria-current", "page");
			await expect.poll(async () => (await collapsed.boundingBox())?.width).toBe(40);
			await expect(collapsed.locator("svg")).toHaveCount(1);
		});
	}
}
