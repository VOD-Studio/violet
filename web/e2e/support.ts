import { type BrowserContext, expect, type Page } from "@playwright/test";
import { handle } from "./mock-data.mjs";

export function collectDiagnostics(page: Page) {
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

/**
 * 导航并等待客户端会话探活，SSR 文本可见时事件监听可能尚未挂载。
 *
 * @remarks 探活由壳层 Header 发出，只说明 React 根已接管：路由内容在独立的 Suspense 边界里稍后水合，
 * 此前的点击与按键由 React 补水合后重放，页面 effect 订阅的窗口事件则会丢失，见 {@link refocusUntilRequest}。
 */
export async function openClientPage(page: Page, path: string) {
	const ready = page.waitForResponse("**/api/v1/auth/me");
	const [response] = await Promise.all([page.goto(path), ready]);
	return response;
}

/**
 * 模拟窗口切回前台，直到页面发出匹配 `url` 的请求。
 *
 * @remarks TanStack Query 只认 visibilitychange。查询观察者在路由内容水合后才订阅，
 * 更早派发的聚焦不会重新拉取，所以每轮派发后等请求，没等到就再派发一次。
 */
export async function refocusUntilRequest(page: Page, url: string) {
	await expect(async () => {
		await Promise.all([
			// 已订阅时派发后几十毫秒内就会发出请求，1 秒没有即可判定这轮落空
			page.waitForRequest(url, { timeout: 1_000 }),
			page.evaluate(() => {
				for (const state of ["hidden", "visible"]) {
					Object.defineProperty(document, "visibilityState", {
						configurable: true,
						value: state,
					});
					document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
				}
			}),
		]);
	}).toPass({ timeout: 10_000 });
}

/**
 * 以契约后台操作者登录，并把 `/auth/me` 返回的权限换成 `permissions`。
 * Cookie 建立 SSR 会话；客户端 useMe 仍独立读取实际权限。
 */
export async function authenticated(context: BrowserContext, permissions: string[]) {
	await context.addCookies([
		{ name: "contract_admin", value: "1", url: "http://127.0.0.1:4173" },
	]);
	await context.route("**/api/v1/auth/me", async (route) => {
		const response = handle("GET", "/api/v1/auth/me", "", "contract_admin=1");
		const body = JSON.parse(response.body);
		body.data.permissions = permissions;
		await route.fulfill({
			status: response.status,
			contentType: "application/json",
			json: body,
		});
	});
}
