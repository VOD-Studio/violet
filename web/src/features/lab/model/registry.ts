/**
 * Lab 注册表 - /lab 索引页数据源
 *
 * 新增实验室三步：features/lab/<name>/ 建目录（小 lab 也可路由内自包含，
 * 原型件被生产组件复用时可留在原层，如 widgets/ThemeToggle/variants）、
 * routes/lab.<name>.tsx 建路由（createFileRoute("/lab/<name>")）、在此追加
 * 一条注册。lab 是原型工作台，不进主导航，选定方向后生产实现按此落地。
 */
export const LABS = [
	{
		to: "/lab/blog",
		en: "Blog",
		title: "博客排版实验室",
		description: "博客列表页的八套排版方案，任选一套替换到正式页面。",
		meta: "8 方向",
	},
	{
		to: "/lab/friends",
		en: "Friends",
		title: "友链原型实验室",
		description: "友链页的三套视觉方案，附申请弹窗交互原型。",
		meta: "3 方向",
	},
	{
		to: "/lab/announcement",
		en: "Announcement",
		title: "公告原型实验室",
		description: "公告卡片、详情页与 banner 的原型方案。",
		meta: "卡片 ×2 · 详情 · banner ×3",
	},
	{
		to: "/lab/theme",
		en: "Theme",
		title: "主题切换器实验室",
		description: "七种主题切换控件并排试用。",
		meta: "切换器 ×7",
	},
] as const;
