/** settingsKeys - 站点设置分组 query key 工厂
 *
 * 站点设置按菜单子页拆成 7 组，每组独立 queryKey。
 * 各子页 query/mutation 互不影响，消除单一全量 query 带来的跨子页回填竞态。
 */
export const settingsKeys = {
	/** 模块根 */
	all: ["settings"] as const,
	/** 基础信息组 */
	general: () => [...settingsKeys.all, "general"] as const,
	/** 认证组 */
	auth: () => [...settingsKeys.all, "auth"] as const,
	/** GitHub 组 */
	github: () => [...settingsKeys.all, "github"] as const,
	/** 关于博主组 */
	profile: () => [...settingsKeys.all, "profile"] as const,
	/** 关于页区块配置组 */
	about: () => [...settingsKeys.all, "about"] as const,
	/** LLM 组 */
	llm: () => [...settingsKeys.all, "llm"] as const,
	/** 代码运行器组 */
	codeRunner: () => [...settingsKeys.all, "code-runner"] as const,
};
