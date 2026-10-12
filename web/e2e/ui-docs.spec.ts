import { existsSync } from "node:fs";
import { join } from "node:path";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";

const CLIENT_DIR = join(import.meta.dirname, "..", "dist", "client");

async function loadClient(context: BrowserContext) {
	// 生产 SSR 入口不伺服静态文件；直接加载本次构建产物，文档 HTML 仍由真实路由应答。
	await context.route("**/assets/**", async (route) => {
		const path = join(CLIENT_DIR, new URL(route.request().url()).pathname);
		if (existsSync(path)) await route.fulfill({ path });
		else await route.continue();
	});
	await context.route("**/api/**", async (route) => {
		const url = new URL(route.request().url());
		const response = await route.fetch({
			url: `http://127.0.0.1:9410${url.pathname}${url.search}`,
		});
		await route.fulfill({ response });
	});
}

function collectDiagnostics(page: Page) {
	const diagnostics: string[] = [];
	page.on("pageerror", (error) => diagnostics.push(error.message));
	page.on("console", (message) => {
		const text = message.text();
		const source = message.location().url;
		// 匿名身份探活返回 401；只排除该响应的浏览器资源提示。
		if (
			message.type() === "error" &&
			source === "http://127.0.0.1:4173/api/v1/auth/me" &&
			text ===
				"Failed to load resource: the server responded with a status of 401 (Unauthorized)"
		) {
			return;
		}
		if (
			message.type() === "error" ||
			/same key|duplicate key|hydration|hydrated|uncaught/i.test(text)
		) {
			diagnostics.push(`${source}: ${text}`);
		}
	});
	return diagnostics;
}

async function expectNoOverflow(page: Page) {
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) -
					window.innerWidth,
			),
		)
		.toBeLessThanOrEqual(0);
}

function pauseExit(element: Element) {
	const observer = new MutationObserver(() => {
		if (
			element.getAttribute("data-state") === "closed" &&
			element.getAttribute("data-handoff") === "true"
		) {
			for (const animation of element.getAnimations()) animation.pause();
			observer.disconnect();
		}
	});
	observer.observe(element, {
		attributes: true,
		attributeFilter: ["data-state", "data-handoff"],
	});
}

test("组件库文档提供独立导航和可运行的组件示例", async ({ page, context }, testInfo) => {
	await loadClient(context);
	const diagnostics = collectDiagnostics(page);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto("/ui");
	await expect(page).toHaveURL(/\/ui\/guides\/introduction$/);
	await expect(page.getByRole("heading", { level: 1, name: "介绍" })).toBeVisible();
	await page.waitForLoadState("networkidle");
	const navigation = page.getByRole("navigation", { name: "组件库文档目录" });
	await expect(navigation).toBeVisible();
	await expect(navigation.getByText(/^@?violet\/ui$/i)).toBeVisible();
	await page.screenshot({ path: testInfo.outputPath("ui-docs-desktop.png"), fullPage: true });
	await navigation.getByRole("link", { name: "组件目录", exact: true }).click();
	await expect(page).toHaveURL(/\/ui\/components\/?$/);
	await expect(page.getByRole("heading", { level: 1, name: "组件", exact: true })).toBeVisible();
	await page.screenshot({
		path: testInfo.outputPath("ui-components-desktop.png"),
		fullPage: true,
	});
	await page.locator('article a[href="/ui/components/button"]').click();
	await expect(page.getByRole("heading", { level: 1, name: "Button 按钮" })).toBeVisible();
	await page.getByRole("button", { name: "已点击 0 次", exact: true }).click();
	const button = page.getByRole("button", { name: "已点击 1 次", exact: true });
	await expect(button).toBeVisible();
	const buttonExample = page.locator("[data-toc-ignore]").filter({ has: button });
	await buttonExample.getByRole("button", { name: "展开代码", exact: true }).click();
	const buttonCodeToggle = buttonExample.getByRole("button", {
		name: /^(展开|收起)代码$/,
	});
	await expect(buttonCodeToggle).toHaveAttribute("aria-expanded", "true");
	await buttonCodeToggle.click();
	await expect(buttonCodeToggle).toHaveAttribute("aria-expanded", "false");
	await navigation.getByRole("link", { name: "组件目录", exact: true }).click();
	await page.locator('article a[href="/ui/components/checkbox"]').click();
	await expect(
		page.getByRole("heading", { level: 1, name: "Checkbox", exact: true }),
	).toBeVisible();
	const checkbox = page.getByRole("checkbox", { name: /已阅读并同意服务协议/ });
	await expect(checkbox).not.toBeChecked();
	await checkbox.press("Space");
	await expect(checkbox).toBeChecked();
	const checkboxExample = page.locator("[data-toc-ignore]").filter({ has: checkbox });
	await checkboxExample.getByRole("button", { name: "展开代码", exact: true }).click();
	const checkboxCodeToggle = checkboxExample.getByRole("button", {
		name: /^(展开|收起)代码$/,
	});
	await expect(checkboxCodeToggle).toHaveAttribute("aria-expanded", "true");
	await checkboxCodeToggle.click();
	await expect(checkboxCodeToggle).toHaveAttribute("aria-expanded", "false");
	await page.waitForLoadState("networkidle");
	expect(diagnostics).toEqual([]);
});

