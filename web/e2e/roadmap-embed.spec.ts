import { expect, test } from "@playwright/test";
import { ROADMAP_EMBED_POST, ROADMAP_FIXTURE } from "./mock-data.mjs";
import { collectDiagnostics, loadClient } from "./support.ts";

const PATH = `/blog/${ROADMAP_EMBED_POST.slug}`;
const titleOf = (number: number) =>
	ROADMAP_FIXTURE.items.find((item) => item.number === number)?.title ?? "";
const card = (page: import("@playwright/test").Page, variant: "item" | "project" | "notice") =>
	page.locator(`[data-roadmap-embed="${variant}"]`);

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
		// 文章页的评论、批注等接口 mock 没有，资源 404 与卡片无关
		expect(diagnostics.filter((entry) => !entry.includes("Failed to load resource"))).toEqual(
			[],
		);
	});
});
