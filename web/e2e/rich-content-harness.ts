import {
	type BrowserContext,
	expect,
	type JSHandle,
	type Page,
	type Route,
} from "@playwright/test";

/** 正文开头标记，用于确认增强失败不替换已有节点。 */
export const ARTICLE_START = "增强加载失败时，这段正文始终保留。";
/** 与开头标记共同覆盖正文末段的节点保留契约。 */
export const ARTICLE_END = "增强恢复后，这段结尾仍是原来的节点。";
interface ArticleSnapshot {
	document: Document;
	nodes: Element[];
	replaced: boolean;
}

/** 阻断指定资源，并记录失败、恢复与整页导航以区分局部重试。 */
export async function blockAsset(context: BrowserContext, page: Page, pattern: RegExp) {
	const blockedUrls = new Set<string>();
	const successfulUrls: string[] = [];
	const documents: string[] = [];
	let blocked = true;
	page.on("response", (response) => {
		if (pattern.test(response.url()) && response.ok()) successfulUrls.push(response.url());
	});
	page.on("request", (request) => {
		if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
			documents.push(request.url());
		}
	});
	await context.route(pattern, async (route) => {
		if (blocked) {
			blockedUrls.add(route.request().url());
			await route.abort("failed");
		} else {
			await route.fallback();
		}
	});
	return {
		blockedUrls,
		successfulUrls,
		documents,
		release: () => {
			blocked = false;
		},
	};
}

/** 仅豁免本用例实际阻断的资源错误，保留其他控制台与水合异常。 */
export function collectUnexpectedDiagnostics(page: Page, blockedUrls: Set<string>) {
	const unexpected: string[] = [];
	const pending: Promise<void>[] = [];
	const expectedError = (message: string) => {
		const [firstLine, ...stack] = message.split("\n");
		// 只接受这次实际阻断的资源；未知异常和非堆栈后缀仍然报错。
		if (stack.some((line) => line.trim() !== "" && !/^\s+at /.test(line))) return false;
		return Array.from(blockedUrls).some((url) => {
			const pathname = new URL(url).pathname;
			return (
				firstLine === `Failed to fetch dynamically imported module: ${url}` ||
				firstLine === `TypeError: Failed to fetch dynamically imported module: ${url}` ||
				firstLine === `Unable to preload CSS for ${url}` ||
				firstLine === `Error: Unable to preload CSS for ${url}` ||
				firstLine === `Unable to preload CSS for ${pathname}` ||
				firstLine === `Error: Unable to preload CSS for ${pathname}`
			);
		});
	};
	page.on("pageerror", (error) => {
		if (!expectedError(error.message)) unexpected.push(error.message);
	});
	page.on("console", (message) => {
		const text = message.text();
		const source = message.location().url;
		if (
			message.type() === "error" &&
			((source === "http://127.0.0.1:4173/api/v1/auth/me" &&
				text ===
					"Failed to load resource: the server responded with a status of 401 (Unauthorized)") ||
				(blockedUrls.has(source) && text === "Failed to load resource: net::ERR_FAILED") ||
				expectedError(text))
		) {
			return;
		}
		if (
			message.type() === "error" ||
			/same key|duplicate key|hydration|hydrated|uncaught/i.test(text)
		) {
			const argument = message.args().length === 1 ? message.args()[0] : undefined;
			pending.push(
				(argument
					? argument
							.evaluate((value: unknown) =>
								value instanceof Error ? `${value.name}: ${value.message}` : null,
							)
							.catch(() => null)
					: Promise.resolve(null)
				).then((error) => {
					if (error === null || !expectedError(error)) {
						unexpected.push(`${source}: ${text}`);
					}
				}),
			);
		}
	});
	return async () => {
		await Promise.all(pending);
		return unexpected;
	};
}

/** 在客户端脚本执行前保存 SSR 正文节点，随后放行水合。 */
export async function openWithArticleSnapshot(context: BrowserContext, page: Page, path: string) {
	const scripts = Promise.withResolvers<void>();
	const holdScripts = async (route: Route) => {
		await scripts.promise;
		await route.fallback();
	};
	await context.route("**/assets/*.js", holdScripts);
	try {
		await page.goto(path, { waitUntil: "commit" });
		await expect(page.locator("[data-article-content]")).toContainText(ARTICLE_START);
		await expect(page.locator("[data-article-content]")).toContainText(ARTICLE_END);
		const snapshot = await page.evaluateHandle(
			({ start, end }) => {
				const article = document.querySelector("[data-article-content]");
				const paragraphs = Array.from(article?.querySelectorAll("p") ?? []).filter(
					(node) => node.textContent === start || node.textContent === end,
				);
				if (!article || paragraphs.length !== 2) throw new Error("正文快照缺少预期段落");
				const nodes = [article, ...paragraphs];
				const state = { document, nodes, replaced: false };
				new MutationObserver((records) => {
					if (
						nodes.some((node) => !node.isConnected) ||
						records.some((record) =>
							Array.from(record.removedNodes).some((removed) =>
								nodes.some((node) => removed === node || removed.contains(node)),
							),
						)
					) {
						state.replaced = true;
					}
				}).observe(document, { childList: true, subtree: true });
				return state;
			},
			{ start: ARTICLE_START, end: ARTICLE_END },
		);
		const ready = page.waitForResponse("**/api/v1/auth/me");
		scripts.resolve();
		await ready;
		return snapshot;
	} finally {
		scripts.resolve();
		await context.unroute("**/assets/*.js", holdScripts);
	}
}

/** 验证增强前后的正文仍属于同一 document，且原节点从未被移除。 */
export async function expectArticlePreserved(page: Page, snapshot: JSHandle<ArticleSnapshot>) {
	await expect(page.locator("[data-article-content]")).toContainText(ARTICLE_START);
	await expect(page.locator("[data-article-content]")).toContainText(ARTICLE_END);
	expect(
		await snapshot.evaluate(
			(state) =>
				state.document === document &&
				!state.replaced &&
				state.nodes.every((node) => node.isConnected) &&
				state.nodes[0] === document.querySelector("[data-article-content]"),
		),
	).toBe(true);
}
