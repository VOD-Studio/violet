import { expect, type Page, test } from "@playwright/test";
import { box, endpoints, near, rightMiddle, sides } from "./lines.ts";

const card = (id: string) => `[data-card-id="${id}"]`;
const canvas = (page: Page) => page.locator(".v-kanban-canvas");
const viewport = (page: Page) => page.locator(".v-kanban-canvas__viewport");
const content = (page: Page) => page.locator(".v-kanban-canvas__content");
const lines = (page: Page) => page.locator(".v-kanban__relation");

/** 内容层当前的 transform：{ x, y, scale }。 */
const shown = (page: Page) =>
	content(page).evaluate((element) => {
		const match = /translate\(([-\d.e]+)px, ([-\d.e]+)px\) scale\(([-\d.e]+)\)/.exec(
			(element as HTMLElement).style.transform,
		);
		if (!match) throw new Error("no transform");
		return { x: Number(match[1]), y: Number(match[2]), scale: Number(match[3]) };
	});

async function open(page: Page, query = "", first = "a") {
	await page.goto(`${process.env.KANBAN_FIXTURE_URL}?view=graph${query}`);
	await expect(page.locator(card(first))).toBeVisible();
	// 适应窗口落定后再动手
	await expect(viewport(page)).toBeVisible();
	await page.evaluate(
		() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
	);
}

/**
 * 四条关系的两端都贴着各自卡片的边缘（线在 SVG 里，经 CTM 换成屏幕坐标，所以含画布的缩放与平移）。
 * 缩放、适应窗口与全屏会触发过渡与重新适应，所以重试到贴合为止。
 */
async function expectAttached(page: Page) {
	await expect(async () => {
		for (const [source, target] of [
			["a", "d"],
			["b", "d"],
			["e", "c"],
			["a", "c"],
		]) {
			const line = await endpoints(page, source, target);
			const expected = sides(await box(page, card(source)), await box(page, card(target)));
			expect(near(line.start, expected.start), `${source}→${target} start`).toBe(true);
			expect(near(line.end, expected.end), `${source}→${target} end`).toBe(true);
		}
	}).toPass({ timeout: 3_000 });
}

test.describe("排布", () => {
	test("列从左到右，列内从上到下，卡片都在自己的分区里", async ({ page }) => {
		await open(page);

		const zones = await Promise.all(
			["todo", "doing", "done"].map((id) => box(page, `[data-column-id="${id}"]`)),
		);
		expect(zones[0].x + zones[0].width).toBeLessThan(zones[1].x);
		expect(zones[1].x + zones[1].width).toBeLessThan(zones[2].x);
		const [a, b, c] = await Promise.all(["a", "b", "c"].map((id) => box(page, card(id))));
		expect(a.y + a.height).toBeLessThan(b.y);
		expect(b.y + b.height).toBeLessThan(c.y);
		for (const [id, zone] of [
			["a", zones[0]],
			["d", zones[1]],
			["e", zones[2]],
		] as const) {
			const rect = await box(page, card(id));
			expect(rect.x).toBeGreaterThanOrEqual(zone.x);
			expect(rect.x + rect.width).toBeLessThanOrEqual(zone.x + zone.width);
		}
	});

	test("关系线贴着卡片：跨列侧边进出，同一列从右缘绕出", async ({ page }) => {
		await open(page);

		await expectAttached(page);
		const same = await endpoints(page, "a", "c");
		expect(near(same.start, rightMiddle(await box(page, card("a"))))).toBe(true);
		expect(near(same.end, rightMiddle(await box(page, card("c"))))).toBe(true);
	});

	test("同一份输入刷新后排布一模一样", async ({ page }) => {
		await open(page, "&many=60", "n0");
		const read = () =>
			page.evaluate(() =>
				[...document.querySelectorAll("[data-card-id]")].map((item) => {
					const rect = item.getBoundingClientRect();
					return [item.getAttribute("data-card-id"), rect.x, rect.y];
				}),
			);
		const first = await read();

		await page.reload();
		await expect(page.locator(card("n0"))).toBeVisible();
		await page.evaluate(
			() =>
				new Promise((resolve) =>
					requestAnimationFrame(() => requestAnimationFrame(resolve)),
				),
		);

		expect(await read()).toEqual(first);
	});

	test("子图：只显示以某张卡片为根的相关卡片，根有标记", async ({ page }) => {
		await open(page, "&root=d&depth=1");

		const ids = await page
			.locator("[data-card-id]")
			.evaluateAll((items) => items.map((item) => item.getAttribute("data-card-id")).sort());
		expect(ids).toEqual(["a", "b", "d"]);
		await expect(lines(page)).toHaveCount(2);
		await expect(page.locator(card("d"))).toHaveAttribute("data-root", "true");
		await expect(page.locator(card("a"))).not.toHaveAttribute("data-root", "true");
	});
});

