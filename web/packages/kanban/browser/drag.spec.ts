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
			fromPreviousId: null,
			fromNextId: "b",
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

test.describe("键盘与「移到…」菜单", () => {
	const announcement = (page: Page) => page.locator(".v-kanban__announcer");
	const focusedCard = (page: Page) =>
		page.evaluate(() => document.activeElement?.getAttribute("data-card-id") ?? null);

	/** 页面上看板前面有输入框：从它出发按一次 Tab 到达第一张卡片。 */
	async function tabToFirstCard(page: Page) {
		await page.locator("#note").focus();
		await page.keyboard.press("Tab");
	}

	test("Tab 聚焦卡片，空格拿起、方向键移动、空格放下，全程有播报且焦点不丢", async ({ page }) => {
		await open(page);

		await tabToFirstCard(page);
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
		await tabToFirstCard(page);

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
		await tabToFirstCard(page);

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
		await tabToFirstCard(page);

		await page.keyboard.press(" ");
		await page.keyboard.press("ArrowRight");
		await page.keyboard.press("ArrowRight");
		await expect(announcement(page)).toHaveText("Done, position 1 of 2.");
		await page.keyboard.press("ArrowDown");

		await expect(page.locator(".v-kanban__notice")).toHaveText(/sorted automatically/);
		expect(await idsIn(page, "done")).toEqual(["a", "e"]);
	});

	test("「移到…」菜单悬停或聚焦时出现，选择目标列即提交并播报", async ({ page }) => {
		await open(page);
		const tools = page.locator('[data-card-id="a"] .v-kanban__card-tools');
		await expect(tools).toHaveCSS("opacity", "0");

		await page.locator('[data-card-id="a"]').hover();
		await expect(tools).toHaveCSS("opacity", "1");
		await page.locator('[data-card-id="a"] [aria-haspopup="menu"]').click();
		await page.getByRole("menuitem", { name: "In progress" }).click();

		await expect(announcement(page)).toHaveText(
			"Moved Task A to In progress, position 2 of 2.",
		);
		await expect.poll(() => idsIn(page, "doing")).toEqual(["d", "a"]);
		expect(await page.evaluate(() => window.__moves.length)).toBe(1);
		expect(await focusedCard(page)).toBe("a");
	});

	test("只用键盘：Tab 到菜单按钮，方向键只在菜单项间移动，Enter 才选中", async ({ page }) => {
		await open(page);
		await tabToFirstCard(page); // 卡片 a
		await page.keyboard.press("Tab"); // 卡片里使用方渲染的按钮
		await page.keyboard.press("Tab"); // 菜单按钮
		await expect(page.locator('[data-card-id="a"] .v-kanban__card-tools')).toHaveCSS(
			"opacity",
			"1",
		);

		await page.keyboard.press("ArrowDown");
		await expect(page.getByRole("menu")).toBeVisible();
		await expect(page.getByRole("menuitem", { name: "In progress" })).toBeFocused();
		await page.keyboard.press("ArrowDown");
		await expect(page.getByRole("menuitem", { name: "Done" })).toBeFocused();
		expect(await page.evaluate(() => window.__moves.length)).toBe(0);

		await page.keyboard.press("Enter");

		await expect.poll(() => idsIn(page, "done")).toEqual(["a", "e"]);
		await expect(page.getByRole("menu")).toHaveCount(0);
		expect(await focusedCard(page)).toBe("a");
	});

	test("菜单不被滚动层裁剪，Esc 关闭并把焦点还给按钮", async ({ page }) => {
		await open(page);
		await page.locator('[data-card-id="c"]').hover();
		const trigger = page.locator('[data-card-id="c"] [aria-haspopup="menu"]');
		await trigger.click();

		const menu = page.getByRole("menu");
		await expect(menu).toBeVisible();
		const box = await menu.boundingBox();
		expect(box && box.width > 0 && box.height > 0).toBe(true);
		expect(await menu.evaluate((element) => getComputedStyle(element).position)).toBe("fixed");

		await page.keyboard.press("Escape");

		await expect(menu).toHaveCount(0);
		await expect(trigger).toBeFocused();
	});

	test("菜单按钮上按下鼠标移动不会拖起卡片", async ({ page }) => {
		await open(page);
		await page.locator('[data-card-id="a"]').hover();
		const box = await page.locator('[data-card-id="a"] [aria-haspopup="menu"]').boundingBox();
		if (!box) throw new Error("menu trigger not visible");

		await page.mouse.move(box.x + 5, box.y + 5);
		await page.mouse.down();
		await page.mouse.move(box.x + 80, box.y + 90, { steps: 4 });

		await expect(page.locator("[data-placeholder]")).toHaveCount(0);
		await page.mouse.up();
	});

	test("触屏（无悬停）设备上菜单按钮常显", async ({ browser }) => {
		const context = await browser.newContext({
			hasTouch: true,
			isMobile: true,
			viewport: { width: 1200, height: 700 },
		});
		const page = await context.newPage();
		await open(page);

		await expect(page.locator('[data-card-id="a"] .v-kanban__card-tools')).toHaveCSS(
			"opacity",
			"1",
		);
		await context.close();
	});
});

