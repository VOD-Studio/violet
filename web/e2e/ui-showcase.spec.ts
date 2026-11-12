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
	).toBeGreaterThan(1);
});

test("检视台里每种状态都在占地内", async ({ page, context }) => {
	// 逐件逐态走完全部馆藏，展品多了以后超出默认时限
	test.slow();
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
		// 展品自己也可能陈列对话框，检视台以舞台识别
		const dialog = page
			.getByRole("dialog")
			.filter({ has: page.locator("[data-inspector-stage]") });
		const states = dialog.getByRole("radiogroup", { name: "展品状态" }).getByRole("radio");
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
			const overlays = await dialog.locator("[data-stage]").evaluate((stage) => {
				const box = stage.getBoundingClientRect();
				const outside = (element: Element) => {
					const rect = element.getBoundingClientRect();
					return (
						rect.width > 0 &&
						(rect.left < box.left - 1 ||
							rect.top < box.top - 1 ||
							rect.right > box.right + 1 ||
							rect.bottom > box.bottom + 1)
					);
				};
				const selector = "[data-radix-popper-content-wrapper], [data-sonner-toaster]";
				return {
					escaped: Array.from(stage.querySelectorAll(selector)).filter(outside).length,
					// Portal 到 body 的浮层不随检视台的明暗、季节与减弱动态变化
					leaked: document.querySelectorAll(
						"body > [data-radix-popper-content-wrapper], body > [data-sonner-toaster]",
					).length,
				};
			});
			expect(overlays, `${id} 第 ${index + 1} 种状态的浮层越出占地或挂到了舞台之外`).toEqual({
				escaped: 0,
				leaked: 0,
			});
		}
	}
});