test.describe("选中", () => {
	test("点击卡片：相关的清晰、其余淡化，再点一次与点空白处取消", async ({ page }) => {
		await open(page);

		await page.locator(card("a")).click();
		await expect(page.locator(card("a"))).toHaveAttribute("data-selected", "true");
		await expect(page.locator(card("d"))).toHaveAttribute("data-related", "true");
		await expect(page.locator(card("b"))).toHaveAttribute("data-faded", "true");
		await expect(page.locator('.v-kanban__relation[data-state="faded"]')).toHaveCount(2);

		await page.locator(card("a")).click();
		await expect(page.locator("[data-selected]")).toHaveCount(0);

		await page.locator(card("a")).click();
		const zone = await box(page, '[data-column-id="doing"]');
		await page.mouse.click(zone.x + zone.width / 2, zone.y + zone.height - 20);
		await expect(page.locator("[data-selected]")).toHaveCount(0);
	});

	test("键盘：卡片可聚焦，Enter 选中，聚焦环完整", async ({ page }) => {
		await open(page);

		await page.locator(card("b")).focus();
		await page.keyboard.press("Enter");
		await expect(page.locator(card("b"))).toHaveAttribute("data-selected", "true");
		await page.keyboard.press("Space");
		await expect(page.locator("[data-selected]")).toHaveCount(0);
	});

	test("卡片里的按钮自己处理点击，不选中", async ({ page }) => {
		await open(page);

		await page.getByRole("button", { name: "Task E" }).click();

		await expect(page.locator("#opened")).toHaveText("opened: e");
		await expect(page.locator("[data-selected]")).toHaveCount(0);
	});
});

