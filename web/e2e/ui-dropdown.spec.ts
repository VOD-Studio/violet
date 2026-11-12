import { createRequire } from "node:module";
import { resolve } from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";

const { build } = createRequire(new URL("../packages/ui/package.json", import.meta.url))("esbuild");
let fixtureScript = "";
let fixtureStyles = "";

test.beforeAll(async () => {
	const resolveDir = resolve(import.meta.dirname, "..");
	const [script, styles] = await Promise.all([
		build({
			stdin: {
				resolveDir,
				loader: "tsx",
				contents: `
import { createRoot } from "react-dom/client";
import { Dropdown, DropdownContent, DropdownGroup, DropdownItem, DropdownTrigger } from "@violet/ui";
const guides = ["快速入门", "设计原则", "版本记录"];
const actions = ["复制链接", "查看源码"];
const triggerStyle = { height: 36, padding: "0 16px", display: "inline-flex", alignItems: "center" };
function Entries({ items, rowHeight = 64 }) {
  return items.map((label, index) => <DropdownItem key={label} asChild>
    <a href={"#entry-" + index} style={{ minHeight: rowHeight }} onClick={(event) => { event.preventDefault(); }}>{label}</a>
  </DropdownItem>);
}
createRoot(document.getElementById("fixture")).render(<>
  <DropdownGroup>
    <nav aria-label="文档导航" style={{ display: "flex", gap: 8 }}>
      <Dropdown>
        <DropdownTrigger asChild><a href="#guides" style={triggerStyle}>指南</a></DropdownTrigger>
        <DropdownContent side="bottom" align="start" style={{ width: 280 }}><Entries items={guides} /></DropdownContent>
      </Dropdown>
      <Dropdown>
        <DropdownTrigger style={triggerStyle}>更多</DropdownTrigger>
        <DropdownContent side="bottom" align="start" style={{ width: 280 }}><Entries items={actions} rowHeight={40} /></DropdownContent>
      </Dropdown>
    </nav>
  </DropdownGroup>
  <Dropdown>
    <DropdownTrigger style={{ ...triggerStyle, alignSelf: "start" }}>向上展开</DropdownTrigger>
    <DropdownContent side="top" align="start" style={{ width: 280 }}><Entries items={actions} rowHeight={40} /></DropdownContent>
  </Dropdown>
</>);
`,
			},
			bundle: true,
			format: "iife",
			platform: "browser",
			jsx: "automatic",
			write: false,
			logLevel: "error",
			define: { "process.env.NODE_ENV": '"development"' },
		}),
		build({
			stdin: {
				resolveDir,
				loader: "css",
				contents:
					'@import "@violet/ui/tokens.css"; @import "@violet/ui/components/dropdown.css";',
			},
			bundle: true,
			write: false,
			logLevel: "error",
		}),
	]);
	fixtureScript = script.outputFiles[0].text;
	fixtureStyles = styles.outputFiles[0].text;
});

interface RecordedAnimation {
	duration: number;
	keys: string[];
	moves: boolean;
}

declare global {
	interface Window {
		__float?: Animation;
		__anims?: RecordedAnimation[];
	}
}

async function mountFixture(page: Page) {
	await page.setContent(
		'<main id="fixture" style="position:absolute;top:320px;left:400px;width:320px;height:260px;display:flex;flex-direction:column;justify-content:space-between"></main>',
	);
	await page.addStyleTag({ content: fixtureStyles });
	await page.addScriptTag({ content: fixtureScript });
	const fixture = page.locator("#fixture");
	await expect(fixture.getByRole("link", { name: "指南", exact: true })).toBeVisible();
	return fixture;
}

function pauseExit(element: Element) {
	const observer = new MutationObserver(() => {
		if (
			element.getAttribute("data-state") === "closed" &&
			element.getAttribute("data-handoff") === "true"
		) {
			for (const animation of element.getAnimations()) {
				animation.pause();
			}
			observer.disconnect();
		}
	});
	observer.observe(element, {
		attributes: true,
		attributeFilter: ["data-state", "data-handoff"],
	});
}

