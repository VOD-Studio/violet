import { expect, test } from "@playwright/test";
import { loadClient } from "./client";

const SIZES = [12, 14, 16, 18, 20, 24];

test("图标尺寸档在不同尺寸的按钮中保持实际尺寸和线宽", async ({ page, context }) => {
	await loadClient(context);
	await page.goto("/ui");
	await page.waitForLoadState("networkidle");
	await page.getByRole("button", { name: "走近 图标", exact: true }).click();
	const inspector = page.getByRole("dialog", { name: "图标", exact: true });
	const icons = inspector.getByRole("group", { name: "图标按钮" }).locator("svg");
	for (const size of SIZES) {
		await inspector.getByRole("radio", { name: `${size} px`, exact: true }).click();
		await expect(icons).toHaveCount(3);
		for (const icon of await icons.all()) {
			await expect(icon).toHaveCSS("width", `${size}px`);
			await expect(icon).toHaveCSS("height", `${size}px`);
			await expect(icon).toHaveCSS("stroke-width", size <= 14 ? "2px" : "1.75px");
		}
	}
});
