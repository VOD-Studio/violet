import { expect, type Page, test } from "@playwright/test";
import { ROADMAP_FIXTURE } from "./mock-data.mjs";
import { collectDiagnostics, loadClient } from "./support.ts";

const SLUG = ROADMAP_FIXTURE.project.slug;
const completed = ROADMAP_FIXTURE.items.filter((item) => item.stage === "completed");
const itemTitle = (number: number) =>
	ROADMAP_FIXTURE.items.find((item) => item.number === number)?.title ?? "";

const column = (page: Page, name: string) => page.getByRole("group", { name, exact: true });
const cardButton = (page: Page, title: string) =>
	page.getByRole("button", { name: new RegExp(title) });
const idOf = (number: number) =>
	ROADMAP_FIXTURE.items.find((item) => item.number === number)?.id ?? "";
const card = (page: Page, number: number) => page.locator(`[data-card-id="${idOf(number)}"]`);

async function open(page: Page, slug = SLUG) {
	const response = await page.goto(`/projects/${slug}`);
	await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
	return response;
}

test.describe("项目详情页", () => {
	test("头部：标题、简介、技术栈、演示与源码链接、进度概览", async ({ page, context }) => {
		await loadClient(context);
		const diagnostics = collectDiagnostics(page);
		await open(page);

		await expect(page.getByRole("heading", { level: 1, name: "路线图契约项目" })).toBeVisible();
		await expect(page.getByText("用于项目详情页验收的样例项目。")).toBeVisible();
		const stack = page.getByRole("list", { name: "技术栈" });
		await expect(stack.getByRole("listitem")).toHaveText(["Go", "React", "PostgreSQL"]);
		const demo = page.getByRole("link", { name: "演示" });
		await expect(demo).toHaveAttribute("href", "https://example.com/demo");
		await expect(demo).toHaveAttribute("target", "_blank");
		await expect(page.getByRole("link", { name: "源码" })).toHaveAttribute(
			"href",
			"https://github.com/example/roadmap-contract",
		);
		const progress = page.getByRole("progressbar", { name: "已完成占比" });
		await expect(progress).toHaveAttribute("aria-valuenow", "71");
		await expect(page.getByRole("region", { name: "进度概览" })).toContainText(
			"已完成 12 / 17",
		);
		expect(diagnostics).toEqual([]);
	});

	test("画布：三个阶段按序分区，卡片带编号、标题、标签与交付信息", async ({ page, context }) => {
		await loadClient(context);
		await open(page);

		for (const name of ["计划中", "进行中", "已完成"])
			await expect(column(page, name)).toBeVisible();
		const [planned, doing, done] = await Promise.all(
			["计划中", "进行中", "已完成"].map((name) => column(page, name).boundingBox()),
		);
		expect(planned && doing && done).toBeTruthy();
		expect((planned?.x ?? 0) + (planned?.width ?? 0)).toBeLessThanOrEqual(doing?.x ?? 0);
		expect((doing?.x ?? 0) + (doing?.width ?? 0)).toBeLessThanOrEqual(done?.x ?? 0);
		await expect(column(page, "计划中").getByRole("listitem")).toHaveCount(3);
		await expect(column(page, "进行中").getByRole("listitem")).toHaveCount(2);
		const first = column(page, "计划中").getByRole("listitem").first();
		await expect(first).toContainText("#1");
		await expect(first).toContainText("计划中的第一项");
		await expect(first.getByText("+2")).toBeVisible();
		await expect(column(page, "已完成").getByRole("listitem").first()).toContainText(
			"v2.17.0 · 2026-10-20",
		);
		await expect(page.locator(".v-kanban-canvas")).toBeVisible();
	});

	test("已完成阶段默认只显示最近 10 条，数量照实显示，可展开更多再收起", async ({
		page,
		context,
	}) => {
		await loadClient(context);
		await open(page);
		const done = column(page, "已完成");

		await expect(done.getByRole("listitem")).toHaveCount(10);
		await expect(done.locator(".v-kanban__count")).toContainText("12");
		await expect(done.getByText(completed[0].title, { exact: true })).toBeVisible();
		await expect(done.getByText(completed[11].title, { exact: true })).toHaveCount(0);
		const more = done.getByRole("button", { name: "展开更多（还有 2 条）" });
		await expect(more).toHaveAttribute("aria-expanded", "false");

		// 按钮在画布视口之外：键盘聚焦会让画布平移到刚好露出
		await more.focus();
		await expect(more).toBeInViewport();
		await more.click();

		await expect(done.getByRole("listitem")).toHaveCount(12);
		// 焦点交给第一条新露出的卡片，画布随之平移到它
		const firstNew = done.getByRole("button", { name: new RegExp(completed[10].title) });
		await expect(firstNew).toBeFocused();
		await expect(firstNew).toBeInViewport();
		const fold = done.getByRole("button", { name: "收起" });
		await expect(fold).toHaveAttribute("aria-expanded", "true");
		await fold.focus();
		await expect(fold).toBeInViewport();
		await fold.click();
		await expect(done.getByRole("listitem")).toHaveCount(10);
	});

	test("点击条目打开只读详情弹窗：简介、标签、交付版本、完成日期与链接；Esc 关闭并还原焦点", async ({
		page,
		context,
	}) => {
		await loadClient(context);
		const diagnostics = collectDiagnostics(page);
		await open(page);
		const trigger = cardButton(page, "已完成的第 17 项");

		await trigger.click();

		const dialog = page.getByRole("dialog", { name: "已完成的第 17 项" });
		await expect(dialog).toBeVisible();
		await expect(dialog).toContainText("#17 · 已完成");
		await expect(dialog).toContainText("完成后的复盘说明");
		await expect(dialog.getByRole("list", { name: "条目标签" })).toContainText("复盘");
		await expect(dialog).toContainText("交付版本");
		await expect(dialog).toContainText("v2.17.0");
		await expect(dialog).toContainText("2026-10-20");
		const links = dialog.getByRole("list", { name: "关联链接" }).getByRole("link");
		await expect(links).toHaveCount(2);
		await expect(links.first()).toHaveAttribute("href", "https://example.com/release");
		await expect(links.first()).toHaveAttribute("target", "_blank");
		await expect(links.nth(1)).toHaveText("https://example.com/no-label");

		await page.keyboard.press("Escape");

		await expect(dialog).toHaveCount(0);
		await expect(trigger).toBeFocused();
		expect(diagnostics).toEqual([]);
	});

	test("弹窗保留换行的简介，点遮罩也能关闭；计划中的条目没有交付信息", async ({
		page,
		context,
	}) => {
		await loadClient(context);
		await open(page);

		await cardButton(page, "计划中的第一项").click();

		const dialog = page.getByRole("dialog", { name: "计划中的第一项" });
		await expect(dialog).toBeVisible();
		await expect(dialog).not.toContainText("交付版本");
		await expect(dialog).not.toContainText("完成日期");
		const description = dialog.getByText("第一行说明");
		expect(await description.evaluate((node) => getComputedStyle(node).whiteSpace)).toBe(
			"pre-wrap",
		);
		await page.mouse.click(5, 5);
		await expect(dialog).toHaveCount(0);
	});

	test("弹窗只淡入淡出：打开过程中位置与尺寸不变", async ({ page, context }) => {
		await loadClient(context);
		await open(page);
		await page.evaluate(() => {
			const samples: number[][] = [];
			(window as unknown as { __samples: number[][] }).__samples = samples;
			const watch = new MutationObserver(() => {
				const content = document.querySelector('[data-slot="dialog-content"]');
				if (!content) return;
				watch.disconnect();
				const start = performance.now();
				const tick = () => {
					const rect = content.getBoundingClientRect();
					samples.push([rect.left, rect.top, rect.width, rect.height]);
					if (performance.now() - start < 400) requestAnimationFrame(tick);
				};
				tick();
			});
			watch.observe(document.body, { childList: true, subtree: true });
		});

		await cardButton(page, "计划中的第二项").click();
		await expect(page.getByRole("dialog")).toBeVisible();
		await page.waitForTimeout(500);

		const samples = await page.evaluate(
			() => (window as unknown as { __samples: number[][] }).__samples,
		);
		expect(samples.length).toBeGreaterThan(3);
		for (const sample of samples) {
			expect(sample[0]).toBeCloseTo(samples[0][0], 0);
			expect(sample[1]).toBeCloseTo(samples[0][1], 0);
			expect(sample[2]).toBeCloseTo(samples[0][2], 0);
			expect(sample[3]).toBeCloseTo(samples[0][3], 0);
		}
	});

	test("没有条目的项目显示空状态，不显示进度概览", async ({ page, context }) => {
		await loadClient(context);
		await open(page, "roadmap-empty");

		await expect(page.getByRole("heading", { level: 1, name: "空路线图项目" })).toBeVisible();
		await expect(page.getByText("这个项目还没有路线图条目")).toBeVisible();
		await expect(page.getByRole("region", { name: "进度概览" })).toHaveCount(0);
		await expect(page.locator(".v-kanban-canvas")).toHaveCount(0);
	});
});