test.describe("撤销与重做", () => {
	const undo = (page: Page) => page.getByRole("button", { name: /^Undo/ });
	const redo = (page: Page) => page.getByRole("button", { name: /^Redo/ });

	async function moveAToDoing(page: Page) {
		await pickUp(page, "a", await belowLastCard(page, "doing"));
		await page.mouse.up();
		await expect.poll(() => idsIn(page, "doing")).toEqual(["d", "a"]);
		await settled(page);
	}

	test("按钮随历史启用，撤销与重做把卡片放回去又移过来", async ({ page }) => {
		await open(page);
		await expect(undo(page)).toBeDisabled();
		await expect(redo(page)).toBeDisabled();

		await moveAToDoing(page);
		await expect(undo(page)).toBeEnabled();
		await expect(undo(page)).toHaveAttribute("title", "Undo move A");

		await undo(page).click();
		await expect.poll(() => idsIn(page, "todo")).toEqual(["a", "b", "c"]);
		await expect(page.locator(".v-kanban-history__announcer")).toHaveText("Undone: move A.");
		await expect(redo(page)).toBeEnabled();
		await expect(undo(page)).toBeDisabled();

		await redo(page).click();
		await expect.poll(() => idsIn(page, "doing")).toEqual(["d", "a"]);
	});

	test("撤销完最后一步后焦点仍留在撤销按钮上", async ({ page }) => {
		await open(page);
		await moveAToDoing(page);

		await undo(page).focus();
		await page.keyboard.press("Enter");

		await expect.poll(() => idsIn(page, "todo")).toEqual(["a", "b", "c"]);
		await expect(undo(page)).toBeDisabled();
		await expect(undo(page)).toBeFocused();
	});

	test("Ctrl+Z 撤销、Ctrl+Shift+Z 重做", async ({ page }) => {
		await open(page);
		await moveAToDoing(page);

		await page.keyboard.press("Control+z");
		await expect.poll(() => idsIn(page, "todo")).toEqual(["a", "b", "c"]);
		await page.keyboard.press("Control+Shift+Z");
		await expect.poll(() => idsIn(page, "doing")).toEqual(["d", "a"]);
	});

	test("焦点在输入框里时 Ctrl+Z 留给输入框自己，不撤销看板", async ({ page }) => {
		await open(page);
		await moveAToDoing(page);
		const note = page.locator("#note");
		await note.click();
		await note.pressSequentially("X");
		await expect(note).toHaveValue("noteX");

		await page.keyboard.press("Control+z");
		await page.evaluate(
			() =>
				new Promise((resolve) =>
					requestAnimationFrame(() => requestAnimationFrame(resolve)),
				),
		);

		// 看板的历史没有被消耗：卡片还在，撤销按钮仍可用
		expect(await idsIn(page, "doing")).toEqual(["d", "a"]);
		await expect(undo(page)).toBeEnabled();
	});
});

