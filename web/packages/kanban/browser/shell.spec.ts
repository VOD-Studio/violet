import { expect, type Page, test } from "@playwright/test";

async function open(page: Page, query = "") {
	await page.goto(`${process.env.KANBAN_FIXTURE_URL}?view=shell${query}`);
	await expect(page.locator('[data-card-id="a"]')).toBeVisible();
}

const column = (page: Page, id: string) => page.locator(`[data-column-id="${id}"]`);
const rectOf = (page: Page, selector: string) =>
	page.locator(selector).evaluate((element) => {
		const box = element.getBoundingClientRect();
		return {
			top: box.top,
			bottom: box.bottom,
			left: box.left,
			right: box.right,
			height: box.height,
		};
	});
const bodyHeight = async (page: Page, id: string) =>
	(await rectOf(page, `[data-column-id="${id}"] .v-kanban__column-body`)).height;
const finished = (page: Page) =>
	page.evaluate(() =>
		Promise.all(document.getAnimations().map((animation) => animation.finished)),
	);

/**
 * 聚焦环（轮廓线宽加偏移）超出最近的各个裁剪祖先的最小余量（px）；小于 0 表示被裁掉一部分。
 * 裁剪发生在祖先的内边距盒上。
 */
const ringSlack = (page: Page, selector: string) =>
	page.locator(selector).evaluate((element) => {
		const style = getComputedStyle(element);
		const grow = Number.parseFloat(style.outlineWidth) + Number.parseFloat(style.outlineOffset);
		const box = element.getBoundingClientRect();
		let slack = Number.POSITIVE_INFINITY;
		for (let parent = element.parentElement; parent; parent = parent.parentElement) {
			const parentStyle = getComputedStyle(parent);
			if (parentStyle.overflowX === "visible" && parentStyle.overflowY === "visible")
				continue;
			const clip = parent.getBoundingClientRect();
			const left = clip.left + parent.clientLeft;
			const top = clip.top + parent.clientTop;
			slack = Math.min(
				slack,
				box.left - grow - left,
				box.top - grow - top,
				left + parent.clientWidth - (box.right + grow),
				top + parent.clientHeight - (box.bottom + grow),
			);
		}
		return slack;
	});

test.describe("列折叠", () => {
	test("折叠与展开：列体高度平滑过渡到 0 再恢复，计数留在列头", async ({ page }) => {
		await open(page);
		const full = await bodyHeight(page, "todo");
		expect(full).toBeGreaterThan(100);

		await page.getByRole("button", { name: "Collapse Planned" }).click();
		await page.waitForTimeout(80);
		const middle = await bodyHeight(page, "todo");
		expect(middle).toBeGreaterThan(1);
		expect(middle).toBeLessThan(full);
		await finished(page);
		expect(await bodyHeight(page, "todo")).toBeLessThan(1);
		await expect(column(page, "todo").locator(".v-kanban__count")).toBeVisible();
		await expect(column(page, "todo").locator('[data-card-id="a"]')).toBeHidden();

		await page.getByRole("button", { name: "Expand Planned" }).click();
		await finished(page);
		expect(Math.abs((await bodyHeight(page, "todo")) - full)).toBeLessThan(1);
		await expect(column(page, "todo").locator('[data-card-id="a"]')).toBeVisible();
	});

	test("偏好减弱动态：折叠立即完成，没有高度过渡", async ({ page }) => {
		await page.emulateMedia({ reducedMotion: "reduce" });
		await open(page);

		await page.getByRole("button", { name: "Collapse Planned" }).click();

		expect(await bodyHeight(page, "todo")).toBeLessThan(1);
	});

	test("折叠后里面的卡片与按钮不可聚焦，Tab 直接跳过", async ({ page }) => {
		await open(page);
		await page.getByRole("button", { name: "Collapse Planned" }).click();
		await finished(page);

		await page.getByRole("button", { name: "Expand Planned" }).focus();
		for (let i = 0; i < 4; i += 1) {
			await page.keyboard.press("Tab");
			expect(
				await page.evaluate(() =>
					document.activeElement
						?.closest("[data-column-id]")
						?.getAttribute("data-column-id"),
				),
			).not.toBe("todo");
		}
	});

	test("折叠与展开前后，聚焦环都不被裁剪", async ({ page }) => {
		await open(page);
		const check = async () => {
			for (const selector of [
				'[data-column-id="todo"] [data-card-id="a"]',
				'[data-column-id="todo"] [data-card-id="c"]',
				'[data-column-id="done"] [data-card-id="e"]',
			]) {
				await page.locator(selector).focus();
				expect(await ringSlack(page, selector), selector).toBeGreaterThanOrEqual(0);
			}
		};

		await check();
		await page.getByRole("button", { name: "Collapse In progress" }).click();
		await page.getByRole("button", { name: "Expand In progress" }).click();
		await finished(page);
		await check();
	});
});

