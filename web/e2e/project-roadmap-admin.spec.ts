import { expect, type Locator, type Page, test } from "@playwright/test";
import { ROADMAP_FIXTURE } from "./mock-data.mjs";
import { roadmapBackend } from "./roadmap-backend.ts";
import { authenticated, collectDiagnostics, loadClient } from "./support.ts";

const SLUG = ROADMAP_FIXTURE.project.slug;
const idOf = (number: number) =>
	ROADMAP_FIXTURE.items.find((item) => item.number === number)?.id ?? "";
const titleOf = (number: number) =>
	ROADMAP_FIXTURE.items.find((item) => item.number === number)?.title ?? "";
/** 画布里看板的一列；窄屏没有画布，这里只测宽屏。 */
const column = (page: Page, stage: string) =>
	page.locator(`.v-kanban-canvas [data-column-id="${stage}"]`);
const card = (page: Page, number: number) =>
	page.locator(`.v-kanban-canvas [data-card-id="${idOf(number)}"]`);
const notice = (page: Page) => page.locator(".v-kanban-canvas .v-kanban__notice");

async function openEditable(page: Page) {
	await page.goto(`/projects/${SLUG}`);
	await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
	// 权限由客户端读取 /auth/me 之后才知道，看板随之变成可编辑
	await expect(page.locator('.v-kanban-canvas [data-draggable="true"]').first()).toBeVisible();
}

/** 按住卡片拖到目标点再放下；先小步移出拖拽阈值，再分步移到目标，看板才能逐帧求落点。 */
async function drag(page: Page, from: Locator, to: { x: number; y: number }) {
	const box = await from.boundingBox();
	if (!box) throw new Error("card is not visible");
	const start = { x: box.x + box.width / 2, y: box.y + 16 };
	await page.mouse.move(start.x, start.y);
	await page.mouse.down();
	await page.mouse.move(start.x + 12, start.y + 12, { steps: 3 });
	await page.mouse.move(to.x, to.y, { steps: 16 });
	await page.mouse.up();
}

/** 一列里最后一张卡片下方的点：放在这里就是放到列尾。 */
async function belowLast(page: Page, stage: string) {
	const last = column(page, stage).locator("[data-card-id]").last();
	const box = await last.boundingBox();
	if (!box) throw new Error(`${stage} has no visible card`);
	return { x: box.x + box.width / 2, y: box.y + box.height + 12 };
}

test.describe("没有项目更新权限", () => {
	test("访客看不到编辑入口：卡片不能拖动，没有「移到…」", async ({ page, context }) => {
		await loadClient(context);
		await page.goto(`/projects/${SLUG}`);
		await expect(card(page, 1)).toBeVisible();

		await expect(page.locator('[data-draggable="true"]')).toHaveCount(0);
		await expect(page.getByRole("button", { name: /移到其他列/ })).toHaveCount(0);
	});

	test("只有读取权限的登录用户同样看不到编辑入口", async ({ page, context }) => {
		await loadClient(context);
		await authenticated(context, ["project:read"]);
		// 等客户端读到权限之后再断言，避免在读到之前就判定为只读
		const me = page.waitForResponse("**/api/v1/auth/me");
		await page.goto(`/projects/${SLUG}`);
		await me;
		await expect(card(page, 1)).toBeVisible();

		await expect(page.locator('[data-draggable="true"]')).toHaveCount(0);
		await expect(page.getByRole("button", { name: /移到其他列/ })).toHaveCount(0);
	});
});

