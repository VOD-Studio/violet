import { expect, type Locator, test } from "@playwright/test";
import { prepareChat } from "./chat-harness";

const geometry = (bubble: Locator) =>
	bubble.evaluate((element) => {
		const bounds = element.getBoundingClientRect();
		const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
		let text = walker.nextNode();
		while (text && !text.textContent?.trim()) text = walker.nextNode();
		if (!text) throw new Error("预览缺少可测量的出站正文");
		const range = document.createRange();
		range.selectNodeContents(text);
		const content = range.getBoundingClientRect();
		return {
			width: bounds.width,
			height: bounds.height,
			textX: content.x - bounds.x,
			textY: content.y - bounds.y,
		};
	});

const settingsGap = async (workspace: Locator) => {
	const heading = await workspace.getByRole("heading", { name: /^我的气泡/ }).boundingBox();
	const background = await workspace
		.getByRole("radio", { name: "纯色", exact: true })
		.boundingBox();
	if (!heading || !background) throw new Error("缺少气泡标题或纯色背景选项");
	return background.y - heading.y;
};

for (const width of [1440, 390]) {
	test(`聊天外观切换保留气泡几何与设置布局 ${width}`, async ({ page }, testInfo) => {
		await page.setViewportSize({ width, height: 900 });
		await prepareChat(page);
		if (width < 768) await page.getByRole("button", { name: "返回会话列表" }).click();
		await page.getByRole("button", { name: "聊天外观", exact: true }).click();
		const workspace = page.getByRole("dialog", { name: "聊天外观", exact: true });
		await expect(workspace).toBeVisible();
		await workspace.evaluate(async (element) => {
			await Promise.all(
				element.getAnimations().map((animation) => animation.finished.catch(() => {})),
			);
		});
		const preview = workspace.getByRole("complementary", { name: "未保存的聊天外观预览" });
		const outgoing = preview.locator('[data-chat-bubble][data-side="outgoing"]');
		await expect(outgoing).toBeVisible();
		await page.evaluate(() => document.fonts.ready);
		const original = await geometry(outgoing);
		const originalGap = await settingsGap(workspace);
		const heading = workspace.getByRole("heading", { name: /^我的气泡/ });
		const previewBounds = await preview.boundingBox();
		const headingBounds = await heading.boundingBox();
		if (!previewBounds || !headingBounds) throw new Error("缺少预览或设置区域");
		if (width < 768) {
			expect(previewBounds.y + previewBounds.height).toBeLessThanOrEqual(headingBounds.y);
		} else {
			expect(headingBounds.x + headingBounds.width).toBeLessThanOrEqual(previewBounds.x);
		}

		const defaultScreenshot = testInfo.outputPath(`chat-appearance-${width}-season.png`);
		await page.screenshot({ path: defaultScreenshot });
		await testInfo.attach("默认气泡与工作区", {
			path: defaultScreenshot,
			contentType: "image/png",
		});
		await workspace.getByRole("button", { name: "更多装饰", exact: true }).click();
		const themes = workspace.getByRole("group", { name: "更多气泡主题", exact: true });
		await themes.getByRole("radio", { name: "夜间联机", exact: true }).check();
		await expect(outgoing).toHaveAttribute("data-chat-bubble-theme", "game-night");
		await outgoing.evaluate(async (element) => {
			const background = getComputedStyle(element, "::before").borderImageSource;
			const source = background.match(/^url\(["']?(.*?)["']?\)$/)?.[1];
			if (!source) throw new Error(`贴图气泡没有九宫格资源：${background}`);
			const images = [new Image(), ...element.querySelectorAll("img")];
			images[0].src = source;
			await Promise.all(
				images.map(async (image) => {
					try {
						await image.decode();
					} catch {
						throw new Error(`聊天外观资源无法加载：${image.src}`);
					}
				}),
			);
		});
		const themed = await geometry(outgoing);
		for (const key of ["width", "height", "textX", "textY"] as const) {
			expect(Math.abs(themed[key] - original[key]), `贴图款 ${key}`).toBeLessThanOrEqual(0.5);
		}
		expect(Math.abs((await settingsGap(workspace)) - originalGap)).toBeLessThanOrEqual(0.5);
		await preview.scrollIntoViewIfNeeded();
		const themedScreenshot = testInfo.outputPath(`chat-appearance-${width}-game-night.png`);
		await page.screenshot({ path: themedScreenshot });
		await testInfo.attach("贴图气泡与工作区", {
			path: themedScreenshot,
			contentType: "image/png",
		});

		await workspace
			.getByRole("group", { name: "我的气泡", exact: true })
			.getByRole("radio", { name: "纸片", exact: true })
			.check();
		await expect(outgoing).toHaveAttribute("data-chat-bubble-theme", "basic-paper");
		const basic = await geometry(outgoing);
		for (const key of ["width", "height", "textX", "textY"] as const) {
			expect(Math.abs(basic[key] - original[key]), `基础款 ${key}`).toBeLessThanOrEqual(0.5);
		}
		expect(Math.abs((await settingsGap(workspace)) - originalGap)).toBeLessThanOrEqual(0.5);
		expect(
			await workspace.evaluate((element) => element.scrollWidth - element.clientWidth),
		).toBeLessThanOrEqual(1);
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
		).toBeLessThanOrEqual(1);
		await preview.scrollIntoViewIfNeeded();
		const basicScreenshot = testInfo.outputPath(`chat-appearance-${width}-basic-paper.png`);
		await page.screenshot({ path: basicScreenshot });
		await testInfo.attach("基础气泡与工作区", {
			path: basicScreenshot,
			contentType: "image/png",
		});
	});
}