test("检视台可用键盘走近、切换、调整外观并在离开后归还焦点", async ({ page, context }) => {
	await loadClient(context);
	await context.addCookies([{ name: "appearance", value: "dark", url: "http://127.0.0.1:4173" }]);
	await context.addInitScript(() => localStorage.setItem("theme", "dark"));
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
	await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
	await dialog
		.getByRole("radiogroup", { name: "季节" })
		.getByRole("radio", { name: "花朝" })
		.click();
	await dialog
		.getByRole("radiogroup", { name: "明暗" })
		.getByRole("radio", { name: "深色" })
		.click();
	const darkColors = await scope.evaluate((element) => ({
		background: getComputedStyle(element).backgroundColor,
		foreground: getComputedStyle(element).color,
	}));
	await dialog
		.getByRole("radiogroup", { name: "明暗" })
		.getByRole("radio", { name: "浅色" })
		.click();
	await expect
		.poll(() => scope.evaluate((element) => getComputedStyle(element).backgroundColor))
		.not.toBe(darkColors.background);
	await expect
		.poll(() => scope.evaluate((element) => getComputedStyle(element).color))
		.not.toBe(darkColors.foreground);
	await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
	const springBackground = await scope.evaluate(
		(element) => getComputedStyle(element).backgroundColor,
	);
	await dialog
		.getByRole("radiogroup", { name: "季节" })
		.getByRole("radio", { name: "荷风" })
		.click();
	await expect
		.poll(() => scope.evaluate((element) => getComputedStyle(element).backgroundColor))
		.not.toBe(springBackground);
	const reduced = dialog.getByRole("button", { name: "减弱动态" });
	await reduced.click();
	await expect(reduced).toHaveAttribute("aria-pressed", "true");

	await dialog
		.getByRole("radiogroup", { name: "展品状态" })
		.getByRole("radio", { name: "加载" })
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
	await page
		.getByRole("radiogroup", { name: "用途" })
		.getByRole("radio", { name: "浮层" })
		.click();
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

test("头像组悬停时展开，移开收回，减弱动态下直接切换", async ({ page, context }) => {
	await loadClient(context);
	await page.setViewportSize({ width: 1440, height: 900 });
	const widthOf = () =>
		page
			.locator('[role="dialog"] .v-avatar-group')
			.evaluate((group) => group.getBoundingClientRect().width);
	for (const reducedMotion of ["no-preference", "reduce"] as const) {
		await page.emulateMedia({ reducedMotion });
		await page.goto("/ui?open=avatar");
		await page.waitForLoadState("networkidle");
		const dialog = page.getByRole("dialog");
		await dialog
			.getByRole("radiogroup", { name: "展品状态" })
			.getByRole("radio", { name: "一组头像", exact: true })
			.click();
		const collapsed = await widthOf();
		await dialog.locator(".v-avatar-group").hover();
		if (reducedMotion === "reduce") expect(await widthOf()).toBeGreaterThan(collapsed);
		await expect.poll(widthOf, { message: reducedMotion }).toBeGreaterThan(collapsed + 20);
		await page.mouse.move(2, 2);
		await expect.poll(widthOf, { message: reducedMotion }).toBe(collapsed);
	}
});

test("输入框展品选中「悬停」后点击任一格得到真实聚焦样式，而不是悬停演示", async ({
	page,
	context,
}) => {
	await loadClient(context);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto("/ui?open=input");
	await page.waitForLoadState("networkidle");
	const dialog = page.getByRole("dialog").filter({ has: page.locator("[data-inspector-stage]") });
	await dialog
		.getByRole("radiogroup", { name: "展品状态" })
		.getByRole("radio", { name: "悬停", exact: true })
		.click();
	const outline = dialog.getByRole("textbox", { name: "描边输入框", exact: true });
	await outline.click();
	await expect(outline).toBeFocused();
	const shell = outline.locator("..");
	const sheet = await page.evaluate(() => {
		const probe = document.createElement("span");
		probe.style.backgroundColor = "var(--card)";
		document.body.append(probe);
		const value = getComputedStyle(probe).backgroundColor;
		probe.remove();
		return value;
	});
	const style = await shell.evaluate((element) => {
		const computed = getComputedStyle(element);
		return { shadow: computed.boxShadow, background: computed.backgroundColor };
	});
	expect(style.shadow).toContain("0px 0px 0px 4px");
	expect(style.background).toBe(sheet);
});

test("输入框展品的减弱动态作用域内，加载中的细圆弧静止", async ({ page, context }) => {
	await loadClient(context);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto("/ui?open=input&reduced=true");
	await page.waitForLoadState("networkidle");
	const dialog = page.getByRole("dialog").filter({ has: page.locator("[data-inspector-stage]") });
	await dialog
		.getByRole("radiogroup", { name: "展品状态" })
		.getByRole("radio", { name: "加载", exact: true })
		.click();
	const spinner = dialog.locator('[data-slot="input-control"] .v-spinner').first();
	await expect(spinner).toBeVisible();
	const animations = await spinner.evaluate((element) => [
		...element.getAnimations({ subtree: true }).map((animation) => animation.playState),
	]);
	expect(animations).toEqual([]);
});

test("窄宿主中的已修改代码块仍可完整聚焦并运行", async ({ page, context }) => {
	await loadClient(context);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto("/ui?open=code-block");
	const dialog = page.getByRole("dialog").filter({ has: page.locator("[data-inspector-stage]") });
	await dialog.getByRole("radio", { name: "已修改", exact: true }).click();
	const stage = dialog.locator("[data-stage]");
	await expect(stage.getByRole("button", { name: "还原", exact: true })).toBeVisible();
	await stage.evaluate((element) => {
		element.style.width = "342px";
	});
	const block = stage.locator("figure");
	const bounds = await block.boundingBox();
	if (!bounds) throw new Error("代码块没有布局尺寸");
	for (const button of await block.locator("figcaption button").all()) {
		await button.focus();
		await expect(button).toBeFocused();
		const rect = await button.boundingBox();
		if (!rect) throw new Error("代码块按钮没有布局尺寸");
		expect(rect.x).toBeGreaterThanOrEqual(bounds.x);
		expect(rect.x + rect.width).toBeLessThanOrEqual(bounds.x + bounds.width);
	}
	await block.getByRole("button", { name: "运行", exact: true }).press("Enter");
	await expect(block.getByRole("log")).toContainText("[0, 1, 1, 2, 3, 5, 8, 13, 21, 34]");
});

test("代码块的长状态栏只在自身滚动，不横向移走检视台", async ({ page, context }) => {
	await loadClient(context);
	await page.goto("/ui?open=code-block");
	const dialog = page.getByRole("dialog").filter({ has: page.locator("[data-inspector-stage]") });
	for (const width of [390, 1440]) {
		await page.setViewportSize({ width, height: 900 });
		await dialog.getByRole("radio", { name: "内存超限", exact: true }).click();
		const rect = await dialog.boundingBox();
		if (!rect) throw new Error("检视台没有布局尺寸");
		expect(rect.x).toBeGreaterThanOrEqual(0);
		expect(rect.x + rect.width).toBeLessThanOrEqual(width);
		await dialog.getByRole("radio", { name: "阅读", exact: true }).click();
	}
});
