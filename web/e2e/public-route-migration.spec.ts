import { expect, test } from "@playwright/test";
import { loadClient } from "./client";
import { ROADMAP_FIXTURE } from "./mock-data.mjs";
import { openClientPage } from "./support";

const EDITOR = "/projects/violet/docs/editor";
const INKLINE = "/projects/inkline/docs";
const KANBAN = "/projects/kanban/docs";
const MIGRATIONS = [
	["/editor-guide", EDITOR],
	...["syntax", "math", "diagram", "persona-cards", "storage"].map((chapter) => [
		`/editor-guide/${chapter}`,
		`${EDITOR}/${chapter}`,
	]),
	["/inkline", INKLINE],
	...["export", "quick-start", "pens", "hands", "fills", "redraw", "palette"].map((section) => [
		`/inkline/${section}`,
		`${INKLINE}/${section}`,
	]),
	["/kanban", KANBAN],
	["/persona", "/chat/personas"],
];
const RETIRED = [
	"/lab",
	"/lab/announcement",
	"/lab/blog",
	"/lab/colors",
	"/lab/friends",
	"/lab/gallery",
	"/lab/mascot",
	"/lab/nav",
	"/lab/palette",
	"/lab/series",
	"/lab/theme",
	"/lab/toc-tree",
	"/lab/unknown",
	"/pet",
	"/pet/unknown",
	"/ui",
	"/ui/button",
	"/editor-guide/unknown",
	"/editor-guide/math/unknown",
	"/inkline/unknown",
	"/persona/unknown",
	`${EDITOR}/unknown`,
	`${INKLINE}/unknown`,
];
const QUERY = "?from=old%20link&tag=one&tag=two&lang=ja";

for (const [oldPath, destination] of MIGRATIONS) {
	test(`HTTP 301 ${oldPath} preserves the raw query and reaches ${destination}`, async ({
		request,
	}) => {
		const response = await request.get(`${oldPath}${QUERY}`, { maxRedirects: 0 });
		expect(response.status()).toBe(301);
		const location = new URL(response.headers().location, response.url());
		expect(`${location.pathname}${location.search}`).toBe(`${destination}${QUERY}`);
		const page = await request.get(`${destination}${QUERY}`, { maxRedirects: 0 });
		expect(page.status()).toBe(200);
	});
}

for (const path of RETIRED) {
	test(`HTTP ${path} returns the site 404 without redirecting`, async ({ request }) => {
		const response = await request.get(path, { maxRedirects: 0 });
		expect(response.status()).toBe(404);
		expect(response.headers().location).toBeUndefined();
		expect(await response.text()).toContain("页面不存在或已被移除");
	});
}

test("the browser inherits fragments through permanent redirects", async ({ context, page }) => {
	await loadClient(context);
	await page.goto("/kanban?from=bookmark#install");
	await expect(page).toHaveURL(`${KANBAN}?from=bookmark#install`);
	await expect(page.locator("#install")).toBeInViewport();
	const fragment = encodeURIComponent("两种形态与输入规则");
	await page.goto(`/editor-guide/math?from=bookmark#${fragment}`);
	await expect(page).toHaveURL(`${EDITOR}/math?from=bookmark#${fragment}`);
	await expect(
		page.getByRole("heading", { level: 1, name: "数学公式", exact: true }).first(),
	).toBeVisible();
	await expect(page.locator('[id="两种形态与输入规则"]')).toBeInViewport();
});

test("retired and unknown browser routes show the site 404 at the requested URL", async ({
	context,
	page,
}) => {
	await loadClient(context);
	for (const path of [
		"/lab/mascot",
		"/pet",
		"/ui/button",
		"/editor-guide/unknown",
		"/inkline/unknown",
	]) {
		const response = await page.goto(path);
		expect(response?.status()).toBe(404);
		await expect(page).toHaveURL(path);
		await expect(page.getByText("页面不存在或已被移除。", { exact: true })).toBeVisible();
	}
});

