import { ALL_TOKENS } from "./tokens";

/**
 * 快速决策表的裁定清单：不知道该用哪个 token 时，先查这张表；
 * 表里没有的，回到基本原则（壹·设计原则四字箴言）。
 *
 * 每行的 varName 必须收录在 token 词典清单中——对账测试由此把
 * 决策表锚到映射层，引用幽灵 token 即红。
 */

export interface DecisionRow {
	/** 使用场景 */
	scene: string;
	/** 应选 token 的工具类主形态（如 bg-primary） */
	className: string;
	/** 对应 CSS 变量（如 --primary） */
	varName: string;
	/** 一句裁定理由 */
	reason: string;
}

export interface DecisionCategory {
	id: string;
	title: string;
	rows: DecisionRow[];
}

export const DECISION_CATEGORIES: DecisionCategory[] = [
	{
		id: "surface",
		title: "表面与画布",
		rows: [
			{
				scene: "页面画布底色",
				className: "bg-background",
				varName: "--background",
				reason: "画布唯一底色，自带冷香微晕，不用纯白。",
			},
			{
				scene: "卡片面",
				className: "bg-card",
				varName: "--card",
				reason: "内容浮于画布一档时用卡片面。",
			},
			{
				scene: "浮层与弹窗底",
				className: "bg-popover",
				varName: "--popover",
				reason: "浮层与卡片分层，不互相借用。",
			},
			{
				scene: "弱背景条带",
				className: "bg-muted",
				varName: "--muted",
				reason: "无需卡片感的弱分区，比卡片更轻。",
			},
			{
				scene: "悬停与选中底",
				className: "hover:bg-accent",
				varName: "--accent",
				reason: "交互反馈首选，跟随方言映射。",
			},
			{
				scene: "毛玻璃面",
				className: "bg-surface-glass",
				varName: "--surface-glass",
				reason: "玻璃材质唯一入口；材质遗留语义，存量可用勿新增场景。",
			},
			{
				scene: "纸面装帧",
				className: "bg-paper",
				varName: "--paper",
				reason: "文档装帧专用，与画布区分材质。",
			},
		],
	},
	{
		id: "text",
		title: "文字层级",
		rows: [
			{
				scene: "正文文字",
				className: "text-foreground",
				varName: "--foreground",
				reason: "正文默认墨色。",
			},
			{
				scene: "次要信息",
				className: "text-muted-foreground",
				varName: "--muted-foreground",
				reason: "层级靠字号字重为主、此色为辅，不再叠加透明度。",
			},
			{
				scene: "主要动作上的文字",
				className: "text-primary-foreground",
				varName: "--primary-foreground",
				reason: "与动作底色成对取用，不单独手配色值。",
			},
			{
				scene: "品牌淡染面上的文字",
				className: "text-brand-wash-foreground",
				varName: "--brand-wash-foreground",
				reason: "与 brand-wash 成对，保证对比度。",
			},
		],
	},
	{
		id: "action",
		title: "动作与品牌",
		rows: [
			{
				scene: "主要动作",
				className: "bg-primary",
				varName: "--primary",
				reason: "值由所在方言决定：公开方言映射品牌色，工具方言保持高对比中性。",
			},
			{
				scene: "品牌直接强调",
				className: "bg-brand",
				varName: "--brand",
				reason: "确需品牌原色时用品牌层，不经 primary 间接映射。",
			},
			{
				scene: "次要动作",
				className: "bg-secondary",
				varName: "--secondary",
				reason: "弱于主要动作一档的面。",
			},
			{
				scene: "危险动作",
				className: "bg-destructive",
				varName: "--destructive",
				reason: "删除、撤销等不可逆操作。",
			},
			{
				scene: "品牌淡染底",
				className: "bg-brand-wash",
				varName: "--brand-wash",
				reason: "徽章、提示的温和品牌底，避免整面 brand 刺激。",
			},
			{
				scene: "品牌悬停",
				className: "hover:bg-brand-hover",
				varName: "--brand-hover",
				reason: "brand 面的悬停态成对取用。",
			},
		],
	},
	{
		id: "line",
		title: "描边与线",
		rows: [
			{
				scene: "常规描边",
				className: "border-border",
				varName: "--border",
				reason: "卡片、分区的默认线。",
			},
			{
				scene: "发丝线",
				className: "border-edge-hairline",
				varName: "--edge-hairline",
				reason: "更轻的旧语义线，存量可用，新界面优先 border-border。",
			},
			{
				scene: "输入框描边",
				className: "border-input",
				varName: "--input",
				reason: "表单控件专用，与常规描边区分。",
			},
			{
				scene: "纸面描边",
				className: "border-paper-border",
				varName: "--paper-border",
				reason: "纸面材质内使用。",
			},
		],
	},
	{
		id: "focus",
		title: "焦点与状态",
		rows: [
			{
				scene: "焦点环",
				className: "ring-ring",
				varName: "--ring",
				reason: "全站统一焦点可见性。",
			},
			{
				scene: "品牌焦点环",
				className: "ring-brand-ring",
				varName: "--brand-ring",
				reason: "工具方言的焦点环值，随品牌层走。",
			},
			{
				scene: "成功 / 警示 / 危险信息",
				className: "text-success",
				varName: "--success",
				reason: "行为状态色（success/warning/destructive 三件套），语义固定，色板不得改写。",
			},
		],
	},
	{
		id: "chart",
		title: "图表与霓虹",
		rows: [
			{
				scene: "图表序列色",
				className: "bg-chart-1",
				varName: "--chart-1",
				reason: "序列色一至五（chart-1…chart-5）按序取用，不自配色。",
			},
			{
				scene: "霓虹强调",
				className: "text-neon-purple",
				varName: "--neon-purple",
				reason: "装饰与运营事件专用（purple/blue/green/pink/cyan），正文界面不用。",
			},
		],
	},
];

/** 全部裁定行的平铺清单，对账测试消费 */
export const ALL_DECISIONS: DecisionRow[] = DECISION_CATEGORIES.flatMap(
	(category) => category.rows,
);

/**
 * assertDecisionsAnchored - 决策表防漂移核验：每行 varName 已收录词典、
 * className 词干与 varName 派生的工具类词干一致。
 *
 * @returns 核验失败的行与原因，空数组即全部锚定
 */
export function findUnanchoredDecisions(): Array<{ row: DecisionRow; reason: string }> {
	const failures: Array<{ row: DecisionRow; reason: string }> = [];
	for (const row of ALL_DECISIONS) {
		const token = ALL_TOKENS.find((t) => t.varName === row.varName);
		if (!token) {
			failures.push({ row, reason: `${row.varName} 未收录 token 词典` });
			continue;
		}
		// className 允许带 hover: 等前缀与 ring-/text-/bg-/border- 前缀，词干必须一致
		const utility = row.className.split(":").at(-1) ?? row.className;
		const stem = utility.replace(/^(bg|text|border|ring)-/, "");
		if (stem !== token.stem) {
			failures.push({ row, reason: `${row.className} 与 ${token.stem} 词干不一致` });
		}
	}
	return failures;
}
