/** 外观：浅色或深色。 */
export type Appearance = "light" | "dark";

/** 对比度档位：标准，或系统开启「提高对比度」（`prefers-contrast: more`）时使用的档位。 */
export type ContrastLevel = "standard" | "more";

/** 状态色：危险、警告、成功。 */
export type StatusName = "danger" | "warning" | "success";

/** 实色上的前景：近白或近黑。 */
export type Foreground = "light" | "dark";

/**
 * 求解用的 WCAG 比值目标，对相应背景取最差值。WCAG 门槛留约 2% 余量吸收取整与 8 位量化；
 * APCA 门槛折算成 WCAG 比值后按遍历测试校准，取两者较大者。深色下 APCA 更严，所以两种外观的数值不对称。
 */
export interface Targets {
	/** 第 2–6 档相对第 1 档的亮度差，按观感取值，不由对比度反解；提高档的组件底色更浅，给正文留出空间 */
	offsets: readonly [number, number, number, number, number];
	/** 控件边界与焦点环对背景与表面 */
	boundary: number;
	/** 次要文字与链接对背景与表面 */
	secondary: number;
	/** 正文对背景与表面 */
	primary: number;
	/** 次要文字与链接对组件底色 */
	secondaryOnComponent: number;
	/** 正文对组件底色 */
	primaryOnComponent: number;
	/** 实色上的前景，按前景取值 */
	onSolid: Readonly<Record<Foreground, number>>;
	/** 实色与背景可辨；带文字的按钮在 WCAG 1.4.11 下不要求填充色与页面的对比度 */
	separation: number;
}

export interface AppearanceRules {
	/** 远离背景的亮度方向：浅色向暗为 -1，深色向亮为 1 */
	direction: -1 | 1;
	/** 第 1 档（页面背景）的亮度 */
	background: number;
	/** 第 12 档能到达的最远亮度 */
	limit: number;
	/** 品牌与状态色阶各档色度相对种子色度的比例 */
	brandChroma: readonly number[];
	/** 中性色阶各档色度相对 `neutralChroma` 的比例 */
	neutralChroma: readonly number[];
	/**
	 * 各对比度档位的目标。标准档：边框 WCAG 3 / APCA Lc 30，次要文字 4.5 / 75，正文 4.5 / 90，
	 * 组件底色上的次要文字 4.5 / 60、正文 4.5 / 75，实色前景 4.5 / 60，实色与背景 Lc 15。
	 * 提高档按 APCA 的 AAA 换算整体上调 Lc 15，WCAG 文字门槛取 AAA 的 7、非文字取 4.5；
	 * 正文在近白背景上至多做到 Lc 100 左右，因此只上调到 100。
	 */
	targets: Readonly<Record<ContrastLevel, Targets>>;
}

export const RULES: Readonly<Record<Appearance, AppearanceRules>> = {
	light: {
		direction: -1,
		background: 0.992,
		limit: 0.1,
		brandChroma: [0.02, 0.05, 0.1, 0.18, 0.26, 0.36, 0.6, 0.75, 1, 1, 0.9, 0.5],
		neutralChroma: [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.85, 0.9, 1, 1, 0.9, 0.7],
		targets: {
			standard: {
				offsets: [0.012, 0.035, 0.058, 0.08, 0.11],
				boundary: 3.06,
				secondary: 6.4,
				primary: 11.4,
				secondaryOnComponent: 4.6,
				primaryOnComponent: 8,
				onSolid: { light: 4.59, dark: 8.8 },
				separation: 1.4,
			},
			more: {
				offsets: [0.012, 0.028, 0.044, 0.06, 0.11],
				boundary: 4.59,
				secondary: 12.3,
				primary: 19.5,
				secondaryOnComponent: 7.5,
				primaryOnComponent: 16,
				onSolid: { light: 7.14, dark: 12.5 },
				separation: 1.8,
			},
		},
	},
	dark: {
		direction: 1,
		background: 0.17,
		limit: 0.985,
		brandChroma: [0.1, 0.16, 0.3, 0.42, 0.5, 0.55, 0.65, 0.8, 1, 0.95, 0.7, 0.3],
		neutralChroma: [0.35, 0.45, 0.55, 0.6, 0.65, 0.7, 0.85, 0.9, 1, 1, 0.9, 0.6],
		targets: {
			standard: {
				offsets: [0.035, 0.075, 0.105, 0.135, 0.175],
				boundary: 4.3,
				secondary: 11.6,
				primary: 14.9,
				secondaryOnComponent: 7.6,
				primaryOnComponent: 9.8,
				onSolid: { light: 4.59, dark: 8.8 },
				separation: 2.55,
			},
			more: {
				offsets: [0.035, 0.075, 0.105, 0.135, 0.175],
				boundary: 6.6,
				secondary: 14.9,
				primary: 16.5,
				secondaryOnComponent: 9.8,
				primaryOnComponent: 13,
				onSolid: { light: 7.14, dark: 12 },
				separation: 4.3,
			},
		},
	},
};

/** 状态色的种子色，色相与种子固定，不随主题变化。 */
export const STATUS_SEEDS: Readonly<Record<StatusName, string>> = {
	danger: "#dc2626",
	warning: "#f59e0b",
	success: "#15803d",
};
