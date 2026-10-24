import { expect, test } from "@playwright/test";
import { loadClient } from "./client";

const TYPESCRIPT_SOURCE = 'const recoveryMessage = "正文仍可阅读";';
const PYTHON_SOURCE = 'print("线程结果独立")';
const WORKER_ASSET = /\/assets\/highlighter\.worker-[^/]+\.js$/;

test("不同语言乱序完成时，各代码块仍接收自己的完整高亮结果", async ({ page, context }) => {
	await loadClient(context);
	const grammar = Promise.withResolvers<void>();
	let waitingForTypescript = false;
	await context.route(/\/assets\/typescript-[^/]+\.js$/, async (route) => {
		waitingForTypescript = true;
		await grammar.promise;
		await route.fallback();
	});
	try {
		await page.goto("/blog/contract-rich-worker");
		const article = page.locator("[data-article-content]");
		const first = article.locator("pre").filter({ hasText: TYPESCRIPT_SOURCE });
		const second = article.locator("pre").filter({ hasText: PYTHON_SOURCE });
		await expect.poll(() => waitingForTypescript).toBe(true);
		await expect(second).toHaveClass(/shiki/);
		await expect(first).not.toHaveClass(/shiki/);
		await expect(first).toHaveText(TYPESCRIPT_SOURCE);
		grammar.resolve();
		await expect(first).toHaveClass(/shiki/);
		await expect(first).toHaveText(TYPESCRIPT_SOURCE);
		await expect(second).toHaveText(PYTHON_SOURCE);
		expect(page.workers().filter((worker) => WORKER_ASSET.test(worker.url()))).toHaveLength(1);
	} finally {
		grammar.resolve();
	}
});

test("高亮线程下载失败保留源码，后续文章可在原文档中重新建立线程", async ({ page, context }) => {
	await loadClient(context);
	const download = Promise.withResolvers<void>();
	let blocked = true;
	let requested = false;
	await context.route(WORKER_ASSET, async (route) => {
		if (blocked) {
			requested = true;
			await download.promise;
			await route.abort("failed");
		} else {
			await route.fallback();
		}
	});
	try {
		await page.goto("/blog/contract-rich-toc");
		await expect.poll(() => requested).toBe(true);
		const documentBefore = await page.evaluateHandle(() => document);
		const code = page.locator("[data-article-content] pre");
		await expect(code).toHaveText(TYPESCRIPT_SOURCE);
		download.resolve();
		await expect
			.poll(() => page.workers().filter((worker) => WORKER_ASSET.test(worker.url())).length)
			.toBe(0);
		await expect(code).toHaveText(TYPESCRIPT_SOURCE);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("富内容故障契约：toc");
		blocked = false;
		await page
			.getByRole("navigation", { name: "章节导航" })
			.getByRole("link", { name: /下一章/ })
			.click();
		await expect(page).toHaveURL(/\/blog\/contract-rich-toc-copy$/);
		await expect(page.locator("[data-article-content] pre.shiki")).toHaveText(
			TYPESCRIPT_SOURCE,
		);
		expect(await page.evaluate((previous) => document === previous, documentBefore)).toBe(true);
		await documentBefore.dispose();
	} finally {
		download.resolve();
	}
});
