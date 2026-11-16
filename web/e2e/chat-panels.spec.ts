import { expect, type Locator, type Page, test } from "@playwright/test";
import { prepareChat } from "./chat-harness";

interface ExitSample {
	closedWithContent: boolean;
	animated: boolean;
	contentStable: boolean;
	unmounted: boolean;
}

declare global {
	interface Window {
		chatExitSample: Promise<ExitSample>;
	}
}

async function closeWithAnimation(page: Page, panel: Locator, close: Locator) {
	await panel.evaluate(async (element) => {
		await Promise.all(
			element.getAnimations().map((animation) => animation.finished.catch(() => {})),
		);
		const { promise, resolve } = Promise.withResolvers<ExitSample>();
		window.chatExitSample = promise;
		element.addEventListener(
			"click",
			() => {
				const content = element.textContent;
				const height = element.clientHeight;
				let frames = 0;
				let closedWithContent = false;
				let animated = false;
				let contentStable = true;
				const sample = () => {
					frames++;
					if (element.isConnected && element.getAttribute("data-state") === "closed") {
						closedWithContent = true;
						animated ||= element
							.getAnimations()
							.some((animation) => animation.playState === "running");
						contentStable &&=
							element.textContent === content && element.clientHeight === height;
					}
					if (element.isConnected && frames < 60) {
						requestAnimationFrame(sample);
					} else {
						resolve({
							closedWithContent,
							animated,
							contentStable,
							unmounted: !element.isConnected,
						});
					}
				};
				requestAnimationFrame(sample);
			},
			{ once: true },
		);
	});
	await close.click();
	expect(await page.evaluate(() => window.chatExitSample)).toEqual({
		closedWithContent: true,
		animated: true,
		contentStable: true,
		unmounted: true,
	});
}
for (const width of [1440, 390]) {
	test(`聊天弹层保留退场内容并在动画后卸载 ${width}`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await prepareChat(page);
		if (width < 768) await page.getByRole("button", { name: "返回会话列表" }).click();
		const create = page.getByRole("button", { name: "新建会话", exact: true });
		await create.click();
		const creation = page.getByRole("dialog", { name: "发起私聊" });
		await expect(creation.getByRole("button", { name: "选择 林间" })).toBeVisible();
		await closeWithAnimation(
			page,
			creation,
			creation.getByRole("button", { name: "关闭新建会话" }),
		);
		await expect(create).toBeFocused();
		await page.getByRole("button", { name: "聊天外观", exact: true }).click();
		const appearanceDialog = page.getByRole("dialog", { name: "聊天外观", exact: true });
		await expect(appearanceDialog.getByLabel("未保存的聊天外观预览")).toBeVisible();
		await closeWithAnimation(
			page,
			appearanceDialog,
			appearanceDialog.getByRole("button", { name: "关闭", exact: true }),
		);
		if (width < 768) await page.getByRole("button", { name: "回归群聊", exact: true }).click();
		await page.getByRole("button", { name: "打开会话详情" }).click();
		const details = page.getByRole("dialog", { name: "会话详情" });
		await expect(details.getByText("林间", { exact: true })).toBeVisible();
		await closeWithAnimation(
			page,
			details,
			details.getByRole("button", { name: "关闭", exact: true }),
		);
		await expect(page.getByRole("button", { name: "打开会话详情" })).toBeFocused();
	});
}
