import { expect, type Locator, type Page, test } from "@playwright/test";
import { ROADMAP_FIXTURE } from "./mock-data.mjs";
import { collectDiagnostics, loadClient } from "./support.ts";

const SLUG = ROADMAP_FIXTURE.project.slug;
const idOf = (number: number) =>
	ROADMAP_FIXTURE.items.find((item) => item.number === number)?.id ?? "";

const card = (page: Page, number: number) => page.locator(`[data-card-id="${idOf(number)}"]`);
const cardButton = (page: Page, title: string) =>
	page.getByRole("button", { name: new RegExp(title) });
const lines = (page: Page) => page.locator(".v-kanban__relation");
const line = (page: Page, source: number, target: number) =>
	page.locator(
		`.v-kanban__relation[data-source="${idOf(source)}"][data-target="${idOf(target)}"]`,
	);

/** 位置连续两次相同才算停稳：弹窗关闭后焦点回到卡片，画布会平移到刚好露出，期间位置在变。 */
async function stableBox(locator: Locator) {
	let previous = JSON.stringify(await locator.boundingBox());
	for (let attempt = 0; attempt < 40; attempt += 1) {
		await locator.page().waitForTimeout(60);
		const current = JSON.stringify(await locator.boundingBox());
		if (current === previous)
			return JSON.parse(current) as { x: number; y: number; width: number; height: number };
		previous = current;
	}
	throw new Error("element never settled");
}

async function open(page: Page) {
	await page.goto(`/projects/${SLUG}`);
	await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
	await expect(lines(page).first()).toBeAttached();
}

test.describe("关系线", () => {
	test("每条关系一条线，线型按类型区分：阻塞带挡条、修复虚线、扩展实线带箭头", async ({
		page,
		context,
	}) => {
		await loadClient(context);
		const diagnostics = collectDiagnostics(page);
		await open(page);

		await expect(lines(page)).toHaveCount(4);
		const blocks = line(page, 4, 2);
		await expect(blocks).toHaveAttribute("data-line", "blocker");
		await expect(blocks.locator(".v-kanban__relation-bar")).toHaveCount(1);
		await expect(line(page, 17, 16)).toHaveAttribute("data-line", "dashed");
		const extend = line(page, 3, 1);
		await expect(extend).toHaveAttribute("data-line", "solid");
		await expect(extend.locator(".v-kanban__relation-head")).toHaveCount(1);
		expect(diagnostics).toEqual([]);
	});

	test("线叠加层不接收指针、对读屏隐藏：不挡卡片，也不重复朗读", async ({ page, context }) => {
		await loadClient(context);
		await open(page);

		const layer = page.locator(".v-kanban__relations");
		await expect(layer).toHaveAttribute("aria-hidden", "true");
		expect(await layer.evaluate((node) => getComputedStyle(node).pointerEvents)).toBe("none");
	});

	test("隐藏连线：线整体消失，卡片上给读屏的关系文字还在；取消隐藏线回来", async ({
		page,
		context,
	}) => {
		await loadClient(context);
		await open(page);
		const toggle = page.getByRole("checkbox", { name: "隐藏连线" });
		await expect(toggle).not.toBeChecked();

		await toggle.check();

		await expect(page.locator(".v-kanban__relations")).toHaveCount(0);
		await expect(card(page, 2)).toContainText("关系：被阻塞 #4 进行中的第一项");
		await toggle.uncheck();
		await expect(lines(page)).toHaveCount(4);
	});

	test("没有关系的项目没有「隐藏连线」开关", async ({ page, context }) => {
		await loadClient(context);
		await page.goto("/projects/roadmap-empty");
		await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

		await expect(page.getByRole("checkbox", { name: "隐藏连线" })).toHaveCount(0);
	});
});

