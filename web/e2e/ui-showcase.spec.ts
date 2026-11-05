import { expect, type Page, test } from "@playwright/test";
import { loadClient } from "./client";
import { collectDiagnostics } from "./support.ts";

const WIDTHS = [390, 768, 1024, 1440, 1920, 2560, 3440];

/**
 * 每个展柜的溢出情况：舞台固定为占地尺寸，overflow 为内容超出舞台或展柜纵向溢出；
 * roomy 表示展柜放得下占地加两侧柜内边距，此时不允许横向滑动。
 */
function measureCases(page: Page) {
	return page.evaluate(() => {
		const cases = Array.from(document.querySelectorAll<HTMLElement>("main [data-exhibit]")).map(
			(exhibit) => {
				const box = exhibit.querySelector<HTMLElement>("[data-case]");
				const stage = exhibit.querySelector<HTMLElement>("[data-stage]");
				if (!box || !stage) throw new Error(`${exhibit.dataset.exhibit} 缺少展柜或舞台`);
				const style = getComputedStyle(box);
				const padding =
					Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
				return {
					id: exhibit.dataset.exhibit,
					overflow:
						stage.scrollWidth > stage.clientWidth + 1 ||
						stage.scrollHeight > stage.clientHeight + 1 ||
						box.scrollHeight > box.clientHeight + 1,
					horizontal: box.scrollWidth > box.clientWidth + 1,
					roomy: box.clientWidth >= Number(exhibit.dataset.footprintWidth) + padding,
				};
			},
		);
		const columns = Array.from(document.querySelectorAll<HTMLElement>("[data-hall]")).map(
			(hall) => getComputedStyle(hall).gridTemplateColumns.split(" ").length,
		);
		return {
			cases,
			columns: Math.max(...columns),
			pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
		};
	});
}

test("七个宽度下展柜不裁切展品，横向滑动只出现在放不下占地时，栏数单调不减", async ({
	page,
	context,
}) => {
	await loadClient(context);
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.setViewportSize({ width: WIDTHS[0], height: 900 });
	await page.goto("/ui");
	await page.waitForLoadState("networkidle");
	// textarea 等控件的行高随字体度量变化，等字体落定再量
	await page.evaluate(() => document.fonts.ready);
	let previous = 0;
	for (const width of WIDTHS) {
		await page.setViewportSize({ width, height: 900 });
		await page.evaluate(
			() =>
				new Promise((resolve) =>
					requestAnimationFrame(() => requestAnimationFrame(resolve)),
				),
		);
		const { cases, columns, pageOverflow } = await measureCases(page);
		expect(cases.length, `${width}`).toBeGreaterThan(0);
		expect(
			cases.filter((item) => item.overflow).map((item) => item.id),
			`${width} 溢出占地`,
		).toEqual([]);
		expect(
			cases.filter((item) => item.horizontal && item.roomy).map((item) => item.id),
			`${width} 放得下仍横向滑动`,
		).toEqual([]);
		expect(pageOverflow, `${width} 页面横向溢出`).toBeLessThanOrEqual(0);
		expect(columns, `${width} 栏数`).toBeGreaterThanOrEqual(previous);
		previous = columns;
	}
	expect(previous).toBeGreaterThan(1);
});

test("整幅展品跨满全部栏，非整幅展品按占地分栏", async ({ page, context }) => {
	await loadClient(context);
	await page.setViewportSize({ width: 2560, height: 900 });
	await page.goto("/ui");
	await page.waitForLoadState("networkidle");
	const hall = page.locator('[data-hall="banner"]');
	const hallWidth = await hall.evaluate((element) => element.clientWidth);
	for (const exhibit of await hall.locator("[data-exhibit]").all()) {
		expect(await exhibit.evaluate((element) => element.getBoundingClientRect().width)).toBe(
			hallWidth,
		);
	}
	const shelf = page.locator('[data-hall="shelf"]');
	expect(
		await shelf.evaluate(
			(element) => getComputedStyle(element).gridTemplateColumns.split(" ").length,
		),
	).toBeGreaterThan(2);
});

test("检视台里每种状态都在占地内", async ({ page, context }) => {
	await loadClient(context);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto("/ui");
	await page.waitForLoadState("networkidle");
	const ids = await page
		.locator('main [data-exhibit]:not([data-status="planned"])')
		.evaluateAll((elements) =>
			elements.map((element) => (element as HTMLElement).dataset.exhibit),
		);
	expect(ids.length).toBeGreaterThan(0);
	for (const id of ids) {
		await page.goto(`/ui?open=${id}`);
		await page.waitForLoadState("networkidle");
		await page.evaluate(() => document.fonts.ready);
		const dialog = page.getByRole("dialog");
		const states = dialog.getByRole("group", { name: "展品状态" }).getByRole("button");
		const count = Math.max(1, await states.count());
		for (let index = 0; index < count; index++) {
			if ((await states.count()) > 0) await states.nth(index).click();
			const overflow = await dialog
				.locator("[data-stage]")
				.evaluate(
					(stage) =>
						stage.scrollWidth > stage.clientWidth + 1 ||
						stage.scrollHeight > stage.clientHeight + 1,
				);
			expect(overflow, `${id} 第 ${index + 1} 种状态溢出占地`).toBe(false);
		}
	}
});

