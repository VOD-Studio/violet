import { expect, type Page, test } from "@playwright/test";
import { loadClient } from "./client";

/** 在陈列室的检视台里走近下拉面板展品，返回检视台对话框。 */
async function openDropdownExhibit(page: Page) {
	await page.goto("/ui?open=dropdown");
	await page.waitForLoadState("networkidle");
	const stage = page.getByRole("dialog", { name: "下拉面板" });
	await expect(stage).toBeFocused();
	return stage;
}

function pauseExit(element: Element) {
	const observer = new MutationObserver(() => {
		if (
			element.getAttribute("data-state") === "closed" &&
			element.getAttribute("data-handoff") === "true"
		) {
			for (const animation of element.getAnimations()) animation.pause();
			observer.disconnect();
		}
	});
	observer.observe(element, {
		attributes: true,
		attributeFilter: ["data-state", "data-handoff"],
	});
}

test("Dropdown 关闭中重入立即续开，不经过完全收起的帧", async ({ page, context }) => {
	await loadClient(context);
	await page.emulateMedia({ reducedMotion: "no-preference" });
	const stage = await openDropdownExhibit(page);
	const trigger = stage.getByRole("button", { name: "向上展开", exact: true });
	await trigger.hover();
	await expect(trigger).toHaveAttribute("aria-expanded", "true");
	const contentId = await trigger.getAttribute("aria-controls");
	if (!contentId) throw new Error("展开的 Dropdown 缺少面板关联");
	const content = page.locator(`[id="${contentId}"]`);
	await expect(content).toBeVisible();
	await expect
		.poll(() =>
			content.evaluate((element) =>
				element.getAnimations().some((a) => a.playState === "running"),
			),
		)
		.toBe(false);

	await page.mouse.move(1300, 800);
	await expect(trigger).toHaveAttribute("aria-expanded", "false");
	await content.evaluate((element) => {
		const closing = element
			.getAnimations()
			.find(
				(animation) =>
					animation.effect instanceof KeyframeEffect &&
					animation.effect.getKeyframes().some((frame) => "clipPath" in frame),
			);
		if (!closing?.effect) throw new Error("关闭期间没有可续接的裁剪动画");
		closing.pause();
		closing.currentTime = Number(closing.effect.getComputedTiming().duration) / 2;
	});

	const visibleHeight = () =>
		content.evaluate((element) => {
			const rect = element.getBoundingClientRect();
			let visible = 0;
			for (let y = Math.ceil(rect.top); y < rect.bottom; y++) {
				const hit = document.elementFromPoint(rect.left + rect.width / 2, y);
				if (hit && element.contains(hit)) visible++;
			}
			return visible;
		});
	const before = await visibleHeight();
	expect(before).toBeGreaterThan(0);
	await trigger.hover();
	await page.evaluate(
		() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
	);
	expect(await trigger.getAttribute("aria-expanded")).toBe("true");
	expect(await visibleHeight()).toBeGreaterThanOrEqual(before - 2);
	await expect.poll(visibleHeight).toBeGreaterThan(before);
	await page.mouse.move(1300, 800);
	await expect(content).toHaveCount(0);
});