test("旧设计系统根路径和章节已下线", async ({ request }) => {
	const removedPaths = [
		"/design-system",
		"/design-system/",
		"/design-system/guides/introduction",
		"/design-system/principles",
		"/design-system/decisions",
		"/design-system/palette",
		"/design-system/tokens",
		"/design-system/layout",
		"/design-system/motion",
		"/design-system/specimens",
		"/design-system/specimens/button",
		"/design-system/specimens/badge",
		"/design-system/specimens/checkbox",
		"/design-system/specimens/dialog",
		"/design-system/specimens/tabs",
		"/design-system/specimens/input",
		"/design-system/specimens/text-field",
		"/design-system/specimens/comment-section",
		"/design-system/specimens/cartoon-popover",
	];
	for (const path of removedPaths) {
		let response = await request.get(path, { maxRedirects: 0 });
		if (path.endsWith("/") && response.status() === 307) {
			const canonical = path.slice(0, -1);
			expect(response.headers().location, path).toBe(canonical);
			response = await request.get(canonical, { maxRedirects: 0 });
		}
		expect(response.status(), path).toBe(404);
	}
});

test("窄屏减弱动态下文档目录支持键盘和导航关闭", async ({ page, context }, testInfo) => {
	await loadClient(context);
	const diagnostics = collectDiagnostics(page);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto("/ui");
	await expect(page).toHaveURL(/\/ui\/guides\/introduction$/);
	await page.waitForLoadState("networkidle");
	const directory = page
		.locator("details")
		.filter({ has: page.locator("summary", { hasText: /^目录/ }) });
	const summary = directory.locator("summary");
	await expect(summary).toBeVisible();
	await expect(directory).not.toHaveAttribute("open", "");
	await expectNoOverflow(page);
	await summary.focus();
	await summary.press("Enter");
	await expect(directory).toHaveAttribute("open", "");
	await expect(directory.getByRole("navigation", { name: "组件库文档目录" })).toBeVisible();
	await expectNoOverflow(page);
	await page.screenshot({
		path: testInfo.outputPath("ui-docs-mobile-directory.png"),
		fullPage: true,
	});
	await summary.press("Space");
	await expect(directory).not.toHaveAttribute("open", "");
	await summary.press("Enter");
	const introduction = directory.getByRole("link", { name: "介绍", exact: true });
	await introduction.focus();
	await introduction.press("Escape");
	await expect(directory).not.toHaveAttribute("open", "");
	await expect(summary).toBeFocused();
	await summary.press("Enter");
	await directory.getByRole("link", { name: "快速入门", exact: true }).click();
	await expect(page).toHaveURL(/\/ui\/guides\/quick-start$/);
	await expect(page.getByRole("heading", { level: 1, name: "快速入门" })).toBeVisible();
	await expect(directory).not.toHaveAttribute("open", "");
	await expectNoOverflow(page);
	await page.waitForLoadState("networkidle");
	expect(diagnostics).toEqual([]);
});