test("anonymous persona SSR stays public while the chat workspace keeps its login guard", async ({
	context,
	page,
	request,
}) => {
	await loadClient(context);
	const response = await request.get("/chat/personas?lang=ja", { maxRedirects: 0 });
	expect(response.status()).toBe(200);
	const html = await response.text();
	expect(html).toContain("人设档案尚未公开");
	expect(html).toMatch(/<link[^>]*rel="canonical"[^>]*href="[^"]*\/chat\/personas"/);
	await openClientPage(page, "/chat/personas?lang=ja");
	await expect(page.getByRole("heading", { name: "人设档案尚未公开" })).toBeVisible();
	await expect(page).toHaveURL(/\/chat\/personas\?lang=ja$/);
	await page.goto("/chat?conversation=private");
	await expect(page).toHaveURL(/\/login\?redirect=/);
	const redirect = new URL(page.url()).searchParams.get("redirect");
	expect(redirect).toBe("/chat?conversation=private");
});

test("editor chapters keep their reading navigation and real rendered content", async ({
	context,
	page,
}) => {
	await loadClient(context);
	await openClientPage(page, EDITOR);
	await page.getByRole("link", { name: /基础语法/ }).click();
	await expect(page).toHaveURL(`${EDITOR}/syntax`);
	await page.getByRole("link", { name: "下一篇 · 数学公式" }).click();
	await expect(page).toHaveURL(`${EDITOR}/math`);
	await expect(page.locator(".katex").first()).toBeVisible();
	await page.getByRole("link", { name: "手册目录", exact: true }).click();
	await expect(page).toHaveURL(EDITOR);
});

test("Inkline section navigation keeps the artwork mounted and interactive", async ({
	context,
	page,
}) => {
	await loadClient(context);
	await page.setViewportSize({ width: 1440, height: 1000 });
	await openClientPage(page, INKLINE);
	const stage = page.locator('section[aria-labelledby="workbench-title"]');
	await expect(stage.locator("svg").first()).toBeVisible();
	const artwork = await stage.locator("svg").first().elementHandle();
	if (!artwork) throw new Error("Inkline artwork did not mount");
	await stage.getByRole("button", { name: "暂停", exact: true }).click();
	await page
		.getByRole("radiogroup", { name: "播放倍率", exact: true })
		.getByRole("radio", { name: "2×", exact: true })
		.click();
	await page
		.getByRole("navigation", { name: "inkline 能力" })
		.getByRole("link", { name: /导出动画/ })
		.click();
	await expect(page).toHaveURL(`${INKLINE}/export`);
	expect(await artwork.evaluate((element) => element.isConnected)).toBe(true);
	await expect(stage.getByRole("button", { name: "播放", exact: true })).toBeVisible();
	await expect(page.getByRole("radiogroup", { name: "导出格式" })).toBeVisible();
	await page
		.getByRole("navigation", { name: "inkline 能力" })
		.getByRole("link", { name: /画稿与时间轴/ })
		.click();
	await expect(page).toHaveURL(INKLINE);
	await expect(page.getByRole("radio", { name: "2×", exact: true })).toHaveAttribute(
		"aria-checked",
		"true",
	);
	await page
		.getByRole("navigation", { name: "inkline 能力" })
		.getByRole("link", { name: /笔与压感/ })
		.click();
	await expect(page).toHaveURL(`${INKLINE}/pens`);
	await expect(page.getByRole("heading", { level: 1 })).toHaveText("笔与压感");
});

for (const [slug, destination] of [
	["violet", EDITOR],
	["inkline", INKLINE],
	["kanban", KANBAN],
]) {
	test(`the ${slug} project card and detail open its documentation`, async ({
		context,
		page,
	}) => {
		await loadClient(context);
		const project = { ...ROADMAP_FIXTURE.project, slug, title: `文档入口 ${slug}` };
		await context.route("**/api/v1/projects**", async (route) => {
			const path = new URL(route.request().url()).pathname;
			if (path === "/api/v1/projects") {
				await route.fulfill({ json: { data: [project] } });
			} else if (path === `/api/v1/projects/by-slug/${slug}/roadmap`) {
				await route.fulfill({ json: { data: { ...ROADMAP_FIXTURE, project } } });
			} else {
				await route.fallback();
			}
		});
		await openClientPage(page, "/");
		await page.getByRole("button", { name: "更多", exact: true }).click();
		await page.getByRole("link", { name: /^项目/ }).click();
		await page.getByRole("link", { name: project.title, exact: true }).click();
		await expect(page).toHaveURL(`/projects/${slug}`);
		const docs = page.getByRole("link", { name: "文档", exact: true });
		await expect(docs).toHaveAttribute("href", destination);
		await docs.click();
		await expect(page).toHaveURL(destination);
	});
}
