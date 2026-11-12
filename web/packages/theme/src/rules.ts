/** 外观：浅色或深色。 */
export type Appearance = "light" | "dark";

/** 对比度档位：标准，或系统开启「提高对比度」（`prefers-contrast: more`）时使用的档位。 */
export type ContrastLevel = "standard" | "more";

/** 状态色：危险、警告、成功。 */
export type StatusName = "danger" | "warning" | "success";

/** 实色上的前景：近白或近黑。 */
export type Foreground = "light" | "dark";

/**
 * 对相应背景取最差值的 WCAG 比值目标。保留的数值同时复现 UED 设计稿的正文与说明文字色
 * （中性第 12、11 档），求解与测试只以 WCAG 判定；APCA 不参与求解（ADR-0029）。
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

/** 材质表面的 OKLCH 取值；色度是上限，不超过种子色本身的色度。 */
export interface SurfaceRule {
	l: number;
	c: number;
}

/** 状态文字色的起始 OKLCH 取值；明度会沿远离背景的方向移动到达标为止。 */
export interface StatusTextRule {
	l: number;
	c: number;
	h: number;
}

/**
 * 材质：纸面（页面底）、纸片（卡片、面板、浮层、当前项）、凹陷（输入框、分段轨道、键帽、骨架）。
 * 取值来自 UED 设计稿「基础」页，四季共用，只有色相随种子色。
 */
export interface MaterialRules {
	page: SurfaceRule;
	sheet: SurfaceRule;
	sunk: SurfaceRule;
	/** 发丝线与强线：正文色的透明度，分隔线与时间线、尺寸标注用 */
	rule: number;
	rule2: number;
	/**
	 * 强调字：起始明度与色度比例。色度 = 旋钮 `accentChroma` × `chromaScale`；
	 * 明度从这里起沿远离背景的方向移动，直到在纸面、纸片、凹陷上都达到 `textContrast`。
	 */
	accent: { l: number; chromaScale: number };
	/** 材质上文字色的 WCAG 目标：标准档取 AA 正文的 4.5，提高对比度档取 AAA 的 7 */
	textContrast: Readonly<Record<ContrastLevel, number>>;
	/** 危险色与成功色：作文字、图标时的起始取值，色相固定、不随主题变化 */
	danger: StatusTextRule;
	ok: StatusTextRule;
	/**
	 * 文字放在着色底上的占比：状态文字在自身色的 `status` 底上，强调字在季节色的 `accent` 底上，
	 * 底色取纸面与纸片。设计稿里状态标签的占比是 5%–12%，取上限；选中态芯片是 16%。
	 */
	tint: { status: number; accent: number };
}

export interface AppearanceRules {
	/** 远离背景的亮度方向：浅色向暗为 -1，深色向亮为 1 */
	direction: -1 | 1;
	/** 第 1 档（页面背景）的亮度 */
	background: number;
	/** 第 12 档能到达的最远亮度 */
	limit: number;
	/** 品牌、状态与分类色阶各档色度相对种子色度的比例 */
	brandChroma: readonly number[];
	/** 中性色阶各档色度相对 `neutralChroma` 的比例 */
	neutralChroma: readonly number[];
	/**
	 * 各对比度档位的 WCAG 求解目标。标准档正文与次要文字至少 4.5:1、边界至少 3:1；
	 * 提高档文字至少 7:1、边界至少 4.5:1。部分目标更高以复现设计稿取值，
	 * 并为组件底色、取整与 8 位量化留余量；APCA 不参与目标选择。
	 */
	targets: Readonly<Record<ContrastLevel, Targets>>;
	material: MaterialRules;
}

export const RULES: Readonly<Record<Appearance, AppearanceRules>> = {
	light: {
		direction: -1,
		background: 0.992,
		limit: 0.1,
		brandChroma: [0.02, 0.05, 0.1, 0.18, 0.26, 0.36, 0.6, 0.75, 1, 1, 0.9, 0.5],
		neutralChroma: [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.85, 0.9, 1, 1, 0.9, 0.7],
		material: {
			page: { l: 0.968, c: 0.006 },
			sheet: { l: 0.994, c: 0.003 },
			sunk: { l: 0.945, c: 0.007 },
			rule: 0.11,
			rule2: 0.3,
			accent: { l: 0.4739, chromaScale: 1 },
			textContrast: { standard: 4.5, more: 7 },
			danger: { l: 0.52, c: 0.16, h: 27 },
			ok: { l: 0.52, c: 0.13, h: 155 },
			tint: { status: 0.12, accent: 0.16 },
		},
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
		material: {
			page: { l: 0.17, c: 0.0087 },
			sheet: { l: 0.235, c: 0.011 },
			sunk: { l: 0.29, c: 0.012 },
			rule: 0.12,
			rule2: 0.3,
			accent: { l: 0.8589, chromaScale: 1.0585 },
			textContrast: { standard: 4.5, more: 7 },
			danger: { l: 0.74, c: 0.14, h: 25 },
			ok: { l: 0.74, c: 0.15, h: 155 },
			tint: { status: 0.12, accent: 0.16 },
		},
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

/**
 * 分类色：色相固定、不随主题变化，按图表系列的使用顺序排列，相邻两色差异最大且红绿不相邻。
 * 同一外观与档位下各色实色档的亮度相差不超过 0.1（近等亮度）。色相两两至少相差 45°，色相与偏好亮度
 * 由离线搜索得出：在正常视觉与 Machado 2009 的红、绿、蓝色盲模拟下，使两两最小色差最大。
 */
export const CATEGORICAL: readonly {
	hue: number;
	chroma: number;
	lightness: Readonly<Record<Appearance, Readonly<Record<ContrastLevel, number>>>>;
}[] = [
	{
		hue: 261,
		chroma: 0.2,
		lightness: {
			light: { standard: 0.478, more: 0.436 },
			dark: { standard: 0.811, more: 0.873 },
		},
	},
	{
		hue: 85,
		chroma: 0.2,
		lightness: {
			light: { standard: 0.451, more: 0.35 },
			dark: { standard: 0.794, more: 0.876 },
		},
	},
	{
		hue: 131,
		chroma: 0.2,
		lightness: {
			light: { standard: 0.498, more: 0.397 },
			dark: { standard: 0.848, more: 0.925 },
		},
	},
	{
		hue: 309,
		chroma: 0.2,
		lightness: {
			light: { standard: 0.493, more: 0.403 },
			dark: { standard: 0.882, more: 0.93 },
		},
	},
	{
		hue: 183,
		chroma: 0.2,
		lightness: {
			light: { standard: 0.551, more: 0.414 },
			dark: { standard: 0.84, more: 0.888 },
		},
	},
	{
		hue: 10,
		chroma: 0.2,
		lightness: {
			light: { standard: 0.488, more: 0.447 },
			dark: { standard: 0.854, more: 0.912 },
		},
	},
];
