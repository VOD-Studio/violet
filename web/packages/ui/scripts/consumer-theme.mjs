import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const ratio = (a, b) => (Math.max(a.luminance, b.luminance) + 0.05) / (Math.min(a.luminance, b.luminance) + 0.05);
const colors = (locator) => locator.evaluate((element) => {
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = 1;
	const context = canvas.getContext("2d", { willReadFrequently: true });
	const sample = (value) => {
		context.clearRect(0, 0, 1, 1);
		context.fillStyle = value;
		context.fillRect(0, 0, 1, 1);
		const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
		const linear = (channel) => { const v = channel / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
		return { value, luminance: linear(r) * 0.2126 + linear(g) * 0.7152 + linear(b) * 0.0722 };
	};
	const style = getComputedStyle(element);
	const result = { actualText: sample(style.color), actualBackground: sample(style.backgroundColor) };
	const probe = document.createElement("span");
	element.append(probe);
	for (const name of ["background", "primary", "primary-hover", "primary-foreground", "link"]) {
		probe.style.color = `var(--${name})`;
		result[name] = sample(getComputedStyle(probe).color);
	}
	probe.remove();
	return result;
});

export async function checkConsumerTheme(css, html) {
	const browser = await chromium.launch();
	try {
		const page = await browser.newPage({ javaScriptEnabled: false, reducedMotion: "reduce" });
		await page.setContent(html.replace('<link rel="stylesheet" href="./all.css" />', `<style>${css}</style>`));
		await page.locator("main").evaluate((element) => element.insertAdjacentHTML("beforeend", '<section data-theme="coral"><a class="v-button v-button--link" href="#plain-input">品牌链接</a></section>'));
		const readings = [];
		for (const appearance of ["light", "dark"]) {
			await page.locator("html").evaluate((el, value) => { el.className = value; }, appearance);
			for (const contrast of ["no-preference", "more"]) {
				await page.emulateMedia({ contrast });
				for (const id of ["plain-button", "plain-scoped-button"]) {
					const button = page.locator(`#${id}`);
					await page.mouse.move(0, 0);
					await button.evaluate((el) => { el.style.transition = "none"; });
					const normal = await colors(button);
					assert.equal(normal.actualBackground.value, normal.primary.value);
					const normalRatio = ratio(normal.actualText, normal.actualBackground);
					assert.ok(normalRatio >= 4.5, `${appearance}/${contrast}/${id}: normal contrast ${normalRatio}`);
					await button.hover();
					const hover = await colors(button);
					assert.equal(hover.actualBackground.value, normal["primary-hover"].value);
					assert.equal(hover.actualText.value, normal["primary-foreground"].value);
					const hoverRatio = ratio(hover.actualText, hover.actualBackground);
					assert.ok(hoverRatio >= normalRatio, `${appearance}/${contrast}/${id}: hover contrast ${hoverRatio} < ${normalRatio}`);
					readings.push({ appearance, contrast, id, normalRatio, hoverRatio });
				}
				const input = page.locator("#plain-input");
				const label = page.locator('[for="plain-input"]');
				await label.evaluate((el) => { el.style.transition = "none"; });
				for (const invalid of [false, true]) {
					await input.evaluate((el, value) => el.setAttribute("aria-invalid", String(value)), invalid);
					await input.focus();
					const focused = await colors(label);
					assert.ok(ratio(focused.actualText, focused.background) >= 4.5, `${appearance}/${contrast}: focused label, invalid=${invalid}`);
				}
				const root = await colors(page.locator("main"));
				const namedLink = await page.locator("a.v-button--link").evaluate((el) => getComputedStyle(el).color);
				assert.notEqual(namedLink, root.link.value, "Named theme inherited the root's already-resolved link color.");
			}
		}
		console.log("Installed pure CSS renders without JavaScript:", JSON.stringify(readings));
	} finally {
		await browser.close();
	}
}
