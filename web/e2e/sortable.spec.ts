import { expect, type Locator, test } from "@playwright/test";
import { loadClient } from "./client";

interface RowTransitionObservation {
	duration: number;
	moved: boolean;
}

type ObservedRow = HTMLElement & {
	sortableTransition?: RowTransitionObservation;
};

async function observeDisplacement(row: Locator) {
	await row.evaluate((element) => {
		element.addEventListener("transitionrun", (event) => {
			if (
				!(event instanceof TransitionEvent) ||
				event.target !== element ||
				event.propertyName !== "transform"
			) {
				return;
			}

			for (const animation of element.getAnimations()) {
				if (!(animation instanceof CSSTransition)) {
					continue;
				}
				if (
					animation.transitionProperty !== "transform" ||
					!(animation.effect instanceof KeyframeEffect)
				) {
					continue;
				}

				const frames = animation.effect.getKeyframes();
				const first = frames[0]?.transform;
				const last = frames.at(-1)?.transform;
				(element as ObservedRow).sortableTransition = {
					duration: Number(animation.effect.getComputedTiming().duration),
					moved: first !== undefined && last !== undefined && first !== last,
				};
			}
		});
	});
}

test("拖动纸片不越过列表，落点槽随目标移动，松手后才改变顺序", async ({ page, context }) => {
	await loadClient(context);
	await page.setViewportSize({ width: 1440, height: 1000 });
	await page.goto("/ui?open=sortable");
	await page.waitForLoadState("networkidle");
	const inspector = page.getByRole("dialog", { name: "拖拽排序", exact: true });
	const list = inspector.getByRole("list", { name: "章节顺序" });
	const rows = list.locator(".v-sortable__row");
	await expect(rows).toHaveCount(4);
	await page.evaluate(() => document.fonts.ready);
	const titles = list.locator(".v-sortable__content > div > span:last-child");
	const initial = await titles.allTextContents();
	const source = await list.locator(".v-sortable__handle").nth(2).boundingBox();
	const boundary = await list.boundingBox();
	if (!source || !boundary) {
		throw new Error("排序列表没有实际占地");
	}
	const displaced = rows.nth(3);
	await observeDisplacement(displaced);

	await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
	await page.mouse.down();
	await page.mouse.move(source.x + source.width / 2, boundary.y + boundary.height + 80, {
		steps: 16,
	});
	const lifted = list.locator("[data-lifted] .v-sortable__row");
	const marker = list.locator(".v-sortable__placeholder");
	await expect(lifted).toBeVisible();
	await expect(marker).toBeVisible();
	await expect
		.poll(async () => {
			const paper = await lifted.boundingBox();
			const slot = await marker.boundingBox();
			const currentBoundary = await list.boundingBox();
			if (!paper || !slot || !currentBoundary) {
				return null;
			}

			return {
				inside:
					paper.y >= currentBoundary.y - 1 &&
					paper.y + paper.height <= currentBoundary.y + currentBoundary.height + 1,
				atLastSlot:
					Math.abs(
						slot.y + slot.height - (currentBoundary.y + currentBoundary.height - 4),
					) <= 1,
			};
		})
		.toEqual({ inside: true, atLastSlot: true });
	await expect
		.poll(() =>
			displaced.evaluate((element) => {
				const transition = (element as ObservedRow).sortableTransition;
				if (!transition) {
					return false;
				}

				return transition.duration > 0 && transition.moved;
			}),
		)
		.toBe(true);
	await expect(titles).toHaveText(initial);

	await page.mouse.up();
	await expect(titles).toHaveText([initial[0], initial[1], initial[3], initial[2]]);
	await expect(marker).toHaveCount(0);
	await expect(inspector.locator(".v-sortable__announcement")).toHaveText("已放在第 4 位");
});

test("键盘取消恢复原位且不关闭检视台", async ({ page, context }) => {
	await loadClient(context);
	await page.goto("/ui?open=sortable");
	await page.waitForLoadState("networkidle");
	const inspector = page.getByRole("dialog", { name: "拖拽排序", exact: true });
	const list = inspector.getByRole("list", { name: "章节顺序" });
	const titles = list.locator(".v-sortable__content > div > span:last-child");
	await expect(titles).toHaveCount(4);
	const initial = await titles.allTextContents();
	const boundary = await list.boundingBox();
	if (!boundary) {
		throw new Error("排序列表没有实际占地");
	}
	const handle = list.locator(".v-sortable__handle").first();
	await handle.focus();
	await page.keyboard.press("Space");
	await expect(list.locator("[data-lifted]")).toHaveCount(1);
	await page.keyboard.press("ArrowDown");
	await expect
		.poll(async () =>
			list
				.locator(".v-sortable__placeholder")
				.evaluate((slot) => slot.getBoundingClientRect().top),
		)
		.toBeGreaterThan(boundary.y + 48);
	await page.keyboard.press("Escape");
	await expect(inspector).toBeVisible();
	await expect(titles).toHaveText(initial);
	await expect(list.locator(".v-sortable__placeholder")).toHaveCount(0);
	await expect(handle).toBeFocused();
});