test.describe("管理员拖动条目", () => {
	// 指针移出窗口会取消拖拽：窗口要高到放得下头部与目标列的列尾
	test.use({ viewport: { width: 1440, height: 1200 } });

	test.beforeEach(async ({ context }) => {
		await loadClient(context);
		await authenticated(context, ["project:update"]);
	});

	test("指针把计划中的条目拖到进行中的列尾：按两侧条目保存，保存后留在新位置", async ({
		page,
		context,
	}) => {
		const { moves } = await roadmapBackend(context);
		const diagnostics = collectDiagnostics(page);
		await openEditable(page);

		await drag(page, card(page, 3), await belowLast(page, "in_progress"));

		await expect.poll(() => moves.length).toBe(1);
		expect(moves[0]).toEqual({
			itemId: idOf(3),
			body: { stage: "in_progress", before_id: idOf(5), after_id: "" },
		});
		await expect(
			column(page, "in_progress").locator(`[data-card-id="${idOf(3)}"]`),
		).toBeVisible();
		await expect(column(page, "planned").locator(`[data-card-id="${idOf(3)}"]`)).toHaveCount(0);
		await expect(page.getByRole("dialog")).toHaveCount(0);
		// 登录后站点会拉通知、聊天等 mock 没有的接口，资源 404 与本页无关；只看页面错误与水合问题
		expect(diagnostics.filter((entry) => !entry.includes("Failed to load resource"))).toEqual(
			[],
		);
	});

	test("可编辑时点击卡片仍打开详情", async ({ page, context }) => {
		await roadmapBackend(context);
		await openEditable(page);

		await card(page, 1)
			.getByRole("button", { name: `查看 #1 ${titleOf(1)} 的详情` })
			.click();

		await expect(page.getByRole("dialog", { name: titleOf(1) })).toBeVisible();
	});

	test("键盘：拿起进行中的条目，方向键移到计划中，放下后保存", async ({ page, context }) => {
		const { moves } = await roadmapBackend(context);
		await openEditable(page);

		await card(page, 5).focus();
		await page.keyboard.press("Enter");
		await page.keyboard.press("ArrowLeft");
		await page.keyboard.press("Enter");

		await expect.poll(() => moves.length).toBe(1);
		expect(moves[0].itemId).toBe(idOf(5));
		expect(moves[0].body.stage).toBe("planned");
		await expect(column(page, "planned").locator(`[data-card-id="${idOf(5)}"]`)).toBeVisible();
	});

	test("「移到…」已完成：放到最上，完成日期以接口返回值为准", async ({ page, context }) => {
		const { moves } = await roadmapBackend(context);
		await openEditable(page);

		await card(page, 2).hover();
		await page.getByRole("button", { name: `把 #2 ${titleOf(2)} 移到其他列` }).click();
		await page.getByRole("menuitem", { name: "已完成" }).click();

		await expect.poll(() => moves.length).toBe(1);
		expect(moves[0].body).toEqual({ stage: "completed", before_id: "", after_id: idOf(17) });
		const first = column(page, "completed").locator("[data-card-id]").first();
		await expect(first).toHaveAttribute("data-card-id", idOf(2));
		await expect(first).toContainText("2026-10-21");
	});

	test("已完成阶段按日期自动排序：手动调整顺序被拒绝并说明原因，不发请求", async ({
		page,
		context,
	}) => {
		const { moves } = await roadmapBackend(context);
		await openEditable(page);

		await drag(page, card(page, 17), await belowLast(page, "completed"));

		await expect(notice(page)).toHaveText("该列自动排序，不能手动调整顺序");
		await expect(column(page, "completed").locator("[data-card-id]").first()).toHaveAttribute(
			"data-card-id",
			idOf(17),
		);
		expect(moves).toEqual([]);
	});

	test("保存失败：卡片回到原位并提示", async ({ page, context }) => {
		const { moves } = await roadmapBackend(context, { fail: true });
		await openEditable(page);

		await card(page, 3).hover();
		await page.getByRole("button", { name: `把 #3 ${titleOf(3)} 移到其他列` }).click();
		await page.getByRole("menuitem", { name: "进行中" }).click();

		await expect.poll(() => moves.length).toBe(1);
		await expect(notice(page)).toHaveText("移动未能保存，卡片已回到原位");
		await expect(column(page, "planned").locator(`[data-card-id="${idOf(3)}"]`)).toBeVisible();
		await expect(
			column(page, "in_progress").locator(`[data-card-id="${idOf(3)}"]`),
		).toHaveCount(0);
	});

	test("画布缩小之后拖动，落点仍然准确", async ({ page, context }) => {
		const { moves } = await roadmapBackend(context);
		await openEditable(page);
		await page.getByRole("button", { name: "缩小" }).click();
		await expect(page.locator(".v-kanban-canvas__zoom")).not.toHaveText("100%");
		// 等缩放过渡结束，卡片停在缩小后的位置再量
		await page.waitForTimeout(300);

		await drag(page, card(page, 3), await belowLast(page, "in_progress"));

		await expect.poll(() => moves.length).toBe(1);
		expect(moves[0].body).toEqual({ stage: "in_progress", before_id: idOf(5), after_id: "" });
	});

	test("撤销与重做移动：Ctrl/⌘+Z 移回原位，「重做」再移过去，每一步都保存", async ({
		page,
		context,
	}) => {
		const { moves } = await roadmapBackend(context);
		await openEditable(page);

		await card(page, 3).hover();
		await page.getByRole("button", { name: `把 #3 ${titleOf(3)} 移到其他列` }).click();
		await page.getByRole("menuitem", { name: "进行中" }).click();
		await expect.poll(() => moves.length).toBe(1);
		await expect(
			column(page, "in_progress").locator(`[data-card-id="${idOf(3)}"]`),
		).toBeVisible();

		// 保存的响应回来、这一步记进历史之后，「撤销」才可用
		await expect(page.getByRole("button", { name: "撤销" })).toHaveAttribute(
			"aria-disabled",
			"false",
		);
		await page.keyboard.press("ControlOrMeta+z");

		await expect.poll(() => moves.length).toBe(2);
		expect(moves[1].body).toEqual({ stage: "planned", before_id: idOf(2), after_id: "" });
		await expect(column(page, "planned").locator(`[data-card-id="${idOf(3)}"]`)).toBeVisible();

		await expect(page.getByRole("button", { name: "重做" })).toHaveAttribute(
			"aria-disabled",
			"false",
		);
		await page.getByRole("button", { name: "重做" }).click();

		await expect.poll(() => moves.length).toBe(3);
		expect(moves[2].body.stage).toBe("in_progress");
		await expect(
			column(page, "in_progress").locator(`[data-card-id="${idOf(3)}"]`),
		).toBeVisible();
	});

	test("撤销「移出已完成」时带回原来的完成日期与交付版本", async ({ page, context }) => {
		const { moves } = await roadmapBackend(context);
		await openEditable(page);

		await card(page, 17).hover();
		await page.getByRole("button", { name: `把 #17 ${titleOf(17)} 移到其他列` }).click();
		await page.getByRole("menuitem", { name: "计划中" }).click();
		await expect.poll(() => moves.length).toBe(1);
		await expect(page.getByRole("button", { name: "撤销" })).toHaveAttribute(
			"aria-disabled",
			"false",
		);

		await page.getByRole("button", { name: "撤销" }).click();

		await expect.poll(() => moves.length).toBe(2);
		expect(moves[1].body).toMatchObject({
			stage: "completed",
			completion_date: "2026-10-20",
			delivered_version: "v2.17.0",
		});
		const first = column(page, "completed").locator("[data-card-id]").first();
		await expect(first).toHaveAttribute("data-card-id", idOf(17));
		await expect(first).toContainText("v2.17.0 · 2026-10-20");
	});
});

