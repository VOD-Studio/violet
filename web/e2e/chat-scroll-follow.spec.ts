import { expect, type Locator, test } from "@playwright/test";
import { prepareMessageDisplay } from "./chat-message-display-fixture";

const bottomDistance = (list: Locator) =>
	list.evaluate((element) => element.scrollHeight - element.scrollTop - element.clientHeight);

const trackReactionFrames = async (anchor: Locator, message: Locator, expectedCount: number) =>
	anchor.evaluateHandle(
		(element, { messageTestID, expectedCount }) => ({
			result: (async () => {
				const target = document.querySelector(`[data-testid="${messageTestID}"]`);
				if (!target) throw new Error("缺少回应目标");
				const viewport = element.closest('[data-testid="chat-message-list"]');
				const positions: { top: number; scrollTop: number; height: number }[] = [];
				const initialTop = element.getBoundingClientRect().top;
				let maximumShift = 0;
				let settledFrames = 0;
				for (let frame = 0; frame < 180; frame += 1) {
					// rAF 早于 ResizeObserver；在该帧绘制后读取用户实际看到的位置。
					await new Promise<void>((resolve) =>
						requestAnimationFrame(() => setTimeout(resolve, 0)),
					);
					positions.push({
						top: element.getBoundingClientRect().top,
						scrollTop: viewport?.scrollTop ?? 0,
						height: viewport?.scrollHeight ?? 0,
					});
					maximumShift = Math.max(
						maximumShift,
						Math.abs(element.getBoundingClientRect().top - initialTop),
					);
					settledFrames =
						target.querySelectorAll(".v-reaction__chip").length === expectedCount
							? settledFrames + 1
							: 0;
					if (settledFrames >= 6) return { maximumShift, initialTop, positions };
				}
				throw new Error("回应更新未完成");
			})(),
		}),
		{ messageTestID: await message.getAttribute("data-testid"), expectedCount },
	);

for (const width of [1440, 390]) {
	test(`新增和取消回应向上消化高度并保留下方消息 ${width}`, async ({ page }, testInfo) => {
		await page.setViewportSize({ width, height: 1000 });
		await prepareMessageDisplay(page, { withHistory: true });
		const list = page.getByTestId("chat-message-list");
		const last = page.getByTestId("chat-message-m35");
		await expect.poll(() => bottomDistance(list)).toBeLessThanOrEqual(2);
		const addReaction = async (message: Locator, anchor: Locator) => {
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
			if ((await bottomDistance(list)) <= 2) {
				await list.evaluate((element) => {
					element.scrollTop = element.scrollHeight - element.clientHeight - 2;
					element.dispatchEvent(new Event("scroll", { bubbles: true }));
				});
			}
			const frames = await trackReactionFrames(anchor, message, 1);
			await picker.getByRole("button", { name: /鼓掌/ }).click();
			await expect(message.locator(".v-reaction__chip")).toHaveCount(1);
			const sampled = await frames.evaluate((probe) => probe.result);
			expect(sampled.maximumShift, JSON.stringify(sampled)).toBeLessThanOrEqual(1);
			await frames.dispose();
		};
		const growing = page.getByTestId("chat-message-m31");
		await addReaction(growing, last);
		await expect
			.poll(() =>
				growing
					.locator("[data-chat-message-footer]")
					.evaluate((element) => element.clientHeight),
			)
			.toBeGreaterThanOrEqual(28);
		await expect.poll(() => bottomDistance(list)).toBeLessThanOrEqual(2);
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
		const reading = page.getByTestId("chat-message-m29");
		const following = page.getByTestId("chat-message-m30");
		const readingBefore = await reading.locator("[data-chat-bubble]").boundingBox();
		const followingBefore = await following.locator("[data-chat-bubble]").boundingBox();
		if (!readingBefore || !followingBefore) throw new Error("缺少连续历史消息");
		const historyDistance = await bottomDistance(list);
		const followingDisplacement = () =>
			following
				.locator("[data-chat-bubble]")
				.evaluate(
					(element, previousTop) =>
						Math.abs(element.getBoundingClientRect().top - previousTop),
					followingBefore.y,
				);
		await addReaction(reading, following);
		await expect
			.poll(() =>
				reading
					.locator("[data-chat-message-footer]")
					.evaluate((element) => element.clientHeight),
			)
			.toBeGreaterThanOrEqual(28);
		await expect.poll(followingDisplacement).toBeLessThanOrEqual(1);
		await expect
			.poll(() =>
				reading
					.locator("[data-chat-bubble]")
					.evaluate((element) => element.getBoundingClientRect().top),
			)
			.toBeLessThan(readingBefore.y - 1);
		await expect
			.poll(async () => Math.abs((await bottomDistance(list)) - historyDistance))
			.toBeLessThanOrEqual(1);
		const removalFrames = await trackReactionFrames(following, reading, 0);
		await reading.locator(".v-reaction__chip").click();
		await expect(reading.locator(".v-reaction__chip")).toHaveCount(0);
		const removalSampled = await removalFrames.evaluate((probe) => probe.result);
		expect(removalSampled.maximumShift, JSON.stringify(removalSampled)).toBeLessThanOrEqual(1);
		await removalFrames.dispose();
		await expect.poll(followingDisplacement).toBeLessThanOrEqual(1);
		await expect
			.poll(() =>
				reading
					.locator("[data-chat-bubble]")
					.evaluate(
						(element, previousTop) =>
							Math.abs(element.getBoundingClientRect().top - previousTop),
						readingBefore.y,
					),
			)
			.toBeLessThanOrEqual(1);
		await expect
			.poll(async () => Math.abs((await bottomDistance(list)) - historyDistance))
			.toBeLessThanOrEqual(1);
		await page.screenshot({
			path: testInfo.outputPath("reaction-history-anchor.png"),
			animations: "disabled",
		});
	});
}