test("Dropdown 关闭中重入立即续开，不经过完全收起的帧", async ({ page, context }) => {
	await loadClient(context);
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto("/ui/components/dropdown");
	await page.waitForLoadState("networkidle");
	const trigger = page.getByRole("button", { name: "向上展开", exact: true });
	await trigger.hover();
	await expect(trigger).toHaveAttribute("aria-expanded", "true");
	const contentId = await trigger.getAttribute("aria-controls");
	if (!contentId) throw new Error("展开的 Dropdown 缺少面板关联");
	const content = page.locator(`[id="${contentId}"]`);
	await expect(content).toBeVisible();
	await expect
		.poll(() =>
			content.evaluate((element) =>
				element.getAnimations().some((a) => a.playState === "running"),
			),
		)
		.toBe(false);

	await page.mouse.move(1300, 800);
	await expect(trigger).toHaveAttribute("aria-expanded", "false");
	await content.evaluate((element) => {
		const closing = element
			.getAnimations()
			.find(
				(animation) =>
					animation.effect instanceof KeyframeEffect &&
					animation.effect.getKeyframes().some((frame) => "clipPath" in frame),
			);
		if (!closing?.effect) throw new Error("关闭期间没有可续接的裁剪动画");
		closing.pause();
		closing.currentTime = Number(closing.effect.getComputedTiming().duration) / 2;
	});

	const visibleHeight = () =>
		content.evaluate((element) => {
			const rect = element.getBoundingClientRect();
			let visible = 0;
			for (let y = Math.ceil(rect.top); y < rect.bottom; y++) {
				const hit = document.elementFromPoint(rect.left + rect.width / 2, y);
				if (hit && element.contains(hit)) visible++;
			}
			return visible;
		});
	const before = await visibleHeight();
	expect(before).toBeGreaterThan(0);
	await trigger.hover();
	await page.evaluate(
		() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
	);
	expect(await trigger.getAttribute("aria-expanded")).toBe("true");
	expect(await visibleHeight()).toBeGreaterThanOrEqual(before - 2);
	await expect.poll(visibleHeight).toBeGreaterThan(before);
	await page.mouse.move(1300, 800);
	await expect(content).toHaveCount(0);
});

test("Dropdown 同方向接力后的旧面板不再截获新面板的悬停", async ({ page, context }) => {
	await loadClient(context);
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto("/ui/components/dropdown");
	await page.waitForLoadState("networkidle");
	const navigation = page.getByRole("navigation", { name: "Dropdown 示例" });
	const guide = navigation.getByRole("link", { name: "指南", exact: true });
	const more = navigation.getByRole("button", { name: "更多", exact: true });
	await guide.hover();
	await expect(guide).toHaveAttribute("aria-expanded", "true");
	const sourceId = await guide.getAttribute("aria-controls");
	if (!sourceId) throw new Error("指南面板缺少关联");
	const source = page.locator(`[id="${sourceId}"]`);
	await expect
		.poll(() =>
			source.evaluate((element) =>
				element.getAnimations().some((a) => a.playState === "running"),
			),
		)
		.toBe(false);
	await source.evaluate(pauseExit);
	await more.hover();
	await expect(more).toHaveAttribute("aria-expanded", "true");
	const destinationId = await more.getAttribute("aria-controls");
	if (!destinationId) throw new Error("更多面板缺少关联");
	const destination = page.locator(`[id="${destinationId}"]`);
	const point = await destination.evaluate((element) => {
		for (const animation of element.getAnimations()) animation.pause();
		const rect = element.getBoundingClientRect();
		return { x: rect.left + rect.width / 2, y: rect.top + 20 };
	});
	await page.mouse.move(point.x, point.y);
	await page.evaluate(
		() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
	);
	expect(await guide.getAttribute("aria-expanded")).toBe("false");
	expect(await more.getAttribute("aria-expanded")).toBe("true");
	expect(
		await destination.evaluate((element, point) => {
			const hit = document.elementFromPoint(point.x, point.y);
			return hit !== null && element.contains(hit);
		}, point),
	).toBe(true);
	await source.evaluate((element) => {
		for (const animation of element.getAnimations()) animation.play();
	});
	await destination.evaluate((element) => {
		for (const animation of element.getAnimations()) animation.play();
	});
	await expect(source).toHaveCount(0);
	await expect(more).toHaveAttribute("aria-expanded", "true");
});

test("Dropdown 关闭期间开启减弱动态会立即释放面板", async ({ page, context }) => {
	await loadClient(context);
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto("/ui/components/dropdown");
	await page.waitForLoadState("networkidle");
	const trigger = page.getByRole("button", { name: "向上展开", exact: true });
	await trigger.hover();
	await expect(trigger).toHaveAttribute("aria-expanded", "true");
	const contentId = await trigger.getAttribute("aria-controls");
	if (!contentId) throw new Error("展开的 Dropdown 缺少面板关联");
	const content = page.locator(`[id="${contentId}"]`);
	await page.mouse.move(1300, 800);
	await expect(trigger).toHaveAttribute("aria-expanded", "false");
	await content.evaluate((element) => {
		for (const animation of element.getAnimations()) animation.pause();
	});
	await page.emulateMedia({ reducedMotion: "reduce" });
	await expect(content).toHaveCount(0);
	await trigger.hover();
	await expect(trigger).toHaveAttribute("aria-expanded", "true");
	expect(await content.evaluate((element) => element.getAnimations().length)).toBe(0);
	await page.mouse.move(1300, 800);
	await expect(content).toHaveCount(0);
});

