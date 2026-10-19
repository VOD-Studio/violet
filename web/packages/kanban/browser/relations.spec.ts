import { expect, type Page, test } from "@playwright/test";
import { box, endpoints, leftMiddle, near, rightMiddle, sides } from "./lines.ts";

async function open(page: Page, query = "") {
	await page.goto(`${process.env.KANBAN_FIXTURE_URL}?view=relations${query}`);
	await expect(page.locator('[data-card-id="a"]')).toBeVisible();
	await expect(page.locator(".v-kanban__relation")).toHaveCount(4);
}

const card = (id: string) => `[data-card-id="${id}"]`;
const settled = async (page: Page) => {
	await expect(page.locator(".v-kanban__ghost")).toHaveCount(0);
	await page.evaluate(() =>
		Promise.all(document.getAnimations().map((animation) => animation.finished)),
	);
	// 线在动画结束后的下一帧才量到最终位置
	await page.evaluate(
		() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
	);
};

/** 检查全部线的两端都贴着各自卡片的边缘。 */
async function expectAttached(page: Page) {
	for (const [source, target] of [
		["a", "d"],
		["b", "d"],
		["e", "c"],
		["a", "c"],
	]) {
		const line = await endpoints(page, source, target);
		const from = await box(page, card(source));
		const to = await box(page, card(target));
		const expected = sides(from, to);
		expect(
			near(line.start, expected.start),
			`${source}→${target} start ${JSON.stringify(line.start)} vs ${JSON.stringify(expected.start)}`,
		).toBe(true);
		expect(
			near(line.end, expected.end),
			`${source}→${target} end ${JSON.stringify(line.end)} vs ${JSON.stringify(expected.end)}`,
		).toBe(true);
	}
}

/** 箭头覆盖区内线身沿箭头轴线进入，不能从侧翼斜穿；挡条也应被水平接入。 */
async function expectTerminalAlignment(page: Page) {
	const terminals = await page.locator(".v-kanban__relation").evaluateAll((groups) =>
		groups.map((group) => {
			const line = group.querySelector(".v-kanban__relation-line") as SVGPathElement;
			const head = group.querySelector(".v-kanban__relation-head") as SVGPathElement | null;
			const length = line.getTotalLength();
			const end = line.getPointAtLength(length);
			const samples = [1, 3, 5, 7].map((distance) => {
				const point = line.getPointAtLength(length - distance);
				return {
					horizontal: Math.abs(point.y - end.y) < 0.05,
					insideHead: head === null || head.isPointInFill(point),
				};
			});
			const target = document.querySelector(
				`[data-card-id="${group.getAttribute("data-target")}"]`,
			) as HTMLElement;
			const box = target.getBoundingClientRect();
			const tip = new DOMPoint(end.x, end.y).matrixTransform(
				line.getScreenCTM() as DOMMatrix,
			);
			return {
				source: group.getAttribute("data-source"),
				target: group.getAttribute("data-target"),
				samples,
				edgeDistance: Math.min(Math.abs(tip.x - box.left), Math.abs(tip.x - box.right)),
				centerDistance: Math.abs(tip.y - (box.top + box.bottom) / 2),
			};
		}),
	);
	expect(terminals.length).toBeGreaterThan(0);
	for (const terminal of terminals) {
		expect(
			terminal.samples.every((sample) => sample.horizontal),
			JSON.stringify(terminal),
		).toBe(true);
		expect(
			terminal.samples.every((sample) => sample.insideHead),
			JSON.stringify(terminal),
		).toBe(true);
		expect(terminal.edgeDistance, JSON.stringify(terminal)).toBeLessThan(1);
		expect(terminal.centerDistance, JSON.stringify(terminal)).toBeLessThan(1);
	}
}

