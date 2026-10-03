import { createRequire } from "node:module";
import { resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";

const { build } = createRequire(new URL("../packages/ui/package.json", import.meta.url))("esbuild");
let fixtureScript = "";

test.beforeAll(async () => {
	const result = await build({
		stdin: {
			resolveDir: resolve(import.meta.dirname, ".."),
			loader: "tsx",
			contents: `
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Checkbox } from "@violet/ui";

const host = document.getElementById("fixture");
const mode = host.dataset.mode;
const canceled = host.dataset.canceled === "true";
const defaultChecked = host.dataset.defaultChecked === "true";
const container = document.createElement("div");
if (mode === "shadow") host.attachShadow({ mode: "open" }).append(container);
else if (mode !== "controlled") host.append(container);

function Fixture() {
  const [changes, setChanges] = useState([]);
  const [showForm, setShowForm] = useState(mode !== "late");
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    if (mode === "controlled") host.append(container);
    host.dataset.ready = "true";
  }, []);
  const checkbox = <Checkbox
    id="option" aria-label="Option" name="option" value="enabled"
    defaultChecked={defaultChecked}
    checked={mode === "controlled" ? checked : undefined}
    form={mode === "late" ? "form" : undefined}
    onCheckedChange={(next) => setChanges((current) => [...current, next])}
  />;
  return <>
    {mode === "late" && checkbox}
    {showForm && <form id="form" onReset={(event) => { if (canceled) event.preventDefault(); }}>
      {mode !== "late" && checkbox}
      <button id="reset" type="reset">Reset</button>
    </form>}
    {mode === "late" && !showForm && <button id="mount" type="button" onClick={() => setShowForm(true)}>Mount form</button>}
    {mode === "controlled" && <button id="confirm" type="button" onClick={() => setChecked(true)}>Confirm checked</button>}
    <output id="changes">{JSON.stringify(changes)}</output>
  </>;
}
createRoot(container).render(<Fixture />);
`,
		},
		bundle: true,
		format: "iife",
		platform: "browser",
		jsx: "automatic",
		write: false,
		logLevel: "error",
		define: { "process.env.NODE_ENV": '"development"' },
	});
	fixtureScript = result.outputFiles[0].text;
});

async function mountFixture(
	page: Page,
	{
		mode = "document",
		canceled = false,
		defaultChecked = false,
	}: {
		mode?: "document" | "shadow" | "late" | "controlled";
		canceled?: boolean;
		defaultChecked?: boolean;
	},
) {
	await page.setContent(
		`<div id="fixture" data-mode="${mode}" data-canceled="${canceled}" data-default-checked="${defaultChecked}"></div>`,
	);
	await page.addScriptTag({ content: fixtureScript });
	await expect(page.locator("#fixture")).toHaveAttribute("data-ready", "true");
}

async function activateReset(page: Page, activation: "pointer" | "Space" | "Enter") {
	const reset = page.locator("#reset");
	if (activation === "pointer") await reset.click();
	else {
		await reset.focus();
		await reset.press(activation);
	}
	await page.evaluate(() => new Promise((done) => setTimeout(done, 0)));
}

async function expectState(page: Page, checked: boolean, changes: boolean[]) {
	await expect(page.locator("#option")).toHaveAttribute("aria-checked", String(checked));
	await expect(page.locator("#changes")).toHaveText(JSON.stringify(changes));
	expect(
		await page
			.locator('input[aria-hidden="true"][name="option"]')
			.evaluate((input) => (input as HTMLInputElement).checked),
	).toBe(checked);
	expect(
		await page
			.locator("#form")
			.evaluate((form) => Array.from(new FormData(form as HTMLFormElement).entries())),
	).toEqual(checked ? [["option", "enabled"]] : []);
}

for (const activation of ["pointer", "Space", "Enter"] as const) {
	test(`Checkbox 取消原生 reset 的 ${activation} 激活`, async ({ page }) => {
		await mountFixture(page, { canceled: true });
		await page.locator("#option").click();
		await expectState(page, true, [true]);
		await activateReset(page, activation);
		await expectState(page, true, [true]);
	});

	test(`Checkbox 正常原生 reset 的 ${activation} 激活`, async ({ page }) => {
		await mountFixture(page, {});
		await page.locator("#option").click();
		await expectState(page, true, [true]);
		await activateReset(page, activation);
		await expectState(page, false, [true, false]);
	});
}

for (const mode of ["late", "shadow"] as const) {
	test(`Checkbox ${mode} 表单取消指针 reset`, async ({ page }) => {
		await mountFixture(page, { mode, canceled: true });
		await page.locator("#option").click();
		if (mode === "late") await page.locator("#mount").click();
		await expectState(page, true, [true]);
		await activateReset(page, "pointer");
		await expectState(page, true, [true]);
	});
}

test("Checkbox 初值 true 的取消 reset 保留当前未勾选值", async ({ page }) => {
	await mountFixture(page, { canceled: true, defaultChecked: true });
	await page.locator("#option").click();
	await expectState(page, false, [false]);
	await activateReset(page, "pointer");
	await expectState(page, false, [false]);
});

test("Checkbox 初值 true 的正常 reset 恢复表单值", async ({ page }) => {
	await mountFixture(page, { defaultChecked: true });
	await page.locator("#option").click();
	await expectState(page, false, [false]);
	await activateReset(page, "pointer");
	await expectState(page, true, [false, true]);
});

test("Checkbox 受控拒绝指针 reset 时双作用域仅通知一次", async ({ page }) => {
	await mountFixture(page, { mode: "controlled" });
	await page.locator("#confirm").click();
	await expectState(page, true, []);
	await activateReset(page, "pointer");
	await expectState(page, true, [false]);
});
