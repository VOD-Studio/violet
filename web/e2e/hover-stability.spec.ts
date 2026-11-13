import { expect, test } from "@playwright/test";
import { loadClient } from "./client";
import { openClientPage } from "./support";

test("博客卡片下缘的静止指针持续悬停，命中区域不反复退出", async ({ context, page }) => {
	await loadClient(context);
	await openClientPage(page, "/blog");
	const link = page.getByRole("link", { name: /壳层契约文章 2/ });
	const card = link.locator("xpath=ancestor::*[@data-slot='card-frame']");
	await card.scrollIntoViewIfNeeded();
	await page.mouse.move(0, 0);
	const bounds = await card.boundingBox();
	if (!bounds) throw new Error("博客卡片没有可见命中区域");

	const sampling = card.evaluate((element) => {
		const { promise, resolve } = Promise.withResolvers<{ hovered: boolean; top: number }[]>();
		const samples: { hovered: boolean; top: number }[] = [];
		const started = performance.now();
		const sample = () => {
			samples.push({
				hovered: element.matches(":hover"),
				top: element.getBoundingClientRect().top,
			});
			if (performance.now() - started < 1_200) requestAnimationFrame(sample);
			else resolve(samples);
		};
		sample();
		return promise;
	});
	await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height - 1);
	const samples = await sampling;
	const entered = samples.findIndex((sample) => sample.hovered);
	expect(entered, "指针进入卡片可见下缘").toBeGreaterThanOrEqual(0);
	expect(
		samples.slice(entered).every((sample) => sample.hovered),
		"停留期间没有失去悬停",
	).toBe(true);
	const tops = samples.map((sample) => sample.top);
	expect(Math.max(...tops) - Math.min(...tops), "悬停不移动命中盒").toBeLessThan(0.5);
});