test.describe("选中与高亮", () => {
	test("点击条目：打开详情并选中；关闭后相关的条目与线保持清晰，其余淡化", async ({
		page,
		context,
	}) => {
		await loadClient(context);
		await open(page);

		await cardButton(page, "计划中的第一项").click();
		await expect(page.getByRole("dialog", { name: "计划中的第一项" })).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(page.getByRole("dialog")).toHaveCount(0);

		await expect(card(page, 1)).toHaveAttribute("data-selected", "true");
		// #1 与 #3、#4 直接相连
		await expect(card(page, 3)).toHaveAttribute("data-related", "true");
		await expect(card(page, 4)).toHaveAttribute("data-related", "true");
		await expect(card(page, 5)).toHaveAttribute("data-faded", "true");
		await expect(card(page, 2)).toHaveAttribute("data-faded", "true");
		await expect(line(page, 3, 1)).toHaveAttribute("data-state", "active");
		await expect(line(page, 4, 1)).toHaveAttribute("data-state", "active");
		await expect(line(page, 4, 2)).toHaveAttribute("data-state", "faded");
		await expect(line(page, 17, 16)).toHaveAttribute("data-state", "faded");
		await expect(page.getByText("已选中 #1")).toBeVisible();
	});

	test("「取消选中」恢复全部；点列里的空白处也取消", async ({ page, context }) => {
		await loadClient(context);
		await open(page);
		await cardButton(page, "计划中的第一项").click();
		await page.keyboard.press("Escape");
		await expect(card(page, 1)).toHaveAttribute("data-selected", "true");

		await page.getByRole("button", { name: "取消选中" }).click();
		await expect(page.locator("[data-selected]")).toHaveCount(0);
		await expect(page.locator("[data-faded]")).toHaveCount(0);
		await expect(page.getByText("已选中")).toHaveCount(0);

		await cardButton(page, "计划中的第三项").click();
		await page.keyboard.press("Escape");
		await expect(card(page, 3)).toHaveAttribute("data-selected", "true");
		await expect(page.getByRole("dialog")).toHaveCount(0);
		await page.getByRole("group", { name: "画布", exact: true }).scrollIntoViewIfNeeded();
		const last = await stableBox(card(page, 3));
		await page.mouse.click(last.x + last.width / 2, last.y + last.height + 40);
		await expect(page.locator("[data-selected]")).toHaveCount(0);
	});

	test("选中的条目被「收起」之后不再显示，不会留下一片淡化却不知道选的是谁", async ({
		page,
		context,
	}) => {
		await loadClient(context);
		await open(page);
		const more = page.getByRole("button", { name: /展开更多/ });
		await more.focus();
		await more.click();
		// 第 12 项在画布视口之外：先聚焦，画布平移到刚好露出
		await cardButton(page, "已完成的第 6 项").focus();
		await cardButton(page, "已完成的第 6 项").click();
		await page.keyboard.press("Escape");
		await expect(page.locator("[data-selected]")).toHaveCount(1);

		const fold = page.getByRole("button", { name: "收起" });
		await fold.focus();
		await fold.click();

		await expect(page.locator("[data-selected]")).toHaveCount(0);
		await expect(page.locator("[data-faded]")).toHaveCount(0);
		await expect(page.getByText("已选中")).toHaveCount(0);
	});
});

test.describe("被阻塞", () => {
	test("被阻塞的条目带文字标记，别的条目没有；标记在按钮的可访问名称里", async ({
		page,
		context,
	}) => {
		await loadClient(context);
		await open(page);

		await expect(card(page, 2).getByText("被阻塞", { exact: true })).toBeVisible();
		await expect(
			page.locator(".v-kanban__card").getByText("被阻塞", { exact: true }),
		).toHaveCount(1);
		await expect(cardButton(page, "计划中的第二项")).toHaveAccessibleName(/被阻塞/);
	});

	test("前置条目完成后重新拉取，被阻塞标记自动解除", async ({ page, context }) => {
		await loadClient(context);
		await open(page);
		let unblocked = false;
		await context.route(`**/api/v1/projects/by-slug/${SLUG}/roadmap`, async (route) => {
			const response = await route.fetch({
				url: `http://127.0.0.1:9410/api/v1/projects/by-slug/${SLUG}/roadmap`,
			});
			if (!unblocked) return route.fulfill({ response });
			const body = await response.json();
			for (const item of body.data.items) {
				if (item.number === 4) {
					item.stage = "completed";
					item.completion_date = "2026-10-21";
				}
				if (item.number === 2) item.blocked = false;
			}
			return route.fulfill({ response, json: body });
		});
		await expect(card(page, 2).getByText("被阻塞", { exact: true })).toBeVisible();

		unblocked = true;
		await page.evaluate(() => {
			for (const state of ["hidden", "visible"]) {
				Object.defineProperty(document, "visibilityState", {
					configurable: true,
					value: state,
				});
				document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
			}
		});

		await expect(card(page, 2).getByText("被阻塞", { exact: true })).toHaveCount(0);
		await expect(
			page.locator(".v-kanban__card").getByText("被阻塞", { exact: true }),
		).toHaveCount(0);
		await expect(cardButton(page, "计划中的第二项")).not.toHaveAccessibleName(/被阻塞/);
	});
});

