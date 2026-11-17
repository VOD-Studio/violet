import { type BrowserContext, expect, test } from "@playwright/test";
import { loadClient } from "./client";
import { authenticated, openClientPage } from "./support";

async function articles(context: BrowserContext, writable = true) {
	await loadClient(context);
	await authenticated(
		context,
		writable ? ["admin:access", "post:view", "post:publish"] : ["admin:access", "post:view"],
	);
	let posts = Array.from({ length: 52 }, (_, i) => ({
		id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
		title: `文章${String(i + 1).padStart(2, "0")}`,
		slug: `article-${i + 1}`,
		excerpt: "",
		cover_image: i === 1 ? "/uploads/article-cover.webp" : "",
		status: i === 2 ? "draft" : "published",
		is_featured: i === 0,
		view_count: 0,
		tags: [],
		published_at: i === 2 ? undefined : "2026-11-17T00:00:00Z",
	}));
	const initialIDs = posts.map((post) => post.id);
	const limits: string[] = [];
	const reorders: { expected_ids: string[]; ids: string[] }[] = [];
	let rejectOrder = false;
	let releaseOrder: (() => void) | undefined;
	let orderGate: Promise<void> | undefined;
	await context.route("**/api/v1/admin/posts**", async (route) => {
		const request = route.request();
		const url = new URL(request.url());
		if (request.method() === "GET" && url.pathname.endsWith("/admin/posts")) {
			const limit = Number(url.searchParams.get("limit") ?? 20);
			const page = Number(url.searchParams.get("page") ?? 1);
			limits.push(String(limit));
			const keyword = url.searchParams.get("keyword") ?? "";
			const status = url.searchParams.get("status");
			const filtered = posts.filter(
				(post) => post.title.includes(keyword) && (!status || post.status === status),
			);
			return route.fulfill({
				json: {
					data: filtered.slice((page - 1) * limit, page * limit),
					meta: {
						pagination: {
							page,
							limit,
							total: filtered.length,
							total_pages: Math.ceil(filtered.length / limit),
						},
					},
				},
			});
		}
		if (url.pathname.endsWith("/reorder")) {
			const body = request.postDataJSON();
			reorders.push(body);
			await orderGate;
			if (rejectOrder) {
				return route.fulfill({
					status: 409,
					json: { error: "CONFLICT", message: "顺序已变化，请刷新" },
				});
			}
			const selected = new Set(body.ids);
			const ordered = body.ids.map((id: string) => posts.find((post) => post.id === id));
			let cursor = 0;
			posts = posts.map((post) => (selected.has(post.id) ? ordered[cursor++] : post));
			return route.fulfill({ json: { data: null } });
		}
		if (url.pathname.endsWith("/featured")) {
			const id = url.pathname.split("/").at(-2);
			const post = posts.find((item) => item.id === id);
			if (!post) throw new Error("Missing article fixture");
			post.is_featured = request.postDataJSON().is_featured;
			posts.sort(
				(a, b) =>
					Number(b.is_featured) - Number(a.is_featured) ||
					initialIDs.indexOf(a.id) - initialIDs.indexOf(b.id),
			);
			return route.fulfill({ json: { data: post } });
		}
		const post = posts.find((item) => url.pathname.endsWith(`/${item.id}`));
		if (post)
			return route.fulfill({
				json: {
					data: {
						...post,
						content_html: "<p>只有后台可见的草稿正文</p>",
						content_md: "只有后台可见的草稿正文",
					},
				},
			});
		return route.fallback();
	});
	return {
		limits,
		reorders,
		reject: () => {
			rejectOrder = true;
		},
		pause: () => {
			const { promise, resolve } = Promise.withResolvers<void>();
			orderGate = promise;
			releaseOrder = resolve;
		},
		release: () => releaseOrder?.(),
	};
}

test("默认50篇，分组拖动持久化，刷新与翻页不丢文章", async ({ page, context }) => {
	const fixture = await articles(context);
	await openClientPage(page, "/admin/posts");
	await expect(page.getByRole("table", { name: "文章列表" })).toBeVisible();
	expect(fixture.limits[0]).toBe("50");
	await expect(page.getByRole("row")).toHaveCount(51);
	const table = page.getByRole("table", { name: "文章列表" });
	await expect(table.getByRole("columnheader")).toContainText([
		"",
		"",
		"移动行",
		"封面",
		"标题",
		"状态",
		"置顶",
		"标签",
		"浏览",
		"发布时间",
		"操作",
	]);
	await expect(table.locator("img")).toHaveAttribute("src", /article-cover/);
	const first = await table
		.getByRole("button", { name: "移动 文章02", exact: true })
		.boundingBox();
	const second = await table
		.getByRole("button", { name: "移动 文章03", exact: true })
		.boundingBox();
	if (!first || !second) throw new Error("排序把手没有占地");
	await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
	await page.mouse.down();
	await page.mouse.move(second.x + second.width / 2, second.y + second.height / 2, { steps: 12 });
	await page.mouse.up();
	await expect(table.getByRole("row").nth(2)).toContainText("文章03");
	await expect(table.getByRole("checkbox", { checked: true })).toHaveCount(0);
	await expect(page).toHaveURL(/\/admin\/posts\/?$/);
	expect(fixture.reorders).toHaveLength(1);
	expect(fixture.reorders[0].expected_ids).toHaveLength(49);
	expect(fixture.reorders[0].ids.slice(0, 2)).toEqual([
		"00000000-0000-4000-8000-000000000003",
		"00000000-0000-4000-8000-000000000002",
	]);
	await page.reload();
	await expect(page.getByRole("row").nth(2)).toContainText("文章03");
	await page.getByRole("button", { name: "第 2 页", exact: true }).click();
	await expect(table.getByRole("row")).toHaveCount(3);
	await expect(table.getByRole("row").nth(1)).toContainText("文章51");
	await expect(table.getByRole("row").nth(2)).toContainText("文章52");
});

