/**
 * 冷香紫罗兰（Violet）色彩体系元数据与色阶定义。
 *
 * 聚合全站品牌、底色画布、表面材质、状态色、图表调色板与霓虹光色定义。
 */

export interface TokenItem {
	variable: string;
	name: string;
	role: string;
	light: string;
	dark: string;
	description: string;
	contrastOnCanvas?: {
		light: number;
		dark: number;
	};
	/** 是否为空间表面/背景材质 */
	isSurface?: boolean;
	/** 表面上的主要前景色定义，用于评估文字与表面的易读性对比度 */
	onSurfaceForeground?: {
		variable: string;
		name: string;
		light: string;
		dark: string;
	};
}

export interface TonalRampStep {
	step: number;
	name: string;
	oklch: string;
	role: string;
	usage: string;
}

/** 品牌紫罗兰 6 核心令牌 */
export const BRAND_TOKENS: TokenItem[] = [
	{
		variable: "--brand",
		name: "品牌主色",
		role: "Primary Brand Voice",
		light: "oklch(0.53 0.205 286)",
		dark: "oklch(0.72 0.148 286)",
		description:
			"皇家鸢尾／星空紫水晶。浅色对比度 >5.7:1，暗色精准调校至 0.148 Chroma，100% sRGB 全覆盖无裁剪。",
	},
	{
		variable: "--brand-foreground",
		name: "品牌色前景",
		role: "On Brand Surface",
		light: "oklch(0.99 0 0)",
		dark: "oklch(0.14 0.02 286)",
		description:
			"品牌色之上的前景色，浅色采用纯白瓷高对比，暗色采用深冷墨字，确保 AA/AAA 级易读性。",
	},
	{
		variable: "--brand-hover",
		name: "悬停高亮",
		role: "Interactive Hover",
		light: "oklch(0.47 0.215 286)",
		dark: "oklch(0.77 0.138 286)",
		description: "浅色下同色相加深稳重，暗色下提亮微透光，提供细腻的微交互动势。",
	},
	{
		variable: "--brand-wash",
		name: "薄雾表面",
		role: "Atmospheric Wash",
		light: "oklch(0.965 0.022 286)",
		dark: "oklch(0.22 0.038 286)",
		description:
			"极浅鸢尾冷香透光层，只用于轻量 hover 面与弱强调徽章，拒绝大面积彩色喧宾夺主。",
		isSurface: true,
		onSurfaceForeground: {
			variable: "--brand-wash-foreground",
			name: "薄雾字色",
			light: "oklch(0.35 0.14 286)",
			dark: "oklch(0.9 0.07 286)",
		},
	},
	{
		variable: "--brand-wash-foreground",
		name: "薄雾字色",
		role: "Text on Wash",
		light: "oklch(0.35 0.14 286)",
		dark: "oklch(0.9 0.07 286)",
		description: "薄雾表面上的伴生文字，浅色为深紫罗兰墨色，暗色为浅丁香紫。",
	},
	{
		variable: "--brand-ring",
		name: "焦点外环",
		role: "Focus Ring",
		light: "oklch(0.53 0.205 286)",
		dark: "oklch(0.72 0.148 286)",
		description: "键盘 Tab 导航与输入框聚焦时的特征光环，与品牌色浑然一体。",
	},
];

