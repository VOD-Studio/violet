import { expect, type Page, test } from "@playwright/test";

const card = (id: string) => `[data-card-id="${id}"]`;
const tab = (page: Page, name: string | RegExp) => page.getByRole("tab", { name });
const visibleCards = (page: Page) =>
	page
		.locator("[data-card-id]")
		.evaluateAll((items) => items.map((item) => item.getAttribute("data-card-id")));

async function open(page: Page, query = "") {
	await page.goto(`${process.env.KANBAN_FIXTURE_URL}?view=switcher${query}`);
	await expect(page.getByRole("tablist")).toBeVisible();
}

test.describe("窄屏的列切换布局（390px）", () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test("一次只显示一列，点击标签切换；页面没有横向溢出", async ({ page }) => {
		await open(page);

		expect(await visibleCards(page)).toEqual(["a", "b", "c"]);
		await tab(page, /^In progress/).click();
		expect(await visibleCards(page)).toEqual(["d"]);
		await expect(tab(page, /^In progress/)).toHaveAttribute("aria-selected", "true");

		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth,
		);
		expect(overflow).toBeLessThanOrEqual(0);
	});

	test("标签与卡片占满窄屏的宽度，卡片文字不被挤压", async ({ page }) => {
		await open(page);

		const column = await page.locator(".v-kanban__column").boundingBox();
		const first = await page.locator(card("a")).boundingBox();
		expect(column?.width).toBeGreaterThan(330);
		expect(first?.width).toBeGreaterThan(300);
	});

	test("方向键在标签间移动并切换列", async ({ page }) => {
		await open(page);

		await tab(page, /^Planned/).focus();
		await page.keyboard.press("ArrowRight");
		await expect(tab(page, /^In progress/)).toBeFocused();
		expect(await visibleCards(page)).toEqual(["d"]);
		await page.keyboard.press("ArrowRight");
		expect(await visibleCards(page)).toEqual(["e"]);
		await page.keyboard.press("End");
		await expect(tab(page, /^Later/)).toHaveAttribute("aria-selected", "true");
	});

	test("标签的聚焦环完整：落在标签条的内边距之内，没有被裁剪", async ({ page }) => {
		await open(page);

		await page.keyboard.press("Tab");
		await expect(tab(page, /^Planned/)).toBeFocused();
		const rects = await page.evaluate(() => {
			const list = document.querySelector(".v-kanban__switcher") as HTMLElement;
			const focused = document.activeElement as HTMLElement;
			const style = getComputedStyle(focused);
			const reach =
				Number.parseFloat(style.outlineWidth) + Number.parseFloat(style.outlineOffset);
			return {
				reach,
				outlineStyle: style.outlineStyle,
				list: list.getBoundingClientRect().toJSON(),
				tab: focused.getBoundingClientRect().toJSON(),
			};
		});
		expect(rects.outlineStyle).toBe("solid");
		expect(rects.tab.left - rects.reach).toBeGreaterThanOrEqual(rects.list.left);
		expect(rects.tab.top - rects.reach).toBeGreaterThanOrEqual(rects.list.top);
		expect(rects.tab.bottom + rects.reach).toBeLessThanOrEqual(rects.list.bottom);
	});

	test("「移到…」菜单常显：移到另一列后显示的列跟着卡片，焦点在卡片上", async ({ page }) => {
		await open(page);

		const trigger = page
			.locator(card("a"))
			.getByRole("button", { name: "Move Task A to another column" });
		await expect(trigger).toBeVisible();
		await trigger.click();
		await page.getByRole("menuitem", { name: "In progress" }).click();

		await expect(tab(page, /^In progress/)).toHaveAttribute("aria-selected", "true");
		expect(await visibleCards(page)).toEqual(["d", "a"]);
		await expect(page.locator(card("a"))).toBeFocused();
		expect(await page.evaluate(() => window.__moves.map((move) => move.cardId))).toEqual(["a"]);
	});

	test("保存失败时卡片回到原位，显示的列也回到原来的列", async ({ page }) => {
		await open(page, "&fail");

		await page
			.locator(card("a"))
			.getByRole("button", { name: "Move Task A to another column" })
			.click();
		await page.getByRole("menuitem", { name: "Done" }).click();

		await expect(page.locator(".v-kanban__notice")).toContainText("couldn't be saved");
		await expect(tab(page, /^Planned/)).toHaveAttribute("aria-selected", "true");
		expect(await visibleCards(page)).toEqual(["a", "b", "c"]);
	});

	test("键盘拿起卡片后用左右方向键换列，显示的列跟着走；Esc 取消后回到出发的列", async ({
		page,
	}) => {
		await open(page);

		await page.locator(card("a")).focus();
		await page.keyboard.press("Space");
		await page.keyboard.press("ArrowRight");
		await expect(tab(page, /^In progress/)).toHaveAttribute("aria-selected", "true");
		expect(await visibleCards(page)).toEqual(["a", "d"]);
		await expect(page.locator(card("a"))).toBeFocused();

		await page.keyboard.press("Escape");
		await expect(tab(page, /^Planned/)).toHaveAttribute("aria-selected", "true");
		expect(await visibleCards(page)).toEqual(["a", "b", "c"]);
	});

	test("同一列内仍可用指针拖拽重排", async ({ page }) => {
		await open(page);

		const from = await page.locator(card("a")).boundingBox();
		const to = await page.locator(card("c")).boundingBox();
		if (!from || !to) throw new Error("cards are not visible");
		await page.mouse.move(from.x + 20, from.y + 10);
		await page.mouse.down();
		await page.mouse.move(from.x + 24, from.y + 14, { steps: 2 });
		await page.mouse.move(to.x + 20, to.y + to.height - 4, { steps: 10 });
		await page.mouse.up();

		await expect.poll(() => visibleCards(page)).toEqual(["b", "c", "a"]);
		expect(await page.evaluate(() => window.__moves.map((move) => move.to))).toEqual([
			{ columnId: "todo", index: 2 },
		]);
	});

	test("每张有关系的卡片带可点击的标记，长标题被截断而不撑开卡片", async ({ page }) => {
		await open(page);

		const markers = page.locator(card("b")).locator(".v-kanban__marker");
		await expect(markers).toHaveCount(1);
		const sizes = await page.evaluate(() => {
			const item = document.querySelector('[data-card-id="b"]') as HTMLElement;
			const mark = item.querySelector(".v-kanban__marker") as HTMLElement;
			return {
				card: item.getBoundingClientRect().toJSON(),
				marker: mark.getBoundingClientRect().toJSON(),
				truncated: mark.scrollWidth > mark.clientWidth,
			};
		});
		expect(sizes.truncated).toBe(true);
		expect(sizes.marker.right).toBeLessThanOrEqual(sizes.card.right);
		expect(sizes.marker.height).toBeGreaterThanOrEqual(28);
	});

	test("点击标记跳到另一列的卡片：切到那一列并聚焦，目标在视口里", async ({ page }) => {
		await open(page);

		await page
			.locator(card("a"))
			.getByRole("button", { name: /extends Task D/ })
			.click();

		await expect(tab(page, /^In progress/)).toHaveAttribute("aria-selected", "true");
		await expect(page.locator(card("d"))).toBeFocused();
		await expect(page.locator(card("d"))).toHaveAttribute("data-arrived", "true");
		await expect(page.locator(card("d"))).toBeInViewport();
	});

	test("原路回去：目标卡片上有指回来的标记", async ({ page }) => {
		await open(page);

		await page
			.locator(card("a"))
			.getByRole("button", { name: /extends Task D/ })
			.click();
		await page
			.locator(card("d"))
			.getByRole("button", { name: /is extended by Task A/ })
			.click();

		await expect(tab(page, /^Planned/)).toHaveAttribute("aria-selected", "true");
		await expect(page.locator(card("a"))).toBeFocused();
	});

	test("目标在同一列的屏幕之外：滚到视口里并聚焦", async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 600 });
		await open(page);
		await tab(page, /^Later/).click();
		await expect(page.locator(card("m14"))).not.toBeInViewport();
		expect(await page.evaluate(() => window.scrollY)).toBe(0);

		await page
			.locator(card("m1"))
			.getByRole("button", { name: /extends Later 14/ })
			.click();

		await expect(page.locator(card("m14"))).toBeFocused();
		await expect(page.locator(card("m14"))).toBeInViewport({ ratio: 1 });
		expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
	});

	test("标记按钮的聚焦环完整，且点击标记不会拖起卡片", async ({ page }) => {
		await open(page);

		const button = page.locator(card("a")).getByRole("button", { name: /extends Task D/ });
		// Tab 顺序：当前列标签、卡片 A、A 上的关系标记
		for (let times = 0; times < 3; times += 1) await page.keyboard.press("Tab");
		await expect(button).toBeFocused();
		const outline = await button.evaluate((element) => getComputedStyle(element).outlineStyle);
		expect(outline).toBe("solid");

		const box = await button.boundingBox();
		if (!box) throw new Error("marker is not visible");
		await page.mouse.move(box.x + 10, box.y + 10);
		await page.mouse.down();
		await page.mouse.move(box.x + 60, box.y + 60, { steps: 5 });
		await expect(page.locator(".v-kanban__ghost")).toHaveCount(0);
		await page.mouse.up();
	});
});