test("浏览走阅读地址，草稿受保护预览，置顶可取消", async ({ page, context }) => {
	await articles(context);
	await openClientPage(page, "/admin/posts");
	await expect(page.getByRole("link", { name: "浏览 文章02" })).toHaveAttribute(
		"href",
		"/blog/article-2",
	);
	await expect(page.getByRole("link", { name: "浏览 文章03" })).toHaveCount(0);
	await page.getByRole("button", { name: "预览 文章03" }).click();
	const preview = page.getByRole("dialog", { name: "文章预览 · 文章03" });
	await expect(preview.getByText("只有后台可见的草稿正文")).toBeVisible();
	await preview.getByRole("button", { name: "关闭", exact: true }).click();
	const row = page
		.getByRole("row")
		.filter({ has: page.getByRole("button", { name: "文章02", exact: true }) });
	await row.getByRole("button", { name: "更多操作" }).click();
	await page.getByRole("menuitem", { name: "置顶", exact: true }).click();
	await expect(row.getByText("置顶", { exact: true })).toBeVisible();
	await row.getByRole("button", { name: "更多操作" }).click();
	await page.getByRole("menuitem", { name: "取消置顶", exact: true }).click();
	await expect(row.getByText("置顶", { exact: true })).toHaveCount(0);
});

test("保存失败保留原顺序且不显示成功", async ({ page, context }) => {
	const fixture = await articles(context);
	fixture.reject();
	await openClientPage(page, "/admin/posts");
	const handle = page.getByRole("button", { name: "移动 文章03", exact: true });
	await handle.focus();
	await page.keyboard.press("Space");
	await page.keyboard.press("ArrowUp");
	await page.keyboard.press("Space");
	await expect(page.getByText("顺序已变化，请刷新", { exact: true })).toBeVisible();
	await expect(page.getByRole("row").nth(2)).toContainText("文章02");
	await expect(page.getByRole("table", { name: "文章列表" })).toBeVisible();
	await expect(page.getByText("文章顺序已保存", { exact: true })).toHaveCount(0);
});

test("只有查看权限时无排序或置顶入口", async ({ page, context }) => {
	await articles(context, false);
	await openClientPage(page, "/admin/posts");
	await expect(page.getByRole("link", { name: "浏览 文章02" })).toBeVisible();
	await expect(page.getByRole("button", { name: /^移动 文章/ })).toHaveCount(0);
	await expect(page.getByRole("button", { name: "更多操作" })).toHaveCount(0);
});

test("键盘只移动筛选集合，保存期间锁定，置顶边界与取消不提交", async ({ page, context }) => {
	const fixture = await articles(context);
	await openClientPage(page, "/admin/posts");
	const table = page.getByRole("table", { name: "文章列表" });
	await expect(page.getByRole("button", { name: "移动 文章01", exact: true })).toHaveAttribute(
		"aria-disabled",
		"true",
	);
	const boundary = page.getByRole("button", { name: "移动 文章02", exact: true });
	await boundary.focus();
	await page.keyboard.press("Space");
	await page.keyboard.press("ArrowUp");
	await page.keyboard.press("Space");
	expect(fixture.reorders).toHaveLength(0);
	await boundary.focus();
	await page.keyboard.press("Space");
	await page.keyboard.press("ArrowDown");
	await page.keyboard.press("Escape");
	expect(fixture.reorders).toHaveLength(0);
	await expect(table.getByRole("row").nth(2)).toContainText("文章02");

	await page.getByRole("searchbox", { name: "搜索文章标题或正文" }).fill("文章1");
	await expect(table.getByRole("row")).toHaveCount(11);
	fixture.pause();
	const handle = page.getByRole("button", { name: "移动 文章10", exact: true });
	await handle.focus();
	await page.keyboard.press("Space");
	await page.keyboard.press("ArrowDown");
	await page.keyboard.press("Space");
	await expect.poll(() => fixture.reorders.length).toBe(1);
	await expect(table).toHaveAttribute("aria-busy", "true");
	await expect(table.getByRole("row").nth(1)).toContainText("文章11");
	await page.keyboard.press("Space");
	await page.keyboard.press("ArrowDown");
	await page.keyboard.press("Space");
	expect(fixture.reorders).toHaveLength(1);
	fixture.release();
	await expect(table).not.toHaveAttribute("aria-busy", "true");
	expect(fixture.reorders[0].expected_ids).toHaveLength(10);
	expect(fixture.reorders[0].ids).toEqual([
		fixture.reorders[0].expected_ids[1],
		fixture.reorders[0].expected_ids[0],
		...fixture.reorders[0].expected_ids.slice(2),
	]);
	await page.getByRole("searchbox", { name: "搜索文章标题或正文" }).fill("");
	await expect(table.getByRole("row")).toHaveCount(51);
	await expect(table.getByRole("row").nth(9)).toContainText("文章09");
	await expect(table.getByRole("row").nth(10)).toContainText("文章11");
	await expect(table.getByRole("row").nth(11)).toContainText("文章10");
	await expect(table.getByRole("row").nth(20)).toContainText("文章20");
});