test.describe("折叠列与其它交互", () => {
	test("看板的横向滚动层没有多余的滚动范围：列体的裁剪层不能把它撑出可滚动的溢出", async ({
		page,
	}) => {
		await open(page);

		const overflow = await page.locator(".v-kanban__scroller").evaluate((element) => ({
			x: element.scrollWidth - element.clientWidth,
			y: element.scrollHeight - element.clientHeight,
		}));

		expect(overflow).toEqual({ x: 0, y: 0 });
	});

	test("折叠按钮的最下沿也点得到：列体的裁剪层盖在列头上，却不拦截指针", async ({ page }) => {
		await open(page);
		const button = page.getByRole("button", { name: "Collapse Planned" });
		const box = await button.boundingBox();
		if (!box) throw new Error("button not visible");

		await button.click({ position: { x: box.width / 2, y: box.height - 1 } });

		await expect(page.getByRole("button", { name: "Expand Planned" })).toBeVisible();
	});

	test("键盘拿着卡片进入折叠的列：列先展开，焦点跟着卡片，仍被拿着", async ({ page }) => {
		await open(page);
		await page.getByRole("button", { name: "Collapse In progress" }).click();
		await finished(page);
		await page.locator('[data-column-id="todo"] [data-card-id="a"]').focus();

		await page.keyboard.press("Enter");
		await page.keyboard.press("ArrowRight");
		await finished(page);

		await expect(page.getByRole("button", { name: "Collapse In progress" })).toBeVisible();
		const lifted = page.locator('[data-card-id="a"]');
		await expect(lifted).toHaveAttribute("data-lifted", "true");
		await expect(lifted).toBeFocused();
		await expect(column(page, "doing").locator('[data-card-id="a"]')).toBeVisible();
	});

	test("指针放在折叠的列上没有落点：卡片留在原处，不会落进看不见的地方", async ({ page }) => {
		await open(page);
		await page.getByRole("button", { name: "Collapse In progress" }).click();
		await finished(page);
		const from = await page.locator('[data-card-id="a"]').boundingBox();
		const header = await column(page, "doing")
			.locator(".v-kanban__column-header")
			.boundingBox();
		if (!from || !header) throw new Error("not visible");

		await page.mouse.move(from.x + 20, from.y + 10);
		await page.mouse.down();
		await page.mouse.move(header.x + header.width / 2, header.y + header.height / 2, {
			steps: 8,
		});
		await page.mouse.up();
		await finished(page);

		expect(await page.evaluate(() => window.__moves)).toEqual([]);
		await expect(column(page, "todo").locator('[data-card-id="a"]')).toBeVisible();
	});
});

test.describe("列底快速添加", () => {
	test("添加：回车提交，卡片出现在列尾，表单保持打开可以连续添加；Esc 关闭", async ({ page }) => {
		await open(page);
		await column(page, "doing").getByRole("button", { name: "Add card" }).click();
		const input = column(page, "doing").getByRole("textbox", {
			name: "New card title in In progress",
		});
		await expect(input).toBeFocused();

		await input.fill("First idea");
		await input.press("Enter");
		await expect(column(page, "doing").getByText("First idea")).toBeVisible();
		await expect(input).toHaveValue("");
		await expect(input).toBeFocused();
		await input.fill("Second idea");
		await input.press("Enter");
		await expect(column(page, "doing").getByText("Second idea")).toBeVisible();

		expect(await page.evaluate(() => window.__added)).toEqual([
			{ columnId: "doing", title: "First idea" },
			{ columnId: "doing", title: "Second idea" },
		]);
		await input.press("Escape");
		await expect(input).toHaveCount(0);
		await expect(column(page, "doing").getByRole("button", { name: "Add card" })).toBeFocused();
	});

	test("添加入口与输入框的聚焦环不被裁剪", async ({ page }) => {
		await open(page);
		const add = '[data-column-id="doing"] .v-kanban__add';
		await page.locator(add).focus();
		expect(await ringSlack(page, add)).toBeGreaterThanOrEqual(0);

		await page.locator(add).click();
		const input = '[data-column-id="doing"] .v-kanban__add-input';
		await expect(page.locator(input)).toBeFocused();
		expect(await ringSlack(page, input)).toBeGreaterThanOrEqual(0);
		for (const selector of [
			'[data-column-id="doing"] .v-kanban__add-submit',
			'[data-column-id="doing"] .v-kanban__add-cancel',
		]) {
			await page.locator(selector).focus();
			expect(await ringSlack(page, selector), selector).toBeGreaterThanOrEqual(0);
		}
	});
});

