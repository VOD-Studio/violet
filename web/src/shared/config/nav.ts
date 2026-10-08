import type { LucideIcon } from "lucide-react";
import {
	Archive,
	BookOpen,
	Component,
	FileText,
	FlaskConical,
	FolderKanban,
	House,
	Images,
	LayoutGrid,
	Library,
	MessageCircle,
	NotebookText,
	Rss,
	Sparkles,
	Users,
} from "lucide-react";

/** 可跳转的导航目标。 */
export interface NavLink {
	label: string;
	to: string;
	/** 仅精确路径命中；省略时前缀命中（`/blog` 同时命中 `/blog/$slug`）。 */
	exact?: boolean;
	icon: LucideIcon;
	description: string;
}

/**
 * 顶层导航项。
 *
 * 带 `to` 时本身可跳转；带 `children` 时悬停展开二级菜单；两者都缺省的项没有意义。
 * 无 `to` 仅有 `children` 的是纯分组，点击不跳转。
 */
export interface NavItem extends Omit<NavLink, "to"> {
	to?: string;
	children?: NavLink[];
}

/** 当前路径命中的导航位置：顶层项，及其下实际命中的目标（顶层项自身或某个二级项）。 */
export interface ActiveNav {
	item: NavItem;
	link: NavLink;
}

export const NAV_ITEMS: NavItem[] = [
	{
		label: "首页",
		to: "/",
		exact: true,
		icon: House,
		description: "返回站点首页",
	},
	{
		label: "博客",
		to: "/blog",
		icon: Rss,
		description: "阅读最新文章",
		children: [
			{
				label: "全部文章",
				to: "/blog",
				exact: true,
				icon: FileText,
				description: "按发布时间阅读最新文章",
			},
			{
				label: "归档",
				to: "/blog/archive",
				icon: Archive,
				description: "按时间查找文章",
			},
		],
	},
	{
		label: "系列",
		to: "/series",
		icon: Library,
		description: "按专题连续阅读",
	},
	{
		label: "图集",
		to: "/galleries",
		icon: Images,
		description: "浏览已经发布的视觉作品",
	},
	{
		label: "推文",
		to: "/tweets",
		icon: Sparkles,
		description: "查看短内容动态",
	},
	{
		label: "更多",
		icon: LayoutGrid,
		description: "笔记、聊天、项目与其他页面",
		children: [
			{
				label: "笔记",
				to: "/notes",
				icon: NotebookText,
				description: "浏览知识笔记与踩坑记录",
			},
			{
				label: "聊天",
				to: "/chat",
				icon: MessageCircle,
				description: "进入站内聊天室",
			},
			{
				label: "项目",
				to: "/projects",
				icon: FolderKanban,
				description: "查看开源与实验项目",
			},
			{
				label: "友链",
				to: "/friends",
				icon: Users,
				description: "访问朋友们的站点",
			},
			{
				label: "关于",
				to: "/about",
				icon: BookOpen,
				description: "了解作者与本站",
			},
			{
				label: "实验室",
				to: "/lab",
				icon: FlaskConical,
				description: "探索原型与交互实验",
			},
			{
				label: "组件库",
				to: "/ui",
				icon: Component,
				description: "查阅 violet/ui 组件用法与开发文档",
			},
		],
	},
];

const matchesLink = (pathname: string, link: NavLink) =>
	link.exact ? pathname === link.to : pathname === link.to || pathname.startsWith(`${link.to}/`);

/**
 * 解析当前路径命中的导航位置。
 *
 * 取 `to` 最长的命中项，所以 `/blog/archive` 归「归档」而非「博客」；
 * 长度相同时二级项优先，使「全部文章」在 `/blog` 上被标为当前。
 */
export function resolveActiveNav(pathname: string, items: NavItem[] = NAV_ITEMS): ActiveNav | null {
	let best: ActiveNav | null = null;
	const consider = (item: NavItem, link: NavLink) => {
		if (!matchesLink(pathname, link)) return;
		if (best === null || link.to.length >= best.link.to.length) best = { item, link };
	};
	for (const item of items) {
		// 顶层项先于其二级项登记，等长时由二级项覆盖
		if (item.to !== undefined) consider(item, item as NavLink);
		for (const child of item.children ?? []) consider(item, child);
	}
	return best;
}

/** 展开为可跳转目标的扁平列表（按 `to` 去重，保留首次出现的项）。 */
export function flattenNavLinks(items: NavItem[] = NAV_ITEMS): NavLink[] {
	const seen = new Set<string>();
	const links: NavLink[] = [];
	for (const item of items) {
		for (const link of [
			...(item.to !== undefined ? [item as NavLink] : []),
			...(item.children ?? []),
		]) {
			if (seen.has(link.to)) continue;
			seen.add(link.to);
			links.push(link);
		}
	}
	return links;
}
