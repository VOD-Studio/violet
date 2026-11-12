import { expect, test } from "@playwright/test";
import { loadClient } from "./client";

test.use({ colorScheme: "light", reducedMotion: "reduce" });

for (const format of ["html", "markdown"]) {
	test(`${format} 正文排版不覆盖只读、可运行与行内代码的外观`, async ({ page, context }) => {
		await loadClient(context);
		await page.goto(`/blog/contract-code-typography-${format}`);
		const article = page.locator("[data-article-content]");
		await expect(article.locator(".v-code-block pre").first()).toHaveText("const a = 1;");
		await expect(article.locator(".v-inline-code")).toHaveText("a");
		await expect(article.getByRole("textbox", { name: "可编辑的 bun 代码" })).toBeVisible();

		const appearance = await article.evaluate((element) => {
			const styles = (selector: string, properties: string[]) =>
				Array.from(element.querySelectorAll(selector), (node) => {
					const computed = getComputedStyle(node);
					return Object.fromEntries(
						properties.map((property) => [
							property,
							computed.getPropertyValue(property),
						]),
					);
				});
			const capture = () => ({
				source: styles(".v-code-block pre", [
					"background-color",
					"border-radius",
					"margin",
					"padding",
					"font-size",
					"line-height",
				]),
				caption: styles(".v-code-block > figcaption", ["margin", "padding"]),
				inline: styles(".v-inline-code", [
					"background-color",
					"padding",
					"font-size",
					"font-weight",
				]),
				inlineDecoration: Array.from(element.querySelectorAll(".v-inline-code"), (node) => [
					getComputedStyle(node, "::before").content,
					getComputedStyle(node, "::after").content,
				]),
			});
			const articleAppearance = capture();
			element.classList.remove("prose");
			try {
				return { article: articleAppearance, standalone: capture() };
			} finally {
				element.classList.add("prose");
			}
		});

		expect(appearance.article).toEqual(appearance.standalone);
	});
}
