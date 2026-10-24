import type { Browser, Page } from "@playwright/test";
import { loadClient } from "./client";

export type Appearance = "light" | "dark" | "system";
export const CONTRACT_ORIGIN = "http://127.0.0.1:4173";
export const SEMANTIC_TOKENS = [
	"background",
	"foreground",
	"card",
	"card-foreground",
	"popover",
	"popover-foreground",
	"primary",
	"primary-hover",
	"primary-foreground",
	"primary-text",
	"secondary",
	"secondary-foreground",
	"muted",
	"muted-foreground",
	"accent",
	"accent-foreground",
	"link",
	"link-hover",
	"selected",
	"selected-hover",
	"selected-foreground",
	"progress",
	"ring",
	"input",
	"border",
	"destructive",
	"destructive-hover",
	"destructive-text",
	"destructive-foreground",
	"warning",
	"warning-text",
	"warning-foreground",
	"success",
	"success-text",
	"success-foreground",
	"edge-hairline",
	"surface-glass",
	"chart-1",
	"chart-2",
	"chart-3",
	"chart-4",
	"chart-5",
] as const;

export interface ComputedColor {
	value: string;
	luminance: number;
	alpha: number;
}

export type ScopeColors = Record<string, ComputedColor>;

/** Cookie 控制 SSR，localStorage 控制 next-themes；system 使用模拟的深色系统外观。 */
export async function appearanceContext(
	browser: Browser,
	appearance: Appearance,
	options: { blockScripts?: boolean; admin?: boolean; contrast?: "more" | "no-preference" } = {},
) {
	const context = await browser.newContext({
		colorScheme: appearance === "light" ? "light" : "dark",
		reducedMotion: "reduce",
		contrast: options.contrast ?? "no-preference",
	});
	if (appearance !== "system") {
		await context.addCookies([{ name: "appearance", value: appearance, url: CONTRACT_ORIGIN }]);
		await context.addInitScript((value) => localStorage.setItem("theme", value), appearance);
	}
	if (options.admin)
		await context.addCookies([{ name: "contract_admin", value: "1", url: CONTRACT_ORIGIN }]);
	await loadClient(context);
	if (options.blockScripts)
		await context.route("**/*", (route) =>
			["script", "fetch", "xhr"].includes(route.request().resourceType())
				? route.abort()
				: route.fallback(),
		);
	return context;
}

/** 在实际元素上解析变量并由浏览器转换到 sRGB，避免把 light-dark() 未求值字符串当颜色。 */
export async function scopeColors(
	page: Page,
	selector: string,
	names: readonly string[] = SEMANTIC_TOKENS,
): Promise<ScopeColors> {
	return page
		.locator(selector)
		.first()
		.evaluate(
			(scope, tokens) => {
				const probe = document.createElement("span");
				const canvas = document.createElement("canvas");
				canvas.width = canvas.height = 1;
				const context = canvas.getContext("2d", { willReadFrequently: true });
				if (!context) throw new Error("浏览器不支持 Canvas 颜色转换");
				scope.append(probe);
				const colors: ScopeColors = {};
				for (const name of tokens) {
					if (!getComputedStyle(scope).getPropertyValue(`--${name}`).trim())
						throw new Error(`缺少语义变量 --${name}`);
					probe.style.color = `var(--${name})`;
					const value = getComputedStyle(probe).color;
					context.clearRect(0, 0, 1, 1);
					context.fillStyle = value;
					context.fillRect(0, 0, 1, 1);
					const [r, g, b, alpha] = context.getImageData(0, 0, 1, 1).data;
					const linear = (channel: number) => {
						const v = channel / 255;
						return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
					};
					colors[name] = {
						value,
						luminance: linear(r) * 0.2126 + linear(g) * 0.7152 + linear(b) * 0.0722,
						alpha: alpha / 255,
					};
				}
				probe.remove();
				return colors;
			},
			[...names],
		);
}

export function contrastRatio(a: { luminance: number }, b: { luminance: number }) {
	return (
		(Math.max(a.luminance, b.luminance) + 0.05) / (Math.min(a.luminance, b.luminance) + 0.05)
	);
}