/** 把进行中的浮出动画停在一半，并留一个引用以便之后核对没有被重建。 */
function pauseFloatAtHalf(element: Element) {
	const animation = element
		.getAnimations()
		.find(
			(candidate) =>
				candidate.effect instanceof KeyframeEffect &&
				candidate.effect.getKeyframes().some((frame) => "opacity" in frame) &&
				candidate.effect.getKeyframes().every((frame) => !("width" in frame)),
		);
	if (!animation?.effect) {
		throw new Error("没有进行中的浮出动画");
	}
	animation.pause();
	animation.currentTime = Number(animation.effect.getComputedTiming().duration) / 2;
	window.__float = animation;
}

/** 面板此刻的透明度与竖直位移（含正在播放的动画）。 */
const pose = (content: Locator) =>
	content.evaluate((element) => {
		const style = getComputedStyle(element);
		return { opacity: Number(style.opacity), y: new DOMMatrix(style.transform).m42 };
	});

const highlightOpacity = (highlight: Locator) =>
	highlight.evaluate((element) => getComputedStyle(element, "::before").opacity);

const highlightBox = (highlight: Locator) =>
	highlight.evaluate((element) => {
		const bounds = element.getBoundingClientRect();
		const style = getComputedStyle(element, "::before");
		const transform = new DOMMatrix(style.transform);
		return {
			x: bounds.x + element.clientLeft - element.scrollLeft + transform.m41,
			y: bounds.y + element.clientTop - element.scrollTop + transform.m42,
			width: Number.parseFloat(style.width),
			height: Number.parseFloat(style.height),
		};
	});

function boxDistance(
	actual: { x: number; y: number; width: number; height: number },
	expected: { x: number; y: number; width: number; height: number },
) {
	return Math.max(
		Math.abs(actual.x - expected.x),
		Math.abs(actual.y - expected.y),
		Math.abs(actual.width - expected.width),
		Math.abs(actual.height - expected.height),
	);
}

/** 记录页面里此后创建的所有 Web Animation，用来核对短暂的动画时长。 */
async function recordAnimations(page: Page) {
	await page.evaluate(() => {
		const log: RecordedAnimation[] = [];
		window.__anims = log;
		const original = Element.prototype.animate;
		Element.prototype.animate = function (keyframes, options) {
			const frames = keyframes as Keyframe[];
			const duration = typeof options === "number" ? options : Number(options?.duration);
			log.push({
				duration,
				keys: [...new Set(frames.flatMap((frame) => Object.keys(frame)))],
				moves: frames.some(
					(frame) => frame.transform !== undefined && frame.transform !== "none",
				),
			});
			return original.call(this, keyframes, options);
		};
	});
}

const recordedAnimations = (page: Page) => page.evaluate(() => window.__anims ?? []);

test("Dropdown 关闭中重入立即续开：从当前位置和透明度续播，不跳回起点", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	const fixture = await mountFixture(page);
	const trigger = fixture.getByRole("button", { name: "向上展开", exact: true });
	await trigger.hover();
	await expect(trigger).toHaveAttribute("aria-expanded", "true");
	const contentId = await trigger.getAttribute("aria-controls");
	if (!contentId) {
		throw new Error("展开的 Dropdown 缺少面板关联");
	}
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
	await content.evaluate(pauseFloatAtHalf);
	const mid = await pose(content);
	expect(mid.opacity).toBeGreaterThan(0);
	expect(mid.opacity).toBeLessThan(1);

	await trigger.hover();
	await page.evaluate(
		() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
	);
	expect(await trigger.getAttribute("aria-expanded")).toBe("true");
	const resumed = await pose(content);
	// 不经过完全透明的起点帧：续播后的透明度不会低于被打断时的值
	expect(resumed.opacity).toBeGreaterThanOrEqual(mid.opacity - 0.05);
	await expect.poll(() => pose(content).then((p) => p.opacity)).toBe(1);
	expect((await pose(content)).y).toBe(0);
	await page.mouse.move(1300, 800);
	await expect(content).toHaveCount(0);
});