test.describe("关系线", () => {
	test("两端贴着各自卡片的边缘；同一列的关系从右缘绕出再回到目标右缘", async ({ page }) => {
		await open(page);

		await expectAttached(page);
		const same = await endpoints(page, "a", "c");
		const from = await box(page, card("a"));
		const to = await box(page, card("c"));
		expect(near(same.start, rightMiddle(from))).toBe(true);
		expect(near(same.end, rightMiddle(to))).toBe(true);
	});

	test("大竖差与缩放时，曲线从箭头尾部进入而不斜穿侧翼，终点仍贴卡片", async ({ page }) => {
		await open(page, "&canvas=1");
		await page.locator(card("b")).evaluate((element) => {
			(element as HTMLElement).style.minHeight = "1000px";
		});
		await settled(page);
		await expectTerminalAlignment(page);

		await page.getByRole("button", { name: "Zoom out" }).click();
		await page.getByRole("button", { name: "Zoom out" }).click();
		await settled(page);
		await expectTerminalAlignment(page);
	});

	test("拖拽时线跟着浮起卡片，放下后跟着卡片的新位置", async ({ page }) => {
		await open(page);
		const from = await box(page, card("b"));
		const target = await box(page, `[data-column-id="done"] ${card("e")}`);
		await page.mouse.move(from.x + 20, from.y + 10);
		await page.mouse.down();
		await page.mouse.move(from.x + 60, from.y + 10, { steps: 3 });
		await page.mouse.move(target.x + 40, target.y + target.height + 30, { steps: 10 });
		// 等一帧：线每帧重新量位置
		await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));

		const ghost = await box(page, ".v-kanban__ghost");
		const during = await endpoints(page, "b", "d");
		const expected = sides(ghost, await box(page, card("d")));
		expect(near(during.start, expected.start, 2.5), JSON.stringify([during.start, ghost])).toBe(
			true,
		);

		await page.mouse.up();
		await settled(page);
		await expectAttached(page);
	});

	test("横向滚动看板时线跟着内容走；滚动之后再次测量（选中引起重渲染）也不偏移", async ({
		page,
	}) => {
		await open(page, "&narrow=1");
		await expectAttached(page);

		const scrolled = await page.locator(".v-kanban__scroller").evaluate((element) => {
			element.scrollLeft = 120;
			return element.scrollLeft;
		});
		expect(scrolled).toBeGreaterThan(0);
		await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
		await expectAttached(page);

		// 选中会重新渲染并重新测量，此时滚动偏移必须被计入
		await page.locator(card("d")).click();
		await expect(page.locator(card("d"))).toHaveAttribute("data-selected", "true");
		await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
		await expectAttached(page);
	});

	test("放进画布：缩放与平移后线仍然贴着卡片", async ({ page }) => {
		await open(page, "&canvas=1");
		await expectAttached(page);

		await page.getByRole("button", { name: "Zoom out" }).click();
		await page.getByRole("button", { name: "Zoom out" }).click();
		await settled(page);
		await expectAttached(page);

		await page.locator(".v-kanban-canvas__viewport").focus();
		await page.keyboard.press("ArrowLeft");
		await page.keyboard.press("ArrowDown");
		await settled(page);
		await expectAttached(page);

		await page.getByRole("button", { name: "Zoom in" }).click();
		await settled(page);
		await expectAttached(page);
	});

	test("画布里拖拽卡片：线跟着浮起卡片，放下后贴着新位置", async ({ page }) => {
		await open(page, "&canvas=1");
		await page.getByRole("button", { name: "Zoom out" }).click();
		await settled(page);
		const from = await box(page, card("b"));
		const target = await box(page, `[data-column-id="doing"] ${card("d")}`);
		await page.mouse.move(from.x + 20, from.y + 10);
		await page.mouse.down();
		await page.mouse.move(from.x + 60, from.y + 10, { steps: 3 });
		await page.mouse.move(target.x + 40, target.y + target.height + 20, { steps: 10 });
		await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));

		const ghost = await box(page, ".v-kanban__ghost");
		const during = await endpoints(page, "b", "d");
		const expected = sides(ghost, await box(page, card("d")));
		expect(near(during.start, expected.start, 3), JSON.stringify([during.start, ghost])).toBe(
			true,
		);

		await page.mouse.up();
		await settled(page);
		await expectAttached(page);
	});
});

