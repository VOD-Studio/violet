import { expect, test } from "@playwright/test";
import { loadClient } from "./client";

interface HydrationScenario {
	name: string;
	path: string;
	apiPaths: string[];
	selector: string;
	text: string;
}

const SCENARIOS: HydrationScenario[] = [
	{
		name: "文章正文",
		path: "/blog/contract-post-1",
		apiPaths: ["/api/v1/posts/contract-post-1"],
		selector: "[data-article-content]",
		text: "首访缓存回归正文始终可读。",
	},
	{
		name: "首页近稿",
		path: "/",
		apiPaths: ["/api/v1/site-identity", "/api/v1/publications"],
		selector: "#recent ol",
		text: "契约样例文章 1",
	},
	{
		name: "文章列表",
		path: "/blog",
		apiPaths: ["/api/v1/posts", "/api/v1/settings"],
		selector: "main",
		text: "壳层契约文章 1",
	},
	{
		name: "笔记列表",
		path: "/notes",
		apiPaths: ["/api/v1/notes"],
		selector: "main",
		text: "缓存接管笔记",
	},
	{
		name: "笔记正文",
		path: "/notes/41000000-0000-0000-0000-000000000001",
		apiPaths: ["/api/v1/notes/41000000-0000-0000-0000-000000000001"],
		selector: "main",
		text: "笔记内容在首访接管期间保持可读。",
	},
	{
		name: "图集列表",
		path: "/galleries",
		apiPaths: ["/api/v1/galleries"],
		selector: "main",
		text: "沉浸契约图集",
	},
	{
		name: "图集详情",
		path: "/galleries/contract-gallery",
		apiPaths: ["/api/v1/galleries/contract-gallery"],
		selector: "main",
		text: "沉浸契约图集",
	},
	{
		name: "系列目录",
		path: "/series/contract-series",
		apiPaths: ["/api/v1/series/contract-series"],
		selector: "main",
		text: "系列目录在首访接管期间保持可读。",
	},
	{
		name: "关于页配置正文",
		path: "/about",
		apiPaths: ["/api/v1/settings"],
		selector: "main",
		text: "缓存接管契约作者",
	},
	{
		name: "人设成功空资源",
		path: "/persona",
		apiPaths: ["/api/v1/persona"],
		selector: "main",
		text: "人设档案尚未公开",
	},
];

for (const scenario of SCENARIOS) {
	test(`${scenario.name}在隐身首访接管时持续可见，后台请求不能替换为骨架`, async ({
		page,
		context,
	}) => {
		await loadClient(context);
		let resumeScripts: (() => void) | undefined;
		let resumeApi: (() => void) | undefined;
		const scriptsReady = new Promise<void>((resolve) => {
			resumeScripts = resolve;
		});
		const apiReady = new Promise<void>((resolve) => {
			resumeApi = resolve;
		});
		const hydrationErrors: string[] = [];
		page.on("pageerror", (error) => {
			if (/hydration|hydrated|React error #418/i.test(error.message)) {
				hydrationErrors.push(error.message);
			}
		});
		await context.route("**/assets/*.js", async (route) => {
			await scriptsReady;
			await route.fallback();
		});
		await context.route("**/api/**", async (route) => {
			if (scenario.apiPaths.includes(new URL(route.request().url()).pathname)) {
				await apiReady;
			}
			await route.fallback();
		});
		try {
			await page.goto(scenario.path, { waitUntil: "commit" });
			const content = page.locator(scenario.selector).first();
			await expect(content).toContainText(scenario.text, { useInnerText: true });
			await page.evaluate(({ selector, text }) => {
				document.documentElement.dataset.ssrContentLost = "false";
				new MutationObserver(() => {
					const content = document.querySelector<HTMLElement>(selector);
					if (!content?.innerText.includes(text)) {
						document.documentElement.dataset.ssrContentLost = "true";
					}
				}).observe(document, { childList: true, subtree: true });
			}, scenario);
			const clientReady = page.waitForResponse(
				(response) => new URL(response.url()).pathname === "/api/v1/auth/me",
			);
			resumeScripts?.();
			await clientReady;
			await expect(page.locator("html")).toHaveAttribute("data-ssr-content-lost", "false");
			await expect(content).toContainText(scenario.text, { useInnerText: true });
			resumeApi?.();
			await page.waitForLoadState("networkidle");
			await expect(page.locator("html")).toHaveAttribute("data-ssr-content-lost", "false");
			await expect(content).toContainText(scenario.text, { useInnerText: true });
			expect(hydrationErrors).toEqual([]);
		} finally {
			resumeScripts?.();
			resumeApi?.();
			await context.unrouteAll({ behavior: "wait" });
		}
	});
}
