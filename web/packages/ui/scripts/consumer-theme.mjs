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
	for (const name of ["background", "foreground", "primary", "primary-hover", "primary-foreground", "link"]) {
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
				const minimumRatio = contrast === "more" ? 7 : 4.5;
				for (const id of ["plain-button", "plain-scoped-button"]) {
					const button = page.locator(`#${id}`);
					await page.mouse.move(0, 0);
					await button.evaluate((el) => { el.style.transition = "none"; });
					// 主要按钮是墨色底、纸色字；季节色只出现在聚焦环与链接，不参与按钮底色
					const normal = await colors(button);
					assert.equal(normal.actualBackground.value, normal.foreground.value, `${appearance}/${contrast}/${id}: primary is not ink`);
					assert.equal(normal.actualText.value, normal.background.value, `${appearance}/${contrast}/${id}: primary text is not paper`);
					const normalRatio = ratio(normal.actualText, normal.actualBackground);
					assert.ok(normalRatio >= minimumRatio, `${appearance}/${contrast}/${id}: normal contrast ${normalRatio} < ${minimumRatio}`);
					await button.hover();
					const hover = await colors(button);
					assert.notEqual(hover.actualBackground.value, normal.actualBackground.value, `${appearance}/${contrast}/${id}: hover keeps the base color`);
					assert.equal(hover.actualText.value, normal.background.value);
					const hoverRatio = ratio(hover.actualText, hover.actualBackground);
					assert.ok(hoverRatio >= minimumRatio, `${appearance}/${contrast}/${id}: hover contrast ${hoverRatio} < ${minimumRatio}`);
					readings.push({ appearance, contrast, id, normalRatio, hoverRatio });
				}
				const input = page.locator("#plain-input");
				const shell = page.locator("#plain-shell");
				for (const invalid of [false, true]) {
					await shell.evaluate((el, value) => el.toggleAttribute("data-invalid", value), invalid);
					await input.focus();
					const focused = await colors(shell);
					assert.ok(ratio(focused.actualText, focused.actualBackground) >= 4.5, `${appearance}/${contrast}: focused input text, invalid=${invalid}`);
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