test.describe("画布里的平移、缩放与全屏", () => {
	test("拖动只读卡片或背景都平移画布，拖完不当作点击选中；线仍贴着卡片", async ({ page }) => {
		await open(page);
		const before = await shown(page);

		// 卡片下部的空白处：上面那一行是卡片里的按钮，按钮自己处理指针
		const target = await box(page, card("a"));
		await page.mouse.move(target.x + 20, target.y + target.height - 8);
		await page.mouse.down();
		await page.mouse.move(target.x + 60, target.y + target.height + 22, { steps: 5 });
		await page.mouse.up();
		const afterCard = await shown(page);
		expect(Math.round(afterCard.x - before.x)).toBe(40);
		expect(Math.round(afterCard.y - before.y)).toBe(30);
		await expect(page.locator("[data-selected]")).toHaveCount(0);

		const view = await box(page, ".v-kanban-canvas__viewport");
		await page.mouse.move(view.x + view.width / 2, view.y + view.height - 12);
		await page.mouse.down();
		await page.mouse.move(view.x + view.width / 2 - 80, view.y + view.height - 42, {
			steps: 5,
		});
		await page.mouse.up();
		const afterBackground = await shown(page);
		expect(Math.round(afterBackground.x - afterCard.x)).toBe(-80);
		expect(Math.round(afterBackground.y - afterCard.y)).toBe(-30);
		await expectAttached(page);
	});

	test("Ctrl 加滚轮缩放而页面不滚动，普通滚轮滚页面；缩放后线仍贴着卡片", async ({ page }) => {
		await open(page);
		const view = await box(page, ".v-kanban-canvas__viewport");
		await page.mouse.move(view.x + view.width / 2, view.y + view.height / 2);
		const before = await shown(page);
		const width = (await box(page, card("a"))).width;

		await page.mouse.wheel(0, 300);
		await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
		expect(await shown(page)).toEqual(before);
		await page.evaluate(() => window.scrollTo(0, 0));
		await page.mouse.move(view.x + view.width / 2, view.y + view.height / 2);

		await page.keyboard.down("Control");
		await page.mouse.wheel(0, -300);
		await page.keyboard.up("Control");
		await expect.poll(async () => (await shown(page)).scale).toBeGreaterThan(before.scale);
		const zoomed = await shown(page);
		const scaled = (await box(page, card("a"))).width;
		expect(scaled / width).toBeCloseTo(zoomed.scale / before.scale, 2);
		await expectAttached(page);
	});

	test("按钮缩放、适应窗口，读数同步；缩到最小线仍贴着卡片", async ({ page }) => {
		await open(page);

		await page.getByRole("button", { name: "Zoom in" }).click();
		await expect(page.locator(".v-kanban-canvas__zoom")).toHaveText("112%");
		await expectAttached(page);
		await page.getByRole("button", { name: "Fit to window" }).click();
		await expect(page.locator(".v-kanban-canvas__zoom")).toHaveText("90%");
		// 0.9 每次缩小 1.25 倍，第五次到达下限 0.3，之后按钮就禁用了
		for (let step = 0; step < 5; step += 1)
			await page.getByRole("button", { name: "Zoom out" }).click();
		await expect(page.locator(".v-kanban-canvas__zoom")).toHaveText("30%");
		await expectAttached(page);
	});

	test("全屏：铺满窗口，图随之重新适应，Esc 退出；线仍贴着卡片", async ({ page }) => {
		await open(page);

		await page.getByRole("button", { name: "Enter full screen" }).click();
		const size = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
		expect(await canvas(page).boundingBox()).toMatchObject({
			x: 0,
			y: 0,
			width: size.width,
			height: size.height,
		});
		await expectAttached(page);
		await page.locator(card("a")).click();
		await expect(page.locator(card("a"))).toHaveAttribute("data-selected", "true");

		await page.keyboard.press("Escape");

		await expect(canvas(page)).not.toHaveAttribute("data-fullscreen", "true");
		await expectAttached(page);
	});

	test("聚焦视口之外的卡片时画布平移到刚好露出，页面不会跳走", async ({ page }) => {
		await open(page, "&many=120", "n0");
		const view = await box(page, ".v-kanban-canvas__viewport");
		const far = page.locator(card("n119"));
		const farBox = await far.boundingBox();
		expect(farBox && farBox.y + farBox.height > view.y + view.height).toBe(true);
		expect(await page.evaluate(() => window.scrollY)).toBe(0);

		await far.focus();

		await expect
			.poll(async () => {
				const rect = await far.boundingBox();
				if (!rect) return false;
				return (
					rect.x >= view.x &&
					rect.y >= view.y &&
					rect.x + rect.width <= view.x + view.width &&
					rect.y + rect.height <= view.y + view.height
				);
			})
			.toBe(true);
		// 浏览器聚焦时本会按卡片原来的布局位置把整页滚走，而画布已经把它平移到了眼前
		expect(await page.evaluate(() => window.scrollY)).toBe(0);
	});
});

test.describe("卡片很多时", () => {
	test("600 张卡片、900 条线：能打开、平移、缩放、选中，耗时在合理范围", async ({
		page,
	}, info) => {
		const started = Date.now();
		await open(page, "&many=600", "n0");
		const loaded = Date.now() - started;
		await expect(lines(page)).toHaveCount(900);
		await expect(page.locator("[data-card-id]")).toHaveCount(600);

		const view = await box(page, ".v-kanban-canvas__viewport");
		const before = await shown(page);
		const panStart = Date.now();
		await page.mouse.move(view.x + view.width / 2, view.y + view.height - 15);
		await page.mouse.down();
		await page.mouse.move(view.x + view.width / 2 - 200, view.y + view.height - 60, {
			steps: 30,
		});
		await page.mouse.up();
		const panned = Date.now() - panStart;
		expect(Math.round((await shown(page)).x - before.x)).toBe(-200);

		await page.getByRole("button", { name: "Zoom out" }).click();
		await expect.poll(async () => (await shown(page)).scale).toBeLessThan(before.scale);

		await page.getByRole("button", { name: "Fit to window" }).click();
		// 适应窗口后左上角那列最上面的卡片在视口里
		const top = page.locator('[data-column-id="c0"] [data-card-id]').first();
		const selectStart = Date.now();
		await top.click();
		await expect(top).toHaveAttribute("data-selected", "true");
		const selected = Date.now() - selectStart;

		info.annotations.push({
			type: "timing",
			description: `load ${loaded}ms, pan ${panned}ms, select ${selected}ms`,
		});
		expect(loaded).toBeLessThan(10_000);
		expect(panned).toBeLessThan(5_000);
		expect(selected).toBeLessThan(3_000);
	});
});
