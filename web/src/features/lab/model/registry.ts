/**
 * Lab 注册表 - /lab 索引页数据源
 *
 * 新增实验室三步：features/lab/<name>/ 建目录（小 lab 也可路由内自包含）、
 * routes/lab.<name>.tsx 建路由（createFileRoute("/lab/<name>")）、在此追加
 * 一条注册。lab 是原型工作台，不进主导航，选定方向后生产实现按此落地。
 * 生产组件可直接引用 lab 内的原型件（如 Header 用 @features/lab/theme/ui
 * 的默认 segmented 变体），选定的方案升为现役。
 */
export const LABS = [
	{
		to: "/lab/blog",
		en: "Blog",
		title: "博客排版实验室",
		description: "博客列表页长什么样还没定稿——候选方向并排开着，比着选。",
		meta: "8 方向",
	},
	{
		to: "/lab/friends",
		en: "Friends",
		title: "友链原型实验室",
		description: "友链不该是一排安静的头像。三种方向，把交换链接做出仪式感。",
		meta: "3 方向",
	},
	{
		to: "/lab/announcement",
		en: "Announcement",
		title: "公告原型实验室",
		description: "公告要显眼，但不能吵。卡片、详情、banner 的候选都在这里。",
		meta: "卡片 ×2 · 详情 · banner ×3",
	},
	{
		to: "/lab/theme",
		en: "Theme",
		title: "主题切换器实验室",
		description: "主题切换键的样子没定，控件和尺寸都开着候选，挑顺手的那个。",
		meta: "切换器 ×4",
	},
	{
		to: "/lab/nav",
		en: "Back Nav",
		title: "返回导航实验室",
		description: "读到文章中段，返回入口已经离场——四种方案补上这条退路。",
		meta: "方案 ×4",
	},
] as const;
