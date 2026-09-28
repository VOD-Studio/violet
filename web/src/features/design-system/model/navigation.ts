import { DESIGN_SYSTEM_CATALOG } from "./guides";

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
	/** 公开包组件或站点私有组件 */
	category: "library" | "site";
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
	children?: readonly DesignSystemNavSubItem[];
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

/** 卷内条目编号统一用中文数字，保持营造法式的卷别体例。 */
const CN_NUMERALS = ["壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖", "拾"] as const;

/** 目录是唯一真相；导航分组只是给目录条目补上卷内编号。 */
export const DESIGN_SYSTEM_NAV_GROUPS: DesignSystemNavGroup[] = DESIGN_SYSTEM_CATALOG.map(
	(group) => ({
		id: group.id,
		title: group.title,
		items: group.items.map((item, index) => ({
			num: CN_NUMERALS[index] ?? String(index + 1),
			badge: undefined,
			...item,
		})),
	}),
);

/**
 * 展平后的全部可导航一级章节列表。
 */
export const ALL_NAV_ITEMS: DesignSystemNavItem[] = DESIGN_SYSTEM_NAV_GROUPS.flatMap(
	(group) => group.items,
);

/**
 * 根据当前 pathname 匹配对应的章节项。
 *
 * 先精确匹配，再回退到最长前缀命中（覆盖子路由）；
 * 均未命中时回退到第一章。
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
