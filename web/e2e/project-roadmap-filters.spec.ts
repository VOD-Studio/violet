import { expect, type Page, test } from "@playwright/test";
import { ROADMAP_FIXTURE } from "./mock-data.mjs";
import { authenticated, collectDiagnostics, loadClient } from "./support.ts";

const SLUG = ROADMAP_FIXTURE.project.slug;
const PATH = `/projects/${SLUG}`;
const FILTER_NOTICE = "不匹配的条目已淡化，位置保持不变";
const ADMIN_NOTICE = "筛选生效中，不能拖动卡片。清除筛选后再试。";
const item = (number: number) => {
	const result = ROADMAP_FIXTURE.items.find((entry) => entry.number === number);
	if (!result) throw new Error(`missing roadmap fixture #${number}`);
	return result;
};
const cards = (page: Page) => page.locator("li[data-card-id]");
const card = (page: Page, number: number) => page.locator(`li[data-card-id="${item(number).id}"]`);
const trigger = (page: Page, number: number) =>
	card(page, number).getByRole("button", { name: new RegExp(`^#${number} `) });
const search = (page: Page) => page.getByRole("searchbox", { name: "搜索条目", exact: true });
const tags = (page: Page) => page.getByRole("combobox", { name: "条目标签筛选", exact: true });
const done = (page: Page) => page.getByRole("group", { name: "已完成", exact: true });
const count = (page: Page, matched: number) =>
	page.getByRole("status").filter({ hasText: `匹配 ${matched} / 17 条` });

async function open(page: Page, query = "") {
	const response = await page.goto(`${PATH}${query}`);
	expect(response?.status()).toBe(200);
	await expect(
		page.getByRole("heading", { level: 1, name: ROADMAP_FIXTURE.project.title }),
	).toBeVisible();
	await expect(search(page)).toBeVisible();
	return response;
}

async function selectTag(page: Page, name: string) {
	await tags(page).click();
	await page.getByRole("option", { name, exact: true }).click();
	await expect(tags(page)).toContainText(name);
}

async function expectMatches(page: Page, numbers: number[]) {
	await expect(count(page, numbers.length)).toBeVisible();
	const ids = numbers.map((number) => item(number).id);
	await expect
		.poll(() =>
			cards(page).evaluateAll((nodes) =>
				nodes
					.filter((node) => node.getAttribute("data-dimmed") !== "true")
					.map((node) => node.getAttribute("data-card-id")),
			),
		)
		.toEqual(ids);
}

async function layout(page: Page) {
	return cards(page).evaluateAll((nodes) =>
		nodes.map((node) => {
			const board = node.closest(".v-kanban");
			if (!board) throw new Error("card has no board");
			const origin = board.getBoundingClientRect();
			const rect = node.getBoundingClientRect();
			return {
				id: node.getAttribute("data-card-id"),
				column: node.closest('[role="group"]')?.getAttribute("aria-label"),
				x: rect.x - origin.x,
				y: rect.y - origin.y,
				width: rect.width,
				height: rect.height,
			};
		}),
	);
}

async function stableLayout(page: Page) {
	await page.evaluate(() => document.fonts.ready.then(() => undefined));
	let previous = await layout(page);
	await expect
		.poll(
			async () => {
				const current = await layout(page);
				const settled =
					current.length === previous.length &&
					current.every((entry, index) => {
						const prior = previous[index];
						return (
							entry.id === prior.id &&
							(["x", "y", "width", "height"] as const).every(
								(key) => Math.abs(entry[key] - prior[key]) < 0.5,
							)
						);
					});
				previous = current;
				return settled;
			},
			{ intervals: [100, 100, 150] },
		)
		.toBe(true);
	return previous;
}

function expectSameLayout(
	before: Awaited<ReturnType<typeof layout>>,
	after: Awaited<ReturnType<typeof layout>>,
) {
	expect(after.map(({ id, column }) => ({ id, column }))).toEqual(
		before.map(({ id, column }) => ({ id, column })),
	);
	for (const [index, entry] of after.entries()) {
		for (const key of ["x", "y", "width", "height"] as const)
			expect(Math.abs(entry[key] - before[index][key])).toBeLessThanOrEqual(1);
	}
}