test("Dropdown 同方向接力后的旧面板不再截获新面板的悬停", async ({ page, context }) => {
	await loadClient(context);
	await page.emulateMedia({ reducedMotion: "no-preference" });
	const stage = await openDropdownExhibit(page);
	const navigation = stage.getByRole("navigation", { name: "Dropdown 示例" });
	const guide = navigation.getByRole("link", { name: "指南", exact: true });
	const more = navigation.getByRole("button", { name: "更多", exact: true });
	await guide.hover();
	await expect(guide).toHaveAttribute("aria-expanded", "true");
	const sourceId = await guide.getAttribute("aria-controls");
	if (!sourceId) throw new Error("指南面板缺少关联");
	const source = page.locator(`[id="${sourceId}"]`);
	await expect
		.poll(() =>
			source.evaluate((element) =>
				element.getAnimations().some((a) => a.playState === "running"),
			),
		)
		.toBe(false);
	await source.evaluate(pauseExit);
	await more.hover();
	await expect(more).toHaveAttribute("aria-expanded", "true");
	const destinationId = await more.getAttribute("aria-controls");
	if (!destinationId) throw new Error("更多面板缺少关联");
	const destination = page.locator(`[id="${destinationId}"]`);
	const point = await destination.evaluate((element) => {
		for (const animation of element.getAnimations()) animation.pause();
		const rect = element.getBoundingClientRect();
		return { x: rect.left + rect.width / 2, y: rect.top + 20 };
	});
	await page.mouse.move(point.x, point.y);
	await page.evaluate(
		() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
	);
	expect(await guide.getAttribute("aria-expanded")).toBe("false");
	expect(await more.getAttribute("aria-expanded")).toBe("true");
	expect(
		await destination.evaluate((element, point) => {
			const hit = document.elementFromPoint(point.x, point.y);
			return hit !== null && element.contains(hit);
		}, point),
	).toBe(true);
	await source.evaluate((element) => {
		for (const animation of element.getAnimations()) animation.play();
	});
	await destination.evaluate((element) => {
		for (const animation of element.getAnimations()) animation.play();
	});
	await expect(source).toHaveCount(0);
	await expect(more).toHaveAttribute("aria-expanded", "true");
});

test("Dropdown 关闭期间开启减弱动态会立即释放面板", async ({ page, context }) => {
	await loadClient(context);
	await page.emulateMedia({ reducedMotion: "no-preference" });
	const stage = await openDropdownExhibit(page);
	const trigger = stage.getByRole("button", { name: "向上展开", exact: true });
	await trigger.hover();
	await expect(trigger).toHaveAttribute("aria-expanded", "true");
	const contentId = await trigger.getAttribute("aria-controls");
	if (!contentId) throw new Error("展开的 Dropdown 缺少面板关联");
	const content = page.locator(`[id="${contentId}"]`);
	await page.mouse.move(1300, 800);
	await expect(trigger).toHaveAttribute("aria-expanded", "false");
	await content.evaluate((element) => {
		for (const animation of element.getAnimations()) animation.pause();
	});
	await page.emulateMedia({ reducedMotion: "reduce" });
	await expect(content).toHaveCount(0);
	await trigger.hover();
	await expect(trigger).toHaveAttribute("aria-expanded", "true");
	expect(await content.evaluate((element) => element.getAnimations().length)).toBe(0);
	await page.mouse.move(1300, 800);
	await expect(content).toHaveCount(0);
});

test("Dropdown 播放中碰撞翻转后沿实际方位裁剪，不重启动画", async ({ page, context }) => {
	await loadClient(context);
	await page.setViewportSize({ width: 1440, height: 1000 });
	await page.emulateMedia({ reducedMotion: "no-preference" });
	const stage = await openDropdownExhibit(page);
	const trigger = stage
		.getByRole("navigation", { name: "Dropdown 示例" })
		.getByRole("link", { name: "指南", exact: true });
	await trigger.hover();
	await expect(trigger).toHaveAttribute("aria-expanded", "true");
	const contentId = await trigger.getAttribute("aria-controls");
	if (!contentId) throw new Error("指南面板缺少关联");
	const content = page.locator(`[id="${contentId}"]`);
	await expect(content).toHaveAttribute("data-side", "bottom");
	await content.evaluate((element) => {
		const animation = element
			.getAnimations()
			.find(
				(animation) =>
					animation.effect instanceof KeyframeEffect &&
					animation.effect.getKeyframes().some((frame) => "clipPath" in frame),
			);
		if (!animation?.effect) throw new Error("展开期间没有裁剪动画");
		animation.pause();
		animation.currentTime = Number(animation.effect.getComputedTiming().duration) / 2;
	});
	const visibleEnds = () =>
		content.evaluate((element) => {
			const rect = element.getBoundingClientRect();
			const hit = (y: number) => {
				const target = document.elementFromPoint(rect.left + rect.width / 2, y);
				return target !== null && element.contains(target);
			};
			return {
				upper: hit(rect.top + rect.height * 0.2),
				lower: hit(rect.bottom - rect.height * 0.2),
			};
		});
	expect(await visibleEnds()).toEqual({ upper: true, lower: false });
	const bottom = await trigger.evaluate((element) => element.getBoundingClientRect().bottom);
	await page.setViewportSize({ width: 1440, height: Math.ceil(bottom + 110) });
	await expect(content).toHaveAttribute("data-side", "top");
	expect(await visibleEnds()).toEqual({ upper: false, lower: true });
	await content.evaluate((element) => {
		for (const animation of element.getAnimations()) animation.play();
	});
	await page.mouse.move(1300, 50);
	await expect(content).toHaveCount(0);
});

