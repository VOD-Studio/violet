import { expect, type Page, test } from "@playwright/test";

const card = (id: string) => `[data-card-id="${id}"]`;
const canvas = (page: Page) => page.locator(".v-kanban-canvas");
const tablist = (page: Page) => page.getByRole("tablist");
const layout = (page: Page) => page.locator(".v-kanban-responsive").getAttribute("data-layout");

async function open(page: Page, query = "") {
	await page.goto(`${process.env.KANBAN_FIXTURE_URL}?view=responsive${query}`);
	await expect(page.locator(".v-kanban-responsive")).toBeVisible();
}

test.describe("按容器宽度切换画布与列切换布局", () => {
	test("桌面宽度：画布里的看板，没有列切换器", async ({ page }) => {
		await open(page);

		await expect(canvas(page)).toBeVisible();
		await expect(tablist(page)).toHaveCount(0);
		expect(await layout(page)).toBe("wide");
		await expect(page.locator(".v-kanban__relation").first()).toBeVisible();
	});

	test.describe("390px", () => {
		test.use({ viewport: { width: 390, height: 844 } });

		test("窄屏：列切换器，没有画布；页面没有横向溢出", async ({ page }) => {
			await open(page);

			await expect(tablist(page)).toBeVisible();
			await expect(canvas(page)).toHaveCount(0);
			expect(await layout(page)).toBe("narrow");
			const overflow = await page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth,
			);
			expect(overflow).toBeLessThanOrEqual(0);
		});

		test("窄屏里关系用标记，没有关系线", async ({ page }) => {
			await open(page);

			await expect(page.locator(".v-kanban__relation")).toHaveCount(0);
			await expect(
				page.locator(card("a")).getByRole("button", { name: /extends Task D/ }),
			).toBeVisible();
		});
	});

	test("窗口尺寸变化时在两种布局间切换，浏览器里没有报错", async ({ page }) => {
		const problems: string[] = [];
		page.on("console", (message) => {
			if (message.type() === "error" || message.type() === "warning")
				problems.push(message.text());
		});
		page.on("pageerror", (error) => problems.push(error.message));
		await open(page);
		await expect(canvas(page)).toBeVisible();

		await page.setViewportSize({ width: 390, height: 844 });
		await expect(tablist(page)).toBeVisible();
		await expect(canvas(page)).toHaveCount(0);

		await page.setViewportSize({ width: 1200, height: 700 });
		await expect(canvas(page)).toBeVisible();
		await expect(tablist(page)).toHaveCount(0);
		expect(problems).toEqual([]);
	});

	test("在窄屏里移动的卡片，回到宽屏后画布里的看板就在新的列", async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await open(page);

		await page
			.locator(card("a"))
			.getByRole("button", { name: "Move Task A to another column" })
			.click();
		await page.getByRole("menuitem", { name: "In progress" }).click();
		await expect(page.getByRole("tab", { name: /^In progress/ })).toHaveAttribute(
			"aria-selected",
			"true",
		);

		await page.setViewportSize({ width: 1200, height: 700 });
		await expect(canvas(page)).toBeVisible();
		await expect(page.locator(`[data-column-id="doing"] ${card("a")}`)).toBeVisible();
	});

	test("显示的列由页面持有时，宽窄切换后仍停在原来的列", async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await open(page);
		await page.getByRole("tab", { name: /^Done/ }).click();

		await page.setViewportSize({ width: 1200, height: 700 });
		await expect(canvas(page)).toBeVisible();
		await page.setViewportSize({ width: 390, height: 844 });

		await expect(page.getByRole("tab", { name: /^Done/ })).toHaveAttribute(
			"aria-selected",
			"true",
		);
	});

	test("阈值：容器 768px 是宽屏，767px 是窄屏（与窗口宽度无关）", async ({ page }) => {
		await open(page, "&width=768");
		await expect(canvas(page)).toBeVisible();
		expect(await layout(page)).toBe("wide");

		await open(page, "&width=767");
		await expect(tablist(page)).toBeVisible();
		expect(await layout(page)).toBe("narrow");
	});
});
