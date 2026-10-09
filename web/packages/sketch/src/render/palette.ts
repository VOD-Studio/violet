/** 颜色角色到 CSS 色值的映射；须覆盖所有输出角色。 */
export type Palette = Readonly<Record<string, string>>;

/** 渲染器共用选项。 */
export interface RenderOptions {
	/** 背景使用的颜色角色；false 表示透明背景。 @default "paper" */
	background?: string | false;
	/** 标签字体。 @default "system-ui, sans-serif" */
	fontFamily?: string;
}

/** 解析颜色角色；缺失时明确失败，不以默认色掩盖配置遗漏。 */
export function paint(palette: Palette, role: string): string {
	const color = palette[role];
	if (color === undefined) throw new Error(`未配置绘制颜色：${role}`);
	return color;
}