test("Dropdown 变形中跨方向快速折返后回到当前锚点，不保留暂停的旧几何", async ({
	page,
	context,
}) => {
	await loadClient(context);
	await page.setViewportSize({ width: 1440, height: 1000 });
	await page.emulateMedia({ reducedMotion: "no-preference" });
	const stage = await openDropdownExhibit(page);
	const navigation = stage.getByRole("navigation", { name: "Dropdown 示例" });
	const guide = navigation.getByRole("link", { name: "指南", exact: true });
	const more = navigation.getByRole("button", { name: "更多", exact: true });
	await guide.hover();
	await expect(guide).toHaveAttribute("aria-expanded", "true");
	await more.hover();
	await expect(more).toHaveAttribute("aria-expanded", "true");
	const contentId = await more.getAttribute("aria-controls");
	if (!contentId) throw new Error("更多面板缺少关联");
	const content = page.locator(`[id="${contentId}"]`);
	await content.evaluate((element) => {
		const morph = element
			.getAnimations()
			.find(
				(animation) =>
					animation.effect instanceof KeyframeEffect &&
					animation.effect.getKeyframes().some((frame) => "transform" in frame),
			);
		if (!morph?.effect) throw new Error("接力期间没有几何动画");
		morph.pause();
		morph.currentTime = Number(morph.effect.getComputedTiming().duration) / 2;
	});
	await content.evaluate(pauseExit);
	await guide.hover();
	await expect(guide).toHaveAttribute("aria-expanded", "true");
	const guideId = await guide.getAttribute("aria-controls");
	if (!guideId) throw new Error("指南面板缺少关联");
	const guideContent = page.locator(`[id="${guideId}"]`);
	const bottom = await guide.evaluate((element) => element.getBoundingClientRect().bottom);
	await page.setViewportSize({ width: 1440, height: Math.ceil(bottom + 120) });
	await expect(guideContent).toHaveAttribute("data-side", "top");
	await expect(content).toHaveAttribute("data-side", "bottom");
	await more.hover();
	await expect(more).toHaveAttribute("aria-expanded", "true");
	await expect(content).toHaveAttribute("data-side", "bottom");
	await expect
		.poll(async () => {
			const anchor = await more.boundingBox();
			const panel = await content.boundingBox();
			if (!anchor || !panel) return Infinity;
			return Math.abs(panel.x - anchor.x);
		})
		.toBeLessThan(1);
	await page.mouse.move(1300, 50);
	await expect(content).toHaveCount(0);
});

