import { expect, type Page, test } from "@playwright/test";

interface Point {
	x: number;
	y: number;
}

async function open(page: Page, query = "") {
	// 统计位置过渡用到的 Web Animations 调用，区分正常动态与减弱动态
	await page.addInitScript(() => {
		window.__animateCalls = 0;
		const animate = Element.prototype.animate;
		Element.prototype.animate = function (...args: Parameters<Element["animate"]>) {
			window.__animateCalls += 1;
			return animate.apply(this, args);
		};
	});
	await page.goto(`${process.env.KANBAN_FIXTURE_URL}${query}`);
	await expect(page.locator('[data-card-id="a"]')).toBeVisible();
}

async function center(page: Page, selector: string): Promise<Point> {
	const box = await page.locator(selector).boundingBox();
	if (!box) throw new Error(`${selector} is not visible`);
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
const cardCenter = (page: Page, id: string) => center(page, `[data-card-id="${id}"]`);

/** 列内最后一张卡片下方 20px：落在该列末尾。 */
async function belowLastCard(page: Page, column: string): Promise<Point> {
	const cards = page.locator(`[data-column-id="${column}"] [data-card-id]:visible`);
	const box = await cards.last().boundingBox();
	if (!box) throw new Error(`${column} has no cards`);
	return { x: box.x + box.width / 2, y: box.y + box.height + 20 };
}

/** 浮起卡片落位、其余卡片让位的过渡都结束后，卡片位置才稳定，才能再次抓取。 */
async function settled(page: Page) {
	await expect(page.locator(".v-kanban__ghost")).toHaveCount(0);
	await page.evaluate(() =>
		Promise.all(document.getAnimations().map((animation) => animation.finished)),
	);
}

const idsIn = (page: Page, column: string) =>
	page
		.locator(`[data-column-id="${column}"] [data-card-id]:not([data-origin])`)
		.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-card-id")));

async function pickUp(page: Page, id: string, to: Point) {
	const from = await cardCenter(page, id);
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await page.mouse.move(from.x + 12, from.y, { steps: 2 });
	await page.mouse.move(to.x, to.y, { steps: 10 });
	return from;
}

test.describe("指针拖拽", () => {
	test("跨列拖动：占位、跟随指针的浮起卡片，松开后提交并落位", async ({ page }) => {
		await open(page);
		const target = await belowLastCard(page, "doing");

		await pickUp(page, "a", target);

		const ghost = page.locator(".v-kanban__ghost");
		await expect(ghost).toBeVisible();
		const box = await ghost.boundingBox();
		expect(Math.abs((box?.x ?? 0) + (box?.width ?? 0) / 2 - target.x)).toBeLessThan(2);
		expect(Math.abs((box?.y ?? 0) + (box?.height ?? 0) / 2 - target.y)).toBeLessThan(2);
		const placeholder = page.locator("[data-placeholder]");
		await expect(placeholder).toHaveCount(1);
		expect(await placeholder.evaluate((el) => getComputedStyle(el).borderStyle)).toBe("dashed");
		expect(await idsIn(page, "todo")).toEqual(["b", "c"]);

		await page.mouse.up();

		await expect(ghost).toHaveCount(0);
		await expect.poll(() => page.evaluate(() => window.__moves.length)).toBe(1);
		const move = await page.evaluate(() => window.__moves[0]);
		expect(move).toEqual({
			cardId: "a",
			from: { columnId: "todo", index: 0 },
			to: { columnId: "doing", index: 1 },
			previousId: "d",
			nextId: null,
		});
		expect(await idsIn(page, "doing")).toEqual(["d", "a"]);
		await expect(page.locator('[data-card-id="a"]')).toBeVisible();
	});

	test("同列重排", async ({ page }) => {
		await open(page);
		const target = await belowLastCard(page, "todo");

		await pickUp(page, "a", target);
		await page.mouse.up();

		await expect.poll(() => idsIn(page, "todo")).toEqual(["b", "c", "a"]);
	});

	test("按 Esc 取消，卡片回到原位且不提交", async ({ page }) => {
		await open(page);
		await pickUp(page, "a", await belowLastCard(page, "doing"));

		await page.keyboard.press("Escape");

		await expect(page.locator(".v-kanban__ghost")).toHaveCount(0);
		await page.mouse.up();
		expect(await idsIn(page, "todo")).toEqual(["a", "b", "c"]);
		expect(await page.evaluate(() => window.__moves.length)).toBe(0);
	});

	test("拖出看板后松开不提交", async ({ page }) => {
		await open(page);
		await pickUp(page, "a", { x: 1150, y: 650 });

		await page.mouse.up();

		await expect(page.locator(".v-kanban__ghost")).toHaveCount(0);
		expect(await idsIn(page, "todo")).toEqual(["a", "b", "c"]);
		expect(await page.evaluate(() => window.__moves.length)).toBe(0);
	});

	test("拖拽结束后的点击被抑制，普通点击不受影响", async ({ page }) => {
		await open(page);

		await pickUp(page, "a", await belowLastCard(page, "doing"));
		await page.mouse.up();
		await expect(page.locator("#clicks")).toHaveText("clicks: 0");
		await settled(page);

		const b = await cardCenter(page, "b");
		await page.mouse.click(b.x, b.y);
		await expect(page.locator("#clicks")).toHaveText("clicks: 1");
	});

	test("Esc 取消后在原卡片上松开鼠标，不会触发它的点击", async ({ page }) => {
		await open(page);

		const origin = await pickUp(page, "a", await belowLastCard(page, "doing"));
		await page.keyboard.press("Escape");
		await settled(page);
		await page.mouse.move(origin.x, origin.y);
		await page.mouse.up();

		await expect(page.locator("#clicks")).toHaveText("clicks: 0");
	});

	test("移动不超过 4px 仍是点击，不会拖起卡片", async ({ page }) => {
		await open(page);
		const b = await cardCenter(page, "b");

		await page.mouse.move(b.x, b.y);
		await page.mouse.down();
		await page.mouse.move(b.x + 3, b.y + 2);
		await page.mouse.up();

		await expect(page.locator("#clicks")).toHaveText("clicks: 1");
		await expect(page.locator("[data-placeholder]")).toHaveCount(0);
	});
});

test.describe("自动排序列", () => {
	test("别的列的卡片进入时落在入口一端，列内手动重排被拒绝并提示", async ({ page }) => {
		await open(page);

		// 进入：不管指针落在哪个高度，都在最上面
		await pickUp(page, "c", await belowLastCard(page, "done"));
		await page.mouse.up();
		await expect.poll(() => idsIn(page, "done")).toEqual(["c", "e"]);
		await settled(page);
		const entered = await page.evaluate(() => window.__moves[0]);
		expect(entered).toMatchObject({ to: { columnId: "done", index: 0 }, nextId: "e" });

		// 列内重排：占位标记不可放置，松开后回到原位并说明原因
		const topOfDone = await cardCenter(page, "c");
		await pickUp(page, "e", { x: topOfDone.x, y: topOfDone.y - 10 });
		await expect(page.locator("[data-placeholder]")).toHaveAttribute("data-invalid", "true");
		await page.mouse.up();

		await expect(page.locator(".v-kanban__notice")).toHaveText(/sorted automatically/);
		await expect.poll(() => idsIn(page, "done")).toEqual(["c", "e"]);
		expect(await page.evaluate(() => window.__moves.length)).toBe(1);
	});
});

test.describe("保存失败", () => {
	test("onMove 失败后卡片回到原位并提示", async ({ page }) => {
		await open(page, "?fail=1");

		await pickUp(page, "a", await belowLastCard(page, "doing"));
		await page.mouse.up();

		await expect(page.locator(".v-kanban__notice")).toHaveText(/couldn't be saved/);
		await expect.poll(() => idsIn(page, "todo")).toEqual(["a", "b", "c"]);
		expect(await idsIn(page, "doing")).toEqual(["d"]);
		await expect(page.locator('[data-card-id="a"]')).toBeVisible();
	});
});

test.describe("动态偏好", () => {
	test("正常动态下卡片让位与落位用位移过渡", async ({ page }) => {
		await open(page);

		await pickUp(page, "a", await belowLastCard(page, "doing"));
		await page.mouse.up();
		await expect(page.locator(".v-kanban__ghost")).toHaveCount(0);

		expect(await page.evaluate(() => window.__animateCalls)).toBeGreaterThan(0);
	});

	test("偏好减弱动态时不做任何位移过渡，浮起卡片立即落位", async ({ page }) => {
		await page.emulateMedia({ reducedMotion: "reduce" });
		await open(page);

		await pickUp(page, "a", await belowLastCard(page, "doing"));
		await page.mouse.up();

		await expect(page.locator(".v-kanban__ghost")).toHaveCount(0);
		await expect.poll(() => idsIn(page, "doing")).toEqual(["d", "a"]);
		expect(await page.evaluate(() => window.__animateCalls)).toBe(0);
	});
});

test.describe("触屏（模拟）", () => {
	test.use({ hasTouch: true });

	test("长按后拖动并放下；长按之前的移动是滚动，不拖起卡片", async ({ page, context }) => {
		await open(page);
		const cdp = await context.newCDPSession(page);
		const touch = (type: "touchStart" | "touchMove" | "touchEnd", point?: Point) =>
			cdp.send("Input.dispatchTouchEvent", {
				type,
				touchPoints: point ? [{ x: point.x, y: point.y }] : [],
			});

		// 先试一次「还没长按就移动」：视为滚动
		const b = await cardCenter(page, "b");
		await touch("touchStart", b);
		await touch("touchMove", { x: b.x, y: b.y + 40 });
		await page.waitForTimeout(350);
		await touch("touchEnd");
		await expect(page.locator("[data-placeholder]")).toHaveCount(0);

		// 再长按：不动手指满 250ms 后拖起
		const a = await cardCenter(page, "a");
		const target = await belowLastCard(page, "doing");
		await touch("touchStart", a);
		await page.waitForTimeout(350);
		await expect(page.locator(".v-kanban__ghost")).toBeVisible();
		for (let step = 1; step <= 8; step += 1)
			await touch("touchMove", {
				x: a.x + ((target.x - a.x) * step) / 8,
				y: a.y + ((target.y - a.y) * step) / 8,
			});
		await touch("touchEnd");

		await expect.poll(() => idsIn(page, "doing")).toEqual(["d", "a"]);
		expect(await page.evaluate(() => window.__moves.length)).toBe(1);
	});
});

test.describe("键盘", () => {
	const announcement = (page: Page) => page.locator(".v-kanban__announcer");
	const focusedCard = (page: Page) =>
		page.evaluate(() => document.activeElement?.getAttribute("data-card-id") ?? null);

	test("Tab 聚焦卡片，空格拿起、方向键移动、空格放下，全程有播报且焦点不丢", async ({ page }) => {
		await open(page);

		await page.keyboard.press("Tab");
		expect(await focusedCard(page)).toBe("a");
		await expect(page.locator('[data-card-id="a"]')).toHaveCSS("outline-style", "solid");

		await page.keyboard.press(" ");
		await expect(announcement(page)).toHaveText(
			/^Picked up Task A\. Planned, position 1 of 3\./,
		);
		await page.keyboard.press("ArrowRight");
		await expect(announcement(page)).toHaveText("In progress, position 1 of 2.");
		await page.keyboard.press("ArrowDown");
		await expect(announcement(page)).toHaveText("In progress, position 2 of 2.");
		expect(await focusedCard(page)).toBe("a");
		expect(await page.evaluate(() => window.__moves.length)).toBe(0);

		await page.keyboard.press(" ");

		await expect(announcement(page)).toHaveText(
			"Dropped Task A. In progress, position 2 of 2.",
		);
		expect(await focusedCard(page)).toBe("a");
		await expect.poll(() => idsIn(page, "doing")).toEqual(["d", "a"]);
		const move = await page.evaluate(() => window.__moves[0]);
		expect(move).toMatchObject({
			cardId: "a",
			to: { columnId: "doing", index: 1 },
			previousId: "d",
		});
	});

	test("拿起期间方向键、空格、Enter 与 Esc 不会传给页面级快捷键；放下后恢复", async ({
		page,
	}) => {
		await open(page);
		await page.keyboard.press("Tab");

		await page.keyboard.press(" ");
		for (const key of ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"])
			await page.keyboard.press(key);
		await page.keyboard.press("Escape");
		expect(await page.evaluate(() => window.__pageKeys)).toEqual(["Tab"]);

		await page.keyboard.press("ArrowDown");
		expect(await page.evaluate(() => window.__pageKeys)).toEqual(["Tab", "ArrowDown"]);
	});

	test("Esc 取消：恢复原位，不提交", async ({ page }) => {
		await open(page);
		await page.keyboard.press("Tab");

		await page.keyboard.press(" ");
		await page.keyboard.press("ArrowRight");
		await page.keyboard.press("Escape");

		await expect(announcement(page)).toHaveText(
			"Move cancelled. Task A is back in Planned, position 1 of 3.",
		);
		expect(await idsIn(page, "todo")).toEqual(["a", "b", "c"]);
		expect(await page.evaluate(() => window.__moves.length)).toBe(0);
		expect(await focusedCard(page)).toBe("a");
	});

	test("自动排序列：进入落在入口一端，列内上下被拒绝并提示原因", async ({ page }) => {
		await open(page);
		await page.keyboard.press("Tab");

		await page.keyboard.press(" ");
		await page.keyboard.press("ArrowRight");
		await page.keyboard.press("ArrowRight");
		await expect(announcement(page)).toHaveText("Done, position 1 of 2.");
		await page.keyboard.press("ArrowDown");

		await expect(page.locator(".v-kanban__notice")).toHaveText(/sorted automatically/);
		expect(await idsIn(page, "done")).toEqual(["a", "e"]);
	});
});