test.describe("未知 slug 与首屏直出", () => {
	test("未知 slug 返回 404 状态并显示统一的 404 页面", async ({ page, context }) => {
		await loadClient(context);

		const response = await page.goto("/projects/no-such-project");

		expect(response?.status()).toBe(404);
		await expect(page.getByRole("heading", { name: /404/ })).toBeVisible();
		await expect(page.getByText("页面不存在或已被移除。")).toBeVisible();
	});

	test("服务端直出头部、阶段与卡片，不依赖脚本；收起的已完成条目不在 HTML 里", async ({
		request,
	}) => {
		const response = await request.get(`/projects/${SLUG}`);

		expect(response.status()).toBe(200);
		const html = await response.text();
		// 路由状态的序列化 JSON 也在 HTML 里，会带上收起的条目；只看渲染出来的标记
		const markup = html.replace(/<script[\s\S]*?<\/script>/g, "");
		expect(html).toContain("<title>路线图契约项目 · 路线图</title>");
		expect(markup).toContain("路线图契约项目");
		expect(markup).toContain('role="progressbar"');
		for (const title of [itemTitle(1), itemTitle(4), completed[0].title, completed[9].title])
			expect(markup).toContain(title);
		for (const title of [completed[10].title, completed[11].title])
			expect(markup).not.toContain(title);
		for (const stage of ["计划中", "进行中", "已完成"]) expect(markup).toContain(stage);
	});

	test("服务端直出的看板已在最终位置：水合后适应窗口不再挪动它", async ({
		page,
		context,
		browser,
	}) => {
		const viewport = { width: 1280, height: 900 };
		const noScript = await browser.newContext({ javaScriptEnabled: false, viewport });
		let before: { x: number; y: number; width: number } | null;
		try {
			await loadClient(noScript);
			const serverPage = await noScript.newPage();
			await serverPage.goto(`http://127.0.0.1:4173/projects/${SLUG}`);
			before = await column(serverPage, "计划中").boundingBox();
		} finally {
			await noScript.close();
		}

		await page.setViewportSize(viewport);
		await loadClient(context);
		await open(page);
		// 关系线只在客户端测量绘制：出现时画布已经按窗口适应过
		await expect(page.locator(".v-kanban__relation").first()).toBeAttached();
		const after = await column(page, "计划中").boundingBox();
		if (!before || !after) throw new Error("column is not visible");
		expect(Math.abs(after.x - before.x)).toBeLessThan(1);
		expect(Math.abs(after.y - before.y)).toBeLessThan(1);
		expect(Math.abs(after.width - before.width)).toBeLessThan(1);
	});

	test("未知 slug 的 HTML 也是 404", async ({ request }) => {
		const response = await request.get("/projects/no-such-project");

		expect(response.status()).toBe(404);
	});
});