test("Dropdown 共享高亮在快速折返中续接当前位置，菜单行保持静止", async ({ page, context }) => {
	await loadClient(context);
	await page.setViewportSize({ width: 1440, height: 1000 });
	await page.emulateMedia({ reducedMotion: "no-preference" });
	const stage = await openDropdownExhibit(page);
	const trigger = stage
		.getByRole("navigation", { name: "Dropdown 示例" })
		.getByRole("link", { name: "指南", exact: true });
	await trigger.hover();
	await expect(trigger).toHaveAttribute("aria-expanded", "true");
	const contentId = await trigger.getAttribute("aria-controls");
	if (!contentId) throw new Error("指南面板缺少关联");
	const content = page.locator(`[id="${contentId}"]`);
	const first = content.getByRole("link", { name: "快速入门", exact: true });
	const second = content.getByRole("link", { name: "设计原则", exact: true });
	const third = content.getByRole("link", { name: "版本记录", exact: true });
	const highlight = content.locator('[data-slot="dropdown-highlight"]');
	const offsetFrom = async (y: number) => {
		const rect = await highlight.boundingBox();
		return rect ? Math.abs(rect.y - y) : Infinity;
	};
	await first.hover();
	await expect(first).toHaveAttribute("data-highlighted", "");
	const firstRect = await first.boundingBox();
	const thirdRect = await third.boundingBox();
	if (!firstRect || !thirdRect) throw new Error("菜单行缺少可见几何");
	await expect.poll(() => offsetFrom(firstRect.y)).toBeLessThan(1);
	await page.evaluate(
		() =>
			new Promise<void>((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
			),
	);
	await third.hover();
	await highlight.evaluate((element) => {
		const movement = element
			.getAnimations()
			.find(
				(animation) =>
					animation.effect instanceof KeyframeEffect &&
					animation.effect.getKeyframes().some((frame) => "transform" in frame),
			);
		if (!movement?.effect) throw new Error("项切换缺少跟随动画");
		movement.pause();
		movement.currentTime = Number(movement.effect.getComputedTiming().duration) / 2;
	});
	const middle = await highlight.boundingBox();
	if (!middle) throw new Error("共享高亮缺少可见几何");
	expect(middle.y).toBeGreaterThan(firstRect.y + 1);
	expect(middle.y).toBeLessThan(thirdRect.y - 1);
	await second.hover();
	await highlight.evaluate((element) => {
		const movement = element
			.getAnimations()
			.find(
				(animation) =>
					animation.effect instanceof KeyframeEffect &&
					animation.effect.getKeyframes().some((frame) => "transform" in frame),
			);
		if (!movement) throw new Error("折返缺少续接动画");
		movement.pause();
		movement.currentTime = 0;
	});
	const resumed = await highlight.boundingBox();
	if (!resumed) throw new Error("折返高亮缺少可见几何");
	expect(Math.abs(resumed.y - middle.y)).toBeLessThan(1);
	await highlight.evaluate((element) => {
		for (const animation of element.getAnimations()) animation.play();
	});
	const secondRect = await second.boundingBox();
	if (!secondRect) throw new Error("目标行缺少可见几何");
	await expect.poll(() => offsetFrom(secondRect.y)).toBeLessThan(1);
	await expect(second).toHaveAttribute("data-highlighted", "");
	await expect(first).not.toHaveAttribute("data-highlighted");
	await expect(third).not.toHaveAttribute("data-highlighted");
	expect(await first.boundingBox()).toEqual(firstRect);
	expect(await third.boundingBox()).toEqual(thirdRect);
	await trigger.focus();
	await page.keyboard.press("Tab");
	await expect(first).toBeFocused();
	await expect.poll(() => offsetFrom(firstRect.y)).toBeLessThan(1);
	await expect(highlight).toHaveCSS("opacity", "1");
	await expect(first).toHaveAttribute("data-highlighted", "");
	await expect(second).not.toHaveAttribute("data-highlighted");
	await page.keyboard.press("Tab");
	await expect(second).toBeFocused();
	await expect.poll(() => offsetFrom(secondRect.y)).toBeLessThan(1);
	await expect(second).toHaveAttribute("data-highlighted", "");
	await expect(first).not.toHaveAttribute("data-highlighted");
	await expect(trigger).toHaveAttribute("aria-expanded", "true");
});

test("Dropdown 减弱动态下高亮立即跟随，并忽略禁用项", async ({ page, context }) => {
	await loadClient(context);
	await page.emulateMedia({ reducedMotion: "reduce" });
	const stage = await openDropdownExhibit(page);
	const trigger = stage
		.getByRole("navigation", { name: "Dropdown 示例" })
		.getByRole("link", { name: "指南", exact: true });
	await trigger.hover();
	await expect(trigger).toHaveAttribute("aria-expanded", "true");
	const contentId = await trigger.getAttribute("aria-controls");
	if (!contentId) throw new Error("指南面板缺少关联");
	const content = page.locator(`[id="${contentId}"]`);
	const first = content.getByRole("link", { name: "快速入门", exact: true });
	const third = content.getByRole("link", { name: "版本记录", exact: true });
	const highlight = content.locator('[data-slot="dropdown-highlight"]');
	await first.hover();
	await third.hover();
	const row = await third.boundingBox();
	const background = await highlight.boundingBox();
	if (!row || !background) throw new Error("高亮缺少可见几何");
	expect(Math.abs(row.y - background.y)).toBeLessThan(1);
	expect(await highlight.evaluate((element) => element.getAnimations().length)).toBe(0);
	await third.evaluate((element) => element.setAttribute("aria-disabled", "true"));
	await expect(highlight).toHaveCSS("opacity", "0");
	await expect(third).not.toHaveAttribute("data-highlighted");
	await first.hover();
	await third.hover();
	await expect(highlight).toHaveCSS("opacity", "0");
	await trigger.focus();
	await page.keyboard.press("Tab");
	await expect(first).toBeFocused();
	await expect(highlight).toHaveCSS("opacity", "1");
	await first.evaluate((element) => element.setAttribute("aria-disabled", "true"));
	await expect(highlight).toHaveCSS("opacity", "0");
	await expect(first).not.toHaveAttribute("data-highlighted");
	await expect(trigger).toHaveAttribute("aria-expanded", "true");
});

test("Dropdown 穿过项间空隙与面板留白时保留高亮，真正离开后才清理", async ({ page, context }) => {
	await loadClient(context);
	await page.setViewportSize({ width: 1440, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	const stage = await openDropdownExhibit(page);
	const trigger = stage
		.getByRole("navigation", { name: "Dropdown 示例" })
		.getByRole("link", { name: "指南", exact: true });
	await trigger.hover();
	await expect(trigger).toHaveAttribute("aria-expanded", "true");
	const contentId = await trigger.getAttribute("aria-controls");
	if (!contentId) throw new Error("指南面板缺少关联");
	const content = page.locator(`[id="${contentId}"]`);
	const first = content.getByRole("link", { name: "快速入门", exact: true });
	const second = content.getByRole("link", { name: "设计原则", exact: true });
	const highlight = content.locator('[data-slot="dropdown-highlight"]');
	await first.hover();
	await expect(highlight).toHaveCSS("opacity", "1");
	const firstRect = await first.boundingBox();
	const secondRect = await second.boundingBox();
	const panelRect = await content.boundingBox();
	const triggerRect = await trigger.boundingBox();
	if (!firstRect || !secondRect || !panelRect || !triggerRect) {
		throw new Error("菜单缺少可见几何");
	}
	const firstBottom = firstRect.y + firstRect.height;
	expect(secondRect.y).toBeGreaterThan(firstBottom);
	await page.mouse.move(firstRect.x + firstRect.width / 2, (firstBottom + secondRect.y) / 2);
	await expect(highlight).toHaveCSS("opacity", "1");
	await expect(first).toHaveAttribute("data-highlighted", "");
	expect(await highlight.boundingBox()).toEqual(firstRect);
	await page.mouse.move((panelRect.x + firstRect.x) / 2, firstRect.y + firstRect.height / 2);
	await expect(highlight).toHaveCSS("opacity", "1");
	expect(await highlight.boundingBox()).toEqual(firstRect);
	await second.hover();
	await expect(second).toHaveAttribute("data-highlighted", "");
	await expect(first).not.toHaveAttribute("data-highlighted");
	await expect(highlight).toHaveCSS("opacity", "1");
	expect(await highlight.boundingBox()).toEqual(secondRect);
	const triggerBottom = triggerRect.y + triggerRect.height;
	expect(panelRect.y).toBeGreaterThan(triggerBottom);
	await page.mouse.move(triggerRect.x + triggerRect.width / 2, (triggerBottom + panelRect.y) / 2);
	await trigger.hover();
	await expect(highlight).toHaveCSS("opacity", "1");
	await expect(second).toHaveAttribute("data-highlighted", "");
	expect(await highlight.boundingBox()).toEqual(secondRect);
	await expect(trigger).toHaveAttribute("aria-expanded", "true");
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await content.evaluate((element) => {
		const observer = new MutationObserver(() => {
			if (element.getAttribute("data-state") === "closed") {
				for (const animation of element.getAnimations()) animation.pause();
				observer.disconnect();
			}
		});
		observer.observe(element, { attributes: true, attributeFilter: ["data-state"] });
	});
	await page.mouse.move(1300, 800);
	await expect(content).toHaveAttribute("data-state", "closed");
	await expect(content).toHaveCount(1);
	await expect(highlight).toHaveCSS("opacity", "0");
	await expect(second).not.toHaveAttribute("data-highlighted");
	await content.evaluate((element) => {
		for (const animation of element.getAnimations()) animation.play();
	});
	await expect(content).toHaveCount(0);
});
