import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import type { BrowserContext } from "@playwright/test";

const CLIENT_DIR = join(import.meta.dirname, "..", "dist", "client");

/** 契约图集使用的 1×1 PNG，不依赖外部图源。 */
export const CONTRACT_IMAGE_PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
	"base64",
);

/** 页面导航走真实 SSR，静态资源与浏览器 API 使用同一构建和契约数据。 */
export async function loadClient(context: BrowserContext) {
	await context.route("*://127.0.0.1:4173/**", async (route) => {
		const request = route.request();
		if (request.resourceType() === "document") await route.continue();
		else if (new URL(request.url()).pathname === "/assets/contract-image.png") {
			await route.fulfill({
				status: 200,
				contentType: "image/png",
				body: CONTRACT_IMAGE_PNG,
			});
		} else {
			const path = join(CLIENT_DIR, new URL(request.url()).pathname);
			if (existsSync(path) && statSync(path).isFile()) await route.fulfill({ path });
			else await route.continue();
		}
	});
	await context.route("**/api/**", async (route) => {
		const url = new URL(route.request().url());
		const response = await route.fetch({
			url: `http://127.0.0.1:9410${url.pathname}${url.search}`,
		});
		await route.fulfill({ response });
	});
}