test.describe("窗口重新聚焦", () => {
	test("重新聚焦时重新拉取，界面显示最新的条目", async ({ page, context }) => {
		await loadClient(context);
		await open(page);
		let requests = 0;
		let renamed = false;
		await context.route(`**/api/v1/projects/by-slug/${SLUG}/roadmap`, async (route) => {
			requests += 1;
			const response = await route.fetch({
				url: `http://127.0.0.1:9410/api/v1/projects/by-slug/${SLUG}/roadmap`,
			});
			if (!renamed) return route.fulfill({ response });
			const body = await response.json();
			body.data.items[1].title = "聚焦后改名的条目";
			return route.fulfill({ response, json: body });
		});
		await expect(cardButton(page, "计划中的第二项")).toBeVisible();

		renamed = true;
		await page.evaluate(() => {
			// TanStack Query 的焦点管理只认 visibilitychange
			for (const state of ["hidden", "visible"]) {
				Object.defineProperty(document, "visibilityState", {
					configurable: true,
					value: state,
				});
				document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
			}
		});

		await expect(cardButton(page, "聚焦后改名的条目")).toBeVisible();
		expect(requests).toBeGreaterThanOrEqual(1);
	});
});

test.describe("明暗与动效偏好", () => {
	test("暗色模式：看板与卡片跟随站点暗色", async ({ page, context }) => {
		await loadClient(context);
		const diagnostics = collectDiagnostics(page);
		await context.addInitScript(() => localStorage.setItem("theme", "dark"));
		await open(page);

		await expect(page.locator("html")).toHaveClass(/dark/);
		const style = await page
			.locator(".v-kanban-canvas .v-kanban__card")
			.first()
			.evaluate((node) => {
				const board = node.closest(".v-kanban") as HTMLElement;
				// 计算值可能是 oklch() 等现代色彩语法：画到 1×1 画布上取 sRGB 像素再比较
				const toRgb = (css: string) => {
					const context = document.createElement("canvas").getContext("2d");
					if (!context) throw new Error("no 2d context");
					context.fillStyle = css;
					context.fillRect(0, 0, 1, 1);
					return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
				};
				return {
					scheme: getComputedStyle(board).colorScheme,
					background: toRgb(getComputedStyle(node).backgroundColor),
					text: toRgb(getComputedStyle(node).color),
				};
			});
		expect(style.scheme).toBe("dark");
		// 暗色卡片是深色底、浅色字
		expect(Math.max(...style.background)).toBeLessThan(80);
		expect(Math.min(...style.text)).toBeGreaterThan(150);
		expect(diagnostics).toEqual([]);
	});

	test("偏好减弱动态：画布的缩放过渡关闭，弹窗与展开仍正常，控制台无错误", async ({
		page,
		context,
	}) => {
		await loadClient(context);
		const diagnostics = collectDiagnostics(page);
		await page.emulateMedia({ reducedMotion: "reduce" });
		await open(page);

		const duration = () =>
			page
				.locator(".v-kanban-canvas__content")
				.evaluate((node) => getComputedStyle(node).transitionDuration);
		await page.getByRole("button", { name: "放大" }).click();
		expect(await duration()).toBe("0s");
		await cardButton(page, "计划中的第三项").click();
		await expect(page.getByRole("dialog", { name: "计划中的第三项" })).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(page.getByRole("dialog")).toHaveCount(0);
		const more = column(page, "已完成").getByRole("button", { name: /展开更多/ });
		await more.focus();
		await more.click();
		await expect(column(page, "已完成").getByRole("listitem")).toHaveCount(12);
		expect(diagnostics).toEqual([]);
	});

	test("正常动态下画布的缩放过渡是 200ms", async ({ page, context }) => {
		await loadClient(context);
		await open(page);

		await page.getByRole("button", { name: "放大" }).click();

		const duration = await page
			.locator(".v-kanban-canvas__content")
			.evaluate((node) => getComputedStyle(node).transitionDuration);
		expect(duration).toBe("0.2s");
	});
});

