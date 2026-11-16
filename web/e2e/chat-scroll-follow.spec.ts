import { expect, type Locator, test } from "@playwright/test";
import { prepareMessageDisplay } from "./chat-message-display-fixture";

const bottomDistance = (list: Locator) =>
	list.evaluate((element) => element.scrollHeight - element.scrollTop - element.clientHeight);

for (const width of [1440, 390]) {
	test(`新增回应向上扩展并保留历史阅读位置 ${width}`, async ({ page }, testInfo) => {
		await page.setViewportSize({ width, height: 1000 });
		await prepareMessageDisplay(page, { withHistory: true });
		const list = page.getByTestId("chat-message-list");
		const last = page.getByTestId("chat-message-m35");
		await expect.poll(() => bottomDistance(list)).toBeLessThanOrEqual(2);
		const lastBefore = await last.boundingBox();
		if (!lastBefore) throw new Error("缺少底部消息");
		const addReaction = async (message: Locator) => {
			await message.hover();
			await message.getByRole("button", { name: "添加回应", exact: true }).click();
			const picker = page.getByRole("dialog", { name: "常用回应", exact: true });
			await expect(picker).toBeVisible();
			await picker.evaluate(async (element) => {
				const layer = element.parentElement;
				if (!layer) throw new Error("缺少回应浮层");
				await Promise.all(
					layer
						.getAnimations({ subtree: true })
						.filter(
							(animation) =>
								animation.effect?.getComputedTiming().endTime !== Infinity,
						)
						.map((animation) => animation.finished.catch(() => {})),
				);
			});
			await picker.getByRole("button", { name: /鼓掌/ }).click();
			await expect(message.locator(".v-reaction__chip")).toHaveCount(1);
		};
		const growing = page.getByTestId("chat-message-m31");
		await addReaction(growing);
		await expect
			.poll(() =>
				growing
					.locator("[data-chat-message-footer]")
					.evaluate((element) => element.clientHeight),
			)
			.toBeGreaterThanOrEqual(28);
		await expect.poll(() => bottomDistance(list)).toBeLessThanOrEqual(2);
		const lastAfter = await last.boundingBox();
		if (!lastAfter) throw new Error("回应后底部消息不可见");
		expect(Math.abs(lastAfter.y - lastBefore.y)).toBeLessThanOrEqual(1);
		await page.screenshot({
			path: testInfo.outputPath("reaction-bottom-anchor.png"),
			animations: "disabled",
		});

		const bottomTop = await list.evaluate((element) => element.scrollTop);
		await list.hover();
		await page.mouse.wheel(0, -240);
		await expect
			.poll(() => list.evaluate((element) => element.scrollTop))
			.toBeLessThan(bottomTop - 150);
		const reading = page.getByTestId("chat-message-m30");
		const readingBefore = await reading.locator("[data-chat-bubble]").boundingBox();
		if (!readingBefore) throw new Error("缺少历史阅读锚点");
		await addReaction(reading);
		await expect.poll(() => bottomDistance(list)).toBeGreaterThan(150);
		const readingAfter = await reading.locator("[data-chat-bubble]").boundingBox();
		if (!readingAfter) throw new Error("历史阅读锚点丢失");
		expect(Math.abs(readingAfter.y - readingBefore.y)).toBeLessThanOrEqual(1);
		await page.screenshot({
			path: testInfo.outputPath("reaction-history-anchor.png"),
			animations: "disabled",
		});
	});
}
