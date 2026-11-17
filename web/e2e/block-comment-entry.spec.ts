import { expect, test } from "@playwright/test";
import { loadClient } from "./client";
import { openClientPage } from "./support.ts";

const PATH = "/blog/contract-rich-code";
const TOC_PATH = "/blog/contract-rich-toc";

test("桌面键盘不需悬停即可发起段评，关闭后焦点回到入口", async ({ page, context }) => {
	await loadClient(context);
	await openClientPage(page, PATH);
	const entry = page.getByRole("button", { name: /^发表段评/ });
	await expect(entry).toHaveCount(1);
	await entry.focus();
	await expect(entry).toHaveAttribute("data-show", "true");
	await expect(entry).toHaveAccessibleName(/^发表段评：.+/);
	const first = await entry.getAttribute("aria-label");
	await page.keyboard.press("ArrowDown");
	await expect(entry).not.toHaveAttribute("aria-label", first ?? "");
	// 代码块不是可段评段落：方向键只在文字段落之间移动
	await expect(entry).not.toHaveAccessibleName(/recoveryMessage/);
	const target = await entry.getAttribute("aria-label");

	await page.keyboard.press("Enter");
	const composer = page.getByRole("dialog", { name: "发表段评" });
	await expect(composer).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(composer).toHaveCount(0);
	await expect(entry).toBeFocused();
	await expect(entry).toHaveAttribute("aria-label", target ?? "");
});

test("鼠标点开段评后点外部关闭，悬停照常跟随新段落", async ({ page, context }) => {
	await loadClient(context);
	await openClientPage(page, TOC_PATH);
	const entry = page.getByRole("button", { name: /^发表段评/ });
	const paragraph = (text: string) =>
		page.locator("[data-article-content] p").filter({ hasText: text });

	// 可批注块注册完成前入口不在 Tab 顺序中，此时悬停可能先于正文事件订阅。
	await expect(entry).toHaveAttribute("tabindex", "0");
	await paragraph("增强恢复后，这段结尾仍是原来的节点。").hover();
	await expect(entry).toHaveAttribute("data-show", "true");
	await expect(entry).toHaveAccessibleName("发表段评：增强恢复后，这段结尾仍是原来的节点。");
	await entry.click();
	const composer = page.getByRole("dialog", { name: "发表段评" });
	// 浮层外壳先于懒加载表单挂载，不能只凭外壳可见就派发外部点击。
	await expect(composer.getByRole("textbox", { name: "段评内容" })).toBeFocused();
	// 指针仍在原段落时关闭浮层，入口继续属于这一段；移出正文仍遵守正常的延迟隐藏。
	await paragraph("增强恢复后，这段结尾仍是原来的节点。").click();
	await expect(page.locator('[role="dialog"][aria-label="发表段评"]')).toHaveCount(0);
	await expect(entry).not.toBeFocused();
	await expect(entry).toHaveAttribute("data-show", "true");
	await expect(entry).toHaveAccessibleName("发表段评：增强恢复后，这段结尾仍是原来的节点。");

	// 悬停其他段落：入口立即跟随
	await paragraph("键盘焦点保持可见").first().hover();
	await expect(entry).toHaveAccessibleName(/发表段评：键盘焦点保持可见/);
	await page.getByRole("heading", { level: 1, name: "富内容故障契约：toc" }).click();
	await expect(entry).not.toHaveAttribute("data-show", "true");
});

