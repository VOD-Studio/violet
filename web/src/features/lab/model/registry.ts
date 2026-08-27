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
		description: "公告不是文章，是站点运营事件——公告区与横幅的候选方向并排开着，比着选。",
		meta: "方向 ×6 · 横幅 ×4",
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
	{
		to: "/lab/mascot",
		en: "Mascot",
		title: "吉祥物形象实验室",
		description: "选状态、做动作、测反应，38 套表情与完整导演控制都围在角色身边。",
		meta: "表情 ×38",
	},
	{
		to: "/lab/series",
		en: "Series",
		title: "在线书籍原型实验室",
		description: "不是给文章列表套书封——三套完整书籍体验，从书架、目录一直走到连续阅读。",
		meta: "体验 ×3 · 表面 ×3",
	},
	{
		to: "/lab/gallery",
		en: "Gallery",
		title: "图集原型实验室",
		description: "浏览流、详情网格与灯箱的候选方向并排开着——图集长什么样，比着选。",
		meta: "浏览 ×3 · 网格 ×3 · 灯箱 ×3",
	},
] as const;
