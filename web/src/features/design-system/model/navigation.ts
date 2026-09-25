/**
 * 设计系统二级子菜单项。
 */
export interface DesignSystemNavSubItem {
	/** 子项唯一标识 */
	id: string;
	/** 子项名称 */
	title: string;
	/** 路由目标或定位锚点 */
	to: string;
	/** 可选角标说明 */
	badge?: string;
	/** 简述 */
	description?: string;
}

/**
 * 设计系统菜单项（一级条目）。
 */
export interface DesignSystemNavItem {
	/** 章节或模块唯一标识 */
	id: string;
	/** 中文章号或序列标号，如「壹」「01」 */
	num: string;
	/** 标题名称 */
	title: string;
	/** 对应页面路由路径 */
	to: string;
	/** 范围说明与导言 */
	scope: string;
	/** 可选角标说明，如「营造中」 */
	badge?: string;
	/** 二级子菜单列表，配置时呈可折叠展开树 */
	children?: DesignSystemNavSubItem[];
}

/**
 * 设计系统导航卷别分组。
 */
export interface DesignSystemNavGroup {
	/** 分组唯一标识 */
	id: string;
	/** 卷别中文名称 */
	title: string;
	/** 该卷别包含的章节条目 */
	items: DesignSystemNavItem[];
}

/**
 * 设计总纲四字箴言：快速决策表查无此项时回退的最高判据。
 */
export const PRINCIPLES = [
	{ word: "有效", gloss: "一切样式服务于内容与任务，装饰不越位。" },
	{ word: "清晰", gloss: "层级靠字号、字重、间距与对比表达，一眼可知主次。" },
	{ word: "准确", gloss: "token 即法定用量：语义类名优先，规格照表，不引用不存在之物。" },
	{ word: "美", gloss: "克制而后独特：动效克制、留白大方，在统一中露出本站气质。" },
] as const;

/**
 * 贯穿全站的底线：任何界面不得逾越，数字细则归各规格章节。
 */
export const BASELINES = [
	"语义 token 优先，不引用不存在的 token。",
	"文字与背景满足 WCAG AA 对比度。",
	"非必要不用缩放与方向位移动效。",
	"功能性圆角不过 rounded-2xl，硬投影一律禁用。",
] as const;

/**
 * 营造法式典籍卷目编排。
 */
export const DESIGN_SYSTEM_NAV_GROUPS: DesignSystemNavGroup[] = [
	{
		id: "principles-group",
		title: "卷一 · 纲纪准则",
		items: [
			{
				id: "principles",
				num: "壹",
				title: "设计原则",
				to: "/design-system/principles",
				scope: "查表无果时回退的最高判据，与贯穿全站的底线。",
			},
			{
				id: "decisions",
				num: "贰",
				title: "快速决策表",
				to: "/design-system/decisions",
				scope: "不知道该用哪个 token 时，先查这张表。表里没有的，回到基本原则。",
			},
		],
	},
	{
		id: "foundations-group",
		title: "卷二 · 营造法度",
		items: [
			{
				id: "palette",
				num: "叁",
				title: "色板生成器",
				to: "/design-system/palette",
				scope: "以单一主色为种，推演全域色阶、语义角色与中性基准。",
			},
			{
				id: "tokens",
				num: "肆",
				title: "Token 词典",
				to: "/design-system/tokens",
				scope: "品牌色、功能色、中性色、语义色——全部语义 token 的名称与实时值。",
			},
			{
				id: "layout",
				num: "伍",
				title: "布局规格",
				to: "/design-system/layout",
				scope: "间距、圆角、投影与容器的法定刻度。",
			},
			{
				id: "motion",
				num: "陆",
				title: "动效章程",
				to: "/design-system/motion",
				scope: "运动的时间、幅度与克制的事由。",
			},
		],
	},
	{
		id: "components-group",
		title: "卷三 · 构件陈列",
		items: [
			{
				id: "specimens",
				num: "柒",
				title: "组件目录",
				to: "/design-system/specimens",
				scope: "组件文档的共通要求与按能力取舍，以及本站真实组件示例。",
				children: [
					{
						id: "button",
						title: "Button",
						to: "/design-system/specimens/button",
						description: "按钮 · 动作层级与交互状态",
					},
					{
						id: "checkbox",
						title: "Checkbox",
						to: "/design-system/specimens/checkbox",
						description: "复选框 · 三态选择与微光实体反馈",
					},
					{
						id: "comment-section",
						title: "CommentSection",
						to: "/design-system/specimens/comment-section",
						description: "评论区 · 纯展示评论套件",
					},
					{
						id: "cartoon-popover",
						title: "CartoonPopover",
						to: "/design-system/specimens/cartoon-popover",
						description: "卡通气泡 · 纯手绘对白与思考浮层",
					},
				],
			},
		],
	},
];

/**
 * 展平后的全部可导航一级章节列表。
 */
export const ALL_NAV_ITEMS: DesignSystemNavItem[] = DESIGN_SYSTEM_NAV_GROUPS.flatMap(
	(group) => group.items,
);

/**
 * 根据当前 pathname 匹配对应的章节项。
 *
 * @param pathname - 当前路由路径
 * @returns 匹配到的导航项，未匹配时返回首章
 */
export function findNavItemByPath(pathname: string): DesignSystemNavItem {
	const normalized = pathname.replace(/\/$/, "");
	const exact = ALL_NAV_ITEMS.find((item) => item.to === normalized);
	if (exact) return exact;

	const partial = ALL_NAV_ITEMS.find((item) => normalized.startsWith(item.to));
	return partial ?? ALL_NAV_ITEMS[0];
}

/**
 * 根据当前项推导上篇与下篇导航链接。
 *
 * @param currentId - 当前页面条目标识
 * @returns 上一章与下一章的元数据
 */
export function getSiblingNavItems(currentId: string): {
	prev: DesignSystemNavItem | null;
	next: DesignSystemNavItem | null;
} {
	const index = ALL_NAV_ITEMS.findIndex((item) => item.id === currentId);
	if (index === -1) {
		return { prev: null, next: ALL_NAV_ITEMS[1] ?? null };
	}
	return {
		prev: index > 0 ? ALL_NAV_ITEMS[index - 1] : null,
		next: index < ALL_NAV_ITEMS.length - 1 ? ALL_NAV_ITEMS[index + 1] : null,
	};
}
