import { expect, type Locator, test } from "@playwright/test";
import { prepareChat } from "./chat-harness";

const bottomDistance = (list: Locator) =>
	list.evaluate((element) => element.scrollHeight - element.scrollTop - element.clientHeight);

for (const width of [1440, 390]) {
	test(`聊天布局、搜索与输入增高不破坏阅读位置 ${width}`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await prepareChat(page);
		const list = page.getByTestId("chat-message-list");
		const editor = page.getByRole("textbox", { name: "消息内容" });
		const shell = page.locator('[data-slot="rich-text-input"]');
		await expect.poll(() => bottomDistance(list)).toBeLessThanOrEqual(2);
		const initialHeight = await list.evaluate((element) => element.clientHeight);
		const inputBounds = await shell.boundingBox();
		if (!inputBounds) throw new Error("缺少输入区");
		for (const name of ["添加内容", "添加表情", "发送消息"]) {
			const button = await page.getByRole("button", { name, exact: true }).boundingBox();
			if (!button) throw new Error(`缺少操作：${name}`);
			expect(
				Math.abs(button.y + button.height / 2 - inputBounds.y - inputBounds.height / 2),
			).toBeLessThanOrEqual(1);
		}
		const draft = Array.from({ length: 28 }, (_, index) => `第 ${index + 1} 行草稿。`).join(
			"\n",
		);
		await editor.fill(draft);
		await expect
			.poll(() => list.evaluate((element) => element.clientHeight))
			.toBeLessThan(initialHeight);
		await expect.poll(() => bottomDistance(list)).toBeLessThanOrEqual(2);
		await editor.fill("");
		await expect.poll(() => bottomDistance(list)).toBeLessThanOrEqual(2);
		await list.evaluate((element) => {
			element.scrollTop = (element.scrollHeight - element.clientHeight) / 2;
			element.dispatchEvent(new Event("scroll", { bubbles: true }));
		});
		const historyTop = await list.evaluate((element) => element.scrollTop);
		await editor.fill(draft);
		await expect
			.poll(() => list.evaluate((element) => element.clientHeight))
			.toBeLessThan(initialHeight);
		expect(
			Math.abs((await list.evaluate((element) => element.scrollTop)) - historyTop),
		).toBeLessThanOrEqual(1);
		await editor.fill("");
		await expect
			.poll(() => list.evaluate((element) => element.clientHeight))
			.toBe(initialHeight);
		const beforeSearch = await list.evaluate((element) => ({
			height: element.clientHeight,
			top: element.scrollTop,
		}));
		await page.getByRole("button", { name: "搜索消息", exact: true }).click();
		await page.getByRole("searchbox", { name: "搜索消息内容" }).fill("记录");
		await expect(page.getByRole("dialog", { name: "消息搜索结果" })).toBeVisible();
		expect(
			await list.evaluate((element) => ({
				height: element.clientHeight,
				top: element.scrollTop,
			})),
		).toEqual(beforeSearch);
		await page.getByRole("button", { name: "关闭消息搜索" }).click();
		await expect(page.getByRole("button", { name: "搜索消息", exact: true })).toBeFocused();
		if (width < 768) await page.getByRole("button", { name: "返回会话列表" }).click();
		const sidebar = page.getByRole("region", { name: "会话列表内容" });
		const row = page.getByRole("button", { name: "回归群聊", exact: true });
		const bounds = await sidebar.boundingBox();
		const time = await row.locator("time").boundingBox();
		if (!bounds || !time) throw new Error("缺少会话摘要或时间");
		expect(time.x + time.width).toBeLessThanOrEqual(bounds.x + bounds.width);
		expect(await sidebar.evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(
			Math.ceil(bounds.width),
		);
	});
}

test("提及标签可退格删除并保留相邻文字", async ({ page }) => {
	await prepareChat(page);
	const editor = page.getByRole("textbox", { name: "消息内容" });
	const send = page.getByRole("button", { name: "发送消息", exact: true });
	await page.getByRole("button", { name: "添加内容", exact: true }).click();
	await page.getByRole("menuitem", { name: "提及成员", exact: true }).click();
	await page.getByRole("option", { name: /全体成员/ }).click();
	await expect(editor).toBeFocused();
	await expect(editor).toContainText("@所有人");
	await editor.press("Backspace");
	await expect(editor).toBeEmpty();
	await expect(send).toBeDisabled();

	await editor.type("保留 @lin");
	await expect(page.getByRole("option", { name: /林间/ })).toBeVisible();
	await editor.press("Enter");
	await editor.type("正文");
	await editor.press("Backspace");
	await expect(editor).toHaveText("保留 @林间 正");
	await editor.press("Backspace");
	await editor.press("Backspace");
	await expect(editor).toHaveText("保留");
	await editor.press("ControlOrMeta+z");
	await expect(editor).toContainText("@林间");
	await expect(editor).toContainText("保留");
});