test.describe("390px 手机", () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

	test("点按段落出现段评入口，点按代码块不出现", async ({ page, context }) => {
		await loadClient(context);
		await openClientPage(page, TOC_PATH);
		const entry = page.getByRole("button", { name: /^发表段评/ });
		// 长文中部有足够滚动空间，避免短文在视口顶部被夹住，未真正抵达碰撞位置。
		const paragraph = page
			.locator("[data-article-content] p")
			.filter({ hasText: "键盘焦点保持可见，不被滚动区域裁剪。" })
			.nth(10);
		// 触屏入口在首次点按前由 CSS 隐藏；先检查已注册，点按后仍通过正常可访问查询操作。
		await expect(
			page.getByRole("button", { name: /^发表段评/, includeHidden: true }),
		).toHaveAttribute("tabindex", "0");
		const occluder = page.locator("[data-annotation-occluder]");
		const controls = await occluder.boundingBox();
		if (!controls) {
			throw new Error("文章浮动操作组没有占地");
		}
		const dimensions = await page
			.getByRole("button", { name: /^发表段评/, includeHidden: true })
			.evaluate((element) => {
				const style = getComputedStyle(element);
				return {
					width: Number.parseFloat(style.width),
					height: Number.parseFloat(style.height),
				};
			});
		// 仅用正文几何建立碰撞前提；避让后的结果由实际按钮占地与命中检测验证。
		const unshiftedPosition = () =>
			paragraph.evaluate((element, size) => {
				const content = element.closest<HTMLElement>("[data-article-content]");
				if (!content) {
					throw new Error("段落不在文章正文中");
				}
				const bounds = content.getBoundingClientRect();
				const block = element.getBoundingClientRect();
				const range = document.createRange();
				range.selectNodeContents(element);
				const lines = range.getClientRects();
				const last = lines[lines.length - 1];
				const inline = last && last.right + 6 + size.width <= bounds.right;
				return {
					x: inline ? last.right + 6 : bounds.right - size.width,
					y: inline ? last.top + (last.height - size.height) / 2 : block.bottom + 4,
					...size,
				};
			}, dimensions);
		const initial = await unshiftedPosition();
		const targetTop = controls.y + (controls.height - dimensions.height) / 2;
		await paragraph.evaluate((_element, distance) => {
			window.scrollBy({ top: distance, behavior: "instant" });
		}, initial.y - targetTop);
		const candidate = await unshiftedPosition();
		const collisionBounds = await occluder.boundingBox();
		if (!collisionBounds) {
			throw new Error("滚动后文章浮动操作组没有占地");
		}
		expect(Math.abs(candidate.y - targetTop)).toBeLessThanOrEqual(1);
		expect(candidate.x).toBeLessThan(collisionBounds.x + collisionBounds.width);
		expect(candidate.x + candidate.width).toBeGreaterThan(collisionBounds.x);
		expect(candidate.y).toBeLessThan(collisionBounds.y + collisionBounds.height);
		expect(candidate.y + candidate.height).toBeGreaterThan(collisionBounds.y);
		await paragraph.tap();
		await expect(entry).toHaveAttribute("data-show", "true");
		await expect(entry).toBeVisible();
		await expect(entry).toHaveAccessibleName("发表段评：键盘焦点保持可见，不被滚动区域裁剪。");
		// 等待真实按钮落到段落下方；中心可命中并不表示现有 top 过渡已经结束。
		await expect
			.poll(async () => {
				const [box, text, obstacle] = await Promise.all([
					entry.boundingBox(),
					paragraph.boundingBox(),
					occluder.boundingBox(),
				]);
				if (!box || !text || !obstacle) {
					return null;
				}
				return {
					inside: box.x >= text.x && box.x + box.width <= text.x + text.width,
					below: box.y >= text.y + text.height + 3.5,
					clear:
						box.x + box.width <= obstacle.x ||
						box.x >= obstacle.x + obstacle.width ||
						box.y + box.height <= obstacle.y ||
						box.y >= obstacle.y + obstacle.height,
				};
			})
			.toEqual({ inside: true, below: true, clear: true });
		await expect
			.poll(() =>
				entry.evaluate((element) => {
					const rect = element.getBoundingClientRect();
					const hit = document.elementFromPoint(
						rect.x + rect.width / 2,
						rect.y + rect.height / 2,
					);
					return hit !== null && element.contains(hit);
				}),
			)
			.toBe(true);
		await page.screenshot({ path: test.info().outputPath("mobile-entry.png") });

		const composer = page.getByRole("dialog", { name: "发表段评" });
		await entry.tap();
		await expect(composer).toBeVisible();
		await expect(composer.getByRole("textbox", { name: "段评内容" })).toBeFocused();
		await page.keyboard.press("Escape");

		await page.locator("[data-article-content] pre").first().tap();
		await expect(entry).not.toHaveAttribute("data-show", "true");
	});
});
