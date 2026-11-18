import { expect, type Page, test } from "@playwright/test";
import { loadClient } from "./client";
import { SCROLL_TWEET_ID } from "./mock-data.mjs";

const path = `/tweets/${SCROLL_TWEET_ID}`;
const lastComment = "滚动验收评论 8";
const scrollY = (page: Page) => page.evaluate(() => window.scrollY);

test.use({ reducedMotion: "reduce" });

test("滚到底仍能阅读侧栏，滚动侧栏不移动正文", async ({ page, context }) => {
	const height = 640;
	await page.setViewportSize({ width: 1440, height });
	await loadClient(context);
	await page.goto(path);
	const tweet = page.getByRole("article", { name: "scroll-reader 的推文" });
	const rail = page.getByRole("region", { name: "作者与引用" });
	const tail = page.getByText(lastComment, { exact: true });
	await expect(tail).toBeAttached();
	const tweetStart = await tweet.boundingBox();
	if (!tweetStart) throw new Error("未显示推文");

	await page.mouse.move(tweetStart.x + 40, 300);
	await page.mouse.wheel(0, 380);
	await expect.poll(() => scrollY(page)).toBeGreaterThan(300);
	const pinned = await rail.boundingBox();
	if (!pinned) throw new Error("未显示侧栏");

	const tailBox = await tail.boundingBox();
	if (!tailBox) throw new Error("未显示末条评论");
	await page.mouse.wheel(0, Math.ceil(tailBox.y + tailBox.height - height + 20));
	await expect(tail).toBeInViewport();
	await expect.poll(async () => (await rail.boundingBox())?.y).toBeCloseTo(pinned.y, 0);
	const documentTop = await scrollY(page);
	const leftTop = (await tail.boundingBox())?.y;

	await page.mouse.move(pinned.x + 48, pinned.y + 240);
	await page.mouse.wheel(0, 100);
	await expect.poll(() => rail.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
	const rightTop = await rail.evaluate((node) => node.scrollTop);
	await rail.focus();
	await page.keyboard.press("End");
	await expect.poll(() => rail.evaluate((node) => node.scrollTop)).toBeGreaterThan(rightTop);
	await expect(rail.getByText(/^引用 6：/)).toBeInViewport();
	await expect.poll(() => scrollY(page)).toBe(documentTop);
	await expect.poll(async () => (await tail.boundingBox())?.y).toBe(leftTop);
});

for (const width of [1440, 390]) {
	test(`${width}px 直接打开评论链接会在整页内定位，焦点可到评论入口`, async ({
		page,
		context,
	}) => {
		await page.setViewportSize({ width, height: 760 });
		await loadClient(context);
		await page.goto(`${path}#comments`);
		const comment = page.getByRole("button", { name: "登录后发表评论" });
		await expect(comment).toBeInViewport();
		await expect.poll(() => scrollY(page)).toBeGreaterThan(100);
		await comment.focus();
		await expect(comment).toBeFocused();
		await expect.poll(async () => (await comment.boundingBox())?.y ?? 0).toBeGreaterThan(80);
	});
}