test.describe("标题内联编辑", () => {
	test("点击标题进入编辑，回车保存；点击不会被当成拖拽", async ({ page }) => {
		await open(page);
		await page.getByRole("button", { name: "Task A", exact: true }).click();
		const input = page.getByRole("textbox", { name: "Card title" });
		await expect(input).toBeFocused();

		await input.fill("Renamed A");
		await input.press("Enter");

		await expect(page.getByRole("button", { name: "Renamed A", exact: true })).toBeVisible();
		expect(await page.evaluate(() => window.__saved)).toEqual([
			{ id: "a", title: "Renamed A" },
		]);
		expect(await page.evaluate(() => window.__moves)).toEqual([]);
	});

	test("在输入框里选中文字时不会拖动卡片；从标题文字上起手仍可以拖动", async ({ page }) => {
		await open(page);
		await page.getByRole("button", { name: "Task A", exact: true }).click();
		const input = page.getByRole("textbox", { name: "Card title" });
		const box = await input.boundingBox();
		if (!box) throw new Error("input not visible");

		await page.mouse.move(box.x + 10, box.y + box.height / 2);
		await page.mouse.down();
		await page.mouse.move(box.x + 100, box.y + box.height / 2 + 120, { steps: 6 });
		await page.mouse.up();

		expect(await page.evaluate(() => window.__moves)).toEqual([]);
		await input.press("Escape");

		const title = page.getByRole("button", { name: "Task B", exact: true });
		const from = await title.boundingBox();
		const target = await column(page, "doing").locator('[data-card-id="d"]').boundingBox();
		if (!from || !target) throw new Error("not visible");
		await page.mouse.move(from.x + 10, from.y + from.height / 2);
		await page.mouse.down();
		await page.mouse.move(target.x + 40, target.y + target.height + 20, { steps: 10 });
		await page.mouse.up();
		await expect.poll(() => page.evaluate(() => window.__moves.length)).toBe(1);
		expect(await page.evaluate(() => window.__moves[0].to.columnId)).toBe("doing");
	});

	test("编辑中的输入框聚焦环不被裁剪", async ({ page }) => {
		await open(page);
		await page.getByRole("button", { name: "Task A", exact: true }).click();

		expect(
			await ringSlack(page, '[data-card-id="a"] .v-kanban__inline-input'),
		).toBeGreaterThanOrEqual(0);
	});
});

test.describe("筛选", () => {
	test("不匹配的卡片淡化并保持原位，计数显示匹配数", async ({ page }) => {
		await open(page, "&filter=1");

		const opacity = (id: string) =>
			page
				.locator(`[data-card-id="${id}"]`)
				.evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity));
		expect(await opacity("a")).toBe(1);
		expect(await opacity("c")).toBeLessThan(0.6);
		expect(
			await page
				.locator('[data-column-id="todo"] [data-card-id]')
				.evaluateAll((items) => items.map((item) => item.getAttribute("data-card-id"))),
		).toEqual(["a", "b", "c"]);
		await expect(column(page, "todo").locator(".v-kanban__count")).toContainText("2/3");
	});

	test("筛选生效时拖不动，并提示原因；清除筛选后可以拖", async ({ page }) => {
		await open(page, "&filter=1");
		await expect(page.locator(".v-kanban__filter-hint")).toBeVisible();
		const from = await page.locator('[data-card-id="a"]').boundingBox();
		const target = await column(page, "doing").locator('[data-card-id="d"]').boundingBox();
		if (!from || !target) throw new Error("not visible");

		await page.mouse.move(from.x + 20, from.y + 10);
		await page.mouse.down();
		await page.mouse.move(target.x + 40, target.y + target.height + 20, { steps: 8 });
		await expect(page.locator(".v-kanban__ghost")).toHaveCount(0);
		await page.mouse.up();
		expect(await page.evaluate(() => window.__moves)).toEqual([]);

		await open(page);
		await expect(page.locator(".v-kanban__filter-hint")).toHaveAttribute("data-empty", "true");
	});
});
