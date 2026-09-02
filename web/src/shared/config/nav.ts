import type { LucideIcon } from "lucide-react";
import {
	Archive,
	BookOpen,
	FlaskConical,
	FolderKanban,
	House,
	Images,
	Library,
	MessageCircle,
	NotebookText,
	Rss,
	Sparkles,
	Users,
} from "lucide-react";

export interface NavRouteItem {
	type: "route";
	label: string;
	to: string;
	exact?: boolean;
	primary?: boolean;
	icon: LucideIcon;
	description: string;
}

export interface NavActionItem {
	type: "action";
	label: string;
	action: string;
	icon: LucideIcon;
	description: string;
}

export type NavItem = NavRouteItem | NavActionItem;

export const NAV_ITEMS: NavItem[] = [
	{
		type: "route",
		label: "首页",
		to: "/",
		exact: true,
		primary: true,
		icon: House,
		description: "返回站点首页",
	},
	{
		type: "route",
		label: "博客",
		to: "/blog",
		exact: true,
		primary: true,
		icon: Rss,
		description: "阅读最新文章",
	},
	{
		type: "route",
		label: "系列",
		to: "/series",
		primary: true,
		icon: Library,
		description: "按专题连续阅读",
	},
	{
		type: "route",
		label: "图集",
		to: "/galleries",
		primary: true,
		icon: Images,
		description: "浏览已经发布的视觉作品",
	},
	{
		type: "route",
		label: "推文",
		to: "/tweets",
		exact: true,
		primary: true,
		icon: Sparkles,
		description: "查看短内容动态",
	},
	{
		type: "route",
		label: "笔记",
		to: "/notes",
		icon: NotebookText,
		description: "浏览知识笔记与踩坑记录",
	},
	{
		type: "route",
		label: "归档",
		to: "/blog/archive",
		icon: Archive,
		description: "按时间查找文章",
	},
	{
		type: "route",
		label: "聊天",
		to: "/chat",
		exact: true,
		icon: MessageCircle,
		description: "进入站内聊天室",
	},
	{
		type: "route",
		label: "项目",
		to: "/projects",
		icon: FolderKanban,
		description: "查看开源与实验项目",
	},
	{
		type: "route",
		label: "友链",
		to: "/friends",
		icon: Users,
		description: "访问朋友们的站点",
	},
	{
		type: "route",
		label: "关于",
		to: "/about",
		icon: BookOpen,
		description: "了解作者与本站",
	},
	{
		type: "route",
		label: "实验室",
		to: "/lab",
		icon: FlaskConical,
		description: "探索原型与交互实验",
	},
];
