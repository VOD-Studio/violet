import { createRequire } from "node:module";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const { build } = createRequire(new URL("../packages/ui/package.json", import.meta.url))("esbuild");
const SIZES = [12, 14, 16, 18, 20, 24];
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
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Button, IslandIcon, MorphIcon, iconProps } from "@violet/ui";
import { CircleAlert } from "lucide-react";
const sizes = [12, 14, 16, 18, 20, 24];
function Fixture() {
  const [size, setSize] = useState(16);
  return <>
    <fieldset><legend>图标尺寸</legend>{sizes.map((value) => <label key={value}>
      <input type="radio" name="size" value={value} checked={size === value} onChange={() => setSize(value)} />{value} px
    </label>)}</fieldset>
    <div role="group" aria-label="图标按钮" style={{ display: "flex", gap: 12, marginTop: 24 }}>
      <Button size="sm" iconOnly aria-label="提示"><CircleAlert {...iconProps(size)} /></Button>
      <Button iconOnly aria-label="灵动岛"><IslandIcon {...iconProps(size)} /></Button>
      <Button size="lg" iconOnly aria-label="变形"><MorphIcon {...iconProps(size)} /></Button>
    </div>
  </>;
}
createRoot(document.getElementById("fixture")).render(<Fixture />);
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
					'@import "@violet/ui/tokens.css"; @import "@violet/ui/components/button.css";',
			},
			bundle: true,
			write: false,
			logLevel: "error",
		}),
	]);
	fixtureScript = script.outputFiles[0].text;
	fixtureStyles = styles.outputFiles[0].text;
});

test("图标尺寸档在不同尺寸的按钮中保持实际尺寸和线宽", async ({ page }) => {
	await page.setContent('<main id="fixture" style="padding:24px"></main>');
	await page.addStyleTag({ content: fixtureStyles });
	await page.addScriptTag({ content: fixtureScript });
	const icons = page.getByRole("group", { name: "图标按钮" }).locator("svg");
	for (const size of SIZES) {
		await page.getByRole("radio", { name: `${size} px`, exact: true }).check();
		await expect(icons).toHaveCount(3);
		for (const icon of await icons.all()) {
			await expect(icon).toHaveCSS("width", `${size}px`);
			await expect(icon).toHaveCSS("height", `${size}px`);
			await expect(icon).toHaveCSS("stroke-width", size <= 14 ? "2px" : "1.75px");
		}
	}
});