/** 11 阶紫罗兰（Hue 286）色阶光谱 */
export const TONAL_RAMP: TonalRampStep[] = [
	{
		step: 50,
		name: "薄雾轻羽",
		oklch: "oklch(0.975 0.018 286)",
		role: "Tint & Backdrop",
		usage: "微光底色、选区微晕、轻量 hover 背景",
	},
	{
		step: 100,
		name: "浅丁香紫",
		oklch: "oklch(0.94 0.045 286)",
		role: "Light Accent Tint",
		usage: "薄雾徽章底色、次级激活态表面",
	},
	{
		step: 200,
		name: "薰衣草紫",
		oklch: "oklch(0.88 0.085 286)",
		role: "Subtle Border & Glow",
		usage: "聚焦轮廓浅晕、高光分割线",
	},
	{
		step: 300,
		name: "明紫罗兰",
		oklch: "oklch(0.78 0.135 286)",
		role: "Soft Luminous",
		usage: "暗色微光发光体、辅助提示",
	},
	{
		step: 400,
		name: "星空紫水晶",
		oklch: "oklch(0.72 0.148 286)",
		role: "Dark Mode Brand",
		usage: "暗色模式核心品牌强调色（--brand）",
	},
	{
		step: 500,
		name: "皇家鸢尾紫",
		oklch: "oklch(0.53 0.205 286)",
		role: "Light Mode Brand",
		usage: "浅色模式核心品牌强调色（--brand）",
	},
	{
		step: 600,
		name: "深曜紫罗兰",
		oklch: "oklch(0.47 0.215 286)",
		role: "Hover & Accent Active",
		usage: "浅色悬停态加深、图标重强调",
	},
	{
		step: 700,
		name: "暮夜冷紫",
		oklch: "oklch(0.38 0.175 286)",
		role: "Deep Ink Shade",
		usage: "薄雾之上的高对比字墨、暗色边框",
	},
	{
		step: 800,
		name: "玄青紫墨",
		oklch: "oklch(0.28 0.125 286)",
		role: "Midnight Surface",
		usage: "暗色浮层面板、深层背景",
	},
	{
		step: 900,
		name: "幽邃冷曜",
		oklch: "oklch(0.20 0.075 286)",
		role: "Abyssal Layer",
		usage: "暗色卡片底层、极深投影基底",
	},
	{
		step: 950,
		name: "玄曜星空",
		oklch: "oklch(0.138 0.012 286)",
		role: "Dark Canvas Background",
		usage: "暗色模式全站总画布（--background）",
	},
];

/** 画布与空间表面层级 */
export const SURFACE_LAYERS: TokenItem[] = [
	{
		variable: "--background",
		name: "画布底色",
		role: "Level 0 · Canvas",
		light: "oklch(0.992 0.003 286)",
		dark: "oklch(0.138 0.012 286)",
		description:
			"浅色温润白瓷微泛冷香，彻底消除纯白刺眼眩光；深色玄曜黑曜石星空，带极低彩微晕。",
		isSurface: true,
		onSurfaceForeground: {
			variable: "--foreground",
			name: "正文主墨",
			light: "oklch(0.19 0.015 286)",
			dark: "oklch(0.955 0.008 286)",
		},
	},
	{
		variable: "--card",
		name: "卡片表面",
		role: "Level 1 · Card Surface",
		light: "oklch(1 0 0)",
		dark: "oklch(0.185 0.015 286)",
		description: "浅色纯净白悬浮于白瓷之上形成微层级；深色面板提升 4.7% 明度，界定内容容器。",
		isSurface: true,
		onSurfaceForeground: {
			variable: "--card-foreground",
			name: "卡片文字",
			light: "oklch(0.19 0.015 286)",
			dark: "oklch(0.955 0.008 286)",
		},
	},
	{
		variable: "--popover",
		name: "浮层与菜单",
		role: "Level 2 · Popover",
		light: "oklch(1 0 0)",
		dark: "oklch(0.185 0.015 286)",
		description: "下拉菜单、气泡提示与对话框实体，与阴影体系协同表达空间进深。",
		isSurface: true,
		onSurfaceForeground: {
			variable: "--popover-foreground",
			name: "浮层文字",
			light: "oklch(0.19 0.015 286)",
			dark: "oklch(0.955 0.008 286)",
		},
	},
	{
		variable: "--surface-glass",
		name: "毛玻璃介质",
		role: "Level 2.5 · Frosted Glass",
		light: "oklch(1 0 0 / 70%)",
		dark: "oklch(0.185 0.015 286 / 60%)",
		description: "半透明雾化层，搭配 backdrop-blur，用于顶部粘性导航栏与沉浸式浮层。",
		isSurface: true,
		onSurfaceForeground: {
			variable: "--foreground",
			name: "介质文字",
			light: "oklch(0.19 0.015 286)",
			dark: "oklch(0.955 0.008 286)",
		},
	},
	{
		variable: "--brand-wash",
		name: "薄雾交互表面",
		role: "Level 3 · Mist Wash",
		light: "oklch(0.965 0.022 286)",
		dark: "oklch(0.22 0.038 286)",
		description: "带有冷香鸢尾色相的互动受光面，在 hover 与选中时营造轻柔呼吸感。",
		isSurface: true,
		onSurfaceForeground: {
			variable: "--brand-wash-foreground",
			name: "薄雾字色",
			light: "oklch(0.35 0.14 286)",
			dark: "oklch(0.9 0.07 286)",
		},
	},
	{
		variable: "--paper",
		name: "典藏古纸面",
		role: "Special · Heritage Paper",
		light: "oklch(0.976 0.012 85)",
		dark: "oklch(0.23 0.012 70)",
		description: "暖米古籍纸与深褐书页，专供长篇专栏、代码文档与书籍连续阅读体验。",
		isSurface: true,
		onSurfaceForeground: {
			variable: "--paper-foreground",
			name: "古籍墨字",
			light: "oklch(0.24 0.014 60)",
			dark: "oklch(0.92 0.012 80)",
		},
	},
];