test.describe("画布视口", () => {
	const root = (page: Page) => page.locator(".v-kanban-canvas");
	const viewportEl = (page: Page) => page.locator(".v-kanban-canvas__viewport");
	const content = (page: Page) => page.locator(".v-kanban-canvas__content");
	/** 内容层当前的 transform：{ x, y, scale }。 */
	const shownTransform = async (page: Page) =>
		content(page).evaluate((element) => {
			const match = /translate\(([-\d.e]+)px, ([-\d.e]+)px\) scale\(([-\d.e]+)\)/.exec(
				(element as HTMLElement).style.transform,
			);
			if (!match) throw new Error("no transform");
			return { x: Number(match[1]), y: Number(match[2]), scale: Number(match[3]) };
		});

	// 画布页没有卡片 a，open() 的等待条件不适用
	async function openCanvas(page: Page) {
		await page.addInitScript(() => {
			window.__animateCalls = 0;
		});
		await page.goto(`${process.env.KANBAN_FIXTURE_URL}?view=canvas`);
		await expect(viewportEl(page)).toBeVisible();
	}

	test("挂载后适应窗口：内容远大于窗口时缩放停在 0.8，从左上角开始", async ({ page }) => {
		await openCanvas(page);

		const shown = await shownTransform(page);
		expect(shown.scale).toBe(0.8);
		expect(shown.x).toBe(24);
	});

	test("普通滚轮滚动页面而不被画布劫持；Ctrl 加滚轮缩放画布而页面不滚动", async ({ page }) => {
		await openCanvas(page);
		const box = await viewportEl(page).boundingBox();
		if (!box) throw new Error("viewport not visible");
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		const before = await shownTransform(page);

		await page.mouse.wheel(0, 300);
		await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
		expect(await shownTransform(page)).toEqual(before);

		// 滚回顶部，让画布重新回到鼠标下面
		await page.evaluate(() => window.scrollTo(0, 0));
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		const scrolled = await page.evaluate(() => window.scrollY);
		await page.keyboard.down("Control");
		await page.mouse.wheel(0, -300);
		await page.keyboard.up("Control");
		await expect
			.poll(async () => (await shownTransform(page)).scale)
			.toBeGreaterThan(before.scale);
		expect(await page.evaluate(() => window.scrollY)).toBe(scrolled);
		expect(await page.evaluate(() => window.visualViewport?.scale)).toBe(1);
	});

	test("按钮缩放与适应窗口，读数同步", async ({ page }) => {
		await openCanvas(page);

		await page.getByRole("button", { name: "Zoom in" }).click();
		await expect(page.locator(".v-kanban-canvas__zoom")).toHaveText("100%");
		await page.getByRole("button", { name: "Zoom in" }).click();
		await expect(page.locator(".v-kanban-canvas__zoom")).toHaveText("125%");
		await page.getByRole("button", { name: "Fit to window" }).click();
		await expect(page.locator(".v-kanban-canvas__zoom")).toHaveText("80%");
		await expect(page.locator(".v-kanban-canvas__status")).toHaveText("Zoom 80%");
	});

	test("拖动背景平移，拖动卡片不平移", async ({ page }) => {
		await openCanvas(page);
		const before = await shownTransform(page);
		const box = await viewportEl(page).boundingBox();
		if (!box) throw new Error("viewport not visible");
		// 视口底部没有内容的空白处
		const start = { x: box.x + box.width / 2, y: box.y + box.height - 20 };

		await page.mouse.move(start.x, start.y);
		await page.mouse.down();
		await page.mouse.move(start.x - 120, start.y - 40, { steps: 6 });
		await expect(viewportEl(page)).toHaveAttribute("data-panning", "true");
		await page.mouse.up();

		const after = await shownTransform(page);
		expect(Math.round(after.x - before.x)).toBe(-120);
		expect(Math.round(after.y - before.y)).toBe(-40);

		const card = page.locator('[data-card-id="a"]');
		const cardBox = await card.boundingBox();
		if (!cardBox) throw new Error("card not visible");
		await page.mouse.move(cardBox.x + 20, cardBox.y + 10);
		await page.mouse.down();
		await page.mouse.move(cardBox.x + 100, cardBox.y + 60, { steps: 4 });
		await page.mouse.up();
		expect(await shownTransform(page)).toEqual(after);
	});

	test("全屏：铺满窗口并锁住页面滚动，Esc 退出", async ({ page }) => {
		await openCanvas(page);

		await page.getByRole("button", { name: "Enter full screen" }).click();
		const size = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
		const full = await root(page).boundingBox();
		expect(full).toMatchObject({ x: 0, y: 0, width: size.width, height: size.height });
		expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
		await expect(page.locator(".v-kanban-canvas__status")).toHaveText(/Escape/);

		await page.keyboard.press("Escape");

		await expect(root(page)).not.toHaveAttribute("data-fullscreen", "true");
		const restored = await root(page).boundingBox();
		expect(restored?.height).toBeLessThan(size.height);
		expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
	});

	test("键盘：视口聚焦后方向键平移、+ 与 - 缩放、0 适应窗口", async ({ page }) => {
		await openCanvas(page);
		await viewportEl(page).focus();
		const start = await shownTransform(page);

		await page.keyboard.press("ArrowRight");
		expect((await shownTransform(page)).x).toBe(start.x - 48);
		await page.keyboard.press("Shift+ArrowDown");
		expect((await shownTransform(page)).y).toBe(start.y - 192);
		await page.keyboard.press("+");
		await expect.poll(async () => (await shownTransform(page)).scale).toBeCloseTo(1, 5);
		await page.keyboard.press("0");
		await expect.poll(async () => (await shownTransform(page)).scale).toBeCloseTo(0.8, 5);
	});

	/** 元素相对视口的位置是否完整落在视口内，四周至少留 8px。 */
	const isRevealed = async (page: Page, selector: string) => {
		const viewportBox = await viewportEl(page).boundingBox();
		const box = await page.locator(selector).boundingBox();
		if (!viewportBox || !box) throw new Error("not visible");
		return (
			box.x >= viewportBox.x + 8 - 1 &&
			box.y >= viewportBox.y + 8 - 1 &&
			box.x + box.width <= viewportBox.x + viewportBox.width - 8 + 1 &&
			box.y + box.height <= viewportBox.y + viewportBox.height - 8 + 1
		);
	};
	const insideViewport = async (page: Page, selector: string) => {
		const viewportBox = await viewportEl(page).boundingBox();
		const box = await page.locator(selector).boundingBox();
		if (!viewportBox || !box) throw new Error("not visible");
		return (
			box.x >= viewportBox.x &&
			box.y >= viewportBox.y &&
			box.x + box.width <= viewportBox.x + viewportBox.width &&
			box.y + box.height <= viewportBox.y + viewportBox.height
		);
	};
	/** 过渡与动画都结束。 */
	const settled = (page: Page) =>
		page.waitForFunction(() => document.getAnimations().length === 0);
	const nativeScroll = (page: Page) =>
		viewportEl(page).evaluate((element) => [element.scrollLeft, element.scrollTop]);

	test("聚焦到视口之外的卡片（右侧与底部）时画布平移到刚好露出，聚焦环不被裁剪，视口自己不滚动", async ({
		page,
	}) => {
		await openCanvas(page);
		for (const id of ["f", "l10"]) {
			expect(await insideViewport(page, `[data-card-id="${id}"] button`)).toBe(false);
			await page.evaluate(
				(cardId) =>
					document
						.querySelector<HTMLElement>(`[data-card-id="${cardId}"] button`)
						?.focus(),
				id,
			);
			await settled(page);

			expect(await isRevealed(page, `[data-card-id="${id}"] button`)).toBe(true);
			expect(await nativeScroll(page)).toEqual([0, 0]);
		}

		await page.getByRole("button", { name: "Fit to window" }).click();
		await settled(page);
		expect(await insideViewport(page, '[data-card-id="a"] button')).toBe(true);
	});

	test("缩放过渡进行中聚焦视口外的卡片，最终也刚好露出", async ({ page }) => {
		await openCanvas(page);
		expect(await insideViewport(page, '[data-card-id="f"] button')).toBe(false);

		await page.getByRole("button", { name: "Zoom in" }).click();
		await page.evaluate(() =>
			document.querySelector<HTMLElement>('[data-card-id="f"] button')?.focus(),
		);
		await settled(page);

		expect(await isRevealed(page, '[data-card-id="f"] button')).toBe(true);
	});

	test("全屏时 Tab 不会跑到被遮住的页面内容里", async ({ page }) => {
		await openCanvas(page);
		await page.getByRole("button", { name: "Enter full screen" }).click();

		const visited = new Set<string>();
		for (let index = 0; index < 20; index += 1) {
			await page.keyboard.press("Tab");
			visited.add(
				await page.evaluate(() => {
					const active = document.activeElement;
					if (!active || active === document.body) return "body";
					return active.closest(".v-kanban-canvas") ? "canvas" : (active.id ?? "other");
				}),
			);
		}

		expect([...visited].filter((place) => place !== "canvas" && place !== "body")).toEqual([]);

		await page.keyboard.press("Escape");
		await page.locator("#outside-before").focus();
		await expect(page.locator("#outside-before")).toBeFocused();
	});

	test("按钮缩放用过渡，偏好减弱动态时不用", async ({ page }) => {
		await openCanvas(page);
		await page.getByRole("button", { name: "Zoom in" }).click();
		const normal = await content(page).evaluate(
			(element) => getComputedStyle(element).transitionDuration,
		);
		expect(normal).toBe("0.2s");

		await page.emulateMedia({ reducedMotion: "reduce" });
		const reduced = await content(page).evaluate(
			(element) => getComputedStyle(element).transitionDuration,
		);
		expect(reduced).toBe("0s");
	});
});