test.describe("线的测量", () => {
	test("相关卡片自己变高（没有看板重渲染）时，线的端点跟上", async ({ page }) => {
		await open(page);
		await expectAttached(page);

		await page.locator(card("d")).evaluate((element) => {
			(element as HTMLElement).style.minHeight = "140px";
		});

		await expect
			.poll(async () => {
				const line = await endpoints(page, "a", "d");
				const to = await box(page, card("d"));
				return near(line.end, leftMiddle(to));
			})
			.toBe(true);
	});

	test("卡片里有无限循环的动画时，测量不会一直跑（空闲时几乎不读布局）", async ({ page }) => {
		await open(page);
		await page.addStyleTag({
			content:
				"@keyframes pulse { from { opacity: 1; } to { opacity: 0.5; } } [data-card-id='d'] > span { animation: pulse 1s linear infinite alternate; }",
		});
		await page.evaluate(() => {
			const original = Element.prototype.getBoundingClientRect;
			(window as unknown as { __rects: number }).__rects = 0;
			Element.prototype.getBoundingClientRect = function (...args) {
				(window as unknown as { __rects: number }).__rects += 1;
				return original.apply(this, args);
			};
		});
		// 先让页面安静下来，再数一段空闲时间里的读取次数
		await page.waitForTimeout(500);
		await page.evaluate(() => {
			(window as unknown as { __rects: number }).__rects = 0;
		});

		await page.waitForTimeout(600);

		expect(
			await page.evaluate(() => (window as unknown as { __rects: number }).__rects),
		).toBeLessThan(20);
	});
});

test.describe("选中与隐藏", () => {
	test("点击卡片选中：相关卡片与线清晰，其余淡化；点空白处取消", async ({ page }) => {
		await open(page);
		const opacity = (selector: string) =>
			page
				.locator(selector)
				.first()
				.evaluate((element) => {
					// 卡片淡化的是内容（li 自己的 opacity 会拖淡菜单与聚焦环），线淡化的是整个 g
					const target = element.matches("li")
						? (element.firstElementChild ?? element)
						: element;
					return Number.parseFloat(getComputedStyle(target).opacity);
				});

		await page.locator(card("d")).click();

		await expect(page.locator(card("d"))).toHaveAttribute("data-selected", "true");
		await expect.poll(() => opacity(card("e"))).toBeLessThan(0.6);
		expect(await opacity(card("a"))).toBe(1);
		expect(await opacity('.v-kanban__relation[data-source="a"][data-target="d"]')).toBe(1);
		await expect
			.poll(() => opacity('.v-kanban__relation[data-source="e"][data-target="c"]'))
			.toBeLessThan(0.5);
		const width = (selector: string) =>
			page
				.locator(`${selector} .v-kanban__relation-line`)
				.evaluate((element) => Number.parseFloat(getComputedStyle(element).strokeWidth));
		expect(
			await width('.v-kanban__relation[data-source="a"][data-target="d"]'),
		).toBeGreaterThan(await width('.v-kanban__relation[data-source="e"][data-target="c"]'));

		await page.mouse.click(5, 5);
		await page.locator(".v-kanban__scroller").click({ position: { x: 1, y: 1 } });
		await expect(page.locator("[data-selected]")).toHaveCount(0);
	});

	test("键盘：可拖的卡片用 Alt+Enter 选中，Enter 仍是拿起", async ({ page }) => {
		await open(page);
		await page.locator(card("d")).focus();

		await page.keyboard.press("Enter");
		await expect(page.locator(card("d"))).toHaveAttribute("data-lifted", "true");
		await page.keyboard.press("Escape");
		await page.keyboard.press("Alt+Enter");

		await expect(page.locator(card("d"))).toHaveAttribute("data-selected", "true");
	});

	test("隐藏连线：叠加层消失，卡片上的文字描述还在", async ({ page }) => {
		await open(page);

		await page.locator("#hide-relations").check();

		await expect(page.locator(".v-kanban__relations")).toHaveCount(0);
		await expect(page.locator(card("d")).getByText(/Relations:/)).toHaveCount(1);
	});
});