test("Dropdown 同方向接力后的旧面板不再截获新面板的悬停", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	const fixture = await mountFixture(page);
	const navigation = fixture.getByRole("navigation", { name: "文档导航" });
	const guide = navigation.getByRole("link", { name: "指南", exact: true });
	const more = navigation.getByRole("button", { name: "更多", exact: true });
	await guide.hover();
	await expect(guide).toHaveAttribute("aria-expanded", "true");
	const sourceId = await guide.getAttribute("aria-controls");
	if (!sourceId) {
		throw new Error("指南面板缺少关联");
	}
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
	if (!destinationId) {
		throw new Error("更多面板缺少关联");
	}
	const destination = page.locator(`[id="${destinationId}"]`);
	const point = await destination.evaluate((element) => {
		for (const animation of element.getAnimations()) {
			animation.pause();
		}
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
		for (const animation of element.getAnimations()) {
			animation.play();
		}
	});
	await destination.evaluate((element) => {
		for (const animation of element.getAnimations()) {
			animation.play();
		}
	});
	await expect(source).toHaveCount(0);
	await expect(more).toHaveAttribute("aria-expanded", "true");
});

test("Dropdown 关闭期间开启减弱动态会立即释放面板，之后只做 100ms 透明度", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	const fixture = await mountFixture(page);
	const trigger = fixture.getByRole("button", { name: "向上展开", exact: true });
	await trigger.hover();
	await expect(trigger).toHaveAttribute("aria-expanded", "true");
	const contentId = await trigger.getAttribute("aria-controls");
	if (!contentId) {
		throw new Error("展开的 Dropdown 缺少面板关联");
	}
	const content = page.locator(`[id="${contentId}"]`);
	await page.mouse.move(1300, 800);
	await expect(trigger).toHaveAttribute("aria-expanded", "false");
	await content.evaluate((element) => {
		for (const animation of element.getAnimations()) {
			animation.pause();
		}
	});
	await page.emulateMedia({ reducedMotion: "reduce" });
	await expect(content).toHaveCount(0);
	await recordAnimations(page);
	await trigger.hover();
	await expect(trigger).toHaveAttribute("aria-expanded", "true");
	await expect(content).toBeVisible();
	const recorded = await recordedAnimations(page);
	const floats = recorded.filter((item) => item.keys.includes("opacity"));
	expect(floats.length).toBeGreaterThan(0);
	for (const item of floats) {
		expect(item.duration).toBe(100);
		expect(item.moves).toBe(false);
	}
	await page.mouse.move(1300, 800);
	await expect(content).toHaveCount(0);
});

test("Dropdown 播放中碰撞翻转后沿实际方位浮出，不重启动画", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 1000 });
	await page.emulateMedia({ reducedMotion: "no-preference" });
	const fixture = await mountFixture(page);
	const trigger = fixture
		.getByRole("navigation", { name: "文档导航" })
		.getByRole("link", { name: "指南", exact: true });
	await trigger.hover();
	await expect(trigger).toHaveAttribute("aria-expanded", "true");
	const contentId = await trigger.getAttribute("aria-controls");
	if (!contentId) {
		throw new Error("指南面板缺少关联");
	}
	const content = page.locator(`[id="${contentId}"]`);
	await expect(content).toHaveAttribute("data-side", "bottom");
	await content.evaluate(pauseFloatAtHalf);
	const before = await pose(content);
	expect(before.opacity).toBeGreaterThan(0);
	expect(before.opacity).toBeLessThan(1);
	expect(before.y).toBeLessThan(0);
	const bottom = await trigger.evaluate((element) => element.getBoundingClientRect().bottom);
	await page.setViewportSize({ width: 1440, height: Math.ceil(bottom + 110) });
	await expect(content).toHaveAttribute("data-side", "top");
	const after = await pose(content);
	expect(after.y).toBeGreaterThan(0);
	expect(after.opacity).toBeCloseTo(before.opacity, 2);
	const same = await content.evaluate((element) =>
		element.getAnimations().some((animation) => animation === window.__float),
	);
	expect(same, "翻转没有重建动画").toBe(true);
	await content.evaluate((element) => {
		for (const animation of element.getAnimations()) {
			animation.play();
		}
	});
	await expect.poll(() => pose(content).then((p) => p.opacity)).toBe(1);
	expect((await pose(content)).y).toBe(0);
	await page.mouse.move(1300, 50);
	await expect(content).toHaveCount(0);
});

