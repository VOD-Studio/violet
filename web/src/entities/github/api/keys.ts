/**
 * githubKeys - GitHub 数据查询的 query key 工厂
 */
export const githubKeys = {
	/** GitHub 模块根 key */
	all: ["github"] as const,
	/** 仓库列表维度 */
	repos: () => [...githubKeys.all, "repos"] as const,
	repo: (repo: string) => [...githubKeys.all, "repo", repo.toLowerCase()] as const,
};
