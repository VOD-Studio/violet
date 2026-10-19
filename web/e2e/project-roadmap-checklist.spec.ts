import { expect, type Page, test } from "@playwright/test";
import { loadClient } from "./client";
import { ROADMAP_FIXTURE } from "./mock-data.mjs";
import { collectDiagnostics } from "./support.ts";

const SLUG = ROADMAP_FIXTURE.project.slug;
/** 卡片按钮的名字以 #编号 开头；关系标记按钮的名字不是 */
const cardButton = (page: Page, number: number) =>
	page.getByRole("button", { name: new RegExp(`^#${number}\\s`) });

async function open(page: Page) {
	await page.goto(`/projects/${SLUG}`);
	await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

test.describe("子项清单", () => {
	test("卡片显示完成数与总数，没有子项的卡片没有这一项", async ({ page, context }) => {
		await loadClient(context);
		await open(page);

		await expect(cardButton(page, 1)).toContainText("1/3");
		await expect(cardButton(page, 4)).toContainText("12/30");
		await expect(cardButton(page, 3)).not.toContainText("子项已完成");
	});

	test("弹窗按顺序列出子项，已完成与未完成都有文字说明", async ({ page, context }) => {
		await loadClient(context);
		await open(page);

		await cardButton(page, 1).click();

		const dialog = page.getByRole("dialog", { name: "计划中的第一项" });
		await expect(dialog.getByRole("heading", { name: "子项" })).toBeVisible();
		await expect(
			dialog.getByRole("region", { name: "子项清单" }).getByRole("listitem"),
		).toHaveText(["已完成：梳理现有画布的交互", "未完成：补键盘操作", "未完成：补读屏说明"]);
	});

	test("没有子项的条目弹窗没有「子项」", async ({ page, context }) => {
		await loadClient(context);
		await open(page);

		await cardButton(page, 3).click();

		await expect(page.getByRole("dialog", { name: "计划中的第三项" })).toBeVisible();
		await expect(page.getByRole("heading", { name: "子项" })).toHaveCount(0);
	});

	test("子项很多时清单在区域里滚动，弹窗整体不超出视口，键盘可以滚动，可只看未完成的", async ({
		page,
		context,
	}) => {
		await loadClient(context);
		const diagnostics = collectDiagnostics(page);
		await open(page);

		await cardButton(page, 4).click();

		const dialog = page.getByRole("dialog", { name: "进行中的第一项" });
		const list = dialog.getByRole("region", { name: "子项清单" });
		await expect(list.getByRole("listitem")).toHaveCount(30);
		const box = await dialog.boundingBox();
		const viewport = page.viewportSize();
		expect(box && viewport && box.y >= 0 && box.y + box.height <= viewport.height).toBe(true);
		const overflow = await list.evaluate((node) => node.scrollHeight - node.clientHeight);
		expect(overflow).toBeGreaterThan(0);

		await list.focus();
		await page.keyboard.press("End");
		await expect.poll(() => list.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);

		const hide = dialog.getByRole("button", { name: "隐藏已完成" });
		await hide.click();
		await expect(list.getByRole("listitem")).toHaveCount(18);
		await expect(list).not.toContainText("已完成：");
		await dialog.getByRole("button", { name: "显示已完成（12）" }).click();
		await expect(list.getByRole("listitem")).toHaveCount(30);

		await page.keyboard.press("Escape");
		await expect(dialog).toHaveCount(0);
		expect(diagnostics).toEqual([]);
	});
});

test.describe("窄屏（390px）的子项清单", () => {
	test.use({ viewport: { width: 390, height: 800 } });

	test("弹窗不超出视口宽度，长子项自然换行", async ({ page, context }) => {
		await loadClient(context);
		await open(page);
		// 窄屏一次只显示一个阶段
		await page.getByRole("tab", { name: /进行中/ }).click();

		await cardButton(page, 4).click();

		const dialog = page.getByRole("dialog", { name: "进行中的第一项" });
		await expect(dialog.getByRole("region", { name: "子项清单" })).toBeVisible();
		const box = await dialog.boundingBox();
		expect(box && box.x >= 0 && box.x + box.width <= 390).toBe(true);
		const overflow = await page.evaluate(
			() =>
				Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) -
				window.innerWidth,
		);
		expect(overflow).toBeLessThanOrEqual(0);
	});
});