test("Dropdown 变形中跨方向快速折返后回到当前锚点，不保留暂停的旧几何", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 1000 });
	await page.emulateMedia({ reducedMotion: "no-preference" });
	const fixture = await mountFixture(page);
	const navigation = fixture.getByRole("navigation", { name: "文档导航" });
	const guide = navigation.getByRole("link", { name: "指南", exact: true });
	const more = navigation.getByRole("button", { name: "更多", exact: true });
	await guide.hover();
	await expect(guide).toHaveAttribute("aria-expanded", "true");
	await more.hover();
	await expect(more).toHaveAttribute("aria-expanded", "true");
	const contentId = await more.getAttribute("aria-controls");
	if (!contentId) {
		throw new Error("更多面板缺少关联");
	}
	const content = page.locator(`[id="${contentId}"]`);
	await content.evaluate((element) => {
		const morph = element
			.getAnimations()
			.find(
				(animation) =>
					animation.effect instanceof KeyframeEffect &&
					animation.effect.getKeyframes().some((frame) => "transform" in frame),
			);
		if (!morph?.effect) {
			throw new Error("接力期间没有几何动画");
		}
		morph.pause();
		morph.currentTime = Number(morph.effect.getComputedTiming().duration) / 2;
	});
	await content.evaluate(pauseExit);
	await guide.hover();
	await expect(guide).toHaveAttribute("aria-expanded", "true");
	const guideId = await guide.getAttribute("aria-controls");
	if (!guideId) {
		throw new Error("指南面板缺少关联");
	}
	const guideContent = page.locator(`[id="${guideId}"]`);
	const bottom = await guide.evaluate((element) => element.getBoundingClientRect().bottom);
	await page.setViewportSize({ width: 1440, height: Math.ceil(bottom + 170) });
	await expect(guideContent).toHaveAttribute("data-side", "top");
	await expect(content).toHaveAttribute("data-side", "bottom");
	await more.hover();
	await expect(more).toHaveAttribute("aria-expanded", "true");
	await expect(content).toHaveAttribute("data-side", "bottom");
	await expect
		.poll(async () => {
			const anchor = await more.boundingBox();
			const panel = await content.boundingBox();
			if (!anchor || !panel) {
				return Infinity;
			}
			return Math.abs(panel.x - anchor.x);
		})
		.toBeLessThan(1);
	await page.mouse.move(1300, 50);
	await expect(content).toHaveCount(0);
});