/** 状态语义色 */
export const STATUS_TOKENS: TokenItem[] = [
	{
		variable: "--destructive",
		name: "危险 / 破坏",
		role: "Destructive / Crimson",
		light: "oklch(0.58 0.22 25)",
		dark: "oklch(0.68 0.2 25)",
		description: "警告删除、阻断错误与危险操作。独立色相，不受品牌色覆写影响。",
	},
	{
		variable: "--warning",
		name: "注意 / 警告",
		role: "Warning / Amber",
		light: "oklch(0.64 0.16 75)",
		dark: "oklch(0.78 0.16 80)",
		description: "未保存提醒、安全提示与降级运行态，高警觉性而不刺目。",
	},
	{
		variable: "--success",
		name: "成功 / 达成",
		role: "Success / Emerald",
		light: "oklch(0.58 0.15 155)",
		dark: "oklch(0.76 0.18 155)",
		description: "发布完成、验证通过与服务正常，碧玉翡翠般舒缓清透。",
	},
];

/** 图表调色板 5 色 */
export const CHART_TOKENS: TokenItem[] = [
	{
		variable: "--chart-1",
		name: "图表 1 · 鸢尾主频",
		role: "Violet Primary",
		light: "oklch(0.58 0.2 286)",
		dark: "oklch(0.72 0.18 286)",
		description: "与品牌色呼应的主序列，负责主要量纲与第一指标。",
	},
	{
		variable: "--chart-2",
		name: "图表 2 · 冰海冷青",
		role: "Cyan Ocean",
		light: "oklch(0.64 0.16 220)",
		dark: "oklch(0.74 0.16 220)",
		description: "冷色调次序列，平缓延伸，形成视觉冷热节奏。",
	},
	{
		variable: "--chart-3",
		name: "图表 3 · 碧翠生命",
		role: "Emerald Leaf",
		light: "oklch(0.6 0.15 155)",
		dark: "oklch(0.76 0.16 155)",
		description: "正向增长与健康度维度。",
	},
	{
		variable: "--chart-4",
		name: "图表 4 · 琥珀曦阳",
		role: "Amber Sun",
		light: "oklch(0.74 0.16 75)",
		dark: "oklch(0.8 0.16 75)",
		description: "暖色调对比序列，唤起注意力与转折点。",
	},
	{
		variable: "--chart-5",
		name: "图表 5 · 暮霞绯红",
		role: "Rose Twilight",
		light: "oklch(0.64 0.2 350)",
		dark: "oklch(0.74 0.18 350)",
		description: "峰值、异常点与特殊分类标记。",
	},
];

/** 霓虹高发光光谱 */
export const NEON_TOKENS: TokenItem[] = [
	{
		variable: "--neon-purple",
		name: "霓虹紫",
		role: "Luminous Purple",
		light: "oklch(0.56 0.26 295)",
		dark: "oklch(0.72 0.3 295)",
		description: "高饱和电光紫，暗色模式下提供星轨流光质感。",
	},
	{
		variable: "--neon-blue",
		name: "霓虹蓝",
		role: "Luminous Blue",
		light: "oklch(0.6 0.22 245)",
		dark: "oklch(0.78 0.28 245)",
		description: "数字荧光蓝，用于重点连线与交互流向指示。",
	},
	{
		variable: "--neon-green",
		name: "霓虹绿",
		role: "Luminous Green",
		light: "oklch(0.62 0.19 150)",
		dark: "oklch(0.8 0.25 150)",
		description: "高能荧光绿，用于活跃节点与在线心跳点。",
	},
	{
		variable: "--neon-pink",
		name: "霓虹粉",
		role: "Luminous Pink",
		light: "oklch(0.65 0.25 350)",
		dark: "oklch(0.75 0.3 350)",
		description: "激光绯粉，用于热点徽章与特别关注标签。",
	},
	{
		variable: "--neon-cyan",
		name: "霓虹青",
		role: "Luminous Cyan",
		light: "oklch(0.7 0.16 210)",
		dark: "oklch(0.82 0.2 210)",
		description: "极光青蓝，轻透高冷，充当科技感边界指示。",
	},
];