test("检视台可用键盘走近、切换、调整外观并在离开后归还焦点", async ({ page, context }) => {
	await loadClient(context);
	const diagnostics = collectDiagnostics(page);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto("/ui");
	await page.waitForLoadState("networkidle");
	const plinth = page.getByRole("button", { name: "走近 按钮", exact: true });
	await plinth.focus();
	await page.keyboard.press("Enter");
	const dialog = page.getByRole("dialog", { name: "按钮" });
	await expect(dialog).toBeFocused();
	await expect(page).toHaveURL(/open=button/);

	await page.keyboard.press("ArrowRight");
	await expect(page.getByRole("dialog", { name: "分段控制" })).toBeVisible();
	await page.keyboard.press("ArrowLeft");
	await expect(dialog).toBeVisible();

	// 背景不可聚焦：Tab 循环始终落在检视台或其后新增的浮层里
	for (let step = 0; step < 30; step++) {
		await page.keyboard.press("Tab");
		const inside = await page.evaluate(() => {
			const active = document.activeElement;
			return active === document.body || !!active?.closest('[role="dialog"]');
		});
		expect(inside, `第 ${step + 1} 次 Tab`).toBe(true);
	}

	const scope = page.locator("body > [data-theme]");
	await dialog.getByRole("group", { name: "明暗" }).getByRole("button", { name: "深色" }).click();
	await expect(scope).toHaveClass(/\bdark\b/);
	await expect(page.locator("main [data-theme]").first()).toHaveClass(/\bdark\b/);
	await dialog.getByRole("group", { name: "季节" }).getByRole("button", { name: "荷风" }).click();
	await expect(scope).toHaveAttribute("data-theme", "summer");
	const reduced = dialog.getByRole("button", { name: "减弱动态" });
	await reduced.click();
	await expect(reduced).toHaveAttribute("aria-pressed", "true");
	await expect(scope).toHaveAttribute("data-motion", "reduce");
	const outline = dialog.getByRole("button", { name: "占地框" });
	await outline.click();
	await expect(dialog.getByText("440 × 136", { exact: true }).first()).toBeVisible();

	await dialog
		.getByRole("group", { name: "展品状态" })
		.getByRole("button", { name: "加载" })
		.click();
	await expect(dialog.locator("[data-inspector-stage] [aria-busy='true']").first()).toBeVisible();

	await page.keyboard.press("Escape");
	await expect(dialog).toHaveCount(0);
	await expect(plinth).toBeFocused();
	await expect(page).not.toHaveURL(/open=/);
	expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("");
	expect(diagnostics).toEqual([]);
});

test("检视台里展品的浮层先收起，再次 Esc 才离开", async ({ page, context }) => {
	await loadClient(context);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto("/ui?open=dropdown");
	await page.waitForLoadState("networkidle");
	const dialog = page.getByRole("dialog", { name: "下拉面板" });
	const trigger = dialog.getByRole("button", { name: "更多", exact: true });
	await trigger.hover();
	await expect(trigger).toHaveAttribute("aria-expanded", "true");
	await page.keyboard.press("Escape");
	await expect(trigger).toHaveAttribute("aria-expanded", "false");
	await expect(dialog).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(dialog).toHaveCount(0);
	await expect(page.getByRole("button", { name: "走近 下拉面板", exact: true })).toBeFocused();
});

test("用途筛选只保留同类展品，空展厅不显示", async ({ page, context }) => {
	await loadClient(context);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto("/ui");
	await page.waitForLoadState("networkidle");
	await page.getByRole("group", { name: "用途" }).getByRole("button", { name: "浮层" }).click();
	await expect(page).toHaveURL(/category=overlay/);
	await expect(page.getByRole("heading", { level: 2, name: /浮层舞台/ })).toBeVisible();
	await expect(page.getByRole("heading", { level: 2, name: /微件架/ })).toHaveCount(0);
	await expect(page.locator('main [data-exhibit="dropdown"]')).toBeVisible();
	await expect(page.locator('main [data-exhibit="button"]')).toHaveCount(0);
});

test("旧组件库文档与设计系统路径已下线", async ({ request }) => {
	const removedPaths = [
		"/ui/guides/introduction",
		"/ui/guides/architecture",
		"/ui/components",
		"/ui/components/button",
		"/ui/components/dropdown",
		"/design-system",
		"/design-system/guides/introduction",
		"/design-system/specimens/button",
	];
	for (const path of removedPaths) {
		const response = await request.get(path, { maxRedirects: 0 });
		expect(response.status(), path).toBe(404);
	}
});
