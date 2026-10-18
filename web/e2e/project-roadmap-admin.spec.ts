import { type BrowserContext, expect, type Locator, type Page, test } from "@playwright/test";
import { ROADMAP_FIXTURE } from "./mock-data.mjs";
import { authenticated, collectDiagnostics, loadClient } from "./support.ts";

type Item = (typeof ROADMAP_FIXTURE.items)[number];
type MoveBody = {
	stage: string;
	before_id: string;
	after_id: string;
	completion_date?: string;
	delivered_version?: string;
};

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

/** 移动之后的位置：落在两侧条目的位置之间，与后端的分数索引同一种字节序。 */
function positionBetween(items: Item[], beforeId: string, afterId: string) {
	const before = items.find((item) => item.id === beforeId);
	const after = items.find((item) => item.id === afterId);
	if (before) return `${before.position}V`;
	if (after) return `0${after.position}`;
	return "V";
}

/**
 * 路线图的「后端」：浏览器里的路线图请求返回当前状态，移动接口按请求改状态并返回条目。
 * 服务端渲染仍由 mock 服务应答原始数据；移动之后的重新拉取经过这里。
 */
async function roadmapBackend(context: BrowserContext, options: { fail?: boolean } = {}) {
	const items: Item[] = structuredClone(ROADMAP_FIXTURE.items);
	const moves: Array<{ itemId: string; body: MoveBody }> = [];
	await context.route(`**/api/v1/projects/by-slug/${SLUG}/roadmap`, (route) =>
		route.fulfill({ json: { data: { ...ROADMAP_FIXTURE, items } } }),
	);
	await context.route(
		/\/api\/v1\/admin\/projects\/[^/]+\/roadmap\/items\/[^/]+\/move$/,
		(route) => {
			const itemId = route.request().url().split("/").at(-2) ?? "";
			const body = route.request().postDataJSON() as MoveBody;
			moves.push({ itemId, body });
			if (options.fail)
				return route.fulfill({
					status: 500,
					json: { error: "INTERNAL", message: "保存失败" },
				});
			const index = items.findIndex((item) => item.id === itemId);
			const [moved] = items.splice(index, 1);
			const completed = body.stage === "completed";
			Object.assign(moved, {
				stage: body.stage,
				position: positionBetween(items, body.before_id, body.after_id),
				completion_date: completed
					? (body.completion_date ?? moved.completion_date ?? "2026-10-21")
					: null,
				delivered_version: completed
					? (body.delivered_version ?? moved.delivered_version)
					: "",
			});
			// 按后端的展示顺序放回：已完成按完成日期倒序，其余阶段按位置
			const rank = { planned: 0, in_progress: 1, completed: 2 } as Record<string, number>;
			items.push(moved);
			items.sort((a, b) =>
				a.stage !== b.stage
					? rank[a.stage] - rank[b.stage]
					: a.stage === "completed"
						? (b.completion_date ?? "").localeCompare(a.completion_date ?? "") ||
							b.number - a.number
						: a.position < b.position
							? -1
							: a.position > b.position
								? 1
								: a.number - b.number,
			);
			return route.fulfill({ json: { data: moved } });
		},
	);
	return moves;
}

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
		const moves = await roadmapBackend(context);
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
			.getByRole("button", { name: new RegExp(titleOf(1)) })
			.first()
			.click();

		await expect(page.getByRole("dialog", { name: titleOf(1) })).toBeVisible();
	});

	test("键盘：拿起进行中的条目，方向键移到计划中，放下后保存", async ({ page, context }) => {
		const moves = await roadmapBackend(context);
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
		const moves = await roadmapBackend(context);
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
		const moves = await roadmapBackend(context);
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
		const moves = await roadmapBackend(context, { fail: true });
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
		const moves = await roadmapBackend(context);
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
		const moves = await roadmapBackend(context);
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
		const moves = await roadmapBackend(context);
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
