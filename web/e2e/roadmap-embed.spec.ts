import { expect, test } from "@playwright/test";
import { loadClient } from "./client";
import { ROADMAP_CANVAS_POST, ROADMAP_EMBED_POST, ROADMAP_FIXTURE } from "./mock-data.mjs";
import { collectDiagnostics } from "./support.ts";

const PATH = `/blog/${ROADMAP_EMBED_POST.slug}`;
const titleOf = (number: number) =>
	ROADMAP_FIXTURE.items.find((item) => item.number === number)?.title ?? "";
const idOf = (number: number) =>
	ROADMAP_FIXTURE.items.find((item) => item.number === number)?.id ?? "";
const card = (
	page: import("@playwright/test").Page,
	variant: "item" | "project" | "notice" | "board" | "graph",
) => page.locator(`[data-roadmap-embed="${variant}"]`);

test.describe("文章里的 roadmap 卡片", () => {
	test("首屏直出：服务端 HTML 里已有条目卡片与项目卡片的内容", async ({ request }) => {
		const response = await request.get(PATH);
		expect(response.status()).toBe(200);
		const html = await response.text();
		// 去掉脚本里序列化的数据，只看渲染出来的标记
		const markup = html.replace(/<script[\s\S]*?<\/script>/g, "");

		expect(markup).toContain('data-roadmap-embed="item"');
		expect(markup).toContain(titleOf(2));
		expect(markup).toContain('data-roadmap-embed="project"');
		expect(markup).toContain(ROADMAP_FIXTURE.project.title);
		expect(markup).toContain("不存在或已删除");
	});

	test("文章页渲染两种卡片与占位说明；点条目卡片看只读详情；水合没有报错", async ({
		page,
		context,
	}) => {
		await loadClient(context);
		const diagnostics = collectDiagnostics(page);
		await page.goto(PATH);

		await expect(card(page, "item")).toContainText(titleOf(2));
		await expect(card(page, "item")).toContainText("被阻塞");
		await expect(card(page, "project")).toContainText(ROADMAP_FIXTURE.project.title);
		await expect(card(page, "project").getByRole("progressbar")).toHaveAttribute(
			"aria-valuenow",
			String(ROADMAP_FIXTURE.progress.percent),
		);
		await expect(card(page, "notice")).toContainText(
			`${ROADMAP_FIXTURE.project.title} 的条目 #99 不存在或已删除`,
		);
		await expect(page.getByText("文章结尾的一段话。")).toBeVisible();

		await card(page, "item")
			.getByRole("button", { name: new RegExp(titleOf(2)) })
			.click();
		const dialog = page.getByRole("dialog", { name: titleOf(2) });
		await expect(dialog).toBeVisible();
		await expect(dialog.getByRole("button", { name: "编辑" })).toHaveCount(0);
		await page.keyboard.press("Escape");

		await card(page, "project").getByRole("link", { name: "查看完整路线图" }).click();
		await expect(page).toHaveURL(new RegExp(`/projects/${ROADMAP_FIXTURE.project.slug}$`));
		expect(diagnostics.filter((entry) => !entry.includes("Failed to load resource"))).toEqual(
			[],
		);
	});
});

test.describe("文章里的 roadmap 画布", () => {
	const CANVAS_PATH = `/blog/${ROADMAP_CANVAS_POST.slug}`;
	test.use({ viewport: { width: 1280, height: 900 } });

	test("画布在客户端加载：服务端 HTML 里只有同样高度的占位", async ({ request }) => {
		const html = await (await request.get(CANVAS_PATH)).text();
		const markup = html.replace(/<script[\s\S]*?<\/script>/g, "");

		expect(markup).toContain('data-roadmap-embed="board"');
		expect(markup).toContain("正在加载画布…");
		expect(markup).not.toContain("v-kanban-canvas");
	});

	test("看板画布：三阶段与条目，点条目看只读详情", async ({ page, context }) => {
		await loadClient(context);
		const diagnostics = collectDiagnostics(page);
		await page.goto(CANVAS_PATH);
		const board = card(page, "board");

		await expect(board.locator(".v-kanban-canvas")).toBeVisible();
		await expect(board.locator("[data-column-id]")).toHaveCount(3);
		await expect(board).toContainText(`${ROADMAP_FIXTURE.project.title} 的路线图`);
		await board
			.getByRole("button", { name: new RegExp(titleOf(2)) })
			.first()
			.click();
		await expect(page.getByRole("dialog", { name: titleOf(2) })).toBeVisible();
		expect(diagnostics.filter((entry) => !entry.includes("Failed to load resource"))).toEqual(
			[],
		);
	});

	test("关系画布：整个项目列出全部条目；以条目为根时只有它所在的那部分", async ({
		page,
		context,
	}) => {
		await loadClient(context);
		await page.goto(CANVAS_PATH);
		const [whole, rooted] = [card(page, "graph").nth(0), card(page, "graph").nth(1)];

		await expect(whole.locator("[data-card-id]")).toHaveCount(ROADMAP_FIXTURE.items.length);
		await expect(rooted).toContainText(`#1 ${titleOf(1)} 的关系`);
		// #1 被 #4、#3 扩展，#4 又阻塞 #2：四个条目连成一片
		await expect(rooted.locator("[data-card-id]")).toHaveCount(4);
		await expect(rooted.locator(`[data-card-id="${idOf(1)}"]`)).toHaveAttribute(
			"data-root",
			"true",
		);
		await expect(rooted.locator(`[data-card-id="${idOf(16)}"]`)).toHaveCount(0);

		await rooted.getByRole("button", { name: new RegExp(titleOf(4)) }).click();
		await expect(page.getByRole("dialog", { name: titleOf(4) })).toBeVisible();
	});

	test("不劫持页面滚动；可以全屏，Esc 退出", async ({ page, context }) => {
		await loadClient(context);
		await page.goto(CANVAS_PATH);
		const board = card(page, "board");
		await expect(board.locator(".v-kanban-canvas")).toBeVisible();
		const box = await board.locator(".v-kanban-canvas").boundingBox();
		if (!box) throw new Error("canvas is not visible");

		const before = await page.evaluate(() => scrollY);
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.wheel(0, 400);
		await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before);

		await board.getByRole("button", { name: "全屏" }).click();
		await expect(board.locator(".v-kanban-canvas")).toHaveAttribute("data-fullscreen", "true");
		await page.keyboard.press("Escape");
		await expect(board.locator(".v-kanban-canvas")).not.toHaveAttribute(
			"data-fullscreen",
			"true",
		);
	});
});