test("拖动中滚动长列表，纸片仍受实时边界限制并落在末尾", async ({ page, context }) => {
	await loadClient(context);
	await page.setViewportSize({ width: 1440, height: 1000 });
	await page.goto("/ui?open=sortable");
	await page.waitForLoadState("networkidle");
	const inspector = page.getByRole("dialog", { name: "拖拽排序", exact: true });
	await inspector.getByRole("radio", { name: "长列表滚动", exact: true }).click();
	const viewport = inspector.getByRole("region", { name: "长章节目录" });
	const list = viewport.getByRole("list", { name: "章节顺序" });
	const titles = list.locator(".v-sortable__content > div > span:last-child");
	await expect(titles).toHaveCount(12);
	await page.evaluate(() => document.fonts.ready);
	const initial = await titles.allTextContents();
	const source = await list.locator(".v-sortable__handle").nth(1).boundingBox();
	const initialBoundary = await list.boundingBox();
	const viewportBox = await viewport.boundingBox();
	if (!source || !initialBoundary || !viewportBox) {
		throw new Error("长列表没有实际占地");
	}
	await expect.poll(() => viewport.evaluate((element) => element.scrollTop)).toBe(0);

	const pointerX = source.x + source.width / 2;
	const pointerY = source.y + source.height / 2;
	await page.mouse.move(pointerX, pointerY);
	await page.mouse.down();
	await page.mouse.move(pointerX, pointerY + 12, { steps: 4 });
	const lifted = list.locator("[data-lifted] .v-sortable__row");
	const marker = list.locator(".v-sortable__placeholder");
	await expect(lifted).toBeVisible();

	// 用滚轮驱动原生滚动，拖拽仍保持拿起状态。
	await page.mouse.wheel(0, 2000);
	await expect
		.poll(() =>
			viewport.evaluate((element) => ({
				scrolled: element.scrollTop > 0,
				atEnd:
					Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop) <= 1,
			})),
		)
		.toEqual({ scrolled: true, atEnd: true });
	await expect
		.poll(async () => {
			const current = await list.boundingBox();
			if (!current) {
				return false;
			}

			return current.y < initialBoundary.y;
		})
		.toBe(true);
	await expect(list.locator("[data-lifted]")).toHaveCount(1);

	await page.mouse.move(pointerX, viewportBox.y + viewportBox.height + 80, { steps: 16 });
	await expect
		.poll(async () => {
			const boundary = await list.boundingBox();
			const paper = await lifted.boundingBox();
			const slot = await marker.boundingBox();
			if (!boundary || !paper || !slot) {
				return null;
			}

			return {
				inside:
					paper.x >= boundary.x - 1 &&
					paper.x + paper.width <= boundary.x + boundary.width + 1 &&
					paper.y >= boundary.y - 1 &&
					paper.y + paper.height <= boundary.y + boundary.height + 1,
				atLastSlot:
					Math.abs(slot.y + slot.height - (boundary.y + boundary.height - 4)) <= 1,
			};
		})
		.toEqual({ inside: true, atLastSlot: true });
	await expect(titles).toHaveText(initial);

	await page.mouse.up();
	await expect(titles).toHaveText([initial[0], ...initial.slice(2), initial[1]]);
	await expect(marker).toHaveCount(0);
	await expect(inspector.locator(".v-sortable__announcement")).toHaveText("已放在第 12 位");
});

test("键盘放下后顺序更新，焦点跟随被移动章节", async ({ page, context }) => {
	await loadClient(context);
	await page.goto("/ui?open=sortable");
	await page.waitForLoadState("networkidle");
	const inspector = page.getByRole("dialog", { name: "拖拽排序", exact: true });
	const list = inspector.getByRole("list", { name: "章节顺序" });
	const titles = list.locator(".v-sortable__content > div > span:last-child");
	await expect(titles).toHaveCount(4);
	const initial = await titles.allTextContents();
	const boundary = await list.boundingBox();
	if (!boundary) {
		throw new Error("排序列表没有实际占地");
	}
	const handle = list.locator(".v-sortable__handle").first();
	await handle.focus();
	await page.keyboard.press("Space");
	await expect(list.locator("[data-lifted]")).toHaveCount(1);
	await page.keyboard.press("ArrowDown");
	await expect
		.poll(() =>
			list
				.locator(".v-sortable__placeholder")
				.evaluate((slot) => slot.getBoundingClientRect().top),
		)
		.toBeGreaterThan(boundary.y + 48);
	await page.keyboard.press("Space");
	await expect(titles).toHaveText([initial[1], initial[0], ...initial.slice(2)]);
	await expect(list.locator(".v-sortable__placeholder")).toHaveCount(0);
	await expect(inspector.locator(".v-sortable__announcement")).toHaveText("已放在第 2 位");
	const movedHandle = list.getByRole("button", {
		name: `移动 ${initial[0]}，在第 2 位，共 4 项`,
		exact: true,
	});
	await expect(movedHandle).toBeFocused();
	await expect(movedHandle).toBeEnabled();
});
