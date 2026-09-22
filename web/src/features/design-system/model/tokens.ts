/**
 * 营造法式 token 词典的清单数据：与样式映射层（styles/theme.css）对账的唯一清单。
 *
 * 只收录映射层已映射到工具类的颜色 token；词干（stem）对应 --color-<stem>，
 * 变量名（varName）对应映射右侧的 var(--x)。防漂移对账测试双向核对本清单
 * 与映射层：清单引用幽灵 token、或映射层核心 token 未收录，任一失衡即红。
 */

export interface TokenDoc {
	/** CSS 变量名（如 --background） */
	varName: string;
	/** 工具类词干（如 background → bg-background / text-background） */
	stem: string;
	/** 一句用途说明 */
	purpose: string;
}

export interface TokenGroup {
	/** 章节内锚定 id */
	id: string;
	title: string;
	/** 分组职责一句注 */
	note: string;
	tokens: TokenDoc[];
}

export const TOKEN_GROUPS: TokenGroup[] = [
	{
		id: "semantic",
		title: "语义色",
		note: "组件消费的主干。主要动作色随方言映射：公开方言映射品牌色，工具方言保持高对比中性。",
		tokens: [
			{ varName: "--background", stem: "background", purpose: "页面画布底色。" },
			{ varName: "--foreground", stem: "foreground", purpose: "画布上的正文墨色。" },
			{ varName: "--card", stem: "card", purpose: "卡片面。" },
			{ varName: "--card-foreground", stem: "card-foreground", purpose: "卡片上的文字。" },
			{ varName: "--popover", stem: "popover", purpose: "浮层底色。" },
			{
				varName: "--popover-foreground",
				stem: "popover-foreground",
				purpose: "浮层上的文字。",
			},
			{ varName: "--primary", stem: "primary", purpose: "主要动作色，值由所在方言决定。" },
			{
				varName: "--primary-foreground",
				stem: "primary-foreground",
				purpose: "主要动作上的文字。",
			},
			{ varName: "--secondary", stem: "secondary", purpose: "次要动作面。" },
			{
				varName: "--secondary-foreground",
				stem: "secondary-foreground",
				purpose: "次要动作上的文字。",
			},
			{ varName: "--muted", stem: "muted", purpose: "静默面，弱背景。" },
			{
				varName: "--muted-foreground",
				stem: "muted-foreground",
				purpose: "静默文字，次要信息。",
			},
			{ varName: "--accent", stem: "accent", purpose: "强调面，悬停与选中底色。" },
			{
				varName: "--accent-foreground",
				stem: "accent-foreground",
				purpose: "强调面上的文字。",
			},
			{ varName: "--destructive", stem: "destructive", purpose: "危险动作。" },
			{
				varName: "--destructive-foreground",
				stem: "destructive-foreground",
				purpose: "危险动作上的文字。",
			},
			{ varName: "--warning", stem: "warning", purpose: "警示信息。" },
			{
				varName: "--warning-foreground",
				stem: "warning-foreground",
				purpose: "警示上的文字。",
			},
			{ varName: "--success", stem: "success", purpose: "成功信息。" },
			{
				varName: "--success-foreground",
				stem: "success-foreground",
				purpose: "成功上的文字。",
			},
			{ varName: "--border", stem: "border", purpose: "常规描边。" },
			{ varName: "--input", stem: "input", purpose: "输入框描边。" },
			{ varName: "--ring", stem: "ring", purpose: "焦点环。" },
		],
	},
	{
		id: "brand",
		title: "品牌色",
		note: "值由配色预设层提供，页面不感知具体色板——色板可插拔，换预设全站跟随。",
		tokens: [
			{ varName: "--brand", stem: "brand", purpose: "品牌强调主色。" },
			{
				varName: "--brand-foreground",
				stem: "brand-foreground",
				purpose: "品牌色上的文字。",
			},
			{ varName: "--brand-hover", stem: "brand-hover", purpose: "品牌悬停态。" },
			{ varName: "--brand-wash", stem: "brand-wash", purpose: "品牌淡染面。" },
			{
				varName: "--brand-wash-foreground",
				stem: "brand-wash-foreground",
				purpose: "淡染面上的文字。",
			},
			{ varName: "--brand-ring", stem: "brand-ring", purpose: "品牌焦点环。" },
		],
	},
	{
		id: "paper",
		title: "纸面",
		note: "文档装帧专用：API 文档纸弹窗与文档页。",
		tokens: [
			{ varName: "--paper", stem: "paper", purpose: "暖米纸面。" },
			{ varName: "--paper-foreground", stem: "paper-foreground", purpose: "纸上墨字。" },
			{ varName: "--paper-muted", stem: "paper-muted", purpose: "纸面静默文字。" },
			{ varName: "--paper-border", stem: "paper-border", purpose: "纸面描边。" },
		],
	},
	{
		id: "legacy",
		title: "材质遗留",
		note: "向后兼容的旧语义，存量可用，新界面勿新增使用。",
		tokens: [
			{ varName: "--edge-hairline", stem: "edge-hairline", purpose: "发丝描边。" },
			{ varName: "--surface-glass", stem: "surface-glass", purpose: "毛玻璃面。" },
		],
	},
	{
		id: "chart",
		title: "图表色",
		note: "数据可视化序列色。",
		tokens: [
			{ varName: "--chart-1", stem: "chart-1", purpose: "图表序列色一。" },
			{ varName: "--chart-2", stem: "chart-2", purpose: "图表序列色二。" },
			{ varName: "--chart-3", stem: "chart-3", purpose: "图表序列色三。" },
			{ varName: "--chart-4", stem: "chart-4", purpose: "图表序列色四。" },
			{ varName: "--chart-5", stem: "chart-5", purpose: "图表序列色五。" },
		],
	},
	{
		id: "neon",
		title: "霓虹色",
		note: "装饰与运营事件专用强调色。",
		tokens: [
			{ varName: "--neon-purple", stem: "neon-purple", purpose: "霓虹紫。" },
			{ varName: "--neon-blue", stem: "neon-blue", purpose: "霓虹蓝。" },
			{ varName: "--neon-green", stem: "neon-green", purpose: "霓虹绿。" },
			{ varName: "--neon-pink", stem: "neon-pink", purpose: "霓虹粉。" },
			{ varName: "--neon-cyan", stem: "neon-cyan", purpose: "霓虹青。" },
		],
	},
];

/** 词典全部 token 的平铺清单，对账测试消费 */
export const ALL_TOKENS: TokenDoc[] = TOKEN_GROUPS.flatMap((group) => group.tokens);