test.describe("线型本身区分类型", () => {
	test("去掉颜色后仍可区分：虚线有间隔，实线连续，挡条与箭头是不同的终点标记", async ({
		page,
	}) => {
		await open(page);
		// 把所有线染成同一种颜色并转成灰度：区分只能来自线型
		await page.addStyleTag({
			content:
				".v-kanban__relation { color: #000 !important; } .v-kanban__relation[data-line] { color: #000 !important; } html { filter: grayscale(1); }",
		});

		const coverage = (source: string, target: string) =>
			page.evaluate(
				({ from, to }) => {
					const path = document.querySelector(
						`.v-kanban__relation[data-source="${from}"][data-target="${to}"] .v-kanban__relation-line`,
					) as SVGPathElement;
					const length = path.getTotalLength();
					let covered = 0;
					const samples = 240;
					for (let i = 0; i < samples; i += 1) {
						if (path.isPointInStroke(path.getPointAtLength((length * i) / samples)))
							covered += 1;
					}
					return covered / samples;
				},
				{ from: source, to: target },
			);

		expect(await coverage("a", "d")).toBeGreaterThan(0.95);
		expect(await coverage("b", "d")).toBeLessThan(0.75);
		expect(await coverage("b", "d")).toBeGreaterThan(0.3);
		const marker = (source: string, target: string) =>
			page
				.locator(`.v-kanban__relation[data-source="${source}"][data-target="${target}"]`)
				.evaluate((group) => ({
					head: group.querySelector(".v-kanban__relation-head") !== null,
					bar: group.querySelector(".v-kanban__relation-bar") !== null,
				}));
		expect(await marker("a", "d")).toEqual({ head: true, bar: false });
		expect(await marker("b", "d")).toEqual({ head: true, bar: false });
		expect(await marker("e", "c")).toEqual({ head: false, bar: true });
	});
});

test.describe("同列关系线的车道", () => {
	/** 每条线的最右点（屏幕坐标）与滚动层可见区域的右缘。 */
	const rightEdges = (page: Page) =>
		page.evaluate(() => {
			const scroller = document.querySelector(".v-kanban__scroller") as HTMLElement;
			const lines = [...document.querySelectorAll("path.v-kanban__relation-line")].map(
				(path) => path.getBoundingClientRect().right,
			);
			return { lines, clip: scroller.getBoundingClientRect().right };
		});

	test("最后一列里重叠的弧线分到不同车道，最外的一条也不被滚动层裁掉", async ({ page }) => {
		await page.goto(`${process.env.KANBAN_FIXTURE_URL}?view=lanes`);
		await expect(page.locator(".v-kanban__relation")).toHaveCount(4);
		await settled(page);

		const { lines, clip } = await rightEdges(page);
		const unique = new Set(lines.map((value) => Math.round(value)));
		expect(unique.size, JSON.stringify(lines)).toBeGreaterThanOrEqual(3);
		for (const right of lines)
			expect(right, JSON.stringify({ lines, clip })).toBeLessThan(clip);
	});

	test("车道让线两端仍然贴着各自卡片的右缘", async ({ page }) => {
		await page.goto(`${process.env.KANBAN_FIXTURE_URL}?view=lanes`);
		await expect(page.locator(".v-kanban__relation")).toHaveCount(4);
		await expectTerminalAlignment(page);
		await settled(page);

		for (const [source, target] of [
			["l1", "l5"],
			["l2", "l4"],
			["l3", "l4"],
			["l5", "l2"],
		]) {
			const line = await endpoints(page, source, target);
			const from = await box(page, card(source));
			const to = await box(page, card(target));
			expect(near(line.start, rightMiddle(from)), `${source}→${target} start`).toBe(true);
			expect(near(line.end, rightMiddle(to)), `${source}→${target} end`).toBe(true);
		}
	});
});
