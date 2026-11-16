import { expect, test } from "@playwright/test";
import { prepareMessageDisplay } from "./chat-message-display-fixture";

test.use({ timezoneId: "UTC" });

for (const width of [1440, 390]) {
	test(`连续消息压缩元信息且操作不遮挡正文 ${width}`, async ({ page }, testInfo) => {
		await page.setViewportSize({ width, height: 1000 });
		await prepareMessageDisplay(page);
		const first = page.getByTestId("chat-message-m31");
		const next = page.getByTestId("chat-message-m32");
		for (const item of [first, next]) {
			const width = await item
				.locator("[data-chat-bubble]")
				.evaluate((element) => element.getBoundingClientRect().width);
			expect(width).toBeGreaterThanOrEqual(72);
			await expect(item.locator("time")).toHaveCount(0);
			expect(
				await item
					.locator("[data-chat-message-footer]")
					.evaluate((element) => element.clientHeight),
			).toBe(0);
		}
		const [start, middle, end] = await Promise.all(
			["m31", "m32", "m33"].map((id) =>
				page
					.getByTestId(`chat-message-${id}`)
					.locator("[data-chat-bubble]")
					.evaluate((bubble) => {
						const style = getComputedStyle(bubble);
						return {
							top: parseFloat(style.borderTopRightRadius),
							bottom: parseFloat(style.borderBottomRightRadius),
						};
					}),
			),
		);
		expect(start.top).toBeGreaterThan(start.bottom);
		expect(middle.top).toBe(middle.bottom);
		expect(middle.top).toBeLessThan(start.top);
		expect(end.bottom).toBeGreaterThan(end.top);
		for (const id of ["m30", "m33", "m34", "m35"]) {
			const item = page.getByTestId(`chat-message-${id}`);
			await expect(item.locator("time")).toHaveCount(1);
			const bubble = await item.locator("[data-chat-bubble]").boundingBox();
			const meta = await item.locator("[data-chat-message-meta]").boundingBox();
			if (!bubble || !meta) throw new Error("缺少消息气泡或组尾元信息");
			expect(meta.y).toBeGreaterThanOrEqual(bubble.y + bubble.height);
		}
		const bot = page.getByTestId("chat-message-m34");
		const chipSurfaces = await bot.locator(".v-reaction__chip").evaluateAll((chips) =>
			chips.map((chip) => {
				let parent = chip.parentElement;
				let backdrop = "";
				while (parent) {
					const color = getComputedStyle(parent).backgroundColor;
					if (color !== "rgba(0, 0, 0, 0)" && color !== "transparent") {
						backdrop = color;
						break;
					}
					parent = parent.parentElement;
				}
				return {
					self: chip.getAttribute("aria-pressed") === "true",
					background: getComputedStyle(chip).backgroundColor,
					backdrop,
				};
			}),
		);
		const own = chipSurfaces.find((chip) => chip.self);
		if (!own) throw new Error("缺少本人回应样本");
		for (const other of chipSurfaces.filter((chip) => !chip.self)) {
			expect(other.background).not.toBe(other.backdrop);
			expect(other.background).not.toBe(own.background);
			expect(other.background).not.toBe("rgba(0, 0, 0, 0)");
		}
		await page.screenshot({
			path: testInfo.outputPath("message-groups.png"),
			animations: "disabled",
		});
		for (const [id, mine] of [
			["m30", false],
			["m31", true],
		] as const) {
			const item = page.getByTestId(`chat-message-${id}`);
			await item.hover();
			const more = item.getByRole("button", { name: "消息操作", exact: true });
			const bubble = await item.locator("[data-chat-bubble]").boundingBox();
			const button = await more.boundingBox();
			if (!bubble || !button) throw new Error("缺少消息操作入口");
			if (mine) {
				expect(button.x + button.width).toBeLessThanOrEqual(bubble.x);
			} else {
				expect(button.x).toBeGreaterThanOrEqual(bubble.x + bubble.width);
			}
			await more.press("Enter");
			const menu = page.getByRole("menu");
			await expect(menu).toBeVisible();
			await expect(menu.getByRole("menuitem", { name: "编辑消息", exact: true })).toHaveCount(
				mine ? 1 : 0,
			);
			await menu.press("Escape");
			await expect(more).toBeFocused();
			await more.click();
			await expect(menu).toBeVisible();
			await menu.evaluate(async (element) => {
				await Promise.all(
					element
						.getAnimations({ subtree: true })
						.filter(
							(animation) =>
								animation.effect?.getComputedTiming().endTime !== Infinity,
						)
						.map((animation) => animation.finished.catch(() => {})),
				);
			});
			await page.mouse.click(2, 2);
			await page.mouse.move(width / 2, 10);
			await expect(menu).toBeHidden();
			await expect(more.locator("..")).toHaveCSS("opacity", "0");
		}
		await first.getByRole("button", { name: "消息操作", exact: true }).press("Enter");
		await page.getByRole("menuitem", { name: "1 人已读", exact: true }).click();
		const readers = page.getByRole("dialog", { name: "已读成员", exact: true });
		await expect(readers).toBeVisible();
		await readers.getByRole("button", { name: "提及 林间", exact: true }).click();
		const composer = page.getByRole("textbox", { name: "消息内容", exact: true });
		await expect(composer).toBeFocused();
		await expect(composer).toContainText("@林间");
		await first.hover();
		await first.getByRole("button", { name: "消息操作", exact: true }).click();
		await page.getByRole("menuitem", { name: "编辑消息", exact: true }).click();
		const editor = first.getByRole("textbox");
		await expect(editor).toBeFocused();
		await editor.press("Escape");
		const peer = page.getByTestId("chat-message-m30");
		await peer.hover();
		await peer.getByRole("button", { name: "消息操作", exact: true }).click();
		await page.getByRole("menuitem", { name: "回复消息", exact: true }).click();
		await expect(composer).toBeFocused();
		if (width === 390) {
			const session = await page.context().newCDPSession(page);
			await session.send("Emulation.setTouchEmulationEnabled", { enabled: true });
			const bubble = peer.locator("[data-chat-bubble]");
			await bubble.scrollIntoViewIfNeeded();
			const bounds = await bubble.boundingBox();
			if (!bounds) throw new Error("缺少长按消息");
			await session.send("Input.dispatchTouchEvent", {
				type: "touchStart",
				touchPoints: [{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }],
			});
			await expect(page.getByRole("menu")).toBeVisible();
			await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
			await page.getByRole("menu").press("Escape");
			await session.detach();
		}
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true,
		);
		await page.screenshot({
			path: testInfo.outputPath("message-actions.png"),
			animations: "disabled",
		});
	});
}
