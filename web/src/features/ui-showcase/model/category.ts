/** 按用途划分的类别，只用作筛选。 */
export type Category =
	| "action"
	| "form"
	| "navigation"
	| "overlay"
	| "feedback"
	| "display"
	| "content"
	| "layout";

export const CATEGORIES: { id: Category; name: string }[] = [
	{ id: "action", name: "操作" },
	{ id: "form", name: "表单" },
	{ id: "navigation", name: "导航" },
	{ id: "overlay", name: "浮层" },
	{ id: "feedback", name: "反馈" },
	{ id: "display", name: "展示" },
	{ id: "content", name: "内容" },
	{ id: "layout", name: "布局" },
];