test.describe("窄屏（390px）", () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test("改用阶段切换器，一次显示一个阶段，页面没有横向溢出", async ({ page, context }) => {
		await loadClient(context);
		const diagnostics = collectDiagnostics(page);
		await open(page);

		const tabs = page.getByRole("tablist", { name: "切换列" });
		await expect(tabs).toBeVisible();
		await expect(page.locator(".v-kanban-canvas")).toHaveCount(0);
		// 卡片按钮的名字以 #编号 开头；关系标记（跳转按钮）的名字不是
		const card = (title: string) => cardButton(page, `^#\\d+ ${title}`);
		await expect(card("计划中的第一项")).toBeVisible();
		await expect(card("进行中的第一项")).toHaveCount(0);
		await tabs.getByRole("tab", { name: /进行中/ }).click();
		await expect(card("进行中的第一项")).toBeVisible();
		await card("进行中的第一项").click();
		await expect(page.getByRole("dialog", { name: "进行中的第一项" })).toBeVisible();
		await page.keyboard.press("Escape");
		const overflow = await page.evaluate(
			() =>
				Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) -
				window.innerWidth,
		);
		expect(overflow).toBeLessThanOrEqual(0);
		expect(diagnostics).toEqual([]);
	});

	test("已完成显示真实总数，可展开全部再收起", async ({ page, context }) => {
		await loadClient(context);
		const diagnostics = collectDiagnostics(page);
		await open(page);
		const doneTab = page.getByRole("tab", { name: /已完成/ });
		await expect(doneTab).toContainText("12");

		await doneTab.click();
		const panel = page.getByRole("tabpanel");
		await expect(panel.getByRole("listitem")).toHaveCount(10);

		const more = panel.getByRole("button", { name: "展开更多（还有 2 条）" });
		await more.scrollIntoViewIfNeeded();
		await more.click();

		await expect(panel.getByRole("listitem")).toHaveCount(12);
		await expect(
			card(page, completed[10].number).getByRole("button", { name: /^#\d+/ }),
		).toBeFocused();
		await expect(doneTab).toHaveAttribute("aria-selected", "true");

		const fold = panel.getByRole("button", { name: "收起" });
		await fold.scrollIntoViewIfNeeded();
		await fold.click();
		await expect(panel.getByRole("listitem")).toHaveCount(10);
		expect(diagnostics).toEqual([]);
	});

	test("窄宽切换保留当前阶段与已完成阶段的展开状态", async ({ page, context }) => {
		await loadClient(context);
		await open(page);
		await page.getByRole("tab", { name: /进行中/ }).click();
		await expect(card(page, 4)).toBeVisible();

		await page.getByRole("tab", { name: /已完成/ }).click();
		const panel = page.getByRole("tabpanel");
		const more = panel.getByRole("button", { name: /展开更多/ });
		await more.scrollIntoViewIfNeeded();
		await more.click();
		await expect(panel.getByRole("listitem")).toHaveCount(12);

		await page.setViewportSize({ width: 1280, height: 900 });
		await expect(page.locator(".v-kanban-canvas")).toBeVisible();
		await expect(column(page, "已完成").getByRole("listitem")).toHaveCount(12);

		await page.setViewportSize({ width: 390, height: 844 });
		await expect(page.getByRole("tab", { name: /已完成/ })).toHaveAttribute(
			"aria-selected",
			"true",
		);
		await expect(page.getByRole("tabpanel").getByRole("listitem")).toHaveCount(12);
	});

	test("条目弹窗完整落在 390px 视口里，Esc 关闭后焦点回到卡片", async ({ page, context }) => {
		await loadClient(context);
		const diagnostics = collectDiagnostics(page);
		await open(page);
		await page.getByRole("tab", { name: /已完成/ }).click();
		const trigger = card(page, 17).getByRole("button", { name: /^#17 / });
		await trigger.scrollIntoViewIfNeeded();
		await trigger.click();

		const dialog = page.getByRole("dialog", { name: "已完成的第 17 项" });
		await expect(dialog).toBeVisible();
		const box = await dialog.boundingBox();
		expect(box).not.toBeNull();
		expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
		expect(box?.y ?? -1).toBeGreaterThanOrEqual(0);
		expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390);
		expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(844);
		await expect(dialog.getByRole("button", { name: "Close" })).toBeVisible();
		await expect(
			dialog.getByRole("link", { name: "https://example.com/no-label" }),
		).toBeVisible();

		await page.keyboard.press("Escape");

		await expect(dialog).toHaveCount(0);
		await expect(trigger).toBeFocused();
		expect(diagnostics).toEqual([]);
	});

	test("关系标记可用键盘激活，跳到目标阶段后焦点落在目标卡片上", async ({ page, context }) => {
		await loadClient(context);
		await open(page);
		const marker = card(page, 2).getByRole("button", { name: /被阻塞 #4 进行中的第一项/ });

		await marker.focus();
		await page.keyboard.press("Enter");

		await expect(page.getByRole("tab", { name: /进行中/ })).toHaveAttribute(
			"aria-selected",
			"true",
		);
		await expect(card(page, 4)).toBeFocused();
	});
});