test("Dropdown 共享高亮在快速折返中续接当前位置，菜单行保持静止", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 1000 });
	await page.emulateMedia({ reducedMotion: "no-preference" });
	const fixture = await mountFixture(page);
	const trigger = fixture
		.getByRole("navigation", { name: "文档导航" })
		.getByRole("link", { name: "指南", exact: true });
	await trigger.hover();
	await expect(trigger).toHaveAttribute("aria-expanded", "true");
	const contentId = await trigger.getAttribute("aria-controls");
	if (!contentId) {
		throw new Error("指南面板缺少关联");
	}
	const content = page.locator(`[id="${contentId}"]`);
	// 入场浮出还在位移时量不到静止的行位置
	await expect
		.poll(() =>
			content.evaluate((element) =>
				element.getAnimations().some((a) => a.playState === "running"),
			),
		)
		.toBe(false);
	const first = content.getByRole("link", { name: /^快速入门/ });
	const second = content.getByRole("link", { name: /^设计原则/ });
	const third = content.getByRole("link", { name: /^版本记录/ });
	const highlight = content.locator(".v-list-highlight");
	const offsetFrom = async (y: number) => {
		const rect = await highlightBox(highlight);
		return Math.abs(rect.y - y);
	};
	await first.hover();
	await expect(first).toHaveAttribute("data-highlighted", "");
	const firstRect = await first.boundingBox();
	const thirdRect = await third.boundingBox();
	if (!firstRect || !thirdRect) {
		throw new Error("菜单行缺少可见几何");
	}
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
			.getAnimations({ subtree: true })
			.find(
				(animation) =>
					animation.effect instanceof KeyframeEffect &&
					animation.effect.getKeyframes().some((frame) => "transform" in frame),
			);
		if (!movement?.effect) {
			throw new Error("项切换缺少跟随动画");
		}
		movement.pause();
		movement.currentTime = Number(movement.effect.getComputedTiming().duration) / 2;
	});
	const middle = await highlightBox(highlight);
	expect(middle.y).toBeGreaterThan(firstRect.y + 1);
	expect(middle.y).toBeLessThan(thirdRect.y - 1);
	await second.hover();
	await highlight.evaluate((element) => {
		const movement = element
			.getAnimations({ subtree: true })
			.find(
				(animation) =>
					animation.effect instanceof KeyframeEffect &&
					animation.effect.getKeyframes().some((frame) => "transform" in frame),
			);
		if (!movement) {
			throw new Error("折返缺少续接动画");
		}
		movement.pause();
		movement.currentTime = 0;
	});
	const resumed = await highlightBox(highlight);
	expect(Math.abs(resumed.y - middle.y)).toBeLessThan(1);
	await highlight.evaluate((element) => {
		for (const animation of element.getAnimations({ subtree: true })) {
			animation.play();
		}
	});
	const secondRect = await second.boundingBox();
	if (!secondRect) {
		throw new Error("目标行缺少可见几何");
	}
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
	await expect.poll(() => highlightOpacity(highlight)).toBe("1");
	await expect(first).toHaveAttribute("data-highlighted", "");
	await expect(second).not.toHaveAttribute("data-highlighted");
	await page.keyboard.press("Tab");
	await expect(second).toBeFocused();
	await expect.poll(() => offsetFrom(secondRect.y)).toBeLessThan(1);
	await expect(second).toHaveAttribute("data-highlighted", "");
	await expect(first).not.toHaveAttribute("data-highlighted");
	await expect(trigger).toHaveAttribute("aria-expanded", "true");
});

test("Dropdown 减弱动态下高亮立即跟随，并忽略禁用项", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	const fixture = await mountFixture(page);
	const trigger = fixture
		.getByRole("navigation", { name: "文档导航" })
		.getByRole("link", { name: "指南", exact: true });
	await trigger.hover();
	await expect(trigger).toHaveAttribute("aria-expanded", "true");
	const contentId = await trigger.getAttribute("aria-controls");
	if (!contentId) {
		throw new Error("指南面板缺少关联");
	}
	const content = page.locator(`[id="${contentId}"]`);
	const first = content.getByRole("link", { name: /^快速入门/ });
	const third = content.getByRole("link", { name: /^版本记录/ });
	const highlight = content.locator(".v-list-highlight");
	await first.hover();
	await third.hover();
	const row = await third.boundingBox();
	const background = await highlightBox(highlight);
	if (!row) {
		throw new Error("菜单行缺少可见几何");
	}
	expect(Math.abs(row.y - background.y)).toBeLessThan(1);
	expect(
		await highlight.evaluate((element) => element.getAnimations({ subtree: true }).length),
	).toBe(0);
	await third.evaluate((element) => element.setAttribute("aria-disabled", "true"));
	await expect.poll(() => highlightOpacity(highlight)).toBe("0");
	await expect(third).not.toHaveAttribute("data-highlighted");
	await first.hover();
	await third.hover();
	await expect.poll(() => highlightOpacity(highlight)).toBe("0");
	await trigger.focus();
	await page.keyboard.press("Tab");
	await expect(first).toBeFocused();
	await expect.poll(() => highlightOpacity(highlight)).toBe("1");
	await first.evaluate((element) => element.setAttribute("aria-disabled", "true"));
	await expect.poll(() => highlightOpacity(highlight)).toBe("0");
	await expect(first).not.toHaveAttribute("data-highlighted");
	await expect(trigger).toHaveAttribute("aria-expanded", "true");
});