test("Dropdown 播放中碰撞翻转后沿实际方位裁剪，不重启动画", async ({ page, context }) => {
	await loadClient(context);
	await page.setViewportSize({ width: 1440, height: 1000 });
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto("/ui/components/dropdown");
	await page.waitForLoadState("networkidle");
	const trigger = page
		.getByRole("navigation", { name: "Dropdown 示例" })
		.getByRole("link", { name: "指南", exact: true });
	await trigger.hover();
	await expect(trigger).toHaveAttribute("aria-expanded", "true");
	const contentId = await trigger.getAttribute("aria-controls");
	if (!contentId) throw new Error("指南面板缺少关联");
	const content = page.locator(`[id="${contentId}"]`);
	await expect(content).toHaveAttribute("data-side", "bottom");
	await content.evaluate((element) => {
		const animation = element
			.getAnimations()
			.find(
				(animation) =>
					animation.effect instanceof KeyframeEffect &&
					animation.effect.getKeyframes().some((frame) => "clipPath" in frame),
			);
		if (!animation?.effect) throw new Error("展开期间没有裁剪动画");
		animation.pause();
		animation.currentTime = Number(animation.effect.getComputedTiming().duration) / 2;
	});
	const visibleEnds = () =>
		content.evaluate((element) => {
			const rect = element.getBoundingClientRect();
			const hit = (y: number) => {
				const target = document.elementFromPoint(rect.left + rect.width / 2, y);
				return target !== null && element.contains(target);
			};
			return {
				upper: hit(rect.top + rect.height * 0.2),
				lower: hit(rect.bottom - rect.height * 0.2),
			};
		});
	expect(await visibleEnds()).toEqual({ upper: true, lower: false });
	const bottom = await trigger.evaluate((element) => element.getBoundingClientRect().bottom);
	await page.setViewportSize({ width: 1440, height: Math.ceil(bottom + 110) });
	await expect(content).toHaveAttribute("data-side", "top");
	expect(await visibleEnds()).toEqual({ upper: false, lower: true });
	await content.evaluate((element) => {
		for (const animation of element.getAnimations()) animation.play();
	});
	await page.mouse.move(1300, 50);
	await expect(content).toHaveCount(0);
});

test("Dropdown 变形中跨方向快速折返后回到当前锚点，不保留暂停的旧几何", async ({
	page,
	context,
}) => {
	await loadClient(context);
	await page.setViewportSize({ width: 1440, height: 1000 });
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto("/ui/components/dropdown");
	await page.waitForLoadState("networkidle");
	const navigation = page.getByRole("navigation", { name: "Dropdown 示例" });
	const guide = navigation.getByRole("link", { name: "指南", exact: true });
	const more = navigation.getByRole("button", { name: "更多", exact: true });
	await guide.hover();
	await expect(guide).toHaveAttribute("aria-expanded", "true");
	await more.hover();
	await expect(more).toHaveAttribute("aria-expanded", "true");
	const contentId = await more.getAttribute("aria-controls");
	if (!contentId) throw new Error("更多面板缺少关联");
	const content = page.locator(`[id="${contentId}"]`);
	await content.evaluate((element) => {
		const morph = element
			.getAnimations()
			.find(
				(animation) =>
					animation.effect instanceof KeyframeEffect &&
					animation.effect.getKeyframes().some((frame) => "transform" in frame),
			);
		if (!morph?.effect) throw new Error("接力期间没有几何动画");
		morph.pause();
		morph.currentTime = Number(morph.effect.getComputedTiming().duration) / 2;
	});
	await content.evaluate(pauseExit);
	await guide.hover();
	await expect(guide).toHaveAttribute("aria-expanded", "true");
	const guideId = await guide.getAttribute("aria-controls");
	if (!guideId) throw new Error("指南面板缺少关联");
	const guideContent = page.locator(`[id="${guideId}"]`);
	const bottom = await guide.evaluate((element) => element.getBoundingClientRect().bottom);
	await page.setViewportSize({ width: 1440, height: Math.ceil(bottom + 120) });
	await expect(guideContent).toHaveAttribute("data-side", "top");
	await expect(content).toHaveAttribute("data-side", "bottom");
	await more.hover();
	await expect(more).toHaveAttribute("aria-expanded", "true");
	await expect(content).toHaveAttribute("data-side", "bottom");
	await expect
		.poll(async () => {
			const anchor = await more.boundingBox();
			const panel = await content.boundingBox();
			if (!anchor || !panel) return Infinity;
			return Math.abs(panel.x - anchor.x);
		})
		.toBeLessThan(1);
	await page.mouse.move(1300, 50);
	await expect(content).toHaveCount(0);
});