test.describe("路线图筛选", () => {
	test.beforeEach(async ({ context }) => {
		await loadClient(context);
	});

	test("关键词搜索标题和多行简介，忽略首尾空白，纯空白不启用筛选", async ({ page }) => {
		const diagnostics = collectDiagnostics(page);
		await open(page);
		await expect(page.getByRole("button", { name: "清除筛选", exact: true })).toHaveCount(0);

		await search(page).fill("  计划中的第一项  ");
		await expectMatches(page, [1]);
		await expect(page.getByText(FILTER_NOTICE)).toBeVisible();
		await search(page).fill("  第二行说明  ");
		await expectMatches(page, [1]);
		await search(page).fill("复盘说明");
		await expectMatches(page, [17]);
		await search(page).fill("17");
		await expectMatches(page, [17]);

		await search(page).fill("   ");
		await expect(page.locator('li[data-dimmed="true"]')).toHaveCount(0);
		await expect(page.getByRole("button", { name: "清除筛选", exact: true })).toHaveCount(0);
		await expect(page.getByText(FILTER_NOTICE)).toHaveCount(0);
		expect(diagnostics).toEqual([]);
	});

	test("英文标题和简介均大小写不敏感，标签精确匹配并与关键词取交集", async ({
		page,
		context,
	}) => {
		await context.route(`**/api/v1/projects/by-slug/${SLUG}/roadmap`, async (route) => {
			const response = await route.fetch({
				url: `http://127.0.0.1:9410/api/v1/projects/by-slug/${SLUG}/roadmap`,
			});
			const body = await response.json();
			body.data.items.find((entry: { number: number }) => entry.number === 2).description =
				"Canvas renderer";
			body.data.items.find((entry: { number: number }) => entry.number === 2).tags = [
				"性能优化",
				"全部标签",
			];
			body.data.items.find((entry: { number: number }) => entry.number === 3).title =
				"CANVAS adapter";
			await route.fulfill({ response, json: body });
		});
		await open(page);
		// 首屏来自真实 SSR 夹具；通过客户端重新拉取后再验证本场景的数据。
		await page.evaluate(() => {
			for (const state of ["hidden", "visible"]) {
				Object.defineProperty(document, "visibilityState", {
					configurable: true,
					value: state,
				});
				document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
			}
		});
		await expect(card(page, 3)).toContainText("CANVAS adapter");

		await search(page).fill("  cAnVaS  ");
		await expectMatches(page, [2, 3]);
		await selectTag(page, "性能优化");
		await expectMatches(page, [2]);
		await selectTag(page, "性能");
		await expectMatches(page, []);
		await page.getByRole("button", { name: "清除输入", exact: true }).click();
		await expectMatches(page, [1]);
		await selectTag(page, "后端");
		await expectMatches(page, [4]);
		await tags(page).click();
		const allNamedOptions = page.getByRole("option", { name: "全部标签", exact: true });
		await expect(allNamedOptions).toHaveCount(2);
		await allNamedOptions.last().click();
		await expectMatches(page, [2]);
		await expect(page).toHaveURL((url) => url.searchParams.get("tag") === "全部标签");
		await tags(page).click();
		await allNamedOptions.first().click();
		await expect(page.locator('li[data-dimmed="true"]')).toHaveCount(0);
	});

	test("未命中时所有卡片实际淡化而不移除、不换列、不改变顺序和几何，清除后恢复", async ({
		page,
	}) => {
		await open(page);
		await search(page).fill("第一项");
		await expectMatches(page, [1, 4]);
		const before = await stableLayout(page);
		expect(before).toHaveLength(15);

		await search(page).fill("不存在的路线图条目");
		await expectMatches(page, []);
		await expect(page.locator('li[data-dimmed="true"]')).toHaveCount(15);
		await expect
			.poll(() =>
				cards(page).evaluateAll((nodes) =>
					nodes.every((node) => {
						const content = node.querySelector("button");
						return content !== null && Number(getComputedStyle(content).opacity) < 1;
					}),
				),
			)
			.toBe(true);
		expectSameLayout(before, await stableLayout(page));
		await expect(done(page).getByRole("listitem")).toHaveCount(10);
		await expect(done(page).locator(".v-kanban__count")).toContainText("12");

		await page.getByRole("button", { name: "清除筛选", exact: true }).click();
		await expect(search(page)).toHaveValue("");
		await expect(tags(page)).toContainText("全部标签");
		await expect(page.locator("li[data-dimmed]")).toHaveCount(0);
		await expect
			.poll(() =>
				cards(page).evaluateAll((nodes) =>
					nodes.every((node) => {
						const content = node.querySelector("button");
						return content !== null && Number(getComputedStyle(content).opacity) === 1;
					}),
				),
			)
			.toBe(true);
		expectSameLayout(before, await stableLayout(page));
	});

	test("输入清除只清关键词，全部标签只清标签，导航 replace 且不重置页面滚动", async ({
		page,
	}) => {
		await open(page);
		const historyLength = await page.evaluate(() => history.length);
		await search(page).fill("第一项");
		await selectTag(page, "性能");
		await expectMatches(page, [1]);
		await search(page).scrollIntoViewIfNeeded();
		const scrollY = await page.evaluate(() => window.scrollY);
		await search(page).fill("第一行");
		await expectMatches(page, [1]);
		expect(Math.abs((await page.evaluate(() => window.scrollY)) - scrollY)).toBeLessThanOrEqual(
			1,
		);

		await page.getByRole("button", { name: "清除输入", exact: true }).click();
		await expect(search(page)).toBeFocused();
		await expectMatches(page, [1]);
		await expect(page).toHaveURL(
			(url) => !url.searchParams.has("q") && url.searchParams.get("tag") === "性能",
		);
		await search(page).fill("第一项");
		await selectTag(page, "全部标签");
		await expectMatches(page, [1, 4]);
		await expect(page).toHaveURL(
			(url) => url.searchParams.get("q") === "第一项" && !url.searchParams.has("tag"),
		);
		expect(await page.evaluate(() => history.length)).toBe(historyLength);
		await page.getByRole("button", { name: "清除筛选", exact: true }).click();
		await expect(page).toHaveURL(
			(url) => !url.searchParams.has("q") && !url.searchParams.has("tag"),
		);
	});

	test("URL 直入和刷新还原组合条件，SSR 首屏已有淡化且水合没有错误", async ({
		page,
		browser,
	}) => {
		const query = `?${new URLSearchParams({ q: "  第二行说明  ", tag: "性能" })}`;
		const noScript = await browser.newContext({ javaScriptEnabled: false });
		try {
			await loadClient(noScript);
			const serverPage = await noScript.newPage();
			const response = await serverPage.goto(`http://127.0.0.1:4173${PATH}${query}`);
			expect(response?.status()).toBe(200);
			await expect(
				serverPage.getByRole("heading", { level: 1, name: ROADMAP_FIXTURE.project.title }),
			).toBeVisible();
			await expect(count(serverPage, 1)).toBeVisible();
			await expect(card(serverPage, 1)).not.toHaveAttribute("data-dimmed", "true");
			await expect(card(serverPage, 4)).toHaveAttribute("data-dimmed", "true");
			await expect(done(serverPage).getByRole("listitem")).toHaveCount(10);
		} finally {
			await noScript.close();
		}

		const diagnostics = collectDiagnostics(page);
		await open(page, query);
		await expect(search(page)).toHaveValue(/第二行说明/);
		await expect(tags(page)).toContainText("性能");
		await expectMatches(page, [1]);
		await page.reload();
		await expectMatches(page, [1]);
		await expect(search(page)).toHaveValue(/第二行说明/);
		await expect(tags(page)).toContainText("性能");
		expect(diagnostics).toEqual([]);
	});

	test("匹配计数包含收起条目，不自动展开；手动展开、编辑筛选和清除保留展开状态", async ({
		page,
	}) => {
		await open(page);
		await search(page).fill(item(6).title);
		await expect(count(page, 1)).toBeVisible();
		await expect(card(page, 6)).toHaveCount(0);
		await expect(done(page).getByRole("listitem")).toHaveCount(10);
		const more = done(page).getByRole("button", { name: "展开更多（还有 2 条）" });
		await expect(more).toHaveAttribute("aria-expanded", "false");
		await more.focus();
		await more.click();
		await expect(done(page).getByRole("listitem")).toHaveCount(12);
		await expectMatches(page, [6]);
		await search(page).fill(item(7).title);
		await expectMatches(page, [7]);
		await expect(done(page).getByRole("listitem")).toHaveCount(12);
		await page.getByRole("button", { name: "清除筛选", exact: true }).click();
		await expect(done(page).getByRole("listitem")).toHaveCount(12);
		const fold = done(page).getByRole("button", { name: "收起", exact: true });
		await fold.focus();
		await fold.click();
		await search(page).fill(item(6).title);
		await expect(count(page, 1)).toBeVisible();
		await expect(done(page).getByRole("listitem")).toHaveCount(10);
		await expect(card(page, 6)).toHaveCount(0);
	});

	test("读者仍可打开淡化卡片；之前的关系选中不会把新的搜索命中也淡化", async ({ page }) => {
		const diagnostics = collectDiagnostics(page);
		await open(page);
		await trigger(page, 17).click();
		await expect(page.getByRole("dialog", { name: item(17).title, exact: true })).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(card(page, 2)).toHaveAttribute("data-faded", "true");

		await search(page).fill(item(2).title);
		await expectMatches(page, [2]);
		await expect(card(page, 2)).not.toHaveAttribute("data-faded", "true");
		await expect
			.poll(() => card(page, 2).evaluate((node) => Number(getComputedStyle(node).opacity)))
			.toBe(1);
		await expect(card(page, 1)).toHaveAttribute("data-dimmed", "true");
		await trigger(page, 1).click();
		const dialog = page.getByRole("dialog", { name: item(1).title, exact: true });
		await expect(dialog).toBeVisible();
		await expect(dialog).toContainText("第二行说明");
		await page.keyboard.press("Escape");
		await expect(dialog).toHaveCount(0);
		await expect(trigger(page, 1)).toBeFocused();
		await expectMatches(page, [2]);
		await expect(page.getByRole("status").filter({ hasText: ADMIN_NOTICE })).toHaveCount(0);
		expect(diagnostics).toEqual([]);
	});

	for (const permission of ["project:update", "*"]) {
		test(`${permission} 权限：筛选时提示禁拖，鼠标和键盘移动尝试不改变顺序也不发写请求`, async ({
			page,
			context,
		}) => {
			await authenticated(context, [permission]);
			const identity = page.waitForResponse(
				(response) =>
					new URL(response.url()).pathname === "/api/v1/auth/me" &&
					response.status() === 200,
			);
			await open(page);
			await identity;
			await expect(page.getByRole("status").filter({ hasText: ADMIN_NOTICE })).toHaveCount(0);
			await search(page).fill("第一项");
			await expectMatches(page, [1, 4]);
			const notice = page.getByRole("status").filter({ hasText: ADMIN_NOTICE });
			await expect(notice).toBeVisible();
			const before = await stableLayout(page);
			const writes: string[] = [];
			page.on("request", (request) => {
				if (
					new URL(request.url()).pathname.startsWith("/api/v1/") &&
					!["GET", "HEAD", "OPTIONS"].includes(request.method())
				)
					writes.push(`${request.method()} ${request.url()}`);
			});

			await card(page, 1).scrollIntoViewIfNeeded();
			const source = await card(page, 1).boundingBox();
			const target = await card(page, 4).boundingBox();
			if (!source || !target) throw new Error("drag targets are not laid out");
			await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
			await page.mouse.down();
			await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, {
				steps: 12,
			});
			await page.mouse.up();
			if (await page.getByRole("dialog").count()) await page.keyboard.press("Escape");
			await card(page, 1).focus();
			await expect(card(page, 1)).toBeFocused();
			await page.keyboard.press("Space");
			await page.keyboard.press("ArrowRight");
			await page.keyboard.press("ArrowDown");
			await page.keyboard.press("Space");
			await page.keyboard.press("Escape");
			await expect(page.locator('li[data-lifted="true"]')).toHaveCount(0);
			expectSameLayout(before, await stableLayout(page));
			expect(writes).toEqual([]);
			await expect(notice).toBeVisible();
			await page.getByRole("button", { name: "清除筛选", exact: true }).click();
			await expect(notice).toHaveCount(0);
			// T20 尚未接入移动，本轮只验证清除后移除禁拖提示。
		});
	}

	test("已登录但没有 project:update 的用户不因角色或登录态而看到管理提示", async ({
		page,
		context,
	}) => {
		await authenticated(context, ["project:read"]);
		const identity = page.waitForResponse(
			(response) =>
				new URL(response.url()).pathname === "/api/v1/auth/me" && response.status() === 200,
		);
		await open(page);
		expect((await (await identity).json()).data.permissions).toEqual(["project:read"]);
		await search(page).fill("第一项");
		await expectMatches(page, [1, 4]);
		await expect(page.getByRole("status").filter({ hasText: ADMIN_NOTICE })).toHaveCount(0);
		await expect(page.getByText(FILTER_NOTICE)).toBeVisible();
	});

	test("窄宽切换与明暗模式保留筛选，输入和标签支持键盘焦点且页面不横溢出", async ({
		page,
		context,
	}) => {
		const diagnostics = collectDiagnostics(page);
		await context.addCookies([{ name: "theme", value: "light", url: "http://127.0.0.1:4173" }]);
		await context.addInitScript(() =>
			localStorage.setItem(
				"theme",
				document.cookie.includes("theme=dark") ? "dark" : "light",
			),
		);
		await open(page);
		await search(page).fill("第一项");
		await selectTag(page, "后端");
		await expectMatches(page, [4]);
		await page.setViewportSize({ width: 390, height: 844 });
		const tabs = page.getByRole("tablist", { name: "切换列" });
		await expect(tabs).toBeVisible();
		await expect(search(page)).toHaveValue("第一项");
		await expect(tags(page)).toContainText("后端");
		await tabs.getByRole("tab", { name: /进行中/ }).click();
		await expectMatches(page, [4]);

		for (const theme of ["light", "dark"] as const) {
			if (theme === "dark") {
				await context.addCookies([
					{ name: "theme", value: "dark", url: "http://127.0.0.1:4173" },
				]);
				await page.reload();
			}
			await expect(page.locator("html")).toHaveClass(new RegExp(theme));
			await expect(search(page)).toHaveValue("第一项");
			await expect(tags(page)).toContainText("后端");
			await expect(count(page, 1)).toBeVisible();
			await search(page).focus();
			await expect(search(page)).toBeFocused();
			await search(page).press("Tab");
			await expect(page.getByRole("button", { name: "清除输入", exact: true })).toBeFocused();
			await page.keyboard.press("Tab");
			await expect(tags(page)).toBeFocused();
			await page.keyboard.press("ArrowDown");
			await expect(page.getByRole("listbox")).toBeVisible();
			await page.keyboard.press("Escape");
			await expect(tags(page)).toBeFocused();
			for (const control of [search(page), tags(page)]) {
				await expect(control).toBeInViewport();
				const box = await control.boundingBox();
				if (!box) throw new Error("filter control has no box");
				expect(box.x).toBeGreaterThanOrEqual(4);
				expect(box.x + box.width).toBeLessThanOrEqual(386);
			}
			expect(
				await page.evaluate(
					() =>
						Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) -
						window.innerWidth,
				),
			).toBeLessThanOrEqual(0);
		}
		await page.setViewportSize({ width: 1280, height: 900 });
		await expect(page.locator(".v-kanban-canvas")).toBeVisible();
		await expectMatches(page, [4]);
		expect(diagnostics).toEqual([]);
	});
});
