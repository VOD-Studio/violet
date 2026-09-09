/** 关于页未配置内容时使用的完整默认叙事。 */
export const DEFAULT_ABOUT_COPY = {
	siteName: "Violet",
	tagline: "写代码的人，也写字。",
	bio: [
		"你好，欢迎来到这座仍在生长的数字花园。",
		"我把写代码、做产品与记录生活看作同一件事：先认真观察，再把复杂的问题整理成能够被理解、被使用的东西。这里留下的不只是答案，也包括方案如何变化、判断如何形成。",
		"Violet 既是一间公开书房，也是持续演进的个人作品。文章、图像、短动态和实验会在这里慢慢沉淀，接受时间的修订。",
	],
	role: "全栈工程师 / 独立创作者",
	location: "互联网的一隅",
	availableFor: "欢迎技术交流、开源协作与友链互换",
	skills: {
		strong: ["Go", "React", "TypeScript", "PostgreSQL", "Tailwind CSS"],
		learning: ["Rust", "WebAssembly", "分布式系统"],
		interests: ["字体排印", "摄影", "机械键盘", "独立游戏", "咖啡"],
	},
} as const;
