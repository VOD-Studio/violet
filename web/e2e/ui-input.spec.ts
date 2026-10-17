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
import { Input } from "@violet/ui";
const host = document.getElementById("fixture");
host.addEventListener("animationstart", (event) => {
  if (event.target.closest('[data-slot="input-control"]')) {
    host.dataset.starts = String(Number(host.dataset.starts) + 1);
  }
});
createRoot(host).render(<>
  <Input id="name" label="名称" defaultValue="Violet" clearable variant={host.dataset.variant} invalid={host.dataset.invalid === "true"} />
  <Input id="password" label="密码" type="password" defaultValue="secret" passwordToggle />
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

async function mountFixture(page: Page, variant = "outline", invalid = false) {
	await page.setContent(
		`<main id="fixture" data-starts="0" data-variant="${variant}" data-invalid="${invalid}" style="width:320px;padding:24px"></main>`,
	);
	await page.addStyleTag({ content: fixtureStyles });
	await page.addScriptTag({ content: fixtureScript });
	await expect(page.getByRole("textbox", { name: "名称", exact: true })).toBeVisible();
}

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
		[undefined, "::before", "::after"]
			.map((pseudo) => getComputedStyle(element, pseudo))
			.filter((style) => style.boxShadow !== "none" && Number(style.opacity) > 0)
			.map((style) => [style.boxShadow, style.opacity]),
	);
}

for (const activation of ["pointer", "Enter", "Space"] as const) {
	test(`Input ${activation} 清除保留复合焦点，不重播波纹`, async ({ page }) => {
		await mountFixture(page);
		const input = page.getByRole("textbox", { name: "名称", exact: true });
		const control = page.locator('[data-slot="input-control"]').filter({ has: input });
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
		const clear = page.getByRole("button", { name: "清除输入", exact: true });
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

test("Input 密码键盘显隐不退出复合焦点", async ({ page }) => {
	await mountFixture(page);
	const input = page.getByLabel("密码", { exact: true });
	await input.focus();
	await expect(page.locator("#fixture")).toHaveAttribute("data-starts", "1");
	await input.press("Tab");
	const show = page.getByRole("button", { name: "显示密码" });
	await expect(show).toBeFocused();
	await show.press("Enter");
	await expect(input).toHaveAttribute("type", "text");
	await expect(page.getByRole("button", { name: "隐藏密码" })).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await settleMotion(page);
	await expect(page.locator("#fixture")).toHaveAttribute("data-starts", "1");
	await expect(input).toHaveValue("secret");
});

test("Input 减弱动态直接呈现聚焦层，不播放波纹", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await mountFixture(page);
	const input = page.getByRole("textbox", { name: "名称", exact: true });
	const control = page.locator('[data-slot="input-control"]').filter({ has: input });
	const baseline = await visibleShadows(control);
	await input.focus();
	await settleMotion(page);
	await expect(page.locator("#fixture")).toHaveAttribute("data-starts", "0");
	expect(await visibleShadows(control)).not.toEqual(baseline);
	await page.getByRole("button", { name: "清除输入" }).click();
	await expect(input).toHaveValue("");
	await expect(input).toBeFocused();
	await expect(page.locator("#fixture")).toHaveAttribute("data-starts", "0");
});

for (const variant of ["outline", "soft", "ghost", "underline"]) {
	for (const invalid of [false, true]) {
		test(`Input ${variant} ${invalid ? "错误态" : "正常态"}聚焦优先于 hover`, async ({
			page,
		}) => {
			await mountFixture(page, variant, invalid);
			const input = page.getByRole("textbox", { name: "名称", exact: true });
			const control = page.locator('[data-slot="input-control"]').filter({ has: input });
			const surface = () =>
				control.evaluate((element) => {
					const style = getComputedStyle(element);
					return {
						border: style.borderColor,
						background: style.backgroundColor,
						color: style.color,
					};
				});
			await page.mouse.move(0, 0);
			await input.focus();
			await settleMotion(page);
			const focused = await surface();
			await input.hover();
			await settleMotion(page);
			expect(await surface()).toEqual(focused);
			await input.press("Tab");
			const clear = page.getByRole("button", { name: "清除输入", exact: true });
			await expect(clear).toBeFocused();
			await clear.hover();
			await settleMotion(page);
			expect(await surface()).toEqual(focused);
			await page.mouse.move(0, 0);
			await settleMotion(page);
			expect(await surface()).toEqual(focused);
		});
	}
}
