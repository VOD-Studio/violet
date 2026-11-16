import { createRequire } from "node:module";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const { build } = createRequire(new URL("../packages/ui/package.json", import.meta.url))("esbuild");
let fixtureScript = "";
let fixtureStyles = "";

test.use({ reducedMotion: "no-preference" });

test.beforeAll(async () => {
	const resolveDir = resolve(import.meta.dirname, "..");
	const [script, styles] = await Promise.all([
		build({
			stdin: {
				resolveDir,
				loader: "tsx",
				contents: `
import { createRoot } from "react-dom/client";
import { Button, Dialog, DialogBody, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@violet/ui";
createRoot(document.getElementById("fixture")).render(
  <Dialog>
    <DialogTrigger asChild><Button variant="ghost">编辑外观</Button></DialogTrigger>
    <DialogContent aria-describedby={undefined}>
      <DialogHeader><DialogTitle>外观设置</DialogTitle></DialogHeader>
      <DialogBody><label>名称<input defaultValue="Violet" /></label></DialogBody>
      <DialogFooter><DialogClose asChild><Button>完成</Button></DialogClose></DialogFooter>
    </DialogContent>
  </Dialog>
);
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
					'@import "@violet/ui/tokens.css"; @import "@violet/ui/components/dialog.css";',
			},
			bundle: true,
			write: false,
			logLevel: "error",
		}),
	]);
	fixtureScript = script.outputFiles[0].text;
	fixtureStyles = styles.outputFiles[0].text;
});

for (const scheme of ["light", "dark"] as const) {
	test(`幽灵按钮在 ${scheme} 主题下正常展开并收回对话框`, async ({ page }) => {
		await page.setContent(
			`<main id="fixture" style="padding:40px"></main><style>:root { color-scheme: ${scheme}; }</style>`,
		);
		await page.addStyleTag({ content: fixtureStyles });
		await page.addScriptTag({ content: fixtureScript });
		const opener = page.getByRole("button", { name: "编辑外观", exact: true });
		await opener.click();
		const dialog = page.getByRole("dialog", { name: "外观设置" });
		await expect(dialog).toBeVisible();
		await dialog.evaluate(async (element) => {
			await Promise.all(element.getAnimations().map((animation) => animation.finished));
		});
		await expect(dialog.getByRole("textbox", { name: "名称" })).toBeFocused();
		await dialog.getByRole("textbox", { name: "名称" }).fill("新外观");
		await expect(dialog.getByRole("textbox", { name: "名称" })).toHaveValue("新外观");
		await dialog.getByRole("button", { name: "完成", exact: true }).click();
		await expect(dialog).toBeHidden();
		await expect(opener).toBeFocused();
		await expect(opener).toHaveCSS("opacity", "1");
	});
}
