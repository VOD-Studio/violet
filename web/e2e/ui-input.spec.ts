import { createRequire } from "node:module";
import { resolve } from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";

const { build } = createRequire(new URL("../packages/ui/package.json", import.meta.url))("esbuild");
let fixtureScript = "";
let fixtureStyles = "";

const VARIANTS = ["filled", "outline", "underline", "plain"] as const;

test.beforeAll(async () => {
	const resolveDir = resolve(import.meta.dirname, "..");
	const [script, styles] = await Promise.all([
		build({
			stdin: {
				resolveDir,
				loader: "tsx",
				contents: `
import { createRoot } from "react-dom/client";
import { Input } from "@violet/ui";
const host = document.getElementById("fixture");
// 动画开始事件冒泡自带伪元素的宿主：每个外壳每次涟漪记一次
host.addEventListener("animationstart", (event) => {
  if (event.pseudoElement === "::before" && event.target.closest('[data-slot="input-control"]')) {
    host.dataset.starts = String(Number(host.dataset.starts) + 1);
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") host.dataset.escPrevented = String(event.defaultPrevented);
});
createRoot(host).render(<>
  <Input id="name" aria-label="名称" defaultValue="Violet" clearable variant={host.dataset.variant} controlSize={host.dataset.size} invalid={host.dataset.invalid === "true"} valid={host.dataset.valid === "true"} />
  <Input id="password" aria-label="密码" type="password" defaultValue="secret123" passwordToggle />
  <Input id="readonly" aria-label="只读链接" readOnly copyable defaultValue="https://xunrua.top/p/season" />
  {host.dataset.loading === "true" ? <Input id="loading" aria-label="加载中" loading defaultValue="Violet" /> : null}
  <button type="button" id="outside">离开字段</button>
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
					'@import "@violet/ui/tokens.css"; @import "@violet/ui/components/input.css";',
			},
			bundle: true,
			write: false,
			logLevel: "error",
		}),
	]);
	fixtureScript = script.outputFiles[0].text;
	fixtureStyles = styles.outputFiles[0].text;
});

interface FixtureOptions {
	variant?: (typeof VARIANTS)[number];
	invalid?: boolean;
	valid?: boolean;
	loading?: boolean;
	size?: "sm" | "md" | "lg";
}

async function mountFixture(
	page: Page,
	{
		variant = "filled",
		invalid = false,
		valid = false,
		loading = false,
		size = "md",
	}: FixtureOptions = {},
) {
	await page.setContent(
		`<main id="fixture" data-starts="0" data-variant="${variant}" data-size="${size}" data-invalid="${invalid}" data-valid="${valid}" data-loading="${loading}" style="width:320px;padding:24px"></main>`,
	);
	await page.addStyleTag({ content: fixtureStyles });
	await page.addScriptTag({ content: fixtureScript });
	await expect(page.getByRole("textbox", { name: "名称", exact: true })).toBeVisible();
}

const nameInput = (page: Page) => page.getByRole("textbox", { name: "名称", exact: true });
const shellOf = (page: Page, input: Locator) =>
	page.locator('[data-slot="input-control"]').filter({ has: input });

async function settleMotion(page: Page) {
	await expect
		.poll(() =>
			page.evaluate(() =>
				document.getAnimations().every((animation) => animation.playState !== "running"),
			),
		)
		.toBe(true);
	await page.evaluate(
		() =>
			new Promise<void>((done) =>
				requestAnimationFrame(() => requestAnimationFrame(() => done())),
			),
	);
}

async function visibleShadows(control: Locator) {
	return control.evaluate((element) =>
		[undefined, "::before"]
			.map((pseudo) => getComputedStyle(element, pseudo))
			.filter((style) => style.boxShadow !== "none" && Number(style.opacity) > 0)
			.map((style) => [style.boxShadow, style.opacity]),
	);
}

const surface = (control: Locator) =>
	control.evaluate((element) => {
		const style = getComputedStyle(element);
		return { shadow: style.boxShadow, background: style.backgroundColor, color: style.color };
	});

/** 把 token 解析成浏览器最终的 rgb 字符串，用来和计算样式直接比较。 */
const resolveToken = (page: Page, token: string) =>
	page.evaluate((name) => {
		const probe = document.createElement("span");
		probe.style.backgroundColor = `var(${name})`;
		document.body.append(probe);
		const value = getComputedStyle(probe).backgroundColor;
		probe.remove();
		return value;
	}, token);

for (const variant of VARIANTS) {
	test(`Input ${variant} 聚焦换纸色底并画出细环与光晕，出错只换颜色`, async ({ page }) => {
		await mountFixture(page, { variant });
		const input = nameInput(page);
		const control = shellOf(page, input);
		const sheet = await resolveToken(page, "--card");
		const rest = await surface(control);
		await input.focus();
		await settleMotion(page);
		const focused = await surface(control);
		expect(focused.background).toBe(sheet);
		expect(focused.shadow).not.toBe(rest.shadow);
		if (variant === "underline") {
			expect(focused.shadow).toContain("0px 2px 0px 0px");
			expect(focused.shadow).toContain("0px 5px 0px 0px");
		} else {
			expect(focused.shadow).toContain("0px 0px 0px 1px");
			expect(focused.shadow).toContain("0px 0px 0px 4px");
		}

		await mountFixture(page, { variant, invalid: true });
		const invalidControl = shellOf(page, nameInput(page));
		await settleMotion(page);
		const invalidRest = await surface(invalidControl);
		expect(invalidRest.shadow).not.toBe(rest.shadow);
		await nameInput(page).focus();
		await settleMotion(page);
		const invalidFocused = await surface(invalidControl);
		expect(invalidFocused.shadow).toBe(invalidRest.shadow);
		expect(invalidFocused.shadow).not.toBe(focused.shadow);
	});
}

for (const variant of VARIANTS) {
	test(`Input ${variant} 通过态未聚焦只有单线描边，聚焦后换成含光晕的完整聚焦环`, async ({
		page,
	}) => {
		await mountFixture(page, { variant, valid: true });
		const input = nameInput(page);
		const control = shellOf(page, input);
		await settleMotion(page);
		const rest = await surface(control);
		const glow = variant === "underline" ? "0px 5px 0px 0px" : "0px 0px 0px 4px";
		expect(rest.shadow).not.toContain(glow);
		await input.focus();
		await settleMotion(page);
		const focused = await surface(control);
		expect(focused.shadow).toContain(glow);
		expect(focused.shadow).not.toBe(rest.shadow);
	});
}

for (const state of ["invalid", "valid"] as const) {
	test(`Input 已${state === "invalid" ? "出错" : "通过"}的输入框获得焦点时重播聚焦涟漪`, async ({
		page,
	}) => {
		await mountFixture(page, { [state]: true });
		await settleMotion(page);
		const starts = () =>
			page.locator("#fixture").evaluate((element) => Number(element.dataset.starts));
		const before = await starts();
		await nameInput(page).focus();
		await expect.poll(starts).toBe(before + 1);
	});
}

test("Input 系统减弱动态下加载细圆弧静止，常态下仍旋转", async ({ page }) => {
	const spinnerAnimations = () =>
		page
			.locator(".v-spinner")
			.first()
			.evaluate((element) => element.getAnimations({ subtree: true }).length);
	await mountFixture(page, { loading: true });
	expect(await spinnerAnimations()).toBeGreaterThan(0);
	await page.emulateMedia({ reducedMotion: "reduce" });
	expect(await spinnerAnimations()).toBe(0);
});

test("Input 清除钮只在悬停或焦点在控件内时显现，Tab 仍可达", async ({ page }) => {
	await mountFixture(page);
	const input = nameInput(page);
	const clear = page.getByRole("button", { name: "清除", exact: true });
	const state = () =>
		clear.evaluate((element) => {
			const style = getComputedStyle(element);
			return { opacity: style.opacity, pointerEvents: style.pointerEvents };
		});
	await page.mouse.move(0, 0);
	await settleMotion(page);
	expect(await state()).toEqual({ opacity: "0", pointerEvents: "none" });
	await input.hover();
	await settleMotion(page);
	expect(await state()).toEqual({ opacity: "1", pointerEvents: "auto" });
	await page.mouse.move(0, 0);
	await input.focus();
	await input.press("Tab");
	await expect(clear).toBeFocused();
	await settleMotion(page);
	expect(await state()).toEqual({ opacity: "1", pointerEvents: "auto" });
});

test("Input Esc 清空并取消默认行为，已空时不拦截", async ({ page }) => {
	await mountFixture(page);
	const input = nameInput(page);
	await input.focus();
	await input.press("Escape");
	await expect(input).toHaveValue("");
	await expect(input).toBeFocused();
	await expect(page.locator("#fixture")).toHaveAttribute("data-esc-prevented", "true");
	await input.press("Escape");
	await expect(page.locator("#fixture")).toHaveAttribute("data-esc-prevented", "false");
});

for (const activation of ["pointer", "Enter", "Space"] as const) {
	test(`Input ${activation} 清除保留复合焦点，不重播波纹`, async ({ page }) => {
		await mountFixture(page);
		const input = nameInput(page);
		const control = shellOf(page, input);
		const baseline = await visibleShadows(control);
		await input.hover();
		await settleMotion(page);
		await expect(page.locator("#fixture")).toHaveAttribute("data-starts", "0");
		expect(await visibleShadows(control)).toEqual(baseline);

		await input.click();
		await expect(page.locator("#fixture")).toHaveAttribute("data-starts", "1");
		await settleMotion(page);
		const focused = await visibleShadows(control);
		expect(focused).not.toEqual(baseline);
		const clear = page.getByRole("button", { name: "清除", exact: true });
		if (activation === "pointer") await clear.click({ delay: 80 });
		else {
			await input.press("Tab");
			await expect(clear).toBeFocused();
			await clear.press(activation);
		}
		await expect(input).toHaveValue("");
		await expect(input).toBeFocused();
		await settleMotion(page);
		await expect(page.locator("#fixture")).toHaveAttribute("data-starts", "1");
		expect(await visibleShadows(control)).toEqual(focused);

		await page.getByRole("button", { name: "离开字段" }).click();
		await settleMotion(page);
		expect(await visibleShadows(control)).toEqual(baseline);
		await input.click();
		await expect(page.locator("#fixture")).toHaveAttribute("data-starts", "2");
	});
}

test("Input 只读聚焦不播涟漪，只留一圈细线，仍可聚焦与复制", async ({ page }) => {
	await mountFixture(page);
	// setContent 的页面不是安全上下文，没有 navigator.clipboard：用内存实现替身，只验证组件对它的调用
	await page.evaluate(() => {
		Object.defineProperty(navigator, "clipboard", {
			value: {
				writeText: async (text: string) => {
					(window as unknown as { copied: string }).copied = text;
				},
			},
			configurable: true,
		});
	});
	const readonly = page.getByRole("textbox", { name: "只读链接", exact: true });
	const control = shellOf(page, readonly);
	const rest = await surface(control);
	expect(rest.background).toBe("rgba(0, 0, 0, 0)");
	expect(rest.shadow).toContain("inset");
	await readonly.focus();
	await expect(readonly).toBeFocused();
	await settleMotion(page);
	await expect(page.locator("#fixture")).toHaveAttribute("data-starts", "0");
	expect(await surface(control)).toEqual(rest);
	expect(await control.evaluate((element) => getComputedStyle(element, "::before").display)).toBe(
		"none",
	);
	const copy = page.getByRole("button", { name: "复制", exact: true });
	await copy.click();
	await expect(copy).toHaveAttribute("data-copied", "");
	expect(await page.evaluate(() => (window as unknown as { copied: string }).copied)).toBe(
		"https://xunrua.top/p/season",
	);
	await expect(copy).not.toHaveAttribute("data-copied", "", { timeout: 3000 });
});

test("Input 密码键盘显隐不退出复合焦点，光标位置保持", async ({ page }) => {
	await mountFixture(page);
	const input = page.getByLabel("密码", { exact: true });
	await input.focus();
	await expect(page.locator("#fixture")).toHaveAttribute("data-starts", "1");
	await input.evaluate((element: HTMLInputElement) => element.setSelectionRange(2, 5));
	await input.press("Tab");
	const show = page.getByRole("button", { name: "显示密码" });
	await expect(show).toBeFocused();
	await expect(show).toHaveAttribute("aria-pressed", "false");
	await show.press("Enter");
	await expect(input).toHaveAttribute("type", "text");
	await expect(show).toHaveAttribute("aria-pressed", "true");
	await expect(input).toBeFocused();
	expect(
		await input.evaluate((element: HTMLInputElement) => [
			element.selectionStart,
			element.selectionEnd,
		]),
	).toEqual([2, 5]);
	await settleMotion(page);
	await expect(page.locator("#fixture")).toHaveAttribute("data-starts", "1");
	await expect(input).toHaveValue("secret123");
});

test("Input 减弱动态直接呈现聚焦层，不播放波纹，颜色即时切换", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await mountFixture(page);
	const input = nameInput(page);
	const control = shellOf(page, input);
	const baseline = await visibleShadows(control);
	await input.focus();
	await settleMotion(page);
	await expect(page.locator("#fixture")).toHaveAttribute("data-starts", "0");
	expect(await visibleShadows(control)).not.toEqual(baseline);
	expect(await control.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe(
		"0s",
	);
	await page.getByRole("button", { name: "清除", exact: true }).click();
	await expect(input).toHaveValue("");
	await expect(input).toBeFocused();
	await expect(page.locator("#fixture")).toHaveAttribute("data-starts", "0");
});

for (const variant of VARIANTS) {
	for (const invalid of [false, true]) {
		test(`Input ${variant} ${invalid ? "错误态" : "正常态"}聚焦优先于 hover`, async ({
			page,
		}) => {
			await mountFixture(page, { variant, invalid });
			const input = nameInput(page);
			const control = shellOf(page, input);
			await page.mouse.move(0, 0);
			await input.focus();
			await settleMotion(page);
			const focused = await surface(control);
			await input.hover();
			await settleMotion(page);
			expect(await surface(control)).toEqual(focused);
			await input.press("Tab");
			const clear = page.getByRole("button", { name: "清除", exact: true });
			await expect(clear).toBeFocused();
			await clear.hover();
			await settleMotion(page);
			expect(await surface(control)).toEqual(focused);
			await page.mouse.move(0, 0);
			await settleMotion(page);
			expect(await surface(control)).toEqual(focused);
		});
	}
}

test("Input 三档高度 32 / 36 / 40，圆角 8，字号 14 / 14 / 16", async ({ page }) => {
	for (const [size, height, fontSize] of [
		["sm", 32, 14],
		["md", 36, 14],
		["lg", 40, 16],
	] as const) {
		await mountFixture(page, { size });
		const control = shellOf(page, nameInput(page));
		const box = await control.boundingBox();
		expect(box?.height).toBe(height);
		const style = await control.evaluate((element) => {
			const computed = getComputedStyle(element);
			return { radius: computed.borderTopLeftRadius, fontSize: computed.fontSize };
		});
		expect(style).toEqual({ radius: "8px", fontSize: `${fontSize}px` });
	}
});

test.describe("触屏", () => {
	test.use({ hasTouch: true, isMobile: true });

	test("Input 触屏高度各加 4，字号一律 16", async ({ page }) => {
		for (const [size, height] of [
			["sm", 36],
			["md", 40],
			["lg", 44],
		] as const) {
			await mountFixture(page, { size });
			const control = shellOf(page, nameInput(page));
			const box = await control.boundingBox();
			expect(box?.height).toBe(height);
			expect(await control.evaluate((element) => getComputedStyle(element).fontSize)).toBe(
				"16px",
			);
		}
	});
});
