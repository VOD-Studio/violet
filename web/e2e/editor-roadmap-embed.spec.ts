import { expect, type Page, test } from "@playwright/test";
import { loadClient } from "./client";
import { ROADMAP_FIXTURE } from "./mock-data.mjs";
import { authenticated, collectDiagnostics } from "./support.ts";

const PROJECT = ROADMAP_FIXTURE.project;
const titleOf = (number: number) =>
	ROADMAP_FIXTURE.items.find((item) => item.number === number)?.title ?? "";

/** 打开下拉并点选一项。 */
async function choose(page: Page, label: string, option: string) {
	await page.getByRole("dialog").getByRole("combobox", { name: label }).click();
	await page.getByRole("option", { name: option, exact: true }).click();
}

test.describe("编辑器里的路线图入口", () => {
	test.use({ viewport: { width: 1280, height: 900 } });

	test.beforeEach(async ({ context, page }) => {
		await loadClient(context);
		await authenticated(context, ["*"]);
		await page.goto("/admin/posts/new");
		await page.locator(".ProseMirror").click();
	});

	test("Slash 选「路线图」，在弹层里选项目与条目并预览，插入后编辑区实时预览", async ({
		page,
	}) => {
		const diagnostics = collectDiagnostics(page);
		await page.keyboard.type("/路线图");
		await page.getByRole("button", { name: /^路线图/ }).click();

		const dialog = page.getByRole("dialog", { name: "插入路线图" });
		await expect(dialog).toBeVisible();
		await expect(dialog.getByRole("button", { name: "插入" })).toBeDisabled();
		await expect(dialog.getByText("选好之后在这里预览")).toBeVisible();

		await choose(page, "项目", PROJECT.title);
		const preview = dialog.getByRole("region", { name: "预览" });
		await expect(preview.locator('[data-roadmap-embed="project"]')).toContainText(
			PROJECT.title,
		);
		await choose(page, "条目", `#2 ${titleOf(2)}`);
		await expect(preview.locator('[data-roadmap-embed="item"]')).toContainText(titleOf(2));
		await dialog.getByRole("button", { name: "插入" }).click();

		await expect(dialog).toBeHidden();
		const block = page.locator(".ProseMirror pre");
		await expect(block).toHaveText(`{"project":"${PROJECT.slug}","item":2}`);
		await expect(
			page.getByRole("region", { name: "嵌入预览" }).locator('[data-roadmap-embed="item"]'),
		).toContainText(titleOf(2));
		// 焦点回到编辑器，可以接着写
		await expect(page.locator(".ProseMirror")).toBeFocused();

		await page.getByRole("button", { name: "源码" }).click();
		await expect(page.locator(".cm-content")).toContainText("```roadmap");
		expect(diagnostics.filter((entry) => !entry.includes("Failed to load resource"))).toEqual(
			[],
		);
	});

	test("代码块上的「编辑路线图」回填参数，改成关系画布后整块更新", async ({ page }) => {
		await page.keyboard.type("/路线图");
		await page.keyboard.press("Enter");
		let dialog = page.getByRole("dialog", { name: "插入路线图" });
		await choose(page, "项目", PROJECT.title);
		await choose(page, "条目", `#1 ${titleOf(1)}`);
		await dialog.getByRole("button", { name: "插入" }).click();
		await expect(dialog).toBeHidden();

		await page.getByRole("button", { name: "编辑路线图" }).click();
		dialog = page.getByRole("dialog", { name: "编辑路线图" });
		await expect(dialog.getByRole("combobox", { name: "条目" })).toHaveText(`#1 ${titleOf(1)}`);
		await dialog.getByRole("button", { name: "关系画布" }).click();
		await expect(
			dialog.getByText("指定条目时只画与它相连的部分，否则画整个项目"),
		).toBeVisible();
		await dialog.getByRole("button", { name: "更新" }).click();

		await expect(dialog).toBeHidden();
		await expect(page.locator(".ProseMirror pre")).toHaveText(
			`{"project":"${PROJECT.slug}","display":"canvas","view":"graph","item":1}`,
		);
		await expect(
			page.getByRole("region", { name: "嵌入预览" }).locator('[data-roadmap-embed="graph"]'),
		).toContainText(`#1 ${titleOf(1)} 的关系`);
	});

	test("手写 roadmap 围栏块同样实时预览，改参数后预览跟着变", async ({ page }) => {
		await page.keyboard.type("```roadmap");
		await page.keyboard.press("Enter");
		await page.keyboard.type(`{"project":"${PROJECT.slug}"}`);

		const preview = page.getByRole("region", { name: "嵌入预览" });
		await expect(preview.locator('[data-roadmap-embed="project"]')).toContainText(
			PROJECT.title,
		);

		await page.keyboard.press("ArrowLeft");
		await page.keyboard.type(',"item":99');
		await expect(preview.locator('[data-roadmap-embed="notice"]')).toContainText(
			`${PROJECT.title} 的条目 #99 不存在或已删除`,
		);
	});
});