test.describe("弹窗里的关系", () => {
	test("按方向分组列出这个条目的关系，另一端带编号、标题与阶段；被阻塞的头部写明原因", async ({
		page,
		context,
	}) => {
		await loadClient(context);
		await open(page);

		await cardButton(page, "计划中的第二项").click();

		const dialog = page.getByRole("dialog", { name: "计划中的第二项" });
		await expect(dialog).toContainText("被阻塞：还有未完成的前置条目");
		const section = dialog.getByRole("region", { name: "关系" });
		await expect(section.locator("dt")).toHaveText(["被阻塞"]);
		await expect(section.getByRole("listitem")).toHaveText([/^#4\s*进行中的第一项\s*进行中$/]);
	});

	test("有多条关系时都列出，两个方向都在", async ({ page, context }) => {
		await loadClient(context);
		await open(page);

		await cardButton(page, "计划中的第一项").click();

		const items = page
			.getByRole("dialog")
			.getByRole("region", { name: "关系" })
			.getByRole("listitem");
		await expect(items).toHaveText([
			/^#4\s*进行中的第一项\s*进行中$/,
			/^#3\s*计划中的第三项\s*计划中$/,
		]);
		await expect(page.getByRole("dialog").locator("dt")).toHaveText(["被扩展"]);
	});

	test("没有关系的条目没有这一块", async ({ page, context }) => {
		await loadClient(context);
		await open(page);

		await cardButton(page, "进行中的第二项").click();

		await expect(page.getByRole("dialog", { name: "进行中的第二项" })).toBeVisible();
		await expect(page.getByRole("region", { name: "关系" })).toHaveCount(0);
	});
});

test.describe("读屏", () => {
	test("每张有关系的卡片带文字描述：编号、标题、被阻塞与关系", async ({ page, context }) => {
		await loadClient(context);
		await open(page);

		const text = await card(page, 1).innerText();
		expect(text).toContain("#1");
		expect(text).toContain("计划中的第一项");
		await expect(card(page, 1)).toContainText(
			"关系：被扩展 #4 进行中的第一项；被扩展 #3 计划中的第三项",
		);
		await expect(card(page, 5)).not.toContainText("关系：");
	});

	test("画布里的可操作元素都有名称：没有未命名的按钮、复选框或链接", async ({
		page,
		context,
	}) => {
		await loadClient(context);
		await open(page);

		const snapshot = await page.locator("main").or(page.locator("body")).first().ariaSnapshot();
		const unnamed = snapshot
			.split("\n")
			.filter((entry) =>
				/^\s*- (button|checkbox|link|tab|dialog)(\s+\[[^\]]+\])*:?$/.test(entry),
			);
		expect(unnamed).toEqual([]);
	});
});

test.describe("窄屏（390px）", () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test("没有线与开关，关系用卡片上的标记，点击跳到另一端的条目", async ({ page, context }) => {
		await loadClient(context);
		const diagnostics = collectDiagnostics(page);
		await page.goto(`/projects/${SLUG}`);
		await expect(page.getByRole("tablist", { name: "切换列" })).toBeVisible();

		await expect(page.locator(".v-kanban__relations")).toHaveCount(0);
		await expect(page.getByRole("checkbox", { name: "隐藏连线" })).toHaveCount(0);
		const marker = card(page, 2).getByRole("button", { name: /被阻塞 #4 进行中的第一项/ });
		await expect(marker).toBeVisible();

		await marker.click();

		await expect(page.getByRole("tab", { name: /进行中/ })).toHaveAttribute(
			"aria-selected",
			"true",
		);
		await expect(card(page, 4)).toBeFocused();
		expect(diagnostics).toEqual([]);
	});
});
