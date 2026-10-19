import { expect, type Page, test } from "@playwright/test";

const canvas = ".v-kanban-canvas";

async function settle(page: Page) {
	await page.evaluate(() =>
		Promise.all(document.getAnimations().map((animation) => animation.finished)),
	);
}

test("从页面原位展开，关闭后卡片回到同一位置且不拉伸", async ({ page }) => {
	await page.goto(`${process.env.KANBAN_FIXTURE_URL}?view=canvas`);
	const card = page.locator('[data-card-id="a"]');
	const before = await card.boundingBox();
	if (!before) throw new Error("card is not visible");
	await page.getByRole("button", { name: "Enter full screen" }).click();
	await page.locator(canvas).evaluate((node) => {
		for (const animation of node.getAnimations({ subtree: true })) {
			animation.pause();
			animation.currentTime = 0;
		}
	});
	const opening = await card.boundingBox();
	if (!opening) throw new Error("opening card is not visible");
	for (const key of ["x", "y", "width", "height"] as const)
		expect(opening[key]).toBeCloseTo(before[key], 1);
	await page.locator(canvas).evaluate((node) => {
		for (const animation of node.getAnimations({ subtree: true })) animation.play();
	});
	await settle(page);
	await page.getByRole("button", { name: "Exit full screen" }).click();
	await expect(page.locator(canvas)).not.toHaveAttribute("data-fullscreen", "true");
	const restored = await card.boundingBox();
	if (!restored) throw new Error("restored card is not visible");
	for (const key of ["x", "y", "width", "height"] as const)
		expect(restored[key]).toBeCloseTo(before[key], 1);
});

test("长画布全屏保持文档占位，退出恢复滚动、缩放和触发器焦点", async ({ page }) => {
	await page.goto(`${process.env.KANBAN_FIXTURE_URL}?view=canvas`);
	await expect(page.locator(canvas)).toBeVisible();
	await page.locator(canvas).evaluate((node) => {
		node.style.height = "1800px";
		node.style.marginTop = "600px";
	});
	await page.getByRole("button", { name: "Zoom in" }).click();
	await settle(page);
	await page.locator(canvas).evaluate((node) => {
		window.scrollTo({
			top: node.getBoundingClientRect().top + scrollY - 100,
			behavior: "instant",
		});
	});
	const before = await page.evaluate(() => ({
		scroll: scrollY,
		height: document.documentElement.scrollHeight,
		transform: (document.querySelector(".v-kanban-canvas__content") as HTMLElement).style
			.transform,
	}));
	await page.getByRole("button", { name: "Enter full screen" }).click();
	await expect(page.locator(canvas)).toHaveAttribute("data-fullscreen", "true");
	await settle(page);
	const full = await page.locator(canvas).boundingBox();
	const size = page.viewportSize();
	expect(full).toMatchObject({ x: 0, y: 0, width: size?.width, height: size?.height });
	expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(before.height);
	expect(await page.evaluate(() => scrollY)).toBe(before.scroll);
	await page.getByRole("button", { name: "Zoom out" }).click();
	await page.keyboard.press("Escape");
	await expect(page.locator(canvas)).not.toHaveAttribute("data-fullscreen", "true");
	await settle(page);
	expect(await page.evaluate(() => scrollY)).toBe(before.scroll);
	expect(
		await page.locator(".v-kanban-canvas__content").evaluate((node) => node.style.transform),
	).toBe(before.transform);
	await expect(page.getByRole("button", { name: "Enter full screen" })).toBeFocused();
});

test("进入过渡中 Escape 可取消，连续开关不会留下滚动锁或透明画布", async ({ page }) => {
	await page.goto(`${process.env.KANBAN_FIXTURE_URL}?view=canvas`);
	await page.getByRole("button", { name: "Enter full screen" }).click();
	await page.keyboard.press("Escape");
	await settle(page);
	await expect(page.locator(canvas)).not.toHaveAttribute("data-fullscreen", "true");
	await expect(page.locator(canvas)).toHaveCSS("opacity", "1");
	expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
	await page.getByRole("button", { name: "Enter full screen" }).click();
	await expect(page.locator(canvas)).toHaveAttribute("data-fullscreen", "true");
	await page.getByRole("button", { name: "Exit full screen" }).click();
	await expect(page.locator(canvas)).not.toHaveAttribute("data-fullscreen", "true");
	await settle(page);
	await expect(page.locator(canvas)).toHaveCSS("opacity", "1");
	expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
});

test("减弱动态偏好直接切换全屏且没有透明度过渡", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(`${process.env.KANBAN_FIXTURE_URL}?view=canvas`);
	await page.getByRole("button", { name: "Enter full screen" }).click();
	await expect(page.locator(canvas)).toHaveAttribute("data-fullscreen", "true");
	expect(await page.locator(canvas).evaluate((node) => node.getAnimations().length)).toBe(0);
	await page.keyboard.press("Escape");
	await expect(page.locator(canvas)).not.toHaveAttribute("data-fullscreen", "true");
	await expect(page.locator(canvas)).toHaveCSS("opacity", "1");
});