test.describe("管理员编辑条目", () => {
	test.use({ viewport: { width: 1440, height: 1200 } });

	test.beforeEach(async ({ context }) => {
		await loadClient(context);
		await authenticated(context, ["project:update"]);
	});

	/** 等这一步记进历史：保存的响应回来之后「撤销」才可用。 */
	const undoReady = (page: Page) =>
		expect(page.getByRole("button", { name: "撤销" })).toHaveAttribute(
			"aria-disabled",
			"false",
		);

	async function quickAdd(page: Page, stage: string, label: string, title: string) {
		await column(page, stage).getByRole("button", { name: "添加卡片" }).click();
		await page.getByRole("textbox", { name: `${label} 中的新卡片标题` }).fill(title);
		await page.keyboard.press("Enter");
	}

	test("列底快速添加：只填标题，新条目排在该列末尾；撤销即删除，重做恢复同一个编号", async ({
		page,
		context,
	}) => {
		const { writes } = await roadmapBackend(context);
		await openEditable(page);

		await quickAdd(page, "planned", "计划中", "快速记下的想法");

		await expect.poll(() => writes.length).toBe(1);
		expect(writes[0]).toMatchObject({
			action: "create",
			body: { title: "快速记下的想法", stage: "planned" },
		});
		const added = column(page, "planned").locator("[data-card-id]").last();
		await expect(added).toContainText("快速记下的想法");
		await expect(added).toContainText("#18");

		// 添加后输入框留着方便连续添加；输入框里的 Ctrl/⌘+Z 归输入框自己，先收起
		await page.keyboard.press("Escape");
		await undoReady(page);
		await page.keyboard.press("ControlOrMeta+z");
		await expect.poll(() => writes.map((write) => write.action)).toEqual(["create", "delete"]);
		await expect(page.getByText("快速记下的想法")).toHaveCount(0);

		await page.getByRole("button", { name: "重做" }).click();
		await expect
			.poll(() => writes.map((write) => write.action))
			.toEqual(["create", "delete", "restore"]);
		await expect(column(page, "planned").locator("[data-card-id]").last()).toContainText("#18");
	});

	test("两个标签页各自添加，彼此的条目都不会丢", async ({ page, context }) => {
		const { writes } = await roadmapBackend(context);
		const other = await context.newPage();
		await openEditable(page);
		await openEditable(other);

		await quickAdd(page, "planned", "计划中", "第一个标签页的条目");
		await expect(column(page, "planned")).toContainText("第一个标签页的条目");
		await quickAdd(other, "planned", "计划中", "第二个标签页的条目");
		await expect.poll(() => writes.length).toBe(2);

		// 第二个标签页保存后重新拉取，看到两条
		await expect(column(other, "planned")).toContainText("第一个标签页的条目");
		await expect(column(other, "planned")).toContainText("第二个标签页的条目");
		// 第一个标签页回到前台时重新拉取，也看到两条
		await page.bringToFront();
		// TanStack Query 的聚焦监听只认冒泡的 visibilitychange
		await page.evaluate(() =>
			document.dispatchEvent(new Event("visibilitychange", { bubbles: true })),
		);
		await expect(column(page, "planned")).toContainText("第二个标签页的条目");
	});

	async function rename(page: Page, number: number, from: string, to: string) {
		await card(page, number).getByRole("button", { name: from, exact: true }).click();
		await page.getByRole("textbox", { name: `#${number} 的标题` }).fill(to);
		await page.keyboard.press("Enter");
	}

	test("点击标题就地改名：其余内容照旧整体提交；Ctrl/⌘+Z 撤销回原标题", async ({
		page,
		context,
	}) => {
		const { writes } = await roadmapBackend(context);
		await openEditable(page);

		await rename(page, 1, titleOf(1), "改过的标题");

		await expect.poll(() => writes.length).toBe(1);
		const original = ROADMAP_FIXTURE.items.find((entry) => entry.number === 1);
		expect(writes[0]).toMatchObject({
			action: "update",
			itemId: idOf(1),
			body: {
				title: "改过的标题",
				description: original?.description,
				tags: original?.tags,
				links: original?.links,
				checklist: original?.checklist,
				delivered_version: "",
			},
		});
		expect(writes[0].body).not.toHaveProperty("completion_date");
		await expect(card(page, 1)).toContainText("改过的标题");

		await undoReady(page);
		await page.keyboard.press("ControlOrMeta+z");
		await expect.poll(() => writes.length).toBe(2);
		expect(writes[1].body).toMatchObject({ title: titleOf(1) });
		await expect(card(page, 1)).toContainText(titleOf(1));
	});

	test("两个标签页先后修改同一个标题，以最后写入为准", async ({ page, context }) => {
		const { writes } = await roadmapBackend(context);
		const other = await context.newPage();
		await openEditable(page);
		await openEditable(other);

		await rename(page, 2, titleOf(2), "第一个标签页改的");
		await expect.poll(() => writes.length).toBe(1);
		// 第二个标签页还停在旧数据上
		await rename(other, 2, titleOf(2), "第二个标签页改的");
		await expect.poll(() => writes.length).toBe(2);

		await expect(card(other, 2)).toContainText("第二个标签页改的");
		await page.bringToFront();
		await page.evaluate(() =>
			document.dispatchEvent(new Event("visibilitychange", { bubbles: true })),
		);
		await expect(card(page, 2)).toContainText("第二个标签页改的");
	});
});