test("Dropdown 穿过项间空隙与面板留白时保留高亮，真正离开后才清理", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	const fixture = await mountFixture(page);
	const trigger = fixture
		.getByRole("navigation", { name: "文档导航" })
		.getByRole("link", { name: "指南", exact: true });
	await trigger.hover();
	await expect(trigger).toHaveAttribute("aria-expanded", "true");
	const contentId = await trigger.getAttribute("aria-controls");
	if (!contentId) {
		throw new Error("指南面板缺少关联");
	}
	const content = page.locator(`[id="${contentId}"]`);
	const first = content.getByRole("link", { name: /^快速入门/ });
	const second = content.getByRole("link", { name: /^设计原则/ });
	const highlight = content.locator(".v-list-highlight");
	await first.hover();
	await expect.poll(() => highlightOpacity(highlight)).toBe("1");
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
	await expect.poll(() => highlightOpacity(highlight)).toBe("1");
	await expect(first).toHaveAttribute("data-highlighted", "");
	expect(boxDistance(await highlightBox(highlight), firstRect)).toBeLessThan(1);
	await page.mouse.move((panelRect.x + firstRect.x) / 2, firstRect.y + firstRect.height / 2);
	await expect.poll(() => highlightOpacity(highlight)).toBe("1");
	expect(boxDistance(await highlightBox(highlight), firstRect)).toBeLessThan(1);
	await second.hover();
	await expect(second).toHaveAttribute("data-highlighted", "");
	await expect(first).not.toHaveAttribute("data-highlighted");
	await expect.poll(() => highlightOpacity(highlight)).toBe("1");
	expect(boxDistance(await highlightBox(highlight), secondRect)).toBeLessThan(1);
	const triggerBottom = triggerRect.y + triggerRect.height;
	expect(panelRect.y).toBeGreaterThan(triggerBottom);
	await page.mouse.move(triggerRect.x + triggerRect.width / 2, (triggerBottom + panelRect.y) / 2);
	await trigger.hover();
	await expect.poll(() => highlightOpacity(highlight)).toBe("1");
	await expect(second).toHaveAttribute("data-highlighted", "");
	expect(boxDistance(await highlightBox(highlight), secondRect)).toBeLessThan(1);
	await expect(trigger).toHaveAttribute("aria-expanded", "true");
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await content.evaluate((element) => {
		const observer = new MutationObserver(() => {
			if (element.getAttribute("data-state") === "closed") {
				for (const animation of element.getAnimations()) {
					animation.pause();
				}
				observer.disconnect();
			}
		});
		observer.observe(element, { attributes: true, attributeFilter: ["data-state"] });
	});
	await page.mouse.move(1300, 800);
	await expect(content).toHaveAttribute("data-state", "closed");
	await expect(content).toHaveCount(1);
	await expect.poll(() => highlightOpacity(highlight)).toBe("0");
	await expect(second).not.toHaveAttribute("data-highlighted");
	await content.evaluate((element) => {
		for (const animation of element.getAnimations()) {
			animation.play();
		}
	});
	await expect(content).toHaveCount(0);
});
