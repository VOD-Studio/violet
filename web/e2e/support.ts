import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import type { BrowserContext, Page } from "@playwright/test";
import { handle } from "./mock-data.mjs";

const CLIENT_DIR = join(import.meta.dirname, "..", "dist", "client");

export async function loadClient(context: BrowserContext) {
	// 生产 SSR 入口不伺服静态文件；页面导航仍由真实路由应答，其余资源直接加载本次构建产物。
	// pending 组件会请求 public/ 下任意路径（如 /persona/*.webp），按资源类型兜底而不是只认 /assets/。
	await context.route("*://127.0.0.1:4173/**", async (route) => {
		const request = route.request();
		if (request.resourceType() === "document") await route.continue();
		else {
			const path = join(CLIENT_DIR, new URL(request.url()).pathname);
			if (existsSync(path) && statSync(path).isFile()) await route.fulfill({ path });
			else await route.continue();
		}
	});
	// Google 登录脚本契约用例用不到，给空脚本：CI 访问它时断线会变成控制台错误，让无关用例失败
	await context.route("https://accounts.google.com/gsi/**", (route) =>
		route.fulfill({ contentType: "application/javascript", body: "" }),
	);
	await context.route("**/api/**", async (route) => {
		const url = new URL(route.request().url());
		// 页面跳走或用例结束时请求已取消，转发到一半的响应随之作废；没有人再等这个应答
		await route
			.fetch({ url: `http://127.0.0.1:9410${url.pathname}${url.search}` })
			.then((response) => route.fulfill({ response }))
			.catch(() => {});
	});
}

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