test.describe("画布视口（触屏模拟）", () => {
	test.use({ hasTouch: true });

	test("双指拉开放大画布", async ({ page, context }) => {
		await page.goto(`${process.env.KANBAN_FIXTURE_URL}?view=canvas`);
		const viewport = page.locator(".v-kanban-canvas__viewport");
		await expect(viewport).toBeVisible();
		const box = await viewport.boundingBox();
		if (!box) throw new Error("viewport not visible");
		const cdp = await context.newCDPSession(page);
		const center = { x: box.x + box.width / 2, y: box.y + box.height - 40 };
		const touches = (gap: number) => [
			{ x: center.x - gap, y: center.y },
			{ x: center.x + gap, y: center.y },
		];
		const scaleOf = () =>
			page.locator(".v-kanban-canvas__content").evaluate((element) => {
				const match = /scale\(([-\d.e]+)\)/.exec((element as HTMLElement).style.transform);
				return Number(match?.[1]);
			});
		const before = await scaleOf();

		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchStart",
			touchPoints: touches(40),
		});
		for (let gap = 50; gap <= 140; gap += 15)
			await cdp.send("Input.dispatchTouchEvent", {
				type: "touchMove",
				touchPoints: touches(gap),
			});
		await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

		expect(await scaleOf()).toBeGreaterThan(before);
	});

	test("单指从卡片上起手也能平移画布", async ({ page, context }) => {
		await page.goto(`${process.env.KANBAN_FIXTURE_URL}?view=canvas`);
		const card = page.locator('[data-card-id="a"]');
		await expect(card).toBeVisible();
		const box = await card.boundingBox();
		if (!box) throw new Error("card not visible");
		const transformX = () =>
			page.locator(".v-kanban-canvas__content").evaluate((element) => {
				const match = /translate\(([-\d.e]+)px/.exec(
					(element as HTMLElement).style.transform,
				);
				return Number(match?.[1]);
			});
		const before = await transformX();
		const cdp = await context.newCDPSession(page);
		const start = { x: box.x + 20, y: box.y + 10 };

		await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
		for (let step = 1; step <= 6; step += 1)
			await cdp.send("Input.dispatchTouchEvent", {
				type: "touchMove",
				touchPoints: [{ x: start.x - step * 20, y: start.y }],
			});
		await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

		expect(Math.round(before - (await transformX()))).toBe(120);
	});
});
