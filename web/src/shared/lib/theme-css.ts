import { generateScales, type Theme, toCssVariables } from "@violetjs/theme";

/** 状态色与分类色不随主题变化，组件包的默认色板已在 :root 定义，主题样式里省掉以减小体积。 */
const FIXED_SCALE = /^\s*--(?:danger|warning|success|category-\d)-/;

/**
 * 生成主题的品牌与中性色阶 CSS，覆盖明暗与提高对比度两档。
 *
 * @param selector - 承载变量的选择器，如 `[data-theme="spring"]`
 * @returns 相同输入总得到相同字符串
 */
export function generateThemeCss(theme: Theme, selector: string): string {
	const scales = (["light", "dark"] as const).flatMap((appearance) =>
		(["standard", "more"] as const).map((contrast) =>
			generateScales(theme, { appearance, contrast }),
		),
	);
	return toCssVariables(scales, { selector })
		.split("\n")
		.filter((line) => !FIXED_SCALE.test(line))
		.join("\n");
}
