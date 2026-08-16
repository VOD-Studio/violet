/**
 * Lab 注册表 - /lab 索引页数据源
 *
 * 新增实验室三步：features/<name>-lab/ 建目录（小 lab 也可路由内自包含）、
 * routes/lab.<name>.tsx 建路由（createFileRoute("/lab/<name>")）、在此追加
 * 一条注册。lab 是原型工作台，不进主导航，选定方向后生产实现按此落地。
 */
export const LABS = [
	{
		to: "/lab/blog",
		en: "Blog",
		title: "博客排版实验室",
		description: "博客列表页（/blog）的候选排版方向对比，真实文章数据渲染，含动效与三态。",
		meta: "8 方向 · 真实数据",
	},
	{
		to: "/lab/friends",
		en: "Friends",
		title: "友链原型实验室",
		description: "友链页（/friends）的候选视觉方向对比，附「交换名片」申请弹窗的交互仪式原型。",
		meta: "3 方向 · 静态 mock",
	},
	{
		to: "/lab/announcement",
		en: "Announcement",
		title: "公告原型实验室",
		description: "公告卡片两方案、事件详情页与历史 banner 原型对比。",
		meta: "卡片 ×2 · 详情 · banner ×3",
	},
	{
		to: "/lab/theme",
		en: "Theme",
		title: "主题切换器实验室",
		description: "七种创意主题切换控件并排对比，点击切换观察交互手感与动画。",
		meta: "切换器 ×7",
	},
] as const;
