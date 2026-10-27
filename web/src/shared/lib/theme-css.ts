import { generateScales, type Theme, toCssVariables } from "@violetjs/theme";

/** 状态色与分类色不随主题变化，组件包的默认色板已在 :root 定义，主题样式里省掉以减小体积。 */
const FIXED_SCALE = /^\s*--(?:danger|warning|success|category-\d)-/;

/** 自定义主题按种子在 SSR 与客户端反复生成，按写入顺序缓存结果。 */
const cache = new Map<string, string>();
/** 各访客的种子各不相同，服务端只保留少量结果，超出时淘汰最早写入的一条。 */
const CACHE_LIMIT = 32;

/**
 * 生成主题的品牌与中性色阶 CSS，覆盖明暗与提高对比度两档。
 *
 * @param selector - 承载变量的选择器，如 `[data-theme="custom"]`
 * @returns 相同输入总得到相同字符串，SSR 内联的样式在水合时不会不一致
 */
export function generateThemeCss(theme: Theme, selector: string): string {
	const key = `${selector}|${JSON.stringify(theme)}`;
	const cached = cache.get(key);
	if (cached !== undefined) return cached;
	const scales = (["light", "dark"] as const).flatMap((appearance) =>
		(["standard", "more"] as const).map((contrast) =>
			generateScales(theme, { appearance, contrast }),
		),
	);
	const css = toCssVariables(scales, { selector })
		.split("\n")
		.filter((line) => !FIXED_SCALE.test(line))
		.join("\n");
	if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
	cache.set(key, css);
	return css;
}

/** 承载自定义主题样式的 `<style>` 元素 id：SSR 内联，客户端切换时直接改写。 */
export const CUSTOM_THEME_STYLE_ID = "theme-custom";

/** 自定义主题的样式，作用于 `<html data-theme="custom">`。 */
export const generateCustomThemeCss = (theme: Theme) =>
	generateThemeCss(theme, '[data-theme="custom"]');
