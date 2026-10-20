import { expect, type Locator, type Page, test } from "@playwright/test";
import { loadClient } from "./client";
import { collectDiagnostics, openClientPage } from "./support.ts";

const editable = (page: Page) => page.locator('[data-kanban-example="editable"]');
const column = (page: Page, title: string) =>
	editable(page).getByRole("group", { name: title, exact: true });
const card = (page: Page, title: string) =>
	editable(page).locator("[data-card-id]").filter({ hasText: title });
const cardsIn = (page: Page, title: string) =>
	column(page, title)
		.locator("[data-card-id]")
		.evaluateAll((items) => items.map((item) => item.textContent?.replace("Move to…", "")));

/** 按住卡片拖到目标点再放下；先小步移出拖拽阈值，再分步移到目标。 */
async function drag(page: Page, from: Locator, to: Locator) {
	const box = await from.boundingBox();
	const target = await to.boundingBox();
	if (!box || !target) throw new Error("card or column is not visible");
	const start = { x: box.x + 24, y: box.y + box.height / 2 };
	await page.mouse.move(start.x, start.y);
	await page.mouse.down();
	await page.mouse.move(start.x + 12, start.y + 12, { steps: 3 });
	await page.mouse.move(target.x + target.width / 2, target.y + target.height - 24, {
		steps: 16,
	});
	await page.mouse.up();
}

/** 颜色的相对亮度（0–1）；在画布里画一个像素再读回，任何 CSS 颜色写法都能比较。 */
const luminance = (locator: Locator, property: "backgroundColor" | "color") =>
	locator.evaluate((element, key) => {
		const context = document.createElement("canvas").getContext("2d");
		if (!context) throw new Error("no 2d context");
		context.fillStyle = getComputedStyle(element)[key];
		context.fillRect(0, 0, 1, 1);
		const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
		return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
	}, property);

test.describe("/kanban 看板文档与演示", () => {
	test.use({ viewport: { width: 1440, height: 1000 } });

	test.beforeEach(async ({ context }) => {
		await loadClient(context);
	});

	test("导航「更多」里有「看板」入口，进入文档页", async ({ page }) => {
		await openClientPage(page, "/projects");
		await page.getByRole("button", { name: "更多" }).click();
		await page.getByRole("link", { name: /看板/ }).click();

		await expect(page).toHaveURL(/\/kanban$/);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("看板");
		await expect(page).toHaveTitle("看板 · @violetjs/kanban");
	});

	test("服务端直出演示、安装与 API；源码与预览同一份，目录可跳到 API 小节", async ({
		page,
		request,
	}) => {
		const html = await (await request.get("/kanban")).text();
		// 只断言正文文字：代码块由懒加载组件渲染，服务器冷启动时首个请求可能只输出占位
		for (const text of ["可编辑看板与历史", "仓库外", 'id="board"', "主题接缝"])
			expect(html).toContain(text);

		const diagnostics = collectDiagnostics(page);
		await openClientPage(page, "/kanban");
		const example = page.locator("#example-editable");
		await example.getByText("源码 · examples/editable.tsx").click();
		await expect(example.locator("pre")).toContainText("export function EditableBoard()");

		await page
			.getByRole("navigation", { name: "API 目录" })
			.getByRole("link", { name: "Canvas" })
			.click();
		await expect(page).toHaveURL(/#canvas$/);
		await expect(page.locator("#canvas")).toBeInViewport();
		expect(diagnostics.filter((entry) => !entry.includes("Failed to load resource"))).toEqual(
			[],
		);
	});

	test("演示：拖动卡片换列，撤销与重做都只改本地状态", async ({ page }) => {
		const writes: string[] = [];
		page.on("request", (request) => {
			if (request.method() !== "GET") writes.push(`${request.method()} ${request.url()}`);
		});
		await openClientPage(page, "/kanban");
		await expect(card(page, "Write the specification")).toBeVisible();

		await drag(page, card(page, "Write the specification"), column(page, "In progress"));
		await expect
			.poll(() => cardsIn(page, "In progress"))
			.toEqual(["Build the prototype", "Write the specification"]);

		await editable(page).getByRole("button", { name: "Undo" }).click();
		await expect.poll(() => cardsIn(page, "Planned")).toEqual(["Write the specification"]);
		await editable(page).getByRole("button", { name: "Redo" }).click();
		await expect.poll(() => cardsIn(page, "Planned")).toEqual([]);
		expect(writes).toEqual([]);
	});

	test("演示：键盘拿起、移动、放下，Ctrl/⌘+Z 撤销", async ({ page }) => {
		await openClientPage(page, "/kanban");
		const prototype = card(page, "Build the prototype");
		await prototype.focus();

		await page.keyboard.press("Space");
		await expect(prototype).toHaveAttribute("data-lifted", "true");
		await page.keyboard.press("ArrowRight");
		await expect.poll(() => cardsIn(page, "Done")).toEqual(["Build the prototype"]);
		await expect(prototype).toBeFocused();
		await page.keyboard.press("Space");
		await expect(prototype).not.toHaveAttribute("data-lifted", "true");
		await expect(editable(page).getByRole("button", { name: "Undo" })).toBeEnabled();

		await page.keyboard.press("ControlOrMeta+z");
		await expect.poll(() => cardsIn(page, "In progress")).toEqual(["Build the prototype"]);
	});

	test("暗色模式：演示与正文跟随站点主题", async ({ page }) => {
		await page.emulateMedia({ colorScheme: "dark" });
		await page.goto("/kanban");
		await expect(page.locator("html")).toHaveClass(/\bdark\b/);

		const spec = card(page, "Write the specification");
		await expect(spec).toBeVisible();
		expect(await luminance(spec, "backgroundColor")).toBeLessThan(0.3);
		expect(await luminance(spec, "color")).toBeGreaterThan(0.7);
		expect(
			await luminance(page.getByRole("heading", { name: "主题接缝" }), "color"),
		).toBeGreaterThan(0.7);
	});
});
